import DBUserVersionMigration from "../db/types/versionMigration/dbUserVersionMigration";

// Networking

export const LOCALHOST_PORT = 3000;
export const URL_STATIC = "https://thingspool.net";
export const URL_DYNAMIC = "https://app.thingspool.net";
export const AUTH_TOKEN_NAME_BASE = `thingspool_token_v${DBUserVersionMigration.length}`;

// SSG (Static Site Generator)

export const STATIC_PAGE_ROOT_DIR = "public";
export const VIEWS_ROOT_DIR = "views";
export const SRC_ROOT_DIR = "src";
export const GLOBAL_LAST_MOD = "2023-09-10";