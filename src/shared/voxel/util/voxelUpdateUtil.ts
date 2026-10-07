import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_QUADS_PER_ROOM, VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_WHOLE } from "../../system/sharedConstants";
import Room from "../../room/types/room";
import User from "../../user/types/user";
import VoxelQuadUpdateUtil from "./voxelQuadUpdateUtil";
import VoxelQueryUtil from "./voxelQueryUtil";
import VoxelBlockShapeUtil from "./voxelBlockShapeUtil";
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
    // shape: the shape the new block takes, a whole one unless said.
    canAddVoxelBlock(user: User, room: Room, quadIndex: number, shape: number = VOXEL_BLOCK_SHAPE_WHOLE): boolean
    {
        if (!quadIndexIsInRange("canAddVoxelBlock", quadIndex))
            return false;
        if (!shapeIsOfABlock(shape))
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
        if (VoxelQueryUtil.isVoxelBlockPresent(voxel, collisionLayer))
            return false;

        return true;
    },
    // Unvalidated, it also replaces a block already there, shape and textures (a relayed edit, or the
    // server's correction of one of the user's own; see ServerVoxelManager).
    addVoxelBlock(user: User | undefined, voxels: Voxel[], quadIndex: number,
        quadTextureIndicesWithinLayer?: number[],
        room?: Room, // Won't validate if the room is not defined (e.g. when generating a brand new room, or force-modifying a room's voxelGrid).
        shape: number = VOXEL_BLOCK_SHAPE_WHOLE): boolean
    {
        if (!quadIndexIsInRange("addVoxelBlock", quadIndex))
            return false;
        if (room != undefined) // A room to check against means the edit is somebody's — see the header.
        {
            if (user == undefined || !VoxelUpdateUtil.canAddVoxelBlock(user, room, quadIndex, shape))
            {
                console.error(`VoxelUpdateUtil::addVoxelBlock :: Failed (quadIndex=${quadIndex})`);
                return false;
            }
        }
        else if (!shapeIsOfABlock(shape))
        {
            console.error(`VoxelUpdateUtil::addVoxelBlock :: Not a block's shape (shape=${shape})`);
            return false;
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
        if (!voxel || !layerHoldsBlocks(collisionLayer))
        {
            console.error(`VoxelUpdateUtil::addVoxelBlock :: No cell layer to hold a block (quadIndex=${quadIndex})`);
            return false;
        }
        applyVoxelBlockShape(voxels, voxel, collisionLayer, shape, quadTextureIndicesWithinLayer);

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
        if (!VoxelQueryUtil.isVoxelBlockPresent(voxel, collisionLayer))
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
        if (!voxel || !layerHoldsBlocks(collisionLayer))
        {
            console.error(`VoxelUpdateUtil::removeVoxelBlock :: No cell layer to hold a block (quadIndex=${quadIndex})`);
            return false;
        }
        applyVoxelBlockShape(voxels, voxel, collisionLayer, VOXEL_BLOCK_SHAPE_EMPTY);

        if (room)
            room.dirty = true;
        return true;
    },

    // Whether a block may be given another shape where it stands (see VoxelBlockShapeUtil): resized, or
    // slid to another part of its cell. Refused while something attached to it would be left without its
    // footing or buried.
    canSetVoxelBlockShape(user: User, room: Room, quadIndex: number, shape: number): boolean
    {
        if (!quadIndexIsInRange("canSetVoxelBlockShape", quadIndex))
            return false;
        if (!shapeIsOfABlock(shape))
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
        if (!VoxelQueryUtil.isVoxelBlockPresent(voxel, collisionLayer))
            return false;

        const asReshaped = {row, col, collisionLayer, shape};
        for (const objectId of ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
        {
            const object = room.objectById[objectId];
            if (object && !ObjectAttachmentUtil.canPlaceObject(room, objectId, object.objectTypeIndex,
                object.transform, asReshaped))
            {
                return false;
            }
        }
        return true;
    },
    setVoxelBlockShape(user: User | undefined, voxels: Voxel[], quadIndex: number, shape: number,
        room?: Room): boolean // Won't validate if the room is not defined (e.g. a relayed edit).
    {
        if (!quadIndexIsInRange("setVoxelBlockShape", quadIndex))
            return false;
        if (room != undefined) // A room to check against means the edit is somebody's — see the header.
        {
            if (user == undefined || !VoxelUpdateUtil.canSetVoxelBlockShape(user, room, quadIndex, shape))
            {
                console.error(`VoxelUpdateUtil::setVoxelBlockShape :: Failed (quadIndex=${quadIndex}, shape=${shape})`);
                return false;
            }
        }
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
        // (A shape is given only to a block that is there; taking one away or putting one up is another edit.)
        if (!voxel || !layerHoldsBlocks(collisionLayer) || !shapeIsOfABlock(shape) ||
            !VoxelQueryUtil.isVoxelBlockPresent(voxel, collisionLayer))
        {
            console.error(`VoxelUpdateUtil::setVoxelBlockShape :: No block to shape so (quadIndex=${quadIndex}, shape=${shape})`);
            return false;
        }
        applyVoxelBlockShape(voxels, voxel, collisionLayer, shape);

        if (room)
            room.dirty = true;
        return true;
    },

    // No zone check here: the add and remove each check, so blocks can't cross zone boundaries.
    // The block keeps its shape where it goes.
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
        const shape = VoxelQueryUtil.getVoxelBlockShape(voxel, collisionLayer);

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

        return VoxelUpdateUtil.canAddVoxelBlock(user, room, targetQuadIndex, shape)
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
        if (!addVoxel || !removeVoxel || !layerHoldsBlocks(addCollisionLayer) || !layerHoldsBlocks(collisionLayer))
        {
            console.error(`VoxelUpdateUtil::moveVoxelBlock :: No cell layer to hold a block (quadIndex=${quadIndex}, targetQuadIndex=${targetQuadIndex})`);
            return false;
        }

        // (Unvalidated, a block that isn't there is still put down where it was sent, as a whole one.)
        let shape = VoxelQueryUtil.getVoxelBlockShape(removeVoxel, collisionLayer);
        if (shape == VOXEL_BLOCK_SHAPE_EMPTY)
            shape = VOXEL_BLOCK_SHAPE_WHOLE;

        applyVoxelBlockShape(voxels, addVoxel, addCollisionLayer, shape, quadTextureIndicesWithinLayer);
        applyVoxelBlockShape(voxels, removeVoxel, collisionLayer, VOXEL_BLOCK_SHAPE_EMPTY);

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

        // The quad must be visible (i.e. its block face must be exposed).
        return VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, quadIndex);
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
        if (!VoxelQuadUpdateUtil.setVoxelQuadTexture(voxel, quadIndex, textureIndex))
            return false;

        if (room)
            room.dirty = true;
        return true;
    },
};

// A block's faces, in the order of its quads (see NUM_VOXEL_QUADS_PER_COLLISION_LAYER).
const BLOCK_FACES: {facingAxis: "x" | "y" | "z", orientation: "-" | "+"}[] = [
    {facingAxis: "y", orientation: "-"}, {facingAxis: "y", orientation: "+"},
    {facingAxis: "x", orientation: "-"}, {facingAxis: "x", orientation: "+"},
    {facingAxis: "z", orientation: "-"}, {facingAxis: "z", orientation: "+"},
];

// Whether a shape is one a block can have: a valid one, and not the empty one, which is no block.
function shapeIsOfABlock(shape: number): boolean
{
    return shape != VOXEL_BLOCK_SHAPE_EMPTY && VoxelBlockShapeUtil.isValid(shape);
}

// The room's own floor and ceiling quads sit outside the layers, where no block can be (see
// COLLISION_LAYER_NULL); a block written there would land in the next voxel's shapes.
function layerHoldsBlocks(collisionLayer: number): boolean
{
    return collisionLayer >= COLLISION_LAYER_MIN && collisionLayer <= COLLISION_LAYER_MAX;
}

// Gives a block its shape (the empty one takes the block away) and its faces their textures, if given,
// then announces every quad that is drawn differently for it. On each side that can be the block's own
// face (repainted, covered, uncovered, or a different rectangle) and the face looking back at it (covered
// or uncovered); which are drawn follows VoxelQueryUtil.isVoxelQuadVisible.
function applyVoxelBlockShape(voxels: Voxel[], voxel: Voxel, collisionLayer: number, shape: number,
    quadTextureIndicesWithinLayer?: number[])
{
    const blockIndex = VoxelQueryUtil.getVoxelBlockIndex(voxel.row, voxel.col, collisionLayer);
    const oldShape = voxel.quadsMem.blockShapes[blockIndex];
    if (shape == oldShape && quadTextureIndicesWithinLayer == undefined)
        return;
    voxel.quadsMem.blockShapes[blockIndex] = shape;

    const firstQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, collisionLayer);
    for (let i = 0; i < BLOCK_FACES.length; ++i)
    {
        const {facingAxis, orientation} = BLOCK_FACES[i];
        const facedOrientation = (orientation == "+") ? "-" : "+";
        const step = (orientation == "+") ? 1 : -1;
        const facedRow = voxel.row + ((facingAxis == "z") ? step : 0);
        const facedCol = voxel.col + ((facingAxis == "x") ? step : 0);
        const facedCollisionLayer = collisionLayer + ((facingAxis == "y") ? step : 0);
        const facedShape = VoxelQueryUtil.getVoxelBlockShapeAt(voxels, facedRow, facedCol, facedCollisionLayer);

        // Each face's reach on this side of the cell (see VoxelBlockShapeUtil.showsFace, whose rule this
        // applies to masks worked out once, since generation makes these edits by the thousand).
        const oldSide = VoxelBlockShapeUtil.getSideMask(oldShape, facingAxis, orientation);
        const newSide = VoxelBlockShapeUtil.getSideMask(shape, facingAxis, orientation);
        const facedSide = VoxelBlockShapeUtil.getSideMask(facedShape, facingAxis, facedOrientation);

        // (A face given another texture is announced for that.)
        const textureIndex = quadTextureIndicesWithinLayer?.[i] ?? -1;
        if (textureIndex < 0 || !VoxelQuadUpdateUtil.setVoxelQuadTexture(voxel, firstQuadIndex + i, textureIndex))
        {
            const wasDrawn = oldShape != VOXEL_BLOCK_SHAPE_EMPTY && VoxelBlockShapeUtil.isSideBare(oldSide, facedSide);
            const isDrawn = shape != VOXEL_BLOCK_SHAPE_EMPTY && VoxelBlockShapeUtil.isSideBare(newSide, facedSide);
            if (wasDrawn != isDrawn ||
                (isDrawn && !VoxelBlockShapeUtil.facesMatch(oldShape, shape, facingAxis, orientation)))
            {
                VoxelQuadUpdateUtil.announceVoxelQuadChange(voxel, firstQuadIndex + i);
            }
        }

        if (facedShape == VOXEL_BLOCK_SHAPE_EMPTY ||
            VoxelBlockShapeUtil.isSideBare(facedSide, oldSide) == VoxelBlockShapeUtil.isSideBare(facedSide, newSide))
        {
            continue;
        }
        // Past the end layers the face looking back is the room's own floor or ceiling (see
        // COLLISION_LAYER_NULL); outside the grid there is none.
        const facedVoxel = VoxelQueryUtil.getVoxel(voxels, facedRow, facedCol);
        if (facedVoxel)
        {
            VoxelQuadUpdateUtil.announceVoxelQuadChange(facedVoxel, VoxelQueryUtil.getVoxelQuadIndex(
                facedRow, facedCol, facingAxis, facedOrientation,
                (facedCollisionLayer < COLLISION_LAYER_MIN || facedCollisionLayer > COLLISION_LAYER_MAX)
                    ? COLLISION_LAYER_NULL : facedCollisionLayer));
        }
    }
}

export default VoxelUpdateUtil;
