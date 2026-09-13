import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, NUM_VOXEL_QUADS_PER_VOXEL, NUM_VOXEL_QUADS_PER_ROOM, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, COLLISION_LAYER_NULL } from "../../system/sharedConstants";
import Voxel from "../types/voxel";
import VoxelQuadTransformDimensions from "../types/voxelQuadTransformDimensions";

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

    // Physics

    isVoxelCollisionLayerOccupied(voxel: Voxel, collisionLayer: number): boolean
    {
        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
            return true;
        return (voxel.collisionLayerMask & (1 << collisionLayer)) != 0;
    },

    // Returns COLLISION_LAYER_NULL if no layer is occupied
    getHighestOccupiedVoxelCollisionLayer(voxel: Voxel): number
    {
        for (let layer = COLLISION_LAYER_MAX; layer >= COLLISION_LAYER_MIN; --layer)
        {
            if ((voxel.collisionLayerMask & (1 << layer)) != 0)
                return layer;
        }
        return COLLISION_LAYER_NULL;
    },

    // Voxel blocks: one layer of one voxel. Index order is layer fastest, then column, then row, so a
    // voxel's layers are contiguous.

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

    // Out-of-grid blocks count as occupied, so grid walks stop at the floor, ceiling and boundary.
    isVoxelBlockOccupied(voxels: Voxel[], row: number, col: number, collisionLayer: number): boolean
    {
        const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
        if (voxel == undefined)
            return true;
        return VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer);
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

    // Get transform dimensions from properties

    getVoxelQuadTransformDimensions(voxel: Voxel, quadIndex: number, ignoreVisibility: boolean = false): VoxelQuadTransformDimensions
    {
        const quad = voxel.quadsMem.quads[quadIndex];
        if (!ignoreVisibility && (quad & 0b10000000) == 0) // quad is hidden
            return { offsetX: 0, offsetY: -9999, offsetZ: 0, dirX: 0, dirY: -1, dirZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };

        const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
        const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
        const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

        let offsetX = 0, offsetY = 0, offsetZ = 0,
            dirX = 0, dirY = 0, dirZ = 0, scaleX = 1, scaleY = COLLISION_LAYER_HEIGHT, scaleZ = 1;

        if (facingAxis == "y")
            scaleY = 1;

        if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
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
                if (orientation == "+") { dirX = 1; dirY = 0; dirZ = 0; offsetX += 0.5; }
                else { dirX = -1; dirY = 0; dirZ = 0; offsetX -= 0.5; }
                break;
            case "y":
                if (orientation == "+") { dirX = 0; dirY = 1; dirZ = 0; }
                else { dirX = 0; dirY = -1; dirZ = 0; }
                break;
            case "z":
                if (orientation == "+") { dirX = 0; dirY = 0; dirZ = 1; offsetZ += 0.5; }
                else { dirX = 0; dirY = 0; dirZ = -1; offsetZ -= 0.5; }
                break;
            default:
                throw new Error(`Unknown facingAxis (${facingAxis})`);
        }
        return { offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ };
    },
};

export default VoxelQueryUtil;
