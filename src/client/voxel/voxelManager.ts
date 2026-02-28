import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import VoxelMeshInstancer from "../object/components/voxelMeshInstancer";
import { updateVoxelGridObservable, voxelQuadSelectionObservable } from "../system/clientObservables";
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
import { NUM_VOXEL_QUADS_PER_ROOM, VOXEL_GRID_TASK_TYPE_ADD, VOXEL_GRID_TASK_TYPE_MOVE, VOXEL_GRID_TASK_TYPE_REMOVE, VOXEL_GRID_TASK_TYPE_TEX } from "../../shared/system/sharedConstants";
import { voxelQuadChangeObservable } from "../../shared/system/sharedObservables";
import VoxelQuadChange from "../../shared/voxel/types/voxelQuadChange";
import AsyncUtil from "../../shared/system/util/asyncUtil";
import SignalTypeConfigMap from "../../shared/networking/maps/signalTypeConfigMap";

const VoxelManager =
{
    load: async (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        const isDevMode = App.getEnv().mode == "dev";
        setVoxelBlockUpdateUtilDebugEnabled(isDevMode);
        setVoxelQuadUpdateUtilDebugEnabled(isDevMode);
    },
    unload: async () =>
    {
    },
}

const waitUntilSignalProcessingReady = (signalType: string, successCond: () => boolean): Promise<boolean> =>
    AsyncUtil.waitUntilSuccess(successCond, SignalTypeConfigMap.getConfigByType(signalType).maxClientSideReceptionPeriod)

// When the client receives an UpdateVoxelGridParams signal from the server,
// the given voxelGrid-update will be applied as soon as the room to which it belongs is available.
updateVoxelGridObservable.addListener("voxelManager", async (params: UpdateVoxelGridParams) => {
    const success = await waitUntilSignalProcessingReady("updateVoxelGridParams",
        () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == params.roomID);
    if (!success)
        return;

    const room = App.getCurrentRoom()!;
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
                addVoxelBlock(room, addParams.quadIndex, addParams.quadTextureIndicesWithinLayer);
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
            default:
                console.error(`Unknown task type :: ${task.type}`);
                break;
        }
    }

    // After the voxelGrid mutation is applied, refresh the voxelQuad selection
    // to ensure it stays in sync with the updated grid state.
    const existingSelection = voxelQuadSelectionObservable.peek();
    if (existingSelection != null)
    {
        const quadIndex = existingSelection.quadIndex;

        // If the quadIndex doesn't even make sense, just unselect.
        if (quadIndex < 0 || quadIndex >= NUM_VOXEL_QUADS_PER_ROOM)
        {
            voxelQuadSelectionObservable.set(null);
            return;
        }

        // If the quad is hidden, just unselect.
        const quad = existingSelection.voxel.quadsMem.quads[quadIndex];
        if ((quad & 0b10000000) == 0)
        {
            voxelQuadSelectionObservable.set(null);
            return;
        }

        // Force-refresh the current selection (in order to update the UI, in case of a minor modification such as a texture change).
        voxelQuadSelectionObservable.notify();
    }
});

voxelQuadChangeObservable.addListener("voxelManager", async (change: VoxelQuadChange) => {
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Tried to change a voxelQuad, but the room is not found.");
        return;
    }
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