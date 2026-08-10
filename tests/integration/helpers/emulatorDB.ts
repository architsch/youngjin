/**
 * Helpers for the DB suite — the one suite that runs the real query runners against a real
 * Firestore, namely the local emulator. Everything else mocks the DB layer away (see mockDB.ts),
 * which is exactly why the runners themselves need a suite of their own: a mock cannot reproduce
 * what Firestore accepts, rejects, or does under concurrent writers.
 *
 * The emulator is optional. When it isn't running the suite skips itself rather than failing, so
 * that the pre-commit hook stays usable without one — `npm run test:integration:db` starts it.
 */
import * as net from "net";
import { vi } from "vitest";
import FirebaseUtil from "../../../src/server/networking/util/firebaseUtil";
import LogUtil from "../../../src/shared/system/util/logUtil";
import DBCacheUtil from "../../../src/server/db/util/dbCacheUtil";
import DBQueryRateMonitorUtil from "../../../src/server/db/util/dbQueryRateMonitorUtil";
import { COLLECTION_ROOMS, COLLECTION_USERS } from "../../../src/server/system/serverConstants";

export const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";

const EmulatorDB =
{
    // Whether an emulator is listening. Checked once, before the suite declares its tests, so that
    // the whole suite can be skipped as a unit instead of failing test by test.
    isAvailable: async (): Promise<boolean> =>
    {
        const [host, port] = EMULATOR_HOST.split(":");
        return await new Promise<boolean>(resolve => {
            const socket = net.createConnection({ host, port: parseInt(port) });
            const settle = (result: boolean) => { socket.destroy(); resolve(result); };
            socket.setTimeout(1500);
            socket.on("connect", () => settle(true));
            socket.on("timeout", () => settle(false));
            socket.on("error", () => settle(false));
        });
    },

    // Refuses to hand out a DB unless it is an emulated one. The suite writes to, and clears,
    // whole collections — it must never be able to do that to a real project.
    getDB: async () =>
    {
        if (!process.env.FIRESTORE_EMULATOR_HOST)
            throw new Error("EmulatorDB :: FIRESTORE_EMULATOR_HOST is unset — refusing to run DB tests against a real Firestore.");
        return await FirebaseUtil.getDB();
    },

    // Removes every document the suite works with, and clears the state the query layer carries
    // between queries, so each test starts from the same blank slate.
    reset: async (): Promise<void> =>
    {
        const db = await EmulatorDB.getDB();
        for (const collection of [COLLECTION_ROOMS, COLLECTION_USERS])
        {
            const snapshot = await db.collection(collection).get();
            for (let i = 0; i < snapshot.docs.length; i += 400)
            {
                const batch = db.batch();
                for (const doc of snapshot.docs.slice(i, i + 400))
                    batch.delete(doc.ref);
                await batch.commit();
            }
        }
        DBCacheUtil.invalidateAll();
        DBQueryRateMonitorUtil.resetWindow();
    },

    // Writes documents straight to Firestore, bypassing the query layer, so that a test can set up
    // exactly the stored state it wants to exercise — including states the query layer would never
    // produce, such as a row left at an outdated version.
    seed: async (collection: string, docsById: {[docId: string]: any}): Promise<void> =>
    {
        const db = await EmulatorDB.getDB();
        const ids = Object.keys(docsById);
        for (let i = 0; i < ids.length; i += 400)
        {
            const batch = db.batch();
            for (const id of ids.slice(i, i + 400))
                batch.set(db.collection(collection).doc(id), docsById[id]);
            await batch.commit();
        }
    },

    // Reads a document exactly as it is stored, with no migration, caching or id-injection in the
    // way — the only way to assert what a write actually left behind.
    readStored: async (collection: string, docId: string): Promise<any | undefined> =>
    {
        const db = await EmulatorDB.getDB();
        return (await db.collection(collection).doc(docId).get()).data();
    },

    readStoredAll: async (collection: string): Promise<{[docId: string]: any}> =>
    {
        const db = await EmulatorDB.getDB();
        const snapshot = await db.collection(collection).get();
        const result: {[docId: string]: any} = {};
        for (const doc of snapshot.docs)
            result[doc.id] = doc.data();
        return result;
    },

    // Migration write-backs are deliberately fire-and-forget, so a test that asserts on their
    // outcome has to wait for one rather than assume it has landed.
    waitFor: async (condition: () => Promise<boolean>, description: string, timeoutMs: number = 5000): Promise<void> =>
    {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline)
        {
            if (await condition())
                return;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error(`EmulatorDB.waitFor :: timed out waiting for: ${description}`);
    },

    // Captures what the DB layer logs, so that tests can assert a failure was reported *and* that
    // the report carries a usable description of it.
    captureLogs: () =>
    {
        const entries: {title: string, desc: any, level: string, type: string}[] = [];
        const spy = vi.spyOn(LogUtil, "log").mockImplementation(
            (title: string, desc: any = undefined, level: string = "high", type: any = "info") => {
                entries.push({ title, desc, level, type });
            });
        return {
            entries,
            withTitle: (title: string) => entries.filter(entry => entry.title.startsWith(title)),
            restore: () => spy.mockRestore(),
        };
    },
}

export default EmulatorDB;
