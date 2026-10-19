import crypto from "crypto";

// An agent's key is "<user id>.<secret>": the id finds the row, which holds only the secret's hash.

const SECRET_BYTES = 32;
// What a document id may hold, so a key can't steer the row lookup elsewhere (a "/" names a sub-path).
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const AgentKeyUtil =
{
    createSecret: (): string =>
    {
        return crypto.randomBytes(SECRET_BYTES).toString("base64url");
    },
    // A plain hash is enough: the secret is random and long, so nothing could be guessed from it.
    hashSecret: (secret: string): string =>
    {
        return crypto.createHash("sha256").update(secret).digest("hex");
    },
    toKey: (userID: string, secret: string): string =>
    {
        return `${userID}.${secret}`;
    },
    // Undefined for anything that isn't shaped like a key.
    parse: (key: string): {userID: string, secret: string} | undefined =>
    {
        const dot = key.indexOf(".");
        if (dot <= 0 || dot == key.length - 1)
            return undefined;
        const userID = key.slice(0, dot);
        return USER_ID_PATTERN.test(userID) ? {userID, secret: key.slice(dot + 1)} : undefined;
    },
    matches: (secret: string, storedHash: string): boolean =>
    {
        const actual = Buffer.from(AgentKeyUtil.hashSecret(secret), "hex");
        const expected = Buffer.from(storedHash, "hex");
        return expected.length == actual.length && crypto.timingSafeEqual(actual, expected);
    },
}

export default AgentKeyUtil;
