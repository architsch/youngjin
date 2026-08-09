import * as THREE from "three";
import App from "../../app";
import AABB3 from "../../../shared/math/types/aabb3";
import GraphicsManager from "../graphicsManager";
import PhysicsColliderStateUtil from "../../../shared/physics/util/physicsColliderStateUtil";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import { cameraModeObservable, objectSelectionObservable, userRoleObservable,
    voxelQuadSelectionObservable } from "../../system/clientObservables";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y,
    MAX_WORLDSPACE_SELECT_DIST } from "../../../shared/system/sharedConstants";
import ObjectSelection from "../types/gizmo/objectSelection";
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

export default class WorldSpaceSelectionUtil
{
    static isAnythingSelected(): boolean
    {
        return VoxelQuadSelection.isSelected() || ObjectSelection.isSelected();
    }

    static unselectAll()
    {
        VoxelQuadSelection.unselect();
        ObjectSelection.unselect();
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

// How far the camera currently stands from the selection it is orbiting, or zero whenever it is not
// orbiting one — including when something else (the character customization form) has the camera
// orbiting a target of its own, which says nothing about how far the user can reach.
function getSelectionOrbitDist(): number
{
    const mode = cameraModeObservable.peek();
    if (mode.type !== "orbit" || mode.target !== orbitTargetFromSelection)
        return 0;

    GraphicsManager.getCamera().getWorldPosition(cameraPosTemp);
    return Math.hypot(
        cameraPosTemp.x - mode.target.center.x,
        cameraPosTemp.y - mode.target.center.y,
        cameraPosTemp.z - mode.target.center.z);
}

// The orbit this module put the camera into, while it is still the one in effect. Kept so that a
// selection gives the camera back only what it took: while something else (the character
// customization form) has the camera orbiting around a target of its own, a selection coming or
// going has no say over the camera mode.
let orbitTargetFromSelection: AABB3 | undefined;

// A selection takes the camera into an orbit around whatever was selected, so that it can be
// inspected — and edited — from any angle; dropping the selection returns the camera to the
// first-person view. Both selection kinds are read here rather than in either one's own listener,
// since one selection replacing the other is two changes, and only their outcome matters.
function syncCameraModeWithSelection(): void
{
    const mode = cameraModeObservable.peek();
    if (mode.type === "orbit" && mode.target !== orbitTargetFromSelection)
        return;

    const target = getSelectionOrbitTarget();

    // A selection announced again without having moved (an edit to the selected object re-announces
    // it, so that the menu showing it reads the new value) leaves the camera alone: pointing it at
    // the very same volume would frame an orbit it is already in, and cut short the glide into that
    // orbit if one were still under way.
    if (mode.type === "orbit" && target && targetsMatch(mode.target, target))
        return;

    if (target)
        cameraModeObservable.set({type: "orbit", target, minDistance: minSelectionOrbitDistance});
    else if (mode.type === "orbit")
        cameraModeObservable.set({type: "firstPerson"});
    orbitTargetFromSelection = target ?? undefined;
}

function targetsMatch(a: AABB3, b: AABB3): boolean
{
    return a.center.x == b.center.x && a.center.y == b.center.y && a.center.z == b.center.z &&
        a.halfSize.x == b.halfSize.x && a.halfSize.y == b.halfSize.y && a.halfSize.z == b.halfSize.z;
}

// The volume the camera orbits around while something is selected: the whole voxel block the
// selected quad belongs to (or the room's floor/ceiling tile, which belongs to no block), or the
// selected object's own volume. Both are taken from the physics side, which is where the volume
// that every other system means by "this block" or "this object" is already defined.
function getSelectionOrbitTarget(): AABB3 | null
{
    const room = App.getCurrentRoom();

    // Circling a selection is a room-editing convenience, and the control of the camera (and of the
    // player, who stands still meanwhile) that it takes over is a high price for a user who has
    // nothing to edit: a visitor keeps the ordinary first-person view of whatever he selects.
    if (!room || !RoomValidationUtil.canUserEditRoom(userRoleObservable.peek(), room))
        return null;

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
            return {
                center: {x: voxel.col + 0.5, y: (orientation == "+") ? 0 : MAX_ROOM_Y, z: voxel.row + 0.5},
                halfSize: {x: 0.5, y: 0, z: 0.5},
            };
        }
        return PhysicsColliderStateUtil.getVoxelBlockColliderState(
            voxel.row, voxel.col, collisionLayer).hitbox;
    }

    const objectSelection = objectSelectionObservable.peek();
    if (objectSelection)
    {
        const gameObject = objectSelection.gameObject;
        const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
            gameObject.params.objectTypeIndex, gameObject.position, gameObject.direction);
        return colliderState ? colliderState.hitbox : {
            center: {x: gameObject.position.x, y: gameObject.position.y, z: gameObject.position.z},
            halfSize: defaultObjectHalfSize,
        };
    }
    return null;
}

voxelQuadSelectionObservable.addListener("worldSpaceSelectionUtil", syncCameraModeWithSelection);
objectSelectionObservable.addListener("worldSpaceSelectionUtil", syncCameraModeWithSelection);