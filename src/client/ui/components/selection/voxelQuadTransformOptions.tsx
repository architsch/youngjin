import MoveVoxelBlockParams from "../../../../shared/voxel/types/update/moveVoxelBlockParams";
import AddVoxelBlockParams from "../../../../shared/voxel/types/update/addVoxelBlockParams";
import RemoveVoxelBlockParams from "../../../../shared/voxel/types/update/removeVoxelBlockParams";
import App from "../../../app";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import GameSocketsClient from "../../../networking/gameSocketsClient";
import VoxelManager from "../../../voxel/voxelManager";
import Button from "../basic/button";
import { getFirstVoxelQuadIndexInLayer, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadIndex, getVoxelQuadOrientationFromQuadIndex } from "../../../../shared/voxel/util/voxelQueryUtil";
import { voxelQuadsBuffer } from "../../../../shared/voxel/types/voxel";
import { NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../../../shared/system/constants";

export default function VoxelQuadTransformOptions(props: {selection: VoxelQuadSelection})
{
    return <div className="flex flex-row gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <Button name="Add Block" onClick={() => addVoxelBlock(props.selection)}/>
        <Button name="Remove Block" onClick={() => removeVoxelBlock(props.selection)}/>
        <Button name="Move Up" onClick={() => moveVoxelBlock(props.selection, 1)}/>
        <Button name="Move Down" onClick={() => moveVoxelBlock(props.selection, -1)}/>
    </div>;
}

async function moveVoxelBlock(selection: VoxelQuadSelection, collisionLayerOffset: number)
{
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Current room not found.");
        return;
    }
    const quadIndex = selection.quadIndex;
    const params = new MoveVoxelBlockParams(quadIndex, 0, 0, collisionLayerOffset);
    if (await VoxelManager.moveVoxelBlockOnClientSide(room, params))
    {
        VoxelQuadSelection.unselect();
        GameSocketsClient.emitMoveVoxelBlock(params);
    }
}

async function addVoxelBlock(selection: VoxelQuadSelection)
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

    let newRow = voxel.row;
    let newCol = voxel.col;
    if (facingAxis == "z")
        newRow += (orientation == "+") ? 1 : -1;
    else if (facingAxis == "x")
        newCol += (orientation == "+") ? 1 : -1;

    let newCollisionLayer = collisionLayer;
    if (facingAxis == "y")
        newCollisionLayer += (orientation == "+") ? 1 : -1;

    const quadTextureIndicesWithinLayer: number[] = [];
    const startIndex = getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, collisionLayer);
    for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        quadTextureIndicesWithinLayer.push(voxelQuadsBuffer[i] & 0b01111111);

    const targetQuadIndex = getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer);
    const params = new AddVoxelBlockParams(targetQuadIndex, quadTextureIndicesWithinLayer);
    if (await VoxelManager.addVoxelBlockOnClientSide(room, params))
    {
        VoxelQuadSelection.unselect();
        GameSocketsClient.emitAddVoxelBlock(params);
    }
}

async function removeVoxelBlock(selection: VoxelQuadSelection)
{
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Current room not found.");
        return;
    }

    const params = new RemoveVoxelBlockParams(selection.quadIndex);
    if (await VoxelManager.removeVoxelBlockOnClientSide(room, params))
    {
        VoxelQuadSelection.unselect();
        GameSocketsClient.emitRemoveVoxelBlock(params);
    }
}