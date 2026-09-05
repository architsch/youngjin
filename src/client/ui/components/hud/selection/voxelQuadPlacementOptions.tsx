import { useEffect, useReducer } from "react";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import AddBlockIcon from "../../../svg/icons/addBlockIcon";
import AddCanvasIcon from "../../../svg/icons/addCanvasIcon";
import AddDoorIcon from "../../../svg/icons/addDoorIcon";
import App from "../../../../app";
import SocketsClient from "../../../../networking/client/socketsClient";
import ObjectTypeConfigMap from "../../../../../shared/object/maps/objectTypeConfigMap";
import VoxelQueryUtil from "../../../../../shared/voxel/util/voxelQueryUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../../../shared/networking/types/encodableByteString";
import ObjectUpdateUtil from "../../../../../shared/object/util/objectUpdateUtil";
import ObjectFactory from "../../../../object/factories/objectFactory";
import ClientObjectManager from "../../../../object/clientObjectManager";
import AddObjectSignal from "../../../../../shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../../../shared/object/types/removeObjectSignal";
import WallAttachedObjectUtil from "../../../../../shared/object/util/wallAttachedObjectUtil";
import ObjectTransform from "../../../../../shared/object/types/objectTransform";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import Vec3 from "../../../../../shared/math/types/vec3";
import ErrorUtil from "../../../../../shared/system/util/errorUtil";
import ImageMapUtil from "../../../../../shared/graphics/image/util/imageMapUtil";
import ClientVoxelManager from "../../../../voxel/clientVoxelManager";
import VoxelUpdateUtil from "../../../../../shared/voxel/util/voxelUpdateUtil";
import RemoveVoxelBlockSignal from "../../../../../shared/voxel/types/update/removeVoxelBlockSignal";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, DOOR_FOOTPRINT_HEIGHT, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER } from "../../../../../shared/system/sharedConstants";
import AddVoxelBlockSignal from "../../../../../shared/voxel/types/update/addVoxelBlockSignal";
import ObjectIdUtil from "../../../../../shared/object/util/objectIdUtil";
import { clientFeatureFlagsObservable, notificationMessageObservable, voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import Room from "../../../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import FTUEUtil from "../../../util/ftueUtil";
import PopupUtil from "../../../util/popupUtil";
import { FTUEElementCodeEnumMap } from "../../../types/ftueElementCode";
import NumUtil from "../../../../../shared/math/util/numUtil";
import RoomValidationUtil from "../../../../../shared/room/util/roomValidationUtil";
import { DoorTypeEnumMap } from "../../../../../shared/object/types/doorType";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");

let addCanvasButtonFTUETimeout: ReturnType<typeof setTimeout> | undefined;

// Feature flags whose toggling changes whether this menu's buttons are enabled.
const placementFeatureFlags = [
    FeatureFlag.DisableManualVoxelBlockAddition,
    FeatureFlag.DisableManualVoxelBlockRemoval,
    FeatureFlag.DisableManualObjectAddition,
];

export default function VoxelQuadPlacementOptions(props: {selection: VoxelQuadSelection})
{
    const [, forceRefresh] = useReducer((x: number) => x + 1, 0);

    // The buttons' enabled state is derived from the feature flags above, which can be toggled
    // at runtime (e.g. by the single-player tutorial). Re-render this menu — and only this menu,
    // not the whole UI — whenever one of those flags is added or removed.
    useEffect(() => {
        for (const flag of placementFeatureFlags)
            clientFeatureFlagsObservable.addElementListener("voxelQuadPlacementOptions", flag, forceRefresh);
        return () => {
            for (const flag of placementFeatureFlags)
                clientFeatureFlagsObservable.removeElementListener("voxelQuadPlacementOptions", flag);
        };
    }, []);

    const canAddCanvas = getPlaceableWallAttachedObjectTransform(
        props.selection, canvasTypeIndex) !== null;

    // Hanging a door is world-building rather than room-editing, so the option is only ever on offer
    // to an admin — and only in a room whose doors are his to lay (see RoomValidationUtil).
    const room = App.getCurrentRoom();
    const canManageDoors = room != undefined &&
        RoomValidationUtil.canUserManageDoors(App.getUser(), room);
    const canAddDoor = canManageDoors &&
        getPlaceableWallAttachedObjectTransform(props.selection, doorTypeIndex) !== null;

    useEffect(() => {
        clearFTUETimeouts();
        if (canAddCanvas && !FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.AddCanvas))
        {
            // If the user hasn't added any canvas yet,
            // we will show a coach mark which tells he user to try adding one.
            addCanvasButtonFTUETimeout = setTimeout(() => {
                FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.AddCanvas,
                    "addCanvasButton", "Hang a picture on this wall.");
            }, 750);
        }
        return () => {
            clearFTUETimeouts();
            // Cancelling the pending mark is not enough on its own: one that is already up stays up
            // until it is taken down, and the button it points at outlives the quad it was shown
            // for — it merely turns disabled when the selection moves to a quad that takes no
            // canvas, and it returns with the next selection after the menu closes. So the mark is
            // taken down along with the invitation that raised it, rather than being left to urge
            // the user towards a button that would do nothing.
            FTUEUtil.hideCoachMark(FTUEElementCodeEnumMap.AddCanvas);
        };
    }, [canAddCanvas]);

    return <div className="flex flex-row gap-4 p-2 w-fit pointer-events-auto overflow-hidden bg-gray-800 rounded-md yj-surface-convex">
        <IconButton id="removeVoxelBlockButton" icon={<TrashIcon/>} size="md" color="red"
            disabled={!canRemoveVoxelBlock(props.selection)}
            onClick={() => tryRemoveVoxelBlock(props.selection)}/>
        <IconButton id="addVoxelBlockButton" icon={<AddBlockIcon/>} size="md"
            disabled={!canAddVoxelBlock(props.selection)}
            onClick={() => tryAddVoxelBlock(props.selection)}/>
        <IconButton id="addCanvasButton" icon={<AddCanvasIcon/>} size="md"
            disabled={!canAddCanvas}
            onClick={() => {
                const randomImagePath = ImageMapUtil.getImageMap("CanvasImageMap").getRandomImagePath();
                const randomFrameCoords = ImageMapUtil.getImageMap("CanvasFrameImageMap").getRandomImagePath();
                tryAddObjectFromQuad(props.selection, canvasTypeIndex, {
                    [ObjectMetadataKeyEnumMap.ImagePath]: new EncodableByteString(randomImagePath),
                    [ObjectMetadataKeyEnumMap.CanvasFrameCoords]: new EncodableByteString(randomFrameCoords),
                });
                FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.AddCanvas);
            }}
        />
        {canManageDoors && <IconButton id="addDoorButton" icon={<AddDoorIcon/>} size="md"
            disabled={!canAddDoor}
            onClick={() => {
                // A door somebody has just hung leads nowhere and is not the room's own way in
                // until he says so — both of which he says through the door's own options.
                tryAddObjectFromQuad(props.selection, doorTypeIndex, {
                    [ObjectMetadataKeyEnumMap.DoorType]:
                        new EncodableByteString(`${DoorTypeEnumMap.CustomEntrance}`),
                });
            }}
        />}
    </div>;
}

function clearFTUETimeouts()
{
    if (addCanvasButtonFTUETimeout)
    {
        clearTimeout(addCanvasButtonFTUETimeout);
        addCanvasButtonFTUETimeout = undefined;
    }
}

// Where an object hung on the clicked wall would go, or null if it cannot go there at all.
//
// Everything but the height is the same question whatever is being hung: the cell the quad belongs
// to fixes the position across the wall, and the quad's own facing fixes which way the object looks.
// The height is the one thing that varies from one kind of object to the next, so it is asked for
// separately, and the first of the heights offered that the room will actually take is the answer.
function getPlaceableWallAttachedObjectTransform(selection: VoxelQuadSelection,
    objectTypeIndex: number): ObjectTransform | null
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualObjectAddition))
        return null;

    const room = App.getCurrentRoom();
    if (!room)
        return null;
    const user = App.getUser();

    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ } =
        VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, quadIndex);

    if (dirY != 0)
        return null; // a floor or a ceiling, which nothing hangs on

    const x = voxel.col + 0.5 + offsetX;
    const z = voxel.row + 0.5 + offsetZ;
    const dir: Vec3 = {x: dirX, y: dirY, z: dirZ};

    for (const y of getCandidateHeights(objectTypeIndex, quadIndex, offsetY))
    {
        const tr = new ObjectTransform({x, y, z}, dir);
        const obj = new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex,
            ObjectIdUtil.generateRandomObjectId(), tr);
        if (ObjectUpdateUtil.canAddObject(user, room, obj))
            return tr;
    }
    return null;
}

// How high up the wall the object would sit, in the order the heights are worth trying.
//
// A picture goes up at the height it was clicked at, which is rarely one of the steps a wall
// attachment snaps to — so the steps either side of it are both offered, and whichever the wall will
// take is where it hangs. A door does not hang at all: it stands on the floor of the storey the
// clicked quad belongs to, its origin half a footprint above that floor since a wall attachment's
// collider is centred on its position (see DoorObjectTypeConfig). There is one such height, and no
// second guess to be made about it.
function getCandidateHeights(objectTypeIndex: number, quadIndex: number, offsetY: number): number[]
{
    if (objectTypeIndex != doorTypeIndex)
        return [0.5 * Math.ceil(2 * offsetY), 0.5 * Math.floor(2 * offsetY)];

    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        return [];

    const storeyFloorLayer = (collisionLayer >= STOREY_FLOOR_COLLISION_LAYER)
        ? STOREY_FLOOR_COLLISION_LAYER + 1 : COLLISION_LAYER_MIN;
    const floorY = (storeyFloorLayer - COLLISION_LAYER_MIN) * COLLISION_LAYER_HEIGHT;
    return [floorY + 0.5 * DOOR_FOOTPRINT_HEIGHT];
}

async function tryAddObjectFromQuad(selection: VoxelQuadSelection,
    objectTypeIndex: number, metadata: {[key: number]: EncodableByteString})
{
    try {
        const tr = getPlaceableWallAttachedObjectTransform(selection, objectTypeIndex);
        if (tr == null)
            return;

        const room = App.getCurrentRoom()!;
        const user = App.getUser();
        const objectId = ObjectIdUtil.generateRandomObjectId();
        const signal = new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex, objectId, tr, metadata);
        
        // Add the game object locally, and report it to the server if successful.
        const gameObject = ObjectFactory.createServerSideObject(signal);
        const success = await ClientObjectManager.addObject(gameObject);
        if (success)
        {
            if (room.roomType != RoomTypeEnumMap.SinglePlayer)
                SocketsClient.emitAddObjectSignal(signal);
            VoxelQuadSelection.unselect();
            ObjectSelection.trySelect(gameObject);
        }
    } catch (err) {
        console.error(`Exception while trying to add an object from a voxelQuad :: Error: ${ErrorUtil.getErrorMessage(err)}`);
    }
}

function canAddVoxelBlock(selection: VoxelQuadSelection): boolean
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualVoxelBlockAddition))
        return false;

    const room = App.getCurrentRoom();
    if (!room)
        return false;

    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    let newRow = voxel.row;
    let newCol = voxel.col;
    if (facingAxis == "z")
        newRow += (orientation == "+") ? 1 : -1;
    else if (facingAxis == "x")
        newCol += (orientation == "+") ? 1 : -1;

    let newCollisionLayer = collisionLayer;
    if (facingAxis == "y")
    {
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            newCollisionLayer = (orientation == "+") ? COLLISION_LAYER_MIN : COLLISION_LAYER_MAX;
        else
            newCollisionLayer += (orientation == "+") ? 1 : -1;
    }

    const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer);
    return VoxelUpdateUtil.canAddVoxelBlock(App.getUser(), room, targetQuadIndex);
}

function tryAddVoxelBlock(selection: VoxelQuadSelection)
{
    if (!canAddVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;
    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    let newRow = voxel.row;
    let newCol = voxel.col;
    if (facingAxis == "z")
        newRow += (orientation == "+") ? 1 : -1;
    else if (facingAxis == "x")
        newCol += (orientation == "+") ? 1 : -1;

    let newCollisionLayer = collisionLayer;
    if (facingAxis == "y")
    {
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            newCollisionLayer = (orientation == "+") ? COLLISION_LAYER_MIN : COLLISION_LAYER_MAX;
        else
            newCollisionLayer += (orientation == "+") ? 1 : -1;
    }

    const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
    const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, collisionLayer);
    for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        quadTextureIndicesWithinLayer[i - startIndex] = App.getVoxelQuads()[i] & 0b01111111;

    const idealQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer);
    if (ClientVoxelManager.addVoxelBlock(room, idealQuadIndex, quadTextureIndicesWithinLayer))
    {
        VoxelQuadSelection.unselect();
        const idealVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, newRow, newCol);
        if (idealVoxel)
            VoxelQuadSelection.trySelectBestQuad(idealVoxel, idealQuadIndex);
        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitAddVoxelBlockSignal(new AddVoxelBlockSignal(room.id, idealQuadIndex, quadTextureIndicesWithinLayer));
    }
}

// Whatever hangs on the selected block is no reason to turn the button down: the user is warned
// first, and what hangs there comes down together with the block. So only the block's own
// conditions decide whether it can go.
function canRemoveVoxelBlock(selection: VoxelQuadSelection): boolean
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualVoxelBlockRemoval))
        return false;

    const room = App.getCurrentRoom();
    if (!room)
        return false;
    return VoxelUpdateUtil.canRemoveVoxelBlockWithItsWallAttachments(
        App.getUser(), room, selection.quadIndex);
}

function tryRemoveVoxelBlock(selection: VoxelQuadSelection)
{
    if (voxelQuadSelectionObservable.peek() != selection || !canRemoveVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;

    if (reportUndetachableAttachment(room, selection.quadIndex))
        return;

    // Taking a wall down destroys whatever is hanging on it, which is more than the button says it
    // does — and unlike the wall, what hangs there was placed and decorated by hand. So that case,
    // and only that case, is put to the user before it is carried out.
    if (WallAttachedObjectUtil.getObjectIdsAttachedToVoxelBlock(room, selection.quadIndex).length > 0)
    {
        PopupUtil.openPopup({
            popupType: "confirm",
            params: {
                message: "Something is attached to the wall. Removing the wall will destroy it, too. Want to proceed?",
                onConfirm: () => {
                    PopupUtil.closePopup();
                    removeVoxelBlockWithItsWallAttachments(selection);
                },
                onCancel: PopupUtil.closePopup,
            },
        });
        return;
    }
    removeVoxelBlockWithItsWallAttachments(selection);
}

// Whether the block is held up by something the user is not allowed to take down, in which case he
// is told so and the removal goes no further.
//
// A wall can only come down once nothing is left hanging on it, and not everything that hangs on a
// wall is everybody's to remove — a door is an admin's alone. Without this the user would be asked
// to confirm the destruction of what is hanging there, and then watch nothing happen: the door would
// refuse to come down, and the block behind it would refuse to follow.
function reportUndetachableAttachment(room: Room, quadIndex: number): boolean
{
    const user = App.getUser();

    for (const objectId of WallAttachedObjectUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
    {
        const obj = room.objectById[objectId];
        if (obj == undefined || ObjectUpdateUtil.canRemoveObject(user, room,
            new RemoveObjectSignal(room.id, objectId)))
        {
            continue;
        }
        // Named by what it is, since what the user has to be told is which thing on this wall is
        // standing in the way rather than that something is.
        const objectName = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex)
            .objectType.toLowerCase();
        notificationMessageObservable.set(
            `Can't remove a block because a ${objectName} is attached to it.`);
        return true;
    }
    return false;
}

async function removeVoxelBlockWithItsWallAttachments(selection: VoxelQuadSelection)
{
    // Re-checked rather than trusted from the caller: a confirmation popup stands between the
    // click and this call, and the room may have moved on while it was up.
    if (voxelQuadSelectionObservable.peek() != selection || !canRemoveVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;
    const quadIndex = selection.quadIndex;

    // Asked again for the same reason, and answered the same way: a door may have been hung on this
    // block while the confirmation was up.
    if (reportUndetachableAttachment(room, quadIndex))
        return;

    // The attachments go first, since the block is only removable once nothing is left hanging on
    // it. The server reads these signals in the order they were sent, so it sees the same sequence
    // and reaches the same conclusion.
    for (const objectId of WallAttachedObjectUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
    {
        const removed = await ClientObjectManager.removeObject(objectId);
        if (removed && room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitRemoveObjectSignal(new RemoveObjectSignal(room.id, objectId));
    }

    if (ClientVoxelManager.removeVoxelBlock(room, quadIndex))
    {
        VoxelQuadSelection.unselect();

        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const newRow = NumUtil.clampInRange(
            (facingAxis == "z") ? (orientation == "-" ? row+1 : row-1) : row,
            0, NUM_VOXEL_ROWS-1);
        const newCol = NumUtil.clampInRange(
            (facingAxis == "x") ? (orientation == "-" ? col+1 : col-1) : col,
            0, NUM_VOXEL_COLS-1);
        const newCollisionLayer = (facingAxis == "y")
            ? VoxelQueryUtil.getVoxelQuadCollisionLayerAfterOffset(quadIndex, (orientation == "-") ? 1 : -1)
            : collisionLayer;
        
        const idealQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer);
        const idealVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, newRow, newCol);
        if (idealVoxel)
            VoxelQuadSelection.trySelectBestQuad(idealVoxel, idealQuadIndex);

        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitRemoveVoxelBlockSignal(new RemoveVoxelBlockSignal(room.id, quadIndex));
    }
}