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
import RestrictedZoneUtil from "../../../shared/voxel/util/restrictedZoneUtil";
import QuarterTurnsUtil from "../../../shared/object/util/quarterTurnsUtil";
import ObjectAttachmentUtil from "../../../shared/object/util/objectAttachmentUtil";
import ObjectScaleUtil from "../../../shared/object/util/objectScaleUtil";
import PopupUtil from "./popupUtil";

// The edits every selected object's tools share. Each is checked as the server will check it (see
// ObjectUpdateUtil), applied locally, then sent (a single-player room has no server to send it to).
const ObjectEditUtil =
{
    // The room must be editable and the object outside others' restricted zones (see
    // @docs/gameplay/restricted_zone.md): what tools asking no one key of their own are held to.
    canEditObject: (selection: ObjectSelection): boolean =>
    {
        const room = App.getCurrentRoom();
        if (!room)
            return false;
        const params = selection.gameObject.params;
        return !RestrictedZoneUtil.blocksObjectEdit(App.getUser(), room, params.objectTypeIndex, params.transform);
    },
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
    // With the transform the value needs, when it changes the scale the object is pinned to (see
    // SetObjectMetadataSignal.transform); the two are one edit.
    canSetObjectMetadata: (selection: ObjectSelection, metadataKey: ObjectMetadataKey,
        metadataValue: string, transform?: ObjectTransform): boolean =>
    {
        const room = App.getCurrentRoom();
        if (!room)
            return false;

        const objectId = selection.gameObject.params.objectId;
        const signal = new SetObjectMetadataSignal(room.id, objectId, metadataKey, metadataValue, transform);
        return ObjectUpdateUtil.canSetObjectMetadata(App.getUser(), room, signal);
    },
    trySetObjectMetadata: (selection: ObjectSelection, metadataKey: ObjectMetadataKey,
        metadataValue: string, transform?: ObjectTransform): void =>
    {
        if (!ObjectEditUtil.canSetObjectMetadata(selection, metadataKey, metadataValue, transform))
            return;

        const room = App.getCurrentRoom()!;
        const objectId = selection.gameObject.params.objectId;
        if (!ClientObjectManager.setObjectMetadata(objectId, metadataKey, metadataValue, true, transform))
            return;

        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        {
            const applied = room.objectById[objectId].transform;
            SocketsClient.emitSetObjectMetadataSignal(new SetObjectMetadataSignal(room.id, objectId, metadataKey,
                metadataValue, transform ? new ObjectTransform({...applied.pos}, {...applied.dir}, {...applied.scale})
                    : undefined));
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
    // A clockwise quarter-turn of the whole object, as one edit: its footprint swaps where it stands, or a grid
    // step from there if only so does it fit, and what it shows turns with it (see QuarterTurnsUtil). Checked as
    // the server will check it, so it is offered only where the turned object fits.
    canQuarterTurn: (selection: ObjectSelection): boolean =>
    {
        return findQuarterTurned(selection) != null;
    },
    tryQuarterTurn: (selection: ObjectSelection): void =>
    {
        const turned = findQuarterTurned(selection);
        if (turned != null)
        {
            ObjectEditUtil.trySetObjectMetadata(selection, ObjectMetadataKeyEnumMap.QuarterTurns,
                getNextQuarterTurns(selection), turned.transform);
        }
    },
}

function getNextQuarterTurns(selection: ObjectSelection): string
{
    return QuarterTurnsUtil.encode(QuarterTurnsUtil.getQuarterTurns(selection.gameObject.params) + 1);
}

// The transform to send with the object's next turn: none for a square object, or else the first way its
// footprint fits with its width and height swapped (see ObjectAttachmentUtil.getQuarterTurnCandidates). Null when
// the turn can't be made.
function findQuarterTurned(selection: ObjectSelection): {transform: ObjectTransform | undefined} | null
{
    const params = selection.gameObject.params;
    const scale = ObjectScaleUtil.sanitize(params.objectTypeIndex, params.transform.scale);
    const candidates = (scale.x == scale.y) ? [undefined]
        : ObjectAttachmentUtil.getQuarterTurnCandidates(params.objectTypeIndex, params.transform);
    for (const transform of candidates)
    {
        if (ObjectEditUtil.canSetObjectMetadata(selection, ObjectMetadataKeyEnumMap.QuarterTurns,
            getNextQuarterTurns(selection), transform))
        {
            return {transform};
        }
    }
    return null;
}

async function tryRemoveObject(selection: ObjectSelection)
{
    // Re-checked: the room may have changed while the confirmation popup was up.
    if (objectSelectionObservable.peek() != selection || !ObjectEditUtil.canRemoveObject(selection))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;

    // Removed locally, then reported to the server if that succeeded. The selection moves on once the room no
    // longer holds the object (removeObject sees to that before it first waits), so the face it leaves counts as
    // clear.
    ObjectSelection.unselect();
    const removal = ClientObjectManager.removeObject(objectId);
    VoxelQuadSelection.trySelectBestQuadNearby(selection.gameObject.params.transform.pos);
    const success = await removal;
    if (success && room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitRemoveObjectSignal(new RemoveObjectSignal(room.id, objectId));
}

export default ObjectEditUtil;
