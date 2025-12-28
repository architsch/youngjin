import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import VoxelMeshInstancer from "../object/components/voxelMeshInstancer";
import { updateVoxelGridObservable } from "../system/observables";
import MoveVoxelBlockParams from "../../shared/voxel/types/update/moveVoxelBlockParams";
import Room from "../../shared/room/types/room";
import ObjectManager from "../object/objectManager";
import App from "../app";
import { addVoxelBlock, moveVoxelBlock, removeVoxelBlock, setVoxelBlockUpdateUtilDebugEnabled } from "../../shared/voxel/util/voxelBlockUpdateUtil";
import { flushRecentVoxelQuadChanges, getRecentVoxelQuadChanges, setVoxelQuadTexture, setVoxelQuadUpdateUtilDebugEnabled } from "../../shared/voxel/util/voxelQuadUpdateUtil";
import UpdateVoxelGridParams from "../../shared/voxel/types/update/updateVoxelGridParams";
import { getVoxel, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex } from "../../shared/voxel/util/voxelQueryUtil";
import AddVoxelBlockParams from "../../shared/voxel/types/update/addVoxelBlockParams";
import RemoveVoxelBlockParams from "../../shared/voxel/types/update/removeVoxelBlockParams";
import SetVoxelQuadTextureParams from "../../shared/voxel/types/update/setVoxelQuadTextureParams";

const VoxelManager =
{
    load: async (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        const room = roomRuntimeMemory.room;

        const isDevMode = App.getEnv().mode == "dev";
        setVoxelBlockUpdateUtilDebugEnabled(isDevMode);
        setVoxelQuadUpdateUtilDebugEnabled(isDevMode);

        // Add listeners
        updateVoxelGridObservable.addListener("room", async (params: UpdateVoxelGridParams) => {
            for (const taskParams of params.moveVoxelBlockTasks)
                await VoxelManager.moveVoxelBlockOnClientSide(room, taskParams);
            for (const taskParams of params.addVoxelBlockTasks)
                await VoxelManager.addVoxelBlockOnClientSide(room, taskParams);
            for (const taskParams of params.removeVoxelBlockTasks)
                await VoxelManager.removeVoxelBlockOnClientSide(room, taskParams);
            for (const taskParams of params.setVoxelQuadTextureTasks)
                await VoxelManager.setVoxelQuadTextureOnClientSide(room, taskParams);
        });
    },
    unload: async () =>
    {
        // Remove listeners
        updateVoxelGridObservable.removeListener("room");
    },
    moveVoxelBlockOnClientSide: async (room: Room, params: MoveVoxelBlockParams): Promise<boolean> =>
    {
        const blockId = params.voxelBlockIdentifiers;
        return await tryUpdateVoxelOnClientSide(room, blockId.row, blockId.col, (room: Room): boolean =>
            moveVoxelBlock(room, blockId.row, blockId.col, blockId.collisionLayer,
                params.rowOffset, params.colOffset, params.collisionLayerOffset));
    },
    addVoxelBlockOnClientSide: async (room: Room, params: AddVoxelBlockParams): Promise<boolean> =>
    {
        const blockId = params.voxelBlockIdentifiers;
        return await tryUpdateVoxelOnClientSide(room, blockId.row, blockId.col, (room: Room): boolean =>
            addVoxelBlock(room, blockId.row, blockId.col, blockId.collisionLayer,
                params.quadTextureIndicesWithinLayer));
    },
    removeVoxelBlockOnClientSide: async (room: Room, params: RemoveVoxelBlockParams): Promise<boolean> =>
    {
        const blockId = params.voxelBlockIdentifiers;
        return await tryUpdateVoxelOnClientSide(room, blockId.row, blockId.col, (room: Room): boolean =>
            removeVoxelBlock(room, blockId.row, blockId.col, blockId.collisionLayer));
    },
    setVoxelQuadTextureOnClientSide: async (room: Room, params: SetVoxelQuadTextureParams): Promise<boolean> =>
    {
        const quadId = params.voxelQuadIdentifiers;
        const quadIndex = quadId.quadIndex;
        const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const voxel = getVoxel(room, quadId.row, quadId.col);
        if (!voxel)
        {
            console.error(`Voxel update failed (setVoxelQuadTextureOnClientSide) - voxel not found - params: ${JSON.stringify(params)}`);
            return false;
        }
        const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(voxel.collisionLayerMask, quadIndex);
        return await tryUpdateVoxelOnClientSide(room, quadId.row, quadId.col, (room: Room): boolean =>
            setVoxelQuadTexture(voxel, facingAxis, orientation, collisionLayer, params.textureIndex));
    },
}

async function tryUpdateVoxelOnClientSide(room: Room, row: number, col: number, voxelUpdateAction: (room: Room) => boolean): Promise<boolean>
{
    if (!voxelUpdateAction(room))
    {
        console.warn(`Voxel update action failed (row: ${row}, col: ${col})`);
        return false;
    }

    const recentChanges = getRecentVoxelQuadChanges();
    for (const change of recentChanges)
    {
        const instancer = getVoxelMeshInstancer(room, change.row, change.col);
        if (instancer)
            await instancer.applyVoxelQuadChange(change);
    }
    flushRecentVoxelQuadChanges();
    return true;
}

function getVoxelMeshInstancer(room: Room, row: number, col: number): VoxelMeshInstancer | null
{
    const voxel = getVoxel(room, row, col);
    if (!voxel)
    {
        console.error(`Voxel not found (row: ${row}, col: ${col})`);
        return null;
    }

    const obj = ObjectManager.getObjectById(voxel.gameObjectId);
    if (!obj)
    {
        console.error(`Voxel gameObject not found (row: ${row}, col: ${col})`);
        return null;
    }

    const instancer = obj.components.voxelMeshInstancer as VoxelMeshInstancer;
    if (!instancer)
    {
        console.error(`VoxelMeshInstancer not found (row: ${row}, col: ${col})`);
        return null;
    }
    return instancer;
}

export default VoxelManager;