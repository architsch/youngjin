/**
 * Scenario tests: lamps, and the light they put into a room
 *
 * A lamp is the only thing besides the head lamp and the ambient that lights a room, and it is
 * furniture that anybody may install — held back only by what holds back a picture. That is the
 * whole of what these cover:
 *
 * - who may install a lamp, take one down, move one, and change what it gives off
 * - which metadata a lamp answers to at all, and what it makes of a value it is handed
 * - that what a lamp *looks* like and what it *lights the room with* can never disagree
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, EMPTY_REGULAR, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectMetadataEntryMap from "../../../src/shared/object/maps/objectMetadataEntryMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import WallLampObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/wallLampObjectTypeConfig";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import Room from "../../../src/shared/room/types/room";
import RestrictedZone from "../../../src/shared/voxel/types/restrictedZone";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import LampLightUtil, { MAX_LAMP_INTENSITY, MAX_LAMP_RANGE, MIN_LAMP_INTENSITY, MIN_LAMP_RANGE }
    from "../../../src/shared/graphics/light/util/lampLightUtil";
import { INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
    LIGHT_COLOR_PALETTE_NAME } from "../../../src/shared/system/sharedConstants";

const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("WallLamp");
const MAX_LAMPS_PER_ROOM = WallLampObjectTypeConfig.maxCountPerRoom;

function makeUser(id: string, userType: number): User
{
    return new User(id, `User_${id}`, userType, `${id}@test.com`, "");
}

const ADMIN = makeUser("an-admin", UserTypeEnumMap.Admin);
const MEMBER = makeUser("a-member", UserTypeEnumMap.Member);
const GUEST = makeUser("a-guest", UserTypeEnumMap.Guest);

// A lamp on the boundary wall, well clear of the door the room already has. The exact spot is not
// what any of these are asking about — only that it is a stretch of wall a lamp fits on.
function makeLampSignal(room: Room, sourceUser: User, objectId: string = "new-lamp",
    colOffset: number = -5): AddObjectSignal
{
    return new AddObjectSignal(room.id, sourceUser.id, sourceUser.userName, lampTypeIndex, objectId,
        new ObjectTransform(
            {
                x: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL + colOffset + 0.5,
                y: 2.25,
                z: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
            },
            {x: 0, y: 0, z: -1}));
}

describe("lamp permissions", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("lets anybody install a lamp in a hub", async () => {
        await runScenario({
            name: "installing a lamp in a hub",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canAdd = (user: User) =>
                    ObjectUpdateUtil.canAddObject(user, room, makeLampSignal(room, user));

                expect(canAdd(ADMIN)).toBe(true);
                expect(canAdd(MEMBER)).toBe(true);
                expect(canAdd(GUEST)).toBe(true);
            },
        });
    });

    it("lets a visitor install a lamp in a regular room he does not own", async () => {
        // Unlike a door, which is world-building and belongs to hubs alone, a lamp is furniture — so
        // it is anybody's to install wherever a picture would be.
        await runScenario({
            name: "installing a lamp in a regular room",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter("regular")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["regular"].room;
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room,
                    makeLampSignal(room, MEMBER))).toBe(true);
                expect(ObjectUpdateUtil.canAddObject(GUEST, room,
                    makeLampSignal(room, GUEST))).toBe(true);
            },
        });
    });

    it("refuses a lamp installed under somebody else's name", async () => {
        await runScenario({
            name: "spoofed lamp",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room,
                    makeLampSignal(room, GUEST))).toBe(false);
            },
        });
    });

    it("refuses a lamp once the room holds as many as its mesh was sized for", async () => {
        await runScenario({
            name: "the lamp cap",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                for (let i = 0; i < MAX_LAMPS_PER_ROOM; ++i)
                    room.objectById[`lamp-${i}`] = makeLampSignal(room, ADMIN, `lamp-${i}`, -5 - i);

                // The cap is not a privilege: an admin runs into it as surely as anybody else.
                for (const user of [MEMBER, ADMIN])
                {
                    expect(ObjectUpdateUtil.canAddObject(user, room,
                        makeLampSignal(room, user, "one-too-many", -40))).toBe(false);
                }
            },
        });
    });

    it("lets anybody take down, move, or re-light a lamp somebody else installed", async () => {
        await runScenario({
            name: "editing a lamp",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const lamp = makeLampSignal(room, ADMIN);
                room.objectById[lamp.objectId] = lamp;

                for (const user of [ADMIN, MEMBER, GUEST])
                {
                    expect(ObjectUpdateUtil.canRemoveObject(user, room,
                        new RemoveObjectSignal(room.id, lamp.objectId))).toBe(true);
                    expect(ObjectUpdateUtil.canSetObjectTransform(user, room,
                        new SetObjectTransformSignal(room.id, lamp.objectId, lamp.transform, true))).toBe(true);
                    expect(ObjectUpdateUtil.canSetObjectMetadata(user, room,
                        new SetObjectMetadataSignal(room.id, lamp.objectId,
                            ObjectMetadataKeyEnumMap.LightProperties,
                            WallLampObjectTypeConfig.util.encodeLightProperties(3, 8, 9)))).toBe(true);
                }
            },
        });
    });

    it("keeps an ordinary user's lamp out of a restricted zone, and his hands off one inside it", async () => {
        // With no privilege of its own left to ask about, a restricted zone is what stops a lamp
        // being installed, taken down or re-lit in a stretch of the room that is not the user's —
        // and the hub's superuser is still above it (see @docs/gameplay/restricted_zone.md).
        await runScenario({
            name: "a lamp inside a restricted zone",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const lampCol = INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL - 5;
                room.voxelGrid.restrictedZones = [new RestrictedZone(
                    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW - 3, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
                    lampCol - 2, lampCol + 2)];

                expect(ObjectUpdateUtil.canAddObject(MEMBER, room,
                    makeLampSignal(room, MEMBER))).toBe(false);
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room,
                    makeLampSignal(room, ADMIN))).toBe(true);

                const lamp = makeLampSignal(room, ADMIN, "zoned-lamp");
                room.objectById[lamp.objectId] = lamp;
                expect(ObjectUpdateUtil.canRemoveObject(MEMBER, room,
                    new RemoveObjectSignal(room.id, lamp.objectId))).toBe(false);
                expect(ObjectUpdateUtil.canSetObjectMetadata(MEMBER, room,
                    new SetObjectMetadataSignal(room.id, lamp.objectId,
                        ObjectMetadataKeyEnumMap.LightProperties,
                        WallLampObjectTypeConfig.util.encodeLightProperties(3, 8, 9)))).toBe(false);
            },
        });
    });

    it("refuses a lamp moved the way something with physics moves", async () => {
        // A wall attachment is placed rather than driven, so a transform that asks to be resolved
        // against the world is not a lamp being slid along its wall.
        await runScenario({
            name: "a lamp shoved rather than placed",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const lamp = makeLampSignal(room, ADMIN);
                room.objectById[lamp.objectId] = lamp;

                expect(ObjectUpdateUtil.canSetObjectTransform(ADMIN, room,
                    new SetObjectTransformSignal(room.id, lamp.objectId, lamp.transform,
                        false))).toBe(false);
            },
        });
    });

    it("refuses every metadata key but the light a lamp gives off", async () => {
        await runScenario({
            name: "metadata a lamp does not answer to",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const lamp = makeLampSignal(room, ADMIN);
                room.objectById[lamp.objectId] = lamp;

                const canSet = (key: number, value: string) =>
                    ObjectUpdateUtil.canSetObjectMetadata(ADMIN, room,
                        new SetObjectMetadataSignal(room.id, lamp.objectId, key, value));

                expect(canSet(ObjectMetadataKeyEnumMap.LightProperties, "!!")).toBe(true);
                // Its appearance is derived from its light rather than stored beside it, so there is
                // nothing about it left for a composition to say.
                expect(canSet(ObjectMetadataKeyEnumMap.InstancedMeshComposition, "!!")).toBe(false);
                expect(canSet(ObjectMetadataKeyEnumMap.Label, "Lamp")).toBe(false);
                expect(canSet(ObjectMetadataKeyEnumMap.ImagePath, "1/1")).toBe(false);
                expect(canSet(ObjectMetadataKeyEnumMap.DestinationRoomId, "hub")).toBe(false);
            },
        });
    });
});

describe("what a lamp gives off", () => {
    const intensities = fc.integer({min: MIN_LAMP_INTENSITY, max: MAX_LAMP_INTENSITY});
    const ranges = fc.integer({min: MIN_LAMP_RANGE, max: MAX_LAMP_RANGE});
    const colorIndices = fc.integer({min: 0,
        max: ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME) - 1});

    function lampWith(lightProperties: string): AddObjectSignal
    {
        return new AddObjectSignal("room", "user", "User", lampTypeIndex, "lamp",
            new ObjectTransform({x: 1, y: 1, z: 1}, {x: 0, y: 0, z: -1}),
            {[ObjectMetadataKeyEnumMap.LightProperties]: new EncodableByteString(lightProperties)});
    }

    it("comes back exactly as it was set", () => {
        fc.assert(fc.property(colorIndices, intensities, ranges,
            (colorIndex, intensity, range) => {
                const lamp = lampWith(WallLampObjectTypeConfig.util.encodeLightProperties(
                    colorIndex, intensity, range));
                expect(WallLampObjectTypeConfig.util.getColorIndex(lamp)).toBe(colorIndex);
                expect(WallLampObjectTypeConfig.util.getIntensity(lamp)).toBe(intensity);
                expect(WallLampObjectTypeConfig.util.getRange(lamp)).toBe(range);
            }));
    });

    it("offers a dozen whole values on each of its two dials", () => {
        // Few enough to be marked out on the slider and read off beside it, and each one a quantity
        // rather than a position on a scale — an intensity of 4 is four times the light of one at 1,
        // and a range of 9 reaches nine blocks (see LampLightUtil).
        for (const [min, max] of [[MIN_LAMP_INTENSITY, MAX_LAMP_INTENSITY],
            [MIN_LAMP_RANGE, MAX_LAMP_RANGE]])
        {
            expect(max - min + 1).toBe(12);
        }
    });

    it("is a light whatever the object was handed", () => {
        // Reading has to be total: a lamp carrying anything at all — a value from another version,
        // a value somebody made up — is still a lamp, and nothing downstream carries a check for it.
        // One stored character addresses far more numbers than either dial has, so what comes back
        // is held to the dial's own range rather than to the encoding's.
        fc.assert(fc.property(fc.string({maxLength: 20}), (raw) => {
            const lamp = lampWith(raw);
            expect(WallLampObjectTypeConfig.util.getColorIndex(lamp)).toBeGreaterThanOrEqual(0);
            expect(WallLampObjectTypeConfig.util.getColorIndex(lamp)).toBeLessThan(
                ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME));
            expect(WallLampObjectTypeConfig.util.getIntensity(lamp)).toBeGreaterThanOrEqual(MIN_LAMP_INTENSITY);
            expect(WallLampObjectTypeConfig.util.getIntensity(lamp)).toBeLessThanOrEqual(MAX_LAMP_INTENSITY);
            expect(WallLampObjectTypeConfig.util.getRange(lamp)).toBeGreaterThanOrEqual(MIN_LAMP_RANGE);
            expect(WallLampObjectTypeConfig.util.getRange(lamp)).toBeLessThanOrEqual(MAX_LAMP_RANGE);
        }));
    });

    it("holds a lamp asked for more than a lamp has to what a lamp has", () => {
        // The bounds are the whole of what the two dials are, so a value from outside them is not a
        // brighter lamp or a longer-reaching one — it is a lamp that does not exist.
        const beyond = lampWith(WallLampObjectTypeConfig.util.encodeLightProperties(0, 999, 999));
        expect(WallLampObjectTypeConfig.util.getIntensity(beyond)).toBe(MAX_LAMP_INTENSITY);
        expect(WallLampObjectTypeConfig.util.getRange(beyond)).toBe(MAX_LAMP_RANGE);

        const beneath = lampWith(WallLampObjectTypeConfig.util.encodeLightProperties(0, 0, 0));
        expect(WallLampObjectTypeConfig.util.getIntensity(beneath)).toBe(MIN_LAMP_INTENSITY);
        expect(WallLampObjectTypeConfig.util.getRange(beneath)).toBe(MIN_LAMP_RANGE);
    });

    it("leaves a lamp a light even at its lowest, and an effect at its highest", () => {
        // A lamp is furniture rather than a torch: one turned all the way down is a small light, not
        // a dark fitting, since there would be nothing on screen to tell that from a broken one. The
        // top of the range is the opposite end of that — a lamp that blows out the wall it is
        // mounted on, which takes a strength well past the one that merely lights a room.
        const unconfigured = lampWith("");
        expect(MIN_LAMP_INTENSITY).toBeGreaterThan(0);
        expect(MIN_LAMP_RANGE).toBeGreaterThan(0);
        expect(MAX_LAMP_INTENSITY)
            .toBeGreaterThan(3 * WallLampObjectTypeConfig.util.getIntensity(unconfigured));
    });

    it("gives a lamp two dials that do not move together", () => {
        // The whole point of splitting them: a dim wash and a tight bright pool both have to be
        // askable for, which they are not while one dial drives strength and reach at once. Reach
        // and falloff are the one pair that does move together, and opposite ways, so that a wide
        // lamp is wide rather than merely long-range.
        expect(MIN_LAMP_INTENSITY).toBeGreaterThan(0);
        expect(LampLightUtil.getDecay(MIN_LAMP_RANGE))
            .toBeGreaterThan(LampLightUtil.getDecay(MAX_LAMP_RANGE));
        fc.assert(fc.property(ranges, ranges, (a, b) => {
            const [low, high] = a <= b ? [a, b] : [b, a];
            expect(LampLightUtil.getDecay(high)).toBeLessThanOrEqual(LampLightUtil.getDecay(low));
        }));
    });

    it("is stored as something a lamp can be lit by, whatever arrived", () => {
        // Preprocessing is where an incoming value is made safe (see ObjectMetadataEntryMap), and
        // it has to be a fixed point — a value that has been through it once must survive a second
        // pass unchanged, or a lamp would drift every time it was re-saved.
        const preprocess = (raw: string) => ObjectMetadataEntryMap.preprocess(
            ObjectMetadataKeyEnumMap.LightProperties, raw);
        fc.assert(fc.property(fc.string({maxLength: 20}), (raw) => {
            const once = preprocess(raw);
            expect(once.length).toBe(3);
            expect(preprocess(once)).toBe(once);
        }));
    });

    it("arrives lit rather than dark when nothing has been said about it", () => {
        // There is nothing on screen to tell an unconfigured lamp from a broken one, so a lamp with
        // no metadata at all has to be a light — and an ordinary one rather than one at the top of
        // a range that exists for dramatic effect.
        const lamp = lampWith("");
        expect(WallLampObjectTypeConfig.util.getIntensity(lamp)).toBeGreaterThanOrEqual(MIN_LAMP_INTENSITY);
        expect(WallLampObjectTypeConfig.util.getIntensity(lamp)).toBeLessThan(MAX_LAMP_INTENSITY);
        expect(WallLampObjectTypeConfig.util.getRange(lamp)).toBeGreaterThan(MIN_LAMP_RANGE);
        expect(WallLampObjectTypeConfig.util.getRange(lamp)).toBeLessThanOrEqual(MAX_LAMP_RANGE);
        expect(ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME,
            WallLampObjectTypeConfig.util.getColorIndex(lamp)))).toBe("#ffffff");
    });

    it("reads a lamp stored by a version that knew fewer settings", () => {
        // A character past the end of the string falls back on its own default, so a lamp is never
        // read as dark or as reaching nowhere just because its string was short.
        const colorOnly = WallLampObjectTypeConfig.util.getDefaultLightProperties().substring(0, 1);
        const lamp = lampWith(colorOnly);
        expect(WallLampObjectTypeConfig.util.getIntensity(lamp)).toBe(
            WallLampObjectTypeConfig.util.getIntensity(lampWith("")));
        expect(WallLampObjectTypeConfig.util.getRange(lamp)).toBe(
            WallLampObjectTypeConfig.util.getRange(lampWith("")));
    });

    it("draws the lamp in the color it lights the room with", () => {
        // The one thing that keeps a lamp from glowing one color while lighting the room another:
        // the parts it is drawn from are derived from the same setting the light is.
        const config = ObjectTypeConfigMap.getConfigByIndex(lampTypeIndex);
        const generateDefaultParts = config.components.spawnedByAny!
            .instancedMeshComposer!.generateDefaultParts;

        fc.assert(fc.property(colorIndices, intensities, ranges,
            (colorIndex, intensity, range) => {
                const lamp = lampWith(WallLampObjectTypeConfig.util.encodeLightProperties(
                    colorIndex, intensity, range));
                const {parts} = generateDefaultParts(lamp);
                expect(parts.length).toBeGreaterThan(0);
                expect(parts[0].color).toEqual(
                    ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME, colorIndex));
            }));
    });
});
