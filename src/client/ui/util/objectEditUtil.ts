import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";
import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import ClientObjectManager from "../../object/clientObjectManager";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import CompositionMetadataUtil from "../../../shared/graphics/mesh/composition/util/compositionMetadataUtil";
import InstancedMeshComposer from "../../object/components/instancedMeshComposer";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../shared/system/types/featureFlag";
import { clientFeatureFlagsObservable, objectSelectionObservable } from "../../system/clientObservables";
import PopupUtil from "./popupUtil";

// The edits every selected object's tools share. Each is checked as the server will check it (see
// ObjectUpdateUtil), applied locally, then sent (a single-player room has no server to send it to).
const ObjectEditUtil =
{
    canRemoveObject: (selection: ObjectSelection): boolean =>
    {
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualObjectRemoval))
            return false;

        const room = App.getCurrentRoom();
        if (!room)
            return false;

        const objectId = selection.gameObject.params.objectId;
        return ObjectUpdateUtil.canRemoveObject(App.getUser(), room, new RemoveObjectSignal(room.id, objectId));
    },
    openRemoveConfirmPopup: (selection: ObjectSelection, message: string): void =>
    {
        PopupUtil.openPopup({
            popupType: "confirm",
            params: {
                message,
                onConfirm: () => {
                    tryRemoveObject(selection);
                    PopupUtil.closePopup();
                },
                onCancel: PopupUtil.closePopup,
            },
        });
    },
    canSetObjectMetadata: (selection: ObjectSelection, metadataKey: ObjectMetadataKey,
        metadataValue: string): boolean =>
    {
        const room = App.getCurrentRoom();
        if (!room)
            return false;

        const objectId = selection.gameObject.params.objectId;
        const signal = new SetObjectMetadataSignal(room.id, objectId, metadataKey, metadataValue);
        return ObjectUpdateUtil.canSetObjectMetadata(App.getUser(), room, signal);
    },
    trySetObjectMetadata: (selection: ObjectSelection, metadataKey: ObjectMetadataKey,
        metadataValue: string): void =>
    {
        if (!ObjectEditUtil.canSetObjectMetadata(selection, metadataKey, metadataValue))
            return;

        const room = App.getCurrentRoom()!;
        const objectId = selection.gameObject.params.objectId;
        if (!ClientObjectManager.setObjectMetadata(objectId, metadataKey, metadataValue))
            return;

        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        {
            SocketsClient.emitSetObjectMetadataSignal(
                new SetObjectMetadataSignal(room.id, objectId, metadataKey, metadataValue));
        }
    },
    // Transforms set by a tool are placements, which ignore physics (as a drag's do).
    canSetObjectTransform: (selection: ObjectSelection, transform: ObjectTransform): boolean =>
    {
        const room = App.getCurrentRoom();
        if (!room)
            return false;

        const objectId = selection.gameObject.params.objectId;
        return ObjectUpdateUtil.canSetObjectTransform(App.getUser(), room,
            new SetObjectTransformSignal(room.id, objectId, transform, true));
    },
    trySetObjectTransform: (selection: ObjectSelection, transform: ObjectTransform): void =>
    {
        if (!ObjectEditUtil.canSetObjectTransform(selection, transform))
            return;

        const room = App.getCurrentRoom()!;
        const objectId = selection.gameObject.params.objectId;
        const applied = ClientObjectManager.setObjectTransform(objectId, transform, true, false);
        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        {
            SocketsClient.emitSetObjectTransformSignal(new SetObjectTransformSignal(room.id, objectId,
                new ObjectTransform({...applied.pos}, {...applied.dir}, {...applied.scale}), true));
        }
        // Re-announced so the outline and the tools catch up with where and how big it now is.
        objectSelectionObservable.notify();
    },
    // The pre-encoded look a composed object shows (see IndexedCompositionCodec), or -1 for none.
    getCompositionIndex: (selection: ObjectSelection): number =>
    {
        const composer = selection.gameObject.components.instancedMeshComposer as InstancedMeshComposer | undefined;
        return composer?.getParams().compositionIndex ?? -1;
    },
    trySetCompositionIndex: (selection: ObjectSelection, compositionIndex: number): void =>
    {
        const composer = selection.gameObject.components.instancedMeshComposer as InstancedMeshComposer | undefined;
        if (!composer || compositionIndex == ObjectEditUtil.getCompositionIndex(selection))
            return;
        ObjectEditUtil.trySetObjectMetadata(selection, ObjectMetadataKeyEnumMap.InstancedMeshComposition,
            CompositionMetadataUtil.encodeIndexed(compositionIndex, composer.componentConfig.codecVersion));
        // Re-announced so the tools catch up with the look it now has.
        objectSelectionObservable.notify();
    },
}

async function tryRemoveObject(selection: ObjectSelection)
{
    // Re-checked: the room may have changed while the confirmation popup was up.
    if (objectSelectionObservable.peek() != selection || !ObjectEditUtil.canRemoveObject(selection))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;

    // Removed locally, then reported to the server if that succeeded.
    ObjectSelection.unselect();
    VoxelQuadSelection.trySelectBestQuadNearby(selection.gameObject.params.transform.pos);
    const success = await ClientObjectManager.removeObject(objectId);
    if (success && room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitRemoveObjectSignal(new RemoveObjectSignal(room.id, objectId));
}

export default ObjectEditUtil;
