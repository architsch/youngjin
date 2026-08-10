// Direct database manipulation for the playtest skill's "server admin" role.
//
// Why this exists: the states most worth testing are the ones a human cannot conveniently
// produce by playing. A row left at an outdated version is the clearest example — every
// document the app writes is written at the current version, so the migration path and its
// fire-and-forget write-back are only ever exercised by rows that predate a schema change.
// Seeding those rows directly is the only way to put that code under test on a real server.
//
// SAFETY: this script never constructs a database handle of its own. It asks lib/dbGuard.js,
// which resolves a target (`staging` or `local` — there is no live target) and hands back
// handles that can only address that target's namespace. See that file for the reasoning and
// for the two layers outside it.
//
// There are two independent versioning schemes, and both are worth seeding:
//   - Firestore rows carry a `version` field, migrated by the DBVersionMigration arrays.
//   - Room content blobs in Cloud Storage carry a leading version byte, migrated by the
//     decoder/converter chains on VoxelGrid and ObjectGroup.
//
// Usage (every command takes an optional --target staging|local, defaulting to staging):
//   node dev/scripts/playtest/stagingAdmin.js inspect
//   node dev/scripts/playtest/stagingAdmin.js seed-users --version 0 --count 3
//   node dev/scripts/playtest/stagingAdmin.js seed-rooms --version 1 --count 2 [--owner <userID>] [--with-content]
//   node dev/scripts/playtest/stagingAdmin.js seed-population --version 3 --count 25 [--with-content] [--persist]
//   node dev/scripts/playtest/stagingAdmin.js verify-migration
//   node dev/scripts/playtest/stagingAdmin.js inspect-content
//   node dev/scripts/playtest/stagingAdmin.js downgrade-content --room <roomID> [--to 0]
//   node dev/scripts/playtest/stagingAdmin.js restore-content [--room <roomID>]
//   node dev/scripts/playtest/stagingAdmin.js list
//   node dev/scripts/playtest/stagingAdmin.js cleanup
//
// Every command prints JSON on stdout so an agent can consume it directly, and every command's
// output names the target it addressed.

const DBGuard = require("./lib/dbGuard");
const { generateRoomContent } = require("./generateRoomContent");

// Stamped on every document this tool writes. `cleanup` deletes on this field alone, so a
// document that was not seeded here can never be removed by it. Version migrations copy
// unknown fields through untouched, so the marker survives a write-back — which is also
// what lets `verify-migration` tell a migrated seed apart from an organic document.
const MARKER = "__playtestSeed";

// The namespace prefix for the resolved target, filled in once the guard has resolved it.
// Names are composed from it; the guard is what checks them.
let PREFIX = null;

function collection(name) { return `${PREFIX}${name}`; }

// Downgrades copy the original blob aside first, under a path that belongs to this tool alone,
// so `restore-content` can always put the room back exactly as it was.
function backupRoot() { return `${PREFIX}playtest_backup`; }

// Current versions, mirrored from the migration arrays (their length is the current version).
// Kept as literals rather than imported because those modules are TypeScript; `inspect`
// reports what it finds so a drift between the two shows up rather than passing silently.
const CURRENT_VERSION = { users: 3, rooms: 3 };

const ROOM_TYPE_REGULAR = 1;

// ─── Row builders ───────────────────────────────────────────────────────
// Each builder produces a row exactly as that version's schema had it — the fields a later
// migration adds are absent, and the fields a later migration drops are present. A seed that
// merely set `version: 0` on a current-shaped row would migrate to a no-op and prove nothing.

function buildUser(version, runID, index)
{
    const now = Date.now();
    const row = {
        version,
        userName: `Playtest-${runID}-${index}`,
        userType: 2,                       // Guest
        email: "",
        lastRoomID: "",
        lastLoginAt: now,
        createdAt: now,
        loginCount: 0,
        ownedRoomID: "",
        [MARKER]: runID,
    };

    // v0 -> v1 adds playerMetadata and drops totalPlaytimeMs.
    if (version < 1) row.totalPlaytimeMs = 0;
    else row.playerMetadata = {};

    // v1 -> v2 drops tutorialStep and derives singlePlayerMode from it.
    if (version < 2) row.tutorialStep = 0;
    else row.singlePlayerMode = "tutorial";

    // v2 -> v3 adds ftue.
    if (version >= 3) row.ftue = "";

    return row;
}

function buildRoom(version, runID, index, docID, ownerUserID)
{
    const row = {
        id: docID,
        version,
        roomType: ROOM_TYPE_REGULAR,
        ownerUserID: ownerUserID || "",
        texturePackPath: "default",        // Overwritten by generation when content is seeded.
        [MARKER]: runID,
    };

    // v0 -> v1 adds ownerUserName by looking the owner up. Left absent so that migration
    // actually performs its lookup — which is the step that makes several stale rooms
    // sharing one owner fire concurrent reads, the contention this seeding is meant to probe.
    if (version >= 1) row.ownerUserName = `Playtest-${runID}-owner`;
    if (version >= 2) row.editors = [];
    if (version >= 3) row.roomName = "";

    return row;
}

// ─── Room content ───────────────────────────────────────────────────────
//
// A seeded room's content comes from the game's own generator — the same RoomGenerationUtil the
// server runs when a user creates a room, producing the same encoding DBRoomUtil writes. That
// matters for more than realism. Generation does not only fill a room with voxels and objects;
// it decides room-level parameters that the contents were chosen to suit, the texture pack above
// all. Every voxel's texture is an index into one specific pack's atlas, so a room whose row
// names one pack and whose blob was built against another is a room that could not have been
// generated, and testing against it means testing against a state the game cannot reach.
//
// Which is also why this returns the parameters alongside the bytes: the row has to carry what
// generation decided, not a default the seeder picked.
function generateContentFor(roomName, ownerUserID, ownerUserName)
{
    return generateRoomContent(roomName, ROOM_TYPE_REGULAR, ownerUserID, ownerUserName);
}

// Applies a generated room to the pair of places it has to land: the blob in Cloud Storage, and
// the generation-decided parameters on the Firestore row.
function applyGeneratedContent(row, generated)
{
    row.texturePackPath = generated.texturePackPath;
    if (row.version >= 3) row.roomName = generated.roomName;
    return row;
}

// ─── Commands ───────────────────────────────────────────────────────────

async function inspect(db)
{
    const report = {};
    for (const name of ["users", "rooms"])
    {
        const snap = await db.collection(collection(name)).get();
        const byVersion = {};
        let seeded = 0;
        snap.docs.forEach(doc => {
            const data = doc.data();
            const v = String(data.version);
            byVersion[v] = (byVersion[v] || 0) + 1;
            if (data[MARKER]) seeded++;
        });
        // Anything below the current version is a row the next read will migrate — which is
        // precisely the population that drives the write-back path.
        const outdated = Object.entries(byVersion)
            .filter(([v]) => Number(v) < CURRENT_VERSION[name])
            .reduce((sum, [, count]) => sum + count, 0);

        report[collection(name)] = {
            total: snap.size,
            currentVersion: CURRENT_VERSION[name],
            byVersion,
            outdated,
            playtestSeeded: seeded,
        };
    }
    return report;
}

async function seedUsers(db, version, count, runID)
{
    const created = [];
    const batch = db.batch();
    for (let i = 0; i < count; i++)
    {
        const ref = db.collection(collection("users")).doc();
        batch.set(ref, buildUser(version, runID, i));
        created.push(ref.id);
    }
    await batch.commit();
    return { collection: collection("users"), version, count, runID, docIDs: created };
}

// Creates whole owners — a Member account paired with the room it owns — rather than users and
// rooms independently.
//
// This is the population that the room-list UI is hard to test without. Staging runs in
// production mode, where the dev OAuth bypass is disabled, so a browser session can only ever
// become a guest; guests cannot own rooms, and the list is a list of owned rooms. Producing
// twenty distinct room owners through the real sign-in flow would mean twenty Google accounts.
// Writing the pair directly is the only practical way to fill the list, and it also lets the
// list be filled with rows at *outdated* versions, which no amount of real play can produce.
//
// `--with-content` generates each room properly, and is usually wanted. Without it a seeded room
// is listed but cannot be entered: the server finds no blob, logs a load failure, and falls back
// to a hub. That fallback is correct behaviour, but it makes the seeded rooms decorative, and it
// puts a recurring error in the log that later baselines would inherit.
async function seedPopulation(db, bucket, version, count, runID, options)
{
    const batch = db.batch();
    const created = [];
    const blobs = [];

    for (let i = 0; i < count; i++)
    {
        const userRef = db.collection(collection("users")).doc();
        const roomRef = db.collection(collection("rooms")).doc();

        const user = buildUser(version, runID, i);
        user.userType = 1;                                  // Member — guests cannot own a room.
        user.userName = `Playtest-${runID}-${i}`;
        user.email = `${runID}-${i}@playtest.local`;
        user.ownedRoomID = roomRef.id;
        if (options.persist) user.__playtestPersist = true;
        batch.set(userRef, user);

        const room = buildRoom(version, runID, i, roomRef.id, userRef.id);
        // The denormalized owner name is what the list renders, so at versions that have the
        // field it must agree with the user document — a mismatch would look like a UI bug
        // rather than the seeding artifact it is.
        if (version >= 1) room.ownerUserName = user.userName;
        if (options.persist) room.__playtestPersist = true;

        const entry = { userID: userRef.id, roomID: roomRef.id, userName: user.userName };

        if (options.withContent)
        {
            // Each room is generated from its own seed, so the population comes out as varied
            // as an organic one: different layouts, different texture packs, different numbers
            // of hung canvases. Seeding one interior copied N times would make every list entry
            // open on the same room and would hide anything that depends on the differences.
            const generated = generateContentFor(`Playtest-${runID}-${i}`, userRef.id, user.userName);
            applyGeneratedContent(room, generated);
            blobs.push({ roomID: roomRef.id, content: generated.content });

            entry.texturePackPath = generated.texturePackPath;
            entry.voxelCount = generated.voxelCount;
            entry.objectCount = generated.objectCount;
            entry.contentBytes = generated.content.length;
        }

        batch.set(roomRef, room);
        created.push(entry);
    }

    await batch.commit();

    for (const blob of blobs)
        await bucket.file(contentPath(blob.roomID)).save(blob.content,
            { metadata: { contentType: "application/octet-stream" }, resumable: false });

    return {
        collection: `${collection("users")} + ${collection("rooms")}`,
        version, count, runID,
        withContent: Boolean(options.withContent),
        contentSource: options.withContent ? "procedural generation (RoomGenerationUtil)" : "none",
        persist: Boolean(options.persist),
        owners: created,
    };
}

async function seedRooms(db, bucket, version, count, runID, ownerUserID, options)
{
    const created = [];
    const blobs = [];
    const batch = db.batch();

    for (let i = 0; i < count; i++)
    {
        const ref = db.collection(collection("rooms")).doc();
        // The room's `id` field is what queries match on, and it mirrors the document ID.
        const room = buildRoom(version, runID, i, ref.id, ownerUserID);
        const entry = { roomID: ref.id };

        if (options.withContent)
        {
            const generated = generateContentFor(`Playtest-${runID}-${i}`, ownerUserID || "",
                room.ownerUserName || "");
            applyGeneratedContent(room, generated);
            blobs.push({ roomID: ref.id, content: generated.content });
            entry.texturePackPath = generated.texturePackPath;
            entry.objectCount = generated.objectCount;
        }

        batch.set(ref, room);
        created.push(entry);
    }
    await batch.commit();

    for (const blob of blobs)
        await bucket.file(contentPath(blob.roomID)).save(blob.content,
            { metadata: { contentType: "application/octet-stream" }, resumable: false });

    return {
        collection: collection("rooms"),
        version, count, runID,
        ownerUserID: ownerUserID || "",
        withContent: Boolean(options.withContent),
        rooms: created,
    };
}

// Reads every seeded document back and reports whether the server has since migrated and
// written it back. This is the assertion the whole seeding exercise exists to make: the row
// should have advanced to the current version *in storage*, not merely in the reply the
// client received. A row still sitting at its seeded version after the server has read it
// means the write-back silently failed.
async function verifyMigration(db)
{
    const results = {};
    for (const name of ["users", "rooms"])
    {
        const snap = await db.collection(collection(name)).where(MARKER, "!=", null).get();
        const docs = snap.docs.map(doc => {
            const data = doc.data();
            return {
                docID: doc.id,
                runID: data[MARKER],
                version: data.version,
                migrated: data.version === CURRENT_VERSION[name],
            };
        });
        results[collection(name)] = {
            seeded: docs.length,
            migrated: docs.filter(d => d.migrated).length,
            stillOutdated: docs.filter(d => !d.migrated).length,
            docs,
        };
    }
    return results;
}

async function list(db)
{
    const results = {};
    for (const name of ["users", "rooms"])
    {
        const snap = await db.collection(collection(name)).where(MARKER, "!=", null).get();
        results[collection(name)] = snap.docs.map(doc => ({
            docID: doc.id,
            runID: doc.data()[MARKER],
            version: doc.data().version,
        }));
    }
    return results;
}

// Documents seeded with `--persist` are left alone unless `--all` is given. The distinction is
// not cosmetic: a population seeded at the current version is a reusable fixture, because
// nothing about reading it changes it. A row seeded at an *outdated* version is single-use —
// the first read migrates it and writes it back at the current version, after which it is no
// longer the thing the test needed. Those must be re-seeded per run, so they are never
// persistent.
async function cleanup(db, bucket, runID, includePersistent)
{
    const results = {};
    const roomIDs = [];

    for (const name of ["users", "rooms"])
    {
        const snap = await db.collection(collection(name)).where(MARKER, "!=", null).get();
        // Filtering in memory keeps the delete set derived from the marker query above, so a
        // document without the marker can never enter it.
        const targets = snap.docs.filter(doc => {
            const data = doc.data();
            if (runID && data[MARKER] !== runID) return false;
            if (data.__playtestPersist && !includePersistent) return false;
            return true;
        });

        const batch = db.batch();
        targets.forEach(doc => batch.delete(doc.ref));
        if (targets.length > 0) await batch.commit();

        if (name === "rooms") targets.forEach(doc => roomIDs.push(doc.id));

        const kept = snap.docs.filter(doc => !targets.includes(doc));
        results[collection(name)] = {
            deleted: targets.length,
            keptPersistent: kept.filter(d => d.data().__playtestPersist).length,
            docIDs: targets.map(d => d.id),
        };
    }

    // A deleted room's content blob would otherwise be orphaned in the bucket forever.
    let blobsDeleted = 0;
    for (const roomID of roomIDs)
    {
        const file = bucket.file(contentPath(roomID));
        if ((await file.exists())[0]) { await file.delete(); blobsDeleted++; }
    }
    results.contentBlobsDeleted = blobsDeleted;

    return results;
}

// ─── Room content versioning (Cloud Storage binary) ─────────────────────
//
// A content blob is VoxelGrid's encoding followed by ObjectGroup's, and each begins with its
// own version byte. Only the VoxelGrid one sits at a fixed offset (byte 0) — reaching
// ObjectGroup's would mean decoding the entire voxel grid first — so that is the one these
// commands address, and it is the one with a live migration path today.
//
// Rewriting byte 0 downward is a legitimate way to manufacture an old blob rather than a
// corrupt one: VoxelGrid's decoder for version 0 is the same function as the current
// decoder, so the body layout is identical and only the 0 -> 1 converter's effect
// (re-adding the corner walls) distinguishes the two.

const CONTENT_FILE = "content.bin";

function contentPath(roomID) { return `${collection("rooms")}/${roomID}/${CONTENT_FILE}`; }
function backupPath(roomID) { return `${backupRoot()}/${roomID}/${CONTENT_FILE}`; }

async function inspectContent(bucket)
{
    const [files] = await bucket.getFiles({ prefix: `${collection("rooms")}/` });
    const [backups] = await bucket.getFiles({ prefix: `${backupRoot()}/` });
    const backedUp = new Set(backups.map(f => f.name.split("/")[1]));

    const rooms = [];
    for (const file of files)
    {
        if (!file.name.endsWith(CONTENT_FILE)) continue;
        const roomID = file.name.split("/")[1];
        const [buffer] = await file.download();
        rooms.push({
            roomID,
            bytes: buffer.length,
            voxelGridVersion: buffer[0],
            hasBackup: backedUp.has(roomID),
        });
    }
    return { bucket: bucket.name, rooms };
}

async function downgradeContent(bucket, roomID, toVersion)
{
    if (!roomID)
        throw new Error("downgrade-content requires --room <roomID>");

    const file = bucket.file(contentPath(roomID));
    const [exists] = await file.exists();
    if (!exists)
        throw new Error(`No content blob at ${contentPath(roomID)}`);

    const [buffer] = await file.download();
    const originalVersion = buffer[0];
    if (toVersion >= originalVersion)
        throw new Error(`--to ${toVersion} is not below the current version (${originalVersion}); nothing to downgrade.`);

    // Back the original up before touching it, and never overwrite an existing backup —
    // a second downgrade of the same room must not replace the pristine copy with a
    // already-downgraded one.
    const backup = bucket.file(backupPath(roomID));
    const [backupExists] = await backup.exists();
    if (!backupExists)
        await backup.save(buffer, { metadata: { contentType: "application/octet-stream" }, resumable: false });

    const downgraded = Buffer.from(buffer);
    downgraded[0] = toVersion;
    await file.save(downgraded, { metadata: { contentType: "application/octet-stream" }, resumable: false });

    return {
        roomID,
        path: contentPath(roomID),
        originalVersion,
        newVersion: toVersion,
        bytes: downgraded.length,
        backupPath: backupPath(roomID),
        backupCreated: !backupExists,
    };
}

async function restoreContent(bucket, roomID)
{
    const [backups] = await bucket.getFiles({ prefix: `${backupRoot()}/` });
    const targets = backups.filter(f => f.name.endsWith(CONTENT_FILE) && (!roomID || f.name.split("/")[1] === roomID));

    const restored = [];
    for (const backup of targets)
    {
        const id = backup.name.split("/")[1];
        const [buffer] = await backup.download();
        await bucket.file(contentPath(id)).save(buffer,
            { metadata: { contentType: "application/octet-stream" }, resumable: false });
        await backup.delete();
        restored.push({ roomID: id, bytes: buffer.length, voxelGridVersion: buffer[0] });
    }
    return { restored };
}

// ─── Entry point ────────────────────────────────────────────────────────

function flag(name, fallback)
{
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

async function main()
{
    const command = process.argv[2];

    // No handle is constructed here. The guard resolves the target and returns handles that
    // cannot address anything outside it.
    const { db, bucket, target, describe } = DBGuard.connect(process.argv);
    PREFIX = target.prefix;

    const runID = flag("run", `r${Date.now().toString(36)}`);
    const version = parseInt(flag("version", "0"), 10);
    const count = parseInt(flag("count", "1"), 10);
    const withContent = process.argv.includes("--with-content");

    let output;
    switch (command)
    {
        case "inspect":            output = await inspect(db); break;
        case "seed-users":         output = await seedUsers(db, version, count, runID); break;
        case "seed-rooms":
            output = await seedRooms(db, bucket, version, count, runID, flag("owner", ""), { withContent });
            break;
        case "seed-population":
            output = await seedPopulation(db, bucket, version, count, runID, {
                withContent,
                persist: process.argv.includes("--persist"),
            });
            break;
        case "verify-migration":   output = await verifyMigration(db); break;
        case "inspect-content":    output = await inspectContent(bucket); break;
        case "downgrade-content":  output = await downgradeContent(bucket, flag("room", ""), parseInt(flag("to", "0"), 10)); break;
        case "restore-content":    output = await restoreContent(bucket, flag("room", "")); break;
        case "list":               output = await list(db); break;
        case "cleanup":
            // Restoring content comes first: a downgraded room must be put back even if the
            // Firestore cleanup below finds nothing to delete.
            output = {
                content: await restoreContent(bucket, ""),
                rows: await cleanup(db, bucket, flag("run", ""), process.argv.includes("--all")),
            };
            break;
        default:
            console.error(`Unknown command: ${command || "(none)"}\n` +
                `Commands: inspect | seed-users | seed-rooms | seed-population | verify-migration |\n` +
                `          inspect-content | downgrade-content | restore-content | list | cleanup\n` +
                `Targets:  --target staging (default) | --target local`);
            process.exit(2);
    }

    // Which namespace was addressed is reported on every command, so it is never something the
    // reader of a playtest report has to infer.
    console.log(JSON.stringify({ ...describe(), command, result: output }, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error(JSON.stringify({ error: err.message }, null, 2));
    process.exit(1);
});
