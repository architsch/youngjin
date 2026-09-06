import * as THREE from "three";
import { COLLISION_LAYER_HEIGHT } from "../../shared/system/sharedConstants";
import VoxelBlockOffset from "../../shared/voxel/types/voxelBlockOffset";

// Pointer interaction

// Max pointer movement (in CSS pixels) between pointerdown and pointerup for the gesture to still
// count as a click rather than a drag. A physical distance, so the same slip of the hand is
// tolerated on every screen shape.
//
// A finger is a far coarser pointer than a mouse: it covers an area rather than a point, it pivots
// while it presses, and its contact point wanders as it lifts. Holding touch to a mouse's precision
// makes an ordinary tap read as a drag, and the click that would have selected whatever was under
// it never happens — so touch is given a much more generous allowance than a mouse.
export const MOUSE_DRAG_THRESHOLD_PX = 8;
export const TOUCH_DRAG_THRESHOLD_PX = 40;

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

// The six directions light spreads in, block to block, and how far a step in each one travels
// through the world (see VoxelBlockOffset for why those are two different numbers). Kept in the
// order [-col, +col, -row, +row, -layer, +layer], which the arrival direction stored per block is an
// index into.
export const VOXEL_BLOCK_NEIGHBOR_OFFSETS: readonly VoxelBlockOffset[] = [
    { rowOffset:  0, colOffset: -1, collisionLayerOffset:  0, worldDistance: 1 },
    { rowOffset:  0, colOffset: +1, collisionLayerOffset:  0, worldDistance: 1 },
    { rowOffset: -1, colOffset:  0, collisionLayerOffset:  0, worldDistance: 1 },
    { rowOffset: +1, colOffset:  0, collisionLayerOffset:  0, worldDistance: 1 },
    { rowOffset:  0, colOffset:  0, collisionLayerOffset: -1, worldDistance: COLLISION_LAYER_HEIGHT },
    { rowOffset:  0, colOffset:  0, collisionLayerOffset: +1, worldDistance: COLLISION_LAYER_HEIGHT },
];

// How close to a light a block may be reckoned to be, in world units — half a block, which is to say
// a light is treated as a thing of some size rather than as a point.
//
// A point light's falloff runs to infinity at nothing, and the block a light stands in *is* at
// nothing: its centre is where the light is. Left alone it takes something like a hundred times what
// the block beside it takes, which is a spike no exposure can accommodate — the block clips to white,
// smoothing spreads the clipping to its neighbours, and everything in the room past those neighbours
// is left in the bottom of the range. A real lamp has a bulb and a shade and is not a point either.
export const LIGHT_SOURCE_MIN_DISTANCE = 0.5;

// The accumulated brightness that reaches the top of the light texture's range. Light brighter than
// this clips, so this is the exposure dial for the whole room: lower it and the room brightens and
// the areas around lamps flatten out, raise it and the room darkens and lamps keep their falloff.
// It exists because the texture holds bytes rather than floats (see LightBlockMap), while what
// accumulates into a block has no upper bound — several lamps can meet in one place.
//
// Set well above what lighting a room actually takes, so that a lamp turned up for effect has
// somewhere to go: at a ceiling only as high as an ordinary lamp, every bright lamp clips to the
// same white as every other and "brighter" stops meaning anything a few steps up the range. Raising
// it costs almost nothing — the texture stores the square root of the ratio (see LightBlockMap), so
// the precision it spends is taken from the bright end where it is not missed, rather than from the
// dark falloff where banding would show.
export const LIGHT_BLOCK_MAP_MAX_BRIGHTNESS = 16;

// How much of a lamp's contribution reaches a surface regardless of which way that surface faces.
// The rest is given only to surfaces turned toward where the light came from. Held well above zero
// because the propagation carries no bounce: a wall facing away from the room's only lamp would
// otherwise be as black as one in a sealed box, where in a real room it is lit by everything the
// lamp is shining at.
export const LIGHT_BLOCK_MAP_AMBIENT_SHARE = 0.45;