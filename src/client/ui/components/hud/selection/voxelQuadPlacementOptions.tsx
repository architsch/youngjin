import { useEffect, useReducer } from "react";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import AddBlockIcon from "../../../svg/icons/addBlockIcon";
import AddCanvasIcon from "../../../svg/icons/addCanvasIcon";
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
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS } from "../../../../../shared/system/sharedConstants";
import AddVoxelBlockSignal from "../../../../../shared/voxel/types/update/addVoxelBlockSignal";
import ObjectIdUtil from "../../../../../shared/object/util/objectIdUtil";
import { clientFeatureFlagsObservable, userRoleObservable, voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import FTUEUtil from "../../../util/ftueUtil";
import PopupUtil from "../../../util/popupUtil";
import { FTUEElementCodeEnumMap } from "../../../types/ftueElementCode";
import NumUtil from "../../../../../shared/math/util/numUtil";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

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

function getPlaceableWallAttachedObjectTransform(selection: VoxelQuadSelection,
    objectTypeIndex: number): ObjectTransform | null
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualObjectAddition))
        return null;

    const room = App.getCurrentRoom();
    if (!room)
        return null;
    const user = App.getUser();
    const userRole = userRoleObservable.peek();

    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ } =
        VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, quadIndex);

    if (dirY != 0)
        return null;

    const x = voxel.col + 0.5 + offsetX;
    const yUpper = 0.5 * Math.ceil(2 * offsetY);
    const yLower = 0.5 * Math.floor(2 * offsetY);
    const z = voxel.row + 0.5 + offsetZ;

    const upperPos: Vec3 = {x, y: yUpper, z};
    const lowerPos: Vec3 = {x, y: yLower, z};
    const dir: Vec3 = {x: dirX, y: dirY, z: dirZ};

    const upperTr = new ObjectTransform(upperPos, dir);
    const lowerTr = new ObjectTransform(lowerPos, dir);
    const upperObj = new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex,
        ObjectIdUtil.generateRandomObjectId(), upperTr);
    const lowerObj = new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex,
        ObjectIdUtil.generateRandomObjectId(), lowerTr);

    if (ObjectUpdateUtil.canAddObject(user, userRole, room, upperObj))
        return upperTr;
    if (ObjectUpdateUtil.canAddObject(user, userRole, room, lowerObj))
        return lowerTr;
    return null;
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
    return VoxelUpdateUtil.canAddVoxelBlock(userRoleObservable.peek(), room, targetQuadIndex);
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
        userRoleObservable.peek(), room, selection.quadIndex);
}

function tryRemoveVoxelBlock(selection: VoxelQuadSelection)
{
    if (voxelQuadSelectionObservable.peek() != selection || !canRemoveVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;

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

async function removeVoxelBlockWithItsWallAttachments(selection: VoxelQuadSelection)
{
    // Re-checked rather than trusted from the caller: a confirmation popup stands between the
    // click and this call, and the room may have moved on while it was up.
    if (voxelQuadSelectionObservable.peek() != selection || !canRemoveVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;
    const quadIndex = selection.quadIndex;

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