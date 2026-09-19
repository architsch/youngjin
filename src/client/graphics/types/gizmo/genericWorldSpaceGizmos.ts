import * as THREE from "three";
import GraphicsManager from "../../graphicsManager";
import WorldSpaceArrow from "./generic/worldSpaceArrow";
import WorldSpaceSpriteArrow from "./generic/worldSpaceSpriteArrow";
import WorldSpaceOutlineRect from "./generic/worldSpaceOutlineRect";
import VoxelQuadSelection from "./voxelQuadSelection";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import CameraUtil from "../../util/cameraUtil";
import { downwardArrowTargetObservable, navigationArrowTargetObservable, roomChangedObservable, updateObservable, voxelQuadHighlightObservable } from "../../../system/clientObservables";

const GIZMO_COLOR = "#ffe14d";

// Navigation arrow: floats in front of where the player is looking and points at the target.
const NAV_DISTANCE = 3; // distance in front of the player (in the XZ plane)
const NAV_HEIGHT = 1;   // world-space y the arrow floats at
const NAV_SCALE = 1.4;

// Downward arrow: hovers above the target, points straight down, and bobs up and down vigorously.
const DOWN_SCALE = 3;
const DOWN_BASE_OFFSET = 0.9; // base height above the target
const DOWN_BOB_AMPLITUDE = 0.3;
const DOWN_BOB_SPEED = 7.5; // radians per second

// Voxel-quad outline: brightness oscillates dramatically and rapidly to grab attention. Drawn tight to
// the quad rather than padded, since it is saying which quad this is rather than how far it reaches.
const OUTLINE_MIN_BRIGHTNESS = 0.08;
const OUTLINE_PULSE_SPEED = 8; // radians per second

let navArrow: WorldSpaceSpriteArrow | null = null;
let downArrow: WorldSpaceArrow | null = null;
let outlineRect: WorldSpaceOutlineRect | null = null;
let initPromise: Promise<void> | null = null;

let navTarget: { x: number, z: number } | null = null;
let downTarget: THREE.Vector3 | null = null;
let outlineTarget: VoxelQuadSelection | null = null;
let elapsed = 0;

const camPos = new THREE.Vector3();
const camForward = new THREE.Vector3();
const arrowPos = new THREE.Vector3();
const arrowDir = new THREE.Vector3();
// The marked face's middle and outward normal, kept for the sight test (see refreshMarkVisibility).
const outlinePos = new THREE.Vector3();
const outlineDir = new THREE.Vector3();
const outlineScale = new THREE.Vector3();
const sightRayTemp = new THREE.Vector3();

function ensureInitialized(): Promise<void>
{
    if (!initPromise)
    {
        initPromise = (async () => {
            const scene = GraphicsManager.getScene();

            navArrow = await WorldSpaceSpriteArrow.create(GIZMO_COLOR, NAV_SCALE);
            navArrow.addToParent(scene);
            navArrow.setVisible(false);

            downArrow = await WorldSpaceArrow.create("-y", GIZMO_COLOR, DOWN_SCALE, false);
            downArrow.addToParent(scene);
            downArrow.setVisible(false);

            outlineRect = await WorldSpaceOutlineRect.create(GIZMO_COLOR, false);
            outlineRect.addToParent(scene);
        })();
    }
    return initPromise;
}

// Creates the gizmos ahead of time so the loading screen precompiles their shaders (which also covers
// selection outlines and move arrows, as they share materials). Idempotent.
export async function preloadGenericWorldSpaceGizmos(): Promise<void>
{
    await ensureInitialized();
}

// --- Observable listeners ---

navigationArrowTargetObservable.addListener("genericWorldSpaceGizmos", async (target: { x: number, z: number } | null) => {
    await ensureInitialized();
    navTarget = target;
    navArrow?.setVisible(target != null);
});

downwardArrowTargetObservable.addListener("genericWorldSpaceGizmos", async (target: THREE.Vector3 | null) => {
    await ensureInitialized();
    downTarget = target;
    refreshMarkVisibility();
});

voxelQuadHighlightObservable.addListener("genericWorldSpaceGizmos", async (selection: VoxelQuadSelection | null) => {
    await ensureInitialized();
    if (!outlineRect)
        return;

    outlineTarget = selection;
    if (selection)
    {
        const d = VoxelQueryUtil.getVoxelQuadTransformDimensions(selection.voxel, selection.quadIndex);
        outlinePos.set(selection.voxel.col + 0.5 + d.offsetX, d.offsetY, selection.voxel.row + 0.5 + d.offsetZ);
        outlineDir.set(d.dirX, d.dirY, d.dirZ);
        outlineScale.set(d.scaleX, d.scaleY, d.scaleZ);
        outlineRect.setTransform(outlinePos, outlineDir, outlineScale);
    }
    refreshMarkVisibility();
});

updateObservable.addListener("genericWorldSpaceGizmos", (deltaTime: number) => {
    elapsed += deltaTime;

    // The camera moves without telling anyone, so the sight test is redone every frame.
    refreshMarkVisibility();

    if (navTarget && navArrow)
    {
        const camera = GraphicsManager.getCamera();
        camera.getWorldPosition(camPos);
        camera.getWorldDirection(camForward);
        camForward.y = 0;
        if (camForward.lengthSq() > 1e-6) // Skip while looking straight up/down (no XZ heading).
        {
            camForward.normalize();
            arrowPos.set(camPos.x + camForward.x * NAV_DISTANCE, NAV_HEIGHT, camPos.z + camForward.z * NAV_DISTANCE);
            navArrow.setPosition(arrowPos.x, arrowPos.y, arrowPos.z);

            arrowDir.set(navTarget.x - arrowPos.x, 0, navTarget.z - arrowPos.z);
            if (arrowDir.lengthSq() > 1e-6)
            {
                arrowDir.normalize();
                navArrow.setDirection(arrowDir);
            }
        }
    }

    if (downTarget && downArrow)
    {
        const bob = Math.sin(elapsed * DOWN_BOB_SPEED) * DOWN_BOB_AMPLITUDE;
        downArrow.setPosition(downTarget.x, downTarget.y + DOWN_BASE_OFFSET + bob, downTarget.z);
    }

    if (outlineRect && outlineRect.isVisible())
    {
        const brightness = OUTLINE_MIN_BRIGHTNESS +
            (1 - OUTLINE_MIN_BRIGHTNESS) * (0.5 + 0.5 * Math.sin(elapsed * OUTLINE_PULSE_SPEED));
        outlineRect.setBrightness(brightness);
    }
});

roomChangedObservable.addListener("genericWorldSpaceGizmos", (_roomRuntimeMemory: RoomRuntimeMemory) => {
    navTarget = null;
    downTarget = null;
    outlineTarget = null;

    if (navArrow) { navArrow.dispose(); navArrow = null; }
    if (downArrow) { downArrow.dispose(); downArrow = null; }
    if (outlineRect) { outlineRect.dispose(); outlineRect = null; }
    initPromise = null;
});

// The marks (the quad outline and the downward arrow) point out one face, and they draw on top of
// everything, so from the wrong side of a wall they would hang in the middle of it. They show only
// while that face is in sight: nothing drawn in between, and the camera on the face's own side of it.
// With no face marked out there is nothing to be on the wrong side of, and the arrow shows as it is.
function refreshMarkVisibility(): void
{
    if (downTarget == null && outlineTarget == null)
    {
        downArrow?.setVisible(false);
        outlineRect?.setVisible(false);
        return;
    }

    const inSight = (outlineTarget == null) || highlightedQuadIsInSight();
    downArrow?.setVisible(downTarget != null && inSight);
    outlineRect?.setVisible(outlineTarget != null && inSight);
}

// Both tests run against the marked face's own middle, which outlinePos and outlineDir hold.
function highlightedQuadIsInSight(): boolean
{
    GraphicsManager.getCamera().getWorldPosition(sightRayTemp);
    sightRayTemp.subVectors(outlinePos, sightRayTemp);
    // Facing first: it is the cheaper of the two, and it is what a swing around the wall breaks.
    if (sightRayTemp.dot(outlineDir) >= 0)
        return false; // Behind the face, which draws nothing on this side.
    return CameraUtil.pointIsInLineOfSight(outlinePos);
}
