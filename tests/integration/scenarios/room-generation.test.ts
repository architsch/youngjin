/**
 * Room generation (see @docs/geometry/room_generation.md): every room the server makes is born empty, with its
 * room-level parameters decided. Checked here: the shape of a generated room, its one door, what it is finished
 * in, that Hub and Regular rooms come out alike and the same every time, and the curated palettes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import RoomGenerationUtil from "../../../src/shared/room/util/roomGenerationUtil";
import RoomPaletteMap from "../../../src/shared/room/maps/roomPaletteMap";
import RoomPrefsUtil from "../../../src/shared/room/util/roomPrefsUtil";
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import { RoomType, RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import ImageMapUtil from "../../../src/shared/graphics/image/util/imageMapUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectAttachmentUtil from "../../../src/shared/object/util/objectAttachmentUtil";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import RestrictedZoneUtil from "../../../src/shared/voxel/util/restrictedZoneUtil";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import DoorObjectTypeConfig, { ENTRANCE_DOOR_OBJECT_ID } from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { DoorTypeEnumMap } from "../../../src/shared/object/types/doorType";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, GENERATED_WALL_THICKNESS, HUB_ROOM_ID_KEYWORD,
    INITIAL_MULTI_PLAYER_ENTRANCE_POS, NUM_COLLISION_LAYERS_PER_STOREY, NUM_PACK_VOXEL_TEXTURES, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS, STOREY_FLOOR_COLLISION_LAYER } from "../../../src/shared/system/sharedConstants";

const GENERATED_ROOM_TYPES: {name: string, roomType: RoomType}[] = [
    {name: "Hub", roomType: RoomTypeEnumMap.Hub},
    {name: "Regular", roomType: RoomTypeEnumMap.Regular},
];

const DOOR_OBJECT_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Door");

function generate(roomType: RoomType): Room
{
    const room = RoomGenerationUtil.generateRoom("Room", roomType, "owner", "Owner");
    room.id = "generated";
    for (const obj of Object.values(room.objectById))
        obj.roomID = room.id;
    return room;
}

function isInsideBoundaryWall(row: number, col: number): boolean
{
    return row >= GENERATED_WALL_THICKNESS && row < NUM_VOXEL_ROWS - GENERATED_WALL_THICKNESS &&
        col >= GENERATED_WALL_THICKNESS && col < NUM_VOXEL_COLS - GENERATED_WALL_THICKNESS;
}

// Whether a layer is one a storey's open space spans, rather than the slab between them or the one over both.
function isStoreyLayer(layer: number): boolean
{
    return layer < COLLISION_LAYER_MIN + NUM_COLLISION_LAYERS_PER_STOREY ||
        (layer > STOREY_FLOOR_COLLISION_LAYER && layer <= STOREY_FLOOR_COLLISION_LAYER + NUM_COLLISION_LAYERS_PER_STOREY);
}

function encodeVoxelGrid(voxelGrid: VoxelGrid): string
{
    const bufferState = EncodingUtil.startEncoding();
    voxelGrid.encode(bufferState);
    return Buffer.from(EncodingUtil.endEncoding(bufferState)).toString("base64");
}

function texturesUsedIn(voxelGrid: VoxelGrid): Set<number>
{
    const textures = new Set<number>();
    for (const quad of voxelGrid.quadsMem.quads)
        textures.add(quad & 0b01111111);
    return textures;
}

describe("every generated room", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    for (const {name, roomType} of GENERATED_ROOM_TYPES)
    {
        it(`${name}: is empty — two storeys standing open from wall to wall, with the slab between them`, () => {
            const voxels = generate(roomType).voxelGrid.voxels;
            for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
            {
                for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                {
                    for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
                    {
                        const open = isInsideBoundaryWall(row, col) && isStoreyLayer(layer);
                        expect(VoxelQueryUtil.isVoxelBlockPresentAt(voxels, row, col, layer),
                            `(${row}, ${col}, ${layer})`).toBe(!open);
                    }
                }
            }
        });

        it(`${name}: has storeys of the same height, the upper one a layer short of the room's ceiling`, () => {
            const voxels = generate(roomType).voxelGrid.voxels;
            const openLayers: number[] = [];
            for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
            {
                if (!VoxelQueryUtil.isVoxelBlockPresentAt(voxels, GENERATED_WALL_THICKNESS, GENERATED_WALL_THICKNESS, layer))
                    openLayers.push(layer);
            }
            expect(openLayers).toHaveLength(2 * NUM_COLLISION_LAYERS_PER_STOREY);
            expect(openLayers).not.toContain(STOREY_FLOOR_COLLISION_LAYER);
            expect(openLayers).not.toContain(COLLISION_LAYER_MAX);
        });

        it(`${name}: comes with its own way in and nothing else — the entrance door, where it can hang`, () => {
            const room = generate(roomType);
            const objects = Object.values(room.objectById);
            expect(objects).toHaveLength(1);

            const door = objects[0];
            expect(door.objectId).toBe(ENTRANCE_DOOR_OBJECT_ID);
            expect(door.objectTypeIndex).toBe(DOOR_OBJECT_TYPE_INDEX);
            expect(door.transform.pos.x).toBe(INITIAL_MULTI_PLAYER_ENTRANCE_POS.x);
            expect(door.transform.pos.z).toBe(INITIAL_MULTI_PLAYER_ENTRANCE_POS.z);
            // The room's default way in, leading out to the hubs.
            expect(DoorObjectTypeConfig.util.getDoorType(door)).toBe(DoorTypeEnumMap.DefaultEntrance);
            expect(DoorObjectTypeConfig.util.getDestinationRoomId(door)).toBe(HUB_ROOM_ID_KEYWORD);

            // The wall behind it stands as deep as a door needs, and the floor in front of it is clear.
            PhysicsManager.load(new RoomRuntimeMemory(room, {}));
            try
            {
                expect(ObjectAttachmentUtil.canPlaceObject(room, door.objectId, door.objectTypeIndex, door.transform))
                    .toBe(true);
            }
            finally
            {
                PhysicsManager.unload(room.id);
            }
        });

        it(`${name}: is handed over plain — one texture of a real pack throughout, default atmosphere, no zones`, () => {
            const room = generate(roomType);
            expect(ImageMapUtil.getImageMap("VoxelTexturePackImageMap").hasImagePath(room.texturePackPath)).toBe(true);
            expect(texturesUsedIn(room.voxelGrid).size).toBe(1);
            expect(room.prefs).toBe(RoomPrefsUtil.getDefaultPrefsString());
            expect(Object.values(room.objectById).filter(RestrictedZoneUtil.isZone)).toHaveLength(0);
        });

        it(`${name}: is the same room every time`, () => {
            const first = generate(roomType);
            const second = generate(roomType);
            expect(encodeVoxelGrid(second.voxelGrid)).toBe(encodeVoxelGrid(first.voxelGrid));
            expect(second.texturePackPath).toBe(first.texturePackPath);
        });
    }

    it("is the same room whether it is made a Hub or a Regular room", () => {
        const hub = generate(RoomTypeEnumMap.Hub);
        const regular = generate(RoomTypeEnumMap.Regular);
        expect(encodeVoxelGrid(regular.voxelGrid)).toBe(encodeVoxelGrid(hub.voxelGrid));
        expect(regular.texturePackPath).toBe(hub.texturePackPath);
        expect(regular.prefs).toBe(hub.prefs);
    });

    it("keeps the identity of a room whose content is generated over", () => {
        const room = generate(RoomTypeEnumMap.Regular);
        room.roomName = "Mine";
        room.prefs = "kept";
        RoomGenerationUtil.generateRoomContent(room);

        expect(room.id).toBe("generated");
        expect(room.roomName).toBe("Mine");
        expect(room.ownerUserID).toBe("owner");
        expect(room.prefs).toBe("kept");
        expect(Object.keys(room.objectById)).toEqual([ENTRANCE_DOOR_OBJECT_ID]);
    });
});

describe("the curated room palettes", () => {
    it("are kept for texture packs the game has, and for no other", () => {
        const texturePackMap = ImageMapUtil.getImageMap("VoxelTexturePackImageMap");
        for (const texturePackPath of RoomPaletteMap.getTexturePackPaths())
            expect(texturePackMap.hasImagePath(texturePackPath), texturePackPath).toBe(true);
        expect(RoomPaletteMap.getPalettes("no-such-pack")).toEqual([]);
    });

    it("name only textures a pack's own image holds", () => {
        for (const texturePackPath of RoomPaletteMap.getTexturePackPaths())
        {
            const palettes = RoomPaletteMap.getPalettes(texturePackPath);
            expect(palettes.length, texturePackPath).toBeGreaterThan(0);
            for (const palette of palettes)
            {
                for (const textureIndex of [palette.floor, palette.ceiling, palette.wall, palette.prop])
                {
                    expect(Number.isInteger(textureIndex)).toBe(true);
                    expect(textureIndex).toBeGreaterThanOrEqual(0);
                    expect(textureIndex).toBeLessThan(NUM_PACK_VOXEL_TEXTURES);
                }
            }
        }
    });
});
