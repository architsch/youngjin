/**
 * Scenario tests: procedural multiplayer room generation
 *
 * Every Hub/Regular room the server creates is laid out procedurally from a seed. That makes the
 * room's shape unknowable in advance, so what is asserted here is the set of properties every
 * generated room has to have no matter which seed produced it:
 *
 * - the whole room is walkable from the entrance (no region is ever sealed off)
 * - the entrance itself is open, and the floor in front of it is left clear
 * - the boundary wall is intact apart from the entrance
 * - the paintings it is generated with are legal placements the room would accept at runtime
 * - it is built in one of the texture packs its textures were picked against
 * - a seed reproduces its room exactly, and different seeds give different rooms
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import ProceduralRoomGenerationUtil from "../../../src/shared/room/util/proceduralRoomGenerationUtil";
import RoomGenerationUtil from "../../../src/shared/room/util/roomGenerationUtil";
import RoomGenerationPaletteMap from "../../../src/shared/room/maps/roomGenerationPaletteMap";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import WallAttachedObjectUtil from "../../../src/shared/object/util/wallAttachedObjectUtil";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ImageMapUtil from "../../../src/shared/graphics/image/util/imageMapUtil";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import { UserRoleEnumMap } from "../../../src/shared/user/types/userRole";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import {
    MAX_CANVASES_PER_ROOM, MULTI_PLAYER_ENTRANCE_VOXEL_COL, MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
    NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
} from "../../../src/shared/system/sharedConstants";

// A handful of unrelated seeds, so that a property asserted below is not one that happens to
// hold for a single layout.
const SEEDS = [1, 2, 3, 91, 4242, 104729, 999983, 1234567];

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

// The collision layers a standing player occupies. A cell is walkable when all of them are free.
const PLAYER_LAYER_MASK = 0b00011111;

function isWalkable(voxelGrid: VoxelGrid, row: number, col: number): boolean
{
    const voxel = VoxelQueryUtil.getVoxel(voxelGrid.voxels, row, col);
    return !!voxel && (voxel.collisionLayerMask & PLAYER_LAYER_MASK) == 0;
}

/** Every cell reachable on foot from the entrance. */
function floodFillFromEntrance(voxelGrid: VoxelGrid): Set<number>
{
    const reached = new Set<number>();
    const pending = [MULTI_PLAYER_ENTRANCE_VOXEL_ROW * NUM_VOXEL_COLS + MULTI_PLAYER_ENTRANCE_VOXEL_COL];
    while (pending.length > 0)
    {
        const index = pending.pop()!;
        if (reached.has(index))
            continue;
        reached.add(index);

        const row = Math.floor(index / NUM_VOXEL_COLS);
        const col = index % NUM_VOXEL_COLS;
        for (const [rowStep, colStep] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        {
            const nextRow = row + rowStep;
            const nextCol = col + colStep;
            if (isWalkable(voxelGrid, nextRow, nextCol))
                pending.push(nextRow * NUM_VOXEL_COLS + nextCol);
        }
    }
    return reached;
}

function countWalkableCells(voxelGrid: VoxelGrid): number
{
    let count = 0;
    for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
    {
        for (let col = 0; col < NUM_VOXEL_COLS; ++col)
        {
            if (isWalkable(voxelGrid, row, col))
                ++count;
        }
    }
    return count;
}

function encodeVoxelGrid(voxelGrid: VoxelGrid): string
{
    const bufferState = EncodingUtil.startEncoding();
    voxelGrid.encode(bufferState);
    return new Uint8Array(EncodingUtil.endEncoding(bufferState)).join(",");
}

/** A room generated from one specific seed, so that a property can be asserted over many of them. */
function generateFromSeed(seed: number): Room
{
    const room = new Room(`generated-${seed}`, "", RoomTypeEnumMap.Hub, "", "", "",
        VoxelGrid.createEmpty(), new ObjectGroup([]));
    ProceduralRoomGenerationUtil.generateMultiplayerRoom(room, seed);
    return room;
}

describe("procedural multiplayer room generation", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("leaves every part of the room reachable on foot from the entrance", () => {
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);
            const reachable = floodFillFromEntrance(voxelGrid);
            const walkable = countWalkableCells(voxelGrid);

            expect(walkable, `seed ${seed}`).toBeGreaterThan(0);
            expect(reachable.size, `seed ${seed} :: some of the room is walled off`).toBe(walkable);
        }
    });

    it("opens the entrance and keeps the floor in front of it clear", () => {
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);

            // The doorway itself, carved through the boundary wall a player arrives through.
            expect(isWalkable(voxelGrid, MULTI_PLAYER_ENTRANCE_VOXEL_ROW, MULTI_PLAYER_ENTRANCE_VOXEL_COL),
                `seed ${seed} :: the entrance is walled up`).toBe(true);

            // The approach a player walks in along. These are the cells room editing protects
            // from being built on, so nothing generated may stand in them either.
            for (let row = MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 2; row < MULTI_PLAYER_ENTRANCE_VOXEL_ROW; ++row)
            {
                for (let col = MULTI_PLAYER_ENTRANCE_VOXEL_COL - 1; col <= MULTI_PLAYER_ENTRANCE_VOXEL_COL + 1; ++col)
                {
                    expect(isWalkable(voxelGrid, row, col), `seed ${seed} :: (${row},${col}) is blocked`).toBe(true);
                }
            }
        }
    });

    it("keeps the boundary wall solid apart from the entrance", () => {
        for (const seed of SEEDS)
        {
            const {voxelGrid} = generateFromSeed(seed);

            for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
            {
                for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                {
                    const onBoundary = row == 0 || col == 0 ||
                        row == NUM_VOXEL_ROWS - 1 || col == NUM_VOXEL_COLS - 1;
                    const isEntrance = row == MULTI_PLAYER_ENTRANCE_VOXEL_ROW &&
                        col == MULTI_PLAYER_ENTRANCE_VOXEL_COL;
                    if (!onBoundary || isEntrance)
                        continue;
                    expect(isWalkable(voxelGrid, row, col), `seed ${seed} :: (${row},${col}) is not solid`).toBe(false);
                }
            }
        }
    });

    it("hangs paintings the live room would accept, within the room's canvas limit", () => {
        for (const seed of SEEDS)
        {
            const room = generateFromSeed(seed);
            const roomID = room.id;
            const canvases = Object.values(room.objectById);

            expect(canvases.length, `seed ${seed}`).toBeGreaterThan(0);
            expect(canvases.length, `seed ${seed}`).toBeLessThanOrEqual(MAX_CANVASES_PER_ROOM);

            // Start the room empty and add the paintings back one at a time through the same
            // path a live room uses, so that each is validated against the ones already up.
            room.objectGroup.objectById = {};
            if (PhysicsManager.hasRoom(roomID))
                PhysicsManager.unload(roomID);
            PhysicsManager.load(new RoomRuntimeMemory(room, {}));

            const user = new User("user", "User", UserTypeEnumMap.Member, "", "");
            for (const canvas of canvases)
            {
                expect(canvas.objectTypeIndex, `seed ${seed}`).toBe(canvasTypeIndex);

                const imagePath = canvas.metadata[ObjectMetadataKeyEnumMap.ImagePath];
                const frameCoords = canvas.metadata[ObjectMetadataKeyEnumMap.CanvasFrameCoords];
                expect(ImageMapUtil.getImageMap("CanvasImageMap").hasImagePath(imagePath.str)).toBe(true);
                expect(ImageMapUtil.getImageMap("CanvasFrameImageMap").hasImagePath(frameCoords.str)).toBe(true);

                const placeable = WallAttachedObjectUtil.canPlaceObject(room, canvas.objectId,
                    canvas.objectTypeIndex, canvas.transform.pos, canvas.transform.dir);
                expect(placeable,
                    `seed ${seed} :: ${canvas.objectId} is not a placeable wall attachment`).toBe(true);

                canvas.roomID = roomID;
                ObjectUpdateUtil.addObject(user, UserRoleEnumMap.Owner, room, canvas, false);
            }
            PhysicsManager.unload(roomID);
        }
    });

    it("builds the room in a texture pack whose palettes it drew from", () => {
        // A room's textures are cell positions within one specific pack's atlas, so a room that
        // came out in a pack nothing was picked against would be finished at random.
        const packsUsed = new Set<string>();
        for (const seed of SEEDS)
        {
            const room = generateFromSeed(seed);
            expect(RoomGenerationPaletteMap.getPalettes(room.texturePackPath).length,
                `seed ${seed} :: generated in "${room.texturePackPath}", which has no palettes`)
                .toBeGreaterThan(0);
            packsUsed.add(room.texturePackPath);
        }
        // ...and the pack is genuinely drawn, rather than every room landing on the same one.
        expect(packsUsed.size).toBeGreaterThan(1);
    });

    it("keeps every palette within the reach of a texture pack atlas", () => {
        // The voxel texture pack atlas is a square grid of cells, and a quad's texture is an index
        // into it — so a palette naming a cell past the end of the grid renders as nothing.
        const NUM_TEXTURES_PER_PACK = 64;
        for (const texturePackPath of RoomGenerationPaletteMap.getTexturePackPaths())
        {
            const palettes = RoomGenerationPaletteMap.getPalettes(texturePackPath);
            expect(palettes.length, texturePackPath).toBeGreaterThan(0);
            for (const palette of palettes)
            {
                for (const textureIndex of Object.values(palette))
                {
                    expect(textureIndex, `${texturePackPath} :: texture ${textureIndex}`)
                        .toBeGreaterThanOrEqual(0);
                    expect(textureIndex, `${texturePackPath} :: texture ${textureIndex}`)
                        .toBeLessThan(NUM_TEXTURES_PER_PACK);
                }
            }
        }
    });

    it("rebuilds the same room from the same seed, and a different one from a different seed", () => {
        const first = generateFromSeed(SEEDS[0]);
        const again = generateFromSeed(SEEDS[0]);
        const other = generateFromSeed(SEEDS[1]);

        expect(encodeVoxelGrid(again.voxelGrid)).toBe(encodeVoxelGrid(first.voxelGrid));
        expect(Object.keys(again.objectById)).toEqual(Object.keys(first.objectById));
        expect(again.texturePackPath).toBe(first.texturePackPath);
        expect(encodeVoxelGrid(other.voxelGrid)).not.toBe(encodeVoxelGrid(first.voxelGrid));
    });

    it("is what the room generator builds Hub and Regular rooms with", () => {
        for (const roomType of [RoomTypeEnumMap.Hub, RoomTypeEnumMap.Regular])
        {
            const room = RoomGenerationUtil.generateRoom("", roomType);

            // A bare room would have neither interior walls nor paintings in it.
            expect(Object.keys(room.objectById).length).toBeGreaterThan(0);
            expect(countWalkableCells(room.voxelGrid)).toBeLessThan((NUM_VOXEL_ROWS - 2) * (NUM_VOXEL_COLS - 2));
            expect(floodFillFromEntrance(room.voxelGrid).size).toBe(countWalkableCells(room.voxelGrid));

            // The room carries the texture pack its contents were picked against, so that the
            // room it is saved as looks like the room that was generated.
            expect(RoomGenerationPaletteMap.getPalettes(room.texturePackPath).length).toBeGreaterThan(0);
        }
    });
});
