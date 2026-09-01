import InstancedColorMaterialParams from "../graphics/material/types/instancedColorMaterialParams";
import InstancedEyeMaterialParams from "../graphics/material/types/instancedEyeMaterialParams";
import InstancedTinMaterialParams from "../graphics/material/types/instancedTinMaterialParams";
import InstancedWoodMaterialParams from "../graphics/material/types/instancedWoodMaterialParams";
import Vec3 from "../math/types/vec3";

// Runtime Environment

export let IS_SERVER = false;
export function setIsServer() { IS_SERVER = true; }

// Math

export const NEAR_EPSILON = 0.000000001;
export const MINUTE_IN_MS = 60 * 1000;
export const HOUR_IN_MS = 60 * MINUTE_IN_MS;
export const DAY_IN_MS = 24 * HOUR_IN_MS;
export const ZERO_VEC3: Vec3 = {x: 0, y: 0, z: 0};
export const UNIT_VEC3: Vec3 = {x: 1, y: 1, z: 1};

// SinglePlayerMode

export const TUTORIAL_SINGLE_PLAYER_MODE = "tutorial";
export const SANDBOX_SINGLE_PLAYER_MODE = "sandbox";

// Database

export const UNDEFINED_DOCUMENT_ID_CHAR = "?";

// Networking

export const USER_API_ROUTE_PATH = "api/user";
export const ROOM_API_ROUTE_PATH = "api/room";
export const HEALTH_ROUTE_PATH = "health";
export const SIGNAL_BATCH_SEND_INTERVAL = 200; // in milliseconds (0.2s)
export const ROOM_AUTO_SAVE_INTERVAL = 10 * MINUTE_IN_MS; // in milliseconds (10m)
export const OBJECT_MESSAGE_MAX_LENGTH = 72;
export const OBJECT_INSTANCED_MESH_COMPOSITION_METADATA_MAX_LENGTH = 512;

// How long the text written on an object may be. It is short because of where it is read: a label
// is drawn onto a patch of the object itself (see the LabelText component), and a name that fills
// that patch at a size nobody can make out from across the room is worse than one that was cut.
export const OBJECT_LABEL_MAX_LENGTH = 24;

// Which set of colors a label's lettering is drawn from (see ColorPaletteMap). Named here rather
// than written out at each of the three places that need it — what is stored is a position in this
// exact palette, so a second name for it would be a second meaning for every label already written.
export const LABEL_COLOR_PALETTE_NAME = "LabelColor";

// The longest a stored document id may be. Firestore's own limit, which is what bounds a door's
// destination room id: an id is never composed by hand, so this only has to refuse a value that was
// never an id in the first place.
export const DOCUMENT_ID_MAX_LENGTH = 1500;

// Physics

export const GRAVITY_SPEED = 3;
export const SOFT_COLLISION_PUSH_SPEED_LIMIT = GRAVITY_SPEED * 2;

export const NUM_COLLISION_LAYERS = 16; // Total number of collision layers which span the room's Y-axis
export const COLLISION_LAYER_HEIGHT = 0.5; // How tall one collision layer stands, in world units
export const MAX_ROOM_Y = NUM_COLLISION_LAYERS * COLLISION_LAYER_HEIGHT; // 8
export const MID_ROOM_Y = 0.5 * MAX_ROOM_Y; // 4

export const COLLISION_LAYER_00_TO_05 = 0; // y = [0.0, 0.5]
export const COLLISION_LAYER_05_TO_10 = 1; // y = [0.5, 1.0]
export const COLLISION_LAYER_10_TO_15 = 2; // y = [1.0, 1.5]
export const COLLISION_LAYER_15_TO_20 = 3; // y = [1.5, 2.0]
export const COLLISION_LAYER_20_TO_25 = 4; // y = [2.0, 2.5]
export const COLLISION_LAYER_25_TO_30 = 5; // y = [2.5, 3.0]
export const COLLISION_LAYER_30_TO_35 = 6; // y = [3.0, 3.5]
export const COLLISION_LAYER_35_TO_40 = 7; // y = [3.5, 4.0]
export const COLLISION_LAYER_40_TO_45 = 8; // y = [4.0, 4.5]
export const COLLISION_LAYER_45_TO_50 = 9; // y = [4.5, 5.0]
export const COLLISION_LAYER_50_TO_55 = 10; // y = [5.0, 5.5]
export const COLLISION_LAYER_55_TO_60 = 11; // y = [5.5, 6.0]
export const COLLISION_LAYER_60_TO_65 = 12; // y = [6.0, 6.5]
export const COLLISION_LAYER_65_TO_70 = 13; // y = [6.5, 7.0]
export const COLLISION_LAYER_70_TO_75 = 14; // y = [7.0, 7.5]
export const COLLISION_LAYER_75_TO_80 = 15; // y = [7.5, 8.0]
export const COLLISION_LAYER_NULL = 16;

export const COLLISION_LAYER_MIN = COLLISION_LAYER_00_TO_05;
export const COLLISION_LAYER_MAX = COLLISION_LAYER_75_TO_80;

// The collision layer mask of a voxel that is solid from the room's floor to its ceiling, which is
// also the largest value such a mask can take.
export const FULL_COLLISION_LAYER_MASK = (1 << NUM_COLLISION_LAYERS) - 1;

export const NUM_COLLISION_LAYERS_PER_STOREY = 7;

// This is the layer between the first and second storeys (assuming that the room is divided into two storeys).
export const STOREY_FLOOR_COLLISION_LAYER = NUM_COLLISION_LAYERS_PER_STOREY;

export const DIR_VEC_BY_NAME: {[key: string]: Vec3} = {
    "+x": {x: 1, y: 0, z: 0},
    "-x": {x: -1, y: 0, z: 0},
    "+y": {x: 0, y: 1, z: 0},
    "-y": {x: 0, y: -1, z: 0},
    "+z": {x: 0, y: 0, z: 1},
    "-z": {x: 0, y: 0, z: -1},
};

export const DIR_VEC_BY_CODE: Vec3[] = [
    {x: 0, y: -1, z: 0}, // -y = 0
    {x: 0, y: 1, z: 0}, // +y = 1
    {x: -1, y: 0, z: 0}, // -x = 2
    {x: 1, y: 0, z: 0}, // +x = 3
    {x: 0, y: 0, z: -1}, // -z = 4
    {x: 0, y: 0, z: 1}, // +z = 5
];

// Graphics

// The local -Z axis that Three.js `lookAt` treats as "facing the target": the engine's
// forward-facing direction, and the reference frame that composition part dirs are authored against.
export const FORWARD_DIR: Vec3 = {x: 0, y: 0, z: -1};
export const BACKWARD_DIR: Vec3 = {x: 0, y: 0, z: 1};

export const GEOMETRY_ID_BY_CODE: string[] = [
    "Square", // 0
    "Box", // 1
    "Icosphere", // 2
    "Cone", // 3
    "Capsule", // 4
];
export const GEOMETRY_CODE_BY_ID: {[geometryId: string]: number} = {
    "Square": 0,
    "Box": 1,
    "Icosphere": 2,
    "Cone": 3,
    "Capsule": 4,
};

export const INSTANCED_COLOR_MATERIAL_ID = new InstancedColorMaterialParams().getMaterialId();
export const INSTANCED_EYE_MATERIAL_ID = new InstancedEyeMaterialParams().getMaterialId();
export const INSTANCED_TIN_MATERIAL_ID = new InstancedTinMaterialParams().getMaterialId();
export const INSTANCED_WOOD_MATERIAL_ID = new InstancedWoodMaterialParams().getMaterialId();

export const MATERIAL_ID_BY_CODE: string[] = [
    INSTANCED_COLOR_MATERIAL_ID, // 0
    INSTANCED_EYE_MATERIAL_ID, // 1
    INSTANCED_TIN_MATERIAL_ID, // 2
    INSTANCED_WOOD_MATERIAL_ID, // 3
];
export const MATERIAL_CODE_BY_ID: {[materialId: string]: number} = {};
MATERIAL_CODE_BY_ID[INSTANCED_COLOR_MATERIAL_ID] = 0;
MATERIAL_CODE_BY_ID[INSTANCED_EYE_MATERIAL_ID] = 1;
MATERIAL_CODE_BY_ID[INSTANCED_TIN_MATERIAL_ID] = 2;
MATERIAL_CODE_BY_ID[INSTANCED_WOOD_MATERIAL_ID] = 3;

// Materials that tint each instance through the instance color (InstancedMesh.setColorAt), and
// hence need a composition part's color both encoded and pushed to the GPU. Anything driven by
// specialized per-instance attributes instead (e.g. the eye colors) is deliberately excluded.
// A material may appear here and still read attributes of its own: the wood surface takes its
// background color this way and its moulding color from a buffer attribute alongside it.
export const INSTANCE_COLORED_MATERIAL_IDS: string[] = [
    INSTANCED_COLOR_MATERIAL_ID,
    INSTANCED_TIN_MATERIAL_ID,
    INSTANCED_WOOD_MATERIAL_ID,
];

export const VOXEL_TEXTURE_PACK_MATERIAL_ID = "voxelTexturePack";
export const VOXEL_QUAD_GEOMETRY_ID = "Square";
export const CANVAS_GEOMETRY_ID = "Square";

export const CANVAS_FRAME_ATLAS_PATH = "object_texture_packs/canvas_frames.webp"; // relative to the app's assets_url
export const CANVAS_FRAME_ATLAS_SIZE = 1024; // in pixels (the atlas is square)
export const CANVAS_FRAME_ATLAS_CELL_SIZE = 256; // in pixels (each cell is square)

export const MAX_MESH_INSTANCES_PER_PLAYER = 32;
export const UNIT_PLAYER_PART_LENGTH = 0.125;
export const SAFE_PLAYER_PART_CIRCLE_DIAMETER_IN_UNITS = 2 * Math.sqrt(5);
export const SAFE_PLAYER_PART_CIRCLE_STICK_OUT_LENGTH_IN_UNITS = Math.sqrt(5) - 2;

// Door

export const DOOR_GEOMETRY_ID = "Square";

// How much wall a door lays claim to, and how much of that claim it actually fills. The footprint is
// what other wall attachments are kept out of; the panel is what is drawn, centered across the
// footprint and flush with its bottom. The difference is deliberate margin: room to stand two doors
// side by side without their frames touching, and a gap under the ceiling above.
//
// The footprint stands exactly one storey tall, so a door reaches from the floor it is mounted on to
// just under the slab over it, and the panel keeps a door's real proportions within that.
export const DOOR_FOOTPRINT_WIDTH = 1.5;
export const DOOR_FOOTPRINT_HEIGHT = NUM_COLLISION_LAYERS_PER_STOREY * COLLISION_LAYER_HEIGHT; // 3.5
export const DOOR_PANEL_WIDTH = 1.375;
export const DOOR_PANEL_HEIGHT = 3.25;

export const MAX_DOORS_PER_ROOM = 16;
export const MAX_MESH_INSTANCES_PER_DOOR = 8;

// Label Text

export const LABEL_GEOMETRY_ID = "Square";

// Every label in a room is drawn from one mesh, and every one of them is written into one cell of
// one texture — so this is a room-wide budget rather than a per-object one, and the atlas is a grid
// of exactly this many cells. A cell is wide and short because a label is: what goes on one is a
// name on a plate, and giving it a square cell would spend most of the pixels above and below the
// lettering. A quad of a different shape is still drawn correctly (the text is laid out in world
// units and scaled onto the cell), it just spends its pixels less evenly.
export const MAX_LABELS_PER_ROOM = 16;
export const LABEL_ATLAS_WIDTH = 2048; // in pixels
export const LABEL_ATLAS_HEIGHT = 512; // in pixels
export const LABEL_ATLAS_CELL_WIDTH = 512; // in pixels
export const LABEL_ATLAS_CELL_HEIGHT = 128; // in pixels

// Voxel Grid

export const NUM_VOXEL_ROWS = 32;
export const NUM_VOXEL_COLS = 32;

export const NUM_VOXEL_QUADS_PER_COLLISION_LAYER = 6; // corresponding to 6 sides of a 3D box: [-y, +y, -x, +x, -z, +z]
export const NUM_VOXEL_QUADS_PER_VOXEL =
    (NUM_VOXEL_QUADS_PER_COLLISION_LAYER * NUM_COLLISION_LAYERS) + 2; // 2 is for the floor and ceiling quads, which sit outside of the collision layers (They belong to "COLLISION_LAYER_NULL").

// How many quads a room addresses, and so the range every quadIndex is drawn from. Growing the room
// in any direction — more rows, more columns, more collision layers — grows this, and a quadIndex is
// carried in the voxel edit signals, so the field it is sent in has to stay wide enough to hold the
// largest one. A field that is too narrow does not fail loudly: the index is clamped down to a value
// that still names a real quad, and the edit lands on the wrong part of the room. The tests assert
// this range against the width of that field, so a room that outgrows it fails there instead.
export const NUM_VOXEL_QUADS_PER_ROOM = NUM_VOXEL_QUADS_PER_VOXEL * NUM_VOXEL_ROWS * NUM_VOXEL_COLS; // 100352

// The largest a room's voxel grid can come out once encoded: every cell writing its floor and
// ceiling quads, its collision layer mask, and the six faces of every one of its collision layers —
// which is what a room built solid from its floor to its ceiling amounts to. Only the occupied
// layers of a cell are written, so an ordinary room costs a small fraction of this; it is here so
// that the buffer a room is encoded into can be sized for the room nobody has built yet
// (see EncodingUtil).
export const MAX_ENCODED_VOXEL_GRID_BYTES = 1 /* format version */ +
    NUM_VOXEL_ROWS * NUM_VOXEL_COLS *
        (2 /* floor and ceiling quads */ + 2 /* collision layer mask */ +
            NUM_VOXEL_QUADS_PER_COLLISION_LAYER * NUM_COLLISION_LAYERS);

// How many of a room's quads can be on show at once, which is what the room's instanced mesh is
// sized for rather than the far larger number of quads the grid addresses (see
// VoxelQuadInstanceUtil). A quad is drawn only where something solid meets something open, so the
// bound is the number of such boundaries the grid holds: one per pair of vertically stacked blocks
// (the room's own floor and ceiling being the outermost two), and one per pair of side-by-side
// blocks along each horizontal axis. A boundary between two solid blocks, or between two open ones,
// draws nothing at all, so no arrangement of a room can exceed this.
export const MAX_VISIBLE_VOXEL_QUADS_PER_ROOM =
    (NUM_COLLISION_LAYERS + 1) * NUM_VOXEL_ROWS * NUM_VOXEL_COLS +
    (NUM_VOXEL_COLS - 1) * NUM_VOXEL_ROWS * NUM_COLLISION_LAYERS +
    (NUM_VOXEL_ROWS - 1) * NUM_VOXEL_COLS * NUM_COLLISION_LAYERS; // 49152

export const VOXEL_BLOCK_HITBOX_HALFSIZE = {x: 0.5, y: 0.5 * COLLISION_LAYER_HEIGHT, z: 0.5};

// Object Limits

export const MAX_CANVASES_PER_ROOM = 64; // because the render-target texture, used for rendering canvas images based on mesh instances, is an 8x8 grid
export const MAX_PLAYERS_PER_ROOM = 64;

// Population bands used to load-balance the users across the rooms.
// A room at or above the over-population threshold is considered "over-populated"
// (i.e. crowded enough that no more users should be routed into it),
// and a room at or below the under-population threshold is considered "under-populated"
// (i.e. still empty enough that it should be filled up before another room is filled).
// Anything in between is a medium-populated room.
export const ROOM_OVER_POPULATION_THRESHOLD = 50;
export const ROOM_UNDER_POPULATION_THRESHOLD = 20;

// Slots held in reserve below the hard cap. A room is considered "almost full" — and stops
// admitting anyone new — once its population reaches (MAX_PLAYERS_PER_ROOM - this margin),
// so that a handful of joins that were already in flight cannot push it past the hard cap.
export const ROOM_ALMOST_FULL_MARGIN = 4;

// Gameplay

export const PLAYER_HEIGHT = 2.5;
export const PLAYER_RADIUS_XZ = 0.375; // radius of the player on the XZ plane.

// How far the user may reach into the room to select something. This is the base reach, which is
// what a first-person view gets; a camera taken further back than this to orbit a selection reaches
// as far as it can see instead (see WorldSpaceSelectionUtil).
export const MAX_WORLDSPACE_SELECT_DIST = 10;

// Where a multiplayer room's own door is hung when the room is generated: one cell of one boundary
// wall, which is also what an arriving player is put down behind unless a door of the room says
// otherwise (see SpawnHotspotUtil). Only the starting point — an admin is free to slide that door
// along the wall or take it down afterwards, so nothing may read this as where a room's way in
// stands now. A singleplayer room names its own entrance cell in its SinglePlayerModeConfig.
export const INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL = 16;
export const INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW = 31;

// How tall the doorway a multiplayer room used to be entered through stood, in collision layers.
// Nothing carves one any more — a room's way in is a door hung on the boundary wall — but this is a
// fact about the format older rooms were written in, and the conversions that carry them across need
// it to fill that stretch of wall back in.
export const INITIAL_MULTI_PLAYER_ENTRANCE_HEIGHT_IN_LAYERS = 5;

// UI

export const PAGE_NAME_MAP = {
    "index": "Home", // static
    "arcade": "Arcade", // static
    "library": "Blog", // static
    "portfolio": "Portfolio", // static
};