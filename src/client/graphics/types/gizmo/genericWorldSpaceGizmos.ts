import * as THREE from "three";
import GraphicsManager from "../../graphicsManager";
import WorldSpaceArrow from "../../../ui/components/basic/worldspace/worldSpaceArrow";
import WorldSpaceOutlineRect from "../../../ui/components/basic/worldspace/worldSpaceOutlineRect";
import VoxelQuadSelection from "./voxelQuadSelection";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import { downwardArrowTargetObservable, navigationArrowTargetObservable, roomChangedObservable, updateObservable, voxelQuadHighlightObservable } from "../../../system/clientObservables";

// Drives the world-space "attention" gizmos used by the single-player tutorial:
//   - a navigation arrow that floats in front of the player and points toward a destination,
//   - a downward arrow that hovers above a target and bobs to draw the eye,
//   - a rectangular outline that highlights a voxel-quad with an oscillating brightness.
// Each gizmo is shown/hidden by its observable; per-frame animation runs off updateObservable.

const GIZMO_COLOR = "#ffe14d";

// Navigation arrow: floats in front of where the player is looking and points at the target.
const NAV_DISTANCE = 3; // distance in front of the player (in the XZ plane)
const NAV_HEIGHT = 1;   // world-space y the arrow floats at
const NAV_SCALE = 3;

// Downward arrow: hovers above the target, points straight down, and bobs up and down.
const DOWN_SCALE = 3;
const DOWN_BASE_OFFSET = 0.7; // base height above the target
const DOWN_BOB_AMPLITUDE = 0.15;
const DOWN_BOB_SPEED = 4; // radians per second

// Voxel-quad outline: brightness oscillates to grab attention.
const OUTLINE_MIN_BRIGHTNESS = 0.4;
const OUTLINE_PULSE_SPEED = 4; // radians per second

let navArrow: WorldSpaceArrow | null = null;
let downArrow: WorldSpaceArrow | null = null;
let outlineRect: WorldSpaceOutlineRect | null = null;
let initPromise: Promise<void> | null = null;

let navTarget: { x: number, z: number } | null = null;
let downTarget: THREE.Vector3 | null = null;
let elapsed = 0;

const camPos = new THREE.Vector3();
const camForward = new THREE.Vector3();
const arrowPos = new THREE.Vector3();
const arrowDir = new THREE.Vector3();
const outlinePos = new THREE.Vector3();
const outlineDir = new THREE.Vector3();
const outlineScale = new THREE.Vector3();

function ensureInitialized(): Promise<void>
{
    if (!initPromise)
    {
        initPromise = (async () => {
            const scene = GraphicsManager.getScene();

            navArrow = await WorldSpaceArrow.create("+z", GIZMO_COLOR, NAV_SCALE, false);
            navArrow.addToParent(scene);
            navArrow.setVisible(false);

            downArrow = await WorldSpaceArrow.create("-y", GIZMO_COLOR, DOWN_SCALE, false);
            downArrow.addToParent(scene);
            downArrow.setVisible(false);

            outlineRect = await WorldSpaceOutlineRect.create(GIZMO_COLOR);
            outlineRect.addToParent(scene);
        })();
    }
    return initPromise;
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
    downArrow?.setVisible(target != null);
});

voxelQuadHighlightObservable.addListener("genericWorldSpaceGizmos", async (selection: VoxelQuadSelection | null) => {
    await ensureInitialized();
    if (!outlineRect)
        return;

    if (selection)
    {
        const d = VoxelQueryUtil.getVoxelQuadTransformDimensions(selection.voxel, selection.quadIndex);
        outlinePos.set(selection.voxel.col + 0.5 + d.offsetX, d.offsetY, selection.voxel.row + 0.5 + d.offsetZ);
        outlineDir.set(d.dirX, d.dirY, d.dirZ);
        outlineScale.set(d.scaleX, d.scaleY, d.scaleZ);
        outlineRect.setTransform(outlinePos, outlineDir, outlineScale);
        outlineRect.setVisible(true);
    }
    else
    {
        outlineRect.setVisible(false);
    }
});

updateObservable.addListener("genericWorldSpaceGizmos", (deltaTime: number) => {
    elapsed += deltaTime;

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

    if (navArrow) { navArrow.dispose(); navArrow = null; }
    if (downArrow) { downArrow.dispose(); downArrow = null; }
    if (outlineRect) { outlineRect.dispose(); outlineRect = null; }
    initPromise = null;
});
