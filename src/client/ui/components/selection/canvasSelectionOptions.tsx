import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import Button from "../basic/button";
import ImageChooser from "../image/imageChooser";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ClientObjectManager from "../../../object/clientObjectManager";
import SetObjectMetadataSignal from "../../../../shared/object/types/setObjectMetadataSignal";
import RemoveObjectSignal from "../../../../shared/object/types/removeObjectSignal";
import ObjectUpdateUtil from "../../../../shared/object/util/objectUpdateUtil";
import { objectSelectionObservable } from "../../../system/clientObservables";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";

export default function CanvasSelectionOptions(props: {selection: ObjectSelection})
{
    const go = props.selection.gameObject;
    const metadata = go.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];
    const initialChoicePath = metadata ? metadata.str : "";

    return <div className="flex flex-col gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <div className="flex flex-row gap-2">
            <Button name="Remove" size="sm" color="red"
                disabled={!canRemoveCanvas(props.selection)}
                onClick={() => tryRemoveCanvas(props.selection)}/>
        </div>
        <ImageChooser
            title="Choose Image"
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

async function tryRemoveCanvas(selection: ObjectSelection)
{
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
