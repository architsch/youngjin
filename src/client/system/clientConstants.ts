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

// How fast the orbit camera's cone of sight widens: the radius it gains per unit of distance from the orbit's pivot,
// where its tip is, toward the camera, where it is widest. What reaches into the cone is hidden (see
// OrbitOcclusionHider), so a larger value clears more of the room from around the line of sight.
export const ORBIT_SIGHT_CONE_RADIUS_PER_DISTANCE = 0.3;

// True keeps a newly added object selected once its look is complete. False hands the selection to a face near it,
// for the next to be added from (see VoxelQuadPlacementOptions).
export const DISABLE_AUTO_SELECTION_ON_OBJECT_INSTALLATION = true;

// Where the selection tools show a sub-panel (an object's, see EditOptionsProps; a face's chooser, see
// VoxelQuadPlacementOptions). True shows it beneath the tool row, whose buttons toggle between panels that have no
// close button: an object's tools always show one, and a new object's carry on from the chooser it was picked in.
// False raises it in the tool row's place until it is closed. A new canvas's tools open on its frame list either way.
export const SUB_PANELS_BENEATH_SELECTION_TOOLS = true;

// The selection's outline, and what it and its handles turn while a drag of them is blocked (see
// selectionEditBlockedObservable).
export const SELECTION_COLOR = "#00ff00";
export const SELECTION_BLOCKED_COLOR = "#ff0000";

// How far from the camera a selection still has the handles that resize it (see SelectionEditGizmoUtil). They keep
// their size on screen while the selection shrinks, so further off they crowd it and can't be told apart to hold.
export const SELECTION_HANDLE_MAX_DISTANCE = 12;

// What an automatic selection asks of a voxel quad (see VoxelQuadSelection): to lie no further than this from where
// it looks, with at least this share of its face clear of attached objects. With no such quad, it takes an object
// within the same distance instead. The distance stops just short of the far side of a wall a world unit thick,
// as measured from the middle of the voxel before it.
export const AUTO_SELECTION_MAX_DISTANCE = 1.25;
export const AUTO_SELECTION_MIN_COVERAGE_FREE_RATIO = 0.5;

// How far from the selected object a movement key looks for another to select (see SelectionStepUtil). Measured
// between the two objects' boxes, not their middles, so that large ones hung side by side count as near.
export const SELECTION_STEP_OBJECT_REACH = 3;

// UI

// How long a notification message stays on screen (in milliseconds).
export const NOTIFICATION_DURATION_MS = 3000;

// How long a confirm popup's Yes takes no click or key press once the popup comes up (in milliseconds; see
// ConfirmForm).
export const CONFIRM_ARMING_DELAY_MS = 500;

// Whether the image chooser offers its category tabs (see ImageMapThumbnailPanel). False hides them, and every
// image is shown as if All were picked.
export const IMAGE_CATEGORY_TABS_ENABLED = true;

// How long a finger holds a tile still before it is lifted, to be rearranged (in milliseconds; see useGridReorder).
// A quicker drag scrolls its grid instead, and a quicker release is a click.
export const REORDER_HOLD_MS = 300;

// Voxels

// How wide a patch of the floor plan one VoxelGameObject owns the voxels of, in world units. Each is a
// node of the scene, walked every frame, so the room has a few hundred of them, not one per voxel.
export const VOXEL_GAME_OBJECT_SIZE_XZ = 2;

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

// Minimum light distance: treats lights as having size (a block and a half), since point falloff
// near the light would spike and clip.
export const LIGHT_SOURCE_MIN_DISTANCE = 0.75;

// The head light reads lamp light a region at a time (see LightBlockMap): a square of blocks this wide in
// world units, one layer high. It needs the light no finer, and what it reads is worked out for every one.
export const LIGHT_REGION_SIZE_XZ = 1;

// Brightness mapped to the top of the light texture's range (the room's exposure). Set high so bright
// lamps have headroom; the sqrt encoding (see LightBlockMap) takes that precision from the bright end.
export const LIGHT_BLOCK_MAP_MAX_BRIGHTNESS = 16;

// Share of lamp light that reaches surfaces regardless of facing; stands in for missing bounce light.
export const LIGHT_BLOCK_MAP_AMBIENT_SHARE = 0.45;