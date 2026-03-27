import { voxelQuadSelectionObservable } from "../system/clientObservables";
import MoveVoxelBlockSignal from "../../shared/voxel/types/update/moveVoxelBlockSignal";
import Room from "../../shared/room/types/room";
import ClientObjectManager from "../object/clientObjectManager";
import App from "../app";
import VoxelUpdateUtil from "../../shared/voxel/util/voxelUpdateUtil";
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
    // --- Public methods for local (optimistic) operations ---

    addVoxelBlock: (room: Room, quadIndex: number, quadTextureIndicesWithinLayer: number[],
        validate: boolean = true): boolean =>
    {
        const userRole = App.getCurrentUserRole();
        return VoxelUpdateUtil.addVoxelBlock(userRole, room, quadIndex, quadTextureIndicesWithinLayer, validate);
    },
    removeVoxelBlock: (room: Room, quadIndex: number,
        validate: boolean = true): boolean =>
    {
        const userRole = App.getCurrentUserRole();
        return VoxelUpdateUtil.removeVoxelBlock(userRole, room, quadIndex, validate);
    },
    moveVoxelBlock: (room: Room, quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number,
        validate: boolean = true): boolean =>
    {
        const userRole = App.getCurrentUserRole();
        return VoxelUpdateUtil.moveVoxelBlock(userRole, room, quadIndex, rowOffset, colOffset, collisionLayerOffset, validate);
    },
    setVoxelQuadTexture: (room: Room, quadIndex: number, textureIndex: number,
        validate: boolean = true): boolean =>
    {
        const userRole = App.getCurrentUserRole();
        return VoxelUpdateUtil.setVoxelQuadTexture(userRole, room, quadIndex, textureIndex, validate);
    },

    // --- Signal reception handlers (for signals from other clients via server) ---

    onAddVoxelBlockSignalReceived: async (signal: AddVoxelBlockSignal) => {
        const success = await waitUntilSignalProcessingReady("addVoxelBlockSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientVoxelManager.addVoxelBlock(App.getCurrentRoom()!, signal.quadIndex,
            signal.quadTextureIndicesWithinLayer, false);
        refreshSelection();
    },
    onMoveVoxelBlockSignalReceived: async (signal: MoveVoxelBlockSignal) => {
        const success = await waitUntilSignalProcessingReady("moveVoxelBlockSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientVoxelManager.moveVoxelBlock(App.getCurrentRoom()!, signal.quadIndex,
            signal.rowOffset, signal.colOffset, signal.collisionLayerOffset, false);
        refreshSelection();
    },
    onRemoveVoxelBlockSignalReceived: async (signal: RemoveVoxelBlockSignal) => {
        const success = await waitUntilSignalProcessingReady("removeVoxelBlockSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientVoxelManager.removeVoxelBlock(App.getCurrentRoom()!,
            signal.quadIndex, false);
        refreshSelection();
    },
    onSetVoxelQuadTextureSignalReceived: async (signal: SetVoxelQuadTextureSignal) => {
        const success = await waitUntilSignalProcessingReady("setVoxelQuadTextureSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientVoxelManager.setVoxelQuadTexture(App.getCurrentRoom()!,
            signal.quadIndex, signal.textureIndex, false);
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
