import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../system/sharedConstants";
import Room from "../../room/types/room";
import { UserRole } from "../../user/types/userRole";
import VoxelQuadUpdateUtil from "./voxelQuadUpdateUtil";
import VoxelQueryUtil from "./voxelQueryUtil";
import Voxel from "../types/voxel";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import PhysicsObjectUtil from "../../physics/util/physicsObjectUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";
import Vec3 from "../../math/types/vec3";
import RoomValidationUtil from "../../room/util/roomValidationUtil";

const VoxelUpdateUtil =
{
    canAddVoxelBlock(userRole: UserRole, room: Room, quadIndex: number): boolean
    {
        if (!RoomValidationUtil.canUserEditRoom(userRole, room))
            return false;

        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            return false;
        if (RoomValidationUtil.additionIsBlockedAtCoords(room, col, row))
            return false;

        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
            return false;
        if (VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
            return false;

        return true;
    },
    addVoxelBlock(userRole: UserRole, voxels: Voxel[], quadIndex: number,
        quadTextureIndicesWithinLayer?: number[],
        room?: Room): boolean // Won't validate if the room is not defined (e.g. when generating a brand new room, or force-modifying a room's voxelGrid).
    {
        if (room && !VoxelUpdateUtil.canAddVoxelBlock(userRole, room, quadIndex))
        {
            console.error(`VoxelUpdateUtil::addVoxelBlock :: Failed (quadIndex=${quadIndex})`);
            return false;
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const voxel = VoxelQueryUtil.getVoxel(voxels, row, col)!;
        voxel.collisionLayerMask |= (1 << collisionLayer);

        updateAllVoxelBlockSides(voxels, voxel, collisionLayer, quadTextureIndicesWithinLayer);

        if (room)
            room.dirty = true;
        return true;
    },

    canRemoveVoxelBlock(userRole: UserRole, room: Room, quadIndex: number): boolean
    {
        if (!RoomValidationUtil.canUserEditRoom(userRole, room))
            return false;

        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            return false;
        if (RoomValidationUtil.removalIsBlockedAtCoords(room, col, row))
            return false;

        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
            return false;
        if (!VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
            return false;

        const voxelPos: Vec3 = {x: col+0.5, y: 0.25 + collisionLayer*0.5, z: row+0.5};

        // Check if removing the voxel block will cause any wall-attached object to lose its wall support.
        const voxelBlockColliderState = PhysicsColliderStateUtil.getVoxelBlockColliderState(row, col, collisionLayer);
        const collidingObjects = PhysicsObjectUtil.getObjectsCollidingWith3DVolume(room.id, voxelBlockColliderState);
        for (const collidingObject of Object.values(collidingObjects))
        {
            if (collidingObject.colliderState.colliderConfig.colliderType == "wallAttachment")
            {
                const object = room.objectById[collidingObject.objectId];
                if (!object)
                {
                    console.error(`Colliding object not found (objectId = ${collidingObject.objectId})`);
                    continue;
                }
                const objectDir = object.transform.dir;
                const fromVoxelToObject = Vector3DUtil.subtract(object.transform.pos, voxelPos);
                const objectIsFacingAwayFromVoxel =
                    Vector3DUtil.dot(objectDir, fromVoxelToObject) > 0;

                if (objectIsFacingAwayFromVoxel) // This means that the object's back side is attached to the voxel block (NOT its front side).
                    return false;
            }
        }
        return true;
    },
    removeVoxelBlock(userRole: UserRole, voxels: Voxel[], quadIndex: number,
        room?: Room): boolean // Won't validate if the room is not defined (e.g. when generating a brand new room, or force-modifying a room's voxelGrid).
    {
        if (room && !VoxelUpdateUtil.canRemoveVoxelBlock(userRole, room, quadIndex))
        {
            console.error(`VoxelUpdateUtil::removeVoxelBlock :: Failed (quadIndex=${quadIndex})`);
            return false;
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const voxel = VoxelQueryUtil.getVoxel(voxels, row, col)!;
        voxel.collisionLayerMask &= ~(1 << collisionLayer);

        updateAllVoxelBlockSides(voxels, voxel, collisionLayer);

        if (room)
            room.dirty = true;
        return true;
    },

    canMoveVoxelBlock(userRole: UserRole, room: Room, quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number): boolean
    {
        if (!RoomValidationUtil.canUserEditRoom(userRole, room))
            return false;

        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
            return false;
        
        const row2 = row + rowOffset;
        const col2 = col + colOffset;
        const voxel2 = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row2, col2);
        if (!voxel2)
            return false;

        let newCollisionLayer = collisionLayer + collisionLayerOffset;
        if (newCollisionLayer < COLLISION_LAYER_MIN || newCollisionLayer > COLLISION_LAYER_MAX)
            newCollisionLayer = COLLISION_LAYER_NULL;

        const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(
            row2, col2, "y", "-", newCollisionLayer);

        return VoxelUpdateUtil.canAddVoxelBlock(userRole, room, targetQuadIndex)
            && VoxelUpdateUtil.canRemoveVoxelBlock(userRole, room, quadIndex);
    },
    moveVoxelBlock(userRole: UserRole, voxels: Voxel[], quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number,
        room?: Room): boolean // Won't validate if the room is not defined (e.g. when generating a brand new room, or force-modifying a room's voxelGrid).
    {
        if (room && !VoxelUpdateUtil.canMoveVoxelBlock(userRole, room, quadIndex, rowOffset, colOffset, collisionLayerOffset))
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
            quadTextureIndicesWithinLayer.push(voxels[0].quadsMem.quads[i] & 0b01111111);

        // Use internal helpers directly to avoid double user-role checking.
        // canMoveVoxelBlock already validated both add and remove.
        const addRow = VoxelQueryUtil.getVoxelRowFromQuadIndex(targetQuadIndex);
        const addCol = VoxelQueryUtil.getVoxelColFromQuadIndex(targetQuadIndex);
        const addCollisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(targetQuadIndex);

        const addVoxel = VoxelQueryUtil.getVoxel(voxels, addRow, addCol)!;
        addVoxel.collisionLayerMask |= (1 << addCollisionLayer);
        updateAllVoxelBlockSides(voxels, addVoxel, addCollisionLayer, quadTextureIndicesWithinLayer);

        const removeVoxel = VoxelQueryUtil.getVoxel(voxels, row, col)!;
        removeVoxel.collisionLayerMask &= ~(1 << collisionLayer);
        updateAllVoxelBlockSides(voxels, removeVoxel, collisionLayer);

        if (room)
            room.dirty = true;
        return true;
    },

    canSetVoxelQuadTexture(userRole: UserRole, room: Room, quadIndex: number): boolean
    {
        if (!RoomValidationUtil.canUserEditRoom(userRole, room))
            return false;

        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
            return false;

        // The quad must be visible (i.e. its block face must be exposed).
        const quad = voxel.quadsMem.quads[quadIndex];
        if ((quad & 0b10000000) == 0)
            return false;

        return true;
    },
    setVoxelQuadTexture(userRole: UserRole, voxels: Voxel[], quadIndex: number, textureIndex: number,
        room?: Room): boolean // Won't validate if the room is not defined (e.g. when generating a brand new room, or force-modifying a room's voxelGrid).
    {
        if (room && !VoxelUpdateUtil.canSetVoxelQuadTexture(userRole, room, quadIndex))
        {
            console.error(`VoxelUpdateUtil::setVoxelQuadTexture :: Failed (quadIndex=${quadIndex})`);
            return false;
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const voxel = VoxelQueryUtil.getVoxel(voxels, row, col)!;
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        if (!VoxelQuadUpdateUtil.setVoxelQuadVisible(true, voxel, facingAxis, orientation, collisionLayer, textureIndex))
            return false;

        if (room)
            room.dirty = true;
        return true;
    },
};

function updateAllVoxelBlockSides(voxels: Voxel[], voxel: Voxel, collisionLayer: number,
    quadTextureIndicesWithinLayer?: number[])
{
    let lowerCollisionLayer = collisionLayer-1;
    if (lowerCollisionLayer < COLLISION_LAYER_MIN)
        lowerCollisionLayer = COLLISION_LAYER_NULL;
    let upperCollisionLayer = collisionLayer+1;
    if (upperCollisionLayer > COLLISION_LAYER_MAX)
        upperCollisionLayer = COLLISION_LAYER_NULL;

    updateVoxelBlockSide(voxels, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "y", "-", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("y", "-")] : undefined);
    updateVoxelBlockSide(voxels, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "y", "+", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("y", "+")] : undefined);
    updateVoxelBlockSide(voxels, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "x", "-", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("x", "-")] : undefined);
    updateVoxelBlockSide(voxels, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "x", "+", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("x", "+")] : undefined);
    updateVoxelBlockSide(voxels, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "z", "-", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("z", "-")] : undefined);
    updateVoxelBlockSide(voxels, voxel, collisionLayer, lowerCollisionLayer, upperCollisionLayer,
        "z", "+", quadTextureIndicesWithinLayer != undefined ?
            quadTextureIndicesWithinLayer[VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer("z", "+")] : undefined);
}

function updateVoxelBlockSide(voxels: Voxel[], voxel: Voxel, collisionLayer: number, lowerCollisionLayer: number, upperCollisionLayer: number,
    facingAxis: "x" | "y" | "z", outOrientation: "-" | "+", quadTextureIndicesWithinLayer: number = -1)
{
    let adjBlockVoxel: Voxel | undefined = voxel;
    let adjBlockCollisionLayer = collisionLayer;

    switch (facingAxis)
    {
        case "y":
            adjBlockCollisionLayer = (outOrientation == "-" ? lowerCollisionLayer : upperCollisionLayer);
            break;
        case "x":
            adjBlockVoxel = VoxelQueryUtil.getVoxel(voxels, voxel.row, voxel.col + (outOrientation == "-" ? -1 : 1));
            break;
        case "z":
            adjBlockVoxel = VoxelQueryUtil.getVoxel(voxels, voxel.row + (outOrientation == "-" ? -1 : 1), voxel.col);
            break;
    }

    const myBlockOccupied = VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer);
    const adjBlockOccupied = (adjBlockVoxel != undefined) &&
        VoxelQueryUtil.isVoxelCollisionLayerOccupied(adjBlockVoxel, adjBlockCollisionLayer);

    const showMyQuad = myBlockOccupied && !adjBlockOccupied;
    const showAdjQuad = adjBlockOccupied && !myBlockOccupied;

    VoxelQuadUpdateUtil.setVoxelQuadVisible(showMyQuad, voxel, facingAxis, outOrientation,
        collisionLayer, quadTextureIndicesWithinLayer);
    if (adjBlockVoxel)
    {
        VoxelQuadUpdateUtil.setVoxelQuadVisible(showAdjQuad, adjBlockVoxel, facingAxis, outOrientation == "-" ? "+" : "-",
            adjBlockCollisionLayer);
    }
}

export default VoxelUpdateUtil;
