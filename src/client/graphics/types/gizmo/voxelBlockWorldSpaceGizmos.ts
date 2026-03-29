import VoxelQuadSelection from "./voxelQuadSelection";
import { voxelQuadSelectionObservable, roomChangedObservable, updateObservable } from "../../../system/clientObservables";
import GraphicsManager from "../../graphicsManager";
import WorldSpaceArrow from "../../../ui/components/basic/worldspace/worldSpaceArrow";
import WorldSpaceIconButton from "../../../ui/components/basic/worldspace/worldSpaceIconButton";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../../shared/voxel/util/voxelUpdateUtil";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import MoveVoxelBlockSignal from "../../../../shared/voxel/types/update/moveVoxelBlockSignal";
import AddVoxelBlockSignal from "../../../../shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../../shared/voxel/types/update/removeVoxelBlockSignal";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../../../shared/system/sharedConstants";
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
let addButton: WorldSpaceIconButton | null = null;
let removeButton: WorldSpaceIconButton | null = null;
let initialized = false;

async function ensureInitialized()
{
    if (initialized) return;
    initialized = true;

    const scene = GraphicsManager.getScene();

    // Create 6 arrows
    for (const def of arrowDefs)
    {
        const arrow = await WorldSpaceArrow.create(def.dir, "#ffff00", 1.8);
        arrow.addToParent(scene);
        arrow.setVisible(false);
        arrows.push(arrow);
    }

    // Create + and - icon-buttons
    addButton = new WorldSpaceIconButton("+", "#227722", "#ffffff", 1.8);
    addButton.addToParent(scene);
    addButton.setVisible(false);

    removeButton = new WorldSpaceIconButton("\u2212", "#772222", "#ffffff", 1.8);
    removeButton.addToParent(scene);
    removeButton.setVisible(false);
}

function hideAll()
{
    for (const arrow of arrows)
        arrow.setVisible(false);
    if (addButton) addButton.setVisible(false);
    if (removeButton) removeButton.setVisible(false);
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

    // Position the + and - buttons near the selected quad surface.
    // We use the quad's transform dimensions to know which face is selected.
    const { offsetX, offsetY, offsetZ } =
        VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, quadIndex);
    const quadWorldX = voxel.col + 0.5 + offsetX;
    const quadWorldY = offsetY;
    const quadWorldZ = voxel.row + 0.5 + offsetZ;

    // Place buttons above or below the selected quad depending on camera position.
    // If the quad is below the camera, place buttons above; if above, place below.
    const cameraY = GraphicsManager.getCamera().position.y;
    const buttonYOffset = (quadWorldY < cameraY) ? 0.4 : -0.4;

    const canAdd = canAddVoxelBlock(selection);
    addButton!.setVisible(canAdd);
    addButton!.setPosition(quadWorldX, quadWorldY + buttonYOffset, quadWorldZ);
    addButton!.setLocalOffset(0.2, 0, 0);
    addButton!.setOnClick(canAdd ? () => tryAddVoxelBlock(selection) : null);

    const canRemove = VoxelUpdateUtil.canRemoveVoxelBlock(App.getCurrentUserRole(), room, quadIndex);
    removeButton!.setVisible(canRemove);
    removeButton!.setPosition(quadWorldX, quadWorldY + buttonYOffset, quadWorldZ);
    removeButton!.setLocalOffset(-0.2, 0, 0);
    removeButton!.setOnClick(canRemove ? () => tryRemoveVoxelBlock(selection) : null);
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

function canAddVoxelBlock(selection: VoxelQuadSelection): boolean
{
    const room = App.getCurrentRoom();
    if (!room) return false;

    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    let newRow = voxel.row;
    let newCol = voxel.col;
    if (facingAxis == "z")
        newRow += (orientation == "+") ? 1 : -1;
    else if (facingAxis == "x")
        newCol += (orientation == "+") ? 1 : -1;

    let newCollisionLayer = collisionLayer;
    if (facingAxis == "y")
    {
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            newCollisionLayer = (orientation == "+") ? COLLISION_LAYER_MIN : COLLISION_LAYER_MAX;
        else
            newCollisionLayer += (orientation == "+") ? 1 : -1;
    }

    const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer);
    return VoxelUpdateUtil.canAddVoxelBlock(App.getCurrentUserRole(), room, targetQuadIndex);
}

function tryAddVoxelBlock(selection: VoxelQuadSelection)
{
    if (!canAddVoxelBlock(selection)) return;

    const room = App.getCurrentRoom()!;
    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    let newRow = voxel.row;
    let newCol = voxel.col;
    if (facingAxis == "z")
        newRow += (orientation == "+") ? 1 : -1;
    else if (facingAxis == "x")
        newCol += (orientation == "+") ? 1 : -1;

    let newCollisionLayer = collisionLayer;
    if (facingAxis == "y")
    {
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            newCollisionLayer = (orientation == "+") ? COLLISION_LAYER_MIN : COLLISION_LAYER_MAX;
        else
            newCollisionLayer += (orientation == "+") ? 1 : -1;
    }

    const quadTextureIndicesWithinLayer = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
    const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, collisionLayer);
    for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        quadTextureIndicesWithinLayer[i - startIndex] = App.getVoxelQuads()[i] & 0b01111111;

    const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer);
    if (ClientVoxelManager.addVoxelBlock(room, targetQuadIndex, quadTextureIndicesWithinLayer))
    {
        VoxelQuadSelection.trySelect(VoxelQueryUtil.getVoxel(room, newRow, newCol), targetQuadIndex);
        SocketsClient.emitAddVoxelBlockSignal(new AddVoxelBlockSignal(room.id, targetQuadIndex, quadTextureIndicesWithinLayer));
    }
}

function tryRemoveVoxelBlock(selection: VoxelQuadSelection)
{
    const room = App.getCurrentRoom();
    if (!room) return;
    if (!VoxelUpdateUtil.canRemoveVoxelBlock(App.getCurrentUserRole(), room, selection.quadIndex)) return;

    const quadIndex = selection.quadIndex;
    if (ClientVoxelManager.removeVoxelBlock(room, quadIndex))
    {
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        // Try selecting a neighboring quad after removal
        const quadDirections: { facingAxis: "x" | "y" | "z", orientation: "-" | "+" }[] = [
            { facingAxis: "y", orientation: "-" },
            { facingAxis: "y", orientation: "+" },
            { facingAxis: "x", orientation: "-" },
            { facingAxis: "x", orientation: "+" },
            { facingAxis: "z", orientation: "-" },
            { facingAxis: "z", orientation: "+" },
        ];

        let dirIndex = -1;
        for (let i = 0; i < quadDirections.length; ++i)
        {
            const dir = quadDirections[i];
            if (dir.facingAxis == facingAxis && dir.orientation == orientation)
            {
                dirIndex = i;
                break;
            }
        }

        let found = false;
        for (let i = 0; i < quadDirections.length; ++i)
        {
            const dir = quadDirections[dirIndex];
            const newRow = (dir.facingAxis == "z") ? (dir.orientation == "-" ? row+1 : row-1) : row;
            const newCol = (dir.facingAxis == "x") ? (dir.orientation == "-" ? col+1 : col-1) : col;
            const newCollisionLayer = (dir.facingAxis == "y")
                ? VoxelQueryUtil.getVoxelQuadCollisionLayerAfterOffset(quadIndex, (dir.orientation == "-") ? 1 : -1)
                : collisionLayer;

            if (VoxelQuadSelection.trySelect(VoxelQueryUtil.getVoxel(room, newRow, newCol),
                VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, dir.facingAxis, dir.orientation, newCollisionLayer)))
            {
                found = true;
                break;
            }
            dirIndex = (dirIndex + 1) % quadDirections.length;
        }
        if (!found)
            VoxelQuadSelection.unselect();

        SocketsClient.emitRemoveVoxelBlockSignal(new RemoveVoxelBlockSignal(room.id, quadIndex));
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
});

updateObservable.addListener("voxelBlockWorldSpaceGizmos", () => {
    if (addButton) addButton.update();
    if (removeButton) removeButton.update();
});
