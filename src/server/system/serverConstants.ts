import { DAY_IN_MS } from "../../shared/system/sharedConstants";

// Build Info

declare const __GIT_COMMIT__: string;
export const GIT_COMMIT: string = typeof __GIT_COMMIT__ !== "undefined" ? __GIT_COMMIT__ : "";

// Database

// DB collection namespace (staging server uses "staging_" prefix to isolate data from the live server)
const DB_PREFIX = process.env.DB_PREFIX || "";
export const COLLECTION_ROOMS = `${DB_PREFIX}rooms`;
export const COLLECTION_USERS = `${DB_PREFIX}users`;
// Dev-only: a marker doc tied to the emulator's lifetime, for invalidating stale cookies (see DevRuntimeUtil).
export const COLLECTION_DEV_RUNTIME = `${DB_PREFIX}_dev_runtime`;
// Per-(source, arrival day) acquisition counters (ServerAnalyticsManager). Separate from users, since
// bounced guests are deleted.
export const COLLECTION_ACQUISITION = `${DB_PREFIX}acquisition`;

// Cohort for visitors without a usable "ref" tag.
export const ACQUISITION_SOURCE_DIRECT = "direct";
// Max ref tag length (untrusted input used in document IDs).
export const ACQUISITION_SOURCE_MAX_LENGTH = 32;

// Firestore's per-commit write limit.
export const DB_MAX_WRITES_PER_COMMIT = 500;

// Minimum gap between "distinct logins"; requests within one visit don't inflate loginCount.
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

// Only the public site serves share metadata and the analytics tag (staging would duplicate the site in
// search and pollute analytics; dev is throwaway).
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