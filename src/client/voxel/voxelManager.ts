import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import VoxelMeshInstancer from "../object/components/voxelMeshInstancer";
import { updateVoxelGridObservable } from "../system/clientObservables";
import MoveVoxelBlockParams from "../../shared/voxel/types/update/moveVoxelBlockParams";
import Room from "../../shared/room/types/room";
import ObjectManager from "../object/objectManager";
import App from "../app";
import { addVoxelBlock, moveVoxelBlock, removeVoxelBlock, setVoxelBlockUpdateUtilDebugEnabled } from "../../shared/voxel/util/voxelBlockUpdateUtil";
import { setVoxelQuadUpdateUtilDebugEnabled, setVoxelQuadVisible } from "../../shared/voxel/util/voxelQuadUpdateUtil";
import UpdateVoxelGridParams from "../../shared/voxel/types/update/updateVoxelGridParams";
import { getVoxel, getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex, getVoxelRowFromQuadIndex } from "../../shared/voxel/util/voxelQueryUtil";
import AddVoxelBlockParams from "../../shared/voxel/types/update/addVoxelBlockParams";
import RemoveVoxelBlockParams from "../../shared/voxel/types/update/removeVoxelBlockParams";
import SetVoxelQuadTextureParams from "../../shared/voxel/types/update/setVoxelQuadTextureParams";
import { VOXEL_GRID_TASK_TYPE_ADD, VOXEL_GRID_TASK_TYPE_MOVE, VOXEL_GRID_TASK_TYPE_REMOVE, VOXEL_GRID_TASK_TYPE_TEX } from "../../shared/system/constants";
import { voxelQuadChangeObservable } from "../../shared/system/sharedObservables";
import VoxelQuadChange from "../../shared/voxel/types/voxelQuadChange";

const VoxelManager =
{
    load: async (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        const room = roomRuntimeMemory.room;

        const isDevMode = App.getEnv().mode == "dev";
        setVoxelBlockUpdateUtilDebugEnabled(isDevMode);
        setVoxelQuadUpdateUtilDebugEnabled(isDevMode);

        // Add listeners
        updateVoxelGridObservable.addListener("room", (params: UpdateVoxelGridParams) => {
            for (const task of params.tasks)
            {
                switch (task.type)
                {
                    case VOXEL_GRID_TASK_TYPE_MOVE:
                        const moveParams = task as MoveVoxelBlockParams;
                        moveVoxelBlock(room, moveParams.quadIndex, moveParams.rowOffset, moveParams.colOffset, moveParams.collisionLayerOffset);
                        break;
                    case VOXEL_GRID_TASK_TYPE_ADD:
                        const addParams = task as AddVoxelBlockParams;
                        addVoxelBlock(room, addParams.quadIndex, /*addParams.xShrink, addParams.zShrink,*/ addParams.quadTextureIndicesWithinLayer);
                        break;
                    case VOXEL_GRID_TASK_TYPE_REMOVE:
                        const removeParams = task as RemoveVoxelBlockParams;
                        removeVoxelBlock(room, removeParams.quadIndex);
                        break;
                    case VOXEL_GRID_TASK_TYPE_TEX:
                        const texParams = task as SetVoxelQuadTextureParams;
                        const quadIndex = texParams.quadIndex;
                        const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
                        const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
                        const row = getVoxelRowFromQuadIndex(quadIndex);
                        const col = getVoxelColFromQuadIndex(quadIndex);
                        const voxel = getVoxel(room, row, col);
                        if (!voxel)
                        {
                            console.error(`Voxel update failed (VOXEL_GRID_TASK_TYPE_TEX) - voxel not found - params: ${JSON.stringify(params)}`);
                            return;
                        }
                        const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
                        setVoxelQuadVisible(true, voxel, facingAxis, orientation, collisionLayer, texParams.textureIndex);
                        break;
                    /*case VOXEL_GRID_TASK_TYPE_SHRINK_OR_EXPAND:
                        const shrinkOrExpandParams = task as ShrinkOrExpandVoxelBlockParams;
                        shrinkOrExpandVoxelBlock(room, shrinkOrExpandParams.quadIndex);
                        break;*/
                    default:
                        console.error(`Unknown task type :: ${task.type}`);
                        break;
                }
            }
        });
        voxelQuadChangeObservable.addListener("room", async (change: VoxelQuadChange) => {
            const quadIndex = change.quadIndex;
            const row = getVoxelRowFromQuadIndex(quadIndex);
            const col = getVoxelColFromQuadIndex(quadIndex);
            const instancer = getVoxelMeshInstancer(room, row, col);
            console.log("applyVoxelQuadChange?");
            if (instancer)
                await instancer.applyVoxelQuadChange(change);
            else
                console.error(`VoxelMeshInstancer is missing (change = ${String(change)})`);
        });
    },
    unload: async () =>
    {
        // Remove listeners
        updateVoxelGridObservable.removeListener("room");
        voxelQuadChangeObservable.removeListener("room");
    },
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