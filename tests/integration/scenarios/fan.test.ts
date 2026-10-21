/**
 * Scenario tests: fans (furniture anyone may install, as lamps are) — permissions and the per-category cap, the
 * one size on every kind of face, the stored setting (one, two or three blades, each with its strength and its
 * range), the stored color (any of tin's colors, which a player's are; a mid grey by default) painting the housing
 * and tinting the wind, as many blades as it has turning at one steady rate and one wind effect as long as the
 * range, and the
 * push itself through the real physics engine: a force along the facing, as hard as its strength makes it,
 * thinning out to the end of its range and where a body runs out of room, on a body by as much of it as the stream
 * reaches (in full from half), stopped by a block only where the block lies across the stream, read from the room
 * as it stands; the velocity a body is given and keeps until gravity and drag have taken it away; and a fan blowing
 * upward making up for gravity without switching it off, so that a player over one bounces and goes on bouncing.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, EMPTY_REGULAR, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ObjectCategoryConfigMap from "../../../src/shared/object/maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectMetadataEntryMap from "../../../src/shared/object/maps/objectMetadataEntryMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import FanObjectTypeConfig, { FAN_COLOR_PALETTE_NAME,
    FAN_SETTINGS } from "../../../src/shared/object/types/objectTypeConfig/fanObjectTypeConfig";
import ObjectCompositionUtil from "../../../src/shared/object/util/objectCompositionUtil";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import ObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/objectTypeConfig";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { ObjectMetadata } from "../../../src/shared/object/types/objectMetadata";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import Room from "../../../src/shared/room/types/room";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import Vec3 from "../../../src/shared/math/types/vec3";
import StringUtil from "../../../src/shared/math/util/stringUtil";
import WaveformUtil from "../../../src/shared/math/util/waveformUtil";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import PreEncodedCompositionIndexMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import { COLLISION_LAYER_HEIGHT, COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID, GRAVITY_SPEED,
    INITIAL_MULTI_PLAYER_ENTRANCE_POS, INSTANCED_TIN_MATERIAL_ID,
    MAX_ROOM_Y, RELIEF_STEP, STOREY_FLOOR_COLLISION_LAYER, UNIT_VEC3,
    VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
// The fan's housing is decoded from its pre-encoded entry, which needs the part builders registered.
import "../../../src/shared/graphics/mesh/composition/instancedMeshCompositionBuilderMapDependencies";

const fanTypeIndex = ObjectTypeConfigMap.getIndexByType("Fan");
const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
const MAX_FANS_PER_ROOM = ObjectCategoryConfigMap.getMaxCountPerRoom(FanObjectTypeConfig.category);
const FORCE = FanObjectTypeConfig.force;
const UTIL = FanObjectTypeConfig.util;
const FORCE_KEY = ObjectMetadataKeyEnumMap.ForceProperties;
const COLOR_KEY = ObjectMetadataKeyEnumMap.FanColor;
const WEAKEST = FAN_SETTINGS[0], STRONGEST = FAN_SETTINGS[FAN_SETTINGS.length - 1];
// What a fan that stores nothing reads as.
const DEFAULT = UTIL.getSetting({});
const NUM_FAN_COLORS = ColorUtil.getPaletteSize(FAN_COLOR_PALETTE_NAME);

type FanSetting = (typeof FAN_SETTINGS)[number];

function makeUser(id: string, userType: number): User
{
    return new User(id, `User_${id}`, userType, `${id}@test.com`, "");
}

const ADMIN = makeUser("an-admin", UserTypeEnumMap.Admin);
const MEMBER = makeUser("a-member", UserTypeEnumMap.Member);
const GUEST = makeUser("a-guest", UserTypeEnumMap.Guest);

// On the boundary wall, clear of the room's door, a block's height off the floor; on the room's floor; and on its
// ceiling.
const WALL_FACING: Vec3 = {x: 0, y: 0, z: -1};
const WALL_SPOT: Vec3 = {x: INITIAL_MULTI_PLAYER_ENTRANCE_POS.x - 5, y: 1.5, z: INITIAL_MULTI_PLAYER_ENTRANCE_POS.z};
const FLOOR_FACING: Vec3 = {x: 0, y: 1, z: 0};
const FLOOR_SPOT: Vec3 = {x: 8.5, y: 0, z: 8.5};
const CEILING_FACING: Vec3 = {x: 0, y: -1, z: 0};
const CEILING_SPOT: Vec3 = {x: 8.5, y: MAX_ROOM_Y, z: 8.5};

const STANDING_Y = 0.5 * PLAYER_HEIGHT;

// The slab between the room's two storeys: its underside, and its top, which is the upper storey's floor.
const SLAB_UNDERSIDE_Y = STOREY_FLOOR_COLLISION_LAYER * COLLISION_LAYER_HEIGHT;
const SLAB_TOP_Y = SLAB_UNDERSIDE_Y + COLLISION_LAYER_HEIGHT;

// A frame, and a step short enough that the speed a force adds over it, divided by it, is the force itself.
const FRAME = 1 / 60;
const AN_INSTANT = 0.00000001;
// As fast as a player walks.
const WALKING_SPEED = 5.4;
// An upward speed for a body to be carrying where gravity's pull on what it carries is to show.
const RISING = 10;

function windOf(setting: FanSetting): ObjectMetadata
{
    return {[FORCE_KEY]: new EncodableByteString(UTIL.encodeForceProperties(setting))};
}

function colorOf(colorIndex: number): ObjectMetadata
{
    return {[COLOR_KEY]: new EncodableByteString(UTIL.encodeColor(colorIndex))};
}

function bladesOf(setting: FanSetting): string
{
    return `${setting.blades} blades`;
}

function makeFanSignal(room: Room, sourceUser: User, objectId: string = "new-fan", pos: Vec3 = WALL_SPOT,
    dir: Vec3 = WALL_FACING, metadata: ObjectMetadata = {}): AddObjectSignal
{
    return new AddObjectSignal(room.id, sourceUser.id, sourceUser.userName, fanTypeIndex, objectId,
        new ObjectTransform({...pos}, {...dir}, {...UNIT_VEC3}), metadata);
}

// A fan with only its metadata to speak of, for what is read from the setting alone.
function fanWith(metadata: ObjectMetadata): AddObjectSignal
{
    return new AddObjectSignal("room", "user", "User", fanTypeIndex, "fan",
        new ObjectTransform({x: 1, y: 1, z: 1}, {...WALL_FACING}, {...UNIT_VEC3}), metadata);
}

function fanComponents(): NonNullable<ObjectTypeConfig["components"]["spawnedByAny"]>
{
    return FanObjectTypeConfig.components.spawnedByAny;
}

function still(): Vec3
{
    return {x: 0, y: 0, z: 0};
}

function standingAt(pos: Vec3): ObjectTransform
{
    return new ObjectTransform({...pos}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3});
}

// A real player collider carrying nothing, put down wherever a test wants it (its middle at pos).
function putBody(room: Room, objectId: string, pos: Vec3): void
{
    if (PhysicsManager.hasObject(room.id, objectId))
        PhysicsManager.removeObject(room.id, objectId);
    PhysicsManager.addObject(room.id, objectId, playerTypeIndex,
        PhysicsColliderStateUtil.getObjectColliderState(playerTypeIndex, standingAt(pos))!);
}

// The same body set down elsewhere, with whatever velocity the room's forces have given it.
function moveBody(room: Room, objectId: string, pos: Vec3): void
{
    PhysicsManager.setObjectTransform(room.id, objectId, standingAt(pos), true);
}

// The velocity the room's forces have given a body and it still carries.
function carriedBy(room: Room, objectId: string): Vec3
{
    return PhysicsManager.physicsRooms[room.id].objectById[objectId].carriedVelocity;
}

// How the room's forces change, in a second, the velocity a body there carries: one at rest, or one already rising
// so fast, on which gravity's pull shows as well.
function accelerationOn(room: Room, pos: Vec3, rising: number = 0): Vec3
{
    putBody(room, "body", pos);
    PhysicsManager.physicsRooms[room.id].objectById["body"].carriedVelocity = {x: 0, y: rising, z: 0};
    const carried = PhysicsManager.applyForces(room.id, "body", still(), AN_INSTANT);
    return {x: carried.x / AN_INSTANT, y: (carried.y - rising) / AN_INSTANT, z: carried.z / AN_INSTANT};
}

// How hard the room's fans push a body at rest there along the wall fan's facing (out of the wall).
function pushOutOfWall(room: Room, pos: Vec3): number
{
    return 0 - accelerationOn(room, pos).z;
}

// One step of a body as a Rigidbody moves its object: gravity, what it overlaps, the room's forces, and then the
// move through the real collisions. Returns where its middle ends up.
function step(room: Room, objectId: string, pos: Vec3, steering: Vec3 = still(), deltaTime: number = FRAME): Vec3
{
    const velocity = PhysicsManager.getStepVelocity(room.id, objectId, steering, deltaTime).velocity;
    return PhysicsManager.setObjectTransform(room.id, objectId, standingAt({x: pos.x + velocity.x * deltaTime,
        y: pos.y + velocity.y * deltaTime, z: pos.z + velocity.z * deltaTime}), false).transform.pos;
}

// Standing in front of the wall fan, the near side of the body so far from the fan's face.
function inFrontOfWallFan(distance: number, sideways: number = 0, y: number = STANDING_Y): Vec3
{
    return {x: WALL_SPOT.x + sideways, y, z: WALL_SPOT.z - distance - PLAYER_RADIUS_XZ};
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("fan permissions", () => {
    it("lets anybody install a fan, in a hub or in somebody else's room", async () => {
        await runScenario({
            name: "installing a fan",
            rooms: [EMPTY_HUB, EMPTY_REGULAR],
            users: [userAtCenter("hub"), userAtCenter("regular")],
            assertions: () => {
                for (const roomId of ["hub", "regular"])
                {
                    const room = ServerRoomManager.roomRuntimeMemories[roomId].room;
                    for (const user of [ADMIN, MEMBER, GUEST])
                    {
                        expect(ObjectUpdateUtil.canAddObject(user, room, makeFanSignal(room, user)),
                            `${user.userName} in the ${roomId}`).toBe(true);
                    }
                    // Under somebody else's name, nobody does.
                    expect(ObjectUpdateUtil.canAddObject(MEMBER, room, makeFanSignal(room, GUEST))).toBe(false);
                }
            },
        });
    });

    it("goes on a wall, a floor or a ceiling, always one world unit square", async () => {
        await runScenario({
            name: "a fan on every kind of face",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const spots: [string, Vec3, Vec3][] = [["wall", WALL_SPOT, WALL_FACING],
                    ["floor", FLOOR_SPOT, FLOOR_FACING], ["ceiling", CEILING_SPOT, CEILING_FACING]];
                for (const [name, pos, dir] of spots)
                {
                    const signal = makeFanSignal(room, MEMBER, `fan-on-the-${name}`, pos, dir);
                    // Whatever size it is asked at, it is the one it has.
                    signal.transform.scale = {x: 3, y: 0.5, z: 2};
                    expect(ObjectUpdateUtil.addObject(MEMBER, room, signal), name).toBe(true);
                    expect(ObjectScaleUtil.getObjectSize(fanTypeIndex, room.objectById[signal.objectId].transform.scale))
                        .toMatchObject({x: 1, y: 1});
                }

                // In mid-air it has nothing to be mounted on.
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room, makeFanSignal(room, MEMBER, "floating",
                    {x: 8.5, y: 2, z: 8.5}, FLOOR_FACING))).toBe(false);
            },
        });
    });

    it("has no other size to take, by a handle or by a signal", async () => {
        expect("scaling" in FanObjectTypeConfig).toBe(false);
        expect(ObjectScaleUtil.sanitize(fanTypeIndex, {x: 3, y: 0.5, z: 2})).toEqual(UNIT_VEC3);

        await runScenario({
            name: "resizing a fan",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                expect(ObjectUpdateUtil.addObject(MEMBER, room, makeFanSignal(room, MEMBER, "fan"))).toBe(true);
                const resized = new SetObjectTransformSignal(room.id, "fan",
                    new ObjectTransform({...WALL_SPOT}, {...WALL_FACING}, {x: 2, y: 2, z: 1}), true);
                expect(ObjectUpdateUtil.setObjectTransform(MEMBER, room, resized).transform.scale).toEqual(UNIT_VEC3);

                // Moved as a placement only (see LampObjectTypeConfig): it never travels under physics.
                const pushed = new SetObjectTransformSignal(room.id, "fan",
                    new ObjectTransform({...WALL_SPOT, x: WALL_SPOT.x - 2}, {...WALL_FACING}, {...UNIT_VEC3}), false);
                expect(ObjectUpdateUtil.canSetObjectTransform(MEMBER, room, pushed)).toBe(false);
                pushed.ignorePhysics = true;
                expect(ObjectUpdateUtil.canSetObjectTransform(MEMBER, room, pushed)).toBe(true);
            },
        });
    });

    it("refuses a fan once the room holds as many as its category may, whoever asks", async () => {
        await runScenario({
            name: "the fan cap",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                // Written straight into the room, where nothing checks where they hang.
                for (let i = 0; i < MAX_FANS_PER_ROOM; ++i)
                    room.objectGroup.addObject(makeFanSignal(room, ADMIN, `fan-${i}`, {...WALL_SPOT, x: -10 - i}));
                for (const user of [MEMBER, ADMIN])
                    expect(ObjectUpdateUtil.canAddObject(user, room, makeFanSignal(room, user, "one-too-many"))).toBe(false);

                // The cap is the fans' own: a lamp still goes up where the fan could not.
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room, new AddObjectSignal(room.id, MEMBER.id,
                    MEMBER.userName, lampTypeIndex, "a-lamp",
                    new ObjectTransform({...WALL_SPOT, y: 2.25}, {...WALL_FACING}, {...UNIT_VEC3})))).toBe(true);

                room.objectGroup.removeObject("fan-0");
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room, makeFanSignal(room, MEMBER, "room-for-one"))).toBe(true);
            },
        });
    });

    it("lets anybody change its wind and its color, and nothing else about it", async () => {
        await runScenario({
            name: "editing a fan",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                expect(ObjectUpdateUtil.addObject(MEMBER, room, makeFanSignal(room, MEMBER, "fan"))).toBe(true);
                const canSet = (key: number, value: string) => ObjectUpdateUtil.canSetObjectMetadata(GUEST, room,
                    new SetObjectMetadataSignal(room.id, "fan", key, value));

                expect(canSet(FORCE_KEY, UTIL.encodeForceProperties(STRONGEST))).toBe(true);
                expect(canSet(COLOR_KEY, UTIL.encodeColor(NUM_FAN_COLORS - 1))).toBe(true);
                for (const key of [ObjectMetadataKeyEnumMap.InstancedMeshComposition, ObjectMetadataKeyEnumMap.ImagePath,
                    ObjectMetadataKeyEnumMap.LightProperties, ObjectMetadataKeyEnumMap.Label])
                {
                    expect(canSet(key, "!!"), `key ${key}`).toBe(false);
                }

                // Each stored as what it reads as, whatever was sent, and neither touching the other.
                for (const key of [FORCE_KEY, COLOR_KEY])
                {
                    expect(ObjectUpdateUtil.setObjectMetadata(GUEST, room,
                        new SetObjectMetadataSignal(room.id, "fan", key, "~~~~")), `key ${key}`).toBe(true);
                }
                const stored = room.objectById["fan"].metadata;
                expect(stored[FORCE_KEY].str).toBe(UTIL.encodeForceProperties(STRONGEST));
                expect(stored[COLOR_KEY].str).toBe(UTIL.encodeColor(NUM_FAN_COLORS - 1));
                expect(ObjectUpdateUtil.canRemoveObject(GUEST, room, new RemoveObjectSignal(room.id, "fan"))).toBe(true);
            },
        });
    });
});

describe("a fan's setting", () => {
    it("offers one, two or three blades, the more of them the stronger and the farther its wind", () => {
        expect(FAN_SETTINGS).toEqual([
            {blades: 1, strength: 3, range: 3},
            {blades: 2, strength: 5, range: 5},
            {blades: 3, strength: 7, range: 7},
        ]);
        // An ordinary one is the middle one.
        expect(DEFAULT).toBe(FAN_SETTINGS[1]);
    });

    it("comes back exactly as it was set", () => {
        for (const setting of FAN_SETTINGS)
            expect(UTIL.getSetting(windOf(setting))).toBe(setting);
    });

    it("pushes by the square of its strength, and as far as its range", () => {
        const strongestPush = FORCE.getAcceleration(windOf(STRONGEST), CEILING_FACING);
        expect(strongestPush).toBeGreaterThan(0);
        for (const setting of FAN_SETTINGS)
        {
            const metadata = windOf(setting);
            expect(FORCE.getAcceleration(metadata, CEILING_FACING), bladesOf(setting))
                .toBeCloseTo(strongestPush * (setting.strength / STRONGEST.strength) ** 2, 9);
            expect(FORCE.getRange(metadata)).toBe(setting.range);
        }
    });

    it("pushes harder across the room than up or down, and up at least as hard as down, by the same many times at any setting", () => {
        const shareOfDown = (metadata: ObjectMetadata, facing: Vec3) =>
            FORCE.getAcceleration(metadata, facing) / FORCE.getAcceleration(metadata, CEILING_FACING);
        const upShare = shareOfDown(windOf(STRONGEST), FLOOR_FACING);
        const sidewaysShare = shareOfDown(windOf(STRONGEST), WALL_FACING);
        expect(upShare).toBeGreaterThanOrEqual(1);
        expect(sidewaysShare).toBeGreaterThan(upShare);
        const acrossTheRoom: Vec3[] = [{x: 1, y: 0, z: 0}, {x: -1, y: 0, z: 0}, {x: 0, y: 0, z: 1}, WALL_FACING];
        for (const setting of FAN_SETTINGS)
        {
            expect(shareOfDown(windOf(setting), FLOOR_FACING), bladesOf(setting)).toBeCloseTo(upShare, 9);
            for (const facing of acrossTheRoom)
                expect(shareOfDown(windOf(setting), facing), bladesOf(setting)).toBeCloseTo(sidewaysShare, 9);
        }
    });

    it("reads as one of its settings whatever is stored, and is stored as it reads", () => {
        fc.assert(fc.property(fc.string({maxLength: 6}), (raw) => {
            const canonical = ObjectMetadataEntryMap.preprocess(FORCE_KEY, raw);
            const setting = UTIL.getSetting({[FORCE_KEY]: new EncodableByteString(canonical)});
            expect(FAN_SETTINGS).toContain(setting);
            expect(canonical).toBe(UTIL.encodeForceProperties(setting));
            expect(ObjectMetadataEntryMap.preprocess(FORCE_KEY, canonical)).toBe(canonical);
        }));

        // A fan that stores nothing is an ordinary one.
        expect(UTIL.getSetting({[FORCE_KEY]: new EncodableByteString(UTIL.getDefaultForceProperties())}))
            .toBe(DEFAULT);

        // Any other strength stored is the setting whose strength is nearest it (the weaker of two as near), and
        // nothing after it counts.
        const storing = (...numbers: number[]) => UTIL.getSetting({[FORCE_KEY]: new EncodableByteString(
            numbers.map(StringUtil.convertRawNumberToVisibleASCII).join(""))});
        expect(storing(0)).toBe(WEAKEST);
        expect(storing(1)).toBe(WEAKEST);
        expect(storing(4)).toBe(WEAKEST);
        expect(storing(6)).toBe(FAN_SETTINGS[1]);
        expect(storing(8)).toBe(STRONGEST);
        expect(storing(93)).toBe(STRONGEST);
        expect(storing(1, 9)).toBe(WEAKEST);
        expect(storing(9, 1)).toBe(STRONGEST);
    });

    it("takes one shape only: its housing, which is never stored", () => {
        expect(PreEncodedCompositionIndexMap.Fan).toHaveLength(1);
        const {parts} = fanComponents().instancedMeshComposer!.generateDefaultParts(fanWith({}));
        expect(parts).toHaveLength(1);
        expect(parts[0]).toMatchObject({geometryId: "Box", materialId: INSTANCED_TIN_MATERIAL_ID});
        expect(parts[0].scale).toMatchObject({x: 1, y: 1});
    });

    it("is drawn a relief step short of its footprint's edges, so its sides never share a block face's plane", () => {
        fc.assert(fc.property(fc.integer({min: 0, max: NUM_FAN_COLORS - 1}), fc.constantFrom(...FAN_SETTINGS),
            (colorIndex, setting) => {
                const fan = fanWith({...colorOf(colorIndex), ...windOf(setting)});
                const footprint = ObjectScaleUtil.getObjectSize(fanTypeIndex, fan.transform.scale);
                const stored = fanComponents().instancedMeshComposer!.generateDefaultParts(fan).parts[0];
                const parts: InstancedMeshCompositionPart[] = [];
                ObjectCompositionUtil.decode(fan, {}, parts);
                expect(parts[0].scale.x).toBeCloseTo(footprint.x - 2 * RELIEF_STEP, 9);
                expect(parts[0].scale.y).toBeCloseTo(footprint.y - 2 * RELIEF_STEP, 9);
                // Still half sunk in its face, as stored.
                expect(parts[0].scale.z).toBe(stored.scale.z);
                expect(parts[0].offset).toEqual(stored.offset);

                // Deriving again changes nothing.
                const derived = {...parts[0].scale};
                ObjectCompositionUtil.deriveParts(fan, parts);
                expect(parts[0].scale).toEqual(derived);
            }));
    });
});

describe("a fan's color", () => {
    const colorIndices = fc.integer({min: 0, max: NUM_FAN_COLORS - 1});

    // The housing as whatever draws the fan composes it: the game and the room preview alike.
    function housingOf(metadata: ObjectMetadata): InstancedMeshCompositionPart
    {
        const parts: InstancedMeshCompositionPart[] = [];
        ObjectCompositionUtil.decode(fanWith(metadata), {}, parts);
        expect(parts).toHaveLength(1);
        return parts[0];
    }

    // What the fan's ParticleEmitter is told about its wind.
    function windShownBy(metadata: ObjectMetadata)
    {
        return fanComponents().particleEmitter!.getOverride!(metadata)!;
    }

    it("is any of tin's colors, which a player's parts come in, and comes back exactly as it was set", () => {
        expect(FAN_COLOR_PALETTE_NAME).toBe(COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID[INSTANCED_TIN_MATERIAL_ID]);
        expect(FAN_COLOR_PALETTE_NAME).toBe("Player");
        fc.assert(fc.property(colorIndices, (colorIndex) => {
            expect(UTIL.getColorIndex(colorOf(colorIndex))).toBe(colorIndex);
        }));
    });

    it("is a mid grey where none is stored, as a new fan stores it", () => {
        expect(ColorUtil.rgbToHex(housingOf({}).color!)).toBe("#979797");
        expect(UTIL.getColorIndex({[COLOR_KEY]: new EncodableByteString(UTIL.getDefaultColor())}))
            .toBe(UTIL.getColorIndex({}));
    });

    it("reads as one of those colors whatever is stored, and is stored as it reads", () => {
        fc.assert(fc.property(fc.string({maxLength: 6}), (raw) => {
            const canonical = ObjectMetadataEntryMap.preprocess(COLOR_KEY, raw);
            const colorIndex = UTIL.getColorIndex({[COLOR_KEY]: new EncodableByteString(canonical)});
            expect(colorIndex).toBeGreaterThanOrEqual(0);
            expect(colorIndex).toBeLessThan(NUM_FAN_COLORS);
            expect(canonical).toBe(UTIL.encodeColor(colorIndex));
            expect(ObjectMetadataEntryMap.preprocess(COLOR_KEY, canonical)).toBe(canonical);
        }));

        // A position past the palette is its last color, and nothing after the first character counts.
        const storing = (...numbers: number[]) => UTIL.getColorIndex({[COLOR_KEY]: new EncodableByteString(
            numbers.map(StringUtil.convertRawNumberToVisibleASCII).join(""))});
        expect(storing(93)).toBe(NUM_FAN_COLORS - 1);
        expect(storing(5, 9)).toBe(5);
    });

    it("paints the housing in it at any setting, the setting reading as it was", () => {
        fc.assert(fc.property(colorIndices, fc.constantFrom(...FAN_SETTINGS), (colorIndex, setting) => {
            const metadata = {...colorOf(colorIndex), ...windOf(setting)};
            const housing = housingOf(metadata);
            expect(housing.materialId).toBe(INSTANCED_TIN_MATERIAL_ID);
            expect(housing.color).toEqual(ColorUtil.paletteIndexToRGB(FAN_COLOR_PALETTE_NAME, colorIndex));
            expect(UTIL.getSetting(metadata)).toBe(setting);
        }));
    });

    it("tints the wind in it too at any setting, and changes nothing else about the wind", () => {
        fc.assert(fc.property(colorIndices, fc.constantFrom(...FAN_SETTINGS), (colorIndex, setting) => {
            const {tint, ...rest} = windShownBy({...colorOf(colorIndex), ...windOf(setting)});
            const {tint: _, ...uncolored} = windShownBy(windOf(setting));
            expect(tint).toBe(ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(FAN_COLOR_PALETTE_NAME, colorIndex)));
            expect(rest).toEqual(uncolored);
        }));
    });
});

describe("what a fan shows of its wind", () => {
    // The blades as the fan's AnimatedSprite shows them at a setting.
    function bladesShownAt(setting: FanSetting)
    {
        const sprite = fanComponents().animatedSprite!;
        return {...sprite.baseline, ...sprite.getOverride!(windOf(setting))};
    }

    it("turns as many blades as it is set to have, all at one steady rate whatever the setting", () => {
        const turnsPerSecond = WaveformUtil.getLevel(bladesShownAt(DEFAULT).rate!, 0);
        expect(turnsPerSecond).toBeGreaterThan(0);
        for (const setting of FAN_SETTINGS)
        {
            const shown = bladesShownAt(setting);
            expect(shown.sprite).toBe("fanBlades");
            expect(shown.centers, bladesOf(setting)).toHaveLength(setting.blades);
            for (const time of [0, 0.37, 12, 4000])
                expect(WaveformUtil.getLevel(shown.rate!, time), bladesOf(setting)).toBeCloseTo(turnsPerSecond, 9);
        }
    });

    it("sets its blades round the middle of its plate, each wholly on it and clear of the others, one size at any setting", () => {
        // A lone one in the middle.
        const lone = bladesShownAt(WEAKEST);
        expect(lone.centers).toEqual([{x: 0, y: 0}]);
        for (const setting of FAN_SETTINGS)
        {
            const {centers, widthScale, heightScale} = bladesShownAt(setting);
            // Round, as their vents are, and as large however many there are.
            expect(widthScale, bladesOf(setting)).toBe(heightScale);
            expect(widthScale, bladesOf(setting)).toBe(lone.widthScale);
            const radius = 0.5 * widthScale!;
            for (const [i, center] of centers!.entries())
            {
                expect(Math.abs(center.x) + radius, bladesOf(setting)).toBeLessThan(0.5);
                expect(Math.abs(center.y) + radius, bladesOf(setting)).toBeLessThan(0.5);
                for (const other of centers!.slice(i + 1))
                    expect(Math.hypot(center.x - other.x, center.y - other.y), bladesOf(setting)).toBeGreaterThan(2 * radius);
            }
            // As far out on one side as on the other, across and up.
            const xs = centers!.map(center => center.x), ys = centers!.map(center => center.y);
            expect(Math.min(...xs) + Math.max(...xs), bladesOf(setting)).toBeCloseTo(0, 9);
            expect(Math.min(...ys) + Math.max(...ys), bladesOf(setting)).toBeCloseTo(0, 9);
        }
    });

    it("lets out one wind, as long as its push reaches, and ended by a block in its way", () => {
        for (const setting of FAN_SETTINGS)
        {
            const metadata = windOf(setting);
            const override = fanComponents().particleEmitter!.getOverride!(metadata)!;
            expect(override.reach, bladesOf(setting)).toBe(FORCE.getRange(metadata));
            // Steady: nothing about it rises and falls.
            expect(override.level).toBeUndefined();
        }
        expect(fanComponents().particleEmitter!.baseline.stopAtBlocks).toBe(true);
        expect(fanComponents().particleEmitter!.baseline.level).toBeUndefined();
    });

    it("lets out the same puffs at any setting, going faster and closer together the stronger it is, never far from the default", () => {
        const puffsOf = (setting: FanSetting) => {
            const override = fanComponents().particleEmitter!.getOverride!(windOf(setting))!;
            // How far they go is the range's alone (see ParticleEmitter's reach), how they look the effect's in the
            // wind's color, and where they start the middle of the fan's face, however many blades it has.
            expect(Object.keys(override).sort()).toEqual(["particleTimeScale", "rateScale", "reach", "tint"]);
            // How close behind each other they come: as many more a second as they go faster gives none closer.
            return {pace: override.particleTimeScale!, closeness: override.rateScale! / override.particleTimeScale!};
        };
        expect(puffsOf(DEFAULT)).toEqual({pace: 1, closeness: 1});
        for (let i = 1; i < FAN_SETTINGS.length; ++i)
        {
            const weaker = puffsOf(FAN_SETTINGS[i - 1]), stronger = puffsOf(FAN_SETTINGS[i]);
            expect(stronger.pace, bladesOf(FAN_SETTINGS[i])).toBeGreaterThan(weaker.pace);
            expect(stronger.closeness, bladesOf(FAN_SETTINGS[i])).toBeGreaterThan(weaker.closeness);
        }

        // Neither end extreme: the weakest's puffs still drifting along, and a stream at either end neither bare
        // nor packed.
        const weakest = puffsOf(WEAKEST), strongest = puffsOf(STRONGEST);
        expect(weakest.pace).toBeGreaterThanOrEqual(0.4);
        expect(strongest.pace).toBeLessThanOrEqual(2);
        expect(weakest.closeness).toBeGreaterThan(0.6);
        expect(strongest.closeness).toBeLessThan(1.4);
    });
});

describe("a fan's push", () => {
    const PUSH = FORCE.getAcceleration(windOf(DEFAULT), WALL_FACING);
    // A hair: less than anything measured here, more than what rounding leaves.
    const HAIR = 0.001;

    function addWallFan(room: Room, objectId: string = "wall-fan", setting: FanSetting = DEFAULT): void
    {
        expect(ObjectUpdateUtil.addObject(MEMBER, room, makeFanSignal(room, MEMBER, objectId, WALL_SPOT, WALL_FACING,
            windOf(setting)))).toBe(true);
    }

    function setWind(room: Room, objectId: string, setting: FanSetting): void
    {
        expect(ObjectUpdateUtil.setObjectMetadata(GUEST, room, new SetObjectMetadataSignal(room.id, objectId, FORCE_KEY,
            UTIL.encodeForceProperties(setting)))).toBe(true);
    }

    // How hard the wall fan itself pushes, that far down its stream, at a setting.
    function pushAt(setting: FanSetting, distance: number): number
    {
        return FORCE.getAcceleration(windOf(setting), WALL_FACING) * (1 - distance / setting.range);
    }

    it("speeds a body up along its facing, as hard at its face as its strength makes it", async () => {
        await runScenario({
            name: "pushed by a wall fan",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const atTheFace = inFrontOfWallFan(0);
                // Before there is a fan, nothing moves a body at rest, or changes how one moves.
                expect(accelerationOn(room, atTheFace)).toEqual({x: 0, y: 0, z: 0});
                expect(PhysicsManager.applyForces(room.id, "body", {x: 1, y: -2, z: 4}, FRAME)).toEqual({x: 1, y: -2, z: 4});
                addWallFan(room);

                const push = accelerationOn(room, atTheFace);
                expect(push.x).toBeCloseTo(0, 6);
                expect(push.y).toBeCloseTo(0, 6);
                expect(push.z).toBeCloseTo(-PUSH, 3);

                for (const setting of FAN_SETTINGS)
                {
                    setWind(room, "wall-fan", setting);
                    expect(pushOutOfWall(room, atTheFace) / pushAt(setting, 0), bladesOf(setting)).toBeCloseTo(1, 5);
                }

                // What it gives a body comes on top of however the body is moving, not in its place.
                setWind(room, "wall-fan", DEFAULT);
                putBody(room, "body", atTheFace);
                const pushed = PhysicsManager.applyForces(room.id, "body", {x: 1, y: -2, z: 4}, FRAME);
                expect(pushed).toMatchObject({x: 1, y: -2});
                expect(pushed.z).toBeLessThan(4);
                expect(pushed.z).toBeGreaterThan(4 - PUSH * FRAME - HAIR);

                // A step of no length is no step.
                putBody(room, "body", atTheFace);
                expect(PhysicsManager.applyForces(room.id, "body", {x: 1, y: -2, z: 4}, 0)).toEqual({x: 1, y: -2, z: 4});
                expect(carriedBy(room, "body")).toEqual({x: 0, y: 0, z: 0});
            },
        });
    });

    it("never pulls: with no strength or no range to its push, it does nothing at all", async () => {
        await runScenario({
            name: "a wall fan with no wind to speak of",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addWallFan(room);
                expect(pushOutOfWall(room, inFrontOfWallFan(0))).toBeCloseTo(PUSH, 3);

                const RANGE = DEFAULT.range;
                for (const [acceleration, range] of [[-PUSH, RANGE], [0, RANGE], [PUSH, 0], [PUSH, -RANGE]])
                {
                    const getAcceleration = vi.spyOn(FORCE, "getAcceleration").mockReturnValue(acceleration);
                    const getRange = vi.spyOn(FORCE, "getRange").mockReturnValue(range);
                    try
                    {
                        expect(accelerationOn(room, inFrontOfWallFan(0)), `${acceleration} over ${range}`)
                            .toEqual({x: 0, y: 0, z: 0});
                    }
                    finally
                    {
                        getAcceleration.mockRestore();
                        getRange.mockRestore();
                    }
                }
            },
        });
    });

    it("thins out evenly to nothing at the end of its range, at every setting, and reaches nothing behind it", async () => {
        await runScenario({
            name: "the reach of a wall fan",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addWallFan(room);
                const pushAfter = (distance: number) => pushOutOfWall(room, inFrontOfWallFan(distance));

                for (const setting of FAN_SETTINGS)
                {
                    setWind(room, "wall-fan", setting);
                    const {range} = setting, push = pushAt(setting, 0);
                    expect(pushAfter(0), bladesOf(setting)).toBeCloseTo(push, 3);
                    for (const share of [0.25, 0.5, 0.75, 0.96])
                        expect(pushAfter(share * range), bladesOf(setting)).toBeCloseTo((1 - share) * push, 3);
                    expect(pushAfter(range - 0.01)).toBeGreaterThan(0);
                    expect(pushAfter(range)).toBeCloseTo(0, 6);
                    expect(pushAfter(range + 0.01)).toBe(0);
                    expect(pushAfter(range + 3)).toBe(0);
                }
                setWind(room, "wall-fan", DEFAULT);

                // A second fan on a wall one block thick, standing free: whoever is on the wall's other side is
                // behind its face.
                const row = 20, cols = [20, 21], layers = [2, 3];
                for (const col of cols)
                {
                    for (const layer of layers)
                    {
                        expect(VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels,
                            VoxelQueryUtil.getVoxelQuadIndex(row, col, "x", "+", layer))).toBe(true);
                    }
                }
                const thinWallSpot: Vec3 = {x: cols[1] * VOXEL_CELL_SIZE, y: layers[1] * VOXEL_CELL_SIZE,
                    z: row * VOXEL_CELL_SIZE};
                expect(ObjectUpdateUtil.addObject(MEMBER, room, makeFanSignal(room, MEMBER, "thin-wall-fan",
                    thinWallSpot, WALL_FACING, windOf(DEFAULT)))).toBe(true);
                const besideThinWall = (z: number): Vec3 => ({x: thinWallSpot.x, y: STANDING_Y, z});
                const front = thinWallSpot.z - PLAYER_RADIUS_XZ, back = thinWallSpot.z + VOXEL_CELL_SIZE + PLAYER_RADIUS_XZ;
                expect(pushOutOfWall(room, besideThinWall(front))).toBeCloseTo(PUSH, 3);
                expect(pushOutOfWall(room, besideThinWall(back))).toBe(0);
                expect(pushOutOfWall(room, besideThinWall(back + 2))).toBe(0);
            },
        });
    });

    it("pushes a body by as much of it as its stream reaches, across it and up it: in full from half of the most it could", async () => {
        await runScenario({
            name: "the width of a wall fan's stream",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addWallFan(room);
                const pushBeside = (sideways: number, y: number = STANDING_Y) =>
                    pushOutOfWall(room, inFrontOfWallFan(0, sideways, y));

                // The stream is the fan's own unit square; a player is narrower than it and taller. The most of a
                // player it could reach across is all of the player's width.
                const halfStream = 0.5, halfBody = PLAYER_RADIUS_XZ;
                expect(pushBeside(0)).toBeCloseTo(PUSH, 3);
                for (const side of [1, -1])
                {
                    expect(pushBeside(side * (halfStream - halfBody))).toBeCloseTo(PUSH, 3); // wholly in it
                    expect(pushBeside(side * halfStream)).toBeCloseTo(PUSH, 3); // half in it
                    // Less in it, by as much less, to nothing at its edge.
                    expect(pushBeside(side * (halfStream + HAIR))).toBeLessThan(PUSH);
                    for (const out of [HAIR, 0.25 * halfBody, 0.5 * halfBody, 0.75 * halfBody, halfBody - HAIR])
                        expect(pushBeside(side * (halfStream + out)), `${side * out}`).toBeCloseTo(PUSH * (1 - out / halfBody), 3);
                    expect(pushBeside(side * (halfStream + halfBody - HAIR))).toBeGreaterThan(0);
                    expect(pushBeside(side * (halfStream + halfBody + HAIR))).toBe(0); // beside it
                    expect(pushBeside(side * (halfStream + halfBody + 1))).toBe(0);
                }

                // Up the wall: a second fan whose square begins where a standing player's head ends. The most of it
                // a player could take is all of its height.
                const highSpot: Vec3 = {x: WALL_SPOT.x - 2, y: PLAYER_HEIGHT + 0.5, z: WALL_SPOT.z};
                expect(ObjectUpdateUtil.addObject(MEMBER, room, makeFanSignal(room, MEMBER, "high-fan", highSpot,
                    WALL_FACING, windOf(DEFAULT)))).toBe(true);
                const pushUnderHighFan = (feetOffTheFloor: number, sideways: number = 0) =>
                    pushBeside(highSpot.x - WALL_SPOT.x + sideways, STANDING_Y + feetOffTheFloor);
                expect(pushUnderHighFan(0)).toBe(0);
                expect(pushUnderHighFan(HAIR)).toBeGreaterThan(0);
                expect(pushUnderHighFan(0.25)).toBeCloseTo(0.5 * PUSH, 3);
                expect(pushUnderHighFan(0.5)).toBeCloseTo(PUSH, 3);
                expect(pushUnderHighFan(1)).toBeCloseTo(PUSH, 3);

                // By how much of the body it reaches, not by each way apart: half in it across and half up it, a
                // body is a quarter in it, and pushed by half.
                expect(pushUnderHighFan(0.5, halfStream)).toBeCloseTo(0.5 * PUSH, 3);
                expect(pushUnderHighFan(0.5, -halfStream)).toBeCloseTo(0.5 * PUSH, 3);
            },
        });
    });

    it("is stopped by a block only where the block lies across it, so a body behind one is pushed by what gets past", async () => {
        await runScenario({
            name: "blocks in a wall fan's stream",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addWallFan(room, "wall-fan", STRONGEST);
                // Blocks four units out. A body before them, with room enough that nothing eases its push, or just
                // behind them; how much of the push it takes, of what it would there with nothing in the way.
                const blockDistance = 4;
                const before = blockDistance - 2 * PLAYER_RADIUS_XZ - 1.5, behind = blockDistance + VOXEL_CELL_SIZE + 0.05;
                const shareOf = (pos: Vec3, distance: number) => pushOutOfWall(room, pos) / pushAt(STRONGEST, distance);
                const shareAt = (distance: number, sideways: number = 0) =>
                    shareOf(inFrontOfWallFan(distance, sideways), distance);
                const halfBody = PLAYER_RADIUS_XZ;

                // The fan's square covers two cells across, its middle where they meet, and two layers up.
                const row = VoxelQueryUtil.getVoxelRowFromWorldZ(WALL_SPOT.z - blockDistance - 0.5 * VOXEL_CELL_SIZE);
                const plusX = VoxelQueryUtil.getVoxelColFromWorldX(WALL_SPOT.x + 0.25), minusX = plusX - 1;
                const lower = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(WALL_SPOT.y - 0.25), upper = lower + 1;
                expect(minusX).toBe(VoxelQueryUtil.getVoxelColFromWorldX(WALL_SPOT.x - 0.25));
                const quadAt = (col: number, layer: number) => VoxelQueryUtil.getVoxelQuadIndex(row, col, "x", "+", layer);
                const fill = (cells: [number, number][]) => {
                    for (const [col, layer] of cells)
                        expect(VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels, quadAt(col, layer))).toBe(true);
                };

                // Across the half of it toward +x: nothing for a body on that side; all for one in the middle (half
                // its width still reached is half of the most) or on the other side; by as much less in between.
                fill([[plusX, lower], [plusX, upper]]);
                expect(pushOutOfWall(room, inFrontOfWallFan(behind, halfBody))).toBe(0);
                expect(shareAt(behind, 0.5 * halfBody)).toBeCloseTo(0.5, 5);
                expect(shareAt(behind, 0)).toBeCloseTo(1, 5);
                expect(shareAt(behind, -halfBody)).toBeCloseTo(1, 5);
                expect(shareAt(behind + 2, 0.5 * halfBody)).toBeCloseTo(0.5, 5);
                // Before them, untouched by them.
                expect(shareAt(before, halfBody)).toBeCloseTo(1, 5);

                // Across three quarters of it: a body in the middle is reached across half its width and up half
                // the stream's height, a quarter of the most, and pushed by half.
                fill([[minusX, upper]]);
                expect(shareAt(behind)).toBeCloseTo(0.5, 5);

                // Across all of it: nothing behind, wherever the body stands, and all of it before.
                fill([[minusX, lower]]);
                for (const sideways of [-halfBody, 0, halfBody])
                    expect(pushOutOfWall(room, inFrontOfWallFan(behind, sideways))).toBe(0);
                expect(shareAt(before)).toBeCloseTo(1, 5);

                // With the blocks gone again, so is their shelter.
                for (const [col, layer] of [[plusX, lower], [plusX, upper], [minusX, lower], [minusX, upper]])
                    expect(VoxelUpdateUtil.removeVoxelBlock(undefined, room.voxelGrid.voxels, quadAt(col, layer))).toBe(true);
                expect(shareAt(behind, halfBody)).toBeCloseTo(1, 5);

                // A second fan, whose middle is in the middle of a cell: blocks across that cell leave only its
                // stream's two edges, half a cell each, to get past, and a body behind them in the middle is reached
                // as far as its own width covers them.
                const offCellSpot: Vec3 = {...WALL_SPOT, x: WALL_SPOT.x - 2 - 0.5 * VOXEL_CELL_SIZE};
                expect(ObjectUpdateUtil.addObject(MEMBER, room, makeFanSignal(room, MEMBER, "off-cell-fan", offCellSpot,
                    WALL_FACING, windOf(STRONGEST)))).toBe(true);
                const middleCol = VoxelQueryUtil.getVoxelColFromWorldX(offCellSpot.x);
                expect((middleCol + 0.5) * VOXEL_CELL_SIZE).toBeCloseTo(offCellSpot.x, 9);
                fill([[middleCol, lower], [middleCol, upper]]);
                const reachedWidth = 2 * (halfBody - 0.5 * VOXEL_CELL_SIZE);
                // Of half the body's width, the most it could be reached across being all of it.
                expect(shareOf(inFrontOfWallFan(behind, offCellSpot.x - WALL_SPOT.x), behind))
                    .toBeCloseTo(reachedWidth / halfBody, 5);
            },
        });
    });

    it("eases off where a body has little room left ahead of it, to nothing against whatever stops it", async () => {
        await runScenario({
            name: "a wall across a wall fan's stream",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addWallFan(room, "wall-fan", STRONGEST);
                // A wall six units out, as wide and as high as would stop a player.
                const wallDistance = 6;
                const row = VoxelQueryUtil.getVoxelRowFromWorldZ(WALL_SPOT.z - wallDistance - 0.5 * VOXEL_CELL_SIZE);
                const middleCol = VoxelQueryUtil.getVoxelColFromWorldX(WALL_SPOT.x);
                for (let col = middleCol - 2; col <= middleCol + 1; ++col)
                {
                    for (let layer = 0; layer < 6; ++layer)
                    {
                        expect(VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels,
                            VoxelQueryUtil.getVoxelQuadIndex(row, col, "x", "+", layer))).toBe(true);
                    }
                }
                // With that much room between the far side of the body and the wall.
                const pushWithRoom = (roomAhead: number) => pushOutOfWall(room,
                    inFrontOfWallFan(wallDistance - roomAhead - 2 * PLAYER_RADIUS_XZ));
                const unhindered = (roomAhead: number) =>
                    pushAt(STRONGEST, wallDistance - roomAhead - 2 * PLAYER_RADIUS_XZ);

                expect(pushWithRoom(3)).toBeCloseTo(unhindered(3), 3);
                expect(pushWithRoom(1.5)).toBeCloseTo(unhindered(1.5), 3);
                const closeIn = pushWithRoom(0.5) / unhindered(0.5);
                expect(closeIn).toBeGreaterThan(0.1);
                expect(closeIn).toBeLessThan(0.9);
                // By as much as the room has shrunk: half of it, half the push.
                expect(pushWithRoom(0.25) / unhindered(0.25)).toBeCloseTo(0.5 * closeIn, 3);
                expect(pushWithRoom(0)).toBeCloseTo(0, 3);

                // Somebody standing just ahead is nothing solid: no room is lost to them.
                putBody(room, "bystander", inFrontOfWallFan(wallDistance - 3 - 2 * PLAYER_RADIUS_XZ + 1.25));
                expect(pushWithRoom(3)).toBeCloseTo(unhindered(3), 3);
            },
        });
    });

    it("gives a body a speed that builds up, and that the body keeps until drag has worn it away", async () => {
        await runScenario({
            name: "carried on from a wall fan",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addWallFan(room, "wall-fan", STRONGEST);
                const atTheFace = inFrontOfWallFan(0), aside = inFrontOfWallFan(0, 3);
                const speedAfter = (deltaTime: number) => 0 - PhysicsManager.applyForces(room.id, "body", still(), deltaTime).z;

                // Held at the fan's face: faster with every frame, by less each time.
                putBody(room, "body", atTheFace);
                const building = Array.from({length: 120}, () => speedAfter(FRAME));
                expect(building[0]).toBeGreaterThan(0);
                expect(building[0]).toBeLessThan(FORCE.getAcceleration(windOf(STRONGEST), WALL_FACING) * FRAME + HAIR);
                for (let i = 1; i < building.length; ++i)
                {
                    expect(building[i]).toBeGreaterThan(building[i - 1]);
                    if (i > 1)
                        expect(building[i] - building[i - 1]).toBeLessThan(building[i - 1] - building[i - 2]);
                }
                expect(building[building.length - 1]).toBeGreaterThan(WALKING_SPEED);
                expect(carriedBy(room, "body").z).toBeCloseTo(-building[building.length - 1], 9);
                // As fast after half a second there whatever the steps it is taken in.
                const builtIn = (deltaTime: number): number => {
                    putBody(room, "body", atTheFace);
                    return Array.from({length: Math.round(0.5 / deltaTime)}, () => speedAfter(deltaTime)).pop()!;
                };
                expect(builtIn(FRAME)).toBeCloseTo(building[29], 9);
                expect(builtIn(0.05)).toBeCloseTo(building[29], 6);
                expect(builtIn(0.5)).toBeCloseTo(building[29], 6);

                // Set down beside the stream after half a second in it: how fast it still goes out from the wall
                // over each step from then on, for five seconds.
                const afterLeaving = (deltaTime: number): {speedOnLeaving: number, speeds: number[]} => {
                    putBody(room, "body", atTheFace);
                    let speedOnLeaving = 0;
                    for (let frame = 0; frame < 30; ++frame)
                        speedOnLeaving = speedAfter(FRAME);
                    moveBody(room, "body", aside);
                    return {speedOnLeaving,
                        speeds: Array.from({length: Math.round(5 / deltaTime)}, () => speedAfter(deltaTime))};
                };
                const {speedOnLeaving, speeds} = afterLeaving(FRAME);
                expect(speeds[0]).toBeGreaterThan(0.5 * speedOnLeaving);
                expect(speeds[0]).toBeLessThan(speedOnLeaving);
                const stopped = speeds.indexOf(0);
                expect(stopped).toBeGreaterThan(10);
                for (let i = 1; i < stopped; ++i)
                    expect(speeds[i]).toBeLessThan(speeds[i - 1]);
                // Once it has worn away it is forgotten, not carried as next to nothing.
                expect(speeds.slice(stopped).every(speed => speed === 0)).toBe(true);
                expect(carriedBy(room, "body")).toEqual({x: 0, y: 0, z: 0});

                // As far whatever the steps it is carried on in.
                const carriedOn = (deltaTime: number) =>
                    afterLeaving(deltaTime).speeds.reduce((sum, speed) => sum + speed * deltaTime, 0);
                expect(carriedOn(FRAME)).toBeGreaterThan(1);
                expect(carriedOn(1 / 240) / carriedOn(FRAME)).toBeGreaterThan(0.95);
                expect(carriedOn(1 / 240) / carriedOn(FRAME)).toBeLessThan(1.05);
                expect(carriedOn(0.05) / carriedOn(FRAME)).toBeGreaterThan(0.9);
                expect(carriedOn(0.05) / carriedOn(FRAME)).toBeLessThan(1.1);
            },
        });
    });

    it("throws a body down its stream and beyond, to slide to a stop: farther the stronger it is", async () => {
        await runScenario({
            name: "thrown by a wall fan",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addWallFan(room);
                // Left at the fan's face, moved through the real physics as a Rigidbody moves its object: how far
                // out the near side of the body is after each frame, for eight seconds.
                const thrown = (setting: FanSetting): number[] => {
                    setWind(room, "wall-fan", setting);
                    let pos = inFrontOfWallFan(0);
                    putBody(room, "thrown", pos);
                    const distances: number[] = [];
                    for (let frame = 0; frame < 480; ++frame)
                    {
                        pos = step(room, "thrown", pos);
                        distances.push(WALL_SPOT.z - pos.z - PLAYER_RADIUS_XZ);
                    }
                    return distances;
                };

                const distances = thrown(DEFAULT);
                for (let i = 1; i < distances.length; ++i)
                    expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1] - 1e-9);
                // Out of the stream by its own speed, and at rest there.
                const rest = distances[distances.length - 1];
                expect(rest).toBeGreaterThan(DEFAULT.range);
                expect(rest - distances[distances.length - 60]).toBeLessThan(HAIR);
                expect(carriedBy(room, "thrown")).toEqual({x: 0, y: 0, z: 0});
                // Smoothly: from nothing, up to more than twice a walk, and down again.
                const speeds = distances.map((distance, i) => (distance - (distances[i - 1] ?? 0)) / FRAME);
                expect(speeds[0]).toBeLessThan(PUSH * FRAME);
                expect(Math.max(...speeds)).toBeGreaterThan(2 * WALKING_SPEED);

                const strongest = thrown(STRONGEST), weakest = thrown(WEAKEST);
                expect(strongest[strongest.length - 1]).toBeGreaterThan(rest + 1);
                expect(weakest[weakest.length - 1]).toBeLessThan(rest);
                expect(weakest[weakest.length - 1]).toBeGreaterThan(WEAKEST.range);
            },
        });
    });

    it("is read from the room as it stands: a new setting, a move and a removal take effect at once", async () => {
        await runScenario({
            name: "editing a fan that pushes",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addWallFan(room);
                const farOutDistance = DEFAULT.range + 1;
                const here = inFrontOfWallFan(0), farOut = inFrontOfWallFan(farOutDistance), aside = inFrontOfWallFan(0, -3);
                const pushOn = (pos: Vec3) => pushOutOfWall(room, pos);
                expect(pushOn(here)).toBeCloseTo(PUSH, 3);
                expect(pushOn(farOut)).toBe(0);
                expect(pushOn(aside)).toBe(0);

                // The strongest and the longest wind in its place: harder here, and now felt out there.
                setWind(room, "wall-fan", STRONGEST);
                expect(pushOn(here) / pushAt(STRONGEST, 0)).toBeCloseTo(1, 5);
                expect(pushOn(farOut) / pushAt(STRONGEST, farOutDistance)).toBeCloseTo(1, 5);

                // Moved three units along its wall, it takes its stream with it.
                ObjectUpdateUtil.setObjectTransform(GUEST, room, new SetObjectTransformSignal(room.id, "wall-fan",
                    new ObjectTransform({...WALL_SPOT, x: WALL_SPOT.x - 3}, {...WALL_FACING}, {...UNIT_VEC3}), true));
                expect(pushOn(here)).toBe(0);
                expect(pushOn(aside) / pushAt(STRONGEST, 0)).toBeCloseTo(1, 5);

                expect(ObjectUpdateUtil.removeObject(GUEST, room, new RemoveObjectSignal(room.id, "wall-fan"))).toBe(true);
                expect(pushOn(aside)).toBe(0);
                expect(PhysicsManager.physicsRooms[room.id].forceEmitterIds.size).toBe(0);
            },
        });
    });

    it("is found again when the room's physics is rebuilt, and two fans push together", async () => {
        await runScenario({
            name: "fans a room is loaded with",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addWallFan(room);
                // A second one on the floor under the first one's stream.
                const floorSpot: Vec3 = {x: WALL_SPOT.x, y: 0, z: WALL_SPOT.z - 1.5};
                expect(ObjectUpdateUtil.addObject(MEMBER, room, makeFanSignal(room, MEMBER, "floor-fan", floorSpot,
                    FLOOR_FACING, windOf(STRONGEST)))).toBe(true);

                PhysicsManager.unload(room.id);
                PhysicsManager.load(ServerRoomManager.roomRuntimeMemories["hub"]);
                expect([...PhysicsManager.physicsRooms[room.id].forceEmitterIds].sort()).toEqual(["floor-fan", "wall-fan"]);

                // Standing on the floor fan, a unit and an eighth out from the wall fan's face: pushed out from
                // the wall by the one as if the other were not there, and up by the other.
                const standing: Vec3 = {x: floorSpot.x, y: STANDING_Y, z: floorSpot.z};
                const fromWall = WALL_SPOT.z - (standing.z + PLAYER_RADIUS_XZ);
                const pushed = accelerationOn(room, standing, RISING);
                expect(pushed.z).toBeCloseTo(-pushAt(DEFAULT, fromWall), 3);
                expect(pushed.y).toBeGreaterThan(0);
                expect(ObjectUpdateUtil.removeObject(GUEST, room, new RemoveObjectSignal(room.id, "floor-fan"))).toBe(true);
                expect(accelerationOn(room, standing, RISING).z).toBeCloseTo(pushed.z, 6);
            },
        });
    });
});

describe("a fan blowing upward", () => {
    const PUSH = FORCE.getAcceleration(windOf(DEFAULT), FLOOR_FACING), RANGE = DEFAULT.range;
    // The most room a player has over the room's own floor: up against the slab, or against the room's ceiling.
    const HEADROOM_UNDER_SLAB = SLAB_UNDERSIDE_Y - PLAYER_HEIGHT, HEADROOM_UNDER_CEILING = MAX_ROOM_Y - PLAYER_HEIGHT;

    function addFloorFan(room: Room, setting: FanSetting = DEFAULT): void
    {
        expect(ObjectUpdateUtil.addObject(MEMBER, room, makeFanSignal(room, MEMBER, "floor-fan", FLOOR_SPOT,
            FLOOR_FACING, windOf(setting)))).toBe(true);
    }

    function setWind(room: Room, setting: FanSetting): void
    {
        expect(ObjectUpdateUtil.setObjectMetadata(GUEST, room, new SetObjectMetadataSignal(room.id, "floor-fan",
            FORCE_KEY, UTIL.encodeForceProperties(setting)))).toBe(true);
    }

    // Takes the slab between the storeys away over a stretch of the room, so that what is below can go up through.
    function openSlab(room: Room, minX: number, maxX: number, minZ: number, maxZ: number): void
    {
        const inward = 0.001;
        for (let row = VoxelQueryUtil.getVoxelRowFromWorldZ(minZ + inward); row <= VoxelQueryUtil.getVoxelRowFromWorldZ(maxZ - inward); ++row)
        {
            for (let col = VoxelQueryUtil.getVoxelColFromWorldX(minX + inward); col <= VoxelQueryUtil.getVoxelColFromWorldX(maxX - inward); ++col)
            {
                expect(VoxelUpdateUtil.removeVoxelBlock(undefined, room.voxelGrid.voxels, VoxelQueryUtil.getVoxelQuadIndex(
                    row, col, "y", "+", STOREY_FLOOR_COLLISION_LAYER)), `slab at ${row}, ${col}`).toBe(true);
            }
        }
    }

    function openSlabOverFloorFan(room: Room): void
    {
        openSlab(room, FLOOR_SPOT.x - 0.5, FLOOR_SPOT.x + 0.5, FLOOR_SPOT.z - 0.5, FLOOR_SPOT.z + 0.5);
    }

    // Over the floor fan, feet that far above its face.
    function overFloorFan(feet: number, sideways: number = 0): Vec3
    {
        return {x: FLOOR_SPOT.x + sideways, y: feet + STANDING_Y, z: FLOOR_SPOT.z};
    }

    // How fast a rising body there gains or loses speed upward: the fans' lift, less gravity's pull.
    function liftOn(room: Room, pos: Vec3): number
    {
        return accelerationOn(room, pos, RISING).y;
    }

    // How fast gravity takes speed off a rising body: as measured in mid-air, well away from the fan.
    function gravityPullIn(room: Room): number
    {
        return 0 - liftOn(room, {x: FLOOR_SPOT.x + 6, y: STANDING_Y + 0.5, z: FLOOR_SPOT.z});
    }

    // A body left alone from standing on the floor fan, moved through the real physics as a Rigidbody moves its
    // object: how high its feet are after each step.
    function heightsOver(room: Room, seconds: number, deltaTime: number = FRAME): number[]
    {
        let pos = overFloorFan(0);
        putBody(room, "rider", pos);
        const heights: number[] = [];
        for (let steps = Math.round(seconds / deltaTime); steps > 0; --steps)
        {
            pos = step(room, "rider", pos, still(), deltaTime);
            heights.push(pos.y - STANDING_Y);
        }
        return heights;
    }

    // The lowest and the highest it was over a stretch of those steps, and how many times it turned back down.
    function bounceIn(heights: number[], fromSecond: number, toSecond: number, deltaTime: number = FRAME)
        : {low: number, high: number, turns: number}
    {
        const stretch = heights.slice(Math.round(fromSecond / deltaTime), Math.round(toSecond / deltaTime));
        let turns = 0;
        for (let i = 2; i < stretch.length; ++i)
        {
            if (stretch[i - 1] > stretch[i - 2] && stretch[i] <= stretch[i - 1])
                ++turns;
        }
        return {low: Math.min(...stretch), high: Math.max(...stretch), turns};
    }

    it("leaves gravity on: a body is pulled down by it wherever it is, and is never stopped dead in the air", async () => {
        await runScenario({
            name: "gravity over a floor fan",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addFloorFan(room);
                openSlabOverFloorFan(room);
                const farAway: Vec3 = {x: FLOOR_SPOT.x + 6, y: STANDING_Y + 0.5, z: FLOOR_SPOT.z};

                // What a body carries upward, gravity takes away at one steady rate, wherever the body is: past
                // the end of a stream (one short enough to end below the ceiling) as well as away from it.
                const pull = gravityPullIn(room);
                expect(pull).toBeGreaterThan(GRAVITY_SPEED);
                setWind(room, WEAKEST);
                expect(liftOn(room, overFloorFan(WEAKEST.range + 0.2))).toBeCloseTo(-pull, 3);
                setWind(room, DEFAULT);
                expect(liftOn(room, {...farAway, y: farAway.y - 0.25})).toBeCloseTo(-pull, 3);
                // One that carries nothing has nothing more to lose: it falls as fast as ever, and no faster.
                expect(accelerationOn(room, farAway)).toEqual({x: 0, y: 0, z: 0});

                // Falling through the stream, a body goes on falling: slowed, not caught.
                const falling = overFloorFan(0.9 * RANGE);
                putBody(room, "faller", falling);
                const landed = step(room, "faller", falling);
                expect(landed.y).toBeLessThan(falling.y - 0.5 * GRAVITY_SPEED * FRAME);
                let pos = landed, fastestFall = 0, lowest = Infinity;
                for (let frame = 0; frame < 600; ++frame)
                {
                    const next = step(room, "faller", pos);
                    fastestFall = Math.max(fastestFall, (pos.y - next.y) / FRAME);
                    lowest = Math.min(lowest, next.y - STANDING_Y);
                    pos = next;
                }
                expect(fastestFall).toBeLessThanOrEqual(GRAVITY_SPEED + 1e-9);
                expect(fastestFall).toBeGreaterThan(0.9 * GRAVITY_SPEED);
                // Turned back before the floor by a fan as strong as this, and never stopped for good.
                expect(lowest).toBeGreaterThan(0.1);
                expect(lowest).toBeLessThan(0.9 * RANGE - 1);
            },
        });
    });

    it("makes up for gravity by the same measure as it pushes: any setting lifts at its face, none at its range's end", async () => {
        await runScenario({
            name: "the lift of a floor fan",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addFloorFan(room);
                openSlabOverFloorFan(room);
                const pull = gravityPullIn(room);

                for (const setting of FAN_SETTINGS)
                {
                    setWind(room, setting);
                    const push = FORCE.getAcceleration(windOf(setting), FLOOR_FACING), {range} = setting;
                    // At its face, what is left once gravity has had its pull is the fan's own push.
                    expect(liftOn(room, overFloorFan(0.1)), bladesOf(setting))
                        .toBeCloseTo((push + pull) * (1 - 0.1 / range) - pull, 3);
                    expect(liftOn(room, overFloorFan(0.001))).toBeGreaterThan(0.99 * push);
                    // Thinning out with the push: a third of the way up its range, by a third.
                    expect(liftOn(room, overFloorFan(range / 3)), bladesOf(setting))
                        .toBeCloseTo((2 / 3) * (push + pull) - pull, 3);
                    // As much speed in a step as its length, however long the step.
                    putBody(room, "body", overFloorFan(range / 3));
                    PhysicsManager.physicsRooms[room.id].objectById["body"].carriedVelocity = {x: 0, y: RISING, z: 0};
                    expect((PhysicsManager.applyForces(room.id, "body", still(), 0.05).y - RISING) / 0.05)
                        .toBeCloseTo((2 / 3) * (push + pull) - pull, 6);
                }
                // So that short of the range's end gravity wins, wherever the room is high enough to show it.
                for (const setting of FAN_SETTINGS.filter(setting => setting.range < HEADROOM_UNDER_CEILING - 1))
                {
                    setWind(room, setting);
                    expect(liftOn(room, overFloorFan(setting.range - 0.01)), bladesOf(setting)).toBeLessThan(0);
                }
                // The strongest outdoes gravity's pull more than twice over.
                expect(FORCE.getAcceleration(windOf(STRONGEST), FLOOR_FACING)).toBeGreaterThan(2 * pull);

                // A fan blowing sideways or down makes up for nothing: gravity pulls as ever in its stream.
                setWind(room, DEFAULT);
                expect(ObjectUpdateUtil.addObject(MEMBER, room, makeFanSignal(room, MEMBER, "wall-fan", WALL_SPOT,
                    WALL_FACING, windOf(DEFAULT)))).toBe(true);
                const inWallStream = accelerationOn(room, inFrontOfWallFan(1, 0, STANDING_Y + 0.25), RISING);
                expect(inWallStream.z).toBeLessThan(0);
                expect(inWallStream.y).toBeCloseTo(-pull, 3);
                const ceilingSpot: Vec3 = {x: FLOOR_SPOT.x + 6, y: MAX_ROOM_Y, z: FLOOR_SPOT.z};
                expect(ObjectUpdateUtil.addObject(MEMBER, room, makeFanSignal(room, MEMBER, "ceiling-fan", ceilingSpot,
                    CEILING_FACING, windOf(DEFAULT)))).toBe(true);
                const underCeilingFan: Vec3 = {x: ceilingSpot.x, y: SLAB_TOP_Y + STANDING_Y + 0.25, z: ceilingSpot.z};
                expect(liftOn(room, underCeilingFan)).toBeLessThan(-pull);
                // What it gives a body is a speed downward, which drag wears away once the body is out of it.
                putBody(room, "body", underCeilingFan);
                for (let frame = 0; frame < 30; ++frame)
                    PhysicsManager.applyForces(room.id, "body", still(), FRAME);
                const pressedDown = carriedBy(room, "body").y;
                expect(pressedDown).toBeLessThan(-1);
                moveBody(room, "body", {...underCeilingFan, x: underCeilingFan.x + 3});
                PhysicsManager.applyForces(room.id, "body", still(), FRAME);
                expect(carriedBy(room, "body").y).toBeGreaterThan(pressedDown);
                expect(carriedBy(room, "body").y).toBeLessThan(0);
                for (let frame = 0; frame < 300; ++frame)
                    PhysicsManager.applyForces(room.id, "body", still(), FRAME);
                expect(carriedBy(room, "body")).toEqual({x: 0, y: 0, z: 0});
            },
        });
    });

    it("leaves a body standing in its stream weighing nothing, so that it lifts off at once", async () => {
        await runScenario({
            name: "standing on a floor fan",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addFloorFan(room);

                for (const setting of FAN_SETTINGS)
                {
                    setWind(room, setting);
                    const standing = overFloorFan(0);
                    putBody(room, "stander", standing);
                    // Off the floor in its very first frame, however weak the fan: from rest, not with a jolt.
                    const lifted = step(room, "stander", standing);
                    expect(lifted.y, bladesOf(setting)).toBeGreaterThan(standing.y);
                    expect(lifted.y - standing.y).toBeLessThan(FORCE.getAcceleration(windOf(setting), FLOOR_FACING) * FRAME * FRAME + 1e-9);
                    expect(carriedBy(room, "stander").y).toBeGreaterThan(GRAVITY_SPEED);
                }

                // A step of no length is no step: nothing is given, not even weightlessness.
                putBody(room, "stander", overFloorFan(0));
                expect(PhysicsManager.applyForces(room.id, "stander", {x: 0, y: -GRAVITY_SPEED, z: 0}, 0))
                    .toEqual({x: 0, y: -GRAVITY_SPEED, z: 0});
                expect(carriedBy(room, "stander")).toEqual({x: 0, y: 0, z: 0});

                // Standing beside the fan, wholly off it, a body weighs what it always did.
                const beside = overFloorFan(0, 0.5 + PLAYER_RADIUS_XZ + 0.001);
                putBody(room, "stander", beside);
                expect(step(room, "stander", beside).y).toBeCloseTo(beside.y, 6);
                expect(carriedBy(room, "stander")).toEqual({x: 0, y: 0, z: 0});
                // Barely over it, given too little of the push to lift off; half over it, off the floor at once.
                const barelyOver = overFloorFan(0, 0.5 + PLAYER_RADIUS_XZ - 0.05), halfOver = overFloorFan(0, 0.5);
                putBody(room, "stander", barelyOver);
                expect(step(room, "stander", barelyOver).y).toBeCloseTo(barelyOver.y, 6);
                putBody(room, "stander", halfOver);
                expect(step(room, "stander", halfOver).y).toBeGreaterThan(halfOver.y);

                // With a fan on the ceiling blowing down on it as well (through the opened slab), added after the
                // one below: still weightless on the floor fan, and off it at once.
                setWind(room, DEFAULT);
                openSlabOverFloorFan(room);
                expect(STRONGEST.range).toBeGreaterThan(MAX_ROOM_Y - PLAYER_HEIGHT); // reaching down to it
                expect(ObjectUpdateUtil.addObject(MEMBER, room, makeFanSignal(room, MEMBER, "ceiling-fan", CEILING_SPOT,
                    CEILING_FACING, windOf(STRONGEST)))).toBe(true);
                const between = overFloorFan(0);
                putBody(room, "stander", between);
                expect(step(room, "stander", between).y).toBeGreaterThan(between.y);
                expect(carriedBy(room, "stander").y).toBeGreaterThan(GRAVITY_SPEED);
            },
        });
    });

    it("eases off under a ceiling, and takes the rise out of a body that hits one", async () => {
        await runScenario({
            name: "a floor fan under the slab",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addFloorFan(room);
                const pull = gravityPullIn(room);
                const liftWithNoCeiling = (feet: number) => (PUSH + pull) * (1 - feet / RANGE) - pull;

                // The slab leaves a player a unit of room over the fan: the lift thins out through it, and under
                // the slab itself there is none, only gravity's pull.
                expect(HEADROOM_UNDER_SLAB).toBeCloseTo(1, 9);
                expect(liftOn(room, overFloorFan(0.001))).toBeCloseTo(liftWithNoCeiling(0.001), 0);
                expect(liftOn(room, overFloorFan(0.5)) + pull).toBeCloseTo(0.5 * (liftWithNoCeiling(0.5) + pull), 3);
                expect(liftOn(room, overFloorFan(0.75)) + pull).toBeCloseTo(0.25 * (liftWithNoCeiling(0.75) + pull), 3);

                // Up against the slab and still rising fast: stopped, with nothing left of the rise but what
                // holds off the fall, which gravity then takes too.
                const underSlab = overFloorFan(HEADROOM_UNDER_SLAB);
                putBody(room, "riser", underSlab);
                PhysicsManager.physicsRooms[room.id].objectById["riser"].carriedVelocity = {x: 0, y: 3 * GRAVITY_SPEED, z: 0};
                let pos = step(room, "riser", underSlab);
                expect(carriedBy(room, "riser").y).toBeLessThan(GRAVITY_SPEED);
                expect(carriedBy(room, "riser").y).toBeGreaterThan(0);
                for (let frame = 0; frame < 30; ++frame)
                    pos = step(room, "riser", pos);
                expect(pos.y).toBeLessThan(underSlab.y - 0.1);

                // More blocks on top of the slab change nothing: the nearest thing overhead is what counts.
                const eased = liftOn(room, overFloorFan(0.75));
                const onTopOfSlab = [-0.25, 0.25].flatMap(z => [-0.25, 0.25].map(x => VoxelQueryUtil.getVoxelQuadIndex(
                    VoxelQueryUtil.getVoxelRowFromWorldZ(FLOOR_SPOT.z + z), VoxelQueryUtil.getVoxelColFromWorldX(FLOOR_SPOT.x + x),
                    "x", "+", STOREY_FLOOR_COLLISION_LAYER + 1)));
                for (const quadIndex of onTopOfSlab)
                    expect(VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels, quadIndex)).toBe(true);
                expect(liftOn(room, overFloorFan(0.75))).toBeCloseTo(eased, 6);
                for (const quadIndex of onTopOfSlab)
                    expect(VoxelUpdateUtil.removeVoxelBlock(undefined, room.voxelGrid.voxels, quadIndex)).toBe(true);

                // With the slab open over the fan there is nothing to ease off for.
                openSlabOverFloorFan(room);
                expect(liftOn(room, overFloorFan(0.5))).toBeCloseTo(liftWithNoCeiling(0.5), 3);
            },
        });
    });

    it("bounces whoever stands on it, and goes on bouncing them: off the floor where it is weak, in the air where it is strong", async () => {
        await runScenario({
            name: "bouncing over a floor fan",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addFloorFan(room);
                openSlabOverFloorFan(room);

                const heights = heightsOver(room, 40);
                // Up at once, well off the floor.
                expect(Math.max(...heights.slice(0, 60))).toBeGreaterThan(2);
                // Still going up and down half a minute on, as it was ten seconds before: neither dying away nor
                // growing.
                const late = bounceIn(heights, 30, 40), earlier = bounceIn(heights, 20, 30);
                expect(late.high - late.low).toBeGreaterThan(1.5);
                expect(late.turns).toBeGreaterThanOrEqual(5);
                expect(late.low).toBeCloseTo(earlier.low, 1);
                expect(late.high).toBeCloseTo(earlier.high, 1);
                // In the air all the while, and never pinned to the ceiling.
                expect(late.low).toBeGreaterThan(0.5);
                expect(late.high).toBeLessThan(HEADROOM_UNDER_CEILING);
                // Never falling faster than anything falls.
                for (let i = 1; i < heights.length; ++i)
                    expect(heights[i - 1] - heights[i]).toBeLessThanOrEqual(GRAVITY_SPEED * FRAME + 1e-9);

                // The same bounce whatever the steps it is taken in.
                const coarse = bounceIn(heightsOver(room, 40, 0.05), 30, 40, 0.05);
                expect(Math.abs(coarse.low - late.low)).toBeLessThan(0.15);
                expect(Math.abs(coarse.high - late.high)).toBeLessThan(0.15);

                // The weakest, over its short reach: up off the floor and back down onto it, again and again.
                setWind(room, WEAKEST);
                const gentle = bounceIn(heightsOver(room, 40), 30, 40);
                expect(gentle.low).toBeLessThan(0.05);
                expect(gentle.high).toBeGreaterThan(1);
                expect(gentle.turns).toBeGreaterThanOrEqual(3);

                // Every setting: never coming to rest.
                for (const setting of FAN_SETTINGS)
                {
                    setWind(room, setting);
                    const bounce = bounceIn(heightsOver(room, 30), 20, 30);
                    expect(bounce.high - bounce.low, bladesOf(setting)).toBeGreaterThan(0.25);
                    expect(bounce.turns, bladesOf(setting)).toBeGreaterThanOrEqual(3);
                    expect(bounce.high).toBeLessThanOrEqual(HEADROOM_UNDER_CEILING + 1e-6);
                }
            },
        });
    });

    it("lifts a body least where it has one blade, back onto the floor each time, and higher with each blade more", async () => {
        await runScenario({
            name: "the weakest floor fan",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addFloorFan(room);
                openSlabOverFloorFan(room);

                // Some way up and back down onto the floor, again and again: never so much as a player's height.
                setWind(room, WEAKEST);
                const gentle = bounceIn(heightsOver(room, 40), 20, 40);
                expect(gentle.low).toBeLessThan(0.05);
                expect(gentle.high).toBeGreaterThan(0.05);
                expect(gentle.high).toBeLessThan(PLAYER_HEIGHT);
                expect(gentle.turns).toBeGreaterThanOrEqual(5);

                // With each blade more, a body is higher a quarter of a second after it is set down, and goes at
                // least as high at first: higher, where the ceiling does not stop it.
                const quarterSecond = Math.round(0.25 / FRAME) - 1;
                const rises = FAN_SETTINGS.map(setting => {
                    setWind(room, setting);
                    return heightsOver(room, 4);
                });
                expect(Math.max(...rises[0])).toBeLessThan(HEADROOM_UNDER_CEILING - 1);
                for (let i = 1; i < rises.length; ++i)
                {
                    expect(rises[i][quarterSecond], bladesOf(FAN_SETTINGS[i])).toBeGreaterThan(rises[i - 1][quarterSecond]);
                    expect(Math.max(...rises[i]), bladesOf(FAN_SETTINGS[i])).toBeGreaterThan(Math.max(...rises[i - 1]) - 1e-9);
                    expect(Math.max(...rises[i])).toBeLessThanOrEqual(HEADROOM_UNDER_CEILING + 1e-6);
                }
            },
        });
    });

    it("goes on bouncing them under a low ceiling too, rather than pinning them to it", async () => {
        await runScenario({
            name: "bouncing under the slab",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addFloorFan(room);

                for (const setting of FAN_SETTINGS)
                {
                    setWind(room, setting);
                    const bounce = bounceIn(heightsOver(room, 30), 20, 30);
                    expect(bounce.high, bladesOf(setting)).toBeLessThanOrEqual(HEADROOM_UNDER_SLAB + 1e-6);
                    expect(bounce.high - bounce.low, bladesOf(setting)).toBeGreaterThan(0.15);
                    expect(bounce.turns, bladesOf(setting)).toBeGreaterThanOrEqual(5);
                }
            },
        });
    });

    it("throws a player who walks across it up and over: still rising once past it, then down to the floor beyond", async () => {
        await runScenario({
            name: "walking across a floor fan",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                addFloorFan(room);
                // The slab open all along the way, so the room's ceiling is the only thing overhead.
                openSlab(room, FLOOR_SPOT.x - 2, FLOOR_SPOT.x + 14, FLOOR_SPOT.z - 0.5, FLOOR_SPOT.z + 0.5);

                let pos = overFloorFan(0, -2);
                putBody(room, "walker", pos);
                let heightOnLeaving: number | undefined;
                const heights: number[] = [];
                for (let frame = 0; frame < 300; ++frame)
                {
                    const overTheFan = Math.abs(pos.x - FLOOR_SPOT.x) <= 0.5;
                    pos = step(room, "walker", pos, {x: WALKING_SPEED, y: 0, z: 0});
                    if (overTheFan && Math.abs(pos.x - FLOOR_SPOT.x) > 0.5)
                        heightOnLeaving = pos.y - STANDING_Y;
                    heights.push(pos.y - STANDING_Y);
                }

                // Off the floor in the moment it takes to walk across, and a good way higher after that.
                expect(heightOnLeaving).toBeGreaterThan(0.5);
                const top = Math.max(...heights);
                expect(top).toBeGreaterThan(heightOnLeaving! + 0.5);
                expect(top).toBeLessThan(HEADROOM_UNDER_CEILING);
                // Down again on the floor beyond the fan, with nothing left of what it was given.
                expect(heights[heights.length - 1]).toBeCloseTo(0, 3);
                expect(pos.x).toBeGreaterThan(FLOOR_SPOT.x + 2);
                expect(carriedBy(room, "walker")).toEqual({x: 0, y: 0, z: 0});
            },
        });
    });
});
