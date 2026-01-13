// Networking

export const AUTH_TOKEN_NAME = "thingspool_token_v3";

// Math

export const NEAR_EPSILON = 0.000000001;

// Physics

export const NUM_COLLISION_LAYERS = 8;

export const COLLISION_LAYER_00_TO_05 = 0;
export const COLLISION_LAYER_05_TO_10 = 1;
export const COLLISION_LAYER_10_TO_15 = 2;
export const COLLISION_LAYER_15_TO_20 = 3;
export const COLLISION_LAYER_20_TO_25 = 4;
export const COLLISION_LAYER_25_TO_30 = 5;
export const COLLISION_LAYER_30_TO_35 = 6;
export const COLLISION_LAYER_35_TO_40 = 7;
export const COLLISION_LAYER_NULL = 8;

export const COLLISION_LAYER_MIN = COLLISION_LAYER_00_TO_05;
export const COLLISION_LAYER_MAX = COLLISION_LAYER_35_TO_40;

export const MIN_OBJECT_LEVEL_CHANGE_INTERVAL = 0.2;

// Voxel Grid Dimensions

export const NUM_VOXEL_ROWS = 32;
export const NUM_VOXEL_COLS = 32;

export const NUM_VOXEL_QUADS_PER_COLLISION_LAYER = 6; // corresponding to 6 sides of a 3D box: [-y, +y, -x, +x, -z, +z]
export const NUM_VOXEL_QUADS_PER_VOXEL =
    (NUM_VOXEL_QUADS_PER_COLLISION_LAYER * NUM_COLLISION_LAYERS) + 2; // 2 is for the floor and ceiling quads, which sit outside of the collision layers (They belong to "COLLISION_LAYER_NULL").

export const NUM_VOXEL_QUADS_PER_ROOM = NUM_VOXEL_QUADS_PER_VOXEL * NUM_VOXEL_ROWS * NUM_VOXEL_COLS; // 51200

// Voxel Grid Tasks

export const VOXEL_GRID_TASK_TYPE_MOVE = 0;
export const VOXEL_GRID_TASK_TYPE_ADD = 1;
export const VOXEL_GRID_TASK_TYPE_REMOVE = 2;
export const VOXEL_GRID_TASK_TYPE_TEX = 3;
/*export const VOXEL_GRID_TASK_TYPE_SHRINK_OR_EXPAND = 4;*/

// UI

export const Z_INDEX_LOADING_SCREEN = "z-100"; // e.g. full-screen indicator that the whole app is transitioning to another state.
export const Z_INDEX_NOTIFICATION = "z-80"; // e.g. toast message
export const Z_INDEX_POPUP = "z-70"; // e.g. error popup, confirmation dialog window, form to fill out and submit
export const Z_INDEX_INSTRUCTION = "z-60"; // e.g. tutorial's on-screen instruction
export const Z_INDEX_HUD_OVERLAY = "z-55"; // e.g. tooltip text, temporary debug panel
export const Z_INDEX_HUD_MAIN = "z-50"; // e.g. menu, editor panel