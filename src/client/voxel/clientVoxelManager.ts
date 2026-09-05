import { objectSelectionObservable, texturePackURLObservable, voxelQuadSelectionObservable } from "../system/clientObservables";
import MoveVoxelBlockSignal from "../../shared/voxel/types/update/moveVoxelBlockSignal";
import Room from "../../shared/room/types/room";
import ClientObjectManager from "../object/clientObjectManager";
import App from "../app";
import VoxelUpdateUtil from "../../shared/voxel/util/voxelUpdateUtil";
import VoxelQueryUtil from "../../shared/voxel/util/voxelQueryUtil";
import AddVoxelBlockSignal from "../../shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import SetRestrictedZonesSignal from "../../shared/voxel/types/update/setRestrictedZonesSignal";
import RestrictedZone from "../../shared/voxel/types/restrictedZone";
import RestrictedZoneUtil from "../../shared/voxel/util/restrictedZoneUtil";
import { voxelQuadChangeObservable } from "../../shared/system/sharedObservables";
import VoxelQuadChange from "../../shared/voxel/types/voxelQuadChange";
import AsyncUtil from "../../shared/system/util/asyncUtil";
import SignalTypeConfigMap from "../../shared/networking/maps/signalTypeConfigMap";
import VoxelGameObject from "../object/types/voxelGameObject";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";
import InstancedMeshGraphics from "../object/components/instancedMeshGraphics";
import ImageMapUtil from "../../shared/graphics/image/util/imageMapUtil";
import ClientEventHistoryUtil from "../system/util/clientEventHistoryUtil";
import ClientVoxelQueryUtil from "./util/clientVoxelQueryUtil";
import ClientEvent from "../system/types/clientEvent";
import { ClientEventType } from "../system/types/clientEventType";

const ClientVoxelManager =
{
    load: async (): Promise<void> =>
    {
        // Apply the current room's texture pack to the shared voxel material before the voxels spawn
        // (so the first room's voxels pick up the right texture) or are rebound (so a later room with a
        // different pack swaps its texture in place). Must run before ClientObjectManager.load.
        await ClientVoxelManager.applyVoxelTexturePack(App.getCurrentRoom()!.texturePackPath);
        voxelQuadChangeObservable.addListener("clientVoxelManager", onVoxelQuadChange);
    },
    applyVoxelTexturePack: async (texturePackPath: string): Promise<void> =>
    {
        const texturePackURL = ImageMapUtil.getImageMap("VoxelTexturePackImageMap")
            .getImageURLByPath(App.getEnv().assets_url, texturePackPath);
        if (texturePackURLObservable.peek() === texturePackURL)
            return;

        // Before the first voxel spawns, no voxel material exists yet: skip the in-place swap and just
        // publish the URL, so the first VoxelGameObject's constructor initializes its material with this
        // texture pack. Once a material exists (e.g. a later room with a different pack), swap its texture
        // in place instead.
        if (VoxelGameObject.materialParams != undefined)
            await InstancedMeshGraphics.swapTexturePackTexture(
                ClientVoxelQueryUtil.getVoxelInstancedMeshId(), texturePackURL);
        texturePackURLObservable.set(texturePackURL);
    },
    unload: () =>
    {
        voxelQuadChangeObservable.removeListener("clientVoxelManager");
    },
    // --- Edits to the current room's voxel grid ---
    //
    // "validate" says whether the edit has to be checked against what the user is allowed to do,
    // and so also says who asked for it: an edit the user made himself is checked, while one
    // arriving from the server or from a scripted step is not.

    addVoxelBlock: (room: Room, quadIndex: number, quadTextureIndicesWithinLayer?: number[],
        validate: boolean = true): boolean =>
    {
        const success = VoxelUpdateUtil.addVoxelBlock(App.getUser(), room.voxelGrid.voxels,
            quadIndex, quadTextureIndicesWithinLayer, validate ? room : undefined);
        if (success && validate)
            ClientEventHistoryUtil.add(new ClientEvent(ClientEventType.ManuallyAddedVoxelBlock));
        return success;
    },
    addVoxelBlocksByChunk: (room: Room, rowStart: number, colStart: number,
        numRows: number, numCols: number, collisionLayerMin: number, collisionLayerMax: number,
        quadTextureIndicesWithinLayer?: number[], validate: boolean = true): boolean =>
    {
        for (let row = rowStart; row < rowStart + numRows; ++row)
        {
            for (let col = colStart; col < colStart + numCols; ++col)
            {
                for (let collisionLayer = collisionLayerMin; collisionLayer <= collisionLayerMax; ++collisionLayer)
                {
                    const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(row, col, "x", "+", collisionLayer);
                    VoxelUpdateUtil.addVoxelBlock(App.getUser(), room.voxelGrid.voxels,
                        quadIndex, quadTextureIndicesWithinLayer, validate ? room : undefined);
                }
            }
        }
        return true;
    },
    removeVoxelBlock: (room: Room, quadIndex: number,
        validate: boolean = true): boolean =>
    {
        const success = VoxelUpdateUtil.removeVoxelBlock(App.getUser(), room.voxelGrid.voxels,
            quadIndex, validate ? room : undefined);
        if (success && validate)
            ClientEventHistoryUtil.add(new ClientEvent(ClientEventType.ManuallyRemovedVoxelBlock));
        return success;
    },
    removeVoxelBlocksByChunk: (room: Room, rowStart: number, colStart: number,
        numRows: number, numCols: number, collisionLayerMin: number, collisionLayerMax: number,
        validate: boolean = true): boolean =>
    {
        for (let row = rowStart; row < rowStart + numRows; ++row)
        {
            for (let col = colStart; col < colStart + numCols; ++col)
            {
                for (let collisionLayer = collisionLayerMin; collisionLayer <= collisionLayerMax; ++collisionLayer)
                {
                    const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(row, col, "x", "+", collisionLayer);
                    VoxelUpdateUtil.removeVoxelBlock(App.getUser(), room.voxelGrid.voxels,
                        quadIndex, validate ? room : undefined);
                }
            }
        }
        return true;
    },
    moveVoxelBlock: (room: Room, quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number,
        validate: boolean = true): boolean =>
    {
        return VoxelUpdateUtil.moveVoxelBlock(App.getUser(), room.voxelGrid.voxels,
            quadIndex, rowOffset, colOffset, collisionLayerOffset, validate ? room : undefined);
    },
    setVoxelQuadTexture: (room: Room, quadIndex: number, textureIndex: number,
        validate: boolean = true): boolean =>
    {
        const success = VoxelUpdateUtil.setVoxelQuadTexture(App.getUser(), room.voxelGrid.voxels,
            quadIndex, textureIndex, validate ? room : undefined);
        if (success && validate)
            ClientEventHistoryUtil.add(new ClientEvent(ClientEventType.ManuallyChangedVoxelQuadTexture));
        return success;
    },
    // Redraws the room's restricted zones. Reporting the change to the server is the caller's, as it
    // is for every other edit here — see voxelQuadTextureOptions for the pattern.
    setRestrictedZones: (room: Room, restrictedZones: RestrictedZone[],
        validate: boolean = true): boolean =>
    {
        return RestrictedZoneUtil.setRestrictedZones(App.getUser(), room, restrictedZones, validate);
    },

    // --- Signal reception handlers (for signals from other clients via server) ---

    onAddVoxelBlockSignalReceived: async (signal: AddVoxelBlockSignal) => {
        const success = await waitUntilSignalProcessingReady("addVoxelBlockSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientVoxelManager.addVoxelBlock(App.getCurrentRoom()!, signal.quadIndex,
            signal.quadTextureIndicesWithinLayer, false);
        refreshSelections();
    },
    onMoveVoxelBlockSignalReceived: async (signal: MoveVoxelBlockSignal) => {
        const success = await waitUntilSignalProcessingReady("moveVoxelBlockSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientVoxelManager.moveVoxelBlock(App.getCurrentRoom()!, signal.quadIndex,
            signal.rowOffset, signal.colOffset, signal.collisionLayerOffset, false);
        refreshSelections();
    },
    onRemoveVoxelBlockSignalReceived: async (signal: RemoveVoxelBlockSignal) => {
        const success = await waitUntilSignalProcessingReady("removeVoxelBlockSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientVoxelManager.removeVoxelBlock(App.getCurrentRoom()!,
            signal.quadIndex, false);
        refreshSelections();
    },
    onSetVoxelQuadTextureSignalReceived: async (signal: SetVoxelQuadTextureSignal) => {
        const success = await waitUntilSignalProcessingReady("setVoxelQuadTextureSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientVoxelManager.setVoxelQuadTexture(App.getCurrentRoom()!,
            signal.quadIndex, signal.textureIndex, false);
        refreshSelections();
    },
    onSetRestrictedZonesSignalReceived: async (signal: SetRestrictedZonesSignal) => {
        const success = await waitUntilSignalProcessingReady("setRestrictedZonesSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientVoxelManager.setRestrictedZones(App.getCurrentRoom()!, signal.restrictedZones, false);

        // The selection is refreshed like any other edit's: a zone drawn over what the user has
        // picked out is the moment that selection stops being his to work on.
        refreshSelections();
    },
}

// Brings whatever the user has picked out back into line with the room as it now stands. Called
// after every edit that arrives from elsewhere, because an edit to the room can change what the
// selected thing is, where it is, or whether it is still the user's to work on at all — and the
// tools on screen are worked out from all three.
//
// Both kinds of selection are seen to, not only the one the edit was made to. Only one of the two is
// ever up at a time, so the other's announcement reaches nobody; and an edit to the room's fabric
// can perfectly well be what changes what may be done to a thing standing in it — a restricted zone
// drawn over the stretch of floor a picture hangs on being the clearest case.
function refreshSelections()
{
    const existingSelection = voxelQuadSelectionObservable.peek();
    if (existingSelection != null)
    {
        const quadIndex = existingSelection.quadIndex;

        // If the quadIndex doesn't even make sense, just unselect.
        if (!VoxelQueryUtil.isValidVoxelQuadIndex(quadIndex))
        {
            VoxelQuadSelection.unselect();
            return;
        }

        // If the quad is hidden, select a nearby visible quad.
        const quad = existingSelection.voxel.quadsMem.quads[quadIndex];
        if ((quad & 0b10000000) == 0)
        {
            VoxelQuadSelection.unselect();
            VoxelQuadSelection.trySelectBestQuad(existingSelection.voxel, quadIndex);
            return;
        }

        // Force-refresh the current selection (in order to update the UI, in case of a minor modification such as a texture change).
        voxelQuadSelectionObservable.notify();
    }

    if (objectSelectionObservable.peek() != null)
        objectSelectionObservable.notify();
}

async function onVoxelQuadChange(change: VoxelQuadChange): Promise<void>
{
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
}

function getVoxelGameObject(room: Room, row: number, col: number): VoxelGameObject | null
{
    const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
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
