import { useState } from "react";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import Button from "../basic/button";
import TextInput from "../basic/textInput";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ClientObjectManager from "../../../object/clientObjectManager";
import SetObjectMetadataSignal from "../../../../shared/object/types/setObjectMetadataSignal";
import RemoveObjectSignal from "../../../../shared/object/types/removeObjectSignal";
import ObjectUpdateUtil from "../../../../shared/object/util/objectUpdateUtil";
import { notificationMessageObservable, objectSelectionObservable } from "../../../system/clientObservables";
import { MAX_IMAGE_URL_LENGTH } from "../../../../shared/system/sharedConstants";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";

export default function CanvasSelectionOptions(props: {selection: ObjectSelection})
{
    const go = props.selection.gameObject;
    const currentImageURL = go.params.hasMetadata(ObjectMetadataKeyEnumMap.ImageURL)
        ? go.params.getMetadata(ObjectMetadataKeyEnumMap.ImageURL)
        : "";
    const [imageURL, setImageURL] = useState(currentImageURL);

    return <div className="flex flex-col gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <div className="flex flex-row gap-2">
            <Button name="Remove" size="sm" color="red"
                disabled={!canRemoveCanvas(props.selection)}
                onClick={() => tryRemoveCanvas(props.selection)}/>
        </div>
        <div className="flex flex-row gap-2 items-center">
            <TextInput size="sm" placeholder="Image URL" textInput={imageURL} setTextInput={setImageURL}/>
            <Button name="Set URL" size="sm" color="green"
                disabled={!canSetCanvasImageURL(props.selection)}
                onClick={() => trySetCanvasImageURL(props.selection, imageURL)}/>
        </div>
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

function tryRemoveCanvas(selection: ObjectSelection)
{
    if (!canRemoveCanvas(selection))
        return;

    const user = App.getUser();
    const userRole = App.getCurrentUserRole();
    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;
    const removed = ObjectUpdateUtil.removeObject(user, userRole, room, new RemoveObjectSignal(room.id, objectId));
    if (!removed)
        return;

    ObjectSelection.unselect();
    ClientObjectManager.removeObject(objectId);
    SocketsClient.emitRemoveObjectSignal(new RemoveObjectSignal(room.id, objectId));
}

function canSetCanvasImageURL(selection: ObjectSelection): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;
    const user = App.getUser();
    const userRole = App.getCurrentUserRole();

    const objectId = selection.gameObject.params.objectId;
    const signal = new SetObjectMetadataSignal(room.id, objectId, ObjectMetadataKeyEnumMap.ImageURL, "");
    return ObjectUpdateUtil.canSetObjectMetadata(user, userRole, room, signal);
}

function trySetCanvasImageURL(selection: ObjectSelection, imageURL: string)
{
    if (!canSetCanvasImageURL(selection))
        return;

    const room = App.getCurrentRoom()!;
    const user = App.getUser();
    const userRole = App.getCurrentUserRole();

    const objectId = selection.gameObject.params.objectId;
    const signal = new SetObjectMetadataSignal(room.id, objectId, ObjectMetadataKeyEnumMap.ImageURL, "");
    if (!ObjectUpdateUtil.setObjectMetadata(user, userRole, room, signal))
        return;

    selection.gameObject.params.setMetadata(ObjectMetadataKeyEnumMap.ImageURL, imageURL);

    objectSelectionObservable.notify();
    SocketsClient.emitSetObjectMetadataSignal(
        new SetObjectMetadataSignal(room.id, objectId, ObjectMetadataKeyEnumMap.ImageURL, imageURL));
}
