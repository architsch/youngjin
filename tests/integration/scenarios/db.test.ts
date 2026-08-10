/**
 * Integration tests: the DB query layer, against a real (emulated) Firestore.
 *
 * Every other suite replaces the DB layer with an in-memory mock, which leaves the query runners
 * themselves — the code that decides what Firestore is actually asked to do — untested. A mock
 * cannot stand in here: the defects this suite is built around are all ones only a real Firestore
 * exhibits (what it accepts inside a transaction, how many writes it takes per commit, what it
 * stores when a write is malformed).
 *
 * Requires the Firestore emulator. Without one the whole suite skips itself — see
 * `test:integration:db` for a run that starts one.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import EmulatorDB, { EMULATOR_HOST } from "../helpers/emulatorDB";
import DBQuery from "../../../src/server/db/types/dbQuery";
import DBQueryResponse from "../../../src/server/db/types/dbQueryResponse";
import { DBRow } from "../../../src/server/db/types/row/dbRow";
import DBRoom from "../../../src/server/db/types/row/dbRoom";
import DBUser from "../../../src/server/db/types/row/dbUser";
import DBUserUtil from "../../../src/server/db/util/dbUserUtil";
import LogUtil from "../../../src/shared/system/util/logUtil";
import DBCacheUtil from "../../../src/server/db/util/dbCacheUtil";
import DBQueryRateMonitorUtil from "../../../src/server/db/util/dbQueryRateMonitorUtil";
import DBMigrationWriteBackUtil from "../../../src/server/db/util/dbMigrationWriteBackUtil";
import DBUserVersionMigration from "../../../src/server/db/types/versionMigration/dbUserVersionMigration";
import DBRoomVersionMigration from "../../../src/server/db/types/versionMigration/dbRoomVersionMigration";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../src/shared/system/sharedConstants";
import { COLLECTION_ROOMS, COLLECTION_USERS, DB_MAX_WRITES_PER_COMMIT } from "../../../src/server/system/serverConstants";

const USER_VERSION = DBUserVersionMigration.length;
const ROOM_VERSION = DBRoomVersionMigration.length;

const emulatorAvailable = await EmulatorDB.isAvailable();
if (!emulatorAvailable)
{
    console.warn(
        `\n[db.test.ts] SKIPPED — no Firestore emulator at ${EMULATOR_HOST}.` +
        `\n              Run "npm run test:integration:db" to run this suite with one.\n`);
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

// Rows as the current schema defines them. Tests that are about migration override "version"
// (and drop/add fields) to describe rows written by an older schema.
function currentUser(overrides: Partial<DBUser> = {}): DBRow
{
    return {
        version: USER_VERSION,
        userName: "user",
        userType: UserTypeEnumMap.Guest,
        email: "",
        singlePlayerMode: "",
        lastRoomID: "",
        lastLoginAt: 1_000,
        createdAt: 1_000,
        loginCount: 1,
        ownedRoomID: "",
        ftue: "",
        playerMetadata: {},
        ...overrides,
    } as DBRow;
}

function currentRoom(overrides: Partial<DBRoom> = {}): DBRow
{
    return {
        version: ROOM_VERSION,
        roomName: "",
        roomType: RoomTypeEnumMap.Regular,
        ownerUserID: "",
        ownerUserName: "",
        texturePackPath: "pack",
        editors: [],
        ...overrides,
    } as DBRow;
}

function manyRooms(count: number, overrides: Partial<DBRoom> = {}): {[docId: string]: DBRow}
{
    const docs: {[docId: string]: DBRow} = {};
    for (let i = 0; i < count; i++)
        docs[`room${String(i).padStart(4, "0")}`] = currentRoom({ roomName: `r${i}`, ...overrides });
    return docs;
}

const selectRooms = () => new DBQuery<DBRoom>().select().from(COLLECTION_ROOMS);
const selectUsers = () => new DBQuery<DBUser>().select().from(COLLECTION_USERS);

// Makes every document write take a noticeable amount of time, so that a test can distinguish a
// query that waited for its write from one that merely started it. Returns the undo.
async function delayDocumentWrites(delayMs: number): Promise<() => void>
{
    const db = await EmulatorDB.getDB();
    const docRefPrototype = Object.getPrototypeOf(db.collection(COLLECTION_ROOMS).doc("any"));
    const originalSet = docRefPrototype.set;
    docRefPrototype.set = function (...args: any[]) {
        return new Promise(resolve => setTimeout(resolve, delayMs)).then(() => originalSet.apply(this, args));
    };
    return () => { docRefPrototype.set = originalSet; };
}

// How many commits a write was split into. The emulator accepts oversized commits that real
// Firestore would reject, so the split has to be observed directly rather than inferred from
// whether the write succeeded.
async function countCommits(operation: () => Promise<void>): Promise<{batches: number, transactions: number}>
{
    const db = await EmulatorDB.getDB();
    const batchSpy = vi.spyOn(db, "batch");
    const transactionSpy = vi.spyOn(db, "runTransaction");
    try {
        await operation();
        return { batches: batchSpy.mock.calls.length, transactions: transactionSpy.mock.calls.length };
    }
    finally {
        batchSpy.mockRestore();
        transactionSpy.mockRestore();
    }
}

describe.skipIf(!emulatorAvailable)("DB query layer (Firestore emulator)", () =>
{
    // Every query narrates itself at the lowest log level, which would bury the suite's output.
    // Tests that care about what was logged capture it directly, ahead of the threshold.
    let originalLogLevel: number;

    beforeAll(() => {
        originalLogLevel = LogUtil.getThresholdLogLevel();
        LogUtil.setThresholdLogLevel("high");
    });

    afterAll(() => {
        LogUtil.setThresholdLogLevel(originalLogLevel);
    });

    beforeEach(async () => {
        await EmulatorDB.reset();
    });

    // ─── Insert ──────────────────────────────────────────────────────────────

    describe("insert", () =>
    {
        it("stores the given values under a generated document id", async () => {
            const result = await new DBQuery<DBRow>()
                .insertInto(COLLECTION_ROOMS)
                .values(currentRoom({ roomName: "generated" }))
                .run();

            expect(result.success).toBe(true);
            const docId = result.data[0].id as string;
            expect(docId).toBeTruthy();
            expect((await EmulatorDB.readStored(COLLECTION_ROOMS, docId))?.roomName).toBe("generated");
        });

        it("stores the given values under a caller-chosen document id", async () => {
            const result = await new DBQuery<DBRow>()
                .insertIntoWithId(COLLECTION_ROOMS, "chosen-id")
                .values(currentRoom({ roomName: "chosen" }))
                .run();

            expect(result.success).toBe(true);
            expect(result.data[0].id).toBe("chosen-id");
            expect((await EmulatorDB.readStored(COLLECTION_ROOMS, "chosen-id"))?.roomName).toBe("chosen");
        });

        it("writes over a document that already occupies the chosen id", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, { dup: currentRoom({ roomName: "first", texturePackPath: "old" }) });
            await new DBQuery<DBRow>()
                .insertIntoWithId(COLLECTION_ROOMS, "dup")
                .values(currentRoom({ roomName: "second" }))
                .run();

            const stored = await EmulatorDB.readStored(COLLECTION_ROOMS, "dup");
            expect(stored?.roomName).toBe("second");
            expect(stored?.texturePackPath).toBe("pack"); // Replaced wholesale, not merged
        });

        it("stamps rows written through the DB utils with the current schema version", async () => {
            const result = await DBUserUtil.createUser("newcomer", UserTypeEnumMap.Guest, "");
            const stored = await EmulatorDB.readStored(COLLECTION_USERS, result.data[0].id);
            expect(stored?.version).toBe(USER_VERSION);
        });

        it("does not store an id field, even when the caller supplies one", async () => {
            // A caller inserting a row it has been holding will usually still have an "id" on it,
            // and on this path that id cannot be right anyway — the document has none until the
            // write below creates it.
            const result = await new DBQuery<DBRow>()
                .insertInto(COLLECTION_ROOMS)
                .values(currentRoom({ id: "stale-id" } as Partial<DBRoom>))
                .run();

            const docId = result.data[0].id as string;
            expect(docId).not.toBe("stale-id");
            expect((await EmulatorDB.readStored(COLLECTION_ROOMS, docId))?.id).toBeUndefined();
        });

        it("does not store an id field under a caller-chosen document id either", async () => {
            await new DBQuery<DBRow>()
                .insertIntoWithId(COLLECTION_ROOMS, "chosen")
                .values(currentRoom({ id: "chosen" } as Partial<DBRoom>))
                .run();

            // Even an id that agrees with the key is a second copy of it, free to drift later.
            expect((await EmulatorDB.readStored(COLLECTION_ROOMS, "chosen"))?.id).toBeUndefined();
        });
    });

    // ─── Select ──────────────────────────────────────────────────────────────

    describe("select", () =>
    {
        it("reads a document by id and attaches the document's own id to the row", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, { alpha: currentRoom({ roomName: "alpha" }) });

            const result = await selectRooms().where("id", "==", "alpha").run();
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe("alpha");
            expect(result.data[0].roomName).toBe("alpha");
        });

        it("takes the row's id from the document, never from a stored 'id' field", async () => {
            // Rooms written before the write-back stopped storing it carry a stale "id" field.
            await EmulatorDB.seed(COLLECTION_ROOMS, { real: currentRoom({ id: "stale-id" } as Partial<DBRoom>) });

            const result = await selectRooms().where("id", "==", "real").run();
            expect(result.data[0].id).toBe("real");
        });

        it("succeeds with no rows when the document does not exist", async () => {
            const result = await selectRooms().where("id", "==", "nope").run();
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(0);
        });

        it("succeeds with no rows when the collection is empty", async () => {
            const result = await selectRooms().where("roomType", "==", RoomTypeEnumMap.Hub).run();
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(0);
        });

        it("filters on a single equality condition", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, {
                hub: currentRoom({ roomType: RoomTypeEnumMap.Hub }),
                regular: currentRoom({ roomType: RoomTypeEnumMap.Regular }),
            });

            const result = await selectRooms().where("roomType", "==", RoomTypeEnumMap.Hub).run();
            expect(result.data.map(row => row.id)).toEqual(["hub"]);
        });

        it("ANDs multiple conditions", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, {
                match: currentRoom({ roomType: RoomTypeEnumMap.SinglePlayer, roomName: TUTORIAL_SINGLE_PLAYER_MODE }),
                wrongName: currentRoom({ roomType: RoomTypeEnumMap.SinglePlayer, roomName: "other" }),
                wrongType: currentRoom({ roomType: RoomTypeEnumMap.Regular, roomName: TUTORIAL_SINGLE_PLAYER_MODE }),
            });

            const result = await selectRooms()
                .where("roomName", "==", TUTORIAL_SINGLE_PLAYER_MODE)
                .where("roomType", "==", RoomTypeEnumMap.SinglePlayer)
                .run();
            expect(result.data.map(row => row.id)).toEqual(["match"]);
        });

        it("ORs condition groups", async () => {
            await EmulatorDB.seed(COLLECTION_USERS, {
                byName: currentUser({ userName: "wanted", email: "a@x.com" }),
                byEmail: currentUser({ userName: "other", email: "wanted@x.com" }),
                neither: currentUser({ userName: "other", email: "b@x.com" }),
            });

            const result = await selectUsers()
                .where("userName", "==", "wanted")
                .or()
                .where("email", "==", "wanted@x.com")
                .run();
            expect(result.data.map(row => row.id).sort()).toEqual(["byEmail", "byName"]);
        });

        it("does not match documents that lack the field being filtered on", async () => {
            // The consequence of a row never reaching the schema version that introduced a field:
            // Firestore cannot match what isn't stored, so such a row is invisible to the query
            // regardless of what an in-memory migration would have filled in.
            const { roomName, ...roomWithoutName } = currentRoom({ roomName: "x" }) as any;
            await EmulatorDB.seed(COLLECTION_ROOMS, { legacy: roomWithoutName });

            const equals = await selectRooms().where("roomName", "==", "x").run();
            expect(equals.data).toHaveLength(0);

            const notEquals = await selectRooms().where("roomName", "!=", "y").run();
            expect(notEquals.data).toHaveLength(0);
        });

        it("orders rows ascending and descending", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, {
                b: currentRoom({ roomName: "b" }),
                a: currentRoom({ roomName: "a" }),
                c: currentRoom({ roomName: "c" }),
            });

            const asc = await selectRooms().orderBy("roomName", "asc").run();
            expect(asc.data.map(row => row.roomName)).toEqual(["a", "b", "c"]);

            const desc = await selectRooms().orderBy("roomName", "desc").run();
            expect(desc.data.map(row => row.roomName)).toEqual(["c", "b", "a"]);
        });

        it("pages through rows with limit and offset", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, manyRooms(5));

            const firstPage = await selectRooms().orderBy("roomName", "asc").limit(2).run();
            expect(firstPage.data.map(row => row.roomName)).toEqual(["r0", "r1"]);

            const secondPage = await selectRooms().orderBy("roomName", "asc").limit(2).offset(2).run();
            expect(secondPage.data.map(row => row.roomName)).toEqual(["r2", "r3"]);

            const pastTheEnd = await selectRooms().orderBy("roomName", "asc").limit(2).offset(99).run();
            expect(pastTheEnd.data).toHaveLength(0);
        });

        it("reports failure instead of throwing when the collection has no migration defined", async () => {
            const unknownCollection = `${COLLECTION_ROOMS}_unknown`;
            await EmulatorDB.seed(unknownCollection, { doc: { version: 0 } });
            const logs = EmulatorDB.captureLogs();
            try {
                const result = await new DBQuery<DBRow>().select().from(unknownCollection).where("id", "==", "doc").run();
                expect(result.success).toBe(false);
                expect(logs.withTitle("DB Query Error")).toHaveLength(1);
            }
            finally {
                logs.restore();
                const db = await EmulatorDB.getDB();
                await db.collection(unknownCollection).doc("doc").delete();
            }
        });

        it("reports failure instead of throwing when a row's version is not a number", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, { broken: currentRoom({ version: "one" } as any) });
            const logs = EmulatorDB.captureLogs();
            try {
                const result = await selectRooms().where("id", "==", "broken").run();
                expect(result.success).toBe(false);
                expect(logs.withTitle("DB Query Error")).toHaveLength(1);
            }
            finally { logs.restore(); }
        });
    });

    // ─── Update ──────────────────────────────────────────────────────────────

    describe("update", () =>
    {
        it("writes only the named fields and leaves the rest of the row alone", async () => {
            await EmulatorDB.seed(COLLECTION_USERS, { u1: currentUser({ userName: "before", email: "keep@x.com" }) });

            const result = await new DBQuery<DBRow>()
                .update(COLLECTION_USERS)
                .set({ userName: "after" })
                .where("id", "==", "u1")
                .run();

            expect(result.success).toBe(true);
            const stored = await EmulatorDB.readStored(COLLECTION_USERS, "u1");
            expect(stored?.userName).toBe("after");
            expect(stored?.email).toBe("keep@x.com");
        });

        it("reports failure when the document does not exist", async () => {
            const logs = EmulatorDB.captureLogs();
            try {
                const result = await new DBQuery<DBRow>()
                    .update(COLLECTION_USERS)
                    .set({ userName: "x" })
                    .where("id", "==", "ghost")
                    .run();
                expect(result.success).toBe(false);
            }
            finally { logs.restore(); }
        });

        it("applies a single-match query update to the one document it matched", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, {
                only: currentRoom({ roomType: RoomTypeEnumMap.Hub }),
                other: currentRoom({ roomType: RoomTypeEnumMap.Regular }),
            });

            await new DBQuery<DBRow>()
                .update(COLLECTION_ROOMS)
                .set({ texturePackPath: "applied" })
                .where("roomType", "==", RoomTypeEnumMap.Hub)
                .run();

            const stored = await EmulatorDB.readStoredAll(COLLECTION_ROOMS);
            expect(stored.only.texturePackPath).toBe("applied");
            expect(stored.other.texturePackPath).toBe("pack");
        });

        it("has already written a single-match query update by the time it reports success", async () => {
            // A query matching exactly one outdated document is the branch that rewrites the whole
            // row. The write is slowed down here so that a caller reading straight afterwards can
            // tell whether the query really waited for it, rather than racing it and usually winning.
            await EmulatorDB.seed(COLLECTION_ROOMS, {
                only: { version: 1, roomType: RoomTypeEnumMap.Hub, ownerUserID: "", ownerUserName: "",
                        texturePackPath: "pack" } as DBRow,
            });
            const restoreDelay = await delayDocumentWrites(300);
            try {
                await new DBQuery<DBRow>()
                    .update(COLLECTION_ROOMS)
                    .set({ texturePackPath: "applied" })
                    .where("roomType", "==", RoomTypeEnumMap.Hub)
                    .run();

                const stored = await EmulatorDB.readStored(COLLECTION_ROOMS, "only");
                expect(stored?.texturePackPath).toBe("applied");
                expect(stored?.version).toBe(ROOM_VERSION);
            }
            finally { restoreDelay(); }
        });

        it("applies a multi-match query update to every matching document", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, {
                a: currentRoom({ roomType: RoomTypeEnumMap.Hub }),
                b: currentRoom({ roomType: RoomTypeEnumMap.Hub }),
                other: currentRoom({ roomType: RoomTypeEnumMap.Regular }),
            });

            await new DBQuery<DBRow>()
                .update(COLLECTION_ROOMS)
                .set({ texturePackPath: "hubs" })
                .where("roomType", "==", RoomTypeEnumMap.Hub)
                .run();

            const stored = await EmulatorDB.readStoredAll(COLLECTION_ROOMS);
            expect(stored.a.texturePackPath).toBe("hubs");
            expect(stored.b.texturePackPath).toBe("hubs");
            expect(stored.other.texturePackPath).toBe("pack");
        });

        it("splits a query update spanning more documents than one commit allows", async () => {
            const count = DB_MAX_WRITES_PER_COMMIT + 5;
            await EmulatorDB.seed(COLLECTION_ROOMS, manyRooms(count, { roomType: RoomTypeEnumMap.Hub }));

            let result: DBQueryResponse<DBRow> | undefined;
            const commits = await countCommits(async () => {
                result = await new DBQuery<DBRow>()
                    .update(COLLECTION_ROOMS)
                    .set({ texturePackPath: "bulk" })
                    .where("roomType", "==", RoomTypeEnumMap.Hub)
                    .run();
            });

            expect(commits.batches).toBe(2);
            expect(result?.success).toBe(true);
            const stored = await EmulatorDB.readStoredAll(COLLECTION_ROOMS);
            expect(Object.keys(stored)).toHaveLength(count);
            expect(Object.values(stored).every(row => row.texturePackPath === "bulk")).toBe(true);
        }, 60_000);

        it("applies field transforms such as increment", async () => {
            await EmulatorDB.seed(COLLECTION_USERS, { u1: currentUser({ loginCount: 4 }) });

            await new DBQuery<DBRow>()
                .update(COLLECTION_USERS)
                .set({ loginCount: FieldValue.increment(1) as any })
                .where("id", "==", "u1")
                .run();

            expect((await EmulatorDB.readStored(COLLECTION_USERS, "u1"))?.loginCount).toBe(5);
        });

        it("migrates an outdated row and applies the update in the same write", async () => {
            await EmulatorDB.seed(COLLECTION_USERS, {
                u1: { version: 0, userName: "old", userType: UserTypeEnumMap.Guest, email: "",
                      lastRoomID: "", ownedRoomID: "", lastLoginAt: 1, createdAt: 1, loginCount: 1,
                      tutorialStep: 0, totalPlaytimeMs: 99 },
            });

            await new DBQuery<DBRow>()
                .update(COLLECTION_USERS)
                .set({ userName: "renamed" })
                .where("id", "==", "u1")
                .run();

            const stored = await EmulatorDB.readStored(COLLECTION_USERS, "u1");
            expect(stored?.version).toBe(USER_VERSION);
            expect(stored?.userName).toBe("renamed");
            expect(stored?.playerMetadata).toEqual({});
            expect(stored?.totalPlaytimeMs).toBeUndefined();
        });

        it("does not store the row's id when a migration rewrites the document", async () => {
            // The rewrite here replaces the document wholesale, exactly as the write-back does,
            // so it is the other place a stored "id" could appear from.
            await EmulatorDB.seed(COLLECTION_ROOMS, {
                r1: { version: 1, roomType: RoomTypeEnumMap.Hub, ownerUserID: "", ownerUserName: "",
                      texturePackPath: "pack" } as DBRow,
                r2: { version: 1, roomType: RoomTypeEnumMap.Hub, ownerUserID: "", ownerUserName: "",
                      texturePackPath: "pack" } as DBRow,
            });

            await new DBQuery<DBRow>()
                .update(COLLECTION_ROOMS)
                .set({ texturePackPath: "repainted" })
                .where("roomType", "==", RoomTypeEnumMap.Hub)
                .run();

            const stored = await EmulatorDB.readStoredAll(COLLECTION_ROOMS);
            expect(Object.values(stored).every(row => row.version === ROOM_VERSION)).toBe(true);
            expect(Object.values(stored).every(row => row.id === undefined)).toBe(true);
        });
    });

    // ─── Delete ──────────────────────────────────────────────────────────────

    describe("delete", () =>
    {
        it("deletes a document by id", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, { gone: currentRoom(), kept: currentRoom() });

            const result = await new DBQuery<DBRow>().delete().from(COLLECTION_ROOMS).where("id", "==", "gone").run();

            expect(result.success).toBe(true);
            expect(Object.keys(await EmulatorDB.readStoredAll(COLLECTION_ROOMS))).toEqual(["kept"]);
        });

        it("succeeds when the document does not exist", async () => {
            const result = await new DBQuery<DBRow>().delete().from(COLLECTION_ROOMS).where("id", "==", "ghost").run();
            expect(result.success).toBe(true);
        });

        it("deletes the single document a query matches", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, {
                hub: currentRoom({ roomType: RoomTypeEnumMap.Hub }),
                regular: currentRoom({ roomType: RoomTypeEnumMap.Regular }),
            });

            await new DBQuery<DBRow>().delete().from(COLLECTION_ROOMS)
                .where("roomType", "==", RoomTypeEnumMap.Hub).run();

            expect(Object.keys(await EmulatorDB.readStoredAll(COLLECTION_ROOMS))).toEqual(["regular"]);
        });

        it("deletes every document a query matches", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, {
                a: currentRoom({ roomType: RoomTypeEnumMap.Hub }),
                b: currentRoom({ roomType: RoomTypeEnumMap.Hub }),
                kept: currentRoom({ roomType: RoomTypeEnumMap.Regular }),
            });

            await new DBQuery<DBRow>().delete().from(COLLECTION_ROOMS)
                .where("roomType", "==", RoomTypeEnumMap.Hub).run();

            expect(Object.keys(await EmulatorDB.readStoredAll(COLLECTION_ROOMS))).toEqual(["kept"]);
        });

        it("splits a query deletion spanning more documents than one commit allows", async () => {
            const count = DB_MAX_WRITES_PER_COMMIT + 5;
            await EmulatorDB.seed(COLLECTION_ROOMS, manyRooms(count, { roomType: RoomTypeEnumMap.Hub }));

            let result: DBQueryResponse<DBRow> | undefined;
            const commits = await countCommits(async () => {
                result = await new DBQuery<DBRow>().delete().from(COLLECTION_ROOMS)
                    .where("roomType", "==", RoomTypeEnumMap.Hub).run();
            });

            expect(commits.batches).toBe(2);
            expect(result?.success).toBe(true);
            expect(Object.keys(await EmulatorDB.readStoredAll(COLLECTION_ROOMS))).toHaveLength(0);
        }, 60_000);
    });

    // ─── Batch ───────────────────────────────────────────────────────────────

    describe("batch", () =>
    {
        it("applies updates and deletions together", async () => {
            await EmulatorDB.seed(COLLECTION_USERS, {
                keep: currentUser({ userName: "before" }),
                drop: currentUser(),
            });

            const result = await DBQuery.runAll([
                new DBQuery<DBRow>().update(COLLECTION_USERS).set({ userName: "after" }).where("id", "==", "keep"),
                new DBQuery<DBRow>().delete().from(COLLECTION_USERS).where("id", "==", "drop"),
            ]);

            expect(result.success).toBe(true);
            const stored = await EmulatorDB.readStoredAll(COLLECTION_USERS);
            expect(Object.keys(stored)).toEqual(["keep"]);
            expect(stored.keep.userName).toBe("after");
        });

        it("succeeds without touching the DB when given no queries", async () => {
            await EmulatorDB.seed(COLLECTION_USERS, { u1: currentUser() });

            const result = await DBQuery.runAll([]);

            expect(result.success).toBe(true);
            expect(Object.keys(await EmulatorDB.readStoredAll(COLLECTION_USERS))).toEqual(["u1"]);
        });

        it("rejects the whole batch, writing nothing, when a query names no document", async () => {
            await EmulatorDB.seed(COLLECTION_USERS, { u1: currentUser({ userName: "untouched" }) });
            const logs = EmulatorDB.captureLogs();
            try {
                const result = await DBQuery.runAll([
                    new DBQuery<DBRow>().update(COLLECTION_USERS).set({ userName: "changed" }).where("id", "==", "u1"),
                    new DBQuery<DBRow>().update(COLLECTION_USERS).set({ userName: "changed" }).where("userName", "==", "untouched"),
                ]);

                expect(result.success).toBe(false);
                expect(logs.withTitle("DB Batch Query Error")).toHaveLength(1);
            }
            finally { logs.restore(); }

            expect((await EmulatorDB.readStored(COLLECTION_USERS, "u1"))?.userName).toBe("untouched");
        });

        it("rejects query types it cannot batch", async () => {
            const logs = EmulatorDB.captureLogs();
            try {
                const result = await DBQuery.runAll([
                    new DBQuery<DBRow>().select().from(COLLECTION_USERS).where("id", "==", "u1"),
                ]);
                expect(result.success).toBe(false);
            }
            finally { logs.restore(); }
        });

        it("splits a batch spanning more queries than one commit allows", async () => {
            const count = DB_MAX_WRITES_PER_COMMIT + 5;
            await EmulatorDB.seed(COLLECTION_ROOMS, manyRooms(count));

            let result: DBQueryResponse<DBRow> | undefined;
            const commits = await countCommits(async () => {
                result = await DBQuery.runAll(
                    Object.keys(manyRooms(count)).map(docId =>
                        new DBQuery<DBRow>().delete().from(COLLECTION_ROOMS).where("id", "==", docId)));
            });

            expect(commits.batches).toBe(2);
            expect(result?.success).toBe(true);
            expect(Object.keys(await EmulatorDB.readStoredAll(COLLECTION_ROOMS))).toHaveLength(0);
        }, 60_000);
    });

    // ─── Read-through cache ──────────────────────────────────────────────────

    describe("read-through cache", () =>
    {
        it("serves a repeated read by id without going back to the DB", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, { r1: currentRoom({ roomName: "first" }) });
            await selectRooms().where("id", "==", "r1").run();

            // Changed behind the cache's back, so a second DB read would be visible.
            await EmulatorDB.seed(COLLECTION_ROOMS, { r1: currentRoom({ roomName: "second" }) });

            const cached = await selectRooms().where("id", "==", "r1").run();
            expect(cached.data[0].roomName).toBe("first");
        });

        it("does not serve a cached row once an update has invalidated it", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, { r1: currentRoom({ roomName: "first" }) });
            await selectRooms().where("id", "==", "r1").run();

            await new DBQuery<DBRow>().update(COLLECTION_ROOMS).set({ roomName: "updated" })
                .where("id", "==", "r1").run();

            const reread = await selectRooms().where("id", "==", "r1").run();
            expect(reread.data[0].roomName).toBe("updated");
        });

        it("keeps the cached row when an update opts out of invalidation", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, { r1: currentRoom({ roomName: "first" }) });
            await selectRooms().where("id", "==", "r1").run();

            await new DBQuery<DBRow>().update(COLLECTION_ROOMS).noInvalidate().set({ roomName: "updated" })
                .where("id", "==", "r1").run();

            const reread = await selectRooms().where("id", "==", "r1").run();
            expect(reread.data[0].roomName).toBe("first");
            expect((await EmulatorDB.readStored(COLLECTION_ROOMS, "r1"))?.roomName).toBe("updated");
        });

        it("does not serve a cached row once a delete has invalidated it", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, { r1: currentRoom() });
            await selectRooms().where("id", "==", "r1").run();

            await new DBQuery<DBRow>().delete().from(COLLECTION_ROOMS).where("id", "==", "r1").run();

            const reread = await selectRooms().where("id", "==", "r1").run();
            expect(reread.data).toHaveLength(0);
        });

        it("caches every row a multi-document read returns", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, { a: currentRoom({ roomName: "a" }), b: currentRoom({ roomName: "b" }) });
            await selectRooms().where("roomType", "==", RoomTypeEnumMap.Regular).run();

            expect(DBCacheUtil.get(COLLECTION_ROOMS, "a")?.roomName).toBe("a");
            expect(DBCacheUtil.get(COLLECTION_ROOMS, "b")?.roomName).toBe("b");
        });
    });

    // ─── Query rate monitor ──────────────────────────────────────────────────

    describe("query rate monitor", () =>
    {
        afterEach(() => {
            DBQueryRateMonitorUtil.resetWindow();
        });

        it("rejects writes once the window is saturated, and keeps serving reads", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, { r1: currentRoom({ roomName: "untouched" }) });
            const logs = EmulatorDB.captureLogs();
            try {
                while (DBQueryRateMonitorUtil.allowQuery("select"))
                {
                    if (!DBQueryRateMonitorUtil.allowQuery("update"))
                        break;
                }

                const write = await new DBQuery<DBRow>().update(COLLECTION_ROOMS)
                    .set({ roomName: "changed" }).where("id", "==", "r1").run();
                expect(write.success).toBe(false);

                const read = await selectRooms().where("id", "==", "r1").run();
                expect(read.success).toBe(true);
                expect(read.data[0].roomName).toBe("untouched");
            }
            finally { logs.restore(); }

            expect((await EmulatorDB.readStored(COLLECTION_ROOMS, "r1"))?.roomName).toBe("untouched");
        });

        it("accepts writes again once the window is reset", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, { r1: currentRoom() });
            const logs = EmulatorDB.captureLogs();
            try {
                while (DBQueryRateMonitorUtil.allowQuery("update")) { /* saturate */ }
                DBQueryRateMonitorUtil.resetWindow();

                const write = await new DBQuery<DBRow>().update(COLLECTION_ROOMS)
                    .set({ roomName: "changed" }).where("id", "==", "r1").run();
                expect(write.success).toBe(true);
            }
            finally { logs.restore(); }
        });
    });

    // ─── Version migration ───────────────────────────────────────────────────

    describe("version migration", () =>
    {
        it("brings a row written by the oldest schema all the way up to the current one", async () => {
            await EmulatorDB.seed(COLLECTION_USERS, {
                u1: { version: 0, userName: "veteran", userType: UserTypeEnumMap.Member, email: "v@x.com",
                      lastRoomID: "", ownedRoomID: "", lastLoginAt: 1, createdAt: 1, loginCount: 5,
                      tutorialStep: 0, totalPlaytimeMs: 12_345 },
            });

            const result = await selectUsers().where("id", "==", "u1").run();

            const row = result.data[0];
            expect(row.version).toBe(USER_VERSION);
            expect(row.playerMetadata).toEqual({});        // v0 -> v1 added it
            expect(row.totalPlaytimeMs).toBeUndefined();   // v0 -> v1 dropped it
            expect(row.singlePlayerMode).toBe(TUTORIAL_SINGLE_PLAYER_MODE); // v1 -> v2 derived it
            expect(row.tutorialStep).toBeUndefined();      // v1 -> v2 dropped it
            expect(row.ftue).toBe("");                     // v2 -> v3 added it
        });

        it("runs migration steps that themselves read the DB", async () => {
            // The room v0 -> v1 step denormalizes the owner's name, which it has to look up.
            await EmulatorDB.seed(COLLECTION_USERS, { owner: currentUser({ userName: "landlord" }) });
            await EmulatorDB.seed(COLLECTION_ROOMS, {
                r1: { version: 0, roomType: RoomTypeEnumMap.Regular, ownerUserID: "owner", texturePackPath: "pack" },
            });

            const result = await selectRooms().where("id", "==", "r1").run();

            expect(result.data[0].version).toBe(ROOM_VERSION);
            expect(result.data[0].ownerUserName).toBe("landlord");
            expect(result.data[0].editors).toEqual([]);
            expect(result.data[0].roomName).toBe("");
        });

        it("drops the id field that rooms written before the rule still carry", async () => {
            // The v3 -> v4 step exists for exactly this: it changes nothing itself, and the
            // version bump is what makes the read rewrite the row without its stored identity.
            await EmulatorDB.seed(COLLECTION_ROOMS, {
                r1: { ...currentRoom(), version: 3, id: "r1" } as DBRow,
                r2: { ...currentRoom(), version: 3, id: "" } as DBRow,   // What createRoom used to store
            });

            const result = await selectRooms().where("roomType", "==", RoomTypeEnumMap.Regular).run();

            // The caller still gets the identity, taken from the document rather than the field.
            expect(result.data.map(row => row.id).sort()).toEqual(["r1", "r2"]);

            await EmulatorDB.waitFor(
                async () => Object.values(await EmulatorDB.readStoredAll(COLLECTION_ROOMS))
                    .every(row => row.version === ROOM_VERSION && row.id === undefined),
                "both rooms rewritten without a stored id");
        });

        it("drops the id field that migrated user accounts still carry", async () => {
            // A user was never created with an "id", but one that was *migrated* was stored with
            // the reader's copy of its key — so accounts old enough to have come up through a
            // schema change have one, and accounts created since do not.
            await EmulatorDB.seed(COLLECTION_USERS, { u1: { ...currentUser(), version: 3, id: "u1" } as DBRow });

            const result = await selectUsers().where("id", "==", "u1").run();
            expect(result.data[0].id).toBe("u1");

            await EmulatorDB.waitFor(async () => {
                const stored = await EmulatorDB.readStored(COLLECTION_USERS, "u1");
                return stored?.version === USER_VERSION && stored?.id === undefined;
            }, "the account rewritten without a stored id");
        });

        it("hands a migration step the document's own id, whichever query triggered it", async () => {
            // A migration step is one function running under every runner, so it has to be handed
            // the same row shape by all of them. That drifted once: only the select runner attached
            // the document's id, so a step that read row.id would have seen it under a read and not
            // under a write — and the write is the path that then stores what the step returned.
            const idSeenByTrigger: {[trigger: string]: unknown} = {};
            const originalStep = DBRoomVersionMigration[0];
            DBRoomVersionMigration[0] = async (row: any) => {
                idSeenByTrigger[row.texturePackPath] = row.id;
                return originalStep(row);
            };

            try {
                await EmulatorDB.seed(COLLECTION_ROOMS, {
                    viaSelect: { version: 0, roomType: RoomTypeEnumMap.Hub, ownerUserID: "",
                                 texturePackPath: "select" } as DBRow,
                    viaUpdate: { version: 0, roomType: RoomTypeEnumMap.Hub, ownerUserID: "",
                                 texturePackPath: "update" } as DBRow,
                });

                await selectRooms().where("id", "==", "viaSelect").run();
                await new DBQuery<DBRow>()
                    .update(COLLECTION_ROOMS)
                    .set({ roomName: "touched" })
                    .where("id", "==", "viaUpdate")
                    .run();
            }
            finally { DBRoomVersionMigration[0] = originalStep; }

            expect(idSeenByTrigger).toEqual({ select: "viaSelect", update: "viaUpdate" });
        });

        it("leaves the owner's name blank when the owner is gone", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, {
                r1: { version: 0, roomType: RoomTypeEnumMap.Regular, ownerUserID: "deleted-user", texturePackPath: "pack" },
            });

            const result = await selectRooms().where("id", "==", "r1").run();
            expect(result.data[0].ownerUserName).toBe("");
        });

        it("leaves a row that is already current entirely untouched", async () => {
            // A field no schema version knows about: it survives only if nothing rewrote the row.
            await EmulatorDB.seed(COLLECTION_ROOMS, { r1: { ...currentRoom(), sentinel: "intact" } as DBRow });

            await selectRooms().where("id", "==", "r1").run();
            await new Promise(resolve => setTimeout(resolve, 300));

            expect((await EmulatorDB.readStored(COLLECTION_ROOMS, "r1"))?.sentinel).toBe("intact");
        });
    });

    // ─── Migration write-back ────────────────────────────────────────────────

    describe("migration write-back", () =>
    {
        const outdatedRooms = (count: number): {[docId: string]: DBRow} => {
            const docs: {[docId: string]: DBRow} = {};
            for (let i = 0; i < count; i++)
            {
                // Version 1, so migrating needs no owner lookup — this is about the write-back.
                docs[`room${String(i).padStart(4, "0")}`] = {
                    version: 1, roomType: RoomTypeEnumMap.Hub, ownerUserID: "", ownerUserName: "",
                    texturePackPath: "pack",
                } as DBRow;
            }
            return docs;
        };

        const allRoomsAtCurrentVersion = async (): Promise<boolean> => {
            const stored = await EmulatorDB.readStoredAll(COLLECTION_ROOMS);
            const rows = Object.values(stored);
            return rows.length > 0 && rows.every(row => row.version === ROOM_VERSION);
        };

        it("persists every outdated document a multi-document read returned", async () => {
            // The regression: writes used to be interleaved with reads inside one transaction,
            // which Firestore rejects outright, so nothing was ever persisted past the first.
            await EmulatorDB.seed(COLLECTION_ROOMS, outdatedRooms(4));
            const logs = EmulatorDB.captureLogs();
            try {
                const result = await selectRooms().where("roomType", "==", RoomTypeEnumMap.Hub).run();
                expect(result.data.map(row => row.version)).toEqual([ROOM_VERSION, ROOM_VERSION, ROOM_VERSION, ROOM_VERSION]);

                await EmulatorDB.waitFor(allRoomsAtCurrentVersion, "all 4 rooms migrated in the DB");
                expect(logs.withTitle("Migration write-back failed")).toHaveLength(0);
            }
            finally { logs.restore(); }
        });

        it("persists the one outdated document a multi-document read returned", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, outdatedRooms(1));

            await selectRooms().where("roomType", "==", RoomTypeEnumMap.Hub).run();

            await EmulatorDB.waitFor(allRoomsAtCurrentVersion, "the single room migrated in the DB");
        });

        it("persists an outdated document read by id", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, outdatedRooms(1));

            await selectRooms().where("id", "==", "room0000").run();

            await EmulatorDB.waitFor(allRoomsAtCurrentVersion, "the room migrated in the DB");
        });

        it("leaves nothing to migrate for the next read of the same documents", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, outdatedRooms(4));
            await selectRooms().where("roomType", "==", RoomTypeEnumMap.Hub).run();
            await EmulatorDB.waitFor(allRoomsAtCurrentVersion, "the first read's write-back to land");

            // A sentinel on each row would be wiped by a second write-back, since the write-back
            // replaces the row wholesale.
            const stored = await EmulatorDB.readStoredAll(COLLECTION_ROOMS);
            for (const docId of Object.keys(stored))
                await EmulatorDB.seed(COLLECTION_ROOMS, { [docId]: { ...stored[docId], sentinel: "intact" } });

            DBCacheUtil.invalidateAll();
            const logs = EmulatorDB.captureLogs();
            try {
                await selectRooms().where("roomType", "==", RoomTypeEnumMap.Hub).run();
                await new Promise(resolve => setTimeout(resolve, 300));
                expect(logs.withTitle("Migration write-back failed")).toHaveLength(0);
            }
            finally { logs.restore(); }

            const after = await EmulatorDB.readStoredAll(COLLECTION_ROOMS);
            expect(Object.values(after).every(row => row.sentinel === "intact")).toBe(true);
        });

        it("does not store the row's id inside the document", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, outdatedRooms(2));

            await selectRooms().where("roomType", "==", RoomTypeEnumMap.Hub).run();
            await EmulatorDB.waitFor(allRoomsAtCurrentVersion, "both rooms migrated in the DB");

            const stored = await EmulatorDB.readStoredAll(COLLECTION_ROOMS);
            expect(Object.values(stored).every(row => row.id === undefined)).toBe(true);
        });

        it("persists outdated documents spanning more than one commit's worth", async () => {
            const count = DB_MAX_WRITES_PER_COMMIT + 5;
            await EmulatorDB.seed(COLLECTION_ROOMS, outdatedRooms(count));

            let result: DBQueryResponse<DBRoom> | undefined;
            const commits = await countCommits(async () => {
                result = await selectRooms().where("roomType", "==", RoomTypeEnumMap.Hub).run();
                // The write-back is fire-and-forget, so its commits are still being issued when the
                // read returns. Waiting for the documents keeps the count from being read too early.
                await EmulatorDB.waitFor(async () => {
                    const stored = await EmulatorDB.readStoredAll(COLLECTION_ROOMS);
                    return Object.values(stored).filter(row => row.version === ROOM_VERSION).length === count;
                }, `all ${count} rooms migrated in the DB`, 30_000);
            });

            expect(commits.transactions).toBe(2);
            expect(result?.data).toHaveLength(count);

            await EmulatorDB.waitFor(async () => {
                const stored = await EmulatorDB.readStoredAll(COLLECTION_ROOMS);
                return Object.values(stored).filter(row => row.version === ROOM_VERSION).length === count;
            }, `all ${count} rooms migrated in the DB`, 30_000);
        }, 90_000);

        it("leaves a document alone when someone else has already changed its version", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, { r1: { ...currentRoom(), sentinel: "written by someone else" } as DBRow });
            const db = await EmulatorDB.getDB();

            // A write-back computed from a stale read: the stored row has since moved on.
            await DBMigrationWriteBackUtil.writeBack(db, [{
                ref: db.collection(COLLECTION_ROOMS).doc("r1"),
                originalVersion: 1,
                newDocData: { ...currentRoom(), roomName: "stale rewrite" },
            }]);

            const stored = await EmulatorDB.readStored(COLLECTION_ROOMS, "r1");
            expect(stored?.sentinel).toBe("written by someone else");
            expect(stored?.roomName).toBe("");
        });

        it("skips a document that has been deleted since it was read", async () => {
            const db = await EmulatorDB.getDB();

            await DBMigrationWriteBackUtil.writeBack(db, [{
                ref: db.collection(COLLECTION_ROOMS).doc("deleted"),
                originalVersion: 1,
                newDocData: currentRoom(),
            }]);

            expect(await EmulatorDB.readStored(COLLECTION_ROOMS, "deleted")).toBeUndefined();
        });

        it("reports a failed write-back with a usable description of the failure", async () => {
            // Firestore rejects undefined values, which gives a failure to report on.
            await EmulatorDB.seed(COLLECTION_ROOMS, { r1: { version: 1, roomType: RoomTypeEnumMap.Hub } as DBRow });
            const db = await EmulatorDB.getDB();
            const logs = EmulatorDB.captureLogs();
            try {
                await DBMigrationWriteBackUtil.writeBack(db, [{
                    ref: db.collection(COLLECTION_ROOMS).doc("r1"),
                    originalVersion: 1,
                    newDocData: { version: ROOM_VERSION, roomName: undefined },
                }]);

                const failures = logs.withTitle("Migration write-back failed");
                expect(failures).toHaveLength(1);
                expect(failures[0].desc.errorMessage).toEqual(expect.stringContaining("undefined"));
                expect(failures[0].desc.numDocs).toBe(1);
            }
            finally { logs.restore(); }
        });

        it("never lets a failing write-back fail the read that triggered it", async () => {
            await EmulatorDB.seed(COLLECTION_ROOMS, outdatedRooms(3));
            const db = await EmulatorDB.getDB();
            const originalRunTransaction = db.runTransaction.bind(db);
            (db as any).runTransaction = async () => { throw new Error("write-back unavailable"); };
            const logs = EmulatorDB.captureLogs();
            try {
                const result = await selectRooms().where("roomType", "==", RoomTypeEnumMap.Hub).run();

                expect(result.success).toBe(true);
                expect(result.data).toHaveLength(3);
                expect(result.data.every(row => row.version === ROOM_VERSION)).toBe(true);
                await EmulatorDB.waitFor(
                    async () => logs.withTitle("Migration write-back failed").length === 1,
                    "the write-back failure to be logged");
            }
            finally {
                logs.restore();
                (db as any).runTransaction = originalRunTransaction;
            }
        });
    });
});
