import { DAY_IN_MS, MINUTE_IN_MS } from "../../shared/system/sharedConstants";
import { UserBudgetKind } from "../user/types/userBudgetKind";

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
// What the Helper spent on Claude, a document per day (DBHelperSpendingUtil).
export const COLLECTION_HELPER_SPENDING = `${DB_PREFIX}helper_spending`;

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

// A signal batch at least this long is sent deflated (see SocketUserContext); a shorter one gains too
// little by it.
export const SIGNAL_BATCH_DEFLATE_MIN_BYTES = 1024;

// AI Agents (see @docs/networking/agents.md)

export const AGENT_MCP_ROUTE_PATH = "mcp";
// An agent's player leaves its room after this long without a request from it.
export const AGENT_PRESENCE_IDLE_TIMEOUT_MS = 10 * MINUTE_IN_MS;
export const AGENT_NAME_MIN_LENGTH = 3;
export const AGENT_NAME_MAX_LENGTH = 24;
// Agents' acquisition sources start with it, so they never mix with the human funnel.
export const AGENT_ACQUISITION_SOURCE_PREFIX = "agent";
// The "ref" tag on the room links agents are given to pass on, so that the people who open one are counted apart.
export const AGENT_LINK_ACQUISITION_SOURCE = "via-agent";
// Events kept for an agent until it asks for them; the oldest go first.
export const AGENT_INBOX_MAX_EVENTS = 100;
// How many of the nearest people a look reports.
export const AGENT_LOOK_MAX_PEOPLE = 16;
// An agent's interests: at most this many keywords, each at most this long.
export const AGENT_MAX_INTERESTS = 8;
export const AGENT_INTEREST_MAX_LENGTH = 24;
// The most room owners the room directory reads, and how long one reading serves (see AgentDirectoryUtil).
export const AGENT_DIRECTORY_MAX_SCAN = 500;
export const AGENT_DIRECTORY_TTL_MS = MINUTE_IN_MS;
// The most rooms one find_rooms gives.
export const AGENT_FIND_ROOMS_MAX_COUNT = 10;
// How many of the nearest placed objects a look reports.
export const AGENT_LOOK_MAX_OBJECTS = 24;
// How far either way of the agent, in rows and columns, look_blocks shows when given no region.
export const AGENT_LOOK_BLOCKS_REACH = 12;
// The most boxes one look_blocks tells of.
export const AGENT_LOOK_BLOCKS_MAX_BOXES = 120;
// The most pictures one find_pictures gives.
export const AGENT_FIND_PICTURES_MAX_COUNT = 20;
// The most agents present at once, whose bodies the server steps (see AgentBodyUtil).
export const AGENT_MAX_PRESENT = 100;
// The agent the server runs itself to greet newcomers (see HelperAgentUtil). No one else may register its name.
export const HELPER_AGENT_NAME = "Helper";
// The Claude model the Helper chats with, and its prices in dollars per million tokens (check them against
// https://www.anthropic.com/pricing whenever the model changes).
export const HELPER_MODEL = "claude-haiku-5-5";
export const HELPER_MODEL_PRICES = {input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1};
// What the Helper may spend on Claude in a day (UTC), in dollars (see HelperChatUtil). The live server's share spreads
// the free monthly API credit ($100) over the longest month, leaving a little for staging's Helper, which uses the same
// key.
export const HELPER_DAILY_BUDGET_DOLLARS = IS_PUBLIC_SITE ? 3 : 0.2;
// The most replies the Helper gives one person in an hour, or one agent, who could keep it talking far longer.
export const HELPER_MAX_REPLIES_PER_PERSON_PER_HOUR = 30;
export const HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR = 10;

// What each user may do at once, and how fast that comes back, per second (see UserBudgetUtil). Set well above what a
// person does, so that only scripts meet them.
export const USER_BUDGETS: {[kind in UserBudgetKind]: {capacity: number, refillPerSecond: number}} = {
    // Blocks and objects added, removed, moved or changed.
    edit: {capacity: 100, refillPerSecond: 2},
    // Speech bubbles set.
    speech: {capacity: 10, refillPerSecond: 0.5},
    // Moves of one's player reported, which a browser reports five times a second.
    moves: {capacity: 25, refillPerSecond: 10},
    // How far one's player moves, in world units: the strongest fan throws one about 16 in a second, at a walk.
    distance: {capacity: 40, refillPerSecond: 20},
    // An agent's calls of tools that change nothing, and of the others.
    agentReads: {capacity: 30, refillPerSecond: 1},
    agentActions: {capacity: 15, refillPerSecond: 0.5},
};

// SSG (Static Site Generator)

export const STATIC_PAGE_ROOT_DIR = "public";
export const VIEWS_ROOT_DIR = "views";
export const SRC_ROOT_DIR = "src";
export const GLOBAL_LAST_MOD = "2023-09-10";