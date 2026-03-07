import MoveVoxelBlockParams from "../../../../shared/voxel/types/update/moveVoxelBlockParams";
import AddVoxelBlockParams from "../../../../shared/voxel/types/update/addVoxelBlockParams";
import RemoveVoxelBlockParams from "../../../../shared/voxel/types/update/removeVoxelBlockParams";
import App from "../../../app";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import SocketsClient from "../../../networking/client/socketsClient";
import Button from "../basic/button";
import { getFirstVoxelQuadIndexInLayer, getVoxel, getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerAfterOffset, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadIndex, getVoxelQuadOrientationFromQuadIndex, getVoxelRowFromQuadIndex } from "../../../../shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../../../shared/system/sharedConstants";
import Room from "../../../../shared/room/types/room";
import { addVoxelBlock, moveVoxelBlock, removeVoxelBlock } from "../../../../shared/voxel/util/voxelBlockUpdateUtil";
import { wouldBlockRemovalBreakPersistentObject } from "../../../../shared/object/util/persistentObjectUpdateUtil";

export default function VoxelQuadTransformOptions(props: {selection: VoxelQuadSelection})
{
    return <div className="flex flex-row gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <Button name="Add Block" size="sm"
            disabled={!canAddVoxelBlock(props.selection)}
            onClick={() => tryAddVoxelBlock(props.selection)}/>
        <Button name="Remove Block" size="sm"
            disabled={!canRemoveVoxelBlock(props.selection)}
            onClick={() => tryRemoveVoxelBlock(props.selection)}/>
        <Button name="Move Up" size="sm"
            disabled={!canMoveVoxelBlock(props.selection, 0, 0, 1)}
            onClick={() => tryMoveVoxelBlock(props.selection, 0, 0, 1)}/>
        <Button name="Move Down" size="sm"
            disabled={!canMoveVoxelBlock(props.selection, 0, 0, -1)}
            onClick={() => tryMoveVoxelBlock(props.selection, 0, 0, -1)}/>
    </div>;
}

function canMoveVoxelBlock(selection: VoxelQuadSelection,
    rowOffset: number, colOffset: number, collisionLayerOffset: number): boolean
{
    // TODO: Implement
    // (Hint: Make use of "VoxelBlockUpdateUtil.canMoveVoxelBlock" to check conditions that are not strictly confined to the client side.)
    return true;
}

function tryMoveVoxelBlock(selection: VoxelQuadSelection, rowOffset: number, colOffset: number, collisionLayerOffset: number)
{
    // TODO: Move over the precondition logic into "canMoveVoxelBlock", and simply call it to check whether the conditions are met.
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Current room not found.");
        return;
    }
    const quadIndex = selection.quadIndex;

    const row = getVoxelRowFromQuadIndex(quadIndex);
    const col = getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    if (wouldBlockRemovalBreakPersistentObject(room, row, col, collisionLayer))
        return;

    if (moveVoxelBlock(room, quadIndex, rowOffset, colOffset, collisionLayerOffset))
    {
        const v = selection.voxel;
        const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const newRow = v.row + rowOffset;
        const newCol = v.col + colOffset;
        const newCollisionLayer = getVoxelQuadCollisionLayerAfterOffset(quadIndex, collisionLayerOffset);
        
        if (!VoxelQuadSelection.trySelect(selection.voxel,
            getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer)))
        {
            // If selection failed, try selecting the opposite side of the moved block.
            VoxelQuadSelection.trySelect(selection.voxel,
                getVoxelQuadIndex(newRow, newCol, facingAxis, (orientation == "-") ? "+" : "-", newCollisionLayer));
        }
        SocketsClient.emitMoveVoxelBlock(new MoveVoxelBlockParams(quadIndex, rowOffset, colOffset, collisionLayerOffset));
    }
}

function canAddVoxelBlock(selection: VoxelQuadSelection): boolean
{
    // TODO: Implement
    // (Hint: Make use of "VoxelBlockUpdateUtil.canAddVoxelBlock" to check conditions that are not strictly confined to the client side.)
    return true;
}

function tryAddVoxelBlock(selection: VoxelQuadSelection)
{
    // TODO: Move over the precondition logic into "canAddVoxelBlock", and simply call it to check whether the conditions are met.
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Current room not found.");
        return;
    }
    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

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
    const startIndex = getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, collisionLayer);
    for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        quadTextureIndicesWithinLayer[i - startIndex] = App.getVoxelQuads()[i] & 0b01111111;

    const targetQuadIndex = getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer);
    if (addVoxelBlock(room, targetQuadIndex, quadTextureIndicesWithinLayer))
    {
        VoxelQuadSelection.trySelect(getVoxel(room, newRow, newCol), targetQuadIndex);
        SocketsClient.emitAddVoxelBlock(new AddVoxelBlockParams(targetQuadIndex, quadTextureIndicesWithinLayer));
    }
}

function canRemoveVoxelBlock(selection: VoxelQuadSelection): boolean
{
    // TODO: Implement
    // (Hint: Make use of "VoxelBlockUpdateUtil.canRemoveVoxelBlock" to check conditions that are not strictly confined to the client side.)
    return true;
}

function tryRemoveVoxelBlock(selection: VoxelQuadSelection)
{
    // TODO: Move over the precondition logic into "canRemoveVoxelBlock", and simply call it to check whether the conditions are met.
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Current room not found.");
        return;
    }
    const quadIndex = selection.quadIndex;

    const row = getVoxelRowFromQuadIndex(quadIndex);
    const col = getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    if (wouldBlockRemovalBreakPersistentObject(room, row, col, collisionLayer))
        return;

    if (removeVoxelBlock(room, quadIndex))
    {
        const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);

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
        for (let i = 0; i < quadDirections.length; ++i)
        {
            const dir = quadDirections[dirIndex];
            if (trySelectNeighboringVoxelQuadInDirectionOfRemoval(
                room, quadIndex, dir.facingAxis, dir.orientation))
            {
                break;
            }
            dirIndex = (dirIndex + 1) % quadDirections.length;
        }

        SocketsClient.emitRemoveVoxelBlock(new RemoveVoxelBlockParams(quadIndex));
    }
}

function trySelectNeighboringVoxelQuadInDirectionOfRemoval(room: Room, quadIndex: number,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+"): boolean
{
    const row = getVoxelRowFromQuadIndex(quadIndex);
    const col = getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    const newRow = (facingAxis == "z") ? (orientation == "-" ? row+1 : row-1) : row;
    const newCol = (facingAxis == "x") ? (orientation == "-" ? col+1 : col-1) : col;
    const newCollisionLayer = (facingAxis == "y")
        ? getVoxelQuadCollisionLayerAfterOffset(quadIndex, (orientation == "-") ? 1 : -1)
        : collisionLayer;
    return (VoxelQuadSelection.trySelect(getVoxel(room, newRow, newCol),
            getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer)));
}

const quadDirections: { facingAxis: "x" | "y" | "z", orientation: "-" | "+" }[] = [
    { facingAxis: "y", orientation: "-" },
    { facingAxis: "y", orientation: "+" },
    { facingAxis: "x", orientation: "-" },
    { facingAxis: "x", orientation: "+" },
    { facingAxis: "z", orientation: "-" },
    { facingAxis: "z", orientation: "+" },
];