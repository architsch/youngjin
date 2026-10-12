/**
 * The picture of a room file's room that is shown before the file is loaded (see RoomPreviewUtil): everything that
 * is worked out of the room before the picture is drawn. The drawing itself needs a graphics context.
 * Covers: which rooms are shown as two storeys (a generated one at its slab, a room of one storey never, a floor over
 * too little of the room never, the floor most of the room has of several, each room the game ships); the faces
 * drawn (the room's own quads that are turned toward the camera, each with its level, those very quads up to the
 * grid's top and edges in a room scrambled with blocks, lying on their blocks' sides
 * and wound to face out, showing texels of their own texture's cell and nothing of a procedural one's margin); the
 * caps (a rim behind each storey's far walls as deep as a generated wall and no deeper into the solid a room is
 * carved out of, none in front of the room or over its ceiling, a wall cut off at its level's top beside open space
 * that goes on up, whatever stands as high as its level capped all over, nothing with a face of its own on top); the
 * objects (only those on faces turned toward the camera, each on the level of the block it is on, nothing for a
 * volume, their parts one instance each, a picture over its face and inside its frame, turned as its object is, the
 * placeholder for an image that can't be had, the pictures of one image in one mesh a level and one material, room
 * made for what stands out of its face); the look an object is composed in, read from the
 * object alone; how a picture lays its image out; the meshes made for a scene that isn't the game's; and a draw
 * the room's lamps don't light.
 */
import { describe, it, expect, vi } from "vitest";

// Nothing here is added to the game's scene.
const addedToScene: unknown[] = [];
vi.mock("../../../src/client/graphics/graphicsManager", () => ({
    default: { addObjectToSceneIfNotAlreadyAdded: (obj: unknown) => { addedToScene.push(obj); }, getScene: () => ({}) },
}));

import * as THREE from "three";
import "../../../src/shared/graphics/mesh/composition/instancedMeshCompositionBuilderMapDependencies";
import MeshFactory from "../../../src/client/graphics/factories/meshFactory";
import LightBlockMapMaterialUtil from "../../../src/client/graphics/light/util/lightBlockMapMaterialUtil";
import RoomPreviewLevel from "../../../src/client/graphics/preview/types/roomPreviewLevel";
import RoomPreviewObjectUtil from "../../../src/client/graphics/preview/util/roomPreviewObjectUtil";
import RoomPreviewVoxelUtil from "../../../src/client/graphics/preview/util/roomPreviewVoxelUtil";
import { getTurnedUV } from "../../../src/client/graphics/shaders/instancedTexturePackShader";
import PictureLayoutUtil from "../../../src/client/graphics/util/pictureLayoutUtil";
import { ROOM_PREVIEW_VIEW_DIR } from "../../../src/client/system/clientConstants";
import MaterialParamsMap from "../../../src/shared/graphics/material/maps/materialParamsMap";
import PreEncodedCompositionIndexMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import { FRAMED_PANEL_BOARD_RELIEF, FRAMED_PANEL_CONTENT_LIFT }
    from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/framedPanelCompositionConstants";
import { InstancedMeshCompositionParams } from "../../../src/shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import CompositionMetadataUtil from "../../../src/shared/graphics/mesh/composition/util/compositionMetadataUtil";
import Vec3 from "../../../src/shared/math/types/vec3";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import BufferState from "../../../src/shared/networking/types/bufferState";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import LampObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import ObjectCompositionUtil from "../../../src/shared/object/util/objectCompositionUtil";
import QuarterTurnsUtil from "../../../src/shared/object/util/quarterTurnsUtil";
import RoomFile from "../../../src/shared/room/types/roomFile";
import RoomPalette from "../../../src/shared/room/types/roomPalette";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import RoomVolume from "../../../src/shared/room/types/roomVolume";
import RoomGenerationUtil from "../../../src/shared/room/util/roomGenerationUtil";
import RoomVolumeUtil from "../../../src/shared/room/util/roomVolumeUtil";
import SinglePlayerModeConfigMap from "../../../src/shared/singlePlayer/maps/singlePlayerModeConfigMap";
import { ALL_FACE_DIRECTIONS, COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, GENERATED_WALL_THICKNESS,
    INSTANCED_COLOR_MATERIAL_ID, INSTANCED_EMISSIVE_MATERIAL_ID, LIGHT_COLOR_PALETTE_NAME, MAX_ROOM_X, MAX_ROOM_Z,
    NUM_PACK_VOXEL_TEXTURES, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_ROOM, NUM_VOXEL_ROWS, NUM_VOXEL_TEXTURE_COLS,
    NUM_VOXEL_TEXTURE_ROWS, PROCEDURAL_VOXEL_TEXTURE_MARGIN, ROOM_EDITOR_SINGLE_PLAYER_MODE, SANDBOX_SINGLE_PLAYER_MODE,
    STOREY_FLOOR_COLLISION_LAYER, TUTORIAL_SINGLE_PLAYER_MODE, UNIT_VEC3, VOXEL_CELL_SIZE, VOXEL_TEXTURE_CELL_SIZE }
    from "../../../src/shared/system/sharedConstants";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQuadUpdateUtil from "../../../src/shared/voxel/util/voxelQuadUpdateUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import { FIXTURE_PICTURES, useFixturePictures } from "../helpers/pictureFixture";
import { readSinglePlayerRoomFileBytes } from "../helpers/roomContent";

const PALETTE = new RoomPalette(0, 0, 0, 0);

// The open space of a generated room's storeys, in voxels along each side.
const INTERIOR_SIZE = NUM_VOXEL_COLS - 2 * GENERATED_WALL_THICKNESS;
const INTERIOR_MIN = GENERATED_WALL_THICKNESS;
const INTERIOR_MAX = NUM_VOXEL_COLS - 1 - GENERATED_WALL_THICKNESS;

// The levels a generated room is shown as (see RoomPreviewUtil).
const STOREYS = [
    {layerMin: COLLISION_LAYER_MIN - 1, layerMax: STOREY_FLOOR_COLLISION_LAYER - 1},
    {layerMin: STOREY_FLOOR_COLLISION_LAYER, layerMax: COLLISION_LAYER_MAX + 1},
];
const WHOLE_ROOM = [{layerMin: COLLISION_LAYER_MIN - 1, layerMax: COLLISION_LAYER_MAX + 1}];

function generateGrid(): VoxelGrid
{
    return RoomGenerationUtil.generateRoom("preview", RoomTypeEnumMap.Hub).voxelGrid;
}

// One open hall inside a generated room's boundary wall, a layer short of the grid's top.
function carveHall(): VoxelGrid
{
    const grid = VoxelGrid.createBaseGrid();
    RoomVolumeUtil.carveOutVolume(grid.voxels, new RoomVolume(INTERIOR_MIN, INTERIOR_MAX, INTERIOR_MIN, INTERIOR_MAX,
        COLLISION_LAYER_MIN, COLLISION_LAYER_MAX - 1), PALETTE);
    return grid;
}

// Blocks over a square of the plan, numVoxels a side, from the corner at (start, start).
function addBlocks(voxels: Voxel[], start: number, numVoxels: number, layerMin: number, layerMax: number): void
{
    for (let row = start; row < start + numVoxels; ++row)
    {
        for (let col = start; col < start + numVoxels; ++col)
        {
            for (let layer = layerMin; layer <= layerMax; ++layer)
                VoxelUpdateUtil.addVoxelBlock(undefined, voxels, VoxelQueryUtil.getVoxelQuadIndex(row, col, "x", "+", layer));
        }
    }
}

function readShippedRoom(roomPath: string): RoomFile
{
    return RoomFile.decodeWithParams(new BufferState(readSinglePlayerRoomFileBytes(roomPath)), "preview") as RoomFile;
}

// The quads of a quad mesh's positions, four corners each.
function toQuads(positions: Float32Array): THREE.Vector3[][]
{
    const quads: THREE.Vector3[][] = [];
    for (let i = 0; i < positions.length; i += 12)
        quads.push([0, 3, 6, 9].map(offset => new THREE.Vector3().fromArray(positions, i + offset)));
    return quads;
}

function getMiddle(quad: THREE.Vector3[]): THREE.Vector3
{
    return quad.reduce((sum, corner) => sum.add(corner), new THREE.Vector3()).multiplyScalar(1 / quad.length);
}

describe("the storeys a room is shown as", () => {
    it("are a generated room's two, apart at its slab", () => {
        expect(RoomPreviewVoxelUtil.getUpperFloorLayer(generateGrid().voxels)).toBe(STOREY_FLOOR_COLLISION_LAYER);
    });

    it("are one for a room of one storey, whatever stands in it", () => {
        const grid = carveHall();
        expect(RoomPreviewVoxelUtil.getUpperFloorLayer(grid.voxels)).toBe(-1);

        // What stands on the floor is no floor over open space, as high as it reaches and as much of the room
        // as it takes.
        addBlocks(grid.voxels, INTERIOR_MIN, 36, COLLISION_LAYER_MIN, 1);
        addBlocks(grid.voxels, 42, 4, COLLISION_LAYER_MIN, 5);
        addBlocks(grid.voxels, 50, 2, COLLISION_LAYER_MIN, COLLISION_LAYER_MAX - 1);
        expect(RoomPreviewVoxelUtil.getUpperFloorLayer(grid.voxels)).toBe(-1);
    });

    it("are one while a floor covers little of the room, and two once it covers enough", () => {
        const loft = carveHall();
        addBlocks(loft.voxels, INTERIOR_MIN, Math.floor(0.3 * INTERIOR_SIZE), 5, 5); // under a tenth of the plan
        expect(RoomPreviewVoxelUtil.getUpperFloorLayer(loft.voxels)).toBe(-1);

        const storey = carveHall();
        addBlocks(storey.voxels, INTERIOR_MIN, Math.floor(0.6 * INTERIOR_SIZE), 5, 6); // over a third of it
        expect(RoomPreviewVoxelUtil.getUpperFloorLayer(storey.voxels)).toBe(5);
    });

    it("are apart at the floor most of the room has", () => {
        const grid = carveHall();
        addBlocks(grid.voxels, INTERIOR_MIN, 30, 9, 9);
        addBlocks(grid.voxels, INTERIOR_MIN + 30, 26, 4, 4);
        expect(RoomPreviewVoxelUtil.getUpperFloorLayer(grid.voxels)).toBe(9);
    });

    it("suit each room the game ships", () => {
        const getUpperFloorLayer = (singlePlayerMode: string) => RoomPreviewVoxelUtil.getUpperFloorLayer(
            readShippedRoom(SinglePlayerModeConfigMap[singlePlayerMode].roomPath).voxelGrid.voxels);
        expect(getUpperFloorLayer(TUTORIAL_SINGLE_PLAYER_MODE)).toBe(-1);
        expect(getUpperFloorLayer(SANDBOX_SINGLE_PLAYER_MODE)).toBe(-1);
        // (The room editor's empty room is a generated one.)
        expect(getUpperFloorLayer(ROOM_EDITOR_SINGLE_PLAYER_MODE)).toBe(STOREY_FLOOR_COLLISION_LAYER);
    });
});

describe("the faces drawn", () => {
    // A generated room with things standing in it on both storeys.
    function buildGrid(): VoxelGrid
    {
        const grid = generateGrid();
        addBlocks(grid.voxels, 10, 3, COLLISION_LAYER_MIN, 2);
        addBlocks(grid.voxels, 40, 2, COLLISION_LAYER_MIN, STOREY_FLOOR_COLLISION_LAYER - 1);
        addBlocks(grid.voxels, 20, 4, STOREY_FLOOR_COLLISION_LAYER + 1, 11);
        return grid;
    }

    function facesCamera(quadIndex: number): boolean
    {
        const sign = (VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex) == "+") ? 1 : -1;
        return sign * ROOM_PREVIEW_VIEW_DIR[VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex)] > 0;
    }

    it("are the room's own quads that are turned toward the camera, each with its level", () => {
        const grid = buildGrid();
        const expected = STOREYS.map(() => 0);
        for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
        {
            if (!VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex) || !facesCamera(quadIndex))
                continue;
            const blockLayer = VoxelQueryUtil.getVoxelBlockCollisionLayerFromQuadIndex(quadIndex);
            ++expected[STOREYS.findIndex(level => blockLayer >= level.layerMin && blockLayer <= level.layerMax)];
        }

        const faces = RoomPreviewVoxelUtil.getFaces(grid, STOREYS);
        expect(faces.map(level => level.positions.length / 12)).toEqual(expected);
        expect(faces.map(level => level.normals.length / 12)).toEqual(expected);
        expect(faces.map(level => level.uvs.length / 8)).toEqual(expected);
        expect(expected.every(count => count > 0)).toBe(true);

        // The lower storey reaches no higher than the slab's underside, and the upper starts at the slab.
        const slabBottom = STOREY_FLOOR_COLLISION_LAYER * COLLISION_LAYER_HEIGHT;
        expect(Math.max(...toQuads(faces[0].positions).flat().map(corner => corner.y))).toBeLessThanOrEqual(slabBottom);
        expect(Math.min(...toQuads(faces[1].positions).flat().map(corner => corner.y))).toBeGreaterThanOrEqual(slabBottom);

        // As one level, the same faces.
        const whole = RoomPreviewVoxelUtil.getFaces(grid, WHOLE_ROOM);
        expect(whole[0].positions.length / 12).toBe(expected[0] + expected[1]);
    });

    it("are those very quads up to the grid's top and edges, whatever stands where", () => {
        // Open from edge to edge and from floor to top, then blocks put in all over it, and some taken out again.
        const grid = VoxelGrid.createBaseGrid();
        RoomVolumeUtil.carveOutVolume(grid.voxels, new RoomVolume(0, NUM_VOXEL_ROWS - 1, 0, NUM_VOXEL_COLS - 1,
            COLLISION_LAYER_MIN, COLLISION_LAYER_MAX), PALETTE);
        let seed = 20261012;
        const draw = (bound: number) => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return Math.floor(seed / 4294967296 * bound);
        };
        for (let i = 0; i < 4000; ++i)
        {
            const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(draw(NUM_VOXEL_ROWS), draw(NUM_VOXEL_COLS), "x", "+",
                COLLISION_LAYER_MIN + draw(COLLISION_LAYER_MAX - COLLISION_LAYER_MIN + 1));
            if (i % 5 == 4)
                VoxelUpdateUtil.removeVoxelBlock(undefined, grid.voxels, quadIndex);
            else
                VoxelUpdateUtil.addVoxelBlock(undefined, grid.voxels, quadIndex);
        }

        // Each face as where its middle is and which way it looks.
        const toKey = (...numbers: number[]) => numbers.map(n => n.toFixed(3)).join(",");
        for (const levels of [STOREYS, WHOLE_ROOM])
        {
            const expected: string[][] = levels.map(() => []);
            for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
            {
                if (!VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex) || !facesCamera(quadIndex))
                    continue;
                const blockLayer = VoxelQueryUtil.getVoxelBlockCollisionLayerFromQuadIndex(quadIndex);
                const dims = VoxelQueryUtil.getVoxelQuadTransformDimensions(grid.voxels, quadIndex, true);
                expected[levels.findIndex(level => blockLayer >= level.layerMin && blockLayer <= level.layerMax)].push(toKey(
                    VoxelQueryUtil.getWorldXAtVoxelColCenter(VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex)) + dims.offsetX,
                    dims.offsetY,
                    VoxelQueryUtil.getWorldZAtVoxelRowCenter(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex)) + dims.offsetZ,
                    dims.dirX, dims.dirY, dims.dirZ));
            }
            const drawn = RoomPreviewVoxelUtil.getFaces(grid, levels).map(({positions, normals}) =>
                toQuads(positions).map((quad, i) => {
                    const middle = getMiddle(quad);
                    return toKey(middle.x, middle.y, middle.z, normals[12 * i], normals[12 * i + 1], normals[12 * i + 2]);
                }));
            expect(drawn.map(level => level.sort())).toEqual(expected.map(level => level.sort()));
            expect(expected.every(level => level.length > 1000)).toBe(true);
        }
    });

    it("lie on their blocks' sides, wound to face out", () => {
        const faces = RoomPreviewVoxelUtil.getFaces(buildGrid(), WHOLE_ROOM)[0];
        const quads = toQuads(faces.positions);
        quads.forEach((quad, i) => {
            const normal = new THREE.Vector3().fromArray(faces.normals, 12 * i);
            expect(normal.dot(new THREE.Vector3(ROOM_PREVIEW_VIEW_DIR.x, ROOM_PREVIEW_VIEW_DIR.y, ROOM_PREVIEW_VIEW_DIR.z)))
                .toBeGreaterThan(0);
            // Flat, on the grid, and a block's side across.
            const along = quad.map(corner => corner.dot(normal));
            expect(Math.max(...along) - Math.min(...along)).toBeCloseTo(0, 9);
            expect(along[0] / VOXEL_CELL_SIZE).toBeCloseTo(Math.round(along[0] / VOXEL_CELL_SIZE), 9);
            const [bottomLeft, bottomRight, topRight, topLeft] = quad;
            const right = bottomRight.clone().sub(bottomLeft);
            const up = topLeft.clone().sub(bottomLeft);
            expect(right.length()).toBeCloseTo(VOXEL_CELL_SIZE, 9);
            expect(up.length()).toBeCloseTo(VOXEL_CELL_SIZE, 9);
            expect(topRight.distanceTo(bottomLeft.clone().add(right).add(up))).toBeCloseTo(0, 9);
            // Counter-clockwise as seen from in front.
            expect(right.cross(up).normalize().dot(normal)).toBeCloseTo(1, 9);
        });
    });

    it("show texels of their own texture's cell, and nothing of a procedural one's margin", () => {
        const textureWidth = NUM_VOXEL_TEXTURE_COLS * VOXEL_TEXTURE_CELL_SIZE;
        const textureHeight = NUM_VOXEL_TEXTURE_ROWS * VOXEL_TEXTURE_CELL_SIZE;
        for (const textureIndex of [0, 13, NUM_PACK_VOXEL_TEXTURES - 1, NUM_PACK_VOXEL_TEXTURES, NUM_PACK_VOXEL_TEXTURES + 9])
        {
            const grid = buildGrid();
            for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
            {
                const voxel = VoxelQueryUtil.getVoxel(grid.voxels, VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
                    VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex))!;
                if (VoxelQueryUtil.isVoxelQuadVisible(grid.voxels, quadIndex))
                    VoxelQuadUpdateUtil.setVoxelQuadTexture(voxel, quadIndex, textureIndex);
            }

            const margin = (textureIndex < NUM_PACK_VOXEL_TEXTURES) ? 0 : PROCEDURAL_VOXEL_TEXTURE_MARGIN;
            const cellX = (textureIndex % NUM_VOXEL_TEXTURE_COLS) * VOXEL_TEXTURE_CELL_SIZE;
            const cellY = Math.floor(textureIndex / NUM_VOXEL_TEXTURE_COLS) * VOXEL_TEXTURE_CELL_SIZE;
            const {uvs} = RoomPreviewVoxelUtil.getFaces(grid, WHOLE_ROOM)[0];
            let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
            for (let i = 0; i < uvs.length; i += 2)
            {
                minU = Math.min(minU, uvs[i]); maxU = Math.max(maxU, uvs[i]);
                minV = Math.min(minV, uvs[i + 1]); maxV = Math.max(maxV, uvs[i + 1]);
            }
            // From the centre of the first texel that tiles to the centre of the last, and all of that between them.
            expect(minU * textureWidth).toBeCloseTo(cellX + margin + 0.5, 3);
            expect(maxU * textureWidth).toBeCloseTo(cellX + VOXEL_TEXTURE_CELL_SIZE - margin - 0.5, 3);
            expect(minV * textureHeight).toBeCloseTo(cellY + margin + 0.5, 3);
            expect(maxV * textureHeight).toBeCloseTo(cellY + VOXEL_TEXTURE_CELL_SIZE - margin - 0.5, 3);
        }
    });
});

describe("the caps", () => {
    // The voxels capped, as "row,col" at their height.
    function getCappedCells(positions: Float32Array): {key: string, y: number}[]
    {
        return toQuads(positions).map(quad => {
            const middle = getMiddle(quad);
            expect(quad.every(corner => corner.y == middle.y)).toBe(true);
            return {key: `${VoxelQueryUtil.getVoxelRowFromWorldZ(middle.z)},${VoxelQueryUtil.getVoxelColFromWorldX(middle.x)}`,
                y: middle.y};
        });
    }

    // The wall behind a generated room's open space, as the camera sees it: past its last rows, and before its
    // first columns.
    function isFarWall(key: string): boolean
    {
        const [row, col] = key.split(",").map(Number);
        const alongRoom = (n: number) => n >= INTERIOR_MIN && n <= INTERIOR_MAX;
        return (row > INTERIOR_MAX && alongRoom(col)) || (col < INTERIOR_MIN && alongRoom(row));
    }

    it("rim each storey's far walls, as deep as a generated wall, and nothing else of an empty room", () => {
        const caps = RoomPreviewVoxelUtil.getCaps(generateGrid().voxels, STOREYS);
        const tops = [STOREY_FLOOR_COLLISION_LAYER, COLLISION_LAYER_MAX].map(layer => layer * COLLISION_LAYER_HEIGHT);
        caps.forEach((level, i) => {
            const cells = getCappedCells(level.positions);
            expect(cells.length).toBe(2 * INTERIOR_SIZE * GENERATED_WALL_THICKNESS);
            expect(new Set(cells.map(cell => cell.key)).size).toBe(cells.length);
            expect(cells.every(cell => isFarWall(cell.key))).toBe(true);
            // At the top of the storey's open space: under the slab, and under the solid over the room.
            expect(cells.every(cell => cell.y == tops[i])).toBe(true);
            expect(level.normals.length).toBe(level.positions.length);
        });
    });

    it("run no deeper than a generated wall into the solid a room is carved out of", () => {
        // A hall well inside the grid, with solid all round it to the grid's edge.
        const [min, max] = [16, 39];
        const grid = VoxelGrid.createBaseGrid();
        RoomVolumeUtil.carveOutVolume(grid.voxels, new RoomVolume(min, max, min, max, COLLISION_LAYER_MIN, 9), PALETTE);

        const cells = getCappedCells(RoomPreviewVoxelUtil.getCaps(grid.voxels, WHOLE_ROOM)[0].positions);
        const expected: string[] = [];
        for (let along = min; along <= max; ++along)
        {
            for (let depth = 1; depth <= GENERATED_WALL_THICKNESS; ++depth)
                expected.push(`${max + depth},${along}`, `${along},${min - depth}`);
        }
        expect(cells.map(cell => cell.key).sort()).toEqual(expected.sort());
        expect(cells.every(cell => cell.y == 10 * COLLISION_LAYER_HEIGHT)).toBe(true);
    });

    it("cut a wall off at its level's top, where the open space beside it goes on up", () => {
        // An opening through the slab, against the far wall.
        const grid = generateGrid();
        const [colMin, colMax] = [20, 25];
        for (let col = colMin; col <= colMax; ++col)
        {
            for (const row of [INTERIOR_MAX - 1, INTERIOR_MAX])
                VoxelUpdateUtil.removeVoxelBlock(undefined, grid.voxels,
                    VoxelQueryUtil.getVoxelQuadIndex(row, col, "x", "+", STOREY_FLOOR_COLLISION_LAYER));
        }

        const caps = RoomPreviewVoxelUtil.getCaps(grid.voxels, STOREYS);
        const tops = [STOREY_FLOOR_COLLISION_LAYER, COLLISION_LAYER_MAX].map(layer => layer * COLLISION_LAYER_HEIGHT);
        caps.forEach((level, i) => {
            const besideTheOpening = getCappedCells(level.positions).filter(cell => {
                const [row, col] = cell.key.split(",").map(Number);
                return row > INTERIOR_MAX && col >= colMin && col <= colMax;
            });
            expect(besideTheOpening.length).toBe((colMax - colMin + 1) * GENERATED_WALL_THICKNESS);
            expect(besideTheOpening.every(cell => cell.y == tops[i])).toBe(true);
        });
    });

    it("cover whatever stands as high as its level, and nothing with a face of its own on top", () => {
        const grid = generateGrid();
        const top = STOREY_FLOOR_COLLISION_LAYER - 1;
        addBlocks(grid.voxels, 20, 1, COLLISION_LAYER_MIN, top);     // a pillar one voxel across
        addBlocks(grid.voxels, 30, 8, COLLISION_LAYER_MIN, top);     // a mass far wider than a wall is deep
        addBlocks(grid.voxels, 45, 4, COLLISION_LAYER_MIN, top - 2); // something lower, which the room draws a top for
        addBlocks(grid.voxels, 50, 3, 3, top);                       // something hung from the slab

        const cells = getCappedCells(RoomPreviewVoxelUtil.getCaps(grid.voxels, STOREYS)[0].positions)
            .filter(cell => !isFarWall(cell.key));
        const expected: string[] = [];
        for (const [start, numVoxels] of [[20, 1], [30, 8], [50, 3]])
        {
            for (let row = start; row < start + numVoxels; ++row)
            {
                for (let col = start; col < start + numVoxels; ++col)
                    expected.push(`${row},${col}`);
            }
        }
        expect(cells.map(cell => cell.key).sort()).toEqual(expected.sort());
        expect(cells.every(cell => cell.y == STOREY_FLOOR_COLLISION_LAYER * COLLISION_LAYER_HEIGHT)).toBe(true);
    });

    it("cover a wall across the room, and one that stops short of the storey's top where it stops", () => {
        const grid = carveHall();
        const hallTop = COLLISION_LAYER_MAX - 1;
        // Across the hall along x, to its top; and along z, half as high, which the room draws a top for.
        for (let col = INTERIOR_MIN; col <= INTERIOR_MAX; ++col)
        {
            for (let layer = COLLISION_LAYER_MIN; layer <= hallTop; ++layer)
                VoxelUpdateUtil.addVoxelBlock(undefined, grid.voxels, VoxelQueryUtil.getVoxelQuadIndex(20, col, "x", "+", layer));
        }
        for (let row = INTERIOR_MIN; row < 20; ++row)
        {
            for (let layer = COLLISION_LAYER_MIN; layer <= 6; ++layer)
                VoxelUpdateUtil.addVoxelBlock(undefined, grid.voxels, VoxelQueryUtil.getVoxelQuadIndex(row, 40, "x", "+", layer));
        }

        const cells = getCappedCells(RoomPreviewVoxelUtil.getCaps(grid.voxels, WHOLE_ROOM)[0].positions)
            .filter(cell => !isFarWall(cell.key));
        expect(cells.length).toBe(INTERIOR_SIZE);
        expect(cells.every(cell => cell.key.startsWith("20,") && cell.y == (hallTop + 1) * COLLISION_LAYER_HEIGHT)).toBe(true);
    });
});

describe("the look an object is composed in", () => {
    function makeObject(objectType: string, metadata: {[key: number]: string} = {}, scale: Vec3 = UNIT_VEC3): AddObjectSignal
    {
        const encoded: {[key: number]: EncodableByteString} = {};
        for (const key of Object.keys(metadata))
            encoded[Number(key)] = new EncodableByteString(metadata[Number(key)]);
        return new AddObjectSignal("room", "user", "User", ObjectTypeConfigMap.getIndexByType(objectType), `${objectType}1`,
            new ObjectTransform({x: 4, y: 2, z: 4}, {x: 0, y: 0, z: -1}, {...scale}), encoded);
    }

    function decode(obj: AddObjectSignal): {params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[]}
    {
        const params: InstancedMeshCompositionParams = {};
        const parts: InstancedMeshCompositionPart[] = [];
        ObjectCompositionUtil.decode(obj, params, parts);
        return {params, parts};
    }

    it("is the one it stores, or its type's default where it stores none", () => {
        const defaults = DoorObjectTypeConfig.components.spawnedByAny.instancedMeshComposer.generateDefaultParts(makeObject("Door"));
        expect(decode(makeObject("Door"))).toEqual(defaults);
        expect(defaults.parts.length).toBeGreaterThan(0);

        const doorLooks = PreEncodedCompositionIndexMap.Door ?? [];
        expect(doorLooks.length).toBeGreaterThan(0);
        for (const compositionIndex of doorLooks)
        {
            const stored = decode(makeObject("Door", {[ObjectMetadataKeyEnumMap.InstancedMeshComposition]:
                CompositionMetadataUtil.encodeIndexed(compositionIndex, 0)}));
            expect(stored.params.compositionIndex).toBe(compositionIndex);
            expect(stored.parts.length).toBeGreaterThan(0);
        }
    });

    it("is its type's default where it stores another type's", () => {
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        try
        {
            const canvasLook = CompositionMetadataUtil.encodeIndexed((PreEncodedCompositionIndexMap.Canvas ?? [])[1], 0);
            const door = makeObject("Door", {[ObjectMetadataKeyEnumMap.InstancedMeshComposition]: canvasLook});
            expect(decode(door)).toEqual(decode(makeObject("Door")));
            expect(errors).toHaveBeenCalledTimes(1);
        }
        finally
        {
            errors.mockRestore();
        }
    });

    it("takes from the object what its type derives", () => {
        const colorIndex = 3;
        const lamp = makeObject("Lamp", {[ObjectMetadataKeyEnumMap.LightProperties]:
            LampObjectTypeConfig.util.encodeLightProperties(colorIndex, 4, 6)});
        const glow = decode(lamp).parts.filter(part => part.materialId == INSTANCED_EMISSIVE_MATERIAL_ID);
        expect(glow.length).toBeGreaterThan(0);
        for (const part of glow)
            expect(part.color).toEqual(ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME, colorIndex));
    });

    it("is nothing for a type that composes nothing", () => {
        expect(decode(makeObject("Prop"))).toEqual({params: {}, parts: []});
    });
});

describe("how a picture lays its image out", () => {
    const texels = {x: 0, y: 0, width: 256, height: 128};

    it("fits an image into it, keeps the scale of one that has its own, and fills it with the placeholder", () => {
        const fitted = PictureLayoutUtil.getLayout({path: "1/a", width: 256, height: 128}, texels, {x: 3, y: 3}, 0);
        expect(fitted.quadSize).toEqual({x: 3, y: 1.5});
        expect(fitted.texelRect).toEqual(texels);

        // (256 x 128 pixels are a world unit by half of one.)
        const kept = PictureLayoutUtil.getLayout({path: "2/a", width: 256, height: 128, preserveScale: true}, texels,
            {x: 3, y: 3}, 1);
        expect(kept.quadSize).toEqual({x: 0.5, y: 1});
        expect(kept.texelRect).toEqual(texels);

        const placeholder = PictureLayoutUtil.getLayout(undefined, texels, {x: 3, y: 2}, 1);
        expect(placeholder.quadSize).toEqual({x: 3, y: 2});
    });
});

describe("the objects drawn", () => {
    useFixturePictures();

    const FLOOR_UP = {x: 0, y: 1, z: 0};
    const upperFloorY = (STOREY_FLOOR_COLLISION_LAYER + 1) * COLLISION_LAYER_HEIGHT;
    const farWallZ = MAX_ROOM_Z - GENERATED_WALL_THICKNESS * VOXEL_CELL_SIZE;
    const nearWallZ = GENERATED_WALL_THICKNESS * VOXEL_CELL_SIZE;

    function makeLevels(): RoomPreviewLevel[]
    {
        return STOREYS.map(({layerMin, layerMax}) =>
            ({layerMin, layerMax, group: new THREE.Object3D(), bounds: new THREE.Box3()}));
    }

    let numObjects = 0;
    function makeObject(objectType: string, pos: Vec3, dir: Vec3, scale: Vec3 = UNIT_VEC3,
        metadata: {[key: number]: string} = {}): AddObjectSignal
    {
        const encoded: {[key: number]: EncodableByteString} = {};
        for (const key of Object.keys(metadata))
            encoded[Number(key)] = new EncodableByteString(metadata[Number(key)]);
        return new AddObjectSignal("room", "user", "User", ObjectTypeConfigMap.getIndexByType(objectType),
            `object${numObjects++}`, new ObjectTransform(pos, dir, {...scale}), encoded);
    }

    const textureByPath: {[path: string]: THREE.Texture} = {};
    const loadImage = async (image: {path: string}) => textureByPath[image.path] ??= new THREE.Texture();

    function getNumParts(obj: AddObjectSignal): number
    {
        const parts: InstancedMeshCompositionPart[] = [];
        ObjectCompositionUtil.decode(obj, {}, parts);
        return parts.length;
    }

    const getInstancedMeshes = (level: RoomPreviewLevel) =>
        level.group.children.filter(child => child instanceof THREE.InstancedMesh) as THREE.InstancedMesh[];
    const getPictureMeshes = (level: RoomPreviewLevel) =>
        level.group.children.filter(child => !(child instanceof THREE.InstancedMesh)) as THREE.Mesh[];
    const getNumInstances = (level: RoomPreviewLevel) =>
        getInstancedMeshes(level).reduce((sum, mesh) => sum + mesh.count, 0);

    it("are those on faces turned toward the camera, each on the level of the block it is on", async () => {
        const door = makeObject("Door", {x: 10, y: 1.75, z: farWallZ}, {x: 0, y: 0, z: -1});
        const npc = makeObject("Npc", {x: 12, y: upperFloorY, z: 12}, FLOOR_UP);
        const lampOnTheFloor = makeObject("Lamp", {x: 6, y: 0, z: 6}, FLOOR_UP);
        // On top of something as high as the lower storey, which is still of the lower storey.
        const lampOnTheTop = makeObject("Lamp", {x: 20, y: STOREY_FLOOR_COLLISION_LAYER * COLLISION_LAYER_HEIGHT, z: 20}, FLOOR_UP);
        const hidden = [
            makeObject("Lamp", {x: 8, y: STOREY_FLOOR_COLLISION_LAYER * COLLISION_LAYER_HEIGHT, z: 8}, {x: 0, y: -1, z: 0}),
            makeObject("Door", {x: 10, y: 1.75, z: nearWallZ}, {x: 0, y: 0, z: 1}),
            makeObject("Canvas", {x: MAX_ROOM_X - nearWallZ, y: 2, z: 10}, {x: -1, y: 0, z: 0}),
        ];
        const levels = makeLevels();
        const materials = await RoomPreviewObjectUtil.addObjects(
            new ObjectGroup([door, npc, lampOnTheFloor, lampOnTheTop, ...hidden]), levels, loadImage);

        expect(materials).toEqual([]); // no pictures among them
        expect(getNumInstances(levels[0])).toBe(getNumParts(door) + getNumParts(lampOnTheFloor) + getNumParts(lampOnTheTop));
        expect(getNumInstances(levels[1])).toBe(getNumParts(npc));
        expect(getNumParts(door) * getNumParts(npc) * getNumParts(lampOnTheFloor)).toBeGreaterThan(0);
        expect(levels.every(level => getPictureMeshes(level).length == 0)).toBe(true);

        // One mesh for the parts that share a geometry and a material, in the material the game draws them in.
        for (const level of levels)
        {
            const meshes = getInstancedMeshes(level);
            expect(new Set(meshes.map(mesh => `${mesh.geometry.uuid}`)).size).toBe(meshes.length);
            expect(meshes.every(mesh => mesh.instanceColor != null)).toBe(true);
        }
        // Detached: nothing went into the game's scene.
        expect(addedToScene).toEqual([]);
    });

    it("leave out what draws nothing, whichever way it is turned", async () => {
        const levels = makeLevels();
        const volumes = ALL_FACE_DIRECTIONS.map(dir => makeObject("Volume", {x: 16, y: 2, z: 16}, dir));
        expect(await RoomPreviewObjectUtil.addObjects(new ObjectGroup(volumes), levels, loadImage)).toEqual([]);
        expect(levels.every(level => level.group.children.length == 0 && level.bounds.isEmpty())).toBe(true);
    });

    it("stand where the game stands them, with room made for what stands out of its face", async () => {
        const npc = makeObject("Npc", {x: 12, y: upperFloorY, z: 12}, FLOOR_UP);
        const levels = makeLevels();
        await RoomPreviewObjectUtil.addObjects(new ObjectGroup([npc]), levels, loadImage);

        // Its parts stand on the floor, within its height.
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        for (const mesh of getInstancedMeshes(levels[1]))
        {
            for (let i = 0; i < mesh.count; ++i)
            {
                mesh.getMatrixAt(i, matrix);
                position.setFromMatrixPosition(matrix);
                expect(position.y).toBeGreaterThan(upperFloorY);
                expect(position.y).toBeLessThan(upperFloorY + PLAYER_HEIGHT);
                expect(Math.hypot(position.x - 12, position.z - 12)).toBeLessThan(1);
            }
        }
        expect(levels[1].bounds.min.y).toBeCloseTo(upperFloorY, 6);
        expect(levels[1].bounds.max.y).toBeCloseTo(upperFloorY + PLAYER_HEIGHT, 6);
        expect(levels[0].bounds.isEmpty()).toBe(true);
    });

    it("show their pictures over their faces, turned as they are", async () => {
        // An everyday object lying on the floor, a world unit by half of one, turned a quarter.
        const turns = 1;
        const prop = makeObject("Prop", {x: 10, y: 0, z: 10}, FLOOR_UP, {x: 0.5, y: 1, z: 1}, {
            [ObjectMetadataKeyEnumMap.ImagePath]: FIXTURE_PICTURES.wide,
            [ObjectMetadataKeyEnumMap.QuarterTurns]: QuarterTurnsUtil.encode(turns),
        });
        const levels = makeLevels();
        const materials = await RoomPreviewObjectUtil.addObjects(new ObjectGroup([prop]), levels, loadImage);

        const [picture] = getPictureMeshes(levels[0]);
        expect(getPictureMeshes(levels[0]).length).toBe(1);
        expect(materials).toEqual([picture.material]);
        expect((picture.material as THREE.MeshPhongMaterial).map).toBe(textureByPath[FIXTURE_PICTURES.wide]);

        // Just over the floor, covering the object's footprint. (As level as the game's own quads lie on a floor:
        // see Geometry3DUtil.getFacingBasis.)
        const corners = toQuads(picture.geometry.getAttribute("position").array as Float32Array)[0];
        for (const corner of corners)
            expect(corner.y).toBeCloseTo(FRAMED_PANEL_BOARD_RELIEF + FRAMED_PANEL_CONTENT_LIFT, 3);
        const box = new THREE.Box3().setFromPoints(corners);
        expect(box.getSize(new THREE.Vector3()).x).toBeCloseTo(0.5, 3);
        expect(box.getSize(new THREE.Vector3()).z).toBeCloseTo(1, 3);
        expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(10, 3);
        expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(10, 3);

        // The whole image, each corner showing what the game's own turn has it show.
        const uv = picture.geometry.getAttribute("uv");
        [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], i) => {
            const turned = getTurnedUV(turns, new THREE.Vector2(u, v), new THREE.Vector2());
            expect(uv.getX(i)).toBeCloseTo(turned.x, 6);
            expect(uv.getY(i)).toBeCloseTo(turned.y, 6);
        });
        const normal = new THREE.Vector3().fromBufferAttribute(picture.geometry.getAttribute("normal"), 0);
        expect(normal.distanceTo(new THREE.Vector3(0, 1, 0))).toBeCloseTo(0, 6);
    });

    it("fit a painting inside its canvas's frame, and show the placeholder for an image that can't be had", async () => {
        const painting = {[ObjectMetadataKeyEnumMap.ImagePath]: FIXTURE_PICTURES.painting};
        const canvas = makeObject("Canvas", {x: 10, y: 2, z: farWallZ}, {x: 0, y: 0, z: -1}, {x: 2, y: 2, z: 1}, painting);
        const levels = makeLevels();
        await RoomPreviewObjectUtil.addObjects(new ObjectGroup([canvas]), levels, loadImage);

        // Within the canvas, in the painting's own shape (4 by 3), just in front of the wall.
        const [picture] = getPictureMeshes(levels[0]);
        const box = new THREE.Box3().setFromPoints(toQuads(picture.geometry.getAttribute("position").array as Float32Array)[0]);
        const size = box.getSize(new THREE.Vector3());
        expect(size.x).toBeLessThan(2);
        expect(size.x).toBeGreaterThan(1);
        expect(size.x / size.y).toBeCloseTo(4 / 3, 6);
        expect(box.max.z).toBeLessThan(farWallZ);
        expect(box.max.z).toBeGreaterThan(farWallZ - 0.1);
        expect(getNumInstances(levels[0])).toBe(getNumParts(canvas)); // its frame

        const unloaded = makeLevels();
        const [material] = await RoomPreviewObjectUtil.addObjects(new ObjectGroup([canvas]), unloaded, async () => undefined);
        expect((material as THREE.MeshPhongMaterial).map).toBeNull();
        expect(getPictureMeshes(unloaded[0]).length).toBe(1);
    });

    it("draw the pictures of one image as one mesh a level, in one material", async () => {
        const makeProp = (x: number, y: number, imagePath?: string) => makeObject("Prop", {x, y, z: 10}, FLOOR_UP, UNIT_VEC3,
            imagePath ? {[ObjectMetadataKeyEnumMap.ImagePath]: imagePath} : {});
        const levels = makeLevels();
        const materials = await RoomPreviewObjectUtil.addObjects(new ObjectGroup([
            makeProp(6, 0, FIXTURE_PICTURES.wide), makeProp(8, 0, FIXTURE_PICTURES.square), makeProp(10, 0, FIXTURE_PICTURES.wide),
            makeProp(12, 0), makeProp(14, 0, FIXTURE_PICTURES.wide), makeProp(16, 0),
            makeProp(6, upperFloorY, FIXTURE_PICTURES.wide),
        ]), levels, loadImage);

        // Where along x the quads of the one mesh showing an image (or the placeholder) are.
        const getQuadXs = (level: RoomPreviewLevel, imagePath?: string) => {
            const meshes = getPictureMeshes(level).filter(mesh =>
                (mesh.material as THREE.MeshPhongMaterial).map == (imagePath ? textureByPath[imagePath] : null));
            expect(meshes.length).toBe(1);
            return toQuads(meshes[0].geometry.getAttribute("position").array as Float32Array)
                .map(quad => Math.round(getMiddle(quad).x)).sort((a, b) => a - b);
        };
        expect(getPictureMeshes(levels[0]).length).toBe(3);
        expect(getQuadXs(levels[0], FIXTURE_PICTURES.wide)).toEqual([6, 10, 14]);
        expect(getQuadXs(levels[0], FIXTURE_PICTURES.square)).toEqual([8]);
        expect(getQuadXs(levels[0])).toEqual([12, 16]);
        expect(getPictureMeshes(levels[1]).length).toBe(1);
        expect(getQuadXs(levels[1], FIXTURE_PICTURES.wide)).toEqual([6]);

        // The same material for an image on both levels, and no material that draws nothing.
        const materialsUsed = new Set(levels.flatMap(level => getPictureMeshes(level).map(mesh => mesh.material)));
        expect(materialsUsed.size).toBe(3);
        expect(new Set(materials)).toEqual(materialsUsed);
    });
});

describe("a mesh for a scene that isn't the game's", () => {
    it("is two triangles a quad, facing the way its corners turn", () => {
        const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, /**/ 2, 0, 0, 3, 0, 0, 3, 1, 0, 2, 1, 0]);
        const normals = new Float32Array(24).fill(0).map((_, i) => (i % 3 == 2) ? 1 : 0);
        const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]);
        const material = new THREE.MeshBasicMaterial();
        const mesh = MeshFactory.createDetachedQuadMesh(positions, normals, uvs, material);

        expect(Array.from(mesh.geometry.getIndex()!.array)).toEqual([0, 1, 2, 2, 3, 0, 4, 5, 6, 6, 7, 4]);
        expect(mesh.geometry.getAttribute("position").count).toBe(8);
        expect(mesh.geometry.getAttribute("uv").count).toBe(8);
        expect(mesh.material).toBe(material);
        // Each triangle turns counter-clockwise about +z, which its corners were given to face.
        const index = mesh.geometry.getIndex()!;
        const corner = (i: number) => new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute("position"), index.getX(i));
        for (let triangle = 0; triangle < 4; ++triangle)
        {
            const [a, b, c] = [0, 1, 2].map(i => corner(3 * triangle + i));
            expect(b.sub(a).cross(c.sub(a)).z).toBeGreaterThan(0);
        }

        expect(MeshFactory.createDetachedQuadMesh(positions, normals, undefined, material).geometry.getAttribute("uv"))
            .toBeUndefined();
    });

    it("is set up as a registered instanced mesh is, and registered nowhere", async () => {
        addedToScene.length = 0;
        const mesh = await MeshFactory.createDetachedInstancedMesh("Box", MaterialParamsMap.getParamsById(INSTANCED_COLOR_MATERIAL_ID), 5);
        expect(mesh.count).toBe(5);
        expect(mesh.geometry.getAttribute("uvStart").count).toBe(5);
        expect(mesh.geometry.getAttribute("uvSampleSize").count).toBe(5);
        expect(MeshFactory.getMeshes()).not.toContain(mesh);
        expect(addedToScene).toEqual([]);

        // Its geometry is its own, so disposing of it leaves the next one's alone.
        const other = await MeshFactory.createDetachedInstancedMesh("Box", MaterialParamsMap.getParamsById(INSTANCED_COLOR_MATERIAL_ID), 1);
        expect(other.geometry).not.toBe(mesh.geometry);
        expect(other.material).toBe(mesh.material);
    });
});

describe("a draw the room's lamps don't light", () => {
    it("reads no lamp light while it runs, and leaves the room's as it was, even if it throws", () => {
        const shader = {uniforms: {} as {[name: string]: {value: unknown}}};
        LightBlockMapMaterialUtil.bindColorUniform(shader as unknown as THREE.WebGLProgramParametersWithUniforms);
        const uniform = shader.uniforms.lightBlockMapColor;
        const unlit = uniform.value;

        const roomColor = new THREE.Data3DTexture(new Uint8Array(4), 1, 1, 1);
        const roomFlux = new THREE.Data3DTexture(new Uint8Array(4), 1, 1, 1);
        LightBlockMapMaterialUtil.setTextures(roomColor, roomFlux);
        expect(uniform.value).toBe(roomColor);
        expect(LightBlockMapMaterialUtil.drawWithoutLamps(() => uniform.value)).toBe(unlit);
        expect(uniform.value).toBe(roomColor);

        expect(() => LightBlockMapMaterialUtil.drawWithoutLamps(() => { throw new Error("no draw"); })).toThrow("no draw");
        expect(uniform.value).toBe(roomColor);
    });
});
