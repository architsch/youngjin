import * as THREE from "three";
import AABB3 from "../../../shared/math/types/aabb3";
import GraphicsManager from "../graphicsManager";
import PhysicsColliderStateUtil from "../../../shared/physics/util/physicsColliderStateUtil";
import SelectionKind from "../types/gizmo/selectionKind";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import { cameraModeObservable, gameModeObservable, objectSelectionObservable,
    playerSelectionObservable, voxelQuadSelectionObservable } from "../../system/clientObservables";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y,
    MAX_WORLDSPACE_SELECT_DIST } from "../../../shared/system/sharedConstants";
import ObjectSelection from "../types/gizmo/objectSelection";
import PlayerSelection from "../types/gizmo/playerSelection";
import VoxelQuadSelection from "../types/gizmo/voxelQuadSelection";

const cameraPosTemp = new THREE.Vector3();

// What an object with no collider of its own is framed by, so that selecting one still gives the
// camera something of a size to orbit around.
const defaultObjectHalfSize = {x: 0.5, y: 0.5, z: 0.5};

// How far back the camera sits from a selection, at the least. A block or a picture is small, and
// framing one by its own size alone leaves it filling the screen with nothing around it — which is
// the wrong view for something being edited in place, where the wall it belongs to and the room it
// stands in are what the edit is judged against. On a screen held upright, where the narrow side of
// the view governs, this is roughly the distance at which a few cells of the room fit across.
const minSelectionOrbitDistance = 5;

// How far the user may reach to select something while the camera orbits a selection, as a multiple
// of how far the camera stands from that selection. The margin above 1 covers what lies around the
// edges of the view rather than at its center, which is further from the camera than the selection
// it is arranged around.
const selectReachPerOrbitDistance = 1.6;

//------------------------------------------------------------------------
// What the user currently has picked out in the room, and where the camera stands in answer to it.
//
// Only one thing is ever selected — a voxel-quad, an object, or the user's own character — so each
// kind hands the other two over to this module as it takes the selection for itself.
//
// What a selection *means* is a matter of which mode the user is in (see GameModeUtil): during play
// mode it is a way of looking at something, while edit mode is what gives the camera over to it.
// So the camera is pointed from here rather than from any one selection's own listener, since one
// selection replacing another is two changes and only their outcome matters.
//------------------------------------------------------------------------

export default class WorldSpaceSelectionUtil
{
    static isAnythingSelected(): boolean
    {
        return VoxelQuadSelection.isSelected() || ObjectSelection.isSelected() ||
            PlayerSelection.isSelected();
    }

    static unselectAll(force: boolean = false)
    {
        VoxelQuadSelection.unselect(force);
        ObjectSelection.unselect(force);
        PlayerSelection.unselect(force);
    }

    // Drops every selection but the named one, which is what each kind calls upon becoming the
    // selection. Forced, since this is not the user giving a selection up but it being replaced:
    // a scripted step holding one in place has no say over what the user picks instead of it.
    static unselectOthers(keptSelection: SelectionKind): void
    {
        if (keptSelection != "voxelQuad" && VoxelQuadSelection.isSelected())
            VoxelQuadSelection.unselect(true);
        if (keptSelection != "object" && ObjectSelection.isSelected())
            ObjectSelection.unselect(true);
        if (keptSelection != "player" && PlayerSelection.isSelected())
            PlayerSelection.unselect(true);
    }

    // How far into the room the user may reach to select something, measured from the camera to the
    // point he clicked.
    //
    // Ordinarily this is an arm's reach into the room, a fixed distance that stops a click from
    // picking out something across the room that the user can barely make out. But an orbit around
    // a selection is the user's to move: he may pull the camera right back to see what he is
    // editing among its surroundings, and everything he has thereby brought into view is something
    // he expects to be able to click. So while the camera orbits a selection, the reach grows in
    // step with how far back the camera has been taken, and whatever the user can see he can select.
    static getMaxSelectDist(): number
    {
        return Math.max(MAX_WORLDSPACE_SELECT_DIST,
            selectReachPerOrbitDistance * getSelectionOrbitDist());
    }
}

// How far the camera currently stands from what it is orbiting, or zero whenever it is not
// orbiting anything.
function getSelectionOrbitDist(): number
{
    const mode = cameraModeObservable.peek();
    if (mode.type !== "orbit")
        return 0;

    GraphicsManager.getCamera().getWorldPosition(cameraPosTemp);
    return Math.hypot(
        cameraPosTemp.x - mode.target.center.x,
        cameraPosTemp.y - mode.target.center.y,
        cameraPosTemp.z - mode.target.center.z);
}

// Points the camera at whatever is currently selected, for as long as edit mode lasts.
function syncCameraModeWithSelection(): void
{
    const framing = getSelectionOrbitFraming();
    const mode = cameraModeObservable.peek();

    if (!framing)
    {
        if (mode.type === "orbit")
            cameraModeObservable.set({type: "firstPerson"});
        return;
    }

    // A selection announced again without having moved (an edit to the selected object re-announces
    // it, so that the menu showing it reads the new value) leaves the camera alone: pointing it at
    // the very same volume would frame an orbit it is already in, and cut short the glide into that
    // orbit if one were still under way.
    if (mode.type === "orbit" && targetsMatch(mode.target, framing.target))
        return;

    cameraModeObservable.set({type: "orbit", ...framing});
}

function targetsMatch(a: AABB3, b: AABB3): boolean
{
    return a.center.x == b.center.x && a.center.y == b.center.y && a.center.z == b.center.z &&
        a.halfSize.x == b.halfSize.x && a.halfSize.y == b.halfSize.y && a.halfSize.z == b.halfSize.z;
}

// The volume the camera should orbit around, and how far back it should stand from it at the least;
// null whenever the camera has no business orbiting anything.
//
// Outside edit mode there is nothing to frame, however much is selected: a click on the scenery
// during play mode is not an edit, and must not take the run of the room away from the user (which
// is what an orbit does, the player standing still throughout).
function getSelectionOrbitFraming(): {target: AABB3, minDistance?: number} | null
{
    if (gameModeObservable.peek() != "edit")
        return null;

    const playerSelection = playerSelectionObservable.peek();
    if (playerSelection)
    {
        const gameObject = playerSelection.gameObject;
        const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
            gameObject.params.objectTypeIndex, gameObject.position, gameObject.direction);
        // The center is the character's own position vector rather than a copy of it, so the orbit
        // keeps it in frame even if something nudges it meanwhile. A character is looked at for its
        // own sake rather than for where it stands, so its own size alone decides the distance.
        return {target: {
            center: gameObject.position,
            halfSize: colliderState ? colliderState.hitbox.halfSize : defaultObjectHalfSize,
        }};
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
            }, minDistance: minSelectionOrbitDistance};
        }
        return {target: PhysicsColliderStateUtil.getVoxelBlockColliderState(
            voxel.row, voxel.col, collisionLayer).hitbox, minDistance: minSelectionOrbitDistance};
    }

    const objectSelection = objectSelectionObservable.peek();
    if (objectSelection)
    {
        const gameObject = objectSelection.gameObject;
        const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
            gameObject.params.objectTypeIndex, gameObject.position, gameObject.direction);
        return {target: colliderState ? colliderState.hitbox : {
            center: {x: gameObject.position.x, y: gameObject.position.y, z: gameObject.position.z},
            halfSize: defaultObjectHalfSize,
        }, minDistance: minSelectionOrbitDistance};
    }

    // In edit mode with nothing picked out, the camera holds the view it already has. This is the
    // moment between one selection being dropped and the next taking its place — adding a block
    // moves the selection onto what was just built — and a camera that answered it would swing away
    // and back again for no reason, while the mode itself never wavered. It is also the instant the
    // mode opens in, before its first selection has landed, where the view to hold is the
    // first-person one the user is still standing in.
    const mode = cameraModeObservable.peek();
    return (mode.type === "orbit")
        ? {target: mode.target, minDistance: mode.minDistance}
        : null;
}

voxelQuadSelectionObservable.addListener("worldSpaceSelectionUtil", syncCameraModeWithSelection);
objectSelectionObservable.addListener("worldSpaceSelectionUtil", syncCameraModeWithSelection);
playerSelectionObservable.addListener("worldSpaceSelectionUtil", syncCameraModeWithSelection);

// The mode the user is in decides what a selection is worth to the camera, so a change of mode is a
// change of framing even when the selection under it stayed exactly as it was.
gameModeObservable.addListener("worldSpaceSelectionUtil", syncCameraModeWithSelection);
