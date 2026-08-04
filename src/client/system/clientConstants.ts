import * as THREE from "three";

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
export const TOUCH_DRAG_THRESHOLD_PX = 24;

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