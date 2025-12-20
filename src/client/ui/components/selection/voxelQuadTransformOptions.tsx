import VoxelCubeAddParams from "../../../../shared/voxel/types/voxelCubeAddParams";
import VoxelCubeRemoveParams from "../../../../shared/voxel/types/voxelCubeRemoveParams";
import App from "../../../app";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import GameSocketsClient from "../../../networking/gameSocketsClient";
import VoxelManager from "../../../voxel/voxelManager";
import Button from "../basic/button";

export default function VoxelQuadTransformOptions(props: {selection: VoxelQuadSelection})
{
    const onAddCubeButtonClick = async () => {
        const room = App.getCurrentRoom();
        if (!room)
        {
            console.error("Current room not found.");
            return;
        }
        const voxel = props.selection.voxel;
        const quad = props.selection.voxelQuad;

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
    };

    const onRemoveCubeButtonClick = async () => {
        const room = App.getCurrentRoom();
        if (!room)
        {
            console.error("Current room not found.");
            return;
        }
        const voxel = props.selection.voxel;
        const quad = props.selection.voxelQuad;

        let yCenter = quad.yOffset;
        if (quad.facingAxis == "y")
            yCenter += (quad.orientation == "+") ? -0.5 : 0.5;

        const params = new VoxelCubeRemoveParams(voxel.row, voxel.col, yCenter);
        if (await VoxelManager.removeVoxelCubeOnClientSide(room, params))
        {
            VoxelQuadSelection.unselect();
            GameSocketsClient.emitVoxelCubeRemove(params);
        }
    };

    return <div className="flex flex-row gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <Button name="Add Block" onClick={onAddCubeButtonClick}/>
        <Button name="Remove Block" onClick={onRemoveCubeButtonClick}/>
    </div>;
}