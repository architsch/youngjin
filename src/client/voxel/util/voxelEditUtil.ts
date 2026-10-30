import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";
import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import ClientObjectManager from "../../object/clientObjectManager";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import ObjectAttachmentUtil from "../../../shared/object/util/objectAttachmentUtil";
import ClientVoxelManager from "../clientVoxelManager";
import RoomEditUtil from "../../system/util/roomEditUtil";
import { ClientEventType } from "../../system/types/clientEventType";
import EncodableData from "../../../shared/networking/types/encodableData";
import VoxelUpdateUtil from "../../../shared/voxel/util/voxelUpdateUtil";
import RemoveVoxelBlockSignal from "../../../shared/voxel/types/update/removeVoxelBlockSignal";
import { NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER,
    NUM_VOXEL_ROWS } from "../../../shared/system/sharedConstants";
import AddVoxelBlockSignal from "../../../shared/voxel/types/update/addVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import { clientFeatureFlagsObservable, notificationMessageObservable,
    voxelQuadSelectionObservable } from "../../system/clientObservables";
import Room from "../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../shared/system/types/featureFlag";
import PopupUtil from "../../ui/util/popupUtil";
import NumUtil from "../../../shared/math/util/numUtil";

// The edits of the room's blocks the user makes from a selected face (see VoxelQuadPlacementOptions,
// VoxelQuadTextureOptions). Each is checked as the server will check it (see VoxelUpdateUtil), applied locally, then
// sent (a single-player room has no server to send it to), and entered in the history for an undo to take back (see
// RoomEditUtil).
const VoxelEditUtil =
{
    canAddVoxelBlock: (selection: VoxelQuadSelection): boolean =>
    {
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualVoxelBlockAddition))
            return false;

        const room = App.getCurrentRoom();
        if (!room)
            return false;

        // The block goes into the cell layer the face looks into.
        const targetQuadIndex = VoxelQueryUtil.getVoxelBlockAddTargetQuadIndex(selection.quadIndex);
        return targetQuadIndex >= 0 && VoxelUpdateUtil.canAddVoxelBlock(App.getUser(), room, targetQuadIndex);
    },
    tryAddVoxelBlock: (selection: VoxelQuadSelection): void =>
    {
        if (!VoxelEditUtil.canAddVoxelBlock(selection))
            return;

        const room = App.getCurrentRoom()!;
        const targetQuadIndex = VoxelQueryUtil.getVoxelBlockAddTargetQuadIndex(selection.quadIndex);

        // A new block takes the textures of the one it is built from.
        const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(selection.voxel.row, selection.voxel.col,
            VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(selection.quadIndex));
        for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            quadTextureIndicesWithinLayer[i - startIndex] = App.getVoxelQuads()[i] & 0b01111111;

        const signal = new AddVoxelBlockSignal(room.id, targetQuadIndex, quadTextureIndicesWithinLayer);
        const undoSignal = RoomEditUtil.getUndoSignal(room, signal);
        if (!ClientVoxelManager.addVoxelBlock(room, targetQuadIndex, quadTextureIndicesWithinLayer))
            return;
        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitAddVoxelBlockSignal(signal);

        // The same face of the new block, or the nearest one that shows if it is covered.
        VoxelQuadSelection.unselect();
        const targetVoxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels,
            VoxelQueryUtil.getVoxelRowFromQuadIndex(targetQuadIndex),
            VoxelQueryUtil.getVoxelColFromQuadIndex(targetQuadIndex));
        if (targetVoxel)
            VoxelQuadSelection.trySelectBestQuad(targetVoxel, targetQuadIndex);

        RoomEditUtil.record(ClientEventType.ManuallyAddedVoxelBlock, room,
            {redo: [signal], undo: [undoSignal], selectionBefore: selection});
    },
    // Attachments don't disable removal; the user is warned and they are removed with the block.
    canRemoveVoxelBlock: (selection: VoxelQuadSelection): boolean =>
    {
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualVoxelBlockRemoval))
            return false;

        const room = App.getCurrentRoom();
        if (!room)
            return false;
        return VoxelUpdateUtil.canRemoveVoxelBlockWithItsAttachments(
            App.getUser(), room, selection.quadIndex);
    },
    tryRemoveVoxelBlock: (selection: VoxelQuadSelection): void =>
    {
        if (voxelQuadSelectionObservable.peek() != selection || !VoxelEditUtil.canRemoveVoxelBlock(selection))
            return;

        const room = App.getCurrentRoom()!;

        if (reportUndetachableAttachment(room, selection.quadIndex))
            return;

        // Confirm only when hand-placed attachments would be destroyed: one that steps aside is moved instead.
        if (ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, selection.quadIndex)
            .some(objectId => !stepsAside(room.objectById[objectId])))
        {
            PopupUtil.openPopup({
                popupType: "confirm",
                params: {
                    message: "Something is attached to this block. Removing the block will destroy it, too. Want to proceed?",
                    onConfirm: () => {
                        PopupUtil.closePopup();
                        removeVoxelBlockWithItsAttachments(selection);
                    },
                    onCancel: PopupUtil.closePopup,
                },
            });
            return;
        }
        removeVoxelBlockWithItsAttachments(selection);
    },
    canSetVoxelQuadTexture: (selection: VoxelQuadSelection): boolean =>
    {
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualVoxelQuadTextureChange))
            return false;

        const room = App.getCurrentRoom();
        if (!room)
            return false;
        return VoxelUpdateUtil.canSetVoxelQuadTexture(App.getUser(), room, selection.quadIndex);
    },
    trySetVoxelQuadTexture: (selection: VoxelQuadSelection, textureIndex: number): void =>
    {
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualVoxelQuadTextureChange))
            return;

        const room = App.getCurrentRoom();
        if (!room)
        {
            console.error("Current room not found.");
            return;
        }

        const quadIndex = selection.quadIndex;
        const signal = new SetVoxelQuadTextureSignal(room.id, quadIndex, textureIndex);
        const undoSignal = RoomEditUtil.getUndoSignal(room, signal);
        if (ClientVoxelManager.setVoxelQuadTexture(room, quadIndex, textureIndex))
        {
            voxelQuadSelectionObservable.notify();

            if (room.roomType != RoomTypeEnumMap.SinglePlayer)
                SocketsClient.emitSetVoxelQuadTextureSignal(signal);
            RoomEditUtil.record(ClientEventType.ManuallyChangedVoxelQuadTexture, room,
                {redo: [signal], undo: [undoSignal]});
        }
    },
}

// Reports and returns true if an attachment on the block can't be taken off it by this user (e.g. a door, or an NPC
// with nowhere nearby to step to), instead of confirming a removal that would then fail.
function reportUndetachableAttachment(room: Room, quadIndex: number): boolean
{
    const user = App.getUser();

    for (const objectId of ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
    {
        const obj = room.objectById[objectId];
        if (obj == undefined)
            continue;
        // One that steps aside is moved off the block rather than removed with it.
        const mayTakeOff = stepsAside(obj)
            ? ObjectUpdateUtil.canSetObjectTransform(user, room, new SetObjectTransformSignal(room.id, objectId,
                new ObjectTransform({...obj.transform.pos}, {...obj.transform.dir}, {...obj.transform.scale}), true))
            : ObjectUpdateUtil.canRemoveObject(user, room, new RemoveObjectSignal(room.id, objectId));
        const hasNowhereToGo = mayTakeOff && stepsAside(obj) && findSpotSteppingAside(room, obj, quadIndex) == undefined;
        if (mayTakeOff && !hasNowhereToGo)
            continue;
        // Type names are CamelCase, so split into words for display.
        const objectName = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex)
            .objectType.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
        notificationMessageObservable.set(hasNowhereToGo
            ? `Can't remove a block because the ${objectName} on it has nowhere nearby to step to.`
            : `Can't remove a block because a ${objectName} is attached to it.`);
        return true;
    }
    return false;
}

// Whether an attachment is moved off its block rather than removed with it (see ObjectAttachmentConfig.stepsAside).
function stepsAside(obj: AddObjectSignal | undefined): boolean
{
    return obj != undefined && ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).attachment?.stepsAside == true;
}

// Where an attachment that steps aside goes as the block at quadIndex is removed: a spot this user may move it to.
function findSpotSteppingAside(room: Room, obj: AddObjectSignal, quadIndex: number): ObjectTransform | undefined
{
    const user = App.getUser();
    return ObjectAttachmentUtil.findSpotSteppingAside(room, obj, quadIndex, transform =>
        ObjectUpdateUtil.canSetObjectTransform(user, room, new SetObjectTransformSignal(room.id, obj.objectId, transform, true)));
}

async function removeVoxelBlockWithItsAttachments(selection: VoxelQuadSelection)
{
    // Re-checked: the room may have changed while the confirmation popup was up.
    if (voxelQuadSelectionObservable.peek() != selection || !VoxelEditUtil.canRemoveVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;
    const quadIndex = selection.quadIndex;

    // A door may have been hung meanwhile.
    if (reportUndetachableAttachment(room, quadIndex))
        return;

    const isMultiPlayer = room.roomType != RoomTypeEnumMap.SinglePlayer;
    // The removals made, and what puts each back: the block first, for what hung on it to have its footing again.
    const removals: EncodableData[] = [];
    const restorals: EncodableData[] = [];

    // Attachments first; the server processes signals in order and reaches the same result. Those that step aside
    // go last, so that one may step where another stood.
    const attached = ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex);
    for (const objectId of attached)
    {
        // (One may have left the room while another was being removed.)
        if (room.objectById[objectId] == undefined || stepsAside(room.objectById[objectId]))
            continue;
        const signal = new RemoveObjectSignal(room.id, objectId);
        const undoSignal = RoomEditUtil.getUndoSignal(room, signal);
        if (!await ClientObjectManager.removeObject(objectId))
            continue;
        if (isMultiPlayer)
            SocketsClient.emitRemoveObjectSignal(signal);
        removals.push(signal);
        restorals.unshift(undoSignal);
    }
    for (const objectId of attached)
    {
        const obj = room.objectById[objectId];
        // (With nowhere left to go, it stays, and so does the block it stands on.)
        const spot = stepsAside(obj) ? findSpotSteppingAside(room, obj, quadIndex) : undefined;
        if (spot == undefined)
            continue;
        const undoSignal = RoomEditUtil.getUndoSignal(room, new SetObjectTransformSignal(room.id, objectId, spot, true));
        const applied = ClientObjectManager.setObjectTransform(objectId, spot, true, false);
        const signal = new SetObjectTransformSignal(room.id, objectId,
            new ObjectTransform({...applied.pos}, {...applied.dir}, {...applied.scale}), true);
        if (isMultiPlayer)
            SocketsClient.emitSetObjectTransformSignal(signal);
        removals.push(signal);
        restorals.unshift(undoSignal);
    }

    const signal = new RemoveVoxelBlockSignal(room.id, quadIndex);
    const undoSignal = RoomEditUtil.getUndoSignal(room, signal);
    const blockRemoved = ClientVoxelManager.removeVoxelBlock(room, quadIndex);
    if (blockRemoved)
    {
        removals.push(signal);
        restorals.unshift(undoSignal);
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

        if (isMultiPlayer)
            SocketsClient.emitRemoveVoxelBlockSignal(signal);
    }

    if (removals.length > 0)
    {
        RoomEditUtil.record(blockRemoved ? ClientEventType.ManuallyRemovedVoxelBlock : ClientEventType.ManuallyRemovedObject,
            room, {redo: removals, undo: restorals, selectionBefore: selection});
    }
}

export default VoxelEditUtil;
