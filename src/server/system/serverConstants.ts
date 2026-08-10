import { DAY_IN_MS } from "../../shared/system/sharedConstants";

// Build Info

declare const __GIT_COMMIT__: string;
export const GIT_COMMIT: string = typeof __GIT_COMMIT__ !== "undefined" ? __GIT_COMMIT__ : "";

// Database

// DB collection namespace (staging server uses "staging_" prefix to isolate data from the live server)
const DB_PREFIX = process.env.DB_PREFIX || "";
export const COLLECTION_ROOMS = `${DB_PREFIX}rooms`;
export const COLLECTION_USERS = `${DB_PREFIX}users`;
// Dev-only: holds a single marker doc whose lifetime tracks the emulated DB, used to invalidate
// stale browser cookies left over from a previous DevRunner runtime (see DevRuntimeUtil).
export const COLLECTION_DEV_RUNTIME = `${DB_PREFIX}_dev_runtime`;

// Firestore commits at most this many writes in a single batch or transaction, so any write
// spanning an unbounded number of documents has to be split into commits of at most this size.
export const DB_MAX_WRITES_PER_COMMIT = 500;

// Hard cap on the number of editors a room owner can register. Anti-abuse: without
// a bound, an owner could inflate DB read/write cost by stuffing the editors list.
export const MAX_ROOM_EDITORS = 32;

// Minimum inactivity gap separating two "distinct logins". Identified requests arriving
// closer together than this belong to the same visit and must not inflate loginCount
// (a single visit fires many identified requests: page load, room APIs, etc.).
export const LOGIN_COUNT_MIN_GAP_MS = 1 * DAY_IN_MS;

export const GUEST_TIER_NAME_BY_TIER_PHASE = ["disposable", "casual", "dedicated"];
export const GUEST_MAX_AGE_BY_TIER_PHASE = [
    1 * DAY_IN_MS, // max age of a "disposable" guest (1 day)
    3 * DAY_IN_MS, // max age of a "casual" guest (3 days)
    20 * DAY_IN_MS, // max age of a "dedicated" guest (20 days)
];

// Networking

export const URL_STATIC = "https://thingspool.net";
export const URL_DYNAMIC = process.env.DB_PREFIX == "staging_" ? "https://staging.thingspool.net" : "https://app.thingspool.net";

// Whether this deployment is the one the outside world is meant to know about. Only it may
// present a page's share-preview metadata and carry the analytics tag, because both of those
// announce a page as *the* ThingsPool site. Staging serves the same pages from an address of its
// own, so leaving them in place there would offer search engines a second, competing copy of the
// site and fold staging's traffic — every automated test run included — into the live site's
// analytics. Dev serves throwaway builds and has no business in either.
export const IS_PUBLIC_SITE = process.env.MODE != "dev" && process.env.DB_PREFIX != "staging_";
export const AUTH_TOKEN_NAME_BASE = "thingspool_token";
export const TUTORIAL_FINISHED_COOKIE_NAME_BASE = "thingspool_tutorial_finished";
// Dev-only cookie carrying the DevRunner runtime's boot id (see DevRuntimeUtil).
export const DEV_BOOT_ID_COOKIE_NAME = "thingspool_dev_boot_id";

// SSG (Static Site Generator)

export const STATIC_PAGE_ROOT_DIR = "public";
export const VIEWS_ROOT_DIR = "views";
export const SRC_ROOT_DIR = "src";
export const GLOBAL_LAST_MOD = "2023-09-10";