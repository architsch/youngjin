import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import VoxelMeshInstancer from "../object/components/voxelMeshInstancer";
import { updateVoxelGridObservable } from "../system/observables";
import MoveVoxelBlockParams from "../../shared/voxel/types/update/moveVoxelBlockParams";
import Room from "../../shared/room/types/room";
import ObjectManager from "../object/objectManager";
import App from "../app";
import { addVoxelBlock, moveVoxelBlock, removeVoxelBlock, setVoxelBlockUpdateUtilDebugEnabled } from "../../shared/voxel/util/voxelBlockUpdateUtil";
import { flushRecentVoxelQuadChanges, getRecentVoxelQuadChanges, setVoxelQuadUpdateUtilDebugEnabled, showVoxelQuad } from "../../shared/voxel/util/voxelQuadUpdateUtil";
import UpdateVoxelGridParams from "../../shared/voxel/types/update/updateVoxelGridParams";
import { getVoxel, getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex, getVoxelRowFromQuadIndex } from "../../shared/voxel/util/voxelQueryUtil";
import AddVoxelBlockParams from "../../shared/voxel/types/update/addVoxelBlockParams";
import RemoveVoxelBlockParams from "../../shared/voxel/types/update/removeVoxelBlockParams";
import SetVoxelQuadTextureParams from "../../shared/voxel/types/update/setVoxelQuadTextureParams";
import { VOXEL_GRID_TASK_TYPE_ADD, VOXEL_GRID_TASK_TYPE_MOVE, VOXEL_GRID_TASK_TYPE_REMOVE, VOXEL_GRID_TASK_TYPE_TEX } from "../../shared/system/constants";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";

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
            for (const task of params.tasks)
            {
                switch (task.type)
                {
                    case VOXEL_GRID_TASK_TYPE_MOVE:
                        await VoxelManager.moveVoxelBlockOnClientSide(room, task as MoveVoxelBlockParams);
                        break;
                    case VOXEL_GRID_TASK_TYPE_ADD:
                        await VoxelManager.addVoxelBlockOnClientSide(room, task as AddVoxelBlockParams);
                        break;
                    case VOXEL_GRID_TASK_TYPE_REMOVE:
                        await VoxelManager.removeVoxelBlockOnClientSide(room, task as RemoveVoxelBlockParams);
                        break;
                    case VOXEL_GRID_TASK_TYPE_TEX:
                        await VoxelManager.setVoxelQuadTextureOnClientSide(room, task as SetVoxelQuadTextureParams);
                        break;
                    default:
                        console.error(`Unknown task type :: ${task.type}`);
                        break;
                }
            }
            VoxelQuadSelection.refresh();
        });
    },
    unload: async () =>
    {
        // Remove listeners
        updateVoxelGridObservable.removeListener("room");
    },
    moveVoxelBlockOnClientSide: async (room: Room, params: MoveVoxelBlockParams): Promise<boolean> =>
    {
        return await tryUpdateVoxelOnClientSide(room, params.quadIndex, (room: Room): boolean =>
            moveVoxelBlock(room, params.quadIndex, params.rowOffset, params.colOffset, params.collisionLayerOffset));
    },
    addVoxelBlockOnClientSide: async (room: Room, params: AddVoxelBlockParams): Promise<boolean> =>
    {
        return await tryUpdateVoxelOnClientSide(room, params.quadIndex, (room: Room): boolean =>
            addVoxelBlock(room, params.quadIndex, params.quadTextureIndicesWithinLayer));
    },
    removeVoxelBlockOnClientSide: async (room: Room, params: RemoveVoxelBlockParams): Promise<boolean> =>
    {
        return await tryUpdateVoxelOnClientSide(room, params.quadIndex, (room: Room): boolean =>
            removeVoxelBlock(room, params.quadIndex));
    },
    setVoxelQuadTextureOnClientSide: async (room: Room, params: SetVoxelQuadTextureParams): Promise<boolean> =>
    {
        const quadIndex = params.quadIndex;
        const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const row = getVoxelRowFromQuadIndex(quadIndex);
        const col = getVoxelColFromQuadIndex(quadIndex);
        const voxel = getVoxel(room, row, col);
        if (!voxel)
        {
            console.error(`Voxel update failed (setVoxelQuadTextureOnClientSide) - voxel not found - params: ${JSON.stringify(params)}`);
            return false;
        }
        const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
        return await tryUpdateVoxelOnClientSide(room, quadIndex, (room: Room): boolean =>
            showVoxelQuad(voxel, facingAxis, orientation, collisionLayer, params.textureIndex));
    },
}

async function tryUpdateVoxelOnClientSide(room: Room, quadIndex: number, voxelUpdateAction: (room: Room) => boolean): Promise<boolean>
{
    if (!voxelUpdateAction(room))
    {
        console.warn(`Voxel update action failed (quadIndex: ${quadIndex})`);
        return false;
    }

    const recentChanges = getRecentVoxelQuadChanges();
    for (const change of recentChanges)
    {
        const quadIndex = change.quadIndex;
        const row = getVoxelRowFromQuadIndex(quadIndex);
        const col = getVoxelColFromQuadIndex(quadIndex);
        const instancer = getVoxelMeshInstancer(room, row, col);
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