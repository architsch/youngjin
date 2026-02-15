import DBUser from "../types/row/dbUser";

// Short-lived cache to avoid redundant DB lookups (e.g., HTTP auth → socket auth)
const userCache: {[userID: string]: { data: DBUser, expiry: number }} = {};
const userIDsToRemove: string[] = [];
const USER_CACHE_TTL_MS = 30_000; // 30 seconds

// Periodically sweep expired entries to prevent unbounded Map growth
setInterval(() => {
    const now = Date.now();
    userIDsToRemove.length = 0;
    for (const [userID, entry] of Object.entries(userCache))
    {
        if (now > entry.expiry)
            userIDsToRemove.push(userID);
    }
    for (const userID of userIDsToRemove)
        delete userCache[userID];
}, USER_CACHE_TTL_MS);

const DBUserCacheUtil =
{
    get: (userID: string): DBUser | null =>
    {
        const entry = userCache[userID];
        if (!entry) return null; // Cached user not found? Then return nothing.
        if (Date.now() > entry.expiry) // Cached user is too old (obsolete)? Then return nothing.
        {
            delete userCache[userID];
            return null;
        }
        return entry.data; // Cached user is fresh (still fairly new)? Then return it!
    },
    set: (userID: string, dbUser: DBUser): void =>
    {
        userCache[userID] = { data: dbUser, expiry: Date.now() + USER_CACHE_TTL_MS };
    },
    invalidate: (userID: string): void => // Call this method whenever the cached user becomes obsolete (due to a modification of the user data, etc).
    {
        if (userCache[userID])
            delete userCache[userID];
    },
}

export default DBUserCacheUtil;