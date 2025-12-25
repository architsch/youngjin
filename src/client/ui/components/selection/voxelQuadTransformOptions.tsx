import VoxelCubeAddParams from "../../../../shared/voxel/types/voxelCubeAddParams";
import VoxelCubeChangeYParams from "../../../../shared/voxel/types/voxelCubeChangeYParams";
import VoxelCubeRemoveParams from "../../../../shared/voxel/types/voxelCubeRemoveParams";
import App from "../../../app";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import GameSocketsClient from "../../../networking/gameSocketsClient";
import VoxelManager from "../../../voxel/voxelManager";
import Button from "../basic/button";

export default function VoxelQuadTransformOptions(props: {selection: VoxelQuadSelection})
{
    return <div className="flex flex-row gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <Button name="Add Block" onClick={() => onAddCubeButtonClick(props.selection)}/>
        <Button name="Remove Block" onClick={() => onRemoveCubeButtonClick(props.selection)}/>
        <Button name="Move Up" onClick={() => onChangeYClick(props.selection, true)}/>
        <Button name="Move Down" onClick={() => onChangeYClick(props.selection, false)}/>
    </div>;
}

async function onAddCubeButtonClick(selection: VoxelQuadSelection)
{
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Current room not found.");
        return;
    }
    const voxel = selection.voxel;
    const quad = selection.voxelQuad;

    let newRow = voxel.row;
    let newCol = voxel.col;
    if (quad.facingAxis == "z")
        newRow += (quad.orientation == "+") ? 1 : -1;
    else if (quad.facingAxis == "x")
        newCol += (quad.orientation == "+") ? 1 : -1;

    let yCenter = quad.yOffset;
    if (quad.facingAxis == "y")
        yCenter += (quad.orientation == "+") ? 0.5 : -0.5;

    const params = new VoxelCubeAddParams(newRow, newCol, yCenter, quad.textureIndex);
    if (await VoxelManager.addVoxelCubeOnClientSide(room, params))
    {
        VoxelQuadSelection.unselect();
        GameSocketsClient.emitVoxelCubeAdd(params);
    }
}

async function onRemoveCubeButtonClick(selection: VoxelQuadSelection)
{
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Current room not found.");
        return;
    }
    const voxel = selection.voxel;
    const quad = selection.voxelQuad;

    let yCenter = quad.yOffset;
    if (quad.facingAxis == "y")
        yCenter += (quad.orientation == "+") ? -0.5 : 0.5;

    const params = new VoxelCubeRemoveParams(voxel.row, voxel.col, yCenter);
    if (await VoxelManager.removeVoxelCubeOnClientSide(room, params))
    {
        VoxelQuadSelection.unselect();
        GameSocketsClient.emitVoxelCubeRemove(params);
    }
}

async function onChangeYClick(selection: VoxelQuadSelection, moveUp: boolean)
{
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("Current room not found.");
        return;
    }
    const voxel = selection.voxel;
    const quad = selection.voxelQuad;

    let yCenter = quad.yOffset;
    if (quad.facingAxis == "y")
        yCenter += (quad.orientation == "+") ? -0.5 : 0.5;

    const params = new VoxelCubeChangeYParams(voxel.row, voxel.col, yCenter, moveUp);
    if (await VoxelManager.changeVoxelCubeYOnClientSide(room, params))
    {
        VoxelQuadSelection.unselect();
        GameSocketsClient.emitVoxelCubeChangeY(params);
    }
}