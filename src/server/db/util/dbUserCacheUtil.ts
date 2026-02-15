import DBUser from "../types/row/dbUser";

// Short-lived cache to avoid redundant DB lookups (e.g., HTTP auth → socket auth)
const userCache = new Map<string, { data: DBUser, expiry: number }>();
const USER_CACHE_TTL_MS = 30_000; // 30 seconds

// Periodically sweep expired entries to prevent unbounded Map growth
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of userCache)
    {
        if (now > entry.expiry)
            userCache.delete(key);
    }
}, USER_CACHE_TTL_MS);

const DBUserCacheUtil =
{
    get: (userID: string): DBUser | null =>
    {
        const entry = userCache.get(userID);
        if (!entry) return null; // Cached user not found? Then return nothing.
        if (Date.now() > entry.expiry) // Cached user is too old (obsolete)? Then return nothing.
        {
            userCache.delete(userID);
            return null;
        }
        return entry.data; // Cached user is fresh (still fairly new)? Then return it!
    },
    set: (userID: string, dbUser: DBUser): void =>
    {
        userCache.set(userID, { data: dbUser, expiry: Date.now() + USER_CACHE_TTL_MS });
    },
    invalidate: (userID: string): void => // Call this method whenever the cached user becomes obsolete (due to a modification of the user data, etc).
    {
        userCache.delete(userID);
    },
}

export default DBUserCacheUtil;