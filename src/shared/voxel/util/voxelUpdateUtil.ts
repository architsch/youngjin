import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_QUADS_PER_ROOM } from "../../system/sharedConstants";
import Room from "../../room/types/room";
import User from "../../user/types/user";
import VoxelQuadUpdateUtil from "./voxelQuadUpdateUtil";
import VoxelQueryUtil from "./voxelQueryUtil";
import Voxel from "../types/voxel";
import WallAttachedObjectUtil from "../../object/util/wallAttachedObjectUtil";
import RoomValidationUtil from "../../room/util/roomValidationUtil";
import RestrictedZoneUtil from "./restrictedZoneUtil";

// Every entry point here takes a quadIndex, and a quadIndex arrives from outside: decoded off a
// voxel edit signal, or computed by a caller from a selection. The arithmetic that turns one back
// into a row, a column and a collision layer answers for any number at all — it divides and takes
// remainders, and neither objects — so an index from outside the room comes back as the coordinates
// of some quad rather than as an error.
//
// As the room is currently shaped, an index past the end happens to divide out to a row past the
// end too, which getVoxel already refuses. That is arithmetic rather than a guarantee, and it is
// not what the checks further in are for, so it is not what this relies on:
//
//   - It names the fault. Without it the log says "Voxel not found", which sent a reader looking
//     for a missing voxel the last time an index field turned out to be too narrow.
//   - It covers the width of the field itself. A deployment leaves browser sessions running the
//     previous bundle, whose narrower quadIndex runs into the bytes behind it and decodes as an
//     enormous number; refusing that is what keeps the changeover from writing somewhere else.
//   - It rejects an index that is not a whole number, which no check further in does.
//
// The check is repeated in the mutating methods rather than left to the can* predicates alone,
// because a mutator called without a room skips its predicate entirely — that is how a brand-new
// room is generated, and how a client applies an update the server has already accepted.
function quadIndexIsInRange(methodName: string, quadIndex: number): boolean
{
    if (VoxelQueryUtil.isValidVoxelQuadIndex(quadIndex))
        return true;
    console.error(`VoxelUpdateUtil::${methodName} :: quadIndex is out of range ` +
        `(quadIndex=${quadIndex}, valid range = [0, ${NUM_VOXEL_QUADS_PER_ROOM}))`);
    return false;
}

// Every entry point below is told who is asking, because being allowed to edit is a fact about the
// person: he owns this room, or he is an admin and this is a hub whose restricted zones are his
// alone (see @docs/gameplay/restricted_zone.md).
//
// Each mutator is asked in one of two ways, and the room is what tells them apart:
//
//   - **With a room**, the edit is somebody's, and it is checked against what that somebody may do
//     here. The person has to be named: a room handed over with no user is that same request with
//     its subject missing, so it is refused rather than waved through — whoever means to have an
//     edit checked has to say who it is being checked for.
//   - **With no room**, the edit is on nobody's behalf — a room being generated, or a format
//     converter bringing an old grid up to date — and there is nothing to check it against.
const VoxelUpdateUtil =
{
    canAddVoxelBlock(user: User, room: Room, quadIndex: number): boolean
    {
        if (!quadIndexIsInRange("canAddVoxelBlock", quadIndex))
            return false;
        if (!RoomValidationUtil.canUserEditRoom(user, room))
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
        // A block with something hanging on it cannot go on its own: the attachment would be left
        // with no wall behind it. Taking both down together is a request of its own, made through
        // canRemoveVoxelBlockWithItsWallAttachments once the attachments have been removed.
        return VoxelUpdateUtil.canRemoveVoxelBlockWithItsWallAttachments(user, room, quadIndex)
            && WallAttachedObjectUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex).length == 0;
    },
    // Everything canRemoveVoxelBlock asks of the block itself, minus the objects hanging on it —
    // for a caller that removes those first, and so leaves nothing behind without its support.
    canRemoveVoxelBlockWithItsWallAttachments(user: User, room: Room, quadIndex: number): boolean
    {
        if (!quadIndexIsInRange("canRemoveVoxelBlockWithItsWallAttachments", quadIndex))
            return false;
        if (!RoomValidationUtil.canUserEditRoom(user, room))
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

    // Nothing about restricted zones is asked here: a move is an add and a remove, and each of those
    // asks for itself, so a block may neither be carried into a zone nor out of one.
    canMoveVoxelBlock(user: User, room: Room, quadIndex: number,
        rowOffset: number, colOffset: number, collisionLayerOffset: number): boolean
    {
        if (!quadIndexIsInRange("canMoveVoxelBlock", quadIndex))
            return false;
        if (!RoomValidationUtil.canUserEditRoom(user, room))
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

        // The offsets arrive from outside alongside the quadIndex, so the destination they point at
        // is no more trusted than the source: an offset carrying the block past the edge of the grid
        // is reported here as an invalid index rather than resolved to a cell on the far side.
        if (!quadIndexIsInRange("moveVoxelBlock (destination)", targetQuadIndex))
            return false;

        const quadTextureIndicesWithinLayer: number[] = [];
        const startIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
        for (let i = startIndex; i < startIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            quadTextureIndicesWithinLayer.push(voxels[0].quadsMem.quads[i] & 0b01111111);

        // Use internal helpers directly to avoid double user-role checking.
        // canMoveVoxelBlock already validated both add and remove.
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
        if (!RoomValidationUtil.canUserEditRoom(user, room))
            return false;

        // Asked of the face rather than of the voxel it belongs to, so that the surface a zone is
        // seen through from outside it stays paintable — see RestrictedZoneUtil.
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
    // A neighbour outside the grid counts as solid, so the room's outer shell is never drawn: the
    // orbit camera pulls back past the boundary walls, and a shell drawn from out there would hide
    // the very room the user is looking into. Only x/z faces can point out of the grid — the y ones
    // stay within their own voxel — so the floor and ceiling tiles are untouched by this.
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
