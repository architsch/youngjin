import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import IconButton from "../basic/iconButton";
import TrashIcon from "../basic/icons/trashIcon";
import AddBlockIcon from "../basic/icons/addBlockIcon";
import AddCanvasIcon from "../basic/icons/addCanvasIcon";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../../shared/networking/types/encodableByteString";
import ObjectUpdateUtil from "../../../../shared/object/util/objectUpdateUtil";
import ObjectFactory from "../../../object/factories/objectFactory";
import ClientObjectManager from "../../../object/clientObjectManager";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import Vec3 from "../../../../shared/math/types/vec3";
import ErrorUtil from "../../../../shared/system/util/errorUtil";
import ImageMapUtil from "../../../../shared/image/util/imageMapUtil";
import ClientVoxelManager from "../../../voxel/clientVoxelManager";
import VoxelUpdateUtil from "../../../../shared/voxel/util/voxelUpdateUtil";
import RemoveVoxelBlockSignal from "../../../../shared/voxel/types/update/removeVoxelBlockSignal";
import Room from "../../../../shared/room/types/room";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../../../shared/system/sharedConstants";
import AddVoxelBlockSignal from "../../../../shared/voxel/types/update/addVoxelBlockSignal";
import ObjectIdUtil from "../../../../shared/object/util/objectIdUtil";
import { voxelQuadSelectionObservable } from "../../../system/clientObservables";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

export default function VoxelQuadPlacementOptions(props: {selection: VoxelQuadSelection})
{
    return <div className="flex flex-row gap-4 p-2 w-fit pointer-events-auto overflow-hidden bg-gray-800/50 rounded-md">
        <IconButton icon={<TrashIcon/>} size="md" color="red"
            disabled={!canRemoveVoxelBlock(props.selection)}
            onClick={() => tryRemoveVoxelBlock(props.selection)}/>
        <IconButton icon={<AddBlockIcon/>} size="md"
            disabled={!canAddVoxelBlock(props.selection)}
            onClick={() => tryAddVoxelBlock(props.selection)}/>
        <IconButton icon={<AddCanvasIcon/>} size="md"
            disabled={getPlaceableWallAttachedObjectTransform(props.selection, canvasTypeIndex) == null}
            onClick={() => {
                const randomImagePath = ImageMapUtil.getImageMap("CanvasImageMap").getRandomImagePath();
                tryAddObjectFromQuad(props.selection, canvasTypeIndex,
                    {[ObjectMetadataKeyEnumMap.ImagePath]: new EncodableByteString(randomImagePath)});
            }}
        />
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
        ObjectIdUtil.generateRandomObjectId(), upperTr);
    const lowerObj = new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex,
        ObjectIdUtil.generateRandomObjectId(), lowerTr);

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
        const objectId = ObjectIdUtil.generateRandomObjectId();
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

function canAddVoxelBlock(selection: VoxelQuadSelection): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;

    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    let newRow = voxel.row;
    let newCol = voxel.col;
    if (facingAxis == "z")
        newRow += (orientation == "+") ? 1 : -1;
    else if (facingAxis == "x")
        newCol += (orientation == "+") ? 1 : -1;

    let newCollisionLayer = collisionLayer;
    if (facingAxis == "y")
    {
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            newCollisionLayer = (orientation == "+") ? COLLISION_LAYER_MIN : COLLISION_LAYER_MAX;
        else
            newCollisionLayer += (orientation == "+") ? 1 : -1;
    }

    const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer);
    return VoxelUpdateUtil.canAddVoxelBlock(App.getCurrentUserRole(), room, targetQuadIndex);
}

function tryAddVoxelBlock(selection: VoxelQuadSelection)
{
    if (!canAddVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;
    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    let newRow = voxel.row;
    let newCol = voxel.col;
    if (facingAxis == "z")
        newRow += (orientation == "+") ? 1 : -1;
    else if (facingAxis == "x")
        newCol += (orientation == "+") ? 1 : -1;

    let newCollisionLayer = collisionLayer;
    if (facingAxis == "y")
    {
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            newCollisionLayer = (orientation == "+") ? COLLISION_LAYER_MIN : COLLISION_LAYER_MAX;
        else
            newCollisionLayer += (orientation == "+") ? 1 : -1;
    }

    const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
    const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, collisionLayer);
    for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        quadTextureIndicesWithinLayer[i - startIndex] = App.getVoxelQuads()[i] & 0b01111111;

    const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer);
    if (ClientVoxelManager.addVoxelBlock(room, targetQuadIndex, quadTextureIndicesWithinLayer))
    {
        const voxelFound = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, newRow, newCol);
        if (voxelFound)
            VoxelQuadSelection.trySelect(voxelFound, targetQuadIndex);
        SocketsClient.emitAddVoxelBlockSignal(new AddVoxelBlockSignal(room.id, targetQuadIndex, quadTextureIndicesWithinLayer));
    }
}

function canRemoveVoxelBlock(selection: VoxelQuadSelection): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;
    return VoxelUpdateUtil.canRemoveVoxelBlock(App.getCurrentUserRole(), room, selection.quadIndex);
}

function tryRemoveVoxelBlock(selection: VoxelQuadSelection)
{
    if (voxelQuadSelectionObservable.peek() != selection || !canRemoveVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;
    const quadIndex = selection.quadIndex;

    if (ClientVoxelManager.removeVoxelBlock(room, quadIndex))
    {
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);

        let dirIndex = -1;
        for (let i = 0; i < quadDirections.length; ++i)
        {
            const dir = quadDirections[i];
            if (dir.facingAxis == facingAxis && dir.orientation == orientation)
            {
                dirIndex = i;
                break;
            }
        }
        for (let i = 0; i < quadDirections.length; ++i)
        {
            const dir = quadDirections[dirIndex];
            if (trySelectNeighboringVoxelQuadInDirectionOfRemoval(
                room, quadIndex, dir.facingAxis, dir.orientation))
            {
                break;
            }
            dirIndex = (dirIndex + 1) % quadDirections.length;
        }

        SocketsClient.emitRemoveVoxelBlockSignal(new RemoveVoxelBlockSignal(room.id, quadIndex));
    }
}

function trySelectNeighboringVoxelQuadInDirectionOfRemoval(room: Room, quadIndex: number,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+"): boolean
{
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    const newRow = (facingAxis == "z") ? (orientation == "-" ? row+1 : row-1) : row;
    const newCol = (facingAxis == "x") ? (orientation == "-" ? col+1 : col-1) : col;
    const newCollisionLayer = (facingAxis == "y")
        ? VoxelQueryUtil.getVoxelQuadCollisionLayerAfterOffset(quadIndex, (orientation == "-") ? 1 : -1)
        : collisionLayer;
    const voxelFound = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, newRow, newCol);
    if (voxelFound)
    {
        return (VoxelQuadSelection.trySelect(voxelFound,
            VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer)));
    }
    else
        return false;
}

const quadDirections: { facingAxis: "x" | "y" | "z", orientation: "-" | "+" }[] = [
    { facingAxis: "y", orientation: "-" },
    { facingAxis: "y", orientation: "+" },
    { facingAxis: "x", orientation: "-" },
    { facingAxis: "x", orientation: "+" },
    { facingAxis: "z", orientation: "-" },
    { facingAxis: "z", orientation: "+" },
];