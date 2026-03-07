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
import { removePersistentObject, movePersistentObject, setPersistentObjectMetadata, directionStringToVector } from "../../../../shared/object/util/persistentObjectUpdateUtil";
import { notificationMessageObservable, persistentObjectSelectionObservable } from "../../../system/clientObservables";
import { MAX_IMAGE_URL_LENGTH } from "../../../../shared/system/sharedConstants";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import CanvasGameObject from "../../../object/types/canvasGameObject";
import ObjectFactory from "../../../object/factories/objectFactory";
import ObjectSpawnParams from "../../../../shared/object/types/objectSpawnParams";
import ObjectTransform from "../../../../shared/object/types/objectTransform";

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
    // TODO: Implement
    // (Hint: Make use of "PersistentObjectUpdateUtil.canRemovePersistentObject" to check conditions that are not strictly confined to the client side.)
    return true;
}

function tryRemoveCanvas(selection: PersistentObjectSelection)
{
    // TODO: Move over the precondition logic into "canRemoveCanvas", and simply call it to check whether the conditions are met.
    const room = App.getCurrentRoom();
    if (!room) return;

    const objectId = selection.gameObject.params.objectId;
    const removed = removePersistentObject(room, objectId);
    if (!removed) return;

    PersistentObjectSelection.unselect();
    ObjectManager.despawnObject(objectId);
    SocketsClient.emitUpdatePersistentObjectGroup(new RemovePersistentObjectParams(objectId));
}

function canMoveCanvas(selection: PersistentObjectSelection, dx: number, dy: number): boolean
{
    // TODO: Implement
    // (Hint: Make use of "PersistentObjectUpdateUtil.canMovePersistentObject" to check conditions that are not strictly confined to the client side.)
    return true;
}

function tryMoveCanvas(selection: PersistentObjectSelection, dx: number, dy: number)
{
    // TODO: Move over the precondition logic into "canMoveCanvas", and simply call it to check whether the conditions are met.
    const room = App.getCurrentRoom();
    if (!room) return;

    const objectId = selection.gameObject.params.objectId;
    const po = movePersistentObject(room, objectId, dx, dy, 0);
    if (!po) return;

    ObjectManager.despawnObject(objectId);

    const {dirX, dirY, dirZ} = directionStringToVector(po.direction);
    const objectSpawnParams = new ObjectSpawnParams(
        room.id, "", "", po.objectTypeIndex,
        po.objectId,
        new ObjectTransform(po.x, po.y, po.z, dirX, dirY, dirZ),
        po.metadata
    );
    const gameObject = ObjectFactory.createServerSideObject(objectSpawnParams);
    ObjectManager.spawnObject(gameObject).then(async () => {
        if (gameObject instanceof CanvasGameObject)
            await (gameObject as CanvasGameObject).loadImage();
        PersistentObjectSelection.trySelect(gameObject);
    });

    SocketsClient.emitUpdatePersistentObjectGroup(new MovePersistentObjectParams(objectId, dx, dy, 0));
}

function canSetCanvasImageURL(selection: PersistentObjectSelection, imageURL: string): boolean
{
    // TODO: Implement
    // (Hint: Make use of "PersistentObjectUpdateUtil.canSetPersistentObjectMetadata" to check conditions that are not strictly confined to the client side.)
    return true;
}

function trySetCanvasImageURL(selection: PersistentObjectSelection, imageURL: string)
{
    // TODO: Move over the precondition logic into "canSetCanvasImageURL", and simply call it to check whether the conditions are met.
    const room = App.getCurrentRoom();
    if (!room) return;

    if (imageURL.length > MAX_IMAGE_URL_LENGTH)
    {
        notificationMessageObservable.set(`Image URL is too long (max ${MAX_IMAGE_URL_LENGTH} characters).`);
        return;
    }

    const objectId = selection.gameObject.params.objectId;
    const po = setPersistentObjectMetadata(room, objectId,
        ObjectMetadataKeyEnumMap.ImageURL, imageURL);
    if (!po) return;

    selection.gameObject.params.setMetadata(ObjectMetadataKeyEnumMap.ImageURL, imageURL);

    if (selection.gameObject instanceof CanvasGameObject)
        (selection.gameObject as CanvasGameObject).loadImage();

    persistentObjectSelectionObservable.notify();
    SocketsClient.emitUpdatePersistentObjectGroup(
        new SetPersistentObjectMetadataParams(objectId, ObjectMetadataKeyEnumMap.ImageURL, imageURL));
}
