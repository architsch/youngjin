import { DBRow } from "../types/row/dbRow";

// Generic short-lived cache to avoid redundant DB lookups for any document type.
// Cache key: "tableId:docId"
const cache: {[key: string]: { data: DBRow, expiry: number }} = {};
const keysToRemove: string[] = [];
const CACHE_TTL_MS = 30_000; // 30 seconds

// Periodically sweep expired entries to prevent unbounded growth.
//
// Unref'd, so that this sweep is never itself a reason for the process to stay alive. A cache with
// nothing left to serve is not worth running for, and this module is reached from the server's entry
// point in every mode — including the one-shot static-site generation run, which would otherwise
// never end. While the server is actually serving, the listening socket keeps the loop alive and
// this timer fires exactly as before.
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
    // Drops every entry at once, for when the documents behind the whole cache have gone out from
    // under it rather than any one of them having been written.
    invalidateAll: (): void =>
    {
        for (const key of Object.keys(cache))
            delete cache[key];
    },
};

export default DBCacheUtil;
