// Runtime Environment

export let IS_SERVER = false;
export function setIsServer() { IS_SERVER = true; }

// Math

export const NEAR_EPSILON = 0.000000001;
export const MINUTE_IN_MS = 60 * 1000;
export const HOUR_IN_MS = 60 * MINUTE_IN_MS;
export const DAY_IN_MS = 24 * HOUR_IN_MS;

// Database

export const UNDEFINED_DOCUMENT_ID_CHAR = "?";
export const FIRST_TUTORIAL_STEP = 0;
export const LAST_TUTORIAL_STEP = 0;
export const TUTORIAL_DONE_STEP = 10000;

// Networking

export const USER_API_ROUTE_PATH = "api/user";
export const ROOM_API_ROUTE_PATH = "api/room";
export const SIGNAL_BATCH_SEND_INTERVAL = 200; // in milliseconds (0.2s)
export const ROOM_AUTO_SAVE_INTERVAL = 10 * MINUTE_IN_MS; // in milliseconds (10m)
export const OBJECT_MESSAGE_MAX_LENGTH = 72;

// Physics

export const NUM_COLLISION_LAYERS = 8; // Total number of collision layers which span the room's Y-axis
export const MAX_ROOM_Y = NUM_COLLISION_LAYERS * 0.5; // 4
export const MID_ROOM_Y = 0.5 * MAX_ROOM_Y; // 2

export const COLLISION_LAYER_00_TO_05 = 0; // y = [0.0, 0.5]
export const COLLISION_LAYER_05_TO_10 = 1; // y = [0.5, 1.0]
export const COLLISION_LAYER_10_TO_15 = 2; // y = [1.0, 1.5]
export const COLLISION_LAYER_15_TO_20 = 3; // y = [1.5, 2.0]
export const COLLISION_LAYER_20_TO_25 = 4; // y = [2.0, 2.5]
export const COLLISION_LAYER_25_TO_30 = 5; // y = [2.5, 3.0]
export const COLLISION_LAYER_30_TO_35 = 6; // y = [3.0, 3.5]
export const COLLISION_LAYER_35_TO_40 = 7; // y = [3.5, 4.0]
export const COLLISION_LAYER_NULL = 8;

export const COLLISION_LAYER_MIN = COLLISION_LAYER_00_TO_05;
export const COLLISION_LAYER_MAX = COLLISION_LAYER_35_TO_40;

export const STEP_UP_HEIGHT = 0.6; // Maximum height an object can step up onto when colliding with an obstacle.
export const GRAVITY_SPEED = 5; // Units per second for gravity-based falling.

// Voxel Grid Dimensions

export const NUM_VOXEL_ROWS = 32;
export const NUM_VOXEL_COLS = 32;

export const NUM_VOXEL_QUADS_PER_COLLISION_LAYER = 6; // corresponding to 6 sides of a 3D box: [-y, +y, -x, +x, -z, +z]
export const NUM_VOXEL_QUADS_PER_VOXEL =
    (NUM_VOXEL_QUADS_PER_COLLISION_LAYER * NUM_COLLISION_LAYERS) + 2; // 2 is for the floor and ceiling quads, which sit outside of the collision layers (They belong to "COLLISION_LAYER_NULL").

export const NUM_VOXEL_QUADS_PER_ROOM = NUM_VOXEL_QUADS_PER_VOXEL * NUM_VOXEL_ROWS * NUM_VOXEL_COLS; // 51200

// Object Limits

export const MAX_CANVASES_PER_ROOM = 64;
export const MAX_IMAGE_URL_LENGTH = 512;

// Gameplay

export const MAX_WORLDSPACE_SELECT_DIST_SQR = 256; // = 16*16

// UI

export const PAGE_NAME_MAP = {
    "index": "Home", // static
    "arcade": "Arcade", // static
    "library": "Library", // static
    "portfolio": "Portfolio", // static
};