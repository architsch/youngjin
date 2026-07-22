import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import IconButton from "../basic/iconButton";
import TrashIcon from "../basic/icons/trashIcon";
import ImageChooser from "../image/imageChooser";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ClientObjectManager from "../../../object/clientObjectManager";
import SetObjectMetadataSignal from "../../../../shared/object/types/setObjectMetadataSignal";
import RemoveObjectSignal from "../../../../shared/object/types/removeObjectSignal";
import ObjectUpdateUtil from "../../../../shared/object/util/objectUpdateUtil";
import { clientFeatureFlagsObservable, objectSelectionObservable, userRoleObservable } from "../../../system/clientObservables";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import PopupUtil from "../../util/popupUtil";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";
import PictureIcon from "../basic/icons/pictureIcon";
import PictureFrameIcon from "../basic/icons/pictureFrameIcon";

export default function CanvasEditOptions(props: {selection: ObjectSelection})
{
    const go = props.selection.gameObject;
    const imagePathMetadata = go.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
    const initialImagePath = imagePathMetadata ? imagePathMetadata.str : "";
    const frameCoordsMetadata = go.params.metadata[ObjectMetadataKeyEnumMap.CanvasFrameCoords];
    const initialFrameCoords = frameCoordsMetadata ? frameCoordsMetadata.str : "";

    return <div className="flex flex-row gap-4 p-2 w-fit pointer-events-auto overflow-hidden bg-gray-800 rounded-md">
        <IconButton icon={<TrashIcon/>} size="md" color="red"
            disabled={!canRemoveCanvas(props.selection)}
            onClick={() => openRemoveConfirmPopup(props.selection)}
        />
        <ImageChooser
            title="Change Image"
            icon={<PictureIcon/>}
            viewType="list"
            mapName="CanvasImageMap"
            initialChoicePath={initialImagePath}
            onChoose={path => trySetCanvasMetadata(props.selection, ObjectMetadataKeyEnumMap.ImagePath, path)}
        />
        <ImageChooser
            title="Change Frame"
            icon={<PictureFrameIcon/>}
            viewType="grid"
            mapName="CanvasFrameImageMap"
            initialChoicePath={initialFrameCoords}
            onChoose={coords => trySetCanvasMetadata(props.selection, ObjectMetadataKeyEnumMap.CanvasFrameCoords, coords)}
        />
    </div>;
}

function canRemoveCanvas(selection: ObjectSelection): boolean
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableManualObjectRemoval))
        return false;

    const room = App.getCurrentRoom();
    if (!room)
        return false;
    const user = App.getUser();
    const userRole = userRoleObservable.peek();

    const objectId = selection.gameObject.params.objectId;
    return ObjectUpdateUtil.canRemoveObject(user, userRole, room, new RemoveObjectSignal(room.id, objectId));
}

function openRemoveConfirmPopup(selection: ObjectSelection)
{
    PopupUtil.openPopup({
        popupType: "confirm",
        params: {
            message: "Want to remove this?",
            onConfirm: () => {
                tryRemoveCanvas(selection);
                PopupUtil.closePopup();
            },
            onCancel: PopupUtil.closePopup
        }
    });
}

async function tryRemoveCanvas(selection: ObjectSelection)
{
    if (objectSelectionObservable.peek() != selection || !canRemoveCanvas(selection))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;

    // Remove the game object locally, and report it to the server if successful.
    ObjectSelection.unselect();
    const success = await ClientObjectManager.removeObject(objectId);
    if (success)
    {
        if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            SocketsClient.emitRemoveObjectSignal(new RemoveObjectSignal(room.id, objectId));
    }
}

function canSetCanvasMetadata(selection: ObjectSelection, metadataKey: ObjectMetadataKey, metadataValue: string): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;
    const user = App.getUser();
    const userRole = userRoleObservable.peek();

    const objectId = selection.gameObject.params.objectId;
    const signal = new SetObjectMetadataSignal(room.id, objectId, metadataKey, metadataValue);
    return ObjectUpdateUtil.canSetObjectMetadata(user, userRole, room, signal);
}

function trySetCanvasMetadata(selection: ObjectSelection, metadataKey: ObjectMetadataKey, metadataValue: string)
{
    if (!canSetCanvasMetadata(selection, metadataKey, metadataValue))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;
    if (!ClientObjectManager.setObjectMetadata(objectId, metadataKey, metadataValue))
        return;

    objectSelectionObservable.notify();

    if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitSetObjectMetadataSignal(new SetObjectMetadataSignal(room.id, objectId, metadataKey, metadataValue));
}
