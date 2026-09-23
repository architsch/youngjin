import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_QUADS_PER_ROOM } from "../../system/sharedConstants";
import Room from "../../room/types/room";
import User from "../../user/types/user";
import VoxelQuadUpdateUtil from "./voxelQuadUpdateUtil";
import VoxelQueryUtil from "./voxelQueryUtil";
import Voxel from "../types/voxel";
import ObjectAttachmentUtil from "../../object/util/objectAttachmentUtil";
import RoomValidationUtil from "../../room/util/roomValidationUtil";
import RestrictedZoneUtil from "./restrictedZoneUtil";

// Validates externally supplied quadIndex values. The index arithmetic accepts any number, so this gives
// a clear error, rejects huge values from old client bundles with a narrower field, and rejects
// non-integers. Repeated in mutators, since mutators called without a room skip the can* predicates.
function quadIndexIsInRange(methodName: string, quadIndex: number): boolean
{
    if (VoxelQueryUtil.isValidVoxelQuadIndex(quadIndex))
        return true;
    console.error(`VoxelUpdateUtil::${methodName} :: quadIndex is out of range ` +
        `(quadIndex=${quadIndex}, valid range = [0, ${NUM_VOXEL_QUADS_PER_ROOM}))`);
    return false;
}

// Entry points take the requesting user (permission is personal: owner, or admin in a hub).
// - With a room: the edit is validated for that user (a missing user is refused).
// - Without a room: generation or format conversion, with nothing to validate.
const VoxelUpdateUtil =
{
    canAddVoxelBlock(user: User, room: Room, quadIndex: number): boolean
    {
        if (!quadIndexIsInRange("canAddVoxelBlock", quadIndex))
            return false;

        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            return false;
        if (RestrictedZoneUtil.blocksVoxelBlockEdit(user, room, row, col))
            return false;

        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
            return false;
        if (VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
            return false;

        return true;
    },
    addVoxelBlock(user: User | undefined, voxels: Voxel[], quadIndex: number,
        quadTextureIndicesWithinLayer?: number[],
        room?: Room): boolean // Won't validate if the room is not defined (e.g. when generating a brand new room, or force-modifying a room's voxelGrid).
    {
        if (!quadIndexIsInRange("addVoxelBlock", quadIndex))
            return false;
        if (room != undefined) // A room to check against means the edit is somebody's — see the header.
        {
            if (user == undefined || !VoxelUpdateUtil.canAddVoxelBlock(user, room, quadIndex))
            {
                console.error(`VoxelUpdateUtil::addVoxelBlock :: Failed (quadIndex=${quadIndex})`);
                return false;
            }
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
        if (!voxel)
        {
            console.error(`VoxelUpdateUtil::addVoxelBlock :: Voxel not found (quadIndex=${quadIndex})`);
            return false;
        }
        voxel.collisionLayerMask |= (1 << collisionLayer);

        updateAllVoxelBlockSides(voxels, voxel, collisionLayer, quadTextureIndicesWithinLayer);

        if (room)
            room.dirty = true;
        return true;
    },

    canRemoveVoxelBlock(user: User, room: Room, quadIndex: number): boolean
    {
        // Blocks with attachments can't be removed alone; removing both uses
        // canRemoveVoxelBlockWithItsAttachments after the attachments are gone.
        return VoxelUpdateUtil.canRemoveVoxelBlockWithItsAttachments(user, room, quadIndex)
            && ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex).length == 0;
    },
    // canRemoveVoxelBlock without the attachment check (for callers that remove attachments first).
    canRemoveVoxelBlockWithItsAttachments(user: User, room: Room, quadIndex: number): boolean
    {
        if (!quadIndexIsInRange("canRemoveVoxelBlockWithItsAttachments", quadIndex))
            return false;

        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            return false;
        if (RestrictedZoneUtil.blocksVoxelBlockEdit(user, room, row, col))
            return false;

        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
            return false;
        if (!VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
            return false;

        return true;
    },
    removeVoxelBlock(user: User | undefined, voxels: Voxel[], quadIndex: number,
        room?: Room): boolean // Won't validate if the room is not defined (e.g. when generating a brand new room, or force-modifying a room's voxelGrid).
    {
        if (!quadIndexIsInRange("removeVoxelBlock", quadIndex))
            return false;
        if (room != undefined) // A room to check against means the edit is somebody's — see the header.
        {
            if (user == undefined || !VoxelUpdateUtil.canRemoveVoxelBlock(user, room, quadIndex))
            {
                console.error(`VoxelUpdateUtil::removeVoxelBlock :: Failed (quadIndex=${quadIndex})`);
                return false;
            }
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
        if (!voxel)
        {
            console.error(`VoxelUpdateUtil::removeVoxelBlock :: Voxel not found (quadIndex=${quadIndex})`);
            return false;
        }
        voxel.collisionLayerMask &= ~(1 << collisionLayer);

        updateAllVoxelBlockSides(voxels, voxel, collisionLayer);

        if (room)
            room.dirty = true;
        return true;
    },

    // No zone check here: the add and remove each check, so blocks can't cross zone boundaries.
    canMoveVoxelBlock(user: User, room: Room, quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number): boolean
    {
        if (!quadIndexIsInRange("canMoveVoxelBlock", quadIndex))
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

        return VoxelUpdateUtil.canAddVoxelBlock(user, room, targetQuadIndex)
            && VoxelUpdateUtil.canRemoveVoxelBlock(user, room, quadIndex);
    },
    moveVoxelBlock(user: User | undefined, voxels: Voxel[], quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number,
        room?: Room): boolean // Won't validate if the room is not defined (e.g. when generating a brand new room, or force-modifying a room's voxelGrid).
    {
        if (!quadIndexIsInRange("moveVoxelBlock", quadIndex))
            return false;
        if (room != undefined) // A room to check against means the edit is somebody's — see the header.
        {
            if (user == undefined || !VoxelUpdateUtil.canMoveVoxelBlock(user, room, quadIndex,
                rowOffset, colOffset, collisionLayerOffset))
            {
                console.error(`VoxelUpdateUtil::moveVoxelBlock :: Failed (quadIndex=${quadIndex})`);
                return false;
            }
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        let newCollisionLayer = collisionLayer + collisionLayerOffset;
        if (newCollisionLayer < COLLISION_LAYER_MIN || newCollisionLayer > COLLISION_LAYER_MAX)
            newCollisionLayer = COLLISION_LAYER_NULL;

        const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(
            row + rowOffset, col + colOffset, "y", "-", newCollisionLayer);

        // Offsets are external too, so an off-grid destination is reported as invalid, not wrapped.
        if (!quadIndexIsInRange("moveVoxelBlock (destination)", targetQuadIndex))
            return false;

        const quadTextureIndicesWithinLayer: number[] = [];
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
        for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            quadTextureIndicesWithinLayer.push(voxels[0].quadsMem.quads[i] & 0b01111111);

        // Internal helpers avoid re-checking; canMoveVoxelBlock already validated both halves.
        const addRow = VoxelQueryUtil.getVoxelRowFromQuadIndex(targetQuadIndex);
        const addCol = VoxelQueryUtil.getVoxelColFromQuadIndex(targetQuadIndex);
        const addCollisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(targetQuadIndex);

        const addVoxel = VoxelQueryUtil.getVoxel(voxels, addRow, addCol);
        const removeVoxel = VoxelQueryUtil.getVoxel(voxels, row, col);
        if (!addVoxel || !removeVoxel)
        {
            console.error(`VoxelUpdateUtil::moveVoxelBlock :: Voxel not found (quadIndex=${quadIndex}, targetQuadIndex=${targetQuadIndex})`);
            return false;
        }

        addVoxel.collisionLayerMask |= (1 << addCollisionLayer);
        updateAllVoxelBlockSides(voxels, addVoxel, addCollisionLayer, quadTextureIndicesWithinLayer);

        removeVoxel.collisionLayerMask &= ~(1 << collisionLayer);
        updateAllVoxelBlockSides(voxels, removeVoxel, collisionLayer);

        if (room)
            room.dirty = true;
        return true;
    },

    canSetVoxelQuadTexture(user: User, room: Room, quadIndex: number): boolean
    {
        if (!quadIndexIsInRange("canSetVoxelQuadTexture", quadIndex))
            return false;

        // Checked per face, so a zone's outer faces stay paintable (see RestrictedZoneUtil).
        if (RestrictedZoneUtil.blocksVoxelQuadEdit(user, room, quadIndex))
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
    setVoxelQuadTexture(user: User | undefined, voxels: Voxel[],
        quadIndex: number, textureIndex: number,
        room?: Room): boolean // Won't validate if the room is not defined (e.g. when generating a brand new room, or force-modifying a room's voxelGrid).
    {
        if (!quadIndexIsInRange("setVoxelQuadTexture", quadIndex))
            return false;
        if (room != undefined) // A room to check against means the edit is somebody's — see the header.
        {
            if (user == undefined || !VoxelUpdateUtil.canSetVoxelQuadTexture(user, room, quadIndex))
            {
                console.error(`VoxelUpdateUtil::setVoxelQuadTexture :: Failed (quadIndex=${quadIndex})`);
                return false;
            }
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
        if (!voxel)
        {
            console.error(`VoxelUpdateUtil::setVoxelQuadTexture :: Voxel not found (quadIndex=${quadIndex})`);
            return false;
        }
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
    // Out-of-grid neighbours count as solid, so the room's outer shell is never drawn (it would hide the
    // room from an orbit camera outside the walls). Only x/z faces can point out of the grid.
    const adjBlockOccupied = (adjBlockVoxel == undefined) ||
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
