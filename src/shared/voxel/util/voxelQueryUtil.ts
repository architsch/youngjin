import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, NUM_VOXEL_SUB_COLS, NUM_VOXEL_QUADS_PER_VOXEL, NUM_VOXEL_QUADS_PER_ROOM, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, COLLISION_LAYER_NULL, VOXEL_BLOCK_SHAPE_EMPTY, VOXEL_BLOCK_SHAPE_WHOLE } from "../../system/sharedConstants";
import Voxel from "../types/voxel";
import VoxelQuadTransformDimensions from "../types/voxelQuadTransformDimensions";
import VoxelBlockAddTarget from "../types/voxelBlockAddTarget";
import VoxelBlockShapeUtil from "./voxelBlockShapeUtil";
import AABB3 from "../../math/types/aabb3";
import Vec3 from "../../math/types/vec3";

const VoxelQueryUtil =
{
    // Basic

    getVoxel(voxels: Voxel[], row: number, col: number): Voxel | undefined
    {
        if (row < 0 || row >= NUM_VOXEL_ROWS || col < 0 || col >= NUM_VOXEL_COLS)
            return undefined;
        return voxels[row * NUM_VOXEL_COLS + col];
    },

    // World coordinates: one cell per unit on X/Z, one layer per layer height on Y, origin at the world
    // origin. Out-of-room coordinates map to out-of-range cells (not clamped), so callers can detect them.

    getVoxelColFromWorldX(worldX: number): number
    {
        return Math.floor(worldX);
    },

    getVoxelRowFromWorldZ(worldZ: number): number
    {
        return Math.floor(worldZ);
    },

    getVoxelCollisionLayerFromWorldY(worldY: number): number
    {
        return Math.floor(worldY / COLLISION_LAYER_HEIGHT);
    },

    getWorldYAtVoxelCollisionLayerCenter(collisionLayer: number): number
    {
        return (collisionLayer + 0.5) * COLLISION_LAYER_HEIGHT;
    },

    // Voxel blocks: one layer of one voxel, holding a block of some shape or none (see
    // VoxelBlockShapeUtil). A block is asked about in one of three ways: whether there is one, whether it
    // is a whole one, or whether a given point lies inside it. Beyond the layer range and outside the
    // grid lies solid rock, which counts as whole blocks, so grid walks stop at the floor, ceiling and
    // boundary.

    getVoxelBlockShape(voxel: Voxel, collisionLayer: number): number
    {
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            return VOXEL_BLOCK_SHAPE_WHOLE;
        return voxel.quadsMem.blockShapes[
            VoxelQueryUtil.getVoxelBlockIndex(voxel.row, voxel.col, collisionLayer)];
    },

    getVoxelBlockShapeAt(voxels: Voxel[], row: number, col: number, collisionLayer: number): number
    {
        const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
        if (voxel == undefined)
            return VOXEL_BLOCK_SHAPE_WHOLE;
        return VoxelQueryUtil.getVoxelBlockShape(voxel, collisionLayer);
    },

    isVoxelBlockPresent(voxel: Voxel, collisionLayer: number): boolean
    {
        return VoxelQueryUtil.getVoxelBlockShape(voxel, collisionLayer) != VOXEL_BLOCK_SHAPE_EMPTY;
    },

    isVoxelBlockPresentAt(voxels: Voxel[], row: number, col: number, collisionLayer: number): boolean
    {
        return VoxelQueryUtil.getVoxelBlockShapeAt(voxels, row, col, collisionLayer) != VOXEL_BLOCK_SHAPE_EMPTY;
    },

    isVoxelBlockWhole(voxel: Voxel, collisionLayer: number): boolean
    {
        return VoxelQueryUtil.getVoxelBlockShape(voxel, collisionLayer) == VOXEL_BLOCK_SHAPE_WHOLE;
    },

    isVoxelBlockWholeAt(voxels: Voxel[], row: number, col: number, collisionLayer: number): boolean
    {
        return VoxelQueryUtil.getVoxelBlockShapeAt(voxels, row, col, collisionLayer) == VOXEL_BLOCK_SHAPE_WHOLE;
    },

    isPointInVoxelBlock(voxels: Voxel[], point: Vec3): boolean
    {
        const row = VoxelQueryUtil.getVoxelRowFromWorldZ(point.z);
        const col = VoxelQueryUtil.getVoxelColFromWorldX(point.x);
        return VoxelBlockShapeUtil.containsPoint(VoxelQueryUtil.getVoxelBlockShapeAt(voxels, row, col,
            VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(point.y)), point.x - col, point.z - row);
    },

    // The layers of a voxel that hold a block, one bit each from the lowest layer up.
    getVoxelBlockLayerMask(voxel: Voxel): number
    {
        let mask = 0;
        for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
        {
            if (VoxelQueryUtil.isVoxelBlockPresent(voxel, layer))
                mask |= (1 << layer);
        }
        return mask;
    },

    // The box in the world of a block of the given shape; the empty shape's is its whole cell layer.
    getVoxelBlockBox(row: number, col: number, collisionLayer: number, shape: number): AABB3
    {
        const bounds = VoxelBlockShapeUtil.getBounds(shape);
        return {
            center: {
                x: col + 0.5 * (bounds.minX + bounds.maxX),
                y: VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(collisionLayer),
                z: row + 0.5 * (bounds.minZ + bounds.maxZ),
            },
            halfSize: {
                x: 0.5 * (bounds.maxX - bounds.minX),
                y: 0.5 * COLLISION_LAYER_HEIGHT,
                z: 0.5 * (bounds.maxZ - bounds.minZ),
            },
        };
    },

    // Index order is layer fastest, then column, then row, so a voxel's layers are contiguous.

    getVoxelBlockIndex(row: number, col: number, collisionLayer: number): number
    {
        return (row * NUM_VOXEL_COLS + col) * NUM_COLLISION_LAYERS + collisionLayer;
    },

    getVoxelBlockRow(voxelBlockIndex: number): number
    {
        return (voxelBlockIndex / (NUM_VOXEL_COLS * NUM_COLLISION_LAYERS)) | 0;
    },

    getVoxelBlockCol(voxelBlockIndex: number): number
    {
        return ((voxelBlockIndex / NUM_COLLISION_LAYERS) | 0) % NUM_VOXEL_COLS;
    },

    getVoxelBlockCollisionLayer(voxelBlockIndex: number): number
    {
        return voxelBlockIndex % NUM_COLLISION_LAYERS;
    },

    isVoxelBlockWithinBound(row: number, col: number, collisionLayer: number): boolean
    {
        return row >= 0 && row < NUM_VOXEL_ROWS &&
            col >= 0 && col < NUM_VOXEL_COLS &&
            collisionLayer >= COLLISION_LAYER_MIN && collisionLayer <= COLLISION_LAYER_MAX;
    },

    // Sub-blocks (see NUM_VOXEL_SUB_BLOCKS) are indexed in the same order, by their half cell along z and x:
    // a block's sub-block for bit b of its shape is at twice its row plus b >> 1, twice its column plus b & 1.
    getVoxelSubBlockIndex(subRow: number, subCol: number, collisionLayer: number): number
    {
        return (subRow * NUM_VOXEL_SUB_COLS + subCol) * NUM_COLLISION_LAYERS + collisionLayer;
    },

    // How far from origin, along an axis direction, the first cell layer holding a block begins: 0 if
    // origin is inside one, Infinity if none begins within maxDistance. A grid walk, one cell layer at a
    // time, so a shrunk block counts as its whole cell layer.
    getDistanceToOccupiedBlock(voxels: Voxel[], origin: Vec3, axisDir: Vec3, maxDistance: number): number
    {
        const axis: "x" | "y" | "z" = (axisDir.x != 0) ? "x" : (axisDir.y != 0) ? "y" : "z";
        const sign = Math.sign(axisDir[axis]);
        const blockSize = (axis === "y") ? COLLISION_LAYER_HEIGHT : 1;
        const start = origin[axis] / blockSize;
        const probe: Vec3 = {x: origin.x, y: origin.y, z: origin.z};
        for (let block = Math.floor(start); ; block += sign)
        {
            // Where this block's near face lies ahead of the origin.
            const distance = Math.max(0, ((sign > 0) ? block - start : start - (block + 1)) * blockSize);
            if (distance > maxDistance)
                return Infinity;
            probe[axis] = (block + 0.5) * blockSize;
            if (VoxelQueryUtil.isVoxelBlockPresentAt(voxels, VoxelQueryUtil.getVoxelRowFromWorldZ(probe.z),
                VoxelQueryUtil.getVoxelColFromWorldX(probe.x), VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(probe.y)))
                return distance;
        }
    },

    // Get quadIndex from properties

    getVoxelQuadIndex(row: number, col: number, facingAxis: "x" | "y" | "z", orientation: "-" | "+",
        collisionLayer: number): number
    {
        const firstIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
        if (firstIndex < 0)
            return -1; // invalid voxel
        const offset = VoxelQueryUtil.getVoxelQuadIndexOffsetInsideLayer(facingAxis, orientation);
        if (offset >= NUM_VOXEL_QUADS_PER_COLLISION_LAYER)
            return -1; // invalid quad
        else
            return firstIndex + offset;
    },

    // The quads drawing the room floor (facing up) and ceiling (facing down) over a cell (see COLLISION_LAYER_NULL).
    getFloorVoxelQuadIndex(row: number, col: number): number
    {
        return VoxelQueryUtil.getVoxelQuadIndex(row, col, "y", "+", COLLISION_LAYER_NULL);
    },

    getCeilingVoxelQuadIndex(row: number, col: number): number
    {
        return VoxelQueryUtil.getVoxelQuadIndex(row, col, "y", "-", COLLISION_LAYER_NULL);
    },

    getFirstVoxelQuadIndexInLayer(row: number, col: number, collisionLayer: number): number
    {
        const firstIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInVoxel(row, col);
        if (firstIndex < 0)
            return -1; // invalid voxel
        return firstIndex + NUM_VOXEL_QUADS_PER_COLLISION_LAYER * collisionLayer;
    },

    // -1 outside the grid (otherwise an out-of-range col would wrap to a voxel in another row).
    getFirstVoxelQuadIndexInVoxel(row: number, col: number): number
    {
        if (row < 0 || row >= NUM_VOXEL_ROWS || col < 0 || col >= NUM_VOXEL_COLS)
            return -1; // invalid voxel
        const voxelIndex = row * NUM_VOXEL_COLS + col;
        return NUM_VOXEL_QUADS_PER_VOXEL * voxelIndex;
    },

    // [-y, +y, -x, +x, -z, +z]
    getVoxelQuadIndexOffsetInsideLayer(facingAxis: "x" | "y" | "z", orientation: "-" | "+"): number
    {
        return 2 * (facingAxis == "y" ? 0 : (facingAxis == "x" ? 1 : 2)) +
            (orientation == "-" ? 0 : 1);
    },

    // Get properties from quadIndex

    // Whether quadIndex is in range. The getters below return coordinates for any number, so check
    // external indices first.
    isValidVoxelQuadIndex(quadIndex: number): boolean
    {
        return Number.isInteger(quadIndex) && quadIndex >= 0 && quadIndex < NUM_VOXEL_QUADS_PER_ROOM;
    },

    getVoxelQuadFacingAxisFromQuadIndex(quadIndex: number): "x" | "y" | "z"
    {
        const facingAxisCode = Math.floor(
            ((quadIndex % NUM_VOXEL_QUADS_PER_VOXEL) % NUM_VOXEL_QUADS_PER_COLLISION_LAYER) * 0.5
        );
        return (facingAxisCode == 0 ? "y" : (facingAxisCode == 1 ? "x" : "z"));
    },

    getVoxelQuadOrientationFromQuadIndex(quadIndex: number): "-" | "+"
    {
        return (quadIndex % 2 == 0) ? "-" : "+";
    },

    getVoxelQuadCollisionLayerFromQuadIndex(quadIndex: number): number
    {
        return Math.floor((quadIndex % NUM_VOXEL_QUADS_PER_VOXEL) / NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
    },

    getVoxelQuadCollisionLayerAfterOffset(quadIndex: number, collisionLayerOffset: number): number
    {
        const newCollisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex) + collisionLayerOffset;
        if (newCollisionLayer < COLLISION_LAYER_MIN || newCollisionLayer > COLLISION_LAYER_MAX)
            return COLLISION_LAYER_NULL;
        return newCollisionLayer;
    },

    // The layer of the block a quad is a face of. The room's floor and ceiling are the faces of the solid
    // beyond the layer range, so theirs lies just past it.
    getVoxelBlockCollisionLayerFromQuadIndex(quadIndex: number): number
    {
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
        if (collisionLayer >= COLLISION_LAYER_MIN && collisionLayer <= COLLISION_LAYER_MAX)
            return collisionLayer;
        return (VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex) == "+")
            ? COLLISION_LAYER_MIN - 1 : COLLISION_LAYER_MAX + 1;
    },

    getVoxelRowFromQuadIndex(quadIndex: number): number
    {
        const voxelIndex = Math.floor(quadIndex / NUM_VOXEL_QUADS_PER_VOXEL);
        return Math.floor(voxelIndex / NUM_VOXEL_COLS);
    },

    getVoxelColFromQuadIndex(quadIndex: number): number
    {
        const voxelIndex = Math.floor(quadIndex / NUM_VOXEL_QUADS_PER_VOXEL);
        return voxelIndex % NUM_VOXEL_COLS;
    },

    // Visibility

    // Whether a quad is drawn, which is never stored: a block's face shows unless the block it looks at
    // covers all of it (see VoxelBlockShapeUtil.showsFace). Out-of-grid blocks count as whole, so the
    // room's outer shell is never drawn (it would hide the room from an orbit camera outside the walls),
    // nor the tops of its caps.
    isVoxelQuadVisible(voxels: Voxel[], quadIndex: number): boolean
    {
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const step = (orientation == "+") ? 1 : -1;
        const collisionLayer = VoxelQueryUtil.getVoxelBlockCollisionLayerFromQuadIndex(quadIndex);

        const shape = VoxelQueryUtil.getVoxelBlockShapeAt(voxels, row, col, collisionLayer);
        if (shape == VOXEL_BLOCK_SHAPE_EMPTY)
            return false;
        return VoxelBlockShapeUtil.showsFace(shape, VoxelQueryUtil.getVoxelBlockShapeAt(voxels,
            row + ((facingAxis == "z") ? step : 0),
            col + ((facingAxis == "x") ? step : 0),
            collisionLayer + ((facingAxis == "y") ? step : 0)), facingAxis, orientation);
    },

    // The quads the room's surface runs on into from a quad's face, along one of the face's own two axes:
    // the face of whatever stands in the way, else the face carrying straight on, else the next face
    // round the edge of its own block. Each half cell across the face is asked from as far along as it
    // lies bare (a shrunk block may stand before part of a face), so several quads may come back, those
    // in the way first. None for a quad that isn't drawn, or where the surface runs out of the room.
    getVoxelQuadsNextAlong(voxels: Voxel[], quadIndex: number, axisDir: Vec3): number[]
    {
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const alongAxis: "x" | "y" | "z" = (axisDir.x != 0) ? "x" : (axisDir.y != 0) ? "y" : "z";
        if (alongAxis == facingAxis || !VoxelQueryUtil.isVoxelQuadVisible(voxels, quadIndex))
            return [];
        const acrossAxis = (facingAxis != "x" && alongAxis != "x") ? "x"
            : (facingAxis != "y" && alongAxis != "y") ? "y" : "z";
        const facingSign = (VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex) == "+") ? 1 : -1;
        const alongSign = Math.sign(axisDir[alongAxis]);

        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelBlockCollisionLayerFromQuadIndex(quadIndex);
        const box = VoxelQueryUtil.getVoxelBlockBox(row, col, collisionLayer,
            VoxelQueryUtil.getVoxelBlockShapeAt(voxels, row, col, collisionLayer));
        const alongSize = getSubBlockSize(alongAxis), acrossSize = getSubBlockSize(acrossAxis);

        // The middle of the sub-block lying so many sub-blocks on from a point of the face, before the
        // face (side 1) or behind it (-1). Shared, so it holds the last one asked for.
        const facePoint: Vec3 = {x: 0, y: 0, z: 0};
        const probe: Vec3 = {x: 0, y: 0, z: 0};
        const subBlockAt = (stepsOn: number, side: number): Vec3 =>
        {
            probe.x = facePoint.x;
            probe.y = facePoint.y;
            probe.z = facePoint.z;
            probe[alongAxis] += stepsOn * alongSign * alongSize;
            probe[facingAxis] += side * facingSign * 0.5 * getSubBlockSize(facingAxis);
            return probe;
        };
        const isSolid = (point: Vec3) => VoxelQueryUtil.isPointInVoxelBlock(voxels, point);

        const inTheWay: number[] = [], straightOn: number[] = [], roundTheEdge: number[] = [];
        facePoint[facingAxis] = box.center[facingAxis] + facingSign * box.halfSize[facingAxis];
        for (let across = 0.5 * acrossSize - box.halfSize[acrossAxis]; across < box.halfSize[acrossAxis];
            across += acrossSize)
        {
            facePoint[acrossAxis] = box.center[acrossAxis] + across;

            // From the sub-block's face furthest along, back to the first that lies bare.
            for (let back = 0.5 * alongSize; back < 2 * box.halfSize[alongAxis]; back += alongSize)
            {
                facePoint[alongAxis] = box.center[alongAxis] + alongSign * (box.halfSize[alongAxis] - back);
                if (isSolid(subBlockAt(0, 1)))
                    continue;

                if (isSolid(subBlockAt(1, 1)))
                    inTheWay.push(getVoxelQuadIndexOfBlockAt(probe, alongAxis, -alongSign));
                else if (isSolid(subBlockAt(1, -1)))
                    straightOn.push(getVoxelQuadIndexOfBlockAt(probe, facingAxis, facingSign));
                else
                    roundTheEdge.push(getVoxelQuadIndexOfBlockAt(subBlockAt(0, -1), alongAxis, alongSign));
                break;
            }
        }
        return [...new Set([...inTheWay, ...straightOn, ...roundTheEdge])].filter(next => next >= 0);
    },

    // The way a walk along axisDir carries on once it has come off a quad's face onto the next one's (see
    // getVoxelQuadsNextAlong): unchanged over a face turned the same way; the way the face left is
    // turned, over one that stood in its way; against that, over one round the edge of its own block.
    getVoxelQuadWalkDirectionOnto(quadIndex: number, axisDir: Vec3, nextQuadIndex: number): Vec3
    {
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const nextFacingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(nextQuadIndex);
        if (nextFacingAxis == facingAxis)
            return {x: axisDir.x, y: axisDir.y, z: axisDir.z};

        const facingSign = (VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex) == "+") ? 1 : -1;
        const nextFacingSign = (VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(nextQuadIndex) == "+") ? 1 : -1;
        const roundTheEdge = (nextFacingSign == Math.sign(axisDir[nextFacingAxis]));

        const direction: Vec3 = {x: 0, y: 0, z: 0};
        direction[facingAxis] = roundTheEdge ? -facingSign : facingSign;
        return direction;
    },

    // What adding a block on a face comes to. On a face at its cell's side, and on the room's own floor
    // or ceiling, a block goes into the cell layer beyond: as wide as the face, as deep as that cell. A
    // face that stops short of its cell's side has its own block grown out to that side instead, since a
    // cell layer holds one block. Undefined where there is no cell layer beyond.
    getVoxelBlockAddTarget(voxels: Voxel[], quadIndex: number): VoxelBlockAddTarget | undefined
    {
        const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
        const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
        const isBlockFace = collisionLayer >= COLLISION_LAYER_MIN && collisionLayer <= COLLISION_LAYER_MAX;
        const step = (orientation == "+") ? 1 : -1;

        const faceShape = isBlockFace ? VoxelQueryUtil.getVoxelBlockShapeAt(voxels, row, col, collisionLayer)
            : VOXEL_BLOCK_SHAPE_WHOLE;
        const shape = VoxelBlockShapeUtil.stretchAlong(faceShape, facingAxis);
        if (isBlockFace && VoxelBlockShapeUtil.getSideMask(faceShape, facingAxis, orientation) == 0)
            return {quadIndex, shape, grows: true};

        let newCollisionLayer = collisionLayer;
        if (facingAxis == "y")
            newCollisionLayer = isBlockFace ? collisionLayer + step
                : ((orientation == "+") ? COLLISION_LAYER_MIN : COLLISION_LAYER_MAX);
        if (newCollisionLayer < COLLISION_LAYER_MIN || newCollisionLayer > COLLISION_LAYER_MAX)
            return undefined;

        const targetQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(row + ((facingAxis == "z") ? step : 0),
            col + ((facingAxis == "x") ? step : 0), facingAxis, orientation, newCollisionLayer);
        return (targetQuadIndex < 0) ? undefined : {quadIndex: targetQuadIndex, shape, grows: false};
    },

    // Get transform dimensions from properties

    // Where a quad lies and how large it is: its block's face, as the block's shape leaves it. scaleX and
    // scaleY run along the face's right and up (see Geometry3DUtil.getAxisFacingBasis).
    getVoxelQuadTransformDimensions(voxels: Voxel[], quadIndex: number, ignoreVisibility: boolean = false): VoxelQuadTransformDimensions
    {
        if (!ignoreVisibility && !VoxelQueryUtil.isVoxelQuadVisible(voxels, quadIndex)) // quad is hidden
            return { offsetX: 0, offsetY: -9999, offsetZ: 0, dirX: 0, dirY: -1, dirZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };

        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
        const isBlockFace = collisionLayer >= COLLISION_LAYER_MIN && collisionLayer <= COLLISION_LAYER_MAX;

        // The room's own floor and ceiling span their whole cell, as an empty layer's faces would.
        const bounds = VoxelBlockShapeUtil.getBounds(!isBlockFace ? VOXEL_BLOCK_SHAPE_WHOLE
            : VoxelQueryUtil.getVoxelBlockShapeAt(voxels,
                VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
                VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex), collisionLayer));
        const sizeX = bounds.maxX - bounds.minX;
        const sizeZ = bounds.maxZ - bounds.minZ;

        // Offsets across the cell are from its middle.
        let offsetX = 0.5 * (bounds.minX + bounds.maxX) - 0.5, offsetY = 0,
            offsetZ = 0.5 * (bounds.minZ + bounds.maxZ) - 0.5,
            dirX = 0, dirY = 0, dirZ = 0, scaleX = 1, scaleY = COLLISION_LAYER_HEIGHT, scaleZ = 1;

        if (!isBlockFace)
        {
            offsetY = (orientation == "+") ? 0 : MAX_ROOM_Y; // floor or ceiling
        }
        else
        {
            if (facingAxis == "y")
            {
                offsetY = ((orientation == "-") ? 0 : COLLISION_LAYER_HEIGHT) +
                    COLLISION_LAYER_HEIGHT * collisionLayer;
            }
            else
                offsetY = VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(collisionLayer);
        }

        switch (facingAxis)
        {
            case "x":
                if (orientation == "+") { dirX = 1; dirY = 0; dirZ = 0; offsetX = bounds.maxX - 0.5; }
                else { dirX = -1; dirY = 0; dirZ = 0; offsetX = bounds.minX - 0.5; }
                scaleX = sizeZ;
                break;
            case "y":
                if (orientation == "+") { dirX = 0; dirY = 1; dirZ = 0; }
                else { dirX = 0; dirY = -1; dirZ = 0; }
                scaleX = sizeX;
                scaleY = sizeZ;
                break;
            case "z":
                if (orientation == "+") { dirX = 0; dirY = 0; dirZ = 1; offsetZ = bounds.maxZ - 0.5; }
                else { dirX = 0; dirY = 0; dirZ = -1; offsetZ = bounds.minZ - 0.5; }
                scaleX = sizeX;
                break;
            default:
                throw new Error(`Unknown facingAxis (${facingAxis})`);
        }
        return { offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ };
    },
};

// How long a sub-block is along an axis: half a cell across, a layer high.
function getSubBlockSize(axis: "x" | "y" | "z"): number
{
    return (axis == "y") ? COLLISION_LAYER_HEIGHT : 0.5;
}

// The quad that the block a point lies in turns one way: the room's floor or ceiling for a point under or
// over the layers. -1 where there is no such quad: any other side of that solid, and outside the grid.
function getVoxelQuadIndexOfBlockAt(point: Vec3, facingAxis: "x" | "y" | "z", facingSign: number): number
{
    const row = VoxelQueryUtil.getVoxelRowFromWorldZ(point.z);
    const col = VoxelQueryUtil.getVoxelColFromWorldX(point.x);
    const collisionLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(point.y);
    const orientation = (facingSign > 0) ? "+" : "-";
    if (collisionLayer >= COLLISION_LAYER_MIN && collisionLayer <= COLLISION_LAYER_MAX)
        return VoxelQueryUtil.getVoxelQuadIndex(row, col, facingAxis, orientation, collisionLayer);

    const facesTheRoom = facingAxis == "y" && (facingSign > 0) == (collisionLayer < COLLISION_LAYER_MIN);
    return facesTheRoom ? VoxelQueryUtil.getVoxelQuadIndex(row, col, "y", orientation, COLLISION_LAYER_NULL) : -1;
}

export default VoxelQueryUtil;
