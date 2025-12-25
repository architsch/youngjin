import { COLLISION_LAYER_SOLID } from "../physics/types/collisionLayer";
import Voxel from "../voxel/types/voxel";
import VoxelQuad from "../voxel/types/voxelQuad";
import Room from "./types/room";
import PhysicsManager from "../physics/physicsManager";
import VoxelQuadChange from "../voxel/types/voxelQuadChange";
import { VoxelCubeTextureIndexMap } from "../voxel/types/voxelCubeTextureIndexMap";

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
    changeCubeY(room: Room, row: number, col: number, yCenter: number, changeInY: number): boolean
    {
        if (debugEnabled)
            console.log(`START - changeCubeY - row: ${row}, col: ${col}, yCenter: ${yCenter}, changeInY: ${changeInY}`);

        const yCenterNew = yCenter + changeInY;
        if (yCenterNew < 0 || yCenterNew > 4.0)
        {
            console.error(`Resulting Y is out of range (yCenter = ${yCenter}, changeInY: ${changeInY})`);
            return false;
        }
        // Cannot make changes to a boundary voxel.
        if (row <= 0 || col <= 0 || row >= room.voxelGrid.numGridRows-1 || col >= room.voxelGrid.numGridCols-1)
        {
            console.error("Cannot change a boundary voxel.");
            return false;
        }
        
        const voxel = RoomVoxelActions.getVoxel(room, row, col);
        if (!voxel)
        {
            console.error(`No voxel found in (row: ${row}, col: ${col})`);
            return false;
        }

        const textureIndexMap: VoxelCubeTextureIndexMap = {
            "x-": 0,
            "x+": 0,
            "y-": 0,
            "y+": 0,
            "z-": 0,
            "z+": 0,
        };

        // Do not move the cube if the resulting volume will penetrate through any existing volume after relocation (within the same voxel).
        for (let i = 0; i < voxel.quads.length; ++i)
        {
            const quad = voxel.quads[i];
            if ((quad.facingAxis != "y" && yCenter == quad.yOffset) ||
                (quad.facingAxis == "y" && quad.orientation == "-" && yCenter == quad.yOffset+0.5) ||
                (quad.facingAxis == "y" && quad.orientation == "+" && yCenter == quad.yOffset-0.5))
            {
                textureIndexMap[`${quad.facingAxis}${quad.orientation}`] = quad.textureIndex;
            }

            if (quad.facingAxis != "y" && quad.yOffset != yCenter && Math.abs(quad.yOffset - yCenterNew) < 1)
            {
                if (debugEnabled)
                    console.warn(`changeCubeY :: Blocked by quad ${quad.facingAxis}${quad.orientation} (yOffset = ${quad.yOffset})`);
                return false;
            }
            if (quad.facingAxis == "y" && quad.yOffset > 0 && quad.yOffset < 4)
            {
                if (quad.orientation == "-" && quad.yOffset != yCenter-0.5 && yCenterNew >= quad.yOffset && yCenterNew <= quad.yOffset+1)
                {
                    if (debugEnabled)
                        console.warn(`changeCubeY :: Blocked by quad ${quad.facingAxis}${quad.orientation} (yOffset = ${quad.yOffset})`);
                    return false;
                }
                if (quad.orientation == "+" && quad.yOffset != yCenter+0.5 && yCenterNew >= quad.yOffset-1 && yCenterNew <= quad.yOffset)
                {
                    if (debugEnabled)
                        console.warn(`changeCubeY :: Blocked by quad ${quad.facingAxis}${quad.orientation} (yOffset = ${quad.yOffset})`);
                    return false;
                }
            }
        }

        if (!RoomVoxelActions.removeCube(room, row, col, yCenter))
        {
            console.error("Failed to remove cube during Y-shift.");
            return false;
        }
        if (!RoomVoxelActions.addCube(room, row, col, yCenterNew, textureIndexMap))
        {
            console.error("Failed to remove cube during Y-shift.");
            return false;
        }

        if (debugEnabled)
            console.log(`END - changeCubeY - row: ${row}, col: ${col}, yCenter: ${yCenter}, changeInY: ${changeInY}`);
        return true;
    },
    addCube(room: Room, row: number, col: number, yCenter: number, textureIndexMap: VoxelCubeTextureIndexMap): boolean
    {
        if (debugEnabled)
            console.log(`START - addCube - row: ${row}, col: ${col}, yCenter: ${yCenter}, textureIndexMap: ${JSON.stringify(textureIndexMap)}`);

        if (yCenter < 0 || yCenter > 4.0)
        {
            console.error(`yCenter of the cube is out of range (yCenter = ${yCenter})`);
            return false;
        }
        // Cannot add anything to a boundary voxel.
        if (row <= 0 || col <= 0 || row >= room.voxelGrid.numGridRows-1 || col >= room.voxelGrid.numGridCols-1)
        {
            console.error("Cannot change a boundary voxel.");
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
        {
            console.error("Maximum number of quads reached.");
            return false;
        }
        
        // Do not add if the cube penetrates through any existing volume (within the same voxel).
        for (let i = 0; i < voxel.quads.length; ++i)
        {
            const quad = voxel.quads[i];
            if (quad.facingAxis != "y" && Math.abs(quad.yOffset - yCenter) < 1)
            {
                if (debugEnabled)
                    console.warn(`addCube :: Blocked by quad ${quad.facingAxis}${quad.orientation} (yOffset = ${quad.yOffset})`);
                return false;
            }
            if (quad.facingAxis == "y" && quad.yOffset > 0 && quad.yOffset < 4)
            {
                if (quad.orientation == "-" && yCenter >= quad.yOffset && yCenter <= quad.yOffset+1)
                {
                    if (debugEnabled)
                        console.warn(`addCube :: Blocked by quad ${quad.facingAxis}${quad.orientation} (yOffset = ${quad.yOffset})`);
                    return false;
                }
                if (quad.orientation == "+" && yCenter >= quad.yOffset-1 && yCenter <= quad.yOffset)
                {
                    if (debugEnabled)
                        console.warn(`addCube :: Blocked by quad ${quad.facingAxis}${quad.orientation} (yOffset = ${quad.yOffset})`);
                    return false;
                }
            }
        }
        
        // Remove quads that are to be hidden, and add quads that are to be exposed.

        adjustAdjVoxelSidesForCubeAddition(room, voxel, -1, 0, yCenter, textureIndexMap["z-"]);
        adjustAdjVoxelSidesForCubeAddition(room, voxel, 1, 0, yCenter, textureIndexMap["z+"]);
        adjustAdjVoxelSidesForCubeAddition(room, voxel, 0, -1, yCenter, textureIndexMap["x-"]);
        adjustAdjVoxelSidesForCubeAddition(room, voxel, 0, 1, yCenter, textureIndexMap["x+"]);

        if (getNumCubeWrappingQuads(voxel, yCenter-1) > 1)
            tryRemoveVoxelQuad(voxel, "y", "+", yCenter-0.5);
        else if (yCenter-0.5 >= 0)
            tryAddVoxelQuad(voxel, "y", "-", yCenter-0.5, textureIndexMap["y-"]);

        if (getNumCubeWrappingQuads(voxel, yCenter+1) > 1)
            tryRemoveVoxelQuad(voxel, "y", "-", yCenter+0.5);
        else if (yCenter+0.5 <= 4)
            tryAddVoxelQuad(voxel, "y", "+", yCenter+0.5, textureIndexMap["y+"]);
        
        if (!RoomVoxelActions.playerCanPassThroughVoxel(voxel))
        {
            addVoxelCollisionLayer(room, row, col, COLLISION_LAYER_SOLID);
            PhysicsManager.makeVoxelSolid(room.roomID, row, col);
        }

        if (debugEnabled)
            console.log(`END - addCube - row: ${row}, col: ${col}, yCenter: ${yCenter}, textureIndexMap: ${JSON.stringify(textureIndexMap)}`);
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
        // Cannot remove anything from a boundary voxel.
        if (row <= 0 || col <= 0 || row >= room.voxelGrid.numGridRows-1 || col >= room.voxelGrid.numGridCols-1)
        {
            console.error("Cannot change a boundary voxel.");
            return false;
        }

        const textureIndexMap: VoxelCubeTextureIndexMap = {
            "x-": 0,
            "x+": 0,
            "y-": 0,
            "y+": 0,
            "z-": 0,
            "z+": 0,
        };
        for (let i = 0; i < voxel.quads.length; ++i)
        {
            const quad = voxel.quads[i];
            if ((quad.facingAxis != "y" && yCenter == quad.yOffset) ||
                (quad.facingAxis == "y" && quad.orientation == "-" && yCenter == quad.yOffset+0.5) ||
                (quad.facingAxis == "y" && quad.orientation == "+" && yCenter == quad.yOffset-0.5))
            {
                textureIndexMap[`${quad.facingAxis}${quad.orientation}`] = quad.textureIndex;
            }
        }

        tryRemoveVoxelQuad(voxel, "x", "-", yCenter);
        tryRemoveVoxelQuad(voxel, "x", "+", yCenter);
        tryRemoveVoxelQuad(voxel, "y", "-", yCenter-0.5);
        tryRemoveVoxelQuad(voxel, "y", "+", yCenter+0.5);
        tryRemoveVoxelQuad(voxel, "z", "-", yCenter);
        tryRemoveVoxelQuad(voxel, "z", "+", yCenter);

        adjustAdjVoxelSidesForCubeRemoval(room, row, col, -1, 0, yCenter, textureIndexMap["z-"]);
        adjustAdjVoxelSidesForCubeRemoval(room, row, col, 1, 0, yCenter, textureIndexMap["z+"]);
        adjustAdjVoxelSidesForCubeRemoval(room, row, col, 0, -1, yCenter, textureIndexMap["x-"]);
        adjustAdjVoxelSidesForCubeRemoval(room, row, col, 0, 1, yCenter, textureIndexMap["x+"]);
        
        if (yCenter+0.5 <= 4 && getNumCubeWrappingQuads(voxel, yCenter+1) > 0)
            tryAddVoxelQuad(voxel, "y", "-", yCenter+0.5, textureIndexMap["y-"]);
        if (yCenter-0.5 >= 0 && getNumCubeWrappingQuads(voxel, yCenter-1) > 0)
            tryAddVoxelQuad(voxel, "y", "+", yCenter-0.5, textureIndexMap["y+"]);

        if (RoomVoxelActions.playerCanPassThroughVoxel(voxel))
        {
            removeVoxelCollisionLayer(room, row, col, COLLISION_LAYER_SOLID);
            PhysicsManager.makeVoxelUnsolid(room.roomID, row, col);
        }

        if (debugEnabled)
            console.log(`END - removeCube - row: ${row}, col: ${col}, yCenter: ${yCenter}`);
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

        if (debugEnabled)
            console.log(`END - changeVoxelTexture - row: ${row}, col: ${col}, quadIndex: ${quadIndex}, textureIndex: ${textureIndex}`);
        return true;
    },

    getVoxel(room: Room, row: number, col: number): Voxel | undefined
    {
        const numGridCols = room.voxelGrid.numGridCols;
        const numGridRows = room.voxelGrid.numGridRows;
        if (row < 0 || row >= numGridRows || col < 0 || col >= numGridCols)
            return undefined;
        return room.voxelGrid.voxels[row * numGridCols + col];
    },

    playerCanPassThroughVoxel(voxel: Voxel): boolean
    {
        return getNumCubeWrappingQuads(voxel, 0.5) == 0 &&
            getNumCubeWrappingQuads(voxel, 1) == 0 &&
            getNumCubeWrappingQuads(voxel, 1.5) == 0 &&
            getNumCubeWrappingQuads(voxel, 2) == 0 &&
            getNumCubeWrappingQuads(voxel, 2.5) == 0;
    }
}

function adjustAdjVoxelSidesForCubeAddition(room: Room, voxel: Voxel,
    rowOffset: number, colOffset: number, yCenter: number, textureIndex: number)
{
    if (yCenter < 0 || yCenter > 4)
    {
        console.error(`adjustAdjVoxelSidesForCubeAddition :: yCenter is out of range (yCenter = ${yCenter})`);
        return;
    }
    const { adjVoxel, facingAxis, fromOrientation } = getAdjVoxelRelation(room, voxel.row, voxel.col, rowOffset, colOffset);
    if (!adjVoxel)
        return;
    if (getNumCubeWrappingQuads(adjVoxel, yCenter) > 1)
        tryRemoveVoxelQuad(adjVoxel, facingAxis, fromOrientation, yCenter);
    else
        tryAddVoxelQuad(voxel, facingAxis, (fromOrientation == "+") ? "-" : "+", yCenter, textureIndex);
}

function adjustAdjVoxelSidesForCubeRemoval(room: Room, row: number, col: number,
    rowOffset: number, colOffset: number, yCenter: number, textureIndex: number)
{
    const { adjVoxel, facingAxis, fromOrientation } = getAdjVoxelRelation(room, row, col, rowOffset, colOffset);
    if (!adjVoxel)
        return;
    if (getNumCubeWrappingQuads(adjVoxel, yCenter) > 0)
        tryAddVoxelQuad(adjVoxel, facingAxis, fromOrientation, yCenter, textureIndex);
    if (yCenter-0.5 >= 0 && getNumCubeWrappingQuads(adjVoxel, yCenter-0.5) > 0)
        tryAddVoxelQuad(adjVoxel, facingAxis, fromOrientation, yCenter-0.5, textureIndex);
    if (yCenter+0.5 <= 4 && getNumCubeWrappingQuads(adjVoxel, yCenter+0.5) > 0)
        tryAddVoxelQuad(adjVoxel, facingAxis, fromOrientation, yCenter+0.5, textureIndex);
}

function getAdjVoxelRelation(room: Room, row: number, col: number, rowOffset: number, colOffset: number)
    : { adjVoxel: Voxel | undefined, facingAxis: "x" | "z", fromOrientation: "-" | "+" }
{
    let facingAxis: "x" | "z";
    const fromOrientation = (rowOffset > 0 || colOffset > 0) ? "-" : "+";
    if (rowOffset != 0 && colOffset == 0)
        facingAxis = "z";
    else if (rowOffset == 0 && colOffset != 0)
        facingAxis = "x";
    else
        throw new Error(`No valid facingAxis for offset: (rowOffset = ${rowOffset}, colOffset = ${colOffset})`);

    return { adjVoxel: RoomVoxelActions.getVoxel(room, row + rowOffset, col + colOffset), facingAxis, fromOrientation };
}

function getNumCubeWrappingQuads(voxel: Voxel, yCubeCenter: number): number
{
    let quadCount = 0;
    for (let i = 0; i < voxel.quads.length; ++i)
    {
        const quad = voxel.quads[i];
        if (quad.facingAxis != "y") // "x" or "z"
        {
            if (quad.yOffset == yCubeCenter)
                quadCount++;
        }
        else // "y"
        {
            if (quad.orientation == "-" && quad.yOffset == yCubeCenter-0.5)
                quadCount++;
            if (quad.orientation == "+" && quad.yOffset == yCubeCenter+0.5)
                quadCount++;
        }
    }
    return quadCount;
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