import VoxelQuadSelection from "./voxelQuadSelection";
import { voxelQuadSelectionObservable, roomChangedObservable, updateObservable } from "../../../system/clientObservables";
import GraphicsManager from "../../graphicsManager";
import WorldSpaceArrow from "../../../ui/components/basic/worldspace/worldSpaceArrow";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../../shared/voxel/util/voxelUpdateUtil";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import MoveVoxelBlockSignal from "../../../../shared/voxel/types/update/moveVoxelBlockSignal";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import ClientVoxelManager from "../../../voxel/clientVoxelManager";

// Arrow offset distance from center of voxel block face
const ARROW_OFFSET = 0.35;

// Definitions for the 6 directional arrows on a voxel block.
// Each entry specifies:
//   - direction label (for the arrow character)
//   - offset from block center to position the arrow
//   - the moveVoxelBlock parameters (rowOffset, colOffset, collisionLayerOffset)
const arrowDefs = [
    { dir: "+y", offsetX: 0, offsetY: +0.25 + ARROW_OFFSET, offsetZ: 0, rowOffset: 0, colOffset: 0, collisionLayerOffset: 1 },
    { dir: "-y", offsetX: 0, offsetY: -0.25 - ARROW_OFFSET, offsetZ: 0, rowOffset: 0, colOffset: 0, collisionLayerOffset: -1 },
    { dir: "+x", offsetX: +0.5 + ARROW_OFFSET, offsetY: 0, offsetZ: 0, rowOffset: 0, colOffset: 1, collisionLayerOffset: 0 },
    { dir: "-x", offsetX: -0.5 - ARROW_OFFSET, offsetY: 0, offsetZ: 0, rowOffset: 0, colOffset: -1, collisionLayerOffset: 0 },
    { dir: "+z", offsetX: 0, offsetY: 0, offsetZ: +0.5 + ARROW_OFFSET, rowOffset: 1, colOffset: 0, collisionLayerOffset: 0 },
    { dir: "-z", offsetX: 0, offsetY: 0, offsetZ: -0.5 - ARROW_OFFSET, rowOffset: -1, colOffset: 0, collisionLayerOffset: 0 },
];

let arrows: WorldSpaceArrow[] = [];
let initialized = false;

async function ensureInitialized()
{
    if (initialized) return;
    initialized = true;

    const scene = GraphicsManager.getScene();

    // Create 6 arrows
    for (const def of arrowDefs)
    {
        const arrow = await WorldSpaceArrow.create(def.dir, "#ffff00", 2);
        arrow.addToParent(scene);
        arrow.setVisible(false);
        arrows.push(arrow);
    }
}

function hideAll()
{
    for (const arrow of arrows)
        arrow.setVisible(false);
}

async function updateGizmos(selection: VoxelQuadSelection)
{
    await ensureInitialized();

    const room = App.getCurrentRoom();
    if (!room)
    {
        hideAll();
        return;
    }

    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    // Block center position in world space
    const centerX = voxel.col + 0.5;
    const centerY = collisionLayer * 0.5 + 0.25;
    const centerZ = voxel.row + 0.5;

    // Update arrows
    for (let i = 0; i < arrowDefs.length; ++i)
    {
        const def = arrowDefs[i];
        const arrow = arrows[i];

        const canMove = VoxelUpdateUtil.canMoveVoxelBlock(
            App.getCurrentUserRole(), room, quadIndex, def.rowOffset, def.colOffset, def.collisionLayerOffset);

        arrow.setVisible(canMove);
        arrow.setPosition(
            centerX + def.offsetX,
            centerY + def.offsetY,
            centerZ + def.offsetZ
        );
        arrow.setOnClick(canMove ? () => {
            tryMoveVoxelBlock(selection, def.rowOffset, def.colOffset, def.collisionLayerOffset);
        } : null);
    }
}

// --- Action handlers ---

function tryMoveVoxelBlock(selection: VoxelQuadSelection,
    rowOffset: number, colOffset: number, collisionLayerOffset: number)
{
    const room = App.getCurrentRoom();
    if (!room) return;
    if (!VoxelUpdateUtil.canMoveVoxelBlock(App.getCurrentUserRole(), room, selection.quadIndex, rowOffset, colOffset, collisionLayerOffset))
        return;

    const quadIndex = selection.quadIndex;
    if (ClientVoxelManager.moveVoxelBlock(room, quadIndex, rowOffset, colOffset, collisionLayerOffset))
    {
        const v = selection.voxel;
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const newRow = v.row + rowOffset;
        const newCol = v.col + colOffset;
        const newCollisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerAfterOffset(quadIndex, collisionLayerOffset);

        // After a horizontal move (row/col change), the block is now in a different voxel.
        // We must get the voxel at the new position for selection to work correctly.
        const newVoxel = (rowOffset !== 0 || colOffset !== 0)
            ? VoxelQueryUtil.getVoxel(room, newRow, newCol) : v;

        if (!VoxelQuadSelection.trySelect(newVoxel,
            VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer)))
        {
            VoxelQuadSelection.trySelect(newVoxel,
                VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, (orientation == "-") ? "+" : "-", newCollisionLayer));
        }
        SocketsClient.emitMoveVoxelBlockSignal(new MoveVoxelBlockSignal(room.id, quadIndex, rowOffset, colOffset, collisionLayerOffset));
    }
}

// --- Observable listeners ---

voxelQuadSelectionObservable.addListener("voxelBlockWorldSpaceGizmos", async (selection: VoxelQuadSelection | null) => {
    if (selection)
        await updateGizmos(selection);
    else
        hideAll();
});

roomChangedObservable.addListener("voxelBlockWorldSpaceGizmos", (_roomRuntimeMemory: RoomRuntimeMemory) => {
    hideAll();
    for (const arrow of arrows)
        arrow.dispose();
    arrows = [];
    initialized = false;
});

updateObservable.addListener("voxelBlockWorldSpaceGizmos", () => {
    for (const arrow of arrows)
        arrow.update();
});
