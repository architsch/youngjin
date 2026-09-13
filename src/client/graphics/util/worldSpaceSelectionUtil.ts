import AABB3 from "../../../shared/math/types/aabb3";
import PhysicsColliderStateUtil from "../../../shared/physics/util/physicsColliderStateUtil";
import SelectionKind from "../types/gizmo/selectionKind";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import { cameraModeObservable, gameModeObservable, objectSelectionObservable,
    orbitCameraTargetOverrideObservable,
    voxelQuadSelectionObservable } from "../../system/clientObservables";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y } from "../../../shared/system/sharedConstants";
import ObjectSelection from "../types/gizmo/objectSelection";
import VoxelQuadSelection from "../types/gizmo/voxelQuadSelection";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import ObjectHit from "../types/objectHit";

const voxelTypeIndex = ObjectTypeConfigMap.getIndexByType("Voxel");

// Framing size for collider-less objects.
const defaultObjectHalfSize = {x: 0.5, y: 0.5, z: 0.5};

// A bare point has no extent; the minimum distance decides the framing.
const pointTargetHalfSize = {x: 0, y: 0, z: 0};

// Minimum orbit distance for in-place edits, so the surrounding wall and room stay in view.
const SELECTION_ORBIT_MIN_DISTANCE = 5;

// The current selection (one voxel quad or one object) and the camera's response to it. The camera
// is pointed from here, not per selection, because replacing a selection is two changes and only the
// outcome matters.

export default class WorldSpaceSelectionUtil
{
    static isAnythingSelected(): boolean
    {
        return VoxelQuadSelection.isSelected() || ObjectSelection.isSelected();
    }

    static unselectAll(force: boolean = false)
    {
        VoxelQuadSelection.unselect(force);
        ObjectSelection.unselect(force);
    }

    // Called by a kind when it takes the selection. Forced: replacement overrides scripted locks.
    static unselectOthers(keptSelection: SelectionKind): void
    {
        if (keptSelection != "voxelQuad" && VoxelQuadSelection.isSelected())
            VoxelQuadSelection.unselect(true);
        if (keptSelection != "object" && ObjectSelection.isSelected())
            ObjectSelection.unselect(true);
    }

    // Selects the first voxel quad or object along a line of sight (nearest first) that can be selected.
    // Refusing objects (e.g. another player) are looked past; a refusing quad ends the search, since a
    // room surface hides what lies behind it.
    static trySelectInLineOfSight(lineOfSight: ObjectHit[]): boolean
    {
        for (const {gameObject, instanceId} of lineOfSight)
        {
            // Selects the quad for a voxel, or the object itself (see GameObject.trySelect).
            if (gameObject.trySelect(instanceId))
                return true;

            const isVoxelQuad = gameObject.params.objectTypeIndex == voxelTypeIndex;
            if (isVoxelQuad)
                return false;
        }
        return false;
    }
}

// Points the camera at whatever is currently selected, for as long as edit mode lasts.
function syncCameraModeWithSelection(): void
{
    const framing = getSelectionOrbitFraming();
    const mode = cameraModeObservable.peek();

    // A free camera belongs to whoever set that mode; selections don't move it.
    if (mode.type === "free")
        return;

    if (!framing)
    {
        if (mode.type === "orbit")
            cameraModeObservable.set({type: "firstPerson"});
        return;
    }

    // A re-announced but unmoved selection (e.g. after a metadata edit) keeps the current orbit, so
    // an in-progress glide isn't cut short.
    if (mode.type === "orbit" && targetsMatch(mode.target, framing.target))
        return;

    cameraModeObservable.set({type: "orbit", ...framing});
}

function targetsMatch(a: AABB3, b: AABB3): boolean
{
    return a.center.x == b.center.x && a.center.y == b.center.y && a.center.z == b.center.z &&
        a.halfSize.x == b.halfSize.x && a.halfSize.y == b.halfSize.y && a.halfSize.z == b.halfSize.z;
}

// Orbit target and minimum distance, or null outside edit mode (play-mode clicks never orbit).
function getSelectionOrbitFraming(): {target: AABB3, minDistance?: number} | null
{
    if (gameModeObservable.peek() != "edit")
        return null;

    // A scripted step's target override outranks the selection, framed like a point.
    const targetOverride = orbitCameraTargetOverrideObservable.peek();
    if (targetOverride)
    {
        return {target: {center: targetOverride, halfSize: pointTargetHalfSize},
            minDistance: SELECTION_ORBIT_MIN_DISTANCE};
    }

    const voxelQuadSelection = voxelQuadSelectionObservable.peek();
    if (voxelQuadSelection)
    {
        const voxel = voxelQuadSelection.voxel;
        const quadIndex = voxelQuadSelection.quadIndex;
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        {
            // The room's own floor or ceiling: a flat tile, carrying no thickness of its own.
            const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
            return {target: {
                center: {x: voxel.col + 0.5, y: (orientation == "+") ? 0 : MAX_ROOM_Y, z: voxel.row + 0.5},
                halfSize: {x: 0.5, y: 0, z: 0.5},
            }, minDistance: SELECTION_ORBIT_MIN_DISTANCE};
        }
        return {target: PhysicsColliderStateUtil.getVoxelBlockColliderState(
            voxel.row, voxel.col, collisionLayer).hitbox, minDistance: SELECTION_ORBIT_MIN_DISTANCE};
    }

    const objectSelection = objectSelectionObservable.peek();
    if (objectSelection)
    {
        const gameObject = objectSelection.gameObject;
        const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
            gameObject.params.objectTypeIndex, gameObject.position, gameObject.direction);
        // Uses the object's live position vector so the orbit follows it. Wall/floor-fixed objects
        // keep a minimum distance for context; rigidbodies (e.g. characters) are framed by size alone.
        const standsInTheRoom = colliderState?.colliderConfig.colliderType === "rigidbody";
        return {target: {
            center: gameObject.position,
            halfSize: colliderState ? colliderState.hitbox.halfSize : defaultObjectHalfSize,
        }, minDistance: standsInTheRoom ? 0 : SELECTION_ORBIT_MIN_DISTANCE};
    }

    // Edit mode with nothing selected (between selections, or as the mode opens): keep the current view.
    const mode = cameraModeObservable.peek();
    return (mode.type === "orbit")
        ? {target: mode.target, minDistance: mode.minDistance}
        : null;
}

voxelQuadSelectionObservable.addListener("worldSpaceSelectionUtil", syncCameraModeWithSelection);
objectSelectionObservable.addListener("worldSpaceSelectionUtil", syncCameraModeWithSelection);

// Mode changes and step overrides change framing even when the selection doesn't.
gameModeObservable.addListener("worldSpaceSelectionUtil", syncCameraModeWithSelection);
orbitCameraTargetOverrideObservable.addListener("worldSpaceSelectionUtil", syncCameraModeWithSelection);
