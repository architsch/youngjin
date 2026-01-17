import MoveVoxelBlockParams from "../../../../shared/voxel/types/update/moveVoxelBlockParams";
import AddVoxelBlockParams from "../../../../shared/voxel/types/update/addVoxelBlockParams";
import RemoveVoxelBlockParams from "../../../../shared/voxel/types/update/removeVoxelBlockParams";
import App from "../../../app";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import GameSocketsClient from "../../../networking/client/gameSocketsClient";
import Button from "../basic/button";
import { getFirstVoxelQuadIndexInLayer, getVoxel, getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerAfterOffset, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadIndex, getVoxelQuadOrientationFromQuadIndex, getVoxelRowFromQuadIndex, isVoxelCollisionLayerOccupied } from "../../../../shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../../../shared/system/constants";
import Room from "../../../../shared/room/types/room";
import { addVoxelBlock, moveVoxelBlock, removeVoxelBlock } from "../../../../shared/voxel/util/voxelBlockUpdateUtil";

export default function VoxelQuadTransformOptions(props: {selection: VoxelQuadSelection})
{
    return <div className="flex flex-row gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <Button name="Add Block" size="sm" onClick={() => addVoxelBlockOption(props.selection)}/>
        <Button name="Remove Block" size="sm" onClick={() => removeVoxelBlockOption(props.selection)}/>
        <Button name="Move Up" size="sm" onClick={() => moveVoxelBlockOption(props.selection, 0, 0, 1)}/>
        <Button name="Move Down" size="sm" onClick={() => moveVoxelBlockOption(props.selection, 0, 0, -1)}/>
        {/*<Button name="Shrink/Expand" size="sm" onClick={() => shrinkOrExpandVoxelBlockOption(props.selection)}/>*/}
    </div>;
}

/*function shrinkOrExpandVoxelBlockOption(selection: VoxelQuadSelection)
{
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Current room not found.");
        return;
    }
    const quadIndex = selection.quadIndex;
    if (shrinkOrExpandVoxelBlock(room, quadIndex))
    {
        voxelQuadSelectionObservable.notify();
        GameSocketsClient.emitShrinkOrExpandVoxelBlock(new ShrinkOrExpandVoxelBlockParams(quadIndex));
    }
}*/

function moveVoxelBlockOption(selection: VoxelQuadSelection, rowOffset: number, colOffset: number, collisionLayerOffset: number)
{
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Current room not found.");
        return;
    }
    const quadIndex = selection.quadIndex;
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
        GameSocketsClient.emitMoveVoxelBlock(new MoveVoxelBlockParams(quadIndex, rowOffset, colOffset, collisionLayerOffset));
    }
}

function addVoxelBlockOption(selection: VoxelQuadSelection)
{
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

    /*const xShrink = (voxel.xShrinkMask & (1 << collisionLayer)) != 0;
    const zShrink = (voxel.zShrinkMask & (1 << collisionLayer)) != 0;*/

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
    if (addVoxelBlock(room, targetQuadIndex, /*xShrink, zShrink,*/ quadTextureIndicesWithinLayer))
    {
        VoxelQuadSelection.trySelect(getVoxel(room, newRow, newCol), targetQuadIndex);
        GameSocketsClient.emitAddVoxelBlock(new AddVoxelBlockParams(targetQuadIndex,
            /*xShrink, zShrink,*/ quadTextureIndicesWithinLayer));
    }
}

function removeVoxelBlockOption(selection: VoxelQuadSelection)
{
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Current room not found.");
        return;
    }
    const quadIndex = selection.quadIndex;

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

        GameSocketsClient.emitRemoveVoxelBlock(new RemoveVoxelBlockParams(quadIndex));
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