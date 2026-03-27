import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../system/sharedConstants";
import Room from "../../room/types/room";
import { RoomTypeEnumMap } from "../../room/types/roomType";
import { UserRole, UserRoleEnumMap } from "../../user/types/userRole";
import VoxelQuadUpdateUtil from "./voxelQuadUpdateUtil";
import VoxelQueryUtil from "./voxelQueryUtil";
import Voxel from "../types/voxel";
import PhysicsCollisionUtil from "../../physics/util/physicsCollisionUtil";
import PhysicsObjectUtil from "../../physics/util/physicsObjectUtil";

const VoxelUpdateUtil =
{
    canAddVoxelBlock(userRole: UserRole, room: Room, quadIndex: number): boolean
    {
        if (!canUserEditVoxel(userRole, room))
            return false;
        return canAddVoxelBlockInternal(room, quadIndex);
    },
    addVoxelBlock(userRole: UserRole, room: Room, quadIndex: number,
        quadTextureIndicesWithinLayer: number[], validate: boolean = true): boolean
    {
        if (validate && !VoxelUpdateUtil.canAddVoxelBlock(userRole, room, quadIndex))
        {
            console.error(`VoxelUpdateUtil::addVoxelBlock :: Failed (quadIndex=${quadIndex})`);
            return false;
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const voxel = VoxelQueryUtil.getVoxel(room, row, col);
        voxel.collisionLayerMask ^= (1 << collisionLayer);

        updateAllVoxelBlockSides(room, voxel, collisionLayer, quadTextureIndicesWithinLayer);
        room.dirty = true;
        return true;
    },

    canRemoveVoxelBlock(userRole: UserRole, room: Room, quadIndex: number): boolean
    {
        if (!canUserEditVoxel(userRole, room))
            return false;
        return canRemoveVoxelBlockInternal(room, quadIndex);
    },
    removeVoxelBlock(userRole: UserRole, room: Room, quadIndex: number,
        validate: boolean = true): boolean
    {
        if (validate && !VoxelUpdateUtil.canRemoveVoxelBlock(userRole, room, quadIndex))
        {
            console.error(`VoxelUpdateUtil::removeVoxelBlock :: Failed (quadIndex=${quadIndex})`);
            return false;
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const voxel = VoxelQueryUtil.getVoxel(room, row, col);
        voxel.collisionLayerMask ^= (1 << collisionLayer);

        updateAllVoxelBlockSides(room, voxel, collisionLayer);
        room.dirty = true;
        return true;
    },

    canMoveVoxelBlock(userRole: UserRole, room: Room, quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number): boolean
    {
        if (!canUserEditVoxel(userRole, room))
            return false;

        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const voxel = VoxelQueryUtil.getVoxel(room, row, col);
        if (!voxel)
            return false;

        let newCollisionLayer = collisionLayer + collisionLayerOffset;
        if (newCollisionLayer < COLLISION_LAYER_MIN || newCollisionLayer > COLLISION_LAYER_MAX)
            newCollisionLayer = COLLISION_LAYER_NULL;

        const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(
            row + rowOffset, col + colOffset, "y", "-", newCollisionLayer);

        return canAddVoxelBlockInternal(room, targetQuadIndex)
            && canRemoveVoxelBlockInternal(room, quadIndex);
    },
    moveVoxelBlock(userRole: UserRole, room: Room, quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number,
        validate: boolean = true): boolean
    {
        if (validate && !VoxelUpdateUtil.canMoveVoxelBlock(userRole, room, quadIndex, rowOffset, colOffset, collisionLayerOffset))
        {
            console.error(`VoxelUpdateUtil::moveVoxelBlock :: Failed (quadIndex=${quadIndex})`);
            return false;
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        let newCollisionLayer = collisionLayer + collisionLayerOffset;
        if (newCollisionLayer < COLLISION_LAYER_MIN || newCollisionLayer > COLLISION_LAYER_MAX)
            newCollisionLayer = COLLISION_LAYER_NULL;

        const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(
            row + rowOffset, col + colOffset, "y", "-", newCollisionLayer);

        const quadTextureIndicesWithinLayer: number[] = [];
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
        for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            quadTextureIndicesWithinLayer.push(room.voxelGrid.quadsMem.quads[i] & 0b01111111);

        // Use internal helpers directly to avoid double user-role checking.
        // canMoveVoxelBlock already validated both add and remove.
        const addRow = VoxelQueryUtil.getVoxelRowFromQuadIndex(targetQuadIndex);
        const addCol = VoxelQueryUtil.getVoxelColFromQuadIndex(targetQuadIndex);
        const addCollisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(targetQuadIndex);

        const addVoxel = VoxelQueryUtil.getVoxel(room, addRow, addCol);
        addVoxel.collisionLayerMask ^= (1 << addCollisionLayer);
        updateAllVoxelBlockSides(room, addVoxel, addCollisionLayer, quadTextureIndicesWithinLayer);

        const removeVoxel = VoxelQueryUtil.getVoxel(room, row, col);
        removeVoxel.collisionLayerMask ^= (1 << collisionLayer);
        updateAllVoxelBlockSides(room, removeVoxel, collisionLayer);

        room.dirty = true;
        return true;
    },

    canSetVoxelQuadTexture(userRole: UserRole, room: Room, quadIndex: number): boolean
    {
        if (!canUserEditVoxel(userRole, room))
            return false;

        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const voxel = VoxelQueryUtil.getVoxel(room, row, col);
        if (!voxel)
            return false;

        // The quad must be visible (i.e. its block face must be exposed).
        const quad = voxel.quadsMem.quads[quadIndex];
        if ((quad & 0b10000000) == 0)
            return false;

        return true;
    },
    setVoxelQuadTexture(userRole: UserRole, room: Room, quadIndex: number, textureIndex: number,
        validate: boolean = true): boolean
    {
        if (validate && !VoxelUpdateUtil.canSetVoxelQuadTexture(userRole, room, quadIndex))
        {
            console.error(`VoxelUpdateUtil::setVoxelQuadTexture :: Failed (quadIndex=${quadIndex})`);
            return false;
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const voxel = VoxelQueryUtil.getVoxel(room, row, col);
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        if (!VoxelQuadUpdateUtil.setVoxelQuadVisible(true, voxel, facingAxis, orientation, collisionLayer, textureIndex))
            return false;

        room.dirty = true;
        return true;
    },
};

function canUserEditVoxel(userRole: UserRole, room: Room): boolean
{
    if (userRole === UserRoleEnumMap.Owner || userRole === UserRoleEnumMap.Editor)
        return true;
    if (room.roomType === RoomTypeEnumMap.Hub)
        return true;
    return false;
}

function canAddVoxelBlockInternal(room: Room, quadIndex: number): boolean
{
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        return false;
    if (row <= 0 || col <= 0 || row >= NUM_VOXEL_ROWS-1 || col >= NUM_VOXEL_COLS-1)
        return false;

    const voxel = VoxelQueryUtil.getVoxel(room, row, col);
    if (!voxel)
        return false;
    if (VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
        return false;

    return true;
}

function canRemoveVoxelBlockInternal(room: Room, quadIndex: number): boolean
{
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        return false;
    if (row <= 0 || col <= 0 || row >= NUM_VOXEL_ROWS-1 || col >= NUM_VOXEL_COLS-1)
        return false;

    const voxel = VoxelQueryUtil.getVoxel(room, row, col);
    if (!voxel)
        return false;
    if (!VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
        return false;

    // Check if removing the voxel block will cause any wall-attached object to lose its wall support.
    const voxelBlockColliderState = PhysicsCollisionUtil.getVoxelBlockColliderState(row, col, collisionLayer);
    const collidingObjects = PhysicsObjectUtil.getObjectsCollidingWith3DVolume(room.id, voxelBlockColliderState);
    for (const collidingObject of Object.values(collidingObjects))
    {
        if (collidingObject.colliderState.colliderConfig.colliderType == "wallAttachment")
            return false;
    }
    return true;
}

function updateAllVoxelBlockSides(room: Room, voxel: Voxel, collisionLayer: number,
    quadTextureIndicesWithinLayer?: number[])
{
    let lowerCollisionLayer = collisionLayer-1;
    if (lowerCollisionLayer < COLLISION_LAYER_MIN)
        lowerCollisionLayer = COLLISION_LAYER_NULL;
    let upperCollisionLayer = collisionLayer+1;
    if (upperCollisionLayer > COLLISION_LAYER_MAX)
        upperCollisionLayer = COLLISION_LAYER_NULL;

    updateVoxelBlockSide(room, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "y", "-", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("y", "-")] : undefined);
    updateVoxelBlockSide(room, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "y", "+", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("y", "+")] : undefined);
    updateVoxelBlockSide(room, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "x", "-", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("x", "-")] : undefined);
    updateVoxelBlockSide(room, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "x", "+", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("x", "+")] : undefined);
    updateVoxelBlockSide(room, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "z", "-", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("z", "-")] : undefined);
    updateVoxelBlockSide(room, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "z", "+", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("z", "+")] : undefined);
}

function updateVoxelBlockSide(room: Room, voxel: Voxel, collisionLayer: number, lowerCollisionLayer: number, upperCollisionLayer: number,
    facingAxis: "x" | "y" | "z", outOrientation: "-" | "+", quadTextureIndicesWithinLayer: number = -1)
{
    let adjBlockVoxel = voxel;
    let adjBlockCollisionLayer = collisionLayer;

    switch (facingAxis)
    {
        case "y":
            adjBlockCollisionLayer = (outOrientation == "-" ? lowerCollisionLayer : upperCollisionLayer);
            break;
        case "x":
            adjBlockVoxel = VoxelQueryUtil.getVoxel(room, voxel.row, voxel.col + (outOrientation == "-" ? -1 : 1));
            break;
        case "z":
            adjBlockVoxel = VoxelQueryUtil.getVoxel(room, voxel.row + (outOrientation == "-" ? -1 : 1), voxel.col);
            break;
    }

    const myBlockOccupied = VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer);
    const adjBlockOccupied = VoxelQueryUtil.isVoxelCollisionLayerOccupied(adjBlockVoxel, adjBlockCollisionLayer);

    const showMyQuad = myBlockOccupied && !adjBlockOccupied;
    const showAdjQuad = adjBlockOccupied && !myBlockOccupied;

    VoxelQuadUpdateUtil.setVoxelQuadVisible(showMyQuad, voxel, facingAxis, outOrientation,
        collisionLayer, quadTextureIndicesWithinLayer);
    VoxelQuadUpdateUtil.setVoxelQuadVisible(showAdjQuad, adjBlockVoxel, facingAxis, outOrientation == "-" ? "+" : "-",
        adjBlockCollisionLayer);
}

export default VoxelUpdateUtil;
