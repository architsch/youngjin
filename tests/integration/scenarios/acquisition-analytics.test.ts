/**
 * Scenario tests: acquisition analytics (funnel and retention by traffic source)
 *
 * The server records where each visitor came from and how far they got, so that two traffic
 * sources can be compared by what their people went on to do. See docs/devOps/analytics.md.
 *
 * Covers:
 * - The ref tag as untrusted input: what survives sanitising, what is capped, and what falls back
 *   to the direct cohort.
 * - Cohorts keyed by the day the visitor arrived, in UTC.
 * - Milestones counted once per account: the first call records, later calls do nothing.
 * - Counts credited to the arrival cohort rather than to the day the milestone happened, which is
 *   what makes a retention figure belong to the source that earned it.
 * - Return visits recorded as a first return, then as a repeat.
 * - The user migration defaulting the new fields rather than assigning them, so a funnel written
 *   outside the migration path is not erased by it.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── A stand-in Firestore ────────────────────────────────────────────────
// Documents are plain objects. Only the four operations the analytics module uses are
// implemented, and every write is recorded so the tests can assert on what was written where.

const _docs = vi.hoisted(() => new Map<string, any>());
const _writes = vi.hoisted(() => [] as Array<{ path: string; op: string; data: any }>);
const _reads = vi.hoisted(() => [] as string[]);

// Lets one test make a single row write fail, to check what the module does with a claim it has
// made but not managed to carry through.
const _failNextUpdate = vi.hoisted(() => ({ value: false }));

// A merging write descends into map fields rather than replacing them, which is the behaviour the
// counters depend on: each milestone writes only its own key under "counts", and the keys already
// there have to survive. A shallow spread would drop every earlier milestone on each new one.
const mergeLikeFirestore = vi.hoisted(() => (existing: any, incoming: any): any => {
    const isPlainMap = (v: any) => v !== null && typeof v === "object" && !Array.isArray(v)
        && (v.constructor === Object || v.constructor === undefined);

    const merged = { ...existing };
    for (const [key, value] of Object.entries(incoming))
    {
        merged[key] = isPlainMap(value) && isPlainMap(existing?.[key])
            ? { ...existing[key], ...(value as object) }
            : value;
    }
    return merged;
});

const _fakeDB = vi.hoisted(() => ({
    collection(collectionName: string)
    {
        return {
            doc(docID: string)
            {
                const path = `${collectionName}/${docID}`;
                return {
                    async get()
                    {
                        _reads.push(path);
                        const data = _docs.get(path);
                        return { exists: data !== undefined, data: () => data };
                    },
                    async update(data: any)
                    {
                        if (_failNextUpdate.value)
                        {
                            _failNextUpdate.value = false;
                            throw new Error("simulated write failure");
                        }
                        _writes.push({ path, op: "update", data });
                        _docs.set(path, { ...(_docs.get(path) ?? {}), ...data });
                    },
                    async set(data: any, options?: any)
                    {
                        _writes.push({ path, op: options?.merge ? "merge" : "set", data });
                        _docs.set(path, options?.merge ? mergeLikeFirestore(_docs.get(path) ?? {}, data) : data);
                    },
                };
            },
        };
    },
}));

vi.mock("../../../src/server/networking/util/firebaseUtil", () => ({
    default: { getDB: async () => _fakeDB },
}));

vi.mock("../../../src/shared/system/util/logUtil", () => ({
    default: { log: vi.fn(), logRaw: vi.fn() },
}));

vi.mock("../../../src/server/db/util/dbCacheUtil", () => ({
    default: { invalidate: vi.fn(), get: vi.fn(), set: vi.fn() },
}));

import ServerAnalyticsManager from "../../../src/server/analytics/serverAnalyticsManager";
import AcquisitionSourceUtil from "../../../src/server/analytics/util/acquisitionSourceUtil";
import { FunnelMilestoneEnumMap } from "../../../src/server/analytics/types/funnelMilestone";
import DBCacheUtil from "../../../src/server/db/util/dbCacheUtil";
import DBUserVersionMigration from "../../../src/server/db/types/versionMigration/dbUserVersionMigration";
import {
    ACQUISITION_SOURCE_DIRECT, ACQUISITION_SOURCE_MAX_LENGTH,
    COLLECTION_ACQUISITION, COLLECTION_USERS,
} from "../../../src/server/system/serverConstants";

let nextUserID = 0;
function seedUser(fields: Record<string, unknown>): string
{
    const userID = `u${++nextUserID}`;
    _docs.set(`${COLLECTION_USERS}/${userID}`, fields);
    return userID;
}

// Stands in for the live connection. Only the funnel string is touched by the analytics module, so
// the real SocketUserContext — which needs a socket to construct — is not what these tests want.
function fakeSession(funnel: string): any
{
    return { funnel };
}

function cohortDoc(source: string, day: string): any
{
    return _docs.get(`${COLLECTION_ACQUISITION}/${source}__${day}`);
}

beforeEach(() => {
    _docs.clear();
    _writes.length = 0;
    _reads.length = 0;
    _failNextUpdate.value = false;
    vi.clearAllMocks();
});

describe("acquisition source — the ref tag is untrusted input", () => {
    it("keeps a plain tag as it is written", () => {
        expect(AcquisitionSourceUtil.normalize("reddit-webgames")).toBe("reddit-webgames");
        expect(AcquisitionSourceUtil.normalize("hn_show")).toBe("hn_show");
    });

    it("lowercases, so one source is not split across two cohorts by capitalisation", () => {
        expect(AcquisitionSourceUtil.normalize("Reddit-WebGames")).toBe("reddit-webgames");
    });

    it("drops anything outside the permitted alphabet rather than escaping it", () => {
        // The value becomes part of a document ID, so path syntax must not survive at all.
        expect(AcquisitionSourceUtil.normalize("../../etc/passwd")).toBe("etcpasswd");
        expect(AcquisitionSourceUtil.normalize("a/b")).toBe("ab");
        expect(AcquisitionSourceUtil.normalize("tag with spaces")).toBe("tagwithspaces");
    });

    it("caps the length", () => {
        const long = "x".repeat(ACQUISITION_SOURCE_MAX_LENGTH + 50);
        expect(AcquisitionSourceUtil.normalize(long)).toHaveLength(ACQUISITION_SOURCE_MAX_LENGTH);
    });

    it("falls back to the direct cohort for anything with nothing usable left", () => {
        expect(AcquisitionSourceUtil.normalize("!!!")).toBe(ACQUISITION_SOURCE_DIRECT);
        expect(AcquisitionSourceUtil.normalize("")).toBe(ACQUISITION_SOURCE_DIRECT);
        expect(AcquisitionSourceUtil.normalize(undefined)).toBe(ACQUISITION_SOURCE_DIRECT);
    });

    it("does not coerce a repeated or bracketed query parameter into a string", () => {
        // Express hands these back as an array and an object respectively.
        expect(AcquisitionSourceUtil.fromQuery({ ref: ["a", "b"] })).toBe(ACQUISITION_SOURCE_DIRECT);
        expect(AcquisitionSourceUtil.fromQuery({ ref: { evil: "1" } })).toBe(ACQUISITION_SOURCE_DIRECT);
        expect(AcquisitionSourceUtil.fromQuery({})).toBe(ACQUISITION_SOURCE_DIRECT);
        expect(AcquisitionSourceUtil.fromQuery(undefined)).toBe(ACQUISITION_SOURCE_DIRECT);
    });

    it("puts a visitor in the UTC day they arrived", () => {
        expect(AcquisitionSourceUtil.cohortDay(Date.UTC(2026, 7, 22, 13, 0, 0))).toBe("2026-08-22");
        // Late-evening UTC still belongs to that day, not the next one.
        expect(AcquisitionSourceUtil.cohortDay(Date.UTC(2026, 7, 22, 23, 59, 59))).toBe("2026-08-22");
    });
});

describe("milestones are counted once per account", () => {
    it("records the first time, and appends to the funnel already on the row", async () => {
        const userID = seedUser({ funnel: "a", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });

        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built);

        expect(_docs.get(`${COLLECTION_USERS}/${userID}`).funnel).toBe("ab");
        expect(cohortDoc("reddit", "2026-08-20").counts).toHaveProperty(FunnelMilestoneEnumMap.Built);
    });

    it("does not repeat the write when the milestone is already on the row", async () => {
        const userID = seedUser({ funnel: "a", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });

        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built);
        const writesAfterFirst = _writes.length;

        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built);

        expect(_writes.length).toBe(writesAfterFirst);
        expect(_docs.get(`${COLLECTION_USERS}/${userID}`).funnel).toBe("ab");
    });

    it("credits the cohort the visitor arrived in, not the day the milestone happened", async () => {
        // Somebody who arrived weeks ago and only now built something. The count belongs to the
        // push that brought them, otherwise no source can ever be judged on what it retained.
        const userID = seedUser({ funnel: "a", acquisitionSource: "hn", createdAt: Date.UTC(2026, 6, 1) });

        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built);

        expect(cohortDoc("hn", "2026-07-01")).toBeDefined();
        expect(cohortDoc("hn", AcquisitionSourceUtil.cohortDay(Date.now()))).toBeUndefined();
    });

    it("invalidates the cached user row, since that row is served from the cache", async () => {
        const userID = seedUser({ funnel: "a", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });

        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built);

        expect(DBCacheUtil.invalidate).toHaveBeenCalledWith(COLLECTION_USERS, userID);
    });

    it("treats a row with no source as direct rather than losing the count", async () => {
        const userID = seedUser({ funnel: "a", createdAt: Date.UTC(2026, 7, 20) });

        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built);

        expect(cohortDoc(ACQUISITION_SOURCE_DIRECT, "2026-08-20")).toBeDefined();
    });

    it("does nothing for an account that is gone, and does not throw", async () => {
        await expect(ServerAnalyticsManager.recordMilestone("missing", FunnelMilestoneEnumMap.Built))
            .resolves.toBeUndefined();
        expect(_writes).toHaveLength(0);
    });

    it("does nothing without a user id", async () => {
        await ServerAnalyticsManager.recordMilestone("", FunnelMilestoneEnumMap.Built);
        expect(_writes).toHaveLength(0);
    });
});

describe("return visits", () => {
    it("records a first return, then a repeat", async () => {
        const userID = seedUser({ funnel: "a", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });

        await ServerAnalyticsManager.recordReturnVisit(userID);
        expect(_docs.get(`${COLLECTION_USERS}/${userID}`).funnel).toContain(FunnelMilestoneEnumMap.Returned);

        await ServerAnalyticsManager.recordReturnVisit(userID);
        expect(_docs.get(`${COLLECTION_USERS}/${userID}`).funnel).toContain(FunnelMilestoneEnumMap.RetainedRepeat);

        const counts = cohortDoc("reddit", "2026-08-20").counts;
        expect(counts).toHaveProperty(FunnelMilestoneEnumMap.Returned);
        expect(counts).toHaveProperty(FunnelMilestoneEnumMap.RetainedRepeat);
    });

    it("stays at repeat on every visit after the second, rather than counting a new step", async () => {
        const userID = seedUser({ funnel: "and", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });

        await ServerAnalyticsManager.recordReturnVisit(userID);

        expect(_writes).toHaveLength(0);
    });

    it("writes nothing further however many more days they come back on", async () => {
        const userID = seedUser({ funnel: "a", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });

        await ServerAnalyticsManager.recordReturnVisit(userID);
        await ServerAnalyticsManager.recordReturnVisit(userID);
        const writesAfterRepeat = _writes.length;

        await ServerAnalyticsManager.recordReturnVisit(userID);
        await ServerAnalyticsManager.recordReturnVisit(userID);

        // These still cost a read each, and are meant to: a return visit is recognised at most once
        // a day per account, on a request path that has no connection to answer from.
        expect(_writes.length).toBe(writesAfterRepeat);
    });
});

describe("a live session answers the repeat calls", () => {
    // This is what lets recordMilestone sit on the edit path, where it fires once per block placed.
    // The session carries the milestones already recorded, taken from the row when the socket
    // authenticated, so only the first edit of a session reaches the database.
    it("costs no read at all once the session already carries the milestone", async () => {
        const userID = seedUser({ funnel: "a", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });
        const session = fakeSession("a");

        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built, session);
        const readsAfterFirst = _reads.length;
        const writesAfterFirst = _writes.length;

        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built, session);
        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built, session);

        expect(_reads.length).toBe(readsAfterFirst);
        expect(_writes.length).toBe(writesAfterFirst);
    });

    it("brings the session into step with the row it wrote", async () => {
        const userID = seedUser({ funnel: "a", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });
        const session = fakeSession("a");

        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built, session);

        expect(session.funnel).toBe("ab");
    });

    it("collapses a burst of simultaneous calls into a single count", async () => {
        // A player placing blocks quickly produces exactly this. Were the milestone claimed only
        // after the write, every call in the burst would read the row before any of them had
        // written it, and the cohort would be credited once per block.
        const userID = seedUser({ funnel: "a", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });
        const session = fakeSession("a");

        await Promise.all(Array.from({ length: 8 },
            () => ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built, session)));

        expect(_writes.filter(w => w.path.startsWith(COLLECTION_ACQUISITION))).toHaveLength(1);
        expect(_docs.get(`${COLLECTION_USERS}/${userID}`).funnel).toBe("ab");
    });

    it("gives back its claim when the write fails, so a later call tries again", async () => {
        const userID = seedUser({ funnel: "a", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });
        const session = fakeSession("a");

        _failNextUpdate.value = true;
        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built, session);
        expect(_docs.get(`${COLLECTION_USERS}/${userID}`).funnel).toBe("a");
        expect(session.funnel).toBe("a");

        // A failed attempt left claimed would lose the milestone for the whole connection.
        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built, session);
        expect(_docs.get(`${COLLECTION_USERS}/${userID}`).funnel).toBe("ab");
    });

    it("trusts the session to say 'already done' but never to say 'not yet'", async () => {
        // The session's copy is taken when the connection opens, and the HTTP paths record
        // milestones on the same row while it is open. So the row decides, and a session that has
        // fallen behind costs one wasted read rather than a second count.
        const userID = seedUser({ funnel: "ab", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });
        const staleSession = fakeSession("a");

        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built, staleSession);

        expect(_docs.get(`${COLLECTION_USERS}/${userID}`).funnel).toBe("ab");
        expect(_writes.filter(w => w.path.startsWith(COLLECTION_ACQUISITION))).toHaveLength(0);
    });
});

describe("chatting and building are separate milestones", () => {
    // Chat reaches the server as a change to the speaker's own player object's metadata, so it
    // arrives on the same signal as an edit and differs only by its key. If the two were ever
    // conflated again, every visitor who said hello would land in the "built something" figure,
    // which is the column the funnel is actually read for.
    it("gives chat and building different codes", () => {
        expect(FunnelMilestoneEnumMap.Chatted).not.toBe(FunnelMilestoneEnumMap.Built);
    });

    it("records one without recording the other", async () => {
        const userID = seedUser({ funnel: "a", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });

        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Chatted);

        const counts = cohortDoc("reddit", "2026-08-20").counts;
        expect(counts).toHaveProperty(FunnelMilestoneEnumMap.Chatted);
        expect(counts).not.toHaveProperty(FunnelMilestoneEnumMap.Built);
    });

    it("keeps both on the funnel when a player does both", async () => {
        const userID = seedUser({ funnel: "a", acquisitionSource: "reddit", createdAt: Date.UTC(2026, 7, 20) });

        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Built);
        await ServerAnalyticsManager.recordMilestone(userID, FunnelMilestoneEnumMap.Chatted);

        const funnel = _docs.get(`${COLLECTION_USERS}/${userID}`).funnel;
        expect(funnel).toContain(FunnelMilestoneEnumMap.Built);
        expect(funnel).toContain(FunnelMilestoneEnumMap.Chatted);
    });
});

describe("the user migration that adds these fields", () => {
    it("defaults them on a row that has never been counted", async () => {
        const migrated = await DBUserVersionMigration[4]({ userName: "old" });
        expect(migrated.acquisitionSource).toBe("");
        expect(migrated.funnel).toBe("");
    });

    it("preserves a funnel already written outside the migration path", async () => {
        // Analytics writes "funnel" straight to the document, so a row can carry one before it is
        // ever migrated. An unconditional assignment here would erase the measurement.
        const migrated = await DBUserVersionMigration[4]({ funnel: "abr", acquisitionSource: "reddit" });
        expect(migrated.funnel).toBe("abr");
        expect(migrated.acquisitionSource).toBe("reddit");
    });
});
