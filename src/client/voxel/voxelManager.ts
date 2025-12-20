import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import VoxelMeshInstancer from "../object/components/voxelMeshInstancer";
import { voxelCubeAddObservable, voxelCubeRemoveObservable, voxelTextureChangeObservable } from "../system/observables";
import VoxelCubeAddParams from "../../shared/voxel/types/voxelCubeAddParams";
import RoomVoxelActions from "../../shared/room/roomVoxelActions";
import Room from "../../shared/room/types/room";
import ObjectManager from "../object/objectManager";
import VoxelTextureChangeParams from "../../shared/voxel/types/voxelTextureChangeParams";
import VoxelCubeRemoveParams from "../../shared/voxel/types/voxelCubeRemoveParams";
import App from "../app";

const VoxelManager =
{
    load: async (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        const room = roomRuntimeMemory.room;
        RoomVoxelActions.setDebugEnabled(App.getEnv().mode == "dev");

        // Add listeners
        voxelCubeAddObservable.addListener("room", async (params: VoxelCubeAddParams) => {
            await VoxelManager.addVoxelCubeOnClientSide(room, params);
        });
        voxelCubeRemoveObservable.addListener("room", async (params: VoxelCubeRemoveParams) => {
            await VoxelManager.removeVoxelCubeOnClientSide(room, params);
        });
        voxelTextureChangeObservable.addListener("room", async (params: VoxelTextureChangeParams) => {
            await VoxelManager.changeVoxelTextureOnClientSide(room, params);
        });
    },
    unload: async () =>
    {
        // Remove listeners
        voxelCubeAddObservable.removeListener("room");
        voxelCubeRemoveObservable.removeListener("room");
        voxelTextureChangeObservable.removeListener("room");
    },
    addVoxelCubeOnClientSide: async (room: Room, params: VoxelCubeAddParams): Promise<boolean> =>
    {
        return await tryUpdateVoxelOnClientSide(room, params.row, params.col, (room: Room): boolean =>
            RoomVoxelActions.addCube(room, params.row, params.col, params.yCenter, params.textureIndex));
    },
    removeVoxelCubeOnClientSide: async (room: Room, params: VoxelCubeRemoveParams): Promise<boolean> =>
    {
        return await tryUpdateVoxelOnClientSide(room, params.row, params.col, (room: Room): boolean =>
            RoomVoxelActions.removeCube(room, params.row, params.col, params.yCenter));
    },
    changeVoxelTextureOnClientSide: async (room: Room, params: VoxelTextureChangeParams): Promise<boolean> =>
    {
        return await tryUpdateVoxelOnClientSide(room, params.row, params.col, (room: Room): boolean =>
            RoomVoxelActions.changeVoxelTexture(room, params.row, params.col, params.quadIndex, params.textureIndex));
    },
}

async function tryUpdateVoxelOnClientSide(room: Room, row: number, col: number, voxelUpdateAction: (room: Room) => boolean): Promise<boolean>
{
    if (!voxelUpdateAction(room))
    {
        console.warn(`Voxel update action failed (row: ${row}, col: ${col})`);
        return false;
    }

    const recentChanges = RoomVoxelActions.getRecentChanges();
    for (const change of recentChanges)
    {
        const instancer = getVoxelMeshInstancer(room, change.row, change.col);
        if (instancer)
            await instancer.applyVoxelQuadChange(change);
    }
    RoomVoxelActions.flushRecentChanges();
    return true;
}

function getVoxelMeshInstancer(room: Room, row: number, col: number): VoxelMeshInstancer | null
{
    const voxel = RoomVoxelActions.getVoxel(room, row, col);
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