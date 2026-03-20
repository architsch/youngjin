import { voxelQuadSelectionObservable } from "../system/clientObservables";
import MoveVoxelBlockSignal from "../../shared/voxel/types/update/moveVoxelBlockSignal";
import Room from "../../shared/room/types/room";
import ClientObjectManager from "../object/clientObjectManager";
import App from "../app";
import VoxelBlockUpdateUtil from "../../shared/voxel/util/voxelBlockUpdateUtil";
import VoxelQuadUpdateUtil from "../../shared/voxel/util/voxelQuadUpdateUtil";
import VoxelQueryUtil from "../../shared/voxel/util/voxelQueryUtil";
import AddVoxelBlockSignal from "../../shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import { NUM_VOXEL_QUADS_PER_ROOM } from "../../shared/system/sharedConstants";
import { voxelQuadChangeObservable } from "../../shared/system/sharedObservables";
import VoxelQuadChange from "../../shared/voxel/types/voxelQuadChange";
import AsyncUtil from "../../shared/system/util/asyncUtil";
import SignalTypeConfigMap from "../../shared/networking/maps/signalTypeConfigMap";
import VoxelGameObject from "../object/types/voxelGameObject";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";

const ClientVoxelManager =
{
    onAddVoxelBlockSignalReceived: async (params: AddVoxelBlockSignal) => {
        const success = await waitUntilSignalProcessingReady("addVoxelBlockSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == params.roomID);
        if (!success)
            return;

        const room = App.getCurrentRoom()!;
        VoxelBlockUpdateUtil.addVoxelBlock(room, params.quadIndex, params.quadTextureIndicesWithinLayer);
        refreshSelection();
    },

    onMoveVoxelBlockSignalReceived: async (params: MoveVoxelBlockSignal) => {
        const success = await waitUntilSignalProcessingReady("moveVoxelBlockSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == params.roomID);
        if (!success)
            return;

        const room = App.getCurrentRoom()!;
        VoxelBlockUpdateUtil.moveVoxelBlock(room, params.quadIndex, params.rowOffset, params.colOffset, params.collisionLayerOffset);
        refreshSelection();
    },

    onRemoveVoxelBlockSignalReceived: async (params: RemoveVoxelBlockSignal) => {
        const success = await waitUntilSignalProcessingReady("removeVoxelBlockSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == params.roomID);
        if (!success)
            return;

        const room = App.getCurrentRoom()!;
        VoxelBlockUpdateUtil.removeVoxelBlock(room, params.quadIndex);
        refreshSelection();
    },

    onSetVoxelQuadTextureSignalReceived: async (params: SetVoxelQuadTextureSignal) => {
        const success = await waitUntilSignalProcessingReady("setVoxelQuadTextureSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == params.roomID);
        if (!success)
            return;

        const room = App.getCurrentRoom()!;
        const quadIndex = params.quadIndex;
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const voxel = VoxelQueryUtil.getVoxel(room, row, col);
        if (!voxel)
        {
            console.error(`Voxel update failed (setVoxelQuadTexture) - voxel not found - params: ${JSON.stringify(params)}`);
            return;
        }
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
        VoxelQuadUpdateUtil.setVoxelQuadVisible(true, voxel, facingAxis, orientation, collisionLayer, params.textureIndex);
        refreshSelection();
    },
}

function refreshSelection()
{
    const existingSelection = voxelQuadSelectionObservable.peek();
    if (existingSelection != null)
    {
        const quadIndex = existingSelection.quadIndex;

        // If the quadIndex doesn't even make sense, just unselect.
        if (quadIndex < 0 || quadIndex >= NUM_VOXEL_QUADS_PER_ROOM)
        {
            VoxelQuadSelection.unselect();
            return;
        }

        // If the quad is hidden, just unselect.
        const quad = existingSelection.voxel.quadsMem.quads[quadIndex];
        if ((quad & 0b10000000) == 0)
        {
            VoxelQuadSelection.unselect();
            return;
        }

        // Force-refresh the current selection (in order to update the UI, in case of a minor modification such as a texture change).
        voxelQuadSelectionObservable.notify();
    }
}

voxelQuadChangeObservable.addListener("clientVoxelManager", async (change: VoxelQuadChange) => {
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Tried to change a voxelQuad, but the room is not found.");
        return;
    }
    const quadIndex = change.quadIndex;
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const voxelGameObject = getVoxelGameObject(room, row, col);

    if (voxelGameObject)
        await voxelGameObject.applyVoxelQuadChange(change);
    else
        console.error(`VoxelGameObject is missing (change = ${String(change)})`);
});

function getVoxelGameObject(room: Room, row: number, col: number): VoxelGameObject | null
{
    const voxel = VoxelQueryUtil.getVoxel(room, row, col);
    if (!voxel)
    {
        console.error(`Voxel not found (row: ${row}, col: ${col})`);
        return null;
    }

    const obj = ClientObjectManager.getObjectById(voxel.gameObjectId);
    if (!obj)
    {
        console.error(`Voxel gameObject not found (row: ${row}, col: ${col})`);
        return null;
    }

    const voxelGameObject = obj as VoxelGameObject;
    if (!voxelGameObject)
    {
        console.error(`VoxelGameObject not found (row: ${row}, col: ${col})`);
        return null;
    }
    return voxelGameObject;
}

const waitUntilSignalProcessingReady = (signalType: string, successCond: () => boolean): Promise<boolean> =>
    AsyncUtil.waitUntilSuccess(successCond, SignalTypeConfigMap.getConfigByType(signalType).maxClientSideReceptionPeriod)

export default ClientVoxelManager;
