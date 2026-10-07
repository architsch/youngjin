import { objectSelectionObservable, roomShapeChangedObservable, texturePackURLObservable, voxelBlockEditObservable,
    voxelBlockPreviewObservable, voxelQuadSelectionObservable } from "../system/clientObservables";
import Voxel from "../../shared/voxel/types/voxel";
import MoveVoxelBlockSignal from "../../shared/voxel/types/update/moveVoxelBlockSignal";
import Room from "../../shared/room/types/room";
import ClientObjectManager from "../object/clientObjectManager";
import App from "../app";
import VoxelUpdateUtil from "../../shared/voxel/util/voxelUpdateUtil";
import VoxelQueryUtil from "../../shared/voxel/util/voxelQueryUtil";
import AddVoxelBlockSignal from "../../shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import SetVoxelBlockShapeSignal from "../../shared/voxel/types/update/setVoxelBlockShapeSignal";
import { COLLISION_LAYER_NULL, VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_WHOLE } from "../../shared/system/sharedConstants";
import SetRestrictedZonesSignal from "../../shared/voxel/types/update/setRestrictedZonesSignal";
import RestrictedZone from "../../shared/voxel/types/restrictedZone";
import RestrictedZoneUtil from "../../shared/voxel/util/restrictedZoneUtil";
import { voxelQuadChangeObservable } from "../../shared/system/sharedObservables";
import VoxelQuadChange from "../../shared/voxel/types/voxelQuadChange";
import AsyncUtil from "../../shared/system/util/asyncUtil";
import SignalTypeConfigMap from "../../shared/networking/maps/signalTypeConfigMap";
import VoxelGameObject from "../object/types/gameObject/voxelGameObject";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";
import InstancedMeshGraphics from "../object/components/instancedMeshGraphics";
import ImageMapUtil from "../../shared/graphics/image/util/imageMapUtil";
import ClientEventHistoryUtil from "../system/util/clientEventHistoryUtil";
import ClientVoxelQueryUtil from "./util/clientVoxelQueryUtil";
import GraphicsManager from "../graphics/graphicsManager";
import ClientEvent from "../system/types/clientEvent";
import { ClientEventType } from "../system/types/clientEventType";

// The preview under way, if any: the block's first quad, the shape it had when the preview began, and the
// one it is shown in now.
let blockPreview: {roomID: string, quadIndex: number, originShape: number, shownShape: number} | null = null;

const ClientVoxelManager =
{
    load: async (): Promise<void> =>
    {
        // Must run before ClientObjectManager.load: sets the texture pack so new voxels use it, or
        // swaps it in place for rebound ones.
        await ClientVoxelManager.applyVoxelTexturePack(App.getCurrentRoom()!.texturePackPath);
        voxelQuadChangeObservable.addListener("clientVoxelManager", onVoxelQuadChange);

        // The block map outlives rooms; this also drops the previous room's lamps.
        GraphicsManager.getLightBlockMap().resetForRoom(App.getCurrentRoom()!.voxelGrid.voxels);
    },
    applyVoxelTexturePack: async (texturePackPath: string): Promise<void> =>
    {
        const texturePackURL = ImageMapUtil.getImageMap("VoxelTexturePackImageMap")
            .getImageURLByPath(App.getEnv().assets_url, texturePackPath);
        if (texturePackURLObservable.peek() === texturePackURL)
            return;

        // Before any voxel exists, just publish the URL (the first VoxelGameObject reads it);
        // afterwards swap the texture in place.
        if (VoxelGameObject.materialParams != undefined)
            await InstancedMeshGraphics.swapTexturePackTexture(
                ClientVoxelQueryUtil.getVoxelInstancedMeshId(), texturePackURL);
        texturePackURLObservable.set(texturePackURL);
    },
    unload: () =>
    {
        // (The room it was a preview of is going, so there is nothing to put back.)
        if (blockPreview != null)
        {
            blockPreview = null;
            voxelBlockPreviewObservable.set(false);
        }
        voxelQuadChangeObservable.removeListener("clientVoxelManager");
        GraphicsManager.getLightBlockMap().resetForRoom(undefined);
    },
    // --- Edits to the current room's voxel grid ---
    // validate: true for the user's own edits; false for server-relayed or scripted ones.

    addVoxelBlock: (room: Room, quadIndex: number, quadTextureIndicesWithinLayer?: number[],
        validate: boolean = true, shape: number = VOXEL_BLOCK_SHAPE_WHOLE): boolean =>
    {
        ClientVoxelManager.cancelVoxelBlockPreview();
        const success = VoxelUpdateUtil.addVoxelBlock(App.getUser(), room.voxelGrid.voxels,
            quadIndex, quadTextureIndicesWithinLayer, validate ? room : undefined, shape);
        if (success)
        {
            onRoomShapeChanged(room);
            voxelBlockEditObservable.set({kind: "add", quadIndex, shape: getBlockShape(room, quadIndex)});
        }
        if (success && validate)
            ClientEventHistoryUtil.add(new ClientEvent(ClientEventType.ManuallyAddedVoxelBlock));
        return success;
    },
    addVoxelBlocksByChunk: (room: Room, rowStart: number, colStart: number,
        numRows: number, numCols: number, collisionLayerMin: number, collisionLayerMax: number,
        quadTextureIndicesWithinLayer?: number[], validate: boolean = true,
        shape: number = VOXEL_BLOCK_SHAPE_WHOLE): boolean =>
    {
        ClientVoxelManager.cancelVoxelBlockPreview();
        for (let row = rowStart; row < rowStart + numRows; ++row)
        {
            for (let col = colStart; col < colStart + numCols; ++col)
            {
                for (let collisionLayer = collisionLayerMin; collisionLayer <= collisionLayerMax; ++collisionLayer)
                {
                    const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(row, col, "x", "+", collisionLayer);
                    VoxelUpdateUtil.addVoxelBlock(App.getUser(), room.voxelGrid.voxels,
                        quadIndex, quadTextureIndicesWithinLayer, validate ? room : undefined, shape);
                }
            }
        }
        onRoomShapeChanged(room);
        return true;
    },
    removeVoxelBlock: (room: Room, quadIndex: number,
        validate: boolean = true): boolean =>
    {
        ClientVoxelManager.cancelVoxelBlockPreview();
        const removedShape = getBlockShape(room, quadIndex);
        const success = VoxelUpdateUtil.removeVoxelBlock(App.getUser(), room.voxelGrid.voxels,
            quadIndex, validate ? room : undefined);
        // A relayed removal may find nothing to remove (see ServerVoxelManager), which is no event.
        if (success && removedShape != VOXEL_BLOCK_SHAPE_EMPTY)
        {
            onRoomShapeChanged(room);
            voxelBlockEditObservable.set({kind: "remove", quadIndex, shape: removedShape});
        }
        if (success && validate)
            ClientEventHistoryUtil.add(new ClientEvent(ClientEventType.ManuallyRemovedVoxelBlock));
        return success;
    },
    removeVoxelBlocksByChunk: (room: Room, rowStart: number, colStart: number,
        numRows: number, numCols: number, collisionLayerMin: number, collisionLayerMax: number,
        validate: boolean = true): boolean =>
    {
        ClientVoxelManager.cancelVoxelBlockPreview();
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
        onRoomShapeChanged(room);
        return true;
    },
    moveVoxelBlock: (room: Room, quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number,
        validate: boolean = true): boolean =>
    {
        ClientVoxelManager.cancelVoxelBlockPreview();
        const shape = getBlockShape(room, quadIndex);
        const success = VoxelUpdateUtil.moveVoxelBlock(App.getUser(), room.voxelGrid.voxels,
            quadIndex, rowOffset, colOffset, collisionLayerOffset, validate ? room : undefined);
        if (success)
        {
            onRoomShapeChanged(room);
            voxelBlockEditObservable.set({kind: "move", quadIndex, shape});
        }
        return success;
    },
    setVoxelBlockShape: (room: Room, quadIndex: number, shape: number,
        validate: boolean = true): boolean =>
    {
        ClientVoxelManager.cancelVoxelBlockPreview();
        const success = VoxelUpdateUtil.setVoxelBlockShape(App.getUser(), room.voxelGrid.voxels,
            quadIndex, shape, validate ? room : undefined);
        if (success)
        {
            onRoomShapeChanged(room);
            voxelBlockEditObservable.set({kind: "reshape", quadIndex, shape});
        }
        return success;
    },
    setVoxelQuadTexture: (room: Room, quadIndex: number, textureIndex: number,
        validate: boolean = true): boolean =>
    {
        ClientVoxelManager.cancelVoxelBlockPreview();
        const success = VoxelUpdateUtil.setVoxelQuadTexture(App.getUser(), room.voxelGrid.voxels,
            quadIndex, textureIndex, validate ? room : undefined);
        if (success)
            voxelBlockEditObservable.set({kind: "retexture", quadIndex, shape: getBlockShape(room, quadIndex)});
        if (success && validate)
            ClientEventHistoryUtil.add(new ClientEvent(ClientEventType.ManuallyChangedVoxelQuadTexture));
        return success;
    },
    // Redraws zone outlines. Sending to the server is the caller's job (see voxelQuadTextureOptions).
    setRestrictedZones: (room: Room, restrictedZones: RestrictedZone[],
        validate: boolean = true): boolean =>
    {
        ClientVoxelManager.cancelVoxelBlockPreview();
        return RestrictedZoneUtil.setRestrictedZones(App.getUser(), room, restrictedZones, validate);
    },

    // --- A block's shape previewed while a drag lasts (see VoxelQuadEditGizmos) ---
    // Each step shows in the room at once, and the server hears of the whole as one edit when it is
    // committed. So each step is asked about as that one edit, of the block as it was when the preview
    // began. Any other edit of the room's blocks ends the preview first, putting the block back.

    // False if the quad is of no block.
    beginVoxelBlockPreview: (room: Room, quadIndex: number): boolean =>
    {
        ClientVoxelManager.cancelVoxelBlockPreview();
        const shape = getBlockShape(room, quadIndex);
        if (shape == VOXEL_BLOCK_SHAPE_EMPTY)
            return false;

        const firstQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(
            VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex), VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex),
            VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex));
        blockPreview = {roomID: room.id, quadIndex: firstQuadIndex, originShape: shape, shownShape: shape};
        voxelBlockPreviewObservable.set(true);
        return true;
    },
    // Shows the block in the given shape, if giving it that shape is an edit this user may make; otherwise
    // it stays as it was shown. Returns whether it is shown so.
    previewVoxelBlockShape: (room: Room, shape: number): boolean =>
    {
        const preview = blockPreview;
        if (preview == null || preview.roomID != room.id)
            return false;
        if (shape == preview.shownShape)
            return true;

        // Put back first, so that the room is the one the server will ask the edit of.
        const voxels = room.voxelGrid.voxels;
        showPreviewedShape(voxels, preview.quadIndex, preview.shownShape, preview.originShape);
        const accepted = shape == preview.originShape ||
            VoxelUpdateUtil.canSetVoxelBlockShape(App.getUser(), room, preview.quadIndex, shape);
        if (accepted)
            preview.shownShape = shape;
        showPreviewedShape(voxels, preview.quadIndex, preview.originShape, preview.shownShape);

        if (accepted)
            onRoomShapeChanged(room);
        return accepted;
    },
    // Ends the preview, keeping what it shows. Returns the one edit that amounts to, for the caller to send
    // (the block and the shape it now has), or null if it amounts to none.
    commitVoxelBlockPreview: (room: Room): {quadIndex: number, shape: number} | null =>
    {
        const preview = blockPreview;
        if (preview == null || preview.roomID != room.id)
            return null;
        blockPreview = null;
        voxelBlockPreviewObservable.set(false);

        if (preview.shownShape == preview.originShape)
            return null;
        room.dirty = true;
        voxelBlockEditObservable.set({kind: "reshape", quadIndex: preview.quadIndex, shape: preview.shownShape});
        return {quadIndex: preview.quadIndex, shape: preview.shownShape};
    },
    // Ends the preview, putting the block back as it was.
    cancelVoxelBlockPreview: (): void =>
    {
        const preview = blockPreview;
        if (preview == null)
            return;
        blockPreview = null;

        const room = App.getCurrentRoom();
        if (room != undefined && room.id == preview.roomID && preview.shownShape != preview.originShape)
        {
            showPreviewedShape(room.voxelGrid.voxels, preview.quadIndex, preview.shownShape, preview.originShape);
            onRoomShapeChanged(room);
        }
        voxelBlockPreviewObservable.set(false);
    },

    // --- Signal reception handlers (for signals from other clients via server) ---

    onAddVoxelBlockSignalReceived: async (signal: AddVoxelBlockSignal) => {
        const success = await waitUntilSignalProcessingReady("addVoxelBlockSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientVoxelManager.addVoxelBlock(App.getCurrentRoom()!, signal.quadIndex,
            signal.quadTextureIndicesWithinLayer, false, signal.shape);
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
    onSetVoxelBlockShapeSignalReceived: async (signal: SetVoxelBlockShapeSignal) => {
        const success = await waitUntilSignalProcessingReady("setVoxelBlockShapeSignal",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == signal.roomID);
        if (!success)
            return;
        ClientVoxelManager.setVoxelBlockShape(App.getCurrentRoom()!, signal.quadIndex, signal.shape, false);
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

        // Zone changes can affect what the selection allows.
        refreshSelections();
    },
}

// Re-announces both selection kinds after any external edit, since edits can change what a selection
// is, where it is, or whether it's still editable (e.g. a zone drawn over a picture's wall).
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
        const room = App.getCurrentRoom();
        if (!room || !VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, quadIndex))
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

// The shape of the block a quad belongs to; the empty one for a quad that is not of a block.
function getBlockShape(room: Room, quadIndex: number): number
{
    if (!VoxelQueryUtil.isValidVoxelQuadIndex(quadIndex))
        return VOXEL_BLOCK_SHAPE_EMPTY;
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    if (collisionLayer == COLLISION_LAYER_NULL)
        return VOXEL_BLOCK_SHAPE_EMPTY;
    return VoxelQueryUtil.getVoxelBlockShapeAt(room.voxelGrid.voxels, VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex), collisionLayer);
}

// Shows the previewed block in one shape in place of another; nothing is checked, since the edit it
// amounts to has been (see ClientVoxelManager.previewVoxelBlockShape).
function showPreviewedShape(voxels: Voxel[], quadIndex: number, from: number, to: number): void
{
    if (from != to)
        VoxelUpdateUtil.setVoxelBlockShape(undefined, voxels, quadIndex, to);
}

// Solid block changes invalidate lighting. Recomputation happens once on the next frame.
function onRoomShapeChanged(room: Room)
{
    GraphicsManager.getLightBlockMap().requestRecomputation();
    roomShapeChangedObservable.set(room.id);
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
