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
        if (RestrictedZoneUtil.blocksVoxelBlockEdit(user, room, row, col, collisionLayer))
            return false;

        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
            return false;
        if (VoxelQueryUtil.isVoxelBlockPresent(voxel, collisionLayer))
            return false;

        return true;
    },
    // Unvalidated, it also gives a block already there its textures (a relayed edit, or the server's
    // correction of one of the user's own; see ServerVoxelManager).
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
        if (!voxel || !layerHoldsBlocks(collisionLayer))
        {
            console.error(`VoxelUpdateUtil::addVoxelBlock :: No cell layer to hold a block (quadIndex=${quadIndex})`);
            return false;
        }
        setVoxelBlock(voxels, voxel, collisionLayer, true, quadTextureIndicesWithinLayer);

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
        if (RestrictedZoneUtil.blocksVoxelBlockEdit(user, room, row, col, collisionLayer))
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
        setVoxelBlock(voxels, voxel, collisionLayer, false);

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
        if (!addVoxel || !removeVoxel || !layerHoldsBlocks(addCollisionLayer) || !layerHoldsBlocks(collisionLayer))
        {
            console.error(`VoxelUpdateUtil::moveVoxelBlock :: No cell layer to hold a block (quadIndex=${quadIndex}, targetQuadIndex=${targetQuadIndex})`);
            return false;
        }

        setVoxelBlock(voxels, addVoxel, addCollisionLayer, true, quadTextureIndicesWithinLayer);
        setVoxelBlock(voxels, removeVoxel, collisionLayer, false);

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

// The room's own floor and ceiling quads sit outside the layers, where no block can be (see
// COLLISION_LAYER_NULL).
function layerHoldsBlocks(collisionLayer: number): boolean
{
    return collisionLayer >= COLLISION_LAYER_MIN && collisionLayer <= COLLISION_LAYER_MAX;
}

// Puts a block into a cell layer or takes it out, gives its faces their textures, if given, then
// announces every quad that is drawn differently for it. On each side that is the block's own face
// (repainted, or bared or lost against open space) or the face looking back at it (covered or
// uncovered); which are drawn follows VoxelQueryUtil.isVoxelQuadVisible.
function setVoxelBlock(voxels: Voxel[], voxel: Voxel, collisionLayer: number, present: boolean,
    quadTextureIndicesWithinLayer?: number[])
{
    const wasPresent = VoxelQueryUtil.isVoxelBlockPresent(voxel, collisionLayer);
    if (present == wasPresent && quadTextureIndicesWithinLayer == undefined)
        return;
    if (present)
        voxel.blockLayerMask |= (1 << collisionLayer);
    else
        voxel.blockLayerMask &= ~(1 << collisionLayer);

    const firstQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(voxel.row, voxel.col, collisionLayer);
    for (let i = 0; i < BLOCK_FACES.length; ++i)
    {
        const {facingAxis, orientation} = BLOCK_FACES[i];
        const step = (orientation == "+") ? 1 : -1;
        const facedRow = voxel.row + ((facingAxis == "z") ? step : 0);
        const facedCol = voxel.col + ((facingAxis == "x") ? step : 0);
        const facedCollisionLayer = collisionLayer + ((facingAxis == "y") ? step : 0);

        // (A face given another texture is announced for that.)
        const textureIndex = quadTextureIndicesWithinLayer?.[i] ?? -1;
        const repainted = textureIndex >= 0 &&
            VoxelQuadUpdateUtil.setVoxelQuadTexture(voxel, firstQuadIndex + i, textureIndex);
        if (present == wasPresent)
            continue;

        if (!VoxelQueryUtil.isVoxelBlockPresentAt(voxels, facedRow, facedCol, facedCollisionLayer))
        {
            if (!repainted)
                VoxelQuadUpdateUtil.announceVoxelQuadChange(voxel, firstQuadIndex + i);
            continue;
        }
        // Past the end layers the face looking back is the room's own floor or ceiling (see
        // COLLISION_LAYER_NULL); outside the grid there is none.
        const facedVoxel = VoxelQueryUtil.getVoxel(voxels, facedRow, facedCol);
        if (facedVoxel)
        {
            VoxelQuadUpdateUtil.announceVoxelQuadChange(facedVoxel, VoxelQueryUtil.getVoxelQuadIndex(
                facedRow, facedCol, facingAxis, (orientation == "+") ? "-" : "+",
                (facedCollisionLayer < COLLISION_LAYER_MIN || facedCollisionLayer > COLLISION_LAYER_MAX)
                    ? COLLISION_LAYER_NULL : facedCollisionLayer));
        }
    }
}

export default VoxelUpdateUtil;
