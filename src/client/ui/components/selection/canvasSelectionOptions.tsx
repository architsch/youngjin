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
import { objectSelectionObservable } from "../../../system/clientObservables";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import PopupUtil from "../../util/popupUtil";

export default function CanvasSelectionOptions(props: {selection: ObjectSelection})
{
    const go = props.selection.gameObject;
    const metadata = go.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
    const initialChoicePath = metadata ? metadata.str : "";

    return <div className="flex flex-row gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-gray-800/50 rounded-md">
        <IconButton icon={<TrashIcon/>} size="md" color="red"
            disabled={!canRemoveCanvas(props.selection)}
            onClick={() => openRemoveConfirmPopup(props.selection)}
        />
        <ImageChooser
            title="Change Image"
            mapName="CanvasImageMap"
            initialChoicePath={initialChoicePath}
            onChoose={path => trySetCanvasImageMetadata(props.selection, path)}
        />
    </div>;
}

function canRemoveCanvas(selection: ObjectSelection): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;
    const user = App.getUser();
    const userRole = App.getCurrentUserRole();

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
        SocketsClient.emitRemoveObjectSignal(new RemoveObjectSignal(room.id, objectId));
    }
}

function canSetCanvasImageMetadata(selection: ObjectSelection, metadataValue: string): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;
    const user = App.getUser();
    const userRole = App.getCurrentUserRole();

    const objectId = selection.gameObject.params.objectId;
    const signal = new SetObjectMetadataSignal(room.id, objectId, ObjectMetadataKeyEnumMap.ImagePath, metadataValue);
    return ObjectUpdateUtil.canSetObjectMetadata(user, userRole, room, signal);
}

function trySetCanvasImageMetadata(selection: ObjectSelection, metadataValue: string)
{
    if (!canSetCanvasImageMetadata(selection, metadataValue))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;
    if (!ClientObjectManager.setObjectMetadata(objectId, ObjectMetadataKeyEnumMap.ImagePath, metadataValue))
        return;

    objectSelectionObservable.notify();
    SocketsClient.emitSetObjectMetadataSignal(
        new SetObjectMetadataSignal(room.id, objectId, ObjectMetadataKeyEnumMap.ImagePath, metadataValue));
}
