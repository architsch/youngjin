import { COLLISION_LAYER_UNBREAKABLE } from "../physics/types/collisionLayer";
import Voxel from "../voxel/types/voxel";
import VoxelQuad from "../voxel/types/voxelQuad";
import Room from "./types/room";
import PhysicsManager from "../physics/physicsManager";
import VoxelQuadChange from "../voxel/types/voxelQuadChange";
import Num from "../math/util/num";

let debugEnabled = false;

const recentChanges: VoxelQuadChange[] = [];

const RoomVoxelActions =
{
    setDebugEnabled(enabled: boolean)
    {
        debugEnabled = enabled;
    },
    getRecentChanges(): VoxelQuadChange[]
    {
        return recentChanges;
    },
    flushRecentChanges()
    {
        recentChanges.length = 0;
    },
    addCube(room: Room, row: number, col: number, yCenter: number, textureIndex: number): boolean
    {
        if (debugEnabled)
            console.log(`START - addCube - row: ${row}, col: ${col}, yCenter: ${yCenter}, textureIndex: ${textureIndex}`);

        if (yCenter < 0 || yCenter > 4.0)
        {
            console.error(`yCenter of the cube is out of range (yCenter = ${yCenter})`);
            return false;
        }
        
        const voxel = RoomVoxelActions.getVoxel(room, row, col);
        if (!voxel)
        {
            console.error(`No voxel found in (row: ${row}, col: ${col})`);
            return false;
        }
        // Do not add if the maximum number of quads have been reached.
        if (voxel.quads.length >= 31)
            return false;
        
        // Do not add if the cube penetrates through any existing volume (within the same voxel).
        for (let i = 0; i < voxel.quads.length; ++i)
        {
            const quad = voxel.quads[i];
            if (quad.facingAxis != "y" && Math.abs(quad.yOffset - yCenter) < 1)
            {
                return false;
            }
            if (quad.facingAxis == "y" && quad.yOffset > 0 && quad.yOffset < 4 &&
                Math.abs(quad.yOffset - yCenter) < 0.5)
            {
                return false;
            }
        }
        
        // Remove quads that are to be hidden, and add quads that are to be exposed.

        let adjVoxel = RoomVoxelActions.getVoxel(room, row-1, col);
        if (adjVoxel)
        {
            if (isVoxelYOccupied(adjVoxel, yCenter, true))
                tryRemoveVoxelQuad(adjVoxel, "z", "+", yCenter);
            else
                tryAddVoxelQuad(voxel, "z", "-", yCenter, textureIndex);
        }

        adjVoxel = RoomVoxelActions.getVoxel(room, row+1, col);
        if (adjVoxel)
        {
            if (isVoxelYOccupied(adjVoxel, yCenter, true))
                tryRemoveVoxelQuad(adjVoxel, "z", "-", yCenter);
            else
                tryAddVoxelQuad(voxel, "z", "+", yCenter, textureIndex);
        }

        adjVoxel = RoomVoxelActions.getVoxel(room, row, col-1);
        if (adjVoxel)
        {
            if (isVoxelYOccupied(adjVoxel, yCenter, true))
                tryRemoveVoxelQuad(adjVoxel, "x", "+", yCenter);
            else
                tryAddVoxelQuad(voxel, "x", "-", yCenter, textureIndex);
        }

        adjVoxel = RoomVoxelActions.getVoxel(room, row, col+1);
        if (adjVoxel)
        {
            if (isVoxelYOccupied(adjVoxel, yCenter, true))
                tryRemoveVoxelQuad(adjVoxel, "x", "-", yCenter);
            else
                tryAddVoxelQuad(voxel, "x", "+", yCenter, textureIndex);
        }

        if (isVoxelYOccupied(voxel, yCenter-0.5, true))
            tryRemoveVoxelQuad(voxel, "y", "+", yCenter-0.5);
        else
            tryAddVoxelQuad(voxel, "y", "-", yCenter-0.5, textureIndex);

        if (isVoxelYOccupied(voxel, yCenter+0.5, true))
            tryRemoveVoxelQuad(voxel, "y", "-", yCenter+0.5);
        else
            tryAddVoxelQuad(voxel, "y", "+", yCenter+0.5, textureIndex);
        
        // [y=0.5, y=3] is the interval which needs to be cleared out in order to
        // allow the player character to pass through the voxel.
        if (isVoxelYRangeOccupied(voxel, 0.5, 3, true))
            PhysicsManager.makeVoxelSolid(room.roomID, row, col);
        return true;
    },

    removeCube(room: Room, row: number, col: number, yCenter: number): boolean
    {
        if (debugEnabled)
            console.log(`START - removeCube - row: ${row}, col: ${col}, yCenter: ${yCenter}`);

        if (yCenter < 0 || yCenter > 4.0)
        {
            console.error(`yCenter of the cube is out of range (yCenter = ${yCenter})`);
            return false;
        }

        const voxel = RoomVoxelActions.getVoxel(room, row, col);
        if (!voxel)
        {
            console.error(`No voxel found in (row: ${row}, col: ${col})`);
            return false;
        }
        if (isUnbreakableVoxel(room, row, col)) // cannot remove anything from an unbreakable voxel.
            return false;

        const textureIndex = voxel.quads[0].textureIndex;

        tryRemoveVoxelQuad(voxel, "x", "-", yCenter);
        tryRemoveVoxelQuad(voxel, "x", "+", yCenter);
        tryRemoveVoxelQuad(voxel, "y", "-", yCenter-0.5);
        tryRemoveVoxelQuad(voxel, "y", "+", yCenter+0.5);
        tryRemoveVoxelQuad(voxel, "z", "-", yCenter);
        tryRemoveVoxelQuad(voxel, "z", "+", yCenter);

        recoverExposedAdjVoxelSide(room, row, col, -1, 0, yCenter, textureIndex);
        recoverExposedAdjVoxelSide(room, row, col, 1, 0, yCenter, textureIndex);
        recoverExposedAdjVoxelSide(room, row, col, 0, -1, yCenter, textureIndex);
        recoverExposedAdjVoxelSide(room, row, col, 0, 1, yCenter, textureIndex);
        
        if (yCenter >= 3.5 || hasCubeWithCenter(voxel, yCenter+1))
            tryAddVoxelQuad(voxel, "y", "-", yCenter+0.5, textureIndex);
        if (yCenter <= 0.5 || hasCubeWithCenter(voxel, yCenter-1))
            tryAddVoxelQuad(voxel, "y", "+", yCenter-0.5, textureIndex);

        // [y=0.5, y=3] is the interval which needs to be cleared out in order to
        // allow the player character to pass through the voxel.
        if (!isVoxelYRangeOccupied(voxel, 0.5, 3, true))
            PhysicsManager.makeVoxelUnsolid(room.roomID, row, col);
        return true;
    },

    changeVoxelTexture(room: Room, row: number, col: number, quadIndex: number, textureIndex: number): boolean
    {
        if (debugEnabled)
            console.log(`START - changeVoxelTexture - row: ${row}, col: ${col}, quadIndex: ${quadIndex}, textureIndex: ${textureIndex}`);

        const voxel = RoomVoxelActions.getVoxel(room, row, col);
        if (!voxel)
        {
            console.error(`No voxel found in (row: ${row}, col: ${col})`);
            return false;
        }
        if (quadIndex < 0 || quadIndex >= voxel.quads.length)
        {
            console.error(`Quad doesn't exist in voxel (quadIndex = ${quadIndex}, voxel.quads.length = ${voxel.quads.length})`);
            return false;
        }
        const voxelQuad = voxel.quads[quadIndex]!;
        voxelQuad.textureIndex = textureIndex;

        const change = new VoxelQuadChange(
            "changeTexture",
            voxel.row,
            voxel.col,
            quadIndex,
            voxelQuad.facingAxis,
            voxelQuad.orientation,
            voxelQuad.yOffset,
            voxelQuad.textureIndex,
        );
        pushChange(voxel, change);
        return true;
    },

    getVoxel(room: Room, row: number, col: number): Voxel | undefined
    {
        const numGridCols = room.voxelGrid.numGridCols;
        const numGridRows = room.voxelGrid.numGridRows;
        if (row < 0 || row >= numGridRows || col < 0 || col >= numGridCols)
            return undefined;
        return room.voxelGrid.voxels[row * numGridCols + col];
    }
}

function recoverExposedAdjVoxelSide(room: Room, row: number, col: number,
    rowOffset: number, colOffset: number, yCenter: number, textureIndex: number)
{
    let facingAxis: "x" | "z";
    const fromOrientation = (rowOffset > 0 || colOffset > 0) ? "-" : "+";
    if (rowOffset != 0 && colOffset == 0)
        facingAxis = "z";
    else if (rowOffset == 0 && colOffset != 0)
        facingAxis = "x";
    else
        throw new Error(`No valid facingAxis for offset: (rowOffset = ${rowOffset}, colOffset = ${colOffset})`);

    const adjVoxel = RoomVoxelActions.getVoxel(room, row+rowOffset, col+colOffset);
    if (adjVoxel)
    {
        if (hasCubeWithCenter(adjVoxel, yCenter))
            tryAddVoxelQuad(adjVoxel, facingAxis, fromOrientation, yCenter, textureIndex);
        if (hasCubeWithCenter(adjVoxel, yCenter-0.5))
            tryAddVoxelQuad(adjVoxel, facingAxis, fromOrientation, yCenter-0.5, textureIndex);
        if (hasCubeWithCenter(adjVoxel, yCenter+0.5))
            tryAddVoxelQuad(adjVoxel, facingAxis, fromOrientation, yCenter+0.5, textureIndex);
    }
}

function hasCubeWithCenter(voxel: Voxel, yCenter: number): boolean
{
    for (let i = 0; i < voxel.quads.length; ++i)
    {
        const quad = voxel.quads[i];
        if (quad.facingAxis != "y") // "x" or "z"
        {
            if (quad.yOffset == yCenter)
                return true;
        }
        else // "y"
        {
            if (quad.orientation == "-" && quad.yOffset == yCenter-0.5)
                return true;
            if (quad.orientation == "+" && quad.yOffset == yCenter+0.5)
                return true;
        }
    }
    return false;
}

function isUnbreakableVoxel(room: Room, row: number, col: number): boolean
{
    const numGridCols = room.voxelGrid.numGridCols;
    const numGridRows = room.voxelGrid.numGridRows;
    if (row <= 0 || row >= numGridRows-1 || col <= 0 || col >= numGridCols-1)
        return true;

    const voxel = RoomVoxelActions.getVoxel(room, row, col);
    if (!voxel)
    {
        console.error(`No voxel found in (row: ${row}, col: ${col})`);
        return true;
    }
    return getVoxelCollisionLayer(room, row, col, COLLISION_LAYER_UNBREAKABLE) != 0;
}

function addVoxelCollisionLayer(room: Room, row: number, col: number, collisionLayer: number)
{
    RoomVoxelActions.getVoxel(room, row, col)!.collisionLayerMask |= (1 << collisionLayer);
}

function removeVoxelCollisionLayer(room: Room, row: number, col: number, collisionLayer: number)
{
    RoomVoxelActions.getVoxel(room, row, col)!.collisionLayerMask &= ~(1 << collisionLayer);
}

// Returns 1 if the layer exists, or 0 otherwise.
function getVoxelCollisionLayer(room: Room, row: number, col: number, collisionLayer: number): number
{
    return (RoomVoxelActions.getVoxel(room, row, col)!.collisionLayerMask >> collisionLayer) & 1;
}

function isVoxelYOccupied(voxel: Voxel, yOffset: number, comparisonIsExclusive: boolean): boolean
{
    if (Num.numberIsInRange(yOffset, -9999, 0, comparisonIsExclusive)) // beneath the floor
        return true;
    if (Num.numberIsInRange(yOffset, 4, 9999, comparisonIsExclusive)) // above the ceiling
        return true;

    for (let i = 0; i < voxel.quads.length; ++i)
    {
        const quad = voxel.quads[i];
        if (quad.facingAxis == "y")
        {
            if (quad.orientation == "-")
            {
                if (Num.numberIsInRange(yOffset, quad.yOffset, quad.yOffset + 1, comparisonIsExclusive))
                    return true;
            }
            else // "+"
            {
                if (Num.numberIsInRange(yOffset, quad.yOffset - 1, quad.yOffset, comparisonIsExclusive))
                    return true;
            }
        }
        else // "x" or "z"
        {
            if (Num.numberIsInRange(yOffset, quad.yOffset - 0.5, quad.yOffset + 0.5, comparisonIsExclusive))
                return true;
        }
    }
    return false;
}

function isVoxelYRangeOccupied(voxel: Voxel, yOffsetMin: number, yOffsetMax: number,
    comparisonIsExclusive: boolean
): boolean
{
    if (Num.rangesOverlap(yOffsetMin, yOffsetMax, -9999, 0, comparisonIsExclusive)) // beneath the floor
        return true;
    if (Num.rangesOverlap(yOffsetMin, yOffsetMax, 4, 9999, comparisonIsExclusive)) // above the ceiling
        return true;

    for (let i = 0; i < voxel.quads.length; ++i)
    {
        const quad = voxel.quads[i];
        if (quad.facingAxis == "y")
        {
            if (quad.orientation == "-")
            {
                if (Num.rangesOverlap(yOffsetMin, yOffsetMax, quad.yOffset, quad.yOffset + 1, comparisonIsExclusive))
                    return true;
            }
            else // "+"
            {
                if (Num.rangesOverlap(yOffsetMin, yOffsetMax, quad.yOffset - 1, quad.yOffset, comparisonIsExclusive))
                    return true;
            }
        }
        else // "x" or "z"
        {
            if (Num.rangesOverlap(yOffsetMin, yOffsetMax, quad.yOffset - 0.5, quad.yOffset + 0.5, comparisonIsExclusive))
                return true;
        }
    }
    return false;
}

function getVoxelQuad(voxel: Voxel,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", yOffset: number): VoxelQuad | undefined
{
    for (let i = 0; i < voxel.quads.length; ++i)
    {
        const quad = voxel.quads[i];
        if (quad.facingAxis == facingAxis && quad.orientation == orientation && quad.yOffset == yOffset)
            return quad;
    }
    return undefined;
}

function tryAddVoxelQuad(voxel: Voxel,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", yOffset: number, textureIndex: number): boolean
{
    for (let i = 0; i < voxel.quads.length; ++i)
    {
        const quad = voxel.quads[i];
        if (quad.facingAxis == facingAxis && quad.orientation == orientation && quad.yOffset == yOffset)
            return false; // quad already exists
    }
    voxel.quads.push(new VoxelQuad(facingAxis, orientation, yOffset, textureIndex));

    const change = new VoxelQuadChange(
        "add",
        voxel.row,
        voxel.col,
        voxel.quads.length-1,
        facingAxis,
        orientation,
        yOffset,
        textureIndex,
    );
    pushChange(voxel, change);
    return true;
}

function tryRemoveVoxelQuad(voxel: Voxel,
    facingAxis: "x" | "y" | "z", orientation: "-" | "+", yOffset: number): boolean
{
    let quadIndex = -1;
    for (let i = 0; i < voxel.quads.length; ++i)
    {
        const quad = voxel.quads[i];
        if (quad.facingAxis == facingAxis && quad.orientation == orientation && quad.yOffset == yOffset)
        {
            quadIndex = i;
            break;
        }
    }
    if (quadIndex >= 0)
    {
        for (let i = quadIndex + 1; i < voxel.quads.length; ++i)
            voxel.quads[i-1] = voxel.quads[i];
        voxel.quads.length = voxel.quads.length - 1;

        const change = new VoxelQuadChange(
            "remove",
            voxel.row,
            voxel.col,
            quadIndex,
            facingAxis,
            orientation,
            yOffset,
            -1,
        );
        pushChange(voxel, change);
        return true;
    }
    return false;
}

function pushChange(voxel: Voxel, change: VoxelQuadChange)
{
    if (debugEnabled)
    {
        const snapshot: VoxelQuad[] = [];
        for (const quad of voxel.quads)
            snapshot.push({...quad} as VoxelQuad);
        change.voxelQuadsResultSnapshot = snapshot;
    }
    recentChanges.push(change);
}

export default RoomVoxelActions;