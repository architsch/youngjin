/**
 * Scenario tests: mirrors (an admin's alone; see MirrorObjectTypeConfig) — who may lay, move, resize, reframe and
 * remove one, the one a room may hold, the faces and sizes it takes, and its looks (its own copies of a canvas's, the
 * frameless first); the geometry of the reflection it shows (see MirrorProjectionUtil): through the camera reflected in
 * its glass, each point of the glass where the camera sees it but across the view, the view narrowed to the glass,
 * nothing behind the glass drawn, and each point of the room read back by the glass where it was drawn; the head light it
 * is drawn in, nearer the glass for it alone (see MirrorReflectionUtil); and what a reflection shows that the camera
 * doesn't (see InstancedMeshComposer.setHiddenFromCamera), the body the camera trails where the view has it.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// The composer's module chain reaches the renderer and the app, which a browser would have made.
vi.mock("../../../src/client/graphics/graphicsManager", () => ({ default: {} }));
vi.mock("../../../src/client/app", () => ({ default: { getCurrentRoom: vi.fn(), getUser: vi.fn() } }));
vi.mock("../../../src/client/object/clientObjectManager", () => ({ default: {} }));
// What a reflection is compiled against: the room alone will do.
vi.mock("../../../src/client/graphics/util/shaderPrecompileUtil", async () => {
    const THREE = await import("three");
    return { default: { getWarmupScene: async () => new THREE.Scene() } };
});

import * as THREE from "three";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_HUB, EMPTY_REGULAR, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ObjectCategoryConfigMap from "../../../src/shared/object/maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import ObjectCompositionUtil from "../../../src/shared/object/util/objectCompositionUtil";
import MirrorObjectTypeConfig, { MIRROR_COLOR_PALETTE_NAME,
    NUM_MIRROR_OPACITY_STEPS } from "../../../src/shared/object/types/objectTypeConfig/mirrorObjectTypeConfig";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import MirrorMaterialUtil from "../../../src/client/graphics/util/mirrorMaterialUtil";
import FanObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/fanObjectTypeConfig";
import CanvasObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
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
import PreEncodedCompositionIndexMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import PreEncodedCompositionStringMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionStringMap";
import CompositionMetadataUtil from "../../../src/shared/graphics/mesh/composition/util/compositionMetadataUtil";
import FramedPanelCompositionParams from "../../../src/shared/graphics/mesh/composition/types/compositionParams/framedPanelCompositionParams";
import { InstancedMeshCompositionParams } from "../../../src/shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import { INITIAL_MULTI_PLAYER_ENTRANCE_POS, MAX_ROOM_X, MAX_ROOM_Y,
    MAX_ROOM_Z } from "../../../src/shared/system/sharedConstants";
import MirrorProjectionUtil, { HEAD_LIGHT_GLASS_CLEARANCE,
    HEAD_LIGHT_SHIFT } from "../../../src/client/graphics/util/mirrorProjectionUtil";
import MirrorReflectionUtil from "../../../src/client/graphics/util/mirrorReflectionUtil";
import InstancedMeshComposer from "../../../src/client/object/components/instancedMeshComposer";
import { reflectionDrawingObservable } from "../../../src/client/system/clientObservables";
// A mirror's frame is decoded from its pre-encoded entry, which needs the part builders registered.
import "../../../src/shared/graphics/mesh/composition/instancedMeshCompositionBuilderMapDependencies";

const mirrorTypeIndex = ObjectTypeConfigMap.getIndexByType("Mirror");
const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const fanTypeIndex = ObjectTypeConfigMap.getIndexByType("Fan");
const CODEC_VERSION = MirrorObjectTypeConfig.components.spawnedByAny.instancedMeshComposer.codecVersion;
const LOOK_KEY = ObjectMetadataKeyEnumMap.InstancedMeshComposition;
const SURFACE_KEY = ObjectMetadataKeyEnumMap.MirrorProperties;
const UTIL = MirrorObjectTypeConfig.util;
const MIRROR_LOOKS = PreEncodedCompositionIndexMap.Mirror ?? [];
const CANVAS_LOOKS = PreEncodedCompositionIndexMap.Canvas ?? [];

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

// The farthest anything in a room is from anything else.
const ROOM_DIAGONAL = Math.hypot(MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z);

function lookOf(position: number): string
{
    return CompositionMetadataUtil.encodeIndexed(MIRROR_LOOKS[position], CODEC_VERSION);
}

function makeMirrorSignal(room: Room, sourceUser: User, objectId: string = "new-mirror", pos: Vec3 = WALL_SPOT,
    dir: Vec3 = WALL_FACING, metadata: ObjectMetadata = {[LOOK_KEY]: new EncodableByteString(lookOf(1))},
    scale: Vec3 = {x: 1, y: 1, z: 1}): AddObjectSignal
{
    return new AddObjectSignal(room.id, sourceUser.id, sourceUser.userName, mirrorTypeIndex, objectId,
        new ObjectTransform({...pos}, {...dir}, {...scale}), metadata);
}

function getHub(): Room
{
    return ServerRoomManager.roomRuntimeMemories["hub"].room;
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("mirror permissions", () => {
    it("are an admin's alone to lay, in a hub or in somebody else's room", async () => {
        await runScenario({
            name: "laying a mirror",
            rooms: [EMPTY_HUB, EMPTY_REGULAR],
            users: [userAtCenter("hub"), userAtCenter("regular")],
            assertions: () => {
                for (const roomId of ["hub", "regular"])
                {
                    const room = ServerRoomManager.roomRuntimeMemories[roomId].room;
                    expect(ObjectUpdateUtil.canAddObject(ADMIN, room, makeMirrorSignal(room, ADMIN)), roomId).toBe(true);
                    for (const user of [MEMBER, GUEST])
                    {
                        expect(ObjectUpdateUtil.canAddObject(user, room, makeMirrorSignal(room, user)),
                            `${user.userName} in the ${roomId}`).toBe(false);
                    }
                    // Under somebody else's name, not even an admin.
                    expect(ObjectUpdateUtil.canAddObject(ADMIN, room, makeMirrorSignal(room, MEMBER))).toBe(false);
                }
            },
        });
    });

    it("are an admin's alone to move, resize, reframe and remove, as placements only", async () => {
        await runScenario({
            name: "editing a mirror",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getHub();
                expect(ObjectUpdateUtil.addObject(ADMIN, room, makeMirrorSignal(room, ADMIN, "mirror"))).toBe(true);

                const moved = (ignorePhysics: boolean) => new SetObjectTransformSignal(room.id, "mirror",
                    new ObjectTransform({...WALL_SPOT, x: WALL_SPOT.x - 2}, {...WALL_FACING}, {x: 1, y: 1, z: 1}),
                    ignorePhysics);
                const resized = new SetObjectTransformSignal(room.id, "mirror",
                    new ObjectTransform({...WALL_SPOT}, {...WALL_FACING}, {x: 2, y: 1, z: 1}), true);
                const reframed = new SetObjectMetadataSignal(room.id, "mirror", LOOK_KEY, lookOf(5));
                const recolored = new SetObjectMetadataSignal(room.id, "mirror", SURFACE_KEY,
                    UTIL.encodeMirrorProperties(13, 4));
                const removed = new RemoveObjectSignal(room.id, "mirror");
                for (const user of [MEMBER, GUEST])
                {
                    expect(ObjectUpdateUtil.canSetObjectTransform(user, room, moved(true)), user.userName).toBe(false);
                    expect(ObjectUpdateUtil.canSetObjectTransform(user, room, resized), user.userName).toBe(false);
                    expect(ObjectUpdateUtil.canSetObjectMetadata(user, room, reframed), user.userName).toBe(false);
                    expect(ObjectUpdateUtil.canSetObjectMetadata(user, room, recolored), user.userName).toBe(false);
                    expect(ObjectUpdateUtil.canRemoveObject(user, room, removed), user.userName).toBe(false);
                }
                expect(ObjectUpdateUtil.setObjectMetadata(ADMIN, room, recolored)).toBe(true);
                expect(UTIL.getColorIndex(room.objectById["mirror"])).toBe(13);
                expect(UTIL.getOpacityStep(room.objectById["mirror"])).toBe(4);

                expect(ObjectUpdateUtil.canSetObjectTransform(ADMIN, room, moved(false))).toBe(false);
                expect(ObjectUpdateUtil.canSetObjectTransform(ADMIN, room, moved(true))).toBe(true);
                expect(ObjectUpdateUtil.setObjectTransform(ADMIN, room, resized).transform.scale)
                    .toMatchObject({x: 2, y: 1});
                expect(ObjectUpdateUtil.setObjectMetadata(ADMIN, room, reframed)).toBe(true);
                expect(room.objectById["mirror"].metadata[LOOK_KEY].str).toBe(lookOf(5));
                expect(ObjectUpdateUtil.canRemoveObject(ADMIN, room, removed)).toBe(true);
            },
        });
    });

    it("wear only a mirror's own looks, and take nothing of an admin's but a look and a surface", async () => {
        await runScenario({
            name: "what a mirror takes",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getHub();
                expect(ObjectUpdateUtil.addObject(ADMIN, room, makeMirrorSignal(room, ADMIN, "mirror"))).toBe(true);
                const canSet = (key: number, value: string) => ObjectUpdateUtil.canSetObjectMetadata(ADMIN, room,
                    new SetObjectMetadataSignal(room.id, "mirror", key, value));

                for (let position = 0; position < MIRROR_LOOKS.length; ++position)
                    expect(canSet(LOOK_KEY, lookOf(position)), `look ${position}`).toBe(true);
                // A canvas's look of the same frame is a canvas's, not a mirror's.
                expect(canSet(LOOK_KEY, CompositionMetadataUtil.encodeIndexed(CANVAS_LOOKS[1], CODEC_VERSION)))
                    .toBe(false);
                expect(canSet(SURFACE_KEY, UTIL.encodeMirrorProperties(0, NUM_MIRROR_OPACITY_STEPS - 1))).toBe(true);
                for (const key of [ObjectMetadataKeyEnumMap.ImagePath, ObjectMetadataKeyEnumMap.QuarterTurns,
                    ObjectMetadataKeyEnumMap.Label, ObjectMetadataKeyEnumMap.LightProperties])
                {
                    expect(canSet(key, "!!"), `key ${key}`).toBe(false);
                }

                // Nor is one laid in another type's look.
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room, makeMirrorSignal(room, ADMIN, "another", undefined,
                    undefined, {[LOOK_KEY]: new EncodableByteString(
                        CompositionMetadataUtil.encodeIndexed(CANVAS_LOOKS[1], CODEC_VERSION))}))).toBe(false);
            },
        });
    });
});

describe("the mirrors a room holds", () => {
    it("are one at most, whoever asks, and another goes up once it is gone", async () => {
        expect(ObjectCategoryConfigMap.getMaxCountPerRoom(MirrorObjectTypeConfig.category)).toBe(1);

        await runScenario({
            name: "the mirror cap",
            rooms: [EMPTY_HUB, EMPTY_REGULAR],
            users: [userAtCenter("hub"), userAtCenter("regular")],
            assertions: () => {
                const room = getHub();
                expect(ObjectUpdateUtil.addObject(ADMIN, room, makeMirrorSignal(room, ADMIN, "mirror"))).toBe(true);
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room, makeMirrorSignal(room, ADMIN, "second",
                    {...WALL_SPOT, x: WALL_SPOT.x - 3}))).toBe(false);

                // The cap is the mirrors' own: a canvas still goes up beside it, and another room takes a mirror.
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room, new AddObjectSignal(room.id, ADMIN.id,
                    ADMIN.userName, canvasTypeIndex, "a-canvas", new ObjectTransform({...WALL_SPOT, x: WALL_SPOT.x - 3},
                        {...WALL_FACING}, {x: 1, y: 1, z: 1})))).toBe(true);
                const regular = ServerRoomManager.roomRuntimeMemories["regular"].room;
                expect(ObjectUpdateUtil.canAddObject(ADMIN, regular, makeMirrorSignal(regular, ADMIN))).toBe(true);

                expect(ObjectUpdateUtil.removeObject(ADMIN, room, new RemoveObjectSignal(room.id, "mirror"))).toBe(true);
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room, makeMirrorSignal(room, ADMIN, "second",
                    {...WALL_SPOT, x: WALL_SPOT.x - 3}))).toBe(true);
            },
        });
    });

    it("hang on a wall, a floor or a ceiling, never in mid-air", async () => {
        await runScenario({
            name: "a mirror on every kind of face",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getHub();
                const spots: [string, Vec3, Vec3][] = [["wall", WALL_SPOT, WALL_FACING],
                    ["floor", FLOOR_SPOT, FLOOR_FACING], ["ceiling", CEILING_SPOT, CEILING_FACING]];
                for (const [name, pos, dir] of spots)
                {
                    expect(ObjectUpdateUtil.canAddObject(ADMIN, room, makeMirrorSignal(room, ADMIN, name, pos, dir)),
                        name).toBe(true);
                }
                expect(ObjectUpdateUtil.canAddObject(ADMIN, room, makeMirrorSignal(room, ADMIN, "floating",
                    {x: 8.5, y: 2, z: 8.5}, FLOOR_FACING))).toBe(false);
            },
        });
    });
});

describe("a mirror's size", () => {
    it("steps by a block's width across its face, as a canvas's does, up to twice a canvas's largest each way", () => {
        expect(MirrorObjectTypeConfig.scaling).toEqual(expect.objectContaining({
            scaleStep: {x: 0.5, y: 0.5, z: 0}, minScale: {x: 0.5, y: 0.5, z: 1}, maxScale: {x: 7, y: 7, z: 1}}));
        const canvasLargest = CanvasObjectTypeConfig.scaling.maxScale;
        expect(MirrorObjectTypeConfig.scaling.maxScale).toEqual({x: 2 * canvasLargest.x, y: 2 * canvasLargest.y, z: 1});
        expect(ObjectScaleUtil.sanitize(mirrorTypeIndex, {x: 9, y: 0.2, z: 2})).toEqual({x: 7, y: 0.5, z: 1});
        expect(ObjectScaleUtil.sanitize(mirrorTypeIndex, {x: 5.2, y: 6.9, z: 1})).toEqual({x: 5, y: 7, z: 1});
        expect(ObjectScaleUtil.sanitize(mirrorTypeIndex, {x: 1.4, y: 2.6, z: 1})).toEqual({x: 1.5, y: 2.5, z: 1});
    });

    it("hangs at its largest on a generated room's boundary wall, across both storeys", async () => {
        await runScenario({
            name: "the largest mirror",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getHub();
                const largest = makeMirrorSignal(room, ADMIN, "largest", {x: 6.5, y: 4, z: WALL_SPOT.z}, WALL_FACING,
                    undefined, {x: 7, y: 7, z: 1});
                expect(ObjectUpdateUtil.addObject(ADMIN, room, largest)).toBe(true);
                expect(room.objectById["largest"].transform.scale).toMatchObject({x: 7, y: 7});
            },
        });
    });

    it("starts tall enough to show a person whole, or as large as a canvas would where that doesn't fit", () => {
        expect(ObjectScaleUtil.getDefaultScale(mirrorTypeIndex, () => true)).toEqual({x: 1, y: 1.5, z: 1});
        expect(ObjectScaleUtil.getDefaultScale(mirrorTypeIndex, scale => scale.y <= 1)).toEqual({x: 1, y: 1, z: 1});
        expect(ObjectScaleUtil.getDefaultScale(mirrorTypeIndex, scale => scale.x <= 0.5))
            .toEqual({x: 0.5, y: 0.5, z: 1});
    });
});

describe("a mirror's looks", () => {
    it("are its own copies of a canvas's frames, in their order, the frameless first", () => {
        expect(MIRROR_LOOKS.length).toBe(CANVAS_LOOKS.length);
        MIRROR_LOOKS.forEach((compositionIndex, position) => {
            expect(compositionIndex, `look ${position}`).not.toBe(CANVAS_LOOKS[position]);
            expect(PreEncodedCompositionStringMap[compositionIndex], `look ${position}`)
                .toBe(PreEncodedCompositionStringMap[CANVAS_LOOKS[position]]);
        });

        const framed = (position: number) => {
            const params: InstancedMeshCompositionParams = {};
            const parts: InstancedMeshCompositionPart[] = [];
            CompositionMetadataUtil.decodeIndexed(MIRROR_LOOKS[position], CODEC_VERSION, {x: 1, y: 1, z: 1},
                params, parts);
            return (params as FramedPanelCompositionParams).framed;
        };
        expect(framed(0)).toBe(false);
        for (let position = 1; position < MIRROR_LOOKS.length; ++position)
            expect(framed(position), `look ${position}`).toBe(true);
    });

    it("are framed for a mirror that stores none, the same frame for everyone, seeded by its room and id", () => {
        const decode = (roomID: string, objectId: string) => {
            const obj = new AddObjectSignal(roomID, "admin", "Admin", mirrorTypeIndex, objectId,
                new ObjectTransform({...WALL_SPOT}, {...WALL_FACING}, {x: 1, y: 1, z: 1}), {});
            const params: InstancedMeshCompositionParams = {};
            ObjectCompositionUtil.decode(obj, params, []);
            return params as FramedPanelCompositionParams & {compositionIndex: number};
        };
        const seen = new Set<number>();
        for (let i = 0; i < 40; ++i)
        {
            const params = decode("hub", `mirror-${i}`);
            expect(params.framed, `mirror-${i}`).toBe(true);
            expect(MIRROR_LOOKS).toContain(params.compositionIndex);
            expect(decode("hub", `mirror-${i}`).compositionIndex).toBe(params.compositionIndex);
            seen.add(params.compositionIndex);
        }
        expect(seen.size).toBeGreaterThan(1);
    });
});

describe("a mirror's surface", () => {
    const mirrorWith = (mirrorProperties?: string) => new AddObjectSignal("room", "admin", "Admin", mirrorTypeIndex,
        "mirror", new ObjectTransform({...WALL_SPOT}, {...WALL_FACING}, {x: 1, y: 1, z: 1}),
        mirrorProperties == undefined ? {} : {[SURFACE_KEY]: new EncodableByteString(mirrorProperties)});

    it("is any color of the full spectrum, its own copy, and an opacity in steps of 5%, coming back exactly as set", () => {
        const numColors = ColorUtil.getPaletteSize(MIRROR_COLOR_PALETTE_NAME);
        expect(numColors).toBe(ColorUtil.getPaletteSize("Player"));
        expect(NUM_MIRROR_OPACITY_STEPS).toBe(21);
        // Stored as one character for the color, then one for the opacity, which never trade places.
        expect(UTIL.encodeMirrorProperties(5, 3)).toBe("&$");
        expect(UTIL.getDefaultMirrorProperties()).toBe("#!");
        for (let colorIndex = 0; colorIndex < numColors; ++colorIndex)
        {
            for (let step = 0; step < NUM_MIRROR_OPACITY_STEPS; ++step)
            {
                const mirror = mirrorWith(UTIL.encodeMirrorProperties(colorIndex, step));
                expect(UTIL.getColorIndex(mirror)).toBe(colorIndex);
                expect(UTIL.getOpacityStep(mirror)).toBe(step);
                expect(UTIL.getOpacity(mirror)).toBeCloseTo(step / 20, 12);
            }
        }
    });

    it("is a plain mirror where none is stored, a mid grey for when it is made to show, as a new mirror stores it", () => {
        for (const mirror of [mirrorWith(), mirrorWith(UTIL.getDefaultMirrorProperties())])
        {
            expect(UTIL.getOpacity(mirror)).toBe(0);
            expect(ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(MIRROR_COLOR_PALETTE_NAME, UTIL.getColorIndex(mirror))))
                .toBe("#979797");
        }
    });

    it("reads as one of those whatever is stored, and is stored as it reads", async () => {
        const numColors = ColorUtil.getPaletteSize(MIRROR_COLOR_PALETTE_NAME);
        for (const raw of ["", "~", "~~~~", "!", "\u0000\u0000", "ab", "￿￿"])
        {
            const mirror = mirrorWith(raw);
            expect(UTIL.getColorIndex(mirror), JSON.stringify(raw)).toBeGreaterThanOrEqual(0);
            expect(UTIL.getColorIndex(mirror), JSON.stringify(raw)).toBeLessThan(numColors);
            expect(UTIL.getOpacityStep(mirror), JSON.stringify(raw)).toBeGreaterThanOrEqual(0);
            expect(UTIL.getOpacityStep(mirror), JSON.stringify(raw)).toBeLessThan(NUM_MIRROR_OPACITY_STEPS);
            const canonical = UTIL.canonicalize(raw);
            expect(UTIL.canonicalize(canonical)).toBe(canonical);
            expect(UTIL.getColorIndex(mirrorWith(canonical))).toBe(UTIL.getColorIndex(mirror));
            expect(UTIL.getOpacityStep(mirrorWith(canonical))).toBe(UTIL.getOpacityStep(mirror));
        }
        // Past the ends: the last color, wholly opaque.
        expect(UTIL.getColorIndex(mirrorWith("~~"))).toBe(numColors - 1);
        expect(UTIL.getOpacityStep(mirrorWith("~~"))).toBe(NUM_MIRROR_OPACITY_STEPS - 1);

        await runScenario({
            name: "storing a mirror's surface",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: () => {
                const room = getHub();
                expect(ObjectUpdateUtil.addObject(ADMIN, room, makeMirrorSignal(room, ADMIN, "mirror"))).toBe(true);
                expect(ObjectUpdateUtil.setObjectMetadata(ADMIN, room,
                    new SetObjectMetadataSignal(room.id, "mirror", SURFACE_KEY, "~~~~"))).toBe(true);
                expect(room.objectById["mirror"].metadata[SURFACE_KEY].str).toBe(UTIL.canonicalize("~~~~"));
            },
        });
    });

    it("hides the reflection only when wholly opaque, which then isn't drawn, and is lit in linear color", () => {
        const shader = {uniforms: {} as {[name: string]: {value: any}}} as unknown as THREE.WebGLProgramParametersWithUniforms;
        MirrorMaterialUtil.bindUniforms(shader);
        for (const [opacity, opaque] of [[0, false], [0.5, false], [0.9, false], [1, true]] as const)
        {
            MirrorMaterialUtil.setSurface(255, 128, 0, opacity);
            expect(MirrorMaterialUtil.isSurfaceOpaque(), `${opacity}`).toBe(opaque);
            expect(shader.uniforms.mirrorSurfaceOpacity.value).toBe(opacity);
        }
        const color = shader.uniforms.mirrorSurfaceColor.value as THREE.Color;
        expect(color.r).toBeCloseTo(1, 6);
        expect(color.g).toBeCloseTo(new THREE.Color().setRGB(0, 128 / 255, 0, THREE.SRGBColorSpace).g, 6);
        expect(color.g).toBeLessThan(0.5 * 128 / 255);
        MirrorMaterialUtil.setSurface(0, 0, 0, 0);
    });
});

// The reflection's geometry, on a glass two wide and one and a half high on a wall facing +z, seen from in front of it,
// off to one side, a little above and looking down at it; and on the floor, seen from above it, looking down aslant.
describe("the reflection a mirror shows", () => {
    const GLASS_CENTER = new THREE.Vector3(5, 2, 3);
    const GLASS_SIZE = new THREE.Vector3(2, 1.5, 1);

    function makeCamera(position: Vec3, lookAt: Vec3): THREE.PerspectiveCamera
    {
        const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 100);
        camera.position.set(position.x, position.y, position.z);
        camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        return camera;
    }

    function makeGlass(): {matrix: THREE.Matrix4, plane: THREE.Plane, corners: THREE.Vector3[]}
    {
        return glassOf(new THREE.Matrix4().compose(GLASS_CENTER, new THREE.Quaternion(), GLASS_SIZE));
    }

    function glassOf(matrix: THREE.Matrix4): {matrix: THREE.Matrix4, plane: THREE.Plane, corners: THREE.Vector3[]}
    {
        return {matrix, plane: MirrorProjectionUtil.getGlassPlane(matrix, new THREE.Plane()),
            corners: MirrorProjectionUtil.getGlassCorners(matrix, [0, 1, 2, 3].map(() => new THREE.Vector3()))};
    }

    // Facing up, a little above the floor, as a floor's mirror hangs.
    function makeFloorGlass(): {matrix: THREE.Matrix4, plane: THREE.Plane, corners: THREE.Vector3[]}
    {
        return glassOf(new THREE.Matrix4().compose(new THREE.Vector3(8, 0.015, 9),
            new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)),
            GLASS_SIZE));
    }
    const floorCamera = makeCamera({x: 9.5, y: 2.5, z: 12.5}, {x: 8, y: 0, z: 9});

    // A point in clip space as a camera draws it.
    function clip(camera: THREE.Camera, point: THREE.Vector3): THREE.Vector4
    {
        return new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(camera.matrixWorldInverse)
            .applyMatrix4(camera.projectionMatrix);
    }

    function ndc(camera: THREE.Camera, point: THREE.Vector3): THREE.Vector2
    {
        const c = clip(camera, point);
        return new THREE.Vector2(c.x / c.w, c.y / c.w);
    }

    // Points of the glass, a few rows and columns of them, in the world.
    function glassPoints(matrix: THREE.Matrix4): THREE.Vector3[]
    {
        const points: THREE.Vector3[] = [];
        for (const u of [0.05, 0.3, 0.5, 0.8, 0.95])
        {
            for (const v of [0.05, 0.4, 0.6, 0.95])
                points.push(new THREE.Vector3(u - 0.5, v - 0.5, 0).applyMatrix4(matrix));
        }
        return points;
    }

    function reflectionOf(camera: THREE.PerspectiveCamera, plane: THREE.Plane, narrowedTo?: THREE.Box2)
        : THREE.PerspectiveCamera
    {
        const reflection = new THREE.PerspectiveCamera();
        MirrorProjectionUtil.reflectCamera(camera, plane, reflection);
        if (narrowedTo != undefined)
            MirrorProjectionUtil.setReflectionProjection(camera, narrowedTo, plane, reflection);
        else
            reflection.projectionMatrix.copy(camera.projectionMatrix);
        return reflection;
    }

    const camera = makeCamera({x: 6.5, y: 2.6, z: 7}, {x: 4.6, y: 1.8, z: 3});

    it("is seen through the camera reflected in the glass: each point of the glass where the camera sees it, but "
        + "across the view, as far off", () => {
        const {matrix, plane} = makeGlass();
        const reflection = reflectionOf(camera, plane);
        expect(reflection.matrixWorld.determinant()).toBeCloseTo(1, 6);
        expect(new THREE.Vector3().setFromMatrixPosition(reflection.matrixWorld).toArray().map(n => +n.toFixed(6)))
            .toEqual([6.5, 2.6, -1]);
        for (const [glassMatrix, glassPlane, viewer] of [[matrix, plane, camera],
            [makeFloorGlass().matrix, makeFloorGlass().plane, floorCamera]] as const)
        {
            const reflected = reflectionOf(viewer, glassPlane);
            for (const point of glassPoints(glassMatrix))
            {
                const seen = ndc(viewer, point);
                const drawn = ndc(reflected, point);
                expect(drawn.x).toBeCloseTo(-seen.x, 6);
                expect(drawn.y).toBeCloseTo(seen.y, 6);
                expect(clip(reflected, point).w).toBeCloseTo(clip(viewer, point).w, 6);
            }
        }
    });

    it("shows what is in front of the glass where the camera would see its image behind it", () => {
        const wall = makeGlass().plane;
        const floor = makeFloorGlass().plane;
        for (const [plane, viewer, points] of [
            [wall, camera, [new THREE.Vector3(5.2, 2.1, 6), new THREE.Vector3(4, 1, 9), new THREE.Vector3(6, 3, 4.5)]],
            [floor, floorCamera, [new THREE.Vector3(8, 1.5, 9), new THREE.Vector3(7, 3, 11), new THREE.Vector3(9, 0.5, 8)]],
        ] as const)
        {
            const reflection = reflectionOf(viewer, plane);
            for (const point of points)
            {
                const image = point.clone().addScaledVector(plane.normal, -2 * plane.distanceToPoint(point));
                const seen = ndc(viewer, image);
                const reflected = ndc(reflection, point);
                expect(reflected.x).toBeCloseTo(-seen.x, 6);
                expect(reflected.y).toBeCloseTo(seen.y, 6);
            }
        }
    });

    it("draws only the glass's extent: its corners span the reflection's whole view", () => {
        for (const [{plane, corners}, viewer] of [[makeGlass(), camera], [makeFloorGlass(), floorCamera]] as const)
        {
            const extent = new THREE.Box2();
            expect(MirrorProjectionUtil.getVisibleExtent(viewer, corners, extent)).toBe(true);
            const reflection = reflectionOf(viewer, plane, extent);

            const drawn = new THREE.Box2();
            for (const corner of corners)
                drawn.expandByPoint(ndc(reflection, corner));
            for (const value of [drawn.min.x, drawn.min.y])
                expect(value).toBeCloseTo(-1, 5);
            for (const value of [drawn.max.x, drawn.max.y])
                expect(value).toBeCloseTo(1, 5);
        }
    });

    it("draws all that is seen through the glass, out to the far side of the room, and nothing short of it", () => {
        for (const [{matrix, plane, corners}, viewer] of [[makeGlass(), camera], [makeFloorGlass(), floorCamera]] as const)
        {
            const extent = new THREE.Box2();
            MirrorProjectionUtil.getVisibleExtent(viewer, corners, extent);
            const reflection = reflectionOf(viewer, plane, extent);
            const eye = new THREE.Vector3().setFromMatrixPosition(reflection.matrixWorld);
            const isDrawn = (point: THREE.Vector3) => {
                const c = clip(reflection, point);
                const slack = 1e-9 * c.w;
                return c.w > 0 && Math.abs(c.x) <= c.w + slack && Math.abs(c.y) <= c.w + slack
                    && c.z >= -c.w && c.z <= c.w;
            };

            // Along each ray from the reflected camera through the glass: what is past the glass, however far, and
            // not the glass itself, the face it hangs on or what is behind that.
            for (const point of glassPoints(matrix))
            {
                const ray = point.clone().sub(eye).normalize();
                for (const distance of [0.05, 0.5, 3, ROOM_DIAGONAL])
                    expect(isDrawn(point.clone().addScaledVector(ray, distance)), `${distance} past`).toBe(true);
                for (const distance of [0, 0.05, 1])
                    expect(isDrawn(point.clone().addScaledVector(ray, -distance)), `${distance} short`).toBe(false);
            }
            // Nor what lies flat in the glass's own plane around it.
            const middle = new THREE.Vector3().setFromMatrixPosition(matrix);
            for (const corner of corners)
                expect(isDrawn(corner.clone().lerp(middle, -0.2))).toBe(false);
        }
    });

    it("is read back by the glass where it was drawn, within the part of the texture drawn", () => {
        const {matrix, plane, corners} = makeGlass();
        const extent = new THREE.Box2();
        MirrorProjectionUtil.getVisibleExtent(camera, corners, extent);
        const reflection = reflectionOf(camera, plane, extent);
        const widthShare = 0.75;
        const heightShare = 0.4;
        const textureMatrix = MirrorProjectionUtil.getTextureMatrix(reflection, widthShare, heightShare,
            new THREE.Matrix4());

        for (const point of glassPoints(matrix))
        {
            const coord = new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(textureMatrix);
            const drawnAt = ndc(reflection, point);
            expect(coord.x / coord.w).toBeCloseTo(0.5 * (drawnAt.x + 1) * widthShare, 6);
            expect(coord.y / coord.w).toBeCloseTo(0.5 * (drawnAt.y + 1) * heightShare, 6);
            expect(coord.x / coord.w).toBeGreaterThanOrEqual(-1e-9);
            expect(coord.x / coord.w).toBeLessThanOrEqual(widthShare + 1e-9);
            expect(coord.y / coord.w).toBeGreaterThanOrEqual(-1e-9);
            expect(coord.y / coord.w).toBeLessThanOrEqual(heightShare + 1e-9);
        }
    });

    it("covers only what the view shows of the glass, and nothing of a glass out of view", () => {
        const {corners} = makeGlass();
        const extent = new THREE.Box2();

        // Behind the camera, and beside it.
        expect(MirrorProjectionUtil.getVisibleExtent(makeCamera({x: 5, y: 2, z: 7}, {x: 5, y: 2, z: 11}), corners,
            extent)).toBe(false);
        expect(MirrorProjectionUtil.getVisibleExtent(makeCamera({x: 5, y: 2, z: 7}, {x: 15, y: 2, z: 7}), corners,
            extent)).toBe(false);

        // From close by, the glass fills the view, as far as the view goes.
        expect(MirrorProjectionUtil.getVisibleExtent(makeCamera({x: 5, y: 2, z: 3.6}, {x: 5, y: 2, z: 3}), corners,
            extent)).toBe(true);
        expect(extent.min.toArray()).toEqual([-1, -1]);
        expect(extent.max.toArray()).toEqual([1, 1]);

        // Along the wall from beside it, its near end behind the camera, and the rest still counts.
        const alongTheWall = makeCamera({x: 4.5, y: 2, z: 3.3}, {x: 8, y: 2, z: 3});
        expect(MirrorProjectionUtil.getVisibleExtent(alongTheWall, corners, extent)).toBe(true);
        expect(extent.min.x).toBeGreaterThanOrEqual(-1);
        expect(extent.max.x).toBeLessThanOrEqual(1);
    });

    it("is lit by the head light from nearer the glass, straight toward its plane, never nearer it than a clearance",
        () => {
        expect(HEAD_LIGHT_SHIFT).toBeGreaterThan(HEAD_LIGHT_GLASS_CLEARANCE);
        expect(HEAD_LIGHT_GLASS_CLEARANCE).toBeGreaterThan(0);
        for (const {plane} of [makeGlass(), makeFloorGlass()])
        {
            // Off to one side of the glass's middle, at a distance in front of its plane.
            const side = new THREE.Vector3(1, 1, 1).projectOnPlane(plane.normal).setLength(0.7);
            const lightAt = (distance: number) => plane.coplanarPoint(new THREE.Vector3()).add(side)
                .addScaledVector(plane.normal, distance);
            const litFrom = (distance: number) => {
                const light = lightAt(distance);
                const moved = MirrorProjectionUtil.getHeadLightPosition(light, plane, new THREE.Vector3());
                // Only ever along the plane's normal.
                const across = moved.clone().sub(light).projectOnPlane(plane.normal);
                expect(across.length()).toBeCloseTo(0, 9);
                return plane.distanceToPoint(moved);
            };

            // From afar, the whole shift; nearer, as far as the clearance; from that near, or behind the plane, not at all.
            for (const distance of [6, HEAD_LIGHT_SHIFT + HEAD_LIGHT_GLASS_CLEARANCE + 0.01])
                expect(litFrom(distance)).toBeCloseTo(distance - HEAD_LIGHT_SHIFT, 9);
            for (const distance of [HEAD_LIGHT_SHIFT, 1, HEAD_LIGHT_GLASS_CLEARANCE + 0.01])
                expect(litFrom(distance)).toBeCloseTo(HEAD_LIGHT_GLASS_CLEARANCE, 9);
            for (const distance of [HEAD_LIGHT_GLASS_CLEARANCE, 0.1, 0, -0.5])
                expect(litFrom(distance)).toBeCloseTo(distance, 9);
        }
    });

    it("is drawn with the head light moved so for it alone, and put back where it was for the screen", async () => {
        const {matrix} = makeGlass();
        const glassMesh = new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 1);
        glassMesh.setMatrixAt(0, matrix);
        // Squarely before the glass, the head light above the camera as it is mounted.
        const scene = new THREE.Scene();
        const viewer = makeCamera({x: 5, y: 2, z: 6}, {x: 5, y: 2, z: 3});
        scene.add(viewer);
        const headLight = new THREE.PointLight();
        headLight.position.set(0, 1, 0);
        viewer.add(headLight);

        // A renderer as far as the reflection asks of one: what the head light lit each drawing from.
        const litFrom: number[][] = [];
        const renderer = {
            shadowMap: {autoUpdate: true},
            getRenderTarget: () => null,
            setRenderTarget: () => {},
            compileAsync: async () => {},
            getDrawingBufferSize: (out: THREE.Vector2) => out.set(1200, 800),
            render: (drawn: THREE.Scene) => {
                drawn.updateMatrixWorld();
                litFrom.push(headLight.getWorldPosition(new THREE.Vector3()).toArray().map(n => +n.toFixed(6)));
            },
        } as unknown as THREE.WebGLRenderer;

        MirrorReflectionUtil.setGlass(glassMesh, 0);
        try
        {
            // The first only sets its programs compiling.
            MirrorReflectionUtil.render(renderer, scene, viewer, headLight);
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(litFrom).toEqual([]);
            MirrorReflectionUtil.render(renderer, scene, viewer, headLight);

            // Three in front of the glass, so moved the whole way toward it.
            expect(litFrom).toEqual([[5, 3, 6 - HEAD_LIGHT_SHIFT]]);
            expect(headLight.position.toArray()).toEqual([0, 1, 0]);
            expect(headLight.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([5, 3, 6]);
        }
        finally
        {
            MirrorReflectionUtil.setGlass(undefined);
        }
    });
});

describe("what a reflection shows that the camera doesn't", () => {
    // A composer whose instances are drawn into a stub, which notes how high each was last put; its meshes loaded, or
    // still loading.
    function makeComposer(meshesLoaded: boolean = true): {composer: InstancedMeshComposer, drawnY: () => number[],
        drawnAt: () => Vec3[], numDraws: () => number}
    {
        const drawnAt: {[instanceId: number]: Vec3} = {};
        let numDraws = 0;
        let nextInstanceId = 0;
        const graphics = {
            instancedMeshIsLoaded: () => meshesLoaded,
            rentInstanceFromPool: () => nextInstanceId++,
            returnInstanceToPool: () => {},
            updateInstanceTransform: (_meshId: string, instanceId: number, x: number, y: number, z: number) => {
                drawnAt[instanceId] = {x, y, z};
                ++numDraws;
            },
            updateInstanceColor: () => {},
            updateInstanceMouldingParams: () => {},
        };
        const gameObject = {
            params: new AddObjectSignal("room", "user", "User", fanTypeIndex, "fan",
                new ObjectTransform({...WALL_SPOT}, {...WALL_FACING}, {x: 1, y: 1, z: 1}), {}),
            components: {instancedMeshGraphics: graphics},
        };
        const composer = new InstancedMeshComposer(gameObject as any,
            FanObjectTypeConfig.components.spawnedByAny.instancedMeshComposer);
        return {composer, drawnY: () => Object.values(drawnAt).map(at => at.y),
            drawnAt: () => Object.values(drawnAt).map(at => ({...at})), numDraws: () => numDraws};
    }

    const PARKED = -9999;

    it("draws what is hidden from the camera alone for the reflection, and parks it again for the camera", async () => {
        const {composer, drawnY} = makeComposer();
        await composer.onSpawn();
        composer.update(0);
        expect(drawnY().every(y => y != PARKED)).toBe(true);

        composer.setHiddenFromCamera(true);
        composer.update(0);
        expect(drawnY().every(y => y == PARKED)).toBe(true);

        reflectionDrawingObservable.set(true);
        expect(drawnY().every(y => y != PARKED)).toBe(true);
        reflectionDrawingObservable.set(false);
        expect(drawnY().every(y => y == PARKED)).toBe(true);

        await composer.onDespawn();
    });

    it("draws it moving too: moved since it was last drawn, as a walking body is by the time a reflection is drawn",
        async () => {
        const {composer, drawnY} = makeComposer();
        await composer.onSpawn();
        composer.setHiddenFromCamera(true);
        composer.update(0);
        expect(drawnY().every(y => y == PARKED)).toBe(true);

        // A frame's step, after its composer was updated (see ClientObjectManager.update): a refresh is due again.
        composer.onTransformChanged(false);
        reflectionDrawingObservable.set(true);
        expect(drawnY().every(y => y != PARKED)).toBe(true);
        reflectionDrawingObservable.set(false);
        expect(drawnY().every(y => y == PARKED)).toBe(true);

        await composer.onDespawn();
    });

    it("draws it as far off its place as it is set to for the reflection alone, as the body the camera trails is",
        async () => {
        const {composer, drawnAt} = makeComposer();
        await composer.onSpawn();
        composer.setHiddenFromCamera(true);
        composer.update(0);
        reflectionDrawingObservable.set(true);
        const atItsPlace = drawnAt();
        reflectionDrawingObservable.set(false);

        const offset = {x: 0.1, y: -0.4, z: 0.05};
        composer.setReflectionOffset(offset);
        reflectionDrawingObservable.set(true);
        const drawn = drawnAt();
        expect(drawn.length).toBe(atItsPlace.length);
        drawn.forEach((at, i) => {
            expect(at.x - atItsPlace[i].x).toBeCloseTo(offset.x, 9);
            expect(at.y - atItsPlace[i].y).toBeCloseTo(offset.y, 9);
            expect(at.z - atItsPlace[i].z).toBeCloseTo(offset.z, 9);
        });
        reflectionDrawingObservable.set(false);
        expect(drawnAt().every(at => at.y == PARKED)).toBe(true);

        // Shown to the camera, it is drawn at its place whatever is set, as the reflection then sees it.
        composer.setHiddenFromCamera(false);
        composer.update(0);
        expect(drawnAt()).toEqual(atItsPlace);

        await composer.onDespawn();
    });

    it("draws nothing whose meshes are still loading", async () => {
        const {composer, numDraws} = makeComposer(false);
        await composer.onSpawn();
        composer.setHiddenFromCamera(true);

        reflectionDrawingObservable.set(true);
        reflectionDrawingObservable.set(false);
        expect(numDraws()).toBe(0);

        await composer.onDespawn();
    });

    it("leaves what is hidden from everyone out of the reflection too, and redraws nothing that isn't hidden", async () => {
        const {composer, drawnY, numDraws} = makeComposer();
        await composer.onSpawn();
        composer.update(0);

        // Shown to everyone: a reflection has nothing to redraw.
        const drawsBefore = numDraws();
        reflectionDrawingObservable.set(true);
        reflectionDrawingObservable.set(false);
        expect(numDraws()).toBe(drawsBefore);

        composer.setHidden(true);
        composer.setHiddenFromCamera(true);
        composer.update(0);
        reflectionDrawingObservable.set(true);
        expect(drawnY().every(y => y == PARKED)).toBe(true);
        reflectionDrawingObservable.set(false);

        // Once gone, a reflection no longer reaches it.
        await composer.onDespawn();
        const drawsAtDespawn = numDraws();
        reflectionDrawingObservable.set(true);
        reflectionDrawingObservable.set(false);
        expect(numDraws()).toBe(drawsAtDespawn);
    });
});
