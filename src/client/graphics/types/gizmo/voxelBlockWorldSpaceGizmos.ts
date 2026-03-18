import VoxelQuadSelection from "./voxelQuadSelection";
import { voxelQuadSelectionObservable, roomChangedObservable } from "../../../system/clientObservables";
import GraphicsManager from "../../graphicsManager";
import WorldSpaceArrow from "../../../ui/components/basic/worldspace/worldSpaceArrow";
import WorldSpaceIconButton from "../../../ui/components/basic/worldspace/worldSpaceIconButton";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import VoxelBlockUpdateUtil from "../../../../shared/voxel/util/voxelBlockUpdateUtil";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import MoveVoxelBlockParams from "../../../../shared/voxel/types/update/moveVoxelBlockParams";
import AddVoxelBlockParams from "../../../../shared/voxel/types/update/addVoxelBlockParams";
import RemoveVoxelBlockParams from "../../../../shared/voxel/types/update/removeVoxelBlockParams";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../../../shared/system/sharedConstants";

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
        const arrow = await WorldSpaceArrow.create(def.dir, "#ffff00");
        arrow.addToParent(scene);
        arrow.setVisible(false);
        arrows.push(arrow);
    }

    // Create + and - icon-buttons
    addButton = new WorldSpaceIconButton("+", "#227722", "#ffffff");
    addButton.addToParent(scene);
    addButton.setVisible(false);

    removeButton = new WorldSpaceIconButton("\u2212", "#772222", "#ffffff");
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

        const canMove = VoxelBlockUpdateUtil.canMoveVoxelBlock(
            room, quadIndex, def.rowOffset, def.colOffset, def.collisionLayerOffset);

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
    const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ } =
        VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, quadIndex);
    const quadWorldX = voxel.col + 0.5 + offsetX;
    const quadWorldY = offsetY;
    const quadWorldZ = voxel.row + 0.5 + offsetZ;

    // Place buttons slightly offset from the quad center (perpendicular to an arrow direction).
    // Choose an offset that doesn't overlap with arrows.
    // We'll place them offset along a tangent direction of the selected face.
    let tangentX = 0, tangentY = 0, tangentZ = 0;
    if (Math.abs(dirY) > 0.5) // Top or bottom face
    {
        tangentX = 0.3;
        tangentZ = 0.3;
    }
    else if (Math.abs(dirX) > 0.5) // Left or right face
    {
        tangentY = 0.15;
        tangentZ = 0.3;
    }
    else // Front or back face
    {
        tangentX = 0.3;
        tangentY = 0.15;
    }

    const canAdd = canAddVoxelBlock(selection);
    addButton!.setVisible(canAdd);
    addButton!.setPosition(
        quadWorldX + tangentX,
        quadWorldY + tangentY,
        quadWorldZ + tangentZ
    );
    addButton!.setOnClick(canAdd ? () => tryAddVoxelBlock(selection) : null);

    const canRemove = VoxelBlockUpdateUtil.canRemoveVoxelBlock(room, quadIndex);
    removeButton!.setVisible(canRemove);
    removeButton!.setPosition(
        quadWorldX - tangentX,
        quadWorldY - tangentY,
        quadWorldZ - tangentZ
    );
    removeButton!.setOnClick(canRemove ? () => tryRemoveVoxelBlock(selection) : null);
}

// --- Action handlers (same logic as voxelQuadTransformOptions.tsx) ---

function tryMoveVoxelBlock(selection: VoxelQuadSelection,
    rowOffset: number, colOffset: number, collisionLayerOffset: number)
{
    const room = App.getCurrentRoom();
    if (!room) return;
    if (!VoxelBlockUpdateUtil.canMoveVoxelBlock(room, selection.quadIndex, rowOffset, colOffset, collisionLayerOffset))
        return;

    const quadIndex = selection.quadIndex;
    if (VoxelBlockUpdateUtil.moveVoxelBlock(room, quadIndex, rowOffset, colOffset, collisionLayerOffset))
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
        SocketsClient.emitMoveVoxelBlock(new MoveVoxelBlockParams(quadIndex, rowOffset, colOffset, collisionLayerOffset));
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
    return VoxelBlockUpdateUtil.canAddVoxelBlock(room, targetQuadIndex);
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
    if (VoxelBlockUpdateUtil.addVoxelBlock(room, targetQuadIndex, quadTextureIndicesWithinLayer))
    {
        VoxelQuadSelection.trySelect(VoxelQueryUtil.getVoxel(room, newRow, newCol), targetQuadIndex);
        SocketsClient.emitAddVoxelBlock(new AddVoxelBlockParams(targetQuadIndex, quadTextureIndicesWithinLayer));
    }
}

function tryRemoveVoxelBlock(selection: VoxelQuadSelection)
{
    const room = App.getCurrentRoom();
    if (!room) return;
    if (!VoxelBlockUpdateUtil.canRemoveVoxelBlock(room, selection.quadIndex)) return;

    const quadIndex = selection.quadIndex;
    if (VoxelBlockUpdateUtil.removeVoxelBlock(room, quadIndex))
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

        SocketsClient.emitRemoveVoxelBlock(new RemoveVoxelBlockParams(quadIndex));
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
