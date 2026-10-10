import InstancedColorMaterialParams from "../graphics/material/types/instancedColorMaterialParams";
import InstancedTinMaterialParams from "../graphics/material/types/instancedTinMaterialParams";
import InstancedWoodMaterialParams from "../graphics/material/types/instancedWoodMaterialParams";
import InstancedEmissiveMaterialParams from "../graphics/material/types/instancedEmissiveMaterialParams";
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
// Where an admin makes the rooms the other modes are played in (see @docs/networking/single_player_mode.md).
export const ROOM_EDITOR_SINGLE_PLAYER_MODE = "roomEditor";

// The tag of the object a single-player room's player starts under (see ObjectTagUtil).
export const SINGLE_PLAYER_START_TAG = "start";

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

// In code points. Text past what a label's patch holds is cut off at its bottom (see LabelText).
export const OBJECT_LABEL_MAX_LENGTH = 512;

// In code points: what an object with no text to show is called (an NPC's name, a volume's), kept in its Label.
export const OBJECT_NAME_MAX_LENGTH = 32;

// In characters, commas included (see ObjectTagUtil). Short, and plain letters, as any object may carry tags.
export const OBJECT_TAGS_MAX_LENGTH = 64;

// In code points: room for any user's name (see ObjectMetadataKeyEnumMap.ZoneUserName). A member's is the
// local part of an email address, with a short suffix where that was taken (see UserAuthGoogleUtil).
export const OBJECT_USER_NAME_MAX_LENGTH = 72;

// In place of a user's name, what keeps a restricted zone from every user but the room's superuser (see
// RestrictedZoneUtil).
export const ZONE_USER_NAME_FOR_NOBODY = "*";

// Stored label colors are positions in this palette.
export const LABEL_COLOR_PALETTE_NAME = "LabelColor";

// Stored room light colors are positions in this palette.
export const LIGHT_COLOR_PALETTE_NAME = "Light";
export const FOG_COLOR_PALETTE_NAME = "Fog";
// Palette for clouds and ground (masses against the air, unlike the fog palette).
export const SCENERY_COLOR_PALETTE_NAME = "Scenery";

// Firestore's document id limit (bounds a door's destination id).
export const DOCUMENT_ID_MAX_LENGTH = 1500;

// Reserved room id meaning "a hub, chosen by the balancer" (see RoomPickerUtil), usable in URLs and
// door destinations. No real room id matches it.
export const HUB_ROOM_ID_KEYWORD = "hub";

// Physics

export const GRAVITY_SPEED = 6;
export const CLIMB_SPEED = 3;
export const SOFT_COLLISION_PUSH_SPEED_LIMIT = 6;

// Inset of an attached object's hitbox on the axes of its face (see PhysicsColliderStateUtil), so
// neighbours sharing a footprint edge never register as overlapping. Depth is not inset.
export const ATTACHMENT_HITBOX_INSET = 0.02;

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

// Facings an attached object can be allowed (see ObjectAttachmentConfig).
export const WALL_DIRECTIONS: Vec3[] = [
    DIR_VEC_BY_NAME["+x"], DIR_VEC_BY_NAME["-x"], DIR_VEC_BY_NAME["+z"], DIR_VEC_BY_NAME["-z"],
];
export const ALL_FACE_DIRECTIONS: Vec3[] = [
    ...WALL_DIRECTIONS, DIR_VEC_BY_NAME["+y"], DIR_VEC_BY_NAME["-y"],
];

// Graphics

// The file at the assets' root holding what an admin sets about them by hand (see AdminAssetSettings).
export const ADMIN_ASSET_SETTINGS_FILE_NAME = "adminAssetSettings.json";

// Three.js lookAt's forward (-Z); composition part dirs are authored against it.
export const FORWARD_DIR: Vec3 = {x: 0, y: 0, z: -1};
export const BACKWARD_DIR: Vec3 = {x: 0, y: 0, z: 1};

// Geometry codes in composition strings (see DefaultCompositionCodec). Append-only, as material
// codes are.
export const GEOMETRY_ID_BY_CODE: string[] = [
    "Square", // 0
    "Box", // 1
    "Icosphere", // 2
    "Cone", // 3
    "Capsule", // 4
    "Cylinder", // 5
];
export const GEOMETRY_CODE_BY_ID: {[geometryId: string]: number} = {
    "Square": 0,
    "Box": 1,
    "Icosphere": 2,
    "Cone": 3,
    "Capsule": 4,
    "Cylinder": 5,
};

// Depth between stacked coplanar surfaces. Real relief rather than a tiny offset, which avoids
// z-fighting on low-precision mobile depth buffers (see DefaultCompositionCodec, DoorCompositionConstants).
export const RELIEF_STEP = 0.02;

export const INSTANCED_COLOR_MATERIAL_ID = new InstancedColorMaterialParams().getMaterialId();
export const INSTANCED_TIN_MATERIAL_ID = new InstancedTinMaterialParams().getMaterialId();
export const INSTANCED_WOOD_MATERIAL_ID = new InstancedWoodMaterialParams().getMaterialId();
export const INSTANCED_EMISSIVE_MATERIAL_ID = new InstancedEmissiveMaterialParams().getMaterialId();

// Material codes in composition strings (see DefaultCompositionCodec). Append-only; retired codes keep
// their slot (code 1 was the removed "InstancedEye").
const RETIRED_MATERIAL_ID = "";

export const MATERIAL_ID_BY_CODE: string[] = [
    INSTANCED_COLOR_MATERIAL_ID, // 0
    RETIRED_MATERIAL_ID, // 1 (retired — see above)
    INSTANCED_TIN_MATERIAL_ID, // 2
    INSTANCED_WOOD_MATERIAL_ID, // 3
    INSTANCED_EMISSIVE_MATERIAL_ID, // 4
];
export const MATERIAL_CODE_BY_ID: {[materialId: string]: number} = {};
MATERIAL_CODE_BY_ID[INSTANCED_COLOR_MATERIAL_ID] = 0;
MATERIAL_CODE_BY_ID[INSTANCED_TIN_MATERIAL_ID] = 2;
MATERIAL_CODE_BY_ID[INSTANCED_WOOD_MATERIAL_ID] = 3;
MATERIAL_CODE_BY_ID[INSTANCED_EMISSIVE_MATERIAL_ID] = 4;

// Materials tinted via the instance color, so composition colors are encoded and uploaded for them. A
// material may also read its own attributes (wood reads its moulding color from one).
export const INSTANCE_COLORED_MATERIAL_IDS: string[] = [
    INSTANCED_COLOR_MATERIAL_ID,
    INSTANCED_TIN_MATERIAL_ID,
    INSTANCED_WOOD_MATERIAL_ID,
    INSTANCED_EMISSIVE_MATERIAL_ID,
];

// The palette a material's colors are stored as, one char each (see DefaultCompositionCodec). Every
// instance-colored material needs an entry, or its parts encode without a color.
export const COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID: {[materialId: string]: string} = {
    [INSTANCED_COLOR_MATERIAL_ID]: "Scenery",
    [INSTANCED_TIN_MATERIAL_ID]: "Player",
    [INSTANCED_WOOD_MATERIAL_ID]: "Timber",
    [INSTANCED_EMISSIVE_MATERIAL_ID]: LIGHT_COLOR_PALETTE_NAME,
};

export const VOXEL_TEXTURE_PACK_MATERIAL_ID = "voxelTexturePack";
export const VOXEL_QUAD_GEOMETRY_ID = "Square";

// Per-type constants (door footprint, canvas count, player height, ...) live in each ObjectTypeConfig.

// Label Text

export const LABEL_GEOMETRY_ID = "Square";

// Every label in a room is drawn into one single-channel atlas, handed out in rectangles of whole cells
// (see TextureAtlasAllocator). A cell covers a fixed patch of world space, so text has the same density at
// any label size, and a font size in pixels means the same size everywhere.
export const LABEL_ATLAS_SIZE = 4096; // in pixels (the atlas is square)
export const LABEL_ATLAS_CELL_SIZE = 128; // in pixels (each cell is square)
export const LABEL_ATLAS_CELL_WORLD_SIZE = 0.5; // in world units: the step labels are resized in
export const LABEL_PIXELS_PER_WORLD_UNIT = LABEL_ATLAS_CELL_SIZE / LABEL_ATLAS_CELL_WORLD_SIZE;

// Pictures (the images canvases and props show; see PictureGameObject)

// The atlas every picture in a room is drawn into, one region per image. A cell is the unit an image that keeps
// its scale is sized in (see ImageMetadata.preserveScale).
export const PICTURE_ATLAS_SIZE = 2048; // in pixels (the atlas is square)
export const PICTURE_ATLAS_CELL_SIZE = 128; // in pixels (each cell is square)
export const PICTURE_ATLAS_CELL_WORLD_SIZE = 0.5; // in world units
// The longest side of any image's region, however large what shows it: the size of the largest image that
// keeps its scale.
export const PICTURE_ATLAS_MAX_REGION_CELLS = 2;
// The longest side of the thumbnails the image choosers show, which also serve regions no larger (so, being no
// smaller than the largest region, every region).
export const PICTURE_THUMBNAIL_SIZE = 256; // in pixels
// Words that say nothing of an image by themselves: never an everyday object's keywords, and passed over in what
// is typed into a search, so "sweet and sour" still finds "sweet, sour" (see ImageMetadata.keywords).
export const PICTURE_SEARCH_FILLER_WORDS = ["a", "an", "the", "and", "or", "but", "nor", "of", "in", "on", "at", "to",
    "for", "with", "from", "by", "off", "into", "onto", "no", "not"];

// Voxel Textures (the cells of a room's texture pack, which its voxel quads show)

// A pack's atlas as the game loads it: the pack's own image under rows SSG draws, the same for every pack (see
// VoxelTexturePackBuilder). A quad's textureIndex counts cells from the atlas's bottom-left, row by row.
export const VOXEL_TEXTURE_CELL_SIZE = 128; // in pixels (each cell is square)
export const NUM_VOXEL_TEXTURE_COLS = 8;
export const NUM_VOXEL_TEXTURE_ROWS = 10;
export const NUM_VOXEL_TEXTURES = NUM_VOXEL_TEXTURE_COLS * NUM_VOXEL_TEXTURE_ROWS; // 80
// The first of them are the pack's own; the rest are the procedural ones.
export const NUM_PACK_VOXEL_TEXTURES = 64;
// A procedural cell tiles inside a margin of its own continuation, which quads leave out: the atlas's lossy color
// bleeds between cells across their outermost texels, and would show as a line wherever a flat color repeats.
export const PROCEDURAL_VOXEL_TEXTURE_MARGIN = 8; // in pixels

// Voxel Grid

export const NUM_VOXEL_ROWS = 64;
export const NUM_VOXEL_COLS = 64;

// How wide a voxel is along x and along z, in world units (see VoxelQueryUtil for telling one from the other).
// As wide as a layer is high, so a block is a cube.
export const VOXEL_CELL_SIZE = 0.5;

// How far the room reaches along x and z, in world units (MAX_ROOM_Y is its height).
export const MAX_ROOM_X = NUM_VOXEL_COLS * VOXEL_CELL_SIZE;
export const MAX_ROOM_Z = NUM_VOXEL_ROWS * VOXEL_CELL_SIZE;

// How thick room generation leaves a room's boundary wall, in voxels: a world unit, as deep as a door needs
// behind it and as wide as a texture tile (see RoomGenerationUtil).
export const GENERATED_WALL_THICKNESS = 2;

// The size of a physics voxel (see PhysicsVoxel): wide enough that most colliders lie in one or two, and a
// storey high, so the objects of each storey are kept apart.
export const PHYSICS_VOXEL_SIZE_XZ = 2;
export const PHYSICS_VOXEL_SIZE_Y = 4;
export const NUM_PHYSICS_VOXELS_X = Math.ceil(MAX_ROOM_X / PHYSICS_VOXEL_SIZE_XZ);
export const NUM_PHYSICS_VOXELS_Y = Math.ceil(MAX_ROOM_Y / PHYSICS_VOXEL_SIZE_Y);
export const NUM_PHYSICS_VOXELS_Z = Math.ceil(MAX_ROOM_Z / PHYSICS_VOXEL_SIZE_XZ);

// Voxel blocks per room (one layer of one voxel); the buffer size for whole-volume computations.
export const NUM_VOXEL_BLOCKS = NUM_VOXEL_ROWS * NUM_VOXEL_COLS * NUM_COLLISION_LAYERS;

export const NUM_VOXEL_QUADS_PER_COLLISION_LAYER = 6; // corresponding to 6 sides of a 3D box: [-y, +y, -x, +x, -z, +z]
export const NUM_VOXEL_QUADS_PER_VOXEL =
    (NUM_VOXEL_QUADS_PER_COLLISION_LAYER * NUM_COLLISION_LAYERS) + 2; // 2 is for the floor and ceiling quads, which sit outside of the collision layers (They belong to "COLLISION_LAYER_NULL").

// Quads per room; bounds quadIndex. The signal field carrying quadIndex must hold this range (an overflow
// would silently clamp onto the wrong quad); tests assert it.
export const NUM_VOXEL_QUADS_PER_ROOM = NUM_VOXEL_QUADS_PER_VOXEL * NUM_VOXEL_ROWS * NUM_VOXEL_COLS; // 401408

// Worst-case encoded grid size (a fully solid room), for sizing the encoding buffer (see EncodingUtil).
export const MAX_ENCODED_VOXEL_GRID_BYTES = 1 /* format version */ +
    NUM_VOXEL_ROWS * NUM_VOXEL_COLS *
        (2 /* floor and ceiling quads */ + 2 /* collision layer mask */ +
            NUM_VOXEL_QUADS_PER_COLLISION_LAYER * NUM_COLLISION_LAYERS);

// Upper bound on simultaneously visible quads (the voxel mesh's size; see VoxelQuadInstanceUtil): one per
// solid/open boundary, so no room layout can exceed it.
export const MAX_VISIBLE_VOXEL_QUADS_PER_ROOM =
    (NUM_COLLISION_LAYERS + 1) * NUM_VOXEL_ROWS * NUM_VOXEL_COLS +
    (NUM_VOXEL_COLS - 1) * NUM_VOXEL_ROWS * NUM_COLLISION_LAYERS +
    (NUM_VOXEL_ROWS - 1) * NUM_VOXEL_COLS * NUM_COLLISION_LAYERS; // 198656

// Room Population

// Population bands for hub balancing: at or above over = crowded (route elsewhere); at or below under =
// fill before others; in between = medium.
export const ROOM_OVER_POPULATION_THRESHOLD = 50;
export const ROOM_UNDER_POPULATION_THRESHOLD = 20;

// Reserve below the player cap; rooms stop admitting at cap minus this (covers in-flight joins).
export const ROOM_ALMOST_FULL_MARGIN = 4;

// Gameplay

// Where a generated room's entrance door stands, in world units: the middle of its foot, on the room's side of
// the boundary wall (admins may move it later, so don't read this as the current entrance).
export const INITIAL_MULTI_PLAYER_ENTRANCE_POS: Vec3 =
    {x: 16.5, y: 0, z: MAX_ROOM_Z - GENERATED_WALL_THICKNESS * VOXEL_CELL_SIZE};

// UI

export const PAGE_NAME_MAP = {
    "index": "Home", // static
    "arcade": "Arcade", // static
    "library": "Blog", // static
    "portfolio": "Portfolio", // static
};