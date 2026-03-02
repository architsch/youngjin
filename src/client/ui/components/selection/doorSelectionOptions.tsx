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
import { MAX_DESTINATION_ROOM_ID_LENGTH } from "../../../../shared/system/sharedConstants";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import DoorGameObject from "../../../object/types/doorGameObject";
import ObjectFactory from "../../../object/factories/objectFactory";
import ObjectSpawnParams from "../../../../shared/object/types/objectSpawnParams";
import ObjectTransform from "../../../../shared/object/types/objectTransform";

export default function DoorSelectionOptions(props: {selection: PersistentObjectSelection})
{
    const go = props.selection.gameObject;
    const currentDestRoomID = go.params.hasMetadata(ObjectMetadataKeyEnumMap.DestinationRoomID)
        ? go.params.getMetadata(ObjectMetadataKeyEnumMap.DestinationRoomID)
        : "";
    const [destRoomID, setDestRoomID] = useState(currentDestRoomID);

    return <div className="flex flex-col gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <div className="flex flex-row gap-2">
            <Button name="Enter" size="sm" color="green" onClick={() => enterDoor(props.selection)}/>
            <Button name="Remove" size="sm" color="red" onClick={() => removeDoor(props.selection)}/>
            <Button name="Move Left" size="sm" onClick={() => moveDoor(props.selection, -0.5, 0)}/>
            <Button name="Move Right" size="sm" onClick={() => moveDoor(props.selection, 0.5, 0)}/>
            <Button name="Move Up" size="sm" onClick={() => moveDoor(props.selection, 0, 0.25)}/>
            <Button name="Move Down" size="sm" onClick={() => moveDoor(props.selection, 0, -0.25)}/>
        </div>
        <div className="flex flex-row gap-2 items-center">
            <TextInput size="sm" placeholder="Destination Room ID" textInput={destRoomID} setTextInput={setDestRoomID}/>
            <Button name="Set" size="sm" color="green" onClick={() => setDoorDestination(props.selection, destRoomID)}/>
        </div>
    </div>;
}

function enterDoor(selection: PersistentObjectSelection)
{
    const go = selection.gameObject;
    if (go instanceof DoorGameObject)
        (go as DoorGameObject).enter();
}

function removeDoor(selection: PersistentObjectSelection)
{
    const room = App.getCurrentRoom();
    if (!room) return;

    const objectId = selection.gameObject.params.objectId;
    const removed = removePersistentObject(room, objectId);
    if (!removed) return;

    persistentObjectSelectionObservable.set(null);
    ObjectManager.despawnObject(objectId);
    SocketsClient.emitUpdatePersistentObjectGroup(new RemovePersistentObjectParams(objectId));
}

function moveDoor(selection: PersistentObjectSelection, dx: number, dy: number)
{
    const room = App.getCurrentRoom();
    if (!room) return;

    const oldObjectId = selection.gameObject.params.objectId;
    const po = movePersistentObject(room, oldObjectId, dx, dy);
    if (!po) return;

    ObjectManager.despawnObject(oldObjectId);

    const {dirX, dirY, dirZ} = directionStringToVector(po.direction);
    const objectSpawnParams = new ObjectSpawnParams(
        room.id, "", "", po.objectTypeIndex,
        po.objectId,
        new ObjectTransform(po.x, po.y, po.z, dirX, dirY, dirZ),
        po.metadata
    );
    const gameObject = ObjectFactory.createServerSideObject(objectSpawnParams);
    ObjectManager.spawnObject(gameObject).then(() => {
        PersistentObjectSelection.trySelect(gameObject);
    });

    SocketsClient.emitUpdatePersistentObjectGroup(new MovePersistentObjectParams(oldObjectId, dx, dy));
}

function setDoorDestination(selection: PersistentObjectSelection, destRoomID: string)
{
    const room = App.getCurrentRoom();
    if (!room) return;

    if (destRoomID.length > MAX_DESTINATION_ROOM_ID_LENGTH)
    {
        notificationMessageObservable.set(`Destination Room ID is too long (max ${MAX_DESTINATION_ROOM_ID_LENGTH} characters).`);
        return;
    }

    const objectId = selection.gameObject.params.objectId;
    const po = setPersistentObjectMetadata(room, objectId,
        ObjectMetadataKeyEnumMap.DestinationRoomID, destRoomID);
    if (!po) return;

    selection.gameObject.params.setMetadata(ObjectMetadataKeyEnumMap.DestinationRoomID, destRoomID);
    persistentObjectSelectionObservable.notify();
    SocketsClient.emitUpdatePersistentObjectGroup(
        new SetPersistentObjectMetadataParams(objectId, ObjectMetadataKeyEnumMap.DestinationRoomID, destRoomID));
}
