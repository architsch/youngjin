// Direct database manipulation for the playtest skill's "server admin" role, producing states normal
// play can't (e.g. rows at outdated versions, which exercise migration and its write-back).
//
// SAFETY: handles come only from lib/dbGuard.js, which resolves `staging` or `local` (there is no live
// target) and confines them to that namespace.
//
// Two versioning schemes are seeded:
//   - Firestore rows carry a `version` field, migrated by the DBVersionMigration arrays.
//   - Room content blobs in Cloud Storage carry a leading version byte, migrated by the
//     decoder/converter chains on VoxelGrid and ObjectGroup.
//
// Usage (every command takes an optional --target staging|local, defaulting to staging):
//   node dev/scripts/playtest/stagingAdmin.js inspect
//   node dev/scripts/playtest/stagingAdmin.js seed-users --version 0 --count 3
//   node dev/scripts/playtest/stagingAdmin.js seed-rooms --version 1 --count 2 [--owner <userID>] [--with-content]
//   node dev/scripts/playtest/stagingAdmin.js seed-population --version 4 --count 25 [--with-content] [--persist]
//   node dev/scripts/playtest/stagingAdmin.js set-user-type --user <userID> --type admin|member|guest [--run <runID>]
//   node dev/scripts/playtest/stagingAdmin.js restore-user-type --user <userID>
//   node dev/scripts/playtest/stagingAdmin.js verify-migration
//   node dev/scripts/playtest/stagingAdmin.js verify-funnel [--run <runID>]
//   node dev/scripts/playtest/stagingAdmin.js inspect-content
//   node dev/scripts/playtest/stagingAdmin.js downgrade-content --room <roomID> [--to 0]
//   node dev/scripts/playtest/stagingAdmin.js restore-content [--room <roomID>]
//   node dev/scripts/playtest/stagingAdmin.js list
//   node dev/scripts/playtest/stagingAdmin.js cleanup
//
// Every command prints JSON on stdout, naming the target it addressed.

const DBGuard = require("./lib/dbGuard");
const { generateRoomContent } = require("./generateRoomContent");
const { MILESTONES } = require("../analytics/funnelReport");

// Stamped on every document written here; `cleanup` deletes by it alone. Migrations copy unknown fields,
// so it survives write-backs (letting `verify-migration` identify seeds).
const MARKER = "__playtestSeed";

// The resolved target's prefix; names are composed from it and checked by the guard.
let PREFIX = null;

function collection(name) { return `${PREFIX}${name}`; }

// Downgrades back up the original blob under this tool's own path, for `restore-content`.
function backupRoot() { return `${PREFIX}playtest_backup`; }

// Current versions (migration array lengths), as literals since those modules are TypeScript; `inspect`
// reports what it finds, so drift shows.
const CURRENT_VERSION = { users: 5, rooms: 4 };

const ROOM_TYPE_REGULAR = 1;

// ─── Row builders ───────────────────────────────────────────────────────
// Rows exactly as each version's schema had them (later-added fields absent, later-dropped fields
// present); merely setting `version: 0` on a current row would migrate as a no-op.

// Pre-v4 rows carry a copy of their key as a field, which v3 -> v4 drops; seeds include it so that step
// has work. The value deliberately differs from the key, proving callers get the key, not the field.
function addLegacyStoredID(row, version, currentVersion, runID)
{
    if (version < currentVersion)
        row.id = `stale-${runID}`;
    return row;
}

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

    return addLegacyStoredID(row, version, CURRENT_VERSION.users, runID);
}

function buildRoom(version, runID, index, ownerUserID)
{
    const row = {
        version,
        roomType: ROOM_TYPE_REGULAR,
        ownerUserID: ownerUserID || "",
        texturePackPath: "default",        // Overwritten by generation when content is seeded.
        [MARKER]: runID,
    };

    // Absent so v0 -> v1 performs its owner lookup (concurrent reads across stale rooms sharing an owner).
    if (version >= 1) row.ownerUserName = `Playtest-${runID}-owner`;
    if (version >= 2) row.editors = [];
    if (version >= 3) row.roomName = "";

    return addLegacyStoredID(row, version, CURRENT_VERSION.rooms, runID);
}

// ─── Room content ───────────────────────────────────────────────────────
// Content comes from the real generator, which also decides room-level parameters (the texture pack), so
// those are returned with the bytes for the row: a row and blob built against different packs describe
// an unreachable state.
function generateContentFor(roomName, ownerUserID, ownerUserName)
{
    return generateRoomContent(roomName, ROOM_TYPE_REGULAR, ownerUserID, ownerUserName);
}

// Writes the blob to Cloud Storage and the generated parameters to the row.
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
        let withStoredID = 0;
        snap.docs.forEach(doc => {
            const data = doc.data();
            const v = String(data.version);
            byVersion[v] = (byVersion[v] || 0) + 1;
            if (data[MARKER]) seeded++;
            // Rows still holding a stored id show how far the v3 -> v4 sweep has got through organic data.
            if (data.id !== undefined) withStoredID++;
        });
        // Rows below the current version migrate on their next read (driving the write-back path).
        const outdated = Object.entries(byVersion)
            .filter(([v]) => Number(v) < CURRENT_VERSION[name])
            .reduce((sum, [, count]) => sum + count, 0);

        report[collection(name)] = {
            total: snap.size,
            currentVersion: CURRENT_VERSION[name],
            byVersion,
            outdated,
            withStoredID,
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

// Seeds Member accounts paired with owned rooms. Staging can only mint guests (no dev OAuth bypass) and
// guests can't own rooms, so this is how the room list gets filled (at outdated versions too).
// `--with-content` generates each room (usually wanted): without a blob, entering falls back to a hub and
// logs a load error that later baselines would inherit.
async function seedPopulation(db, bucket, version, count, runID, options)
{
    const batch = db.batch();
    const created = [];
    const blobs = [];

    // Users and rooms version separately, so --version means "no newer than" (a future version can't
    // migrate).
    const userVersion = Math.min(version, CURRENT_VERSION.users);
    const roomVersion = Math.min(version, CURRENT_VERSION.rooms);

    for (let i = 0; i < count; i++)
    {
        const userRef = db.collection(collection("users")).doc();
        const roomRef = db.collection(collection("rooms")).doc();

        const user = buildUser(userVersion, runID, i);
        user.userType = 1;                                  // Member — guests cannot own a room.
        user.userName = `Playtest-${runID}-${i}`;
        user.email = `${runID}-${i}@playtest.local`;
        user.ownedRoomID = roomRef.id;
        if (options.persist) user.__playtestPersist = true;
        batch.set(userRef, user);

        const room = buildRoom(roomVersion, runID, i, userRef.id);
        // The list renders the denormalized owner name, so it must match the user document.
        if (roomVersion >= 1) room.ownerUserName = user.userName;
        if (options.persist) room.__playtestPersist = true;

        const entry = { userID: userRef.id, roomID: roomRef.id, userName: user.userName };

        if (options.withContent)
        {
            // Each room from its own seed, so the population varies like organic rooms.
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
        userVersion, roomVersion, count, runID,
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
        const room = buildRoom(version, runID, i, ownerUserID);
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

// ─── Who a session is allowed to be ─────────────────────────────────────
// Staging sessions can only be guests (production mode), which puts admin- and member-only checks out of
// reach. As in production (admins are promoted by hand in the DB), a run mints a guest through the real
// page, changes its type here, and reloads; the server reads user type on every request and socket
// handshake, so nothing restarts. Safety: accounts with an email address are refused, and the seed
// marker makes `cleanup` delete the promoted account.

const PRIOR_USER_TYPE_FIELD = "__playtestPriorUserType";
const USER_TYPE_BY_NAME = { admin: 0, member: 1, guest: 2 };

async function setUserType(db, userID, typeName, runID)
{
    if (!userID)
        throw new Error("set-user-type needs --user <userID> (the guest minted by the run's own browser).");

    const userType = USER_TYPE_BY_NAME[String(typeName).toLowerCase()];
    if (userType === undefined)
        throw new Error(`--type must be one of: ${Object.keys(USER_TYPE_BY_NAME).join(", ")}.`);

    const ref = db.collection(collection("users")).doc(userID);
    const snap = await ref.get();
    if (!snap.exists)
        throw new Error(`No user "${userID}" in ${collection("users")}.`);

    const before = snap.data();
    if (before.email)
        throw new Error(
            `Refusing to change the type of "${userID}" — it carries an email address, so it is a ` +
            `registered account belonging to a person. Use a guest this run minted instead.`);

    if (before.userType === userType)
        return { userID, userName: before.userName, userType, unchanged: true };

    await ref.update({
        userType,
        // Only the first change records the original type, so repeated promotions still restore correctly.
        ...(before[PRIOR_USER_TYPE_FIELD] === undefined
            ? { [PRIOR_USER_TYPE_FIELD]: before.userType } : {}),
        [MARKER]: runID,
    });

    return {
        userID,
        userName: before.userName,
        priorUserType: before[PRIOR_USER_TYPE_FIELD] ?? before.userType,
        userType,
        runID,
        note: "Reload the page for this to take effect (the type is re-read per request and per " +
            "socket handshake).",
    };
}

async function restoreUserType(db, userID)
{
    if (!userID)
        throw new Error("restore-user-type needs --user <userID>.");

    const ref = db.collection(collection("users")).doc(userID);
    const snap = await ref.get();
    if (!snap.exists)
        throw new Error(`No user "${userID}" in ${collection("users")}.`);

    const before = snap.data();
    if (before[PRIOR_USER_TYPE_FIELD] === undefined)
        throw new Error(
            `Refusing to change "${userID}" — it carries no record of a prior type, so it was not ` +
            `promoted by this tool and its type is not this tool's to restore.`);

    await ref.update({
        userType: before[PRIOR_USER_TYPE_FIELD],
        [PRIOR_USER_TYPE_FIELD]: DBGuard.FieldValue.delete(),
    });

    return { userID, userName: before.userName, userType: before[PRIOR_USER_TYPE_FIELD] };
}

// Reports whether each seeded document was migrated and written back in storage; a row still at its
// seeded version after a server read means the write-back failed silently.
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
                // A current row still carrying its stored id means the write-back reintroduced it.
                storedIDRemains: data.id !== undefined,
            };
        });
        results[collection(name)] = {
            seeded: docs.length,
            migrated: docs.filter(d => d.migrated).length,
            stillOutdated: docs.filter(d => !d.migrated).length,
            storedIDRemains: docs.filter(d => d.storedIDRemains).length,
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

// `--persist` documents are kept unless `--all`: current-version seeds are reusable fixtures, while
// outdated seeds migrate on first read and so are never persistent.
async function cleanup(db, bucket, runID, includePersistent)
{
    const results = {};
    const roomIDs = [];

    for (const name of ["users", "rooms"])
    {
        const snap = await db.collection(collection(name)).where(MARKER, "!=", null).get();
        // Filtered from the marker query's results, so unmarked documents can never be deleted.
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

// ─── Acquisition analytics ──────────────────────────────────────────────
// Playtests drive real guests through the funnel ServerAnalyticsManager records, exercising analytics
// end to end. A run's visitors carry a ref tag with a reserved prefix, and cleanup deletes only that prefix.
const PLAYTEST_REF_PREFIX = "playtest-";

// Composed with the server's sanitizing rule (a-z0-9_- only, capped at 32 chars), so the sent and
// read-back tags match.
function playtestRef(runID)
{
    const cleaned = String(runID || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    return `${PLAYTEST_REF_PREFIX}${cleaned}`.slice(0, 32);
}

// Reports the milestones the run's visitors reached under the run's own source. No verdict: the expected
// milestones depend on the plan, which only its agent knows.
async function verifyFunnel(db, runID)
{
    const refTag = runID ? playtestRef(runID) : null;
    const snap = await db.collection(collection("acquisition")).get();

    const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const cohorts = (refTag ? all.filter(c => c.source === refTag) : all)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const totals = {};
    for (const cohort of cohorts)
    {
        for (const [code, value] of Object.entries(cohort.counts || {}))
            totals[code] = (totals[code] || 0) + (typeof value === "number" ? value : 0);
    }

    return {
        refTag: refTag || "(all sources)",
        cohortDocuments: cohorts.length,
        cohorts: cohorts.map(c => ({ id: c.id, source: c.source, cohortDay: c.cohortDay, counts: c.counts || {} })),
        // Named via the report tool's table, so there's one milestone list.
        reached: MILESTONES
            .filter(m => totals[m.code] > 0)
            .map(m => ({ code: m.code, key: m.key, label: m.label, count: totals[m.code] })),
        notReached: MILESTONES.filter(m => !totals[m.code]).map(m => m.key),
    };
}

// Deletes only cohort documents with the reserved prefix; organic traffic can't be named.
async function cleanupAcquisition(db)
{
    const snap = await db.collection(collection("acquisition")).get();
    const targets = snap.docs.filter(doc => String(doc.data().source || "").startsWith(PLAYTEST_REF_PREFIX));

    const batch = db.batch();
    targets.forEach(doc => batch.delete(doc.ref));
    if (targets.length > 0) await batch.commit();

    return { deleted: targets.length, docIDs: targets.map(d => d.id) };
}

// ─── Room content versioning (Cloud Storage binary) ─────────────────────
// A content blob is VoxelGrid's encoding then ObjectGroup's, each with a version byte; only VoxelGrid's
// is at a fixed offset (byte 0), so these commands address it. Rewriting it downward yields a genuine old
// room only between versions sharing a decoder (identical body layout); across decoders it yields
// corruption, so that downgrade is refused. Cross-decoder migration is covered by
// tests/integration/scenarios/voxel-grid-migration.test.ts instead.
const CONTENT_FILE = "content.bin";

// Voxel-grid format version -> decoder. Versions sharing a decoder share a body layout.
const VOXEL_GRID_DECODER_BY_VERSION = { 0: "decoder_1", 1: "decoder_1", 2: "decoder_2" };

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

    const fromDecoder = VOXEL_GRID_DECODER_BY_VERSION[originalVersion];
    const toDecoder = VOXEL_GRID_DECODER_BY_VERSION[toVersion];
    if (fromDecoder === undefined || toDecoder === undefined)
    {
        throw new Error(`No decoder is recorded for voxel-grid version ` +
            `${fromDecoder === undefined ? originalVersion : toVersion}. ` +
            `Add it to VOXEL_GRID_DECODER_BY_VERSION before downgrading across it.`);
    }
    if (fromDecoder !== toDecoder)
    {
        throw new Error(
            `Refusing to downgrade version ${originalVersion} to ${toVersion}: they are read by ` +
            `different decoders (${fromDecoder} vs ${toDecoder}), so rewriting the version byte ` +
            `would leave the header claiming a layout the body is not written in. That is a corrupt ` +
            `blob, not an old room. Cross-decoder migration is covered by ` +
            `tests/integration/scenarios/voxel-grid-migration.test.ts against real old-encoder fixtures.`);
    }

    // Back up the original first, never overwriting an existing backup with a downgraded copy.
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

    // The guard resolves the target and returns handles confined to it.
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
        case "set-user-type":
            output = await setUserType(db, flag("user", ""), flag("type", ""), runID);
            break;
        case "restore-user-type":  output = await restoreUserType(db, flag("user", "")); break;
        case "verify-migration":   output = await verifyMigration(db); break;
        case "verify-funnel":      output = await verifyFunnel(db, flag("run", "")); break;
        case "inspect-content":    output = await inspectContent(bucket); break;
        case "downgrade-content":  output = await downgradeContent(bucket, flag("room", ""), parseInt(flag("to", "0"), 10)); break;
        case "restore-content":    output = await restoreContent(bucket, flag("room", "")); break;
        case "list":               output = await list(db); break;
        case "cleanup":
            // Content is restored first, even if the Firestore cleanup finds nothing.
            output = {
                content: await restoreContent(bucket, ""),
                rows: await cleanup(db, bucket, flag("run", ""), process.argv.includes("--all")),
                // Not per run: a cohort document aggregates every playtest on its arrival day, so the prefix selects.
                acquisition: await cleanupAcquisition(db),
            };
            break;
        default:
            console.error(`Unknown command: ${command || "(none)"}\n` +
                `Commands: inspect | seed-users | seed-rooms | seed-population | set-user-type |\n` +
                `          restore-user-type | verify-migration | verify-funnel | inspect-content |\n` +
                `          downgrade-content | restore-content | list | cleanup\n` +
                `Targets:  --target staging (default) | --target local`);
            process.exit(2);
    }

    // Every command reports the namespace it addressed.
    console.log(JSON.stringify({ ...describe(), command, result: output }, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error(JSON.stringify({ error: err.message }, null, 2));
    process.exit(1);
});
