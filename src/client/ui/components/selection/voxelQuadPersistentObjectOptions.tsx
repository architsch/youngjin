import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import Button from "../basic/button";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import AddPersistentObjectParams from "../../../../shared/object/types/update/addPersistentObjectParams";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../../shared/networking/types/encodableByteString";
import CanvasGameObject from "../../../object/types/canvasGameObject";
import { MAX_CANVASES_PER_ROOM, MID_ROOM_Y } from "../../../../shared/system/sharedConstants";
import PersistentObjectUpdateUtil from "../../../../shared/object/util/persistentObjectUpdateUtil";
import DirUtil from "../../../../shared/math/util/dirUtil";
import ObjectFactory from "../../../object/factories/objectFactory";
import ObjectManager from "../../../object/objectManager";
import ObjectSpawnParams from "../../../../shared/object/types/objectSpawnParams";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import PersistentObjectManager from "../../../object/persistentObjectManager";
import PersistentObjectSelection from "../../../graphics/types/gizmo/persistentObjectSelection";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

export default function VoxelQuadPersistentObjectOptions(props: {selection: VoxelQuadSelection})
{
    return <div className="flex flex-col gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <div className="flex flex-row gap-2">
            <Button name="Add Canvas" size="sm"
                disabled={!canAddPersistentObjectFromQuad(props.selection, canvasTypeIndex)}
                onClick={() => {
                    tryAddPersistentObjectFromQuad(props.selection, canvasTypeIndex,
                        {[ObjectMetadataKeyEnumMap.ImageURL]: new EncodableByteString("")});
                }}/>
        </div>
    </div>;
}

function canAddPersistentObjectFromQuad(selection: VoxelQuadSelection,
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
    const dir = DirUtil.vec3ToDir4({x: dirX, y: dirY, z: dirZ});

    return PersistentObjectUpdateUtil.canAddPersistentObject(room, objectTypeIndex, dir, x, y, z);
}

async function tryAddPersistentObjectFromQuad(selection: VoxelQuadSelection,
    objectTypeIndex: number, metadata: {[key: number]: EncodableByteString})
{
    if (!canAddPersistentObjectFromQuad(selection, objectTypeIndex))
        return;

    const room = App.getCurrentRoom()!;
    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ } =
        VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, quadIndex);

    const x = voxel.col + 0.5 + offsetX;
    const y = 0.5 * (offsetY < MID_ROOM_Y ? Math.ceil(2 * offsetY) : Math.floor(2 * offsetY));
    const z = voxel.row + 0.5 + offsetZ;
    const dir = DirUtil.vec3ToDir4({x: dirX, y: dirY, z: dirZ});

    VoxelQuadSelection.unselect();

    // Add the persistent object locally (generates objectId and increments counter)
    const objectId = `p${++room.persistentObjectGroup.lastPersistentObjectId}`;
    const po = PersistentObjectUpdateUtil.addPersistentObject(room, objectId, objectTypeIndex, dir, x, y, z, metadata);
    if (!po)
        return;

    // Track as speculative add so we can roll back the counter if the server rejects
    PersistentObjectManager.speculativeAddObjectIds.add(po.objectId);

    // Send to server with the client-computed objectId
    SocketsClient.emitUpdatePersistentObjectGroup(
        new AddPersistentObjectParams(objectTypeIndex, dir, x, y, z, metadata, po.objectId));

    // Spawn the game object locally
    const dirVec = DirUtil.dir4ToVec3(dir);
    const objectSpawnParams = new ObjectSpawnParams(
        room.id, "", "", objectTypeIndex,
        po.objectId,
        new ObjectTransform(x, y, z, dirVec.x, dirVec.y, dirVec.z),
        metadata
    );
    const gameObject = ObjectFactory.createServerSideObject(objectSpawnParams);
    await ObjectManager.spawnObject(gameObject);
    PersistentObjectSelection.trySelect(gameObject);
}
