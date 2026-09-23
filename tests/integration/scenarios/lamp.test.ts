/**
 * Scenario tests: lamps (furniture anyone may install, under the same rules as pictures) — permissions,
 * metadata validation, a lamp's appearance always matching its light, and a floor lamp being walked over.
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
import LampObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
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
import { COLLISION_LAYER_MIN, GRAVITY_SPEED, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, INSTANCED_EMISSIVE_MATERIAL_ID, INSTANCED_WOOD_MATERIAL_ID,
    LIGHT_COLOR_PALETTE_NAME, UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import Vec3 from "../../../src/shared/math/types/vec3";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import CompositionMetadataUtil from "../../../src/shared/graphics/mesh/composition/util/compositionMetadataUtil";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { LampCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/lampCompositionCodec";
import LampCompositionConstants
    from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/lampCompositionConstants";
import MarginCompositionConstants
    from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/marginCompositionConstants";
import MouldingCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/mouldingCompositionConstants";
import LampCompositionParams from "../../../src/shared/graphics/mesh/composition/types/compositionParams/lampCompositionParams";

const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
const MAX_LAMPS_PER_ROOM = ObjectCategoryConfigMap.getMaxCountPerRoom(LampObjectTypeConfig.category);

function makeUser(id: string, userType: number): User
{
    return new User(id, `User_${id}`, userType, `${id}@test.com`, "");
}

const ADMIN = makeUser("an-admin", UserTypeEnumMap.Admin);
const MEMBER = makeUser("a-member", UserTypeEnumMap.Member);
const GUEST = makeUser("a-guest", UserTypeEnumMap.Guest);

// A stretch of boundary wall the filled-in lamps never reach, so a cap refusal is the cap and not the
// wall (lamps written straight into the room get no collider to be refused by).
const CLEAR_COL_OFFSET = 5;

// A lamp on the boundary wall, clear of the room's door.
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
            {x: 0, y: 0, z: -1}, {...UNIT_VEC3}));
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
        // Unlike doors (hubs only), lamps may be installed wherever a picture could.
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
                    room.objectGroup.addObject(makeLampSignal(room, ADMIN, `lamp-${i}`, -5 - i));

                // The cap is not a privilege: an admin runs into it as surely as anybody else.
                for (const user of [MEMBER, ADMIN])
                {
                    expect(ObjectUpdateUtil.canAddObject(user, room,
                        makeLampSignal(room, user, "one-too-many", CLEAR_COL_OFFSET))).toBe(false);
                }
            },
        });
    });

    it("counts a room's lamps the moment it is loaded, not only the ones installed since", async () => {
        await runScenario({
            name: "lamps counted on load",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const lamps: AddObjectSignal[] = [];
                for (let i = 0; i < MAX_LAMPS_PER_ROOM; ++i)
                    lamps.push(makeLampSignal(room, ADMIN, `lamp-${i}`, -5 - i));
                room.objectGroup = new ObjectGroup(lamps); // as a stored room arrives (see ObjectGroup.decode)

                expect(room.objectGroup.getCategoryCount(LampObjectTypeConfig.category))
                    .toBe(MAX_LAMPS_PER_ROOM);
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room,
                    makeLampSignal(room, ADMIN, "one-too-many", CLEAR_COL_OFFSET))).toBe(false);
            },
        });
    });

    it("frees the slot again when a lamp is taken down", async () => {
        await runScenario({
            name: "the lamp cap after a removal",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                for (let i = 0; i < MAX_LAMPS_PER_ROOM; ++i)
                    room.objectGroup.addObject(makeLampSignal(room, ADMIN, `lamp-${i}`, -5 - i));

                expect(ObjectUpdateUtil.removeObject(MEMBER, room,
                    new RemoveObjectSignal(room.id, "lamp-0"))).toBe(true);
                expect(ObjectUpdateUtil.canAddObject(MEMBER, room,
                    makeLampSignal(room, MEMBER, "one-more", CLEAR_COL_OFFSET))).toBe(true);
            },
        });
    });

    it("spends the lamp cap on lamps alone, leaving the room's other categories untouched", async () => {
        await runScenario({
            name: "the lamp cap is not a room-wide budget",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                for (let i = 0; i < MAX_LAMPS_PER_ROOM; ++i)
                    room.objectGroup.addObject(makeLampSignal(room, ADMIN, `lamp-${i}`, -5 - i));

                // Only the entrance door the room was generated with.
                expect(room.objectGroup.getCategoryCount(DoorObjectTypeConfig.category)).toBe(1);

                const door = DoorObjectTypeConfig.util.makeEntranceDoor(room.id,
                    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL + 4,
                    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, COLLISION_LAYER_MIN);
                door.objectId = "another-door";
                door.sourceUserID = ADMIN.id;
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room, door)).toBe(true);
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
                room.objectGroup.addObject(lamp);

                for (const user of [ADMIN, MEMBER, GUEST])
                {
                    expect(ObjectUpdateUtil.canRemoveObject(user, room,
                        new RemoveObjectSignal(room.id, lamp.objectId))).toBe(true);
                    expect(ObjectUpdateUtil.canSetObjectTransform(user, room,
                        new SetObjectTransformSignal(room.id, lamp.objectId, lamp.transform, true))).toBe(true);
                    expect(ObjectUpdateUtil.canSetObjectMetadata(user, room,
                        new SetObjectMetadataSignal(room.id, lamp.objectId,
                            ObjectMetadataKeyEnumMap.LightProperties,
                            LampObjectTypeConfig.util.encodeLightProperties(3, 8, 9)))).toBe(true);
                }
            },
        });
    });

    it("keeps an ordinary user's lamp out of a restricted zone, and his hands off one inside it", async () => {
        // Restricted zones block lamp edits by non-superusers (see @docs/gameplay/restricted_zone.md).
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
                room.objectGroup.addObject(lamp);
                expect(ObjectUpdateUtil.canRemoveObject(MEMBER, room,
                    new RemoveObjectSignal(room.id, lamp.objectId))).toBe(false);
                expect(ObjectUpdateUtil.canSetObjectMetadata(MEMBER, room,
                    new SetObjectMetadataSignal(room.id, lamp.objectId,
                        ObjectMetadataKeyEnumMap.LightProperties,
                        LampObjectTypeConfig.util.encodeLightProperties(3, 8, 9)))).toBe(false);
            },
        });
    });

    it("refuses a lamp moved the way something with physics moves", async () => {
        // Attached objects are placed, so a physics-resolved transform is rejected.
        await runScenario({
            name: "a lamp shoved rather than placed",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const lamp = makeLampSignal(room, ADMIN);
                room.objectGroup.addObject(lamp);

                expect(ObjectUpdateUtil.canSetObjectTransform(ADMIN, room,
                    new SetObjectTransformSignal(room.id, lamp.objectId, lamp.transform,
                        false))).toBe(false);
            },
        });
    });

    it("refuses every metadata key but the light a lamp gives off and its look", async () => {
        await runScenario({
            name: "metadata a lamp does not answer to",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const lamp = makeLampSignal(room, ADMIN);
                room.objectGroup.addObject(lamp);

                const canSet = (key: number, value: string) =>
                    ObjectUpdateUtil.canSetObjectMetadata(ADMIN, room,
                        new SetObjectMetadataSignal(room.id, lamp.objectId, key, value));

                expect(canSet(ObjectMetadataKeyEnumMap.LightProperties, "!!")).toBe(true);
                // Its margin and frame; the glow's color is derived from the light either way.
                expect(canSet(ObjectMetadataKeyEnumMap.InstancedMeshComposition, "!!")).toBe(true);
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
            new ObjectTransform({x: 1, y: 1, z: 1}, {x: 0, y: 0, z: -1}, {...UNIT_VEC3}),
            {[ObjectMetadataKeyEnumMap.LightProperties]: new EncodableByteString(lightProperties)});
    }

    it("comes back exactly as it was set", () => {
        fc.assert(fc.property(colorIndices, intensities, ranges,
            (colorIndex, intensity, range) => {
                const lamp = lampWith(LampObjectTypeConfig.util.encodeLightProperties(
                    colorIndex, intensity, range));
                expect(LampObjectTypeConfig.util.getColorIndex(lamp)).toBe(colorIndex);
                expect(LampObjectTypeConfig.util.getIntensity(lamp)).toBe(intensity);
                expect(LampObjectTypeConfig.util.getRange(lamp)).toBe(range);
            }));
    });

    it("offers a dozen whole values on each of its two dials", () => {
        // Few whole-quantity steps: intensity is linear, range is in blocks (see LampLightUtil).
        for (const [min, max] of [[MIN_LAMP_INTENSITY, MAX_LAMP_INTENSITY],
            [MIN_LAMP_RANGE, MAX_LAMP_RANGE]])
        {
            expect(max - min + 1).toBe(12);
        }
    });

    it("is a light whatever the object was handed", () => {
        // Reading is total: any string decodes to a lamp within the dials' ranges.
        fc.assert(fc.property(fc.string({maxLength: 20}), (raw) => {
            const lamp = lampWith(raw);
            expect(LampObjectTypeConfig.util.getColorIndex(lamp)).toBeGreaterThanOrEqual(0);
            expect(LampObjectTypeConfig.util.getColorIndex(lamp)).toBeLessThan(
                ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME));
            expect(LampObjectTypeConfig.util.getIntensity(lamp)).toBeGreaterThanOrEqual(MIN_LAMP_INTENSITY);
            expect(LampObjectTypeConfig.util.getIntensity(lamp)).toBeLessThanOrEqual(MAX_LAMP_INTENSITY);
            expect(LampObjectTypeConfig.util.getRange(lamp)).toBeGreaterThanOrEqual(MIN_LAMP_RANGE);
            expect(LampObjectTypeConfig.util.getRange(lamp)).toBeLessThanOrEqual(MAX_LAMP_RANGE);
        }));
    });

    it("holds a lamp asked for more than a lamp has to what a lamp has", () => {
        // Out-of-range values clamp to the dials' bounds.
        const beyond = lampWith(LampObjectTypeConfig.util.encodeLightProperties(0, 999, 999));
        expect(LampObjectTypeConfig.util.getIntensity(beyond)).toBe(MAX_LAMP_INTENSITY);
        expect(LampObjectTypeConfig.util.getRange(beyond)).toBe(MAX_LAMP_RANGE);

        const beneath = lampWith(LampObjectTypeConfig.util.encodeLightProperties(0, 0, 0));
        expect(LampObjectTypeConfig.util.getIntensity(beneath)).toBe(MIN_LAMP_INTENSITY);
        expect(LampObjectTypeConfig.util.getRange(beneath)).toBe(MIN_LAMP_RANGE);
    });

    it("leaves a lamp a light even at its lowest, and an effect at its highest", () => {
        // The minimum is still a visible light (a dark lamp looks broken); the maximum blows out its wall.
        const unconfigured = lampWith("");
        expect(MIN_LAMP_INTENSITY).toBeGreaterThan(0);
        expect(MIN_LAMP_RANGE).toBeGreaterThan(0);
        expect(MAX_LAMP_INTENSITY)
            .toBeGreaterThan(3 * LampObjectTypeConfig.util.getIntensity(unconfigured));
    });

    it("gives a lamp two dials that do not move together", () => {
        // Intensity and range are independent; range and falloff move together, in opposite directions.
        expect(MIN_LAMP_INTENSITY).toBeGreaterThan(0);
        expect(LampLightUtil.getDecay(MIN_LAMP_RANGE))
            .toBeGreaterThan(LampLightUtil.getDecay(MAX_LAMP_RANGE));
        fc.assert(fc.property(ranges, ranges, (a, b) => {
            const [low, high] = a <= b ? [a, b] : [b, a];
            expect(LampLightUtil.getDecay(high)).toBeLessThanOrEqual(LampLightUtil.getDecay(low));
        }));
    });

    it("is stored as something a lamp can be lit by, whatever arrived", () => {
        // Preprocessing must be idempotent, or a lamp drifts on each re-save.
        const preprocess = (raw: string) => ObjectMetadataEntryMap.preprocess(
            ObjectMetadataKeyEnumMap.LightProperties, raw);
        fc.assert(fc.property(fc.string({maxLength: 20}), (raw) => {
            const once = preprocess(raw);
            expect(once.length).toBe(3);
            expect(preprocess(once)).toBe(once);
        }));
    });

    it("arrives lit rather than dark when nothing has been said about it", () => {
        // A lamp with no metadata is an ordinary light, not a maximal one.
        const lamp = lampWith("");
        expect(LampObjectTypeConfig.util.getIntensity(lamp)).toBeGreaterThanOrEqual(MIN_LAMP_INTENSITY);
        expect(LampObjectTypeConfig.util.getIntensity(lamp)).toBeLessThan(MAX_LAMP_INTENSITY);
        expect(LampObjectTypeConfig.util.getRange(lamp)).toBeGreaterThan(MIN_LAMP_RANGE);
        expect(LampObjectTypeConfig.util.getRange(lamp)).toBeLessThanOrEqual(MAX_LAMP_RANGE);
        expect(ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME,
            LampObjectTypeConfig.util.getColorIndex(lamp)))).toBe("#ffffff");
    });

    it("reads a lamp stored by a version that knew fewer settings", () => {
        // Missing trailing chars fall back to defaults, so a short string is never dark or zero-range.
        const colorOnly = LampObjectTypeConfig.util.getDefaultLightProperties().substring(0, 1);
        const lamp = lampWith(colorOnly);
        expect(LampObjectTypeConfig.util.getIntensity(lamp)).toBe(
            LampObjectTypeConfig.util.getIntensity(lampWith("")));
        expect(LampObjectTypeConfig.util.getRange(lamp)).toBe(
            LampObjectTypeConfig.util.getRange(lampWith("")));
    });

    it("draws the lamp in the color it lights the room with, whatever look it has", () => {
        // The glow derives from the same setting as the light, so glow and light never disagree, and
        // no stored look can override it.
        const composer = LampObjectTypeConfig.components.spawnedByAny.instancedMeshComposer;
        const presetLooks = LampCompositionConstants.presets.map(preset =>
            CompositionMetadataUtil.encode(composer.codecType, composer.codecVersion, preset));

        fc.assert(fc.property(colorIndices, intensities, ranges, fc.constantFrom(...presetLooks),
            (colorIndex, intensity, range, look) => {
                const lamp = lampWith(LampObjectTypeConfig.util.encodeLightProperties(
                    colorIndex, intensity, range));
                const lightColor = ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME, colorIndex);

                const {parts: defaultParts} = composer.generateDefaultParts(lamp);
                const storedParts: InstancedMeshCompositionPart[] = [];
                LampCompositionCodec.decode(look, UNIT_VEC3, {}, storedParts);

                for (const parts of [defaultParts, storedParts])
                {
                    composer.deriveParts(lamp, parts);
                    const glows = parts.filter(part => part.materialId == INSTANCED_EMISSIVE_MATERIAL_ID);
                    expect(glows).toHaveLength(1);
                    expect(glows[0].color).toEqual(lightColor);
                }
            }));
    });
});

describe("how a lamp looks", () => {
    const lampSize = (scale: number) => ObjectScaleUtil.getObjectSize(lampTypeIndex, {x: scale, y: scale, z: 1});
    const decode = (params: LampCompositionParams, size: Vec3) =>
    {
        const parts: InstancedMeshCompositionPart[] = [];
        LampCompositionCodec.decode(CompositionMetadataUtil.encode(InstancedMeshCompositionCodecTypeEnumMap.Lamp,
            0, params), size, {}, parts);
        return {
            glow: parts.find(part => part.materialId == INSTANCED_EMISSIVE_MATERIAL_ID)!,
            board: parts.find(part => part.materialId == INSTANCED_WOOD_MATERIAL_ID),
        };
    };
    const scaling = LampObjectTypeConfig.scaling;
    const scales = fc.constantFrom(...[0, 1, 2].map(i => scaling.minScale.x + i * scaling.scaleStep.x));
    const margins = fc.integer({min: 0, max: Math.round(MarginCompositionConstants.maxMargin
        / MarginCompositionConstants.marginStep)}).map(step => MarginCompositionConstants.fromMarginStep(step));
    const minGlowSize = MarginCompositionConstants.minInnerSize;
    const thicknesses = fc.integer({min: 0, max: MouldingCompositionConstants.numThicknessSteps - 1})
        .map(step => MouldingCompositionConstants.fromThicknessStep(step));

    it("starts as a bare glow over its whole footprint, the same as a lamp with nothing stored", () => {
        const first = LampCompositionConstants.presets[0];
        expect(first.framed).toBe(false);
        expect(first.margin).toBe(0);

        const lamp = new AddObjectSignal("room", "user", "User", lampTypeIndex, "lamp",
            new ObjectTransform({x: 1, y: 1, z: 1}, {x: 0, y: 0, z: -1}, {x: 1.5, y: 0.5, z: 1}), {});
        const {params, parts} = LampObjectTypeConfig.components.spawnedByAny.instancedMeshComposer
            .generateDefaultParts(lamp);
        expect(params.framed).toBe(false);
        expect(params.margin).toBe(0);
        expect(parts).toHaveLength(1);
        expect(parts[0].materialId).toBe(INSTANCED_EMISSIVE_MATERIAL_ID);
        const size = ObjectScaleUtil.getObjectSize(lampTypeIndex, lamp.transform.scale);
        expect(parts[0].scale.x).toBeCloseTo(size.x, 6);
        expect(parts[0].scale.y).toBeCloseTo(size.y, 6);
    });

    it("keeps its look through a round trip", () => {
        for (const preset of LampCompositionConstants.presets)
        {
            const decoded: LampCompositionParams = {} as LampCompositionParams;
            LampCompositionCodec.decode(CompositionMetadataUtil.encode(
                InstancedMeshCompositionCodecTypeEnumMap.Lamp, 0, preset), UNIT_VEC3, decoded, []);
            expect(decoded).toEqual(preset);
        }
    });

    it("draws inside its margin on every side, and never past its footprint", () => {
        fc.assert(fc.property(scales, margins, fc.boolean(), thicknesses, (scale, margin, framed, thickness) => {
            const size = lampSize(scale);
            const {glow, board} = decode({...LampCompositionConstants.presets[1], framed, margin,
                mouldingThickness: thickness}, size);
            const drawn = board ?? glow;
            for (const axis of ["x", "y"] as const)
            {
                expect(drawn.scale[axis]).toBeLessThanOrEqual(size[axis] + 1e-9);
                // Short of the margin only where the glow would otherwise vanish.
                if (drawn.scale[axis] > size[axis] - 2 * margin + 1e-9)
                    expect(glow.scale[axis]).toBeCloseTo(minGlowSize, 6);
            }
        }));
    });

    it("keeps its band the width it was given, at any size and margin, and a glow inside it", () => {
        fc.assert(fc.property(scales, margins, thicknesses, (scale, margin, thickness) => {
            const {glow, board} = decode({...LampCompositionConstants.presets[1], framed: true, margin,
                mouldingThickness: thickness}, lampSize(scale));
            expect(board!.mouldingThickness).toBe(thickness);
            expect(glow.scale.x).toBeCloseTo(board!.scale.x - 2 * thickness, 6);
            expect(glow.scale.y).toBeCloseTo(board!.scale.y - 2 * thickness, 6);
            expect(glow.scale.x).toBeGreaterThanOrEqual(minGlowSize - 1e-9);
            expect(glow.scale.y).toBeGreaterThanOrEqual(minGlowSize - 1e-9);
            // In front of the band, so the two never fight over depth.
            expect(glow.offset.z).toBeGreaterThan(board!.offset.z);
        }));
    });

    it("decodes whatever it is handed into a lamp that can be drawn", () => {
        fc.assert(fc.property(fc.string({maxLength: 12}), (garbage) => {
            const parts: InstancedMeshCompositionPart[] = [];
            const prefix = CompositionMetadataUtil.getCodecPrefix(InstancedMeshCompositionCodecTypeEnumMap.Lamp, 0);
            expect(() => LampCompositionCodec.decode(prefix + garbage, UNIT_VEC3, {}, parts)).not.toThrow();
            expect(parts.filter(part => part.materialId == INSTANCED_EMISSIVE_MATERIAL_ID)).toHaveLength(1);
        }));
    });
});

describe("a lamp on the floor", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("is walked over, and never lifts a player standing on it", async () => {
        await runScenario({
            name: "standing on a floor lamp",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: ({ users }) => {
                const user = users[0].user;
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const spot: Vec3 = {x: 8.5, y: 0, z: 8.5};
                expect(ObjectUpdateUtil.addObject(user, room, new AddObjectSignal(room.id, user.id,
                    user.userName, lampTypeIndex, "floor-lamp",
                    new ObjectTransform(spot, {x: 0, y: 1, z: 0}, {...UNIT_VEC3})))).toBe(true);

                // A real player collider on the lamp, under gravity, through the real physics engine.
                const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
                const objectId = "stander";
                const dir: Vec3 = {x: 0, y: 0, z: 1};
                const standingY = spot.y + 0.5 * PLAYER_HEIGHT;
                let pos: Vec3 = {x: spot.x, y: standingY, z: spot.z};
                PhysicsManager.addObject(room.id, objectId, playerTypeIndex,
                    PhysicsColliderStateUtil.getObjectColliderState(playerTypeIndex,
                        new ObjectTransform(pos, dir, {...UNIT_VEC3}))!);

                // The lamp's box stands just proud of the floor, so it is under the player's feet.
                const physicsRoom = PhysicsManager.physicsRooms[room.id];
                expect(PhysicsColliderStateUtil.findOverlappingColliderStates(physicsRoom,
                    physicsRoom.objectById[objectId].colliderState.hitbox)
                    .has(physicsRoom.objectById["floor-lamp"].colliderState)).toBe(true);

                const deltaTime = 1 / 60;
                for (let frame = 0; frame < 60; ++frame)
                {
                    const velocity = PhysicsManager.getAdjustedVelocity(room.id, objectId,
                        {x: 0, y: -GRAVITY_SPEED, z: 0});
                    expect(velocity.y, `pushed up on frame ${frame}`).toBeLessThanOrEqual(0);
                    pos = PhysicsManager.setObjectTransform(room.id, objectId, new ObjectTransform(
                        {x: pos.x + velocity.x * deltaTime, y: pos.y + velocity.y * deltaTime,
                            z: pos.z + velocity.z * deltaTime}, dir, {...UNIT_VEC3}), false).transform.pos;
                    expect(pos.y).toBeCloseTo(standingY, 2);
                }
                PhysicsManager.removeObject(room.id, objectId);
            },
        });
    });
});
