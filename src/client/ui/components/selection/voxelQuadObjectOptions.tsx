import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import Button from "../basic/button";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../../shared/networking/types/encodableByteString";
import CanvasGameObject from "../../../object/types/canvasGameObject";
import { MAX_CANVASES_PER_ROOM } from "../../../../shared/system/sharedConstants";
import ObjectUpdateUtil from "../../../../shared/object/util/objectUpdateUtil";
import ObjectFactory from "../../../object/factories/objectFactory";
import ClientObjectManager from "../../../object/clientObjectManager";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import Vec3 from "../../../../shared/math/types/vec3";
import ErrorUtil from "../../../../shared/system/util/errorUtil";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

export default function VoxelQuadObjectOptions(props: {selection: VoxelQuadSelection})
{
    return <div className="flex flex-col gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <div className="flex flex-row gap-2">
            <Button name="Add Canvas" size="sm"
                disabled={getPlaceableWallAttachedObjectTransform(props.selection, canvasTypeIndex) == null}
                onClick={() => {
                    tryAddObjectFromQuad(props.selection, canvasTypeIndex,
                        {[ObjectMetadataKeyEnumMap.ImageURL]: new EncodableByteString("")});
                }}/>
        </div>
    </div>;
}

function getPlaceableWallAttachedObjectTransform(selection: VoxelQuadSelection,
    objectTypeIndex: number): ObjectTransform | null
{
    const room = App.getCurrentRoom();
    if (!room)
        return null;
    const user = App.getUser();
    const userRole = App.getCurrentUserRole();

    if (objectTypeIndex === canvasTypeIndex
        && CanvasGameObject.spawnedCanvasGameObjects.size >= MAX_CANVASES_PER_ROOM)
        return null;

    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ } =
        VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, quadIndex);

    if (dirY != 0)
        return null;

    const x = voxel.col + 0.5 + offsetX;
    const yUpper = 0.5 * Math.ceil(2 * offsetY);
    const yLower = 0.5 * Math.floor(2 * offsetY);
    const z = voxel.row + 0.5 + offsetZ;

    const upperPos: Vec3 = {x, y: yUpper, z};
    const lowerPos: Vec3 = {x, y: yLower, z};
    const dir: Vec3 = {x: dirX, y: dirY, z: dirZ};

    const upperTr = new ObjectTransform(upperPos, dir);
    const lowerTr = new ObjectTransform(lowerPos, dir);
    const upperObj = new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex,
        generateRandomObjectId(), upperTr);
    const lowerObj = new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex,
        generateRandomObjectId(), lowerTr);

    if (ObjectUpdateUtil.canAddObject(user, userRole, room, upperObj))
        return upperTr;
    if (ObjectUpdateUtil.canAddObject(user, userRole, room, lowerObj))
        return lowerTr;
    return null;
}

async function tryAddObjectFromQuad(selection: VoxelQuadSelection,
    objectTypeIndex: number, metadata: {[key: number]: EncodableByteString})
{
    try {
        const tr = getPlaceableWallAttachedObjectTransform(selection, objectTypeIndex);
        if (tr == null)
            return;

        VoxelQuadSelection.unselect();

        const room = App.getCurrentRoom()!;
        const user = App.getUser();
        const objectId = generateRandomObjectId();
        const signal = new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex, objectId, tr, metadata);
        
        // Add the game object locally, and report it to the server if successful.
        const gameObject = ObjectFactory.createServerSideObject(signal);
        const success = await ClientObjectManager.addObject(gameObject);
        if (success)
        {
            SocketsClient.emitAddObjectSignal(signal);
            ObjectSelection.trySelect(gameObject);
        }
    } catch (err) {
        console.error(`Exception while trying to add an object from a voxelQuad :: Error: ${ErrorUtil.getErrorMessage(err)}`);
    }
}

const alphanumeric = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateRandomObjectId(): string
{
    let id = "";
    for (let i = 0; i < 8; i++)
        id += alphanumeric[Math.floor(Math.random() * alphanumeric.length)];
    return id;
}
