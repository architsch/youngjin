import MoveVoxelBlockSignal from "../../../../shared/voxel/types/update/moveVoxelBlockSignal";
import AddVoxelBlockSignal from "../../../../shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../../shared/voxel/types/update/removeVoxelBlockSignal";
import App from "../../../app";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import SocketsClient from "../../../networking/client/socketsClient";
import Button from "../basic/button";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../../../shared/system/sharedConstants";
import Room from "../../../../shared/room/types/room";
import VoxelUpdateUtil from "../../../../shared/voxel/util/voxelUpdateUtil";
import ClientVoxelManager from "../../../voxel/clientVoxelManager";

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
    const room = App.getCurrentRoom();
    if (!room)
        return false;
    return VoxelUpdateUtil.canMoveVoxelBlock(App.getCurrentUserRole(), room, selection.quadIndex, rowOffset, colOffset, collisionLayerOffset);
}

function tryMoveVoxelBlock(selection: VoxelQuadSelection, rowOffset: number, colOffset: number, collisionLayerOffset: number)
{
    if (!canMoveVoxelBlock(selection, rowOffset, colOffset, collisionLayerOffset))
        return;

    const room = App.getCurrentRoom()!;
    const quadIndex = selection.quadIndex;

    if (ClientVoxelManager.moveVoxelBlock(room, quadIndex, rowOffset, colOffset, collisionLayerOffset))
    {
        const v = selection.voxel;
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const newRow = v.row + rowOffset;
        const newCol = v.col + colOffset;
        const newCollisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerAfterOffset(quadIndex, collisionLayerOffset);

        if (!VoxelQuadSelection.trySelect(selection.voxel,
            VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer)))
        {
            // If selection failed, try selecting the opposite side of the moved block.
            VoxelQuadSelection.trySelect(selection.voxel,
                VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, (orientation == "-") ? "+" : "-", newCollisionLayer));
        }
        SocketsClient.emitMoveVoxelBlockSignal(new MoveVoxelBlockSignal(room.id, quadIndex, rowOffset, colOffset, collisionLayerOffset));
    }
}

function canAddVoxelBlock(selection: VoxelQuadSelection): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;

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
    if (!canAddVoxelBlock(selection))
        return;

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

function canRemoveVoxelBlock(selection: VoxelQuadSelection): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;
    return VoxelUpdateUtil.canRemoveVoxelBlock(App.getCurrentUserRole(), room, selection.quadIndex);
}

function tryRemoveVoxelBlock(selection: VoxelQuadSelection)
{
    if (!canRemoveVoxelBlock(selection))
        return;

    const room = App.getCurrentRoom()!;
    const quadIndex = selection.quadIndex;

    if (ClientVoxelManager.removeVoxelBlock(room, quadIndex))
    {
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);

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

        SocketsClient.emitRemoveVoxelBlockSignal(new RemoveVoxelBlockSignal(room.id, quadIndex));
    }
}

function trySelectNeighboringVoxelQuadInDirectionOfRemoval(room: Room, quadIndex: number,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+"): boolean
{
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    const newRow = (facingAxis == "z") ? (orientation == "-" ? row+1 : row-1) : row;
    const newCol = (facingAxis == "x") ? (orientation == "-" ? col+1 : col-1) : col;
    const newCollisionLayer = (facingAxis == "y")
        ? VoxelQueryUtil.getVoxelQuadCollisionLayerAfterOffset(quadIndex, (orientation == "-") ? 1 : -1)
        : collisionLayer;
    return (VoxelQuadSelection.trySelect(VoxelQueryUtil.getVoxel(room, newRow, newCol),
            VoxelQueryUtil.getVoxelQuadIndex(newRow, newCol, facingAxis, orientation, newCollisionLayer)));
}

const quadDirections: { facingAxis: "x" | "y" | "z", orientation: "-" | "+" }[] = [
    { facingAxis: "y", orientation: "-" },
    { facingAxis: "y", orientation: "+" },
    { facingAxis: "x", orientation: "-" },
    { facingAxis: "x", orientation: "+" },
    { facingAxis: "z", orientation: "-" },
    { facingAxis: "z", orientation: "+" },
];
