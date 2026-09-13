import { DBRow } from "../types/row/dbRow";

// Short-lived document cache, keyed "tableId:docId".
const cache: {[key: string]: { data: DBRow, expiry: number }} = {};
const keysToRemove: string[] = [];
const CACHE_TTL_MS = 30_000; // 30 seconds

// Periodic sweep of expired entries. Unref'd so it never keeps the process alive (e.g. the one-shot
// SSG run).
setInterval(() => {
    const now = Date.now();
    keysToRemove.length = 0;
    for (const [key, entry] of Object.entries(cache))
    {
        if (now > entry.expiry)
            keysToRemove.push(key);
    }
    for (const key of keysToRemove)
        delete cache[key];
}, CACHE_TTL_MS).unref();

function getCacheKey(tableId: string, docId: string): string
{
    return `${tableId}:${docId}`;
}

const DBCacheUtil =
{
    get: (tableId: string, docId: string): DBRow | null =>
    {
        const key = getCacheKey(tableId, docId);
        const entry = cache[key];
        if (!entry) return null;
        if (Date.now() > entry.expiry)
        {
            delete cache[key];
            return null;
        }
        return entry.data;
    },
    set: (tableId: string, docId: string, data: DBRow): void =>
    {
        cache[getCacheKey(tableId, docId)] = { data, expiry: Date.now() + CACHE_TTL_MS };
    },
    invalidate: (tableId: string, docId: string): void =>
    {
        delete cache[getCacheKey(tableId, docId)];
    },
    // For when the underlying documents all changed at once.
    invalidateAll: (): void =>
    {
        for (const key of Object.keys(cache))
            delete cache[key];
    },
};

export default DBCacheUtil;
