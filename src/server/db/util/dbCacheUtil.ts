import { DBRow } from "../types/row/dbRow";

// Generic short-lived cache to avoid redundant DB lookups for any document type.
// Cache key: "tableId:docId"
const cache: {[key: string]: { data: DBRow, expiry: number }} = {};
const keysToRemove: string[] = [];
const CACHE_TTL_MS = 30_000; // 30 seconds

// Periodically sweep expired entries to prevent unbounded growth
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
}, CACHE_TTL_MS);

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
};

export default DBCacheUtil;
