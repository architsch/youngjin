import * as THREE from "three";
import { useState } from "react";
import PersistentObjectSelection from "../../../graphics/types/gizmo/persistentObjectSelection";
import Button from "../basic/button";
import TextInput from "../basic/textInput";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ObjectManager from "../../../object/objectManager";
import RemovePersistentObjectParams from "../../../../shared/object/types/update/removePersistentObjectParams";
import MovePersistentObjectParams from "../../../../shared/object/types/update/movePersistentObjectParams";
import SetPersistentObjectMetadataParams from "../../../../shared/object/types/update/setPersistentObjectMetadataParams";
import PersistentObjectUpdateUtil from "../../../../shared/object/util/persistentObjectUpdateUtil";
import { notificationMessageObservable, persistentObjectSelectionObservable } from "../../../system/clientObservables";
import { MAX_IMAGE_URL_LENGTH } from "../../../../shared/system/sharedConstants";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import DirUtil from "../../../../shared/math/util/dirUtil";

export default function CanvasSelectionOptions(props: {selection: PersistentObjectSelection})
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
            <Button name="Move Left" size="sm"
                disabled={!canMoveCanvas(props.selection, -0.5, 0)}
                onClick={() => tryMoveCanvas(props.selection, -0.5, 0)}/>
            <Button name="Move Right" size="sm"
                disabled={!canMoveCanvas(props.selection, 0.5, 0)}
                onClick={() => tryMoveCanvas(props.selection, 0.5, 0)}/>
            <Button name="Move Up" size="sm"
                disabled={!canMoveCanvas(props.selection, 0, 0.25)}
                onClick={() => tryMoveCanvas(props.selection, 0, 0.25)}/>
            <Button name="Move Down" size="sm"
                disabled={!canMoveCanvas(props.selection, 0, -0.25)}
                onClick={() => tryMoveCanvas(props.selection, 0, -0.25)}/>
        </div>
        <div className="flex flex-row gap-2 items-center">
            <TextInput size="sm" placeholder="Image URL" textInput={imageURL} setTextInput={setImageURL}/>
            <Button name="Set URL" size="sm" color="green"
                disabled={!canSetCanvasImageURL(props.selection, imageURL)}
                onClick={() => trySetCanvasImageURL(props.selection, imageURL)}/>
        </div>
    </div>;
}

function canRemoveCanvas(selection: PersistentObjectSelection): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;

    const objectId = selection.gameObject.params.objectId;
    return PersistentObjectUpdateUtil.canRemovePersistentObject(room, objectId);
}

function tryRemoveCanvas(selection: PersistentObjectSelection)
{
    if (!canRemoveCanvas(selection))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;
    const removed = PersistentObjectUpdateUtil.removePersistentObject(room, objectId);
    if (!removed)
        return;

    PersistentObjectSelection.unselect();
    ObjectManager.despawnObject(objectId);
    SocketsClient.emitUpdatePersistentObjectGroup(new RemovePersistentObjectParams(objectId));
}

function canMoveCanvas(selection: PersistentObjectSelection, dx: number, dy: number): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;

    const objectId = selection.gameObject.params.objectId;
    return PersistentObjectUpdateUtil.canMovePersistentObject(room, objectId, dx, dy, 0);
}

function tryMoveCanvas(selection: PersistentObjectSelection, dx: number, dy: number)
{
    if (!canMoveCanvas(selection, dx, dy))
        return;

    const room = App.getCurrentRoom()!;
    const objectId = selection.gameObject.params.objectId;
    const po = PersistentObjectUpdateUtil.movePersistentObject(room, objectId, dx, dy, 0);
    if (!po)
        return;

    selection.gameObject.forceSetPosition(new THREE.Vector3(po.x, po.y, po.z));
    const dirVec = DirUtil.dir4ToVec3(po.dir);
    selection.gameObject.forceSetDirection(new THREE.Vector3(
        po.x + dirVec.x, po.y + dirVec.y, po.z + dirVec.z
    ));
    persistentObjectSelectionObservable.notify();

    SocketsClient.emitUpdatePersistentObjectGroup(new MovePersistentObjectParams(objectId, dx, dy, 0));
}

function canSetCanvasImageURL(selection: PersistentObjectSelection, imageURL: string): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;

    const objectId = selection.gameObject.params.objectId;
    return PersistentObjectUpdateUtil.canSetPersistentObjectMetadata(room, objectId,
        ObjectMetadataKeyEnumMap.ImageURL, imageURL);
}

function trySetCanvasImageURL(selection: PersistentObjectSelection, imageURL: string)
{
    if (!canSetCanvasImageURL(selection, imageURL))
        return;

    const room = App.getCurrentRoom()!;

    if (imageURL.length > MAX_IMAGE_URL_LENGTH)
    {
        notificationMessageObservable.set(`Image URL is too long (max ${MAX_IMAGE_URL_LENGTH} characters).`);
        return;
    }

    const objectId = selection.gameObject.params.objectId;
    const po = PersistentObjectUpdateUtil.setPersistentObjectMetadata(room, objectId,
        ObjectMetadataKeyEnumMap.ImageURL, imageURL);
    if (!po) return;

    selection.gameObject.params.setMetadata(ObjectMetadataKeyEnumMap.ImageURL, imageURL);

    persistentObjectSelectionObservable.notify();
    SocketsClient.emitUpdatePersistentObjectGroup(
        new SetPersistentObjectMetadataParams(objectId, ObjectMetadataKeyEnumMap.ImageURL, imageURL));
}
