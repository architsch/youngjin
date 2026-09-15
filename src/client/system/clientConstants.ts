import * as THREE from "three";
import { COLLISION_LAYER_HEIGHT } from "../../shared/system/sharedConstants";
import VoxelBlockOffset from "../../shared/voxel/types/voxelBlockOffset";

// Pointer interaction

// Max pointer travel (CSS px) for a click rather than a drag. Touch gets a larger allowance, since
// finger contact points wander.
export const MOUSE_DRAG_THRESHOLD_PX = 4;
export const TOUCH_DRAG_THRESHOLD_PX = 30;

// Edit mode

// How far edit mode looks for something to open on, and how far toward the ground it tilts its look
// when nothing is within reach straight ahead (see GameModeUtil).
export const EDIT_MODE_OPENING_REACH = 8;
export const EDIT_MODE_OPENING_TILT = THREE.MathUtils.degToRad(15);

// UI

// How long a notification message stays on screen (in milliseconds).
export const NOTIFICATION_DURATION_MS = 3000;

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