/**
 * Helpers for the DB suite, which runs the real query runners against the Firestore emulator (mocks
 * can't reproduce Firestore behavior). Skips itself without an emulator (`npm run test:integration:db`
 * starts one).
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
    // Checked once before tests are declared, so the whole suite skips as a unit.
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

    // Refuses non-emulator DBs (the suite clears whole collections).
    getDB: async () =>
    {
        if (!process.env.FIRESTORE_EMULATOR_HOST)
            throw new Error("EmulatorDB :: FIRESTORE_EMULATOR_HOST is unset — refusing to run DB tests against a real Firestore.");
        return await FirebaseUtil.getDB();
    },

    // Clears suite collections and query-layer state.
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

    // Writes directly (bypassing the query layer), e.g. rows at outdated versions.
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

    // Reads the raw stored document (no migration, cache or id injection).
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

    // Waits for fire-and-forget writes (e.g. migration write-backs).
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

    // Captures DB-layer logs.
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
