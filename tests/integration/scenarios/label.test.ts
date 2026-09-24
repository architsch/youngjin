/**
 * Scenario tests: labels (signs on a wall, placed and edited under the doors' rule) — permissions, the
 * lettering settings every label carries (LabelFont), a label's plaque, and a room at every cap, holding
 * the longest text anyone can write, still fitting the encoding buffer.
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
import LabelTextUtil from "../../../src/shared/object/util/labelTextUtil";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import LabelObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/labelObjectTypeConfig";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import BufferState from "../../../src/shared/networking/types/bufferState";
import { MAX_ENCODED_OBJECTS_BYTES } from "../../../src/shared/networking/util/encodingUtil";
import Room from "../../../src/shared/room/types/room";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import StringUtil from "../../../src/shared/math/util/stringUtil";
import ImageMapUtil from "../../../src/shared/graphics/image/util/imageMapUtil";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import { InstancedMeshCompositionParams } from "../../../src/shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import CompositionMetadataUtil from "../../../src/shared/graphics/mesh/composition/util/compositionMetadataUtil";
import { LabelCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/labelCompositionCodec";
import LabelCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/labelCompositionConstants";
import MouldingCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/mouldingCompositionConstants";
import MarginCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/marginCompositionConstants";
import { DOCUMENT_ID_MAX_LENGTH, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
    INSTANCED_WOOD_MATERIAL_ID, LABEL_COLOR_PALETTE_NAME, OBJECT_LABEL_MAX_LENGTH, OBJECT_MESSAGE_MAX_LENGTH,
    UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

const labelTypeIndex = ObjectTypeConfigMap.getIndexByType("Label");
const MAX_LABELS_PER_ROOM = ObjectCategoryConfigMap.getMaxCountPerRoom(LabelObjectTypeConfig.category);

function makeUser(id: string, userType: number, ownedRoomID: string = ""): User
{
    return new User(id, `User_${id}`, userType, `${id}@test.com`, "", "", ownedRoomID);
}

const ADMIN = makeUser("an-admin", UserTypeEnumMap.Admin);
const MEMBER = makeUser("a-member", UserTypeEnumMap.Member);
const GUEST = makeUser("a-guest", UserTypeEnumMap.Guest);
// Ownership is the user naming the room as their own.
const OWNER = makeUser("an-owner", UserTypeEnumMap.Member, "regular");

// A stretch of boundary wall the filled-in labels never reach, so a cap refusal is the cap and not the wall.
const CLEAR_COL_OFFSET = 5;

// A label on the boundary wall, clear of the room's door.
function makeLabelSignal(room: Room, sourceUser: User, objectId: string = "new-label",
    colOffset: number = -5): AddObjectSignal
{
    return new AddObjectSignal(room.id, sourceUser.id, sourceUser.userName, labelTypeIndex, objectId,
        new ObjectTransform(
            {
                x: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL + colOffset + 0.5,
                y: 2.25,
                z: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW,
            },
            {x: 0, y: 0, z: -1}, {...UNIT_VEC3}),
        {[ObjectMetadataKeyEnumMap.Label]: new EncodableByteString("Library")});
}

describe("label permissions", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("lets an admin put up a label in a hub, and nobody else", async () => {
        await runScenario({
            name: "putting up a label in a hub",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const canAdd = (user: User) =>
                    ObjectUpdateUtil.canAddObject(user, room, makeLabelSignal(room, user));

                expect(canAdd(ADMIN)).toBe(true);
                expect(canAdd(MEMBER)).toBe(false);
                expect(canAdd(GUEST)).toBe(false);
            },
        });
    });

    it("lets a regular room's owner put up a label there, and nobody else, not even an admin", async () => {
        // The doors' rule: the room's superuser only.
        await runScenario({
            name: "putting up a label in a regular room",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter("regular")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["regular"].room;
                const canAdd = (user: User) =>
                    ObjectUpdateUtil.canAddObject(user, room, makeLabelSignal(room, user));

                expect(canAdd(OWNER)).toBe(true);
                for (const user of [ADMIN, MEMBER, GUEST])
                    expect(canAdd(user)).toBe(false);
            },
        });
    });

    it("refuses a label put up under somebody else's name", async () => {
        await runScenario({
            name: "spoofed label",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room, makeLabelSignal(room, MEMBER))).toBe(false);
            },
        });
    });

    it("lets only an admin take a label down, move it, or rewrite it", async () => {
        await runScenario({
            name: "editing a hub's label",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const label = makeLabelSignal(room, ADMIN);
                room.objectGroup.addObject(label);

                const canRemove = (user: User) => ObjectUpdateUtil.canRemoveObject(user, room,
                    new RemoveObjectSignal(room.id, label.objectId));
                const canMove = (user: User) => ObjectUpdateUtil.canSetObjectTransform(user, room,
                    new SetObjectTransformSignal(room.id, label.objectId, label.transform, true));
                const canRewrite = (user: User) => ObjectUpdateUtil.canSetObjectMetadata(user, room,
                    new SetObjectMetadataSignal(room.id, label.objectId, ObjectMetadataKeyEnumMap.Label, "Gallery"));

                expect(canRemove(ADMIN)).toBe(true);
                expect(canMove(ADMIN)).toBe(true);
                expect(canRewrite(ADMIN)).toBe(true);
                for (const user of [MEMBER, GUEST])
                {
                    expect(canRemove(user)).toBe(false);
                    expect(canMove(user)).toBe(false);
                    expect(canRewrite(user)).toBe(false);
                }

                // Placed by a gizmo, never moved the way something with physics is.
                expect(ObjectUpdateUtil.canSetObjectTransform(ADMIN, room,
                    new SetObjectTransformSignal(room.id, label.objectId, label.transform, false))).toBe(false);
            },
        });
    });

    it("answers only to its text, its lettering and its look", async () => {
        await runScenario({
            name: "label metadata whitelist",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                const label = makeLabelSignal(room, ADMIN);
                room.objectGroup.addObject(label);
                const canSet = (key: number, value: string) => ObjectUpdateUtil.canSetObjectMetadata(ADMIN, room,
                    new SetObjectMetadataSignal(room.id, label.objectId, key, value));

                expect(canSet(ObjectMetadataKeyEnumMap.Label, "Gallery")).toBe(true);
                expect(canSet(ObjectMetadataKeyEnumMap.LabelColor, "3")).toBe(true);
                expect(canSet(ObjectMetadataKeyEnumMap.LabelFont, LabelTextUtil.encodeFont(false, 96))).toBe(true);
                expect(canSet(ObjectMetadataKeyEnumMap.InstancedMeshComposition, "abc")).toBe(true);

                expect(canSet(ObjectMetadataKeyEnumMap.ImagePath, "some/image")).toBe(false);
                expect(canSet(ObjectMetadataKeyEnumMap.DestinationRoomId, "some-room")).toBe(false);
                expect(canSet(ObjectMetadataKeyEnumMap.LightProperties, "abc")).toBe(false);
            },
        });
    });

    it("refuses a label once the room holds as many as its atlas was sized for", async () => {
        await runScenario({
            name: "the label cap",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = ServerRoomManager.roomRuntimeMemories["hub"].room;
                for (let i = 0; i < MAX_LABELS_PER_ROOM; ++i)
                    room.objectGroup.addObject(makeLabelSignal(room, ADMIN, `label-${i}`, -5 - i));
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room,
                    makeLabelSignal(room, ADMIN, "one-too-many", CLEAR_COL_OFFSET))).toBe(false);
            },
        });
    });
});

describe("a label's lettering", () => {
    const fontSizes = LabelTextUtil.fontSizes;
    const withFont = (font?: string) => new AddObjectSignal("room", "user", "User", labelTypeIndex, "label",
        new ObjectTransform({x: 1, y: 1, z: 1}, {x: 0, y: 0, z: -1}, {...UNIT_VEC3}),
        font == undefined ? {} : {[ObjectMetadataKeyEnumMap.LabelFont]: new EncodableByteString(font)});

    it("fits the text to its patch until told a size", () => {
        expect(LabelTextUtil.getFont(withFont()).autoSize).toBe(true);
        expect(LabelTextUtil.getFont(withFont("")).autoSize).toBe(true);
    });

    it("offers few enough sizes to step through, smallest to largest", () => {
        expect(fontSizes.length).toBeLessThanOrEqual(16);
        for (let i = 1; i < fontSizes.length; ++i)
            expect(fontSizes[i]).toBeGreaterThan(fontSizes[i - 1]);
        expect(fontSizes).toContain(LabelTextUtil.getFont(withFont("")).fontSize);
    });

    it("comes back exactly as it was set, on any size the stepper offers", () => {
        fc.assert(fc.property(fc.boolean(), fc.constantFrom(...fontSizes), (autoSize, fontSize) => {
            expect(LabelTextUtil.getFont(withFont(LabelTextUtil.encodeFont(autoSize, fontSize))))
                .toEqual({autoSize, fontSize});
        }));
    });

    it("is stored as lettering a label can be drawn in, whatever arrived", () => {
        const preprocess = (value: string) =>
            ObjectMetadataEntryMap.preprocess(ObjectMetadataKeyEnumMap.LabelFont, value);
        fc.assert(fc.property(fc.string(), (garbage) => {
            const stored = preprocess(garbage);
            expect(preprocess(stored)).toBe(stored);
            expect(fontSizes).toContain(LabelTextUtil.getFont(withFont(stored)).fontSize);
        }), {numRuns: 300});
    });

    it("stores a size between two on offer as the nearer of them by ratio", () => {
        const [smallest, next] = fontSizes;
        const between = Math.sqrt(smallest * next); // equally far from both by ratio
        expect(LabelTextUtil.getFont(withFont(LabelTextUtil.encodeFont(false, between * 0.99))).fontSize)
            .toBe(smallest);
        expect(LabelTextUtil.getFont(withFont(LabelTextUtil.encodeFont(false, between * 1.01))).fontSize)
            .toBe(next);
    });

    it("holds a size asked for beyond the ones on offer to the ends of them", () => {
        expect(LabelTextUtil.getFont(withFont(LabelTextUtil.encodeFont(false, 10_000))).fontSize)
            .toBe(fontSizes[fontSizes.length - 1]);
        expect(LabelTextUtil.getFont(withFont(LabelTextUtil.encodeFont(false, -5))).fontSize)
            .toBe(fontSizes[0]);
        expect(LabelTextUtil.getFont(withFont(LabelTextUtil.encodeFont(false, NaN))).fontSize)
            .toBe(fontSizes[0]);
    });

    it("keeps text up to its length in characters, not in the code units an emoji takes two of", () => {
        const preprocess = (value: string) =>
            ObjectMetadataEntryMap.preprocess(ObjectMetadataKeyEnumMap.Label, value);
        const stored = preprocess("😀".repeat(OBJECT_LABEL_MAX_LENGTH + 10));
        expect(Array.from(stored)).toHaveLength(OBJECT_LABEL_MAX_LENGTH);
        expect(stored).toBe("😀".repeat(OBJECT_LABEL_MAX_LENGTH));
    });

    it("opens the color picker on the ink a label is drawn in until one is picked", () => {
        const label = withFont();
        expect(LabelTextUtil.getColorIndex(label)).toBe(ColorUtil.rgbToPaletteIndex(LABEL_COLOR_PALETTE_NAME,
            ColorUtil.hexToRGB(LabelObjectTypeConfig.components.spawnedByAny.labelText.defaultFontColorHex)));
    });
});

describe("a label's markup", () => {
    const styled = (text: string) => LabelTextUtil.parseText(text).map(({text, style}) => ({text,
        styles: [style.bold && "b", style.italic && "i", style.underline && "u", style.strikethrough && "s"]
            .filter(Boolean).join(""), scale: style.scale, fontFace: style.fontFace}));

    it("styles only the tags it knows, leaving any other in the text as typed", () => {
        expect(styled("<B>bold</b> <u><s>both</s></u> <script>alert(1)</script>")).toEqual([
            {text: "bold", styles: "b", scale: 1, fontFace: "serif"},
            {text: " ", styles: "", scale: 1, fontFace: "serif"},
            {text: "both", styles: "us", scale: 1, fontFace: "serif"},
            {text: " <script>alert(1)</script>", styles: "", scale: 1, fontFace: "serif"},
        ]);
    });

    it("reads <font> sizes and faces as browsers do, and nothing else of it", () => {
        const fontOf = (attributes: string) => styled(`<font ${attributes}>x</font>`)[0];
        expect(fontOf("size=1").scale).toBe(0.625);
        expect(fontOf("size=\"+1\"").scale).toBe(1.125);
        expect(fontOf("size='-9'").scale).toBe(0.625);
        expect(fontOf("size=99").scale).toBe(3);
        expect(fontOf("size=big").scale).toBe(1);
        expect(fontOf("face=\" Sans-Serif \"").fontFace).toBe("sans-serif");
        expect(fontOf("face=Papyrus").fontFace).toBe("serif");
        expect(fontOf("color=red style=\"x\" size=7 size=1")).toEqual(
            {text: "x", styles: "", scale: 3, fontFace: "serif"});
    });

    it("closes what was opened inside a closing tag, and drops one with nothing to close", () => {
        expect(styled("<b>a<i>b</b>c</i>d").map(({text, styles}) => [text, styles]))
            .toEqual([["a", "b"], ["b", "bi"], ["cd", ""]]);
    });

    it("keeps an unclosed tag's style to the end, and reads a self-closed one as nothing", () => {
        expect(styled("<i/>a<i>b").map(({text, styles}) => [text, styles])).toEqual([["a", ""], ["b", "i"]]);
    });

    it("writes out the characters of a tag's entities as text", () => {
        expect(styled("&lt;b&gt;x&lt;/b&gt; &amp;amp; &copy;")).toEqual(
            [{text: "<b>x</b> &amp; &copy;", styles: "", scale: 1, fontFace: "serif"}]);
    });

    it("takes no inherited property's name for a tag it knows", () => {
        const text = "<constructor>x</constructor><toString>y<__proto__>";
        expect(styled(text)).toEqual([{text, styles: "", scale: 1, fontFace: "serif"}]);
    });

    it("keeps every character of text that holds no markup", () => {
        fc.assert(fc.property(fc.string().filter(str => !str.includes("<") && !str.includes("&")), (text) => {
            expect(LabelTextUtil.parseText(text).map(span => span.text).join("")).toBe(text);
        }), {numRuns: 300});
    });

    it("reads the longest malformed markup a label can hold at once", () => {
        const start = performance.now();
        LabelTextUtil.parseText(`<font${" a=1".repeat(OBJECT_LABEL_MAX_LENGTH / 4)}`);
        LabelTextUtil.parseText("<b".repeat(OBJECT_LABEL_MAX_LENGTH / 2));
        expect(performance.now() - start).toBeLessThan(100);
    });

    it("is named by its text as read: no markup, and whitespace between words one space", () => {
        expect(LabelTextUtil.toName(" <b>Grand</b>\n\n  <font size=7>Library</font> ")).toBe("Grand Library");
        expect(LabelTextUtil.toName("<i> </i>")).toBe("");
    });
});

describe("a label's plaque", () => {
    const composer = LabelObjectTypeConfig.components.spawnedByAny.instancedMeshComposer;
    const prefix = CompositionMetadataUtil.getCodecPrefix(InstancedMeshCompositionCodecTypeEnumMap.Label, 0);
    const baseSize = ObjectScaleUtil.getObjectSize(labelTypeIndex, UNIT_VEC3);
    const decode = (encoded: string) => {
        const params: InstancedMeshCompositionParams = {};
        const parts: InstancedMeshCompositionPart[] = [];
        LabelCompositionCodec.decode(encoded, baseSize, params, parts);
        return {params, parts};
    };
    const paletteSize = ColorUtil.getPaletteSize("Timber");
    const anyLook = fc.record({
        frame: fc.integer({min: 0, max: paletteSize - 1}),
        inner: fc.integer({min: 0, max: paletteSize - 1}),
        thickness: fc.integer({min: 0, max: MouldingCompositionConstants.numThicknessSteps - 1}),
        convex: fc.boolean(),
        framed: fc.boolean(),
        margin: fc.integer({min: 0, max: Math.round(MarginCompositionConstants.maxMargin / MarginCompositionConstants.marginStep)}),
    }).map(look => ({
        colors: {frame: ColorUtil.paletteIndexToRGB("Timber", look.frame), inner: ColorUtil.paletteIndexToRGB("Timber", look.inner)},
        mouldingThickness: MouldingCompositionConstants.fromThicknessStep(look.thickness),
        mouldingIsConvex: look.convex,
        framed: look.framed,
        margin: MarginCompositionConstants.fromMarginStep(look.margin),
    }));

    it("composes through a codec of its own", () => {
        expect(composer.codecType).toBe(InstancedMeshCompositionCodecTypeEnumMap.Label);
    });

    it("keeps any look through a round trip, and re-encodes to the same string", () => {
        fc.assert(fc.property(anyLook, (look) => {
            const encoded = CompositionMetadataUtil.encode(InstancedMeshCompositionCodecTypeEnumMap.Label, 0, look);
            const {params, parts} = decode(encoded);
            expect(params).toEqual(look);
            expect(CompositionMetadataUtil.encode(InstancedMeshCompositionCodecTypeEnumMap.Label, 0, params))
                .toBe(encoded);
            // A plaque is the board alone, its inside in the plaque color; without a frame there is nothing.
            expect(parts).toHaveLength(look.framed ? 1 : 0);
            if (look.framed)
            {
                expect(parts[0].materialId).toBe(INSTANCED_WOOD_MATERIAL_ID);
                expect(parts[0].color).toEqual(look.colors.inner);
                expect(parts[0].mouldingColor).toEqual(look.colors.frame);
            }
        }), {numRuns: 200});
    });

    it("storing nothing is lettering straight on the wall", () => {
        const {params, parts} = decode(prefix);
        expect(params.framed).toBe(false);
        expect(parts).toHaveLength(0);
    });

    it("starts as a framed preset that depends on where it hangs", () => {
        const at = (objectId: string) => composer.generateDefaultParts(new AddObjectSignal("room", "user", "User",
            labelTypeIndex, objectId, new ObjectTransform({x: 1, y: 1, z: 1}, {x: 0, y: 0, z: -1}, {...UNIT_VEC3})));
        expect(CompositionMetadataUtil.encode(composer.codecType, 0, at("same").params))
            .toBe(CompositionMetadataUtil.encode(composer.codecType, 0, at("same").params));

        const finishes = new Set<string>();
        for (let i = 0; i < 40; ++i)
        {
            const {params, parts} = at(`label-${i}`);
            expect(params.framed).toBe(true);
            expect(parts).toHaveLength(1);
            finishes.add(CompositionMetadataUtil.encode(composer.codecType, 0, params));
        }
        expect(finishes.size).toBeGreaterThan(1);
    });

    it("every preset survives the codec's quantization, and no two are alike", () => {
        const encoded = new Set<string>();
        for (const preset of LabelCompositionConstants.presets)
        {
            const look = {...preset, framed: true, margin: 0};
            const string = CompositionMetadataUtil.encode(InstancedMeshCompositionCodecTypeEnumMap.Label, 0, look);
            expect(decode(string).params).toEqual(look);
            encoded.add(string);
        }
        expect(encoded.size).toBe(LabelCompositionConstants.presets.length);
    });

    it("decodes whatever it is handed into a plaque that can be drawn", () => {
        fc.assert(fc.property(fc.string({maxLength: 12}), (garbage) => {
            expect(() => decode(prefix + garbage)).not.toThrow();
            for (const part of decode(prefix + garbage).parts)
            {
                expect(part.scale.x).toBeGreaterThan(0);
                expect(part.scale.y).toBeGreaterThan(0);
            }
        }), {numRuns: 300});
    });
});

describe("a room full of the longest text", () => {
    // Four bytes each in UTF-8, the most a character can take.
    const longest = (numCharacters: number) => "😀".repeat(numCharacters);

    it("fits the encoding buffer with every category at its cap", () => {
        const longestImagePath = ImageMapUtil.getImageMap("CanvasImageMap").getImageMetadataList()
            .map(metadata => metadata.path).reduce((a, b) => (a.length >= b.length) ? a : b);
        // Every string as long as it can be stored (compositions as their codec writes them).
        const longestMetadata: {[key: number]: string} = {
            [ObjectMetadataKeyEnumMap.SentMessage]: longest(OBJECT_MESSAGE_MAX_LENGTH),
            [ObjectMetadataKeyEnumMap.ImagePath]: longestImagePath,
            [ObjectMetadataKeyEnumMap.Label]: longest(OBJECT_LABEL_MAX_LENGTH),
            [ObjectMetadataKeyEnumMap.LabelColor]: `${ColorUtil.getPaletteSize(LABEL_COLOR_PALETTE_NAME) - 1}`,
            [ObjectMetadataKeyEnumMap.LabelFont]: LabelTextUtil.encodeFont(false, LabelTextUtil.maxFontSize),
            // Room ids are ASCII document ids.
            [ObjectMetadataKeyEnumMap.DestinationRoomId]: "r".repeat(DOCUMENT_ID_MAX_LENGTH),
            [ObjectMetadataKeyEnumMap.DestinationDoorLabel]: longest(OBJECT_LABEL_MAX_LENGTH),
            [ObjectMetadataKeyEnumMap.DoorType]: "0",
            [ObjectMetadataKeyEnumMap.LightProperties]: "~~~",
        };
        // Asked of an admin in a hub, who may write the most.
        const hub = {roomType: RoomTypeEnumMap.Hub} as Room;
        const canHold = (config: ReturnType<typeof ObjectTypeConfigMap.getConfigByIndex>, key: number) => {
            const obj = new AddObjectSignal("room", ADMIN.id, ADMIN.userName, 0, "x",
                new ObjectTransform({...UNIT_VEC3}, {x: 0, y: 0, z: -1}, {...UNIT_VEC3}));
            return config.canUserSetObjectMetadata(ADMIN, hub, obj,
                new SetObjectMetadataSignal("room", "x", key, longestMetadata[key]));
        };

        const objects: AddObjectSignal[] = [];
        for (const config of ObjectTypeConfigMap.getAllConfigs())
        {
            const cap = ObjectCategoryConfigMap.getConfig(config.category).maxCountPerRoom;
            if (cap == undefined)
                continue;
            const objectTypeIndex = ObjectTypeConfigMap.getIndexByType(config.objectType);
            for (let i = 0; i < cap; ++i)
            {
                // Players each have their own owner, with a name as long as a name can be.
                const owner = `${config.objectType}-owner-${i}`;
                const obj = new AddObjectSignal("room", owner, "n".repeat(16), objectTypeIndex,
                    StringUtil.getHashCode(`${config.objectType}/${i}`).toString(36),
                    new ObjectTransform({x: 1, y: 1, z: 1}, {x: 0, y: 0, z: -1}, {...UNIT_VEC3}));
                for (const key of Object.keys(longestMetadata).map(Number))
                {
                    if (config.objectType == "Player" ? key == ObjectMetadataKeyEnumMap.SentMessage : canHold(config, key))
                        obj.metadata[key] = new EncodableByteString(longestMetadata[key]);
                }
                const composer = config.components.spawnedByAny?.instancedMeshComposer;
                if (composer)
                {
                    obj.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition] = new EncodableByteString(
                        CompositionMetadataUtil.encode(composer.codecType, composer.codecVersion,
                            composer.generateDefaultParts(obj).params));
                }
                objects.push(obj);
            }
        }

        // Measured in a buffer with room to spare, since writes past a typed array's end are dropped.
        const bufferState = new BufferState(new Uint8Array(4 * MAX_ENCODED_OBJECTS_BYTES));
        new ObjectGroup(objects).encodeWithParams(bufferState, {});
        const longestLabels = objects.filter(obj =>
            obj.metadata[ObjectMetadataKeyEnumMap.Label]?.str == longestMetadata[ObjectMetadataKeyEnumMap.Label]);
        expect(longestLabels.length, "a door or a label was left without the longest text").toBe(
            ObjectCategoryConfigMap.getMaxCountPerRoom("Door") + MAX_LABELS_PER_ROOM);
        expect(bufferState.byteIndex).toBeLessThanOrEqual(MAX_ENCODED_OBJECTS_BYTES);
    });
});
