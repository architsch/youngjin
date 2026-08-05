import App from "../../app";
import AABB3 from "../../../shared/math/types/aabb3";
import PhysicsColliderStateUtil from "../../../shared/physics/util/physicsColliderStateUtil";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import { cameraModeObservable, objectSelectionObservable, userRoleObservable,
    voxelQuadSelectionObservable } from "../../system/clientObservables";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y } from "../../../shared/system/sharedConstants";
import ObjectSelection from "../types/gizmo/objectSelection";
import VoxelQuadSelection from "../types/gizmo/voxelQuadSelection";

// What an object with no collider of its own is framed by, so that selecting one still gives the
// camera something of a size to orbit around.
const defaultObjectHalfSize = {x: 0.5, y: 0.5, z: 0.5};

// How far back the camera sits from a selection, at the least. A block or a picture is small, and
// framing one by its own size alone leaves it filling the screen with nothing around it — which is
// the wrong view for something being edited in place, where the wall it belongs to and the room it
// stands in are what the edit is judged against. On a screen held upright, where the narrow side of
// the view governs, this is roughly the distance at which a few cells of the room fit across.
const minSelectionOrbitDistance = 5;

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