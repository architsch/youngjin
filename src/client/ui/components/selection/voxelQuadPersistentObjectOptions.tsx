import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import Button from "../basic/button";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../../shared/networking/types/encodableByteString";
import CanvasGameObject from "../../../object/types/canvasGameObject";
import { MAX_CANVASES_PER_ROOM, MID_ROOM_Y } from "../../../../shared/system/sharedConstants";
import ObjectUpdateUtil from "../../../../shared/object/util/objectUpdateUtil";
import ObjectFactory from "../../../object/factories/objectFactory";
import ObjectManager from "../../../object/objectManager";
import ObjectSpawnParams from "../../../../shared/object/types/objectSpawnParams";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import PersistentObjectSelection from "../../../graphics/types/gizmo/persistentObjectSelection";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

export default function VoxelQuadPersistentObjectOptions(props: {selection: VoxelQuadSelection})
{
    return <div className="flex flex-col gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <div className="flex flex-row gap-2">
            <Button name="Add Canvas" size="sm"
                disabled={!canAddObjectFromQuad(props.selection, canvasTypeIndex)}
                onClick={() => {
                    tryAddObjectFromQuad(props.selection, canvasTypeIndex,
                        {[ObjectMetadataKeyEnumMap.ImageURL]: new EncodableByteString("")});
                }}/>
        </div>
    </div>;
}

function canAddObjectFromQuad(selection: VoxelQuadSelection,
    objectTypeIndex: number): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;

    if (objectTypeIndex === canvasTypeIndex
        && CanvasGameObject.spawnedCanvasGameObjects.size >= MAX_CANVASES_PER_ROOM)
        return false;

    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ } =
        VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, quadIndex);

    if (dirY != 0)
        return false;

    const x = voxel.col + 0.5 + offsetX;
    const y = 0.5 * (offsetY < MID_ROOM_Y ? Math.ceil(2 * offsetY) : Math.floor(2 * offsetY));
    const z = voxel.row + 0.5 + offsetZ;

    return ObjectUpdateUtil.canAddObject(room, objectTypeIndex, x, y, z, dirX, dirY, dirZ);
}

async function tryAddObjectFromQuad(selection: VoxelQuadSelection,
    objectTypeIndex: number, metadata: {[key: number]: EncodableByteString})
{
    if (!canAddObjectFromQuad(selection, objectTypeIndex))
        return;

    const room = App.getCurrentRoom()!;
    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ } =
        VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, quadIndex);

    const x = voxel.col + 0.5 + offsetX;
    const y = 0.5 * (offsetY < MID_ROOM_Y ? Math.ceil(2 * offsetY) : Math.floor(2 * offsetY));
    const z = voxel.row + 0.5 + offsetZ;

    VoxelQuadSelection.unselect();

    // Add the object locally (generates objectId and increments counter)
    const objectId = `p${++room.lastObjectId}`;
    const objectSpawnParams = new ObjectSpawnParams(
        room.id, "", "", objectTypeIndex,
        objectId,
        new ObjectTransform(x, y, z, dirX, dirY, dirZ),
        metadata
    );
    const obj = ObjectUpdateUtil.addObject(room, objectId, objectTypeIndex,
        x, y, z, dirX, dirY, dirZ, metadata);
    if (!obj)
        return;

    // Track as speculative spawn so we can roll back the counter if the server rejects
    ObjectManager.speculativeSpawnObjectIds.add(objectId);

    // Send to server
    SocketsClient.emitObjectSpawn(objectSpawnParams);

    // Spawn the game object locally
    const gameObject = ObjectFactory.createServerSideObject(objectSpawnParams);
    await ObjectManager.spawnObject(gameObject);
    PersistentObjectSelection.trySelect(gameObject);
}
