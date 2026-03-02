import { useState } from "react";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import Button from "../basic/button";
import TextInput from "../basic/textInput";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ObjectManager from "../../../object/objectManager";
import ObjectFactory from "../../../object/factories/objectFactory";
import ObjectSpawnParams from "../../../../shared/object/types/objectSpawnParams";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import AddPersistentObjectParams from "../../../../shared/object/types/update/addPersistentObjectParams";
import { addPersistentObject } from "../../../../shared/object/util/persistentObjectUpdateUtil";
import { getVoxelQuadTransformDimensions } from "../../../../shared/voxel/util/voxelQueryUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../../shared/networking/types/encodableByteString";
import { notificationMessageObservable, voxelQuadSelectionObservable } from "../../../system/clientObservables";
import PersistentObjectSelection from "../../../graphics/types/gizmo/persistentObjectSelection";
import CanvasGameObject from "../../../object/types/canvasGameObject";
import { MAX_CANVASES_PER_ROOM, MAX_IMAGE_URL_LENGTH, MAX_DESTINATION_ROOM_ID_LENGTH } from "../../../../shared/system/sharedConstants";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");

export default function VoxelQuadPersistentObjectOptions(props: {selection: VoxelQuadSelection})
{
    const [showCanvasForm, setShowCanvasForm] = useState(false);
    const [showDoorForm, setShowDoorForm] = useState(false);
    const [imageURL, setImageURL] = useState("");
    const [destRoomID, setDestRoomID] = useState("");

    return <div className="flex flex-col gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <div className="flex flex-row gap-2">
            <Button name="Add Canvas" size="sm" onClick={() => {
                setShowCanvasForm(!showCanvasForm);
                setShowDoorForm(false);
            }}/>
            <Button name="Add Door" size="sm" onClick={() => {
                setShowDoorForm(!showDoorForm);
                setShowCanvasForm(false);
            }}/>
        </div>
        {showCanvasForm && <div className="flex flex-row gap-2 items-center">
            <TextInput size="sm" placeholder="Image URL" textInput={imageURL} setTextInput={setImageURL}/>
            <Button name="Create" size="sm" color="green" onClick={() => {
                if (imageURL.length > MAX_IMAGE_URL_LENGTH)
                {
                    notificationMessageObservable.set(`Image URL is too long (max ${MAX_IMAGE_URL_LENGTH} characters).`);
                    return;
                }
                addPersistentObjectFromQuad(props.selection, canvasTypeIndex,
                    {[ObjectMetadataKeyEnumMap.ImageURL]: new EncodableByteString(imageURL)});
                setShowCanvasForm(false);
                setImageURL("");
            }}/>
        </div>}
        {showDoorForm && <div className="flex flex-row gap-2 items-center">
            <TextInput size="sm" placeholder="Destination Room ID" textInput={destRoomID} setTextInput={setDestRoomID}/>
            <Button name="Create" size="sm" color="green" onClick={() => {
                if (destRoomID.length > MAX_DESTINATION_ROOM_ID_LENGTH)
                {
                    notificationMessageObservable.set(`Destination Room ID is too long (max ${MAX_DESTINATION_ROOM_ID_LENGTH} characters).`);
                    return;
                }
                addPersistentObjectFromQuad(props.selection, doorTypeIndex,
                    {[ObjectMetadataKeyEnumMap.DestinationRoomID]: new EncodableByteString(destRoomID)});
                setShowDoorForm(false);
                setDestRoomID("");
            }}/>
        </div>}
    </div>;
}

function addPersistentObjectFromQuad(selection: VoxelQuadSelection,
    objectTypeIndex: number, metadata: {[key: number]: EncodableByteString})
{
    const room = App.getCurrentRoom();
    if (!room) return;

    if (objectTypeIndex === canvasTypeIndex
        && CanvasGameObject.spawnedCanvasGameObjects.size >= MAX_CANVASES_PER_ROOM)
    {
        notificationMessageObservable.set(`Cannot add more than ${MAX_CANVASES_PER_ROOM} canvases per room.`);
        return;
    }

    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ } =
        getVoxelQuadTransformDimensions(voxel, quadIndex);

    const x = voxel.col + 0.5 + offsetX;
    const y = offsetY;
    const z = voxel.row + 0.5 + offsetZ;

    let direction: "+z" | "+x" | "-z" | "-x" = "+z";
    if (dirX > 0) direction = "+x";
    else if (dirX < 0) direction = "-x";
    else if (dirZ > 0) direction = "+z";
    else if (dirZ < 0) direction = "-z";

    const po = addPersistentObject(room, objectTypeIndex, direction, x, y, z, metadata);
    if (!po) return;

    const objectSpawnParams = new ObjectSpawnParams(
        room.id, "", "", objectTypeIndex,
        po.objectId,
        new ObjectTransform(x, y, z, dirX, dirY, dirZ),
        metadata
    );
    const gameObject = ObjectFactory.createServerSideObject(objectSpawnParams);
    ObjectManager.spawnObject(gameObject).then(async () => {
        if (gameObject instanceof CanvasGameObject)
            await (gameObject as CanvasGameObject).loadImage();
        // Unselect voxel quad and select the new persistent object
        voxelQuadSelectionObservable.set(null);
        PersistentObjectSelection.trySelect(gameObject);
    });

    const dirNum = AddPersistentObjectParams.directionStringToNumber(direction);
    SocketsClient.emitUpdatePersistentObjectGroup(
        new AddPersistentObjectParams(objectTypeIndex, dirNum, x, y, z, metadata));
}
