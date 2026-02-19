import { DAY_IN_MS } from "../../shared/system/sharedConstants";

// Database

// DB collection namespace (staging server uses "staging_" prefix to isolate data from the live server)
const DB_PREFIX = process.env.DB_PREFIX || "";
export const COLLECTION_ROOMS = `${DB_PREFIX}rooms`;
export const COLLECTION_USERS = `${DB_PREFIX}users`;

export const GUEST_TIER_NAME_BY_TIER_PHASE = ["disposable", "casual", "dedicated"];
export const GUEST_MAX_AGE_BY_TIER_PHASE = [
    3 * DAY_IN_MS, // max age of a "disposable" guest (3 days)
    7 * DAY_IN_MS, // max age of a "casual" guest (7 days)
    30 * DAY_IN_MS, // max age of a "dedicated" guest (30 days)
];

// Networking

export const URL_STATIC = "https://thingspool.net";
export const URL_DYNAMIC = "https://app.thingspool.net";
export const AUTH_TOKEN_NAME_BASE = "thingspool_token";

// SSG (Static Site Generator)

export const STATIC_PAGE_ROOT_DIR = "public";
export const VIEWS_ROOT_DIR = "views";
export const SRC_ROOT_DIR = "src";
export const GLOBAL_LAST_MOD = "2023-09-10";