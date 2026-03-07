import EncodableByteString from "../../networking/types/encodableByteString";
import Room from "../../room/types/room";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, MAX_IMAGE_URL_LENGTH, MAX_ROOM_Y } from "../../system/sharedConstants";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import { ObjectMetadata } from "../types/objectMetadata";
import PersistentObject from "../types/persistentObject";
import { Dir4 } from "../../math/types/dir4";
import DirUtil from "../../math/util/dirUtil";

const PersistentObjectUpdateUtil =
{
    //-------------------------------------------------------------------------------------
    // CRUD Operations
    //-------------------------------------------------------------------------------------

    canAddPersistentObject(room: Room, objectTypeIndex: number,
        direction: Dir4, x: number, y: number, z: number): boolean
    {
        // (Potential future plan): Might also need to check collision with existing persistentObjects.
        return isPersistentObjectPositionInBound(x, y, z);
    },

    addPersistentObject(room: Room, objectTypeIndex: number,
        direction: Dir4, x: number, y: number, z: number,
        metadata: ObjectMetadata = {}, objectId?: string): PersistentObject | null
    {
        if (!PersistentObjectUpdateUtil.canAddPersistentObject(room, objectTypeIndex, direction, x, y, z))
        {
            console.error(`PersistentObjectUpdateUtil.addPersistentObject :: Failed (x=${x}, y=${y}, z=${z})`);
            return null;
        }

        if (!objectId)
            objectId = `p${++room.persistentObjectGroup.lastPersistentObjectId}`;

        const po = new PersistentObject(objectId, objectTypeIndex, direction, x, y, z, metadata);
        room.persistentObjectGroup.persistentObjectById[objectId] = po;
        return po;
    },

    canRemovePersistentObject(room: Room, objectId: string): boolean
    {
        return room.persistentObjectGroup.persistentObjectById[objectId] != undefined;
    },

    removePersistentObject(room: Room, objectId: string): PersistentObject | null
    {
        if (!PersistentObjectUpdateUtil.canRemovePersistentObject(room, objectId))
        {
            console.error(`PersistentObjectUpdateUtil.removePersistentObject :: Failed (objectId=${objectId})`);
            return null;
        }
        const removed = room.persistentObjectGroup.persistentObjectById[objectId];
        delete room.persistentObjectGroup.persistentObjectById[objectId];
        return removed;
    },

    canMovePersistentObject(room: Room, objectId: string,
        dx: number, dy: number, dz: number): boolean
    {
        const po = room.persistentObjectGroup.persistentObjectById[objectId];
        if (!po)
            return false;

        const config = ObjectTypeConfigMap.getConfigByIndex(po.objectTypeIndex);
        let newX = po.x + dx;
        let newY = po.y + dy;
        let newZ = po.z + dz;

        if (config.isWallAttached)
        {
            const {worldDx, worldDz} = DirUtil.localDxToWorldDxDz(po.dir, dx);
            newX = po.x + worldDx;
            newZ = po.z + worldDz;

            if (!isPersistentObjectPositionInBound(newX, newY, newZ) ||
                !isWallAt(room, newX, newY, newZ, po.dir))
            {
                let wrapped = tryCornerWrap(room, po, dx, newY);
                if (!wrapped)
                    wrapped = tryCornerWrap(room, po, dx, newY, true);
                if (!wrapped)
                    return false;
                newX = wrapped.x;
                newZ = wrapped.z;
            }
        }

        if (!isPersistentObjectPositionInBound(newX, newY, newZ))
            return false;

        return true;
    },

    movePersistentObject(room: Room, objectId: string,
        dx: number, dy: number, dz: number): PersistentObject | null
    {
        if (!PersistentObjectUpdateUtil.canMovePersistentObject(room, objectId, dx, dy, dz))
        {
            console.error(`PersistentObjectUpdateUtil.movePersistentObject :: Failed (objectId=${objectId}, dx=${dx}, dy=${dy}, dz=${dz})`);
            return null;
        }

        const po = room.persistentObjectGroup.persistentObjectById[objectId];

        const config = ObjectTypeConfigMap.getConfigByIndex(po.objectTypeIndex);
        let newX = po.x + dx;
        let newY = po.y + dy;
        let newZ = po.z + dz;
        let newDirection = po.dir;

        if (config.isWallAttached)
        {
            const {worldDx, worldDz} = DirUtil.localDxToWorldDxDz(po.dir, dx);
            newX = po.x + worldDx;
            newZ = po.z + worldDz;
            newDirection = po.dir;

            if (!isPersistentObjectPositionInBound(newX, newY, newZ) ||
                !isWallAt(room, newX, newY, newZ, po.dir))
            {
                let wrapped = tryCornerWrap(room, po, dx, newY);
                if (!wrapped)
                    wrapped = tryCornerWrap(room, po, dx, newY, true);
                if (!wrapped)
                    return null;
                newX = wrapped.x;
                newZ = wrapped.z;
                newDirection = wrapped.direction;
            }
        }

        if (!isPersistentObjectPositionInBound(newX, newY, newZ))
            return null;

        po.x = newX;
        po.y = newY;
        po.z = newZ;
        po.dir = newDirection;
        return po;
    },

    canSetPersistentObjectMetadata(room: Room, objectId: string,
        metadataKey: number, metadataValue: string): boolean
    {
        const po = room.persistentObjectGroup.persistentObjectById[objectId];
        if (!po)
            return false;
        if (metadataKey === ObjectMetadataKeyEnumMap.ImageURL
            && metadataValue.length > MAX_IMAGE_URL_LENGTH)
            return false;
        return true;
    },

    setPersistentObjectMetadata(room: Room, objectId: string,
        metadataKey: number, metadataValue: string): PersistentObject | null
    {
        if (!PersistentObjectUpdateUtil.canSetPersistentObjectMetadata(room, objectId, metadataKey, metadataValue))
        {
            console.error(`PersistentObjectUpdateUtil.setPersistentObjectMetadata :: Failed (objectId=${objectId})`);
            return null;
        }

        const po = room.persistentObjectGroup.persistentObjectById[objectId];
        po.metadata[metadataKey] = new EncodableByteString(metadataValue);
        return po;
    },

    //-------------------------------------------------------------------------------------
    // Block Removal Guard
    //-------------------------------------------------------------------------------------

    // Returns true if removing the voxel block at (row, col, collisionLayer) would cause
    // any wall-attached persistent object to lose its wall support.
    wouldBlockRemovalBreakPersistentObject(
        room: Room, row: number, col: number, collisionLayer: number): boolean
    {
        for (const po of Object.values(room.persistentObjectGroup.persistentObjectById))
        {
            const config = ObjectTypeConfigMap.getConfigByIndex(po.objectTypeIndex);
            if (!config.isWallAttached) continue;

            const meshBottomLayer = Math.min(
                Math.max(Math.floor(po.y * 2), COLLISION_LAYER_MIN),
                COLLISION_LAYER_MAX
            );
            const meshTopLayer = Math.min(
                Math.max(Math.floor((po.y + 1) * 2 - 0.001), COLLISION_LAYER_MIN),
                COLLISION_LAYER_MAX
            );
            if (collisionLayer < meshBottomLayer || collisionLayer > meshTopLayer) continue;

            if (doesBlockSupportPersistentObject(po, row, col))
                return true;
        }
        return false;
    },
};

function isWallAt(room: Room, x: number, y: number, z: number, direction: Dir4): boolean
{
    const collisionLayer = Math.min(Math.max(Math.floor(y * 2), COLLISION_LAYER_MIN), COLLISION_LAYER_MAX);
    const {facingAxis, orientation} = DirUtil.dir4ToProperties(direction);

    if (facingAxis == "z")
    {
        const row = (orientation == "+") ? z - 1 : z;
        if (row < 0 || row >= NUM_VOXEL_ROWS) return false;

        const isEdge = (x % 1 === 0);
        if (isEdge)
        {
            const colLeft = x - 1;
            const colRight = x;
            const leftValid = colLeft >= 0 && colLeft < NUM_VOXEL_COLS
                && VoxelQueryUtil.isVoxelQuadVisible(room, row, colLeft, facingAxis, orientation, collisionLayer);
            const rightValid = colRight >= 0 && colRight < NUM_VOXEL_COLS
                && VoxelQueryUtil.isVoxelQuadVisible(room, row, colRight, facingAxis, orientation, collisionLayer);
            return leftValid && rightValid;
        }
        else
        {
            const col = Math.floor(x);
            if (col < 0 || col >= NUM_VOXEL_COLS) return false;
            return VoxelQueryUtil.isVoxelQuadVisible(room, row, col, facingAxis, orientation, collisionLayer);
        }
    }
    else if (facingAxis == "x")
    {
        const col = (orientation == "+") ? x - 1 : x;
        if (col < 0 || col >= NUM_VOXEL_COLS) return false;

        const isEdge = (z % 1 === 0);
        if (isEdge)
        {
            const rowLeft = z - 1;
            const rowRight = z;
            const leftValid = rowLeft >= 0 && rowLeft < NUM_VOXEL_ROWS
                && VoxelQueryUtil.isVoxelQuadVisible(room, rowLeft, col, facingAxis, orientation, collisionLayer);
            const rightValid = rowRight >= 0 && rowRight < NUM_VOXEL_ROWS
                && VoxelQueryUtil.isVoxelQuadVisible(room, rowRight, col, facingAxis, orientation, collisionLayer);
            return leftValid && rightValid;
        }
        else
        {
            const row = Math.floor(z);
            if (row < 0 || row >= NUM_VOXEL_ROWS) return false;
            return VoxelQueryUtil.isVoxelQuadVisible(room, row, col, facingAxis, orientation, collisionLayer);
        }
    }
    else
    {
        throw new Error(`Invalid facingAxis :: ${facingAxis}`);
    }
}

function tryCornerWrap(room: Room, po: PersistentObject, dx: number, newY: number,
    concave: boolean = false): {x: number, z: number, direction: Dir4} | null
{
    const movingRight = dx > 0;

    let wrapDirection: Dir4;
    switch (po.dir)
    {
        case "+z": wrapDirection = movingRight ? "+x" : "-x"; break;
        case "-z": wrapDirection = movingRight ? "-x" : "+x"; break;
        case "+x": wrapDirection = movingRight ? "-z" : "+z"; break;
        case "-x": wrapDirection = movingRight ? "+z" : "-z"; break;
    }
    if (concave)
    {
        switch (wrapDirection)
        {
            case "+x": wrapDirection = "-x"; break;
            case "-x": wrapDirection = "+x"; break;
            case "+z": wrapDirection = "-z"; break;
            case "-z": wrapDirection = "+z"; break;
        }
    }

    let newX: number, newZ: number;

    switch (po.dir)
    {
        case "+z":
        {
            const row = po.z - 1;
            const col = Math.floor(po.x);
            newX = movingRight ? col + 1 : col;
            newZ = row + 0.5;
            break;
        }
        case "-z":
        {
            const row = po.z;
            const col = Math.floor(po.x);
            newX = movingRight ? col : col + 1;
            newZ = row + 0.5;
            break;
        }
        case "+x":
        {
            const col = po.x - 1;
            const row = Math.floor(po.z);
            newX = col + 0.5;
            newZ = movingRight ? row : row + 1;
            break;
        }
        case "-x":
        {
            const col = po.x;
            const row = Math.floor(po.z);
            newX = col + 0.5;
            newZ = movingRight ? row + 1 : row;
            break;
        }
    }

    if (concave)
    {
        const v = DirUtil.dir4ToVec3(po.dir);
        newX += v.x;
        newZ += v.z;
    }

    if (!isWallAt(room, newX, newY, newZ, wrapDirection))
        return null;

    return {x: newX, z: newZ, direction: wrapDirection};
}

function doesBlockSupportPersistentObject(
    po: PersistentObject, blockRow: number, blockCol: number): boolean
{
    switch (po.dir)
    {
        case "+z":
        {
            const wallRow = po.z - 1;
            if (blockRow !== wallRow) return false;
            return isBlockInSlidingRange(po.x, blockCol);
        }
        case "-z":
        {
            const wallRow = po.z;
            if (blockRow !== wallRow) return false;
            return isBlockInSlidingRange(po.x, blockCol);
        }
        case "+x":
        {
            const wallCol = po.x - 1;
            if (blockCol !== wallCol) return false;
            return isBlockInSlidingRange(po.z, blockRow);
        }
        case "-x":
        {
            const wallCol = po.x;
            if (blockCol !== wallCol) return false;
            return isBlockInSlidingRange(po.z, blockRow);
        }
    }
}

function isBlockInSlidingRange(slidingCoord: number, blockIndex: number): boolean
{
    const meshMin = slidingCoord - 0.5;
    const meshMax = slidingCoord + 0.5;
    return blockIndex < meshMax && (blockIndex + 1) > meshMin;
}

function isPersistentObjectPositionInBound(x: number, y: number, z: number): boolean
{
    return x >= 1 && x <= NUM_VOXEL_COLS-1 &&
        y > 0 && y < MAX_ROOM_Y &&
        z >= 1 && z <= NUM_VOXEL_ROWS-1;
}

export default PersistentObjectUpdateUtil;
