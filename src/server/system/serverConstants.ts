import { DAY_IN_MS, MINUTE_IN_MS, SITE_URL } from "../../shared/system/sharedConstants";
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
// What helpers spent on Claude, a document per day (DBHelperSpendingUtil).
export const COLLECTION_HELPER_SPENDING = `${DB_PREFIX}helper_spending`;
// What happened in each agent's room while it was away, a document per agent (see AgentAwayLogUtil).
export const COLLECTION_AGENT_AWAY_EVENTS = `${DB_PREFIX}agent_away_events`;
// The clients that registered themselves with the agents' OAuth (see AgentOAuthClientUtil).
export const COLLECTION_OAUTH_CLIENTS = `${DB_PREFIX}oauth_clients`;

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
// An agent that has built is kept far longer than a guest of its tier, and for good from this many logins (see
// AgentCleanupUtil).
export const BUILDER_AGENT_MAX_AGE_BY_TIER_PHASE = [
    14 * DAY_IN_MS, // max age of a "disposable" agent that has built (14 days)
    30 * DAY_IN_MS, // max age of a "casual" one (30 days)
    90 * DAY_IN_MS, // max age of a "dedicated" one (90 days)
];
export const BUILDER_AGENT_KEPT_FOR_GOOD_LOGIN_COUNT = 10;

// Networking

export const URL_STATIC = SITE_URL;
export const URL_DYNAMIC = process.env.DB_PREFIX == "staging_" ? "https://staging.thingspool.net" : "https://app.thingspool.net";

// Only the public site serves share metadata and the analytics tag (staging would duplicate the site in
// search and pollute analytics; dev is throwaway).
export const IS_PUBLIC_SITE = process.env.MODE != "dev" && process.env.DB_PREFIX != "staging_";
export const AUTH_TOKEN_NAME_BASE = "thingspool_token";
export const TUTORIAL_FINISHED_COOKIE_NAME_BASE = "thingspool_tutorial_finished";
export const OAUTH_STATE_COOKIE_NAME_BASE = "thingspool_oauth_state";
export const OAUTH_RETURN_ROOM_COOKIE_NAME_BASE = "thingspool_oauth_return_room";
// Dev-only cookie carrying the DevRunner runtime's boot id (see DevRuntimeUtil).
export const DEV_BOOT_ID_COOKIE_NAME = "thingspool_dev_boot_id";

// A signal batch at least this long is sent deflated (see SocketUserContext); a shorter one gains too
// little by it.
export const SIGNAL_BATCH_DEFLATE_MIN_BYTES = 1024;

// AI Agents (see @docs/networking/agents.md)

export const AGENT_MCP_ROUTE_PATH = "mcp";
// The OAuth by which agents' hosts sign in (see AgentOAuthUtil): its endpoints' path, the endpoint that asks every
// request to sign in (beside AGENT_MCP_ROUTE_PATH, which asks only those needing a key), and the one scope it grants.
export const AGENT_OAUTH_ROUTE_PATH = "oauth";
export const AGENT_MCP_SIGNED_IN_ROUTE_PATH = `${AGENT_MCP_ROUTE_PATH}/oauth`;
export const AGENT_OAUTH_SCOPE = "agent";
// The site's mark, a file in public/ that is also served from the endpoint's own address (see AgentRouter), where MCP
// hosts and Claude's connector directory look for a server's icon.
export const AGENT_ICON_FILE = "largeLogo.jpg";
// How long a consent page stays good to answer, and a code to exchange for a token.
export const AGENT_OAUTH_REQUEST_TTL_MS = 10 * MINUTE_IN_MS;
export const AGENT_OAUTH_CODE_TTL_MS = MINUTE_IN_MS;
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
// How often what happens in agents' rooms without them is handed on (see AgentAwayLogUtil): a run of edits within it is
// one event, and one write for an agent away.
export const AGENT_AWAY_LOG_FLUSH_MS = MINUTE_IN_MS / 4;
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
// An agent's camera, the page watching through its eyes (see AgentCameraUtil), and how many pages may be open on one.
export const AGENT_CAMERA_ROUTE_PATH = "camera";
export const AGENT_CAMERA_MAX_PAGES = 2;
// The most agents present at once: the server steps their bodies (see AgentBodyUtil) and holds their rooms, and its
// process is restarted past a memory limit (see ecosystem.config.js).
export const AGENT_MAX_PRESENT = 30;
// The Claude model helpers chat with, and its prices in dollars per million tokens, for prompts as short as theirs
// (check them against https://platform.claude.com/docs/en/about-claude/pricing whenever the model changes).
export const HELPER_MODEL = "claude-haiku-5-5";
export const HELPER_MODEL_PRICES = {input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01};
// What all helpers together may spend on Claude in a day (UTC), in dollars (see HelperChatUtil). The live server's share
// spreads the free monthly API credit ($100) over the longest month, leaving a little for staging's helpers, which use
// the same key.
export const HELPER_DAILY_BUDGET_DOLLARS = IS_PUBLIC_SITE ? 3 : 0.2;
// The most replies all helpers together give one person in an hour, or one agent, who could keep them talking far longer.
export const HELPER_MAX_REPLIES_PER_PERSON_PER_HOUR = 30;
export const HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR = 10;

// What each user may do at once, and how fast that comes back, per second (see UserBudgetUtil). Set well above what a
// person does, so that only scripts meet them.
export const USER_BUDGETS: {[kind in UserBudgetKind]: {capacity: number, refillPerSecond: number}} = {
    // Blocks and objects added, removed, moved or changed.
    edit: {capacity: 300, refillPerSecond: 6},
    // Speech bubbles set.
    speech: {capacity: 10, refillPerSecond: 0.5},
    // Moves of one's player reported, which a browser reports five times a second.
    moves: {capacity: 25, refillPerSecond: 10},
    // How far one's player moves, in world units: the strongest fan throws one about 16 in a second, at a walk.
    distance: {capacity: 40, refillPerSecond: 20},
    // Switches between play and edit mode, which one's player shows the room.
    modeSwitches: {capacity: 20, refillPerSecond: 1},
    // An agent's calls of tools that change nothing, and of the others.
    agentReads: {capacity: 30, refillPerSecond: 1},
    agentActions: {capacity: 15, refillPerSecond: 0.5},
};

// SSG (Static Site Generator)

export const STATIC_PAGE_ROOT_DIR = "public";
export const VIEWS_ROOT_DIR = "views";
export const SRC_ROOT_DIR = "src";
export const GLOBAL_LAST_MOD = "2023-09-10";