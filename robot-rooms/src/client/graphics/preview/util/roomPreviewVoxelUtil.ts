import Geometry3DUtil from "../../../../shared/math/util/geometry3DUtil";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, GENERATED_WALL_THICKNESS,
    NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS, NUM_VOXEL_TEXTURE_COLS,
    NUM_VOXEL_TEXTURE_ROWS, VOXEL_CELL_SIZE, VOXEL_TEXTURE_CELL_SIZE } from "../../../../shared/system/sharedConstants";
import Voxel from "../../../../shared/voxel/types/voxel";
import VoxelGrid from "../../../../shared/voxel/types/voxelGrid";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { ROOM_PREVIEW_VIEW_DIR } from "../../../system/clientConstants";
import VoxelQuadTextureUtil from "../../../voxel/util/voxelQuadTextureUtil";
import TexelRect from "../../types/texture/texelRect";

// The share of a room's open columns that must have a floor at one height, over open space, for the room to be
// shown as two storeys.
const MIN_UPPER_FLOOR_SHARE = 0.2;

// How deep into the solid behind a face its cap runs, in blocks: a generated room's wall, so that the solid a room
// is carved out of shows as a wall round it, and never roofs over what lies behind.
const CAP_DEPTH = GENERATED_WALL_THICKNESS;

const ALL_LAYERS = (1 << NUM_COLLISION_LAYERS) - 1;

// A quad's corners in its own UV, in the order a quad mesh takes them (see MeshFactory.createDetachedQuadMesh).
const QUAD_CORNER_UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const NUM_QUAD_CORNERS = QUAD_CORNER_UVS.length;

const texelsTemp: TexelRect = {x: 0, y: 0, width: 0, height: 0};

// What a room preview draws of a room's blocks (see RoomPreviewUtil), as quads (see
// MeshFactory.createDetachedQuadMesh). A level is a run of layers: the blocks of layerMin to layerMax.
const RoomPreviewVoxelUtil =
{
    // The layer the room's upper floor starts at: where most of its columns have blocks start over open space and
    // end under more. -1 where too few do for it to be a storey.
    getUpperFloorLayer: (voxels: Voxel[]): number =>
    {
        const counts = new Array<number>(NUM_COLLISION_LAYERS).fill(0);
        let numOpenColumns = 0;
        for (const voxel of voxels)
        {
            const solid = voxel.blockLayerMask & ALL_LAYERS;
            if (solid == ALL_LAYERS)
                continue;
            ++numOpenColumns;

            // (From the second layer up: what starts at the first stands on the room's own floor.)
            const starts = solid & ~(solid << 1);
            for (let layer = COLLISION_LAYER_MIN + 1; layer <= COLLISION_LAYER_MAX; ++layer)
            {
                if ((starts & (1 << layer)) == 0)
                    continue;
                let end = layer;
                while (end < COLLISION_LAYER_MAX && (solid & (1 << (end + 1))) != 0)
                    ++end;
                if (end < COLLISION_LAYER_MAX)
                    ++counts[layer];
            }
        }

        let upperFloorLayer = COLLISION_LAYER_MIN;
        for (let layer = COLLISION_LAYER_MIN + 1; layer <= COLLISION_LAYER_MAX; ++layer)
        {
            if (counts[layer] > counts[upperFloorLayer])
                upperFloorLayer = layer;
        }
        const isStorey = counts[upperFloorLayer] > 0 && counts[upperFloorLayer] >= MIN_UPPER_FLOOR_SHARE * numOpenColumns;
        return isStorey ? upperFloorLayer : -1;
    },
    // Each level's faces, textured from the pack's atlas: the ones the room draws (see
    // VoxelQueryUtil.isVoxelQuadVisible) that are turned toward the camera, which looks down on the room.
    getFaces: (voxelGrid: VoxelGrid, levels: {layerMin: number, layerMax: number}[])
        : {positions: Float32Array, normals: Float32Array, uvs: Float32Array}[] =>
    {
        const voxels = voxelGrid.voxels;
        const quads = voxelGrid.quadsMem.quads;
        const textureWidth = NUM_VOXEL_TEXTURE_COLS * VOXEL_TEXTURE_CELL_SIZE;
        const textureHeight = NUM_VOXEL_TEXTURE_ROWS * VOXEL_TEXTURE_CELL_SIZE;
        const faces = levels.map(() => ({positions: [] as number[], normals: [] as number[], uvs: [] as number[]}));

        const addFace = (quadIndex: number): void =>
        {
            const blockLayer = VoxelQueryUtil.getVoxelBlockCollisionLayerFromQuadIndex(quadIndex);
            const levelIndex = levels.findIndex(level => blockLayer >= level.layerMin && blockLayer <= level.layerMax);
            if (levelIndex < 0)
                return;
            const {positions, normals, uvs} = faces[levelIndex];

            // Placed and textured as the room's own quads are (see VoxelGameObject).
            const dims = VoxelQueryUtil.getVoxelQuadTransformDimensions(voxels, quadIndex, true);
            const worldX = VoxelQueryUtil.getWorldXAtVoxelColCenter(VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex))
                + dims.offsetX;
            const worldZ = VoxelQueryUtil.getWorldZAtVoxelRowCenter(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex))
                + dims.offsetZ;
            const {right, up} = Geometry3DUtil.getAxisFacingBasis({x: dims.dirX, y: dims.dirY, z: dims.dirZ});
            const texels = VoxelQuadTextureUtil.getTexelRect(quadIndex, quads[quadIndex], dims, worldX, worldZ, texelsTemp);
            for (let i = 0; i < NUM_QUAD_CORNERS; ++i)
            {
                const u = QUAD_CORNER_UVS[i][0], v = QUAD_CORNER_UVS[i][1];
                const alongRight = (u - 0.5) * dims.scaleX, alongUp = (v - 0.5) * dims.scaleY;
                positions.push(worldX + alongRight * right.x + alongUp * up.x,
                    dims.offsetY + alongRight * right.y + alongUp * up.y,
                    worldZ + alongRight * right.z + alongUp * up.z);
                normals.push(dims.dirX, dims.dirY, dims.dirZ);
                // From the centre of its first texel to the centre of its last, so that filtering never reads
                // past it (see InstancedMeshBinding.updateInstanceTextureRect).
                uvs.push((texels.x + 0.5 + u * (texels.width - 1)) / textureWidth,
                    (texels.y + 0.5 + v * (texels.height - 1)) / textureHeight);
            }
        };

        // Found a column at a time from its blocks' layers, rather than by asking after every quad of the room:
        // a block shows a face where the cell that face looks at holds none, and the room its floor where the
        // lowest cell holds none.
        const colStep = Math.sign(ROOM_PREVIEW_VIEW_DIR.x);
        const rowStep = Math.sign(ROOM_PREVIEW_VIEW_DIR.z);
        const xOrientation = (colStep > 0) ? "+" : "-";
        const zOrientation = (rowStep > 0) ? "+" : "-";
        for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
        {
            for (let col = 0; col < NUM_VOXEL_COLS; ++col)
            {
                const solid = getSolidLayers(voxels, row, col);
                // (Over the top layer is solid, as outside the grid is.)
                const shownAlongY = solid & ~((solid >> 1) | (1 << COLLISION_LAYER_MAX));
                const shownAlongX = solid & ~getSolidLayers(voxels, row, col + colStep);
                const shownAlongZ = solid & ~getSolidLayers(voxels, row + rowStep, col);
                for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                {
                    if ((shownAlongY & (1 << layer)) != 0)
                        addFace(VoxelQueryUtil.getVoxelQuadIndex(row, col, "y", "+", layer));
                    if ((shownAlongX & (1 << layer)) != 0)
                        addFace(VoxelQueryUtil.getVoxelQuadIndex(row, col, "x", xOrientation, layer));
                    if ((shownAlongZ & (1 << layer)) != 0)
                        addFace(VoxelQueryUtil.getVoxelQuadIndex(row, col, "z", zOrientation, layer));
                }
                if ((solid & (1 << COLLISION_LAYER_MIN)) == 0)
                    addFace(VoxelQueryUtil.getFloorVoxelQuadIndex(row, col));
            }
        }
        return faces.map(({positions, normals, uvs}) => ({positions: new Float32Array(positions),
            normals: new Float32Array(normals), uvs: new Float32Array(uvs)}));
    },
    // Each level's caps: the tops the room has no face for, of blocks that go on up into more blocks, or into what
    // the level is cut off from. Without them, whatever stands as high as the level would look hollow from above.
    // A block is capped where it stands between open space on the camera's side and open space beyond it, as a
    // wall or a pillar does; or where it is the wall behind open space, as deep as CAP_DEPTH. What a room is
    // carved out of is left open in front of it, so that it can be seen into.
    getCaps: (voxels: Voxel[], levels: {layerMin: number, layerMax: number}[])
        : {positions: Float32Array, normals: Float32Array}[] =>
    {
        // The layers at which each column, going by x and going by z, has open space somewhere toward the camera
        // (nearer) and somewhere away from it (farther).
        const colStep = Math.sign(ROOM_PREVIEW_VIEW_DIR.x);
        const rowStep = Math.sign(ROOM_PREVIEW_VIEW_DIR.z);
        const nearerAlongX = getOpenLayersAlong(voxels, 0, colStep);
        const fartherAlongX = getOpenLayersAlong(voxels, 0, -colStep);
        const nearerAlongZ = getOpenLayersAlong(voxels, rowStep, 0);
        const fartherAlongZ = getOpenLayersAlong(voxels, -rowStep, 0);
        const halfSize = 0.5 * VOXEL_CELL_SIZE;

        return levels.map(level => {
            const positions: number[] = [];
            const normals: number[] = [];
            const lowestLayer = Math.max(level.layerMin, COLLISION_LAYER_MIN);
            const highestLayer = Math.min(level.layerMax, COLLISION_LAYER_MAX);
            const levelLayers = ((1 << (highestLayer + 1)) - 1) & ~((1 << lowestLayer) - 1);

            for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
            {
                for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                {
                    const solid = getSolidLayers(voxels, row, col);
                    if ((solid & levelLayers) == 0)
                        continue;
                    const column = row * NUM_VOXEL_COLS + col;

                    let capped = (nearerAlongX[column] & fartherAlongX[column]) | (nearerAlongZ[column] & fartherAlongZ[column]);
                    let behindRow = solid, behindCol = solid;
                    for (let step = 1; step <= CAP_DEPTH; ++step)
                    {
                        const besideRow = getSolidLayers(voxels, row + step * rowStep, col);
                        const besideCol = getSolidLayers(voxels, row, col + step * colStep);
                        capped |= (behindRow & ~besideRow) | (behindCol & ~besideCol);
                        behindRow &= besideRow;
                        behindCol &= besideCol;
                    }
                    capped &= solid & levelLayers;

                    // Where that stops with more of the column over it, which may be the solid over the room.
                    const tops = capped & ~(capped >> 1) & ((solid >> 1) | (1 << COLLISION_LAYER_MAX));
                    for (let layer = lowestLayer; layer <= highestLayer; ++layer)
                    {
                        if ((tops & (1 << layer)) == 0)
                            continue;
                        const x = VoxelQueryUtil.getWorldXAtVoxelColCenter(col);
                        const y = (layer + 1) * COLLISION_LAYER_HEIGHT;
                        const z = VoxelQueryUtil.getWorldZAtVoxelRowCenter(row);
                        // Facing up, with x for its right and -z for its up.
                        for (let i = 0; i < NUM_QUAD_CORNERS; ++i)
                        {
                            positions.push(x + (2 * QUAD_CORNER_UVS[i][0] - 1) * halfSize, y,
                                z - (2 * QUAD_CORNER_UVS[i][1] - 1) * halfSize);
                            normals.push(0, 1, 0);
                        }
                    }
                }
            }
            return {positions: new Float32Array(positions), normals: new Float32Array(normals)};
        });
    },
}

// For every column, the layers at which there is open space somewhere along the given step from it. None beyond
// the grid, which is solid all the way.
function getOpenLayersAlong(voxels: Voxel[], rowStep: number, colStep: number): Uint16Array
{
    const openLayers = new Uint16Array(NUM_VOXEL_ROWS * NUM_VOXEL_COLS);
    // From the far end of the step backward, so that each column reads the one it steps to.
    for (let i = 0; i < NUM_VOXEL_ROWS; ++i)
    {
        for (let j = 0; j < NUM_VOXEL_COLS; ++j)
        {
            const row = (rowStep > 0) ? NUM_VOXEL_ROWS - 1 - i : i;
            const col = (colStep > 0) ? NUM_VOXEL_COLS - 1 - j : j;
            const nextRow = row + rowStep, nextCol = col + colStep;
            if (nextRow < 0 || nextRow >= NUM_VOXEL_ROWS || nextCol < 0 || nextCol >= NUM_VOXEL_COLS)
                continue;
            openLayers[row * NUM_VOXEL_COLS + col] = (~getSolidLayers(voxels, nextRow, nextCol) & ALL_LAYERS)
                | openLayers[nextRow * NUM_VOXEL_COLS + nextCol];
        }
    }
    return openLayers;
}

// The layers of a column that hold a block, one bit each. All of them outside the grid, which is solid.
function getSolidLayers(voxels: Voxel[], row: number, col: number): number
{
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    return (voxel == undefined) ? ALL_LAYERS : (voxel.blockLayerMask & ALL_LAYERS);
}

export default RoomPreviewVoxelUtil;
