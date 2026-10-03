import * as THREE from "three";
import ImageMap from "../../shared/graphics/image/types/imageMap";
import { COLLISION_LAYER_HEIGHT } from "../../shared/system/sharedConstants";
import VoxelBlockOffset from "../../shared/voxel/types/voxelBlockOffset";

// Pointer interaction

// Max pointer travel (CSS px) for a click rather than a drag. Touch gets a larger allowance, since
// finger contact points wander.
export const MOUSE_DRAG_THRESHOLD_PX = 4;
export const TOUCH_DRAG_THRESHOLD_PX = 40;

// Edit mode

// How far edit mode looks for something to open on, and how far toward the ground it tilts its look
// when nothing is within reach straight ahead (see GameModeUtil).
export const EDIT_MODE_OPENING_REACH = 8;
export const EDIT_MODE_OPENING_TILT = THREE.MathUtils.degToRad(15);

// True keeps a newly added object selected once its look is complete. False hands the selection to a face near it,
// for the next to be added from (see VoxelQuadPlacementOptions).
export const DISABLE_AUTO_SELECTION_ON_OBJECT_INSTALLATION = true;

// What an automatic selection asks of a voxel quad (see VoxelQuadSelection): to lie no further than this from where
// it looks, with at least this share of its face clear of attached objects. With no such quad, it takes an object
// within the same distance instead.
export const AUTO_SELECTION_MAX_DISTANCE = 1.5;
export const AUTO_SELECTION_MIN_COVERAGE_FREE_RATIO = 0.5;

// UI

// How long a notification message stays on screen (in milliseconds).
export const NOTIFICATION_DURATION_MS = 3000;

// Whether the image chooser offers its category tabs (see ImageMapThumbnailPanel). False hides them, and every
// image is shown as if All were picked.
export const IMAGE_CATEGORY_TABS_ENABLED = true;

// The order the image chooser's All tab lays images out in, category by category (see ImageChoiceUtil); a category's
// own tab is not ordered by it. An image under several goes with the one listed last, and one under none with
// ImageMap.MISC_TAB; the images of a category left out come first, as one run.
export const IMAGE_ALL_TAB_CATEGORY_ORDER: readonly string[] = ["living", "kitchen", "bathroom", "office",
    "commercial", "industrial", "accessory", ImageMap.MISC_TAB];

// three.js

export const DIRECTION_VECTORS: {[key: string]: THREE.Vector3} = {
    "+x": new THREE.Vector3(1, 0, 0),
    "-x": new THREE.Vector3(-1, 0, 0),
    "+y": new THREE.Vector3(0, 1, 0),
    "-y": new THREE.Vector3(0, -1, 0),
    "+z": new THREE.Vector3(0, 0, 1),
    "-z": new THREE.Vector3(0, 0, -1),
};

// Lighting

// Light spread directions with world step lengths (see VoxelBlockOffset), in the order
// [-col, +col, -row, +row, -layer, +layer].
export const VOXEL_BLOCK_NEIGHBOR_OFFSETS: readonly VoxelBlockOffset[] = [
    { rowOffset:  0, colOffset: -1, collisionLayerOffset:  0, worldDistance: 1 },
    { rowOffset:  0, colOffset: +1, collisionLayerOffset:  0, worldDistance: 1 },
    { rowOffset: -1, colOffset:  0, collisionLayerOffset:  0, worldDistance: 1 },
    { rowOffset: +1, colOffset:  0, collisionLayerOffset:  0, worldDistance: 1 },
    { rowOffset:  0, colOffset:  0, collisionLayerOffset: -1, worldDistance: COLLISION_LAYER_HEIGHT },
    { rowOffset:  0, colOffset:  0, collisionLayerOffset: +1, worldDistance: COLLISION_LAYER_HEIGHT },
];

// Minimum light distance (half a block): treats lights as having size, since point falloff at the
// light's own block would spike and clip.
export const LIGHT_SOURCE_MIN_DISTANCE = 0.5;

// Brightness mapped to the top of the light texture's range (the room's exposure). Set high so bright
// lamps have headroom; the sqrt encoding (see LightBlockMap) takes that precision from the bright end.
export const LIGHT_BLOCK_MAP_MAX_BRIGHTNESS = 16;

// Share of lamp light that reaches surfaces regardless of facing; stands in for missing bounce light.
export const LIGHT_BLOCK_MAP_AMBIENT_SHARE = 0.45;