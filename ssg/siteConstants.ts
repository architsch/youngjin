import path from "node:path";

export const URL_STATIC = "https://thingspool.net";
// Robot Rooms, the game the home page and the arcade send visitors to.
export const URL_ROBOT_ROOMS = "https://app.thingspool.net";

// The site as published: the pages are written here, beside the sources they are built from.
export const PUBLIC_DIR = path.resolve(import.meta.dirname, "../public");
export const VIEWS_DIR = path.join(import.meta.dirname, "views");

// The date of a page whose source gives none.
export const GLOBAL_LAST_MOD = "2023-09-10";

export const PAGE_NAME_MAP = {
    "index": "Home",
    "arcade": "Arcade",
    "library": "Library",
    "portfolio": "Portfolio",
};
