import * as THREE from "three";

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

// How long a confirm popup's Yes takes no click or key press once the popup comes up (in milliseconds; see
// ConfirmForm).
export const CONFIRM_ARMING_DELAY_MS = 500;

// Whether the image chooser offers its category tabs (see ImageMapThumbnailPanel). False hides them, and every
// image is shown as if All were picked.
export const IMAGE_CATEGORY_TABS_ENABLED = true;

// Whether an admin can rearrange the image chooser's thumbnails by hand, holding one and dragging it along the row
// (see ImageMapThumbnailPanel). False leaves every row as its map lists it, for an admin as for everyone else.
export const IMAGE_THUMBNAIL_REORDER_ENABLED = true;

// Whether an admin can set the categories an image is filed under, in a bar that comes up over the image chooser
// once one of its thumbnails is picked up (see ImageCategoryBar). False leaves every image under those built in.
export const IMAGE_CATEGORY_EDIT_ENABLED = true;

// Whether an admin can add, rename and delete the image chooser's categories, with the buttons beside its category
// tabs (see ImageMapThumbnailPanel). False leaves the categories as those built in.
export const IMAGE_CATEGORY_TAB_EDIT_ENABLED = true;

// How long a thumbnail is held still before it is picked up (in milliseconds; see useThumbnailReorder). A quicker
// drag scrolls the row instead, and a quicker release is a click.
export const THUMBNAIL_REORDER_HOLD_MS = 300;

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

// Minimum light distance: treats lights as having size (three quarters of a block), since point falloff
// near the light would spike and clip.
export const LIGHT_SOURCE_MIN_DISTANCE = 0.75;

// Brightness mapped to the top of the light texture's range (the room's exposure). Set high so bright
// lamps have headroom; the sqrt encoding (see LightBlockMap) takes that precision from the bright end.
export const LIGHT_BLOCK_MAP_MAX_BRIGHTNESS = 16;

// Share of lamp light that reaches surfaces regardless of facing; stands in for missing bounce light.
export const LIGHT_BLOCK_MAP_AMBIENT_SHARE = 0.45;