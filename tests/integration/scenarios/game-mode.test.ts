/**
 * Scenario tests: play vs. edit mode (see @docs/gameplay/game_mode.md). Play mode picks nothing and keeps
 * the eye camera, which a click pitches toward what it hit; edit mode starts on a scripted step's pick,
 * else on what the camera faces within reach (straight ahead, then tilted toward the ground), else on the
 * user's character, and a selection orbits the camera. That look, like a click, passes through a picture
 * where it draws nothing. Browser-bound client modules are stubbed, and so
 * is the view's raycast wherever edit mode is entered; generation, selection, framing and the raycast
 * itself run for real.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock, MockInstance } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    const scene = new THREE.Scene();
    // Voxel edits invalidate the light map (see LightBlockMap); a stub suffices.
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {},
        getNearbyLightAt(_worldPos: unknown, out: any) { return out.setRGB(0, 0, 0); } };
    // Where a pointer event's coordinates are measured from (see PointerCoordUtil).
    const canvas = { getBoundingClientRect: () => ({left: 0, top: 0, width: 800, height: 600}) };
    return { default: { getCamera: () => camera, getScene: () => scene, getGameCanvas: () => canvas,
        getLightBlockMap: () => lightBlockMap,
        setViewReferenceOffset: () => {}, setPointLightSurroundings: () => {},
        setRoomLightingPrefs: () => {} } };
});

vi.mock("../../../src/client/app", () => ({
    default: {
        getCurrentRoom: vi.fn(),
        getVoxelQuads: vi.fn(),
        getUser: vi.fn(),
        getEnv: vi.fn(),
    },
}));

vi.mock("../../../src/client/graphics/types/gizmo/generic/worldSpaceOutlineRect", () => ({
    default: class WorldSpaceOutlineRectStub
    {
        static async create() { return new WorldSpaceOutlineRectStub(); }
        addToParent() {}
        setTransform() {}
        setTransformRaw() {}
        setVisible() {}
        dispose() {}
    },
}));

vi.mock("../../../src/client/graphics/types/gizmo/generic/worldSpaceOutlineArrow", () => ({
    default: class WorldSpaceOutlineArrowStub
    {
        addToParent() {}
        setPosition() {}
        setVisible() {}
        faceViewer() {}
        dispose() {}
    },
}));

// Imported by the modules under test; nothing here needs a running game.
vi.mock("../../../src/client/object/clientObjectManager", () => ({
    default: { getMyPlayer: vi.fn(), getObjectById: vi.fn() },
}));

import * as THREE from "three";
import App from "../../../src/client/app";
import GraphicsManager from "../../../src/client/graphics/graphicsManager";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import PlayerController from "../../../src/client/object/components/playerController";
import PlayerCamera from "../../../src/client/object/components/helpers/player/playerCamera";
import PlayerPointerInput from "../../../src/client/object/components/helpers/player/playerPointerInput";
import VoxelGameObject from "../../../src/client/object/types/gameObject/voxelGameObject";
import ObjectSelection from "../../../src/client/graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../../src/client/graphics/types/gizmo/voxelQuadSelection";
import WorldSpaceSelectionUtil from "../../../src/client/graphics/util/worldSpaceSelectionUtil";
import SelectionStepUtil from "../../../src/client/graphics/util/selectionStepUtil";
import ObjectHit from "../../../src/client/graphics/types/objectHit";
import GameModeUtil from "../../../src/client/system/util/gameModeUtil";
import CameraUtil from "../../../src/client/graphics/util/cameraUtil";
import MeshFactory from "../../../src/client/graphics/factories/meshFactory";
import InstancedMeshBinding from "../../../src/client/graphics/types/mesh/instancedMeshBinding";
import InstancedMeshGraphics from "../../../src/client/object/components/instancedMeshGraphics";
import InstancedColorMaterialParams from "../../../src/shared/graphics/material/types/instancedColorMaterialParams";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import SinglePlayerActionMap from "../../../src/client/singlePlayer/maps/singlePlayerActionMap";
import PlayerGameObject from "../../../src/client/object/types/gameObject/playerGameObject";
import { cameraModeObservable, clientFeatureFlagsObservable, editModeOpeningOverrideObservable,
    gameModeObservable, manualSelectionObservable, myPlayerHiddenObservable, notificationMessageObservable,
    objectSelectionObservable,
    orbitCameraAngleHoldRequestObservable, orbitCameraAnglesObservable, orbitCameraDistanceRangeRequestObservable,
    orbitCameraTargetOverrideObservable, orbitCameraViewRequestObservable, orbitCameraZoomObservable,
    voxelQuadSelectionObservable } from "../../../src/client/system/clientObservables";
import { EDIT_MODE_OPENING_REACH, EDIT_MODE_OPENING_TILT } from "../../../src/client/system/clientConstants";
import { FeatureFlag } from "../../../src/shared/system/types/featureFlag";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MIN, GENERATED_WALL_THICKNESS, UNIT_VEC3,
    VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import Room from "../../../src/shared/room/types/room";
import User from "../../../src/shared/user/types/user";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { buildPillar, createRoom, floorQuadIndexOf, isQuadVisible, quadIndexOf,
    voxelAt } from "../helpers/selectionHarness";
import { createMockUser } from "../helpers/mockUser";
import VoxelQuadInstanceUtil from "../../../src/client/voxel/util/voxelQuadInstanceUtil";
import AdminPrefsUtil from "../../../src/shared/object/util/adminPrefsUtil";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";

const ROOM_ID = "game-mode-room";

// The stand-in player is never moved by physics, so there is nothing for the camera to trail.
const NO_IMPOSED_DISPLACEMENT = {x: 0, y: 0, z: 0};

// The boundary wall on the room's north side: the innermost of its rows of voxels, and the plane their inner
// faces lie in, looking toward +z.
const WALL_ROW = GENERATED_WALL_THICKNESS - 1;
const WALL_FACE_Z = (WALL_ROW + 1) * VOXEL_CELL_SIZE;

let room: Room;

/** Somebody who owns the named room and nothing else — "" for somebody who owns nothing at all. */
function userOwning(ownedRoomID: string): User
{
    const {user} = createMockUser();
    user.ownedRoomID = ownedRoomID;
    return user;
}

/** An unresized transform at a place, which is what the framing and outline rules read a size from. */
function unitTransform(x: number, y: number, z: number): ObjectTransform
{
    return new ObjectTransform({x, y, z}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3});
}

/** A stand-in for the user's own character: only what the framing rules actually read of it. */
function makeCharacter(): GameObject
{
    return {
        params: { objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Player"),
            transform: unitTransform(10.5, 0.5 * PLAYER_HEIGHT, 10.5) },
        position: new THREE.Vector3(10.5, 0.5 * PLAYER_HEIGHT, 10.5),
        direction: new THREE.Vector3(0, 0, 1),
    } as unknown as GameObject;
}

/** A picture hanging on a wall, which anyone may select. */
function makePicture(): GameObject
{
    const picture = {
        params: { objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Canvas"),
            transform: unitTransform(10.5, 1.5, 0.01) },
        position: new THREE.Vector3(10.5, 1.5, 0.01),
        direction: new THREE.Vector3(0, 0, 1),
        quaternion: new THREE.Quaternion(),
        trySelect: (): boolean => ObjectSelection.trySelect(picture as unknown as GameObject),
    };
    return picture as unknown as GameObject;
}

/** Somebody else's character, which the user may not select. */
function makeOtherPlayer(): GameObject
{
    return {
        params: { objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Player"),
            transform: unitTransform(0, 0, 0) },
        trySelect: (): boolean => false,
    } as unknown as GameObject;
}

/** An object as a line of sight meets it. */
function hitOn(gameObject: GameObject): ObjectHit
{
    return {gameObject, instanceId: -1};
}

type LineOfSightCast = (maxDistance: number, pitchDownAngle: number) => ObjectHit[];

/** A view whose line of sight meets these straight ahead, and nothing when tilted toward the ground. */
function lookingAt(...hits: ObjectHit[]): LineOfSightCast
{
    return (_maxDistance, pitchDownAngle) => (pitchDownAngle == 0) ? hits : [];
}

// Quads given an instance by hitOnVoxelQuad, released after each test.
const boundInstances: {quadIndex: number, instanceId: number}[] = [];

/** A voxel quad as a line of sight meets it: the room's voxels, hit on the instance drawing that quad. */
function hitOnVoxelQuad(quadIndex: number): ObjectHit
{
    const instanceId = boundInstances.length;
    VoxelQuadInstanceUtil.bind(quadIndex, instanceId);
    boundInstances.push({quadIndex, instanceId});

    // A real VoxelGameObject, so the quad is selected exactly as a real one selects it.
    const gameObject = Object.assign(Object.create(VoxelGameObject.prototype), {
        params: { objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Voxel") },
        voxels: room.voxelGrid.voxels,
    }) as VoxelGameObject;
    return {gameObject, instanceId};
}

/** Selects a quad the way a click on it does, i.e. through the rules under test. */
function selectQuad(row: number, col: number, quadIndex: number): boolean
{
    return VoxelQuadSelection.trySelect(voxelAt(room, row, col), quadIndex);
}

/** Clicks a voxel quad through the full click path (mode and permission checks included). */
function clickVoxel(row: number, col: number, quadIndex: number): void
{
    // A click names a mesh instance, so the quad must hold one (see VoxelQuadInstanceUtil).
    const instanceId = 0;
    VoxelQuadInstanceUtil.bind(quadIndex, instanceId);
    try
    {
        // A real VoxelGameObject, so the click is handled exactly as a real one.
        const voxelTypeIndex = ObjectTypeConfigMap.getIndexByType("Voxel");
        const clicked = Object.assign(Object.create(VoxelGameObject.prototype), {
            params: { objectTypeIndex: voxelTypeIndex, metadata: {} },
            config: ObjectTypeConfigMap.getConfigByIndex(voxelTypeIndex),
            voxels: room.voxelGrid.voxels,
        }) as VoxelGameObject;
        clicked.onClick(instanceId, new THREE.Vector3(VoxelQueryUtil.getWorldXAtVoxelColCenter(col), 0,
            VoxelQueryUtil.getWorldZAtVoxelRowCenter(row)));
    }
    finally
    {
        VoxelQuadInstanceUtil.unbind(quadIndex, instanceId);
    }
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    for (const flag of [FeatureFlag.DisableAllSelectionChange, FeatureFlag.DisableVoxelQuadSelectionChange,
        FeatureFlag.DisableObjectSelectionChange, FeatureFlag.DisableGameModeTransition])
    {
        clientFeatureFlagsObservable.tryRemove(flag);
    }
    voxelQuadSelectionObservable.set(null);
    objectSelectionObservable.set(null);
    gameModeObservable.set("play");
    cameraModeObservable.set({type: "firstPerson"});
    orbitCameraTargetOverrideObservable.set(null);
    orbitCameraDistanceRangeRequestObservable.set(null);
    orbitCameraAngleHoldRequestObservable.set(false);
    orbitCameraViewRequestObservable.set(null);
    editModeOpeningOverrideObservable.set(null);
    notificationMessageObservable.set(null);

    // A hub, which belongs to nobody. The test about somebody else's room makes one of its own below.
    (App.getUser as Mock).mockReturnValue(userOwning(""));
    room = createRoom(ROOM_ID);
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
});

afterEach(() => {
    for (const {quadIndex, instanceId} of boundInstances)
        VoxelQuadInstanceUtil.unbind(quadIndex, instanceId);
    boundInstances.length = 0;
});

describe("play mode", () => {
    it("picks nothing out when the user clicks a block", () => {
        clickVoxel(10, 10, floorQuadIndexOf(10, 10));

        expect(WorldSpaceSelectionUtil.isAnythingSelected()).toBe(false);
        expect(GameModeUtil.isInEditMode()).toBe(false);
        expect(cameraModeObservable.peek().type).toBe("firstPerson");
    });

    it("refuses a selection asked for by code", () => {
        // What an edit re-picks after its response, possibly after the mode was left.
        expect(selectQuad(10, 10, floorQuadIndexOf(10, 10))).toBe(false);
        expect(ObjectSelection.trySelect(makeCharacter())).toBe(false);

        expect(WorldSpaceSelectionUtil.isAnythingSelected()).toBe(false);
    });
});

describe("a click in play mode", () => {
    // Straight ahead of the user, who faces the room's north boundary wall: a spot on the floor, and one high
    // up on that wall (below the storey above).
    const FLOOR_POINT = new THREE.Vector3(10.5, 0, 5.5);
    const HIGH_WALL_POINT = new THREE.Vector3(10.5, 3, WALL_FACE_Z);

    // A frame short enough that the camera only makes part of its turn.
    const SHORT_FRAME = 0.05;

    // Walking speeds, per second, either side of lookMaxSpeed (see FirstPersonCameraPose): one a look lasts
    // through, and one that ends it.
    const SLOW_WALK = 1;
    const BRISK_WALK = 5;

    // Lifted this far off the floor, the user falls, with the storey above still well overhead.
    const FALL_HEIGHT = 0.8;

    let player: THREE.Object3D;
    let controller: PlayerController;
    let pointerInput: {dragDelta: THREE.Vector2, viewScale: number, clickedPoint: THREE.Vector3 | undefined};
    let playerCamera: PlayerCamera;

    /** One frame, long enough for the camera to ease all the way to its pose, with a click's hit if given. */
    function frame(clickedPoint?: THREE.Vector3): void
    {
        pointerInput.clickedPoint = clickedPoint;
        playerCamera.update(1, controller, NO_IMPOSED_DISPLACEMENT);
    }

    /** How far up the view a point shows, in NDC: 0 is the middle. */
    function screenYOf(point: THREE.Vector3): number
    {
        player.updateMatrixWorld(true);
        return point.clone().project(GraphicsManager.getCamera()).y;
    }

    /** The camera's pitch, looking up being positive. */
    function pitch(): number
    {
        return Math.asin(GraphicsManager.getCamera().getWorldDirection(new THREE.Vector3()).y);
    }

    /** One frame in which the camera makes only part of its turn, with a click's hit if given. */
    function shortFrame(clickedPoint?: THREE.Vector3): void
    {
        pointerInput.clickedPoint = clickedPoint;
        playerCamera.update(SHORT_FRAME, controller, NO_IMPOSED_DISPLACEMENT);
    }

    /** The user walking straight ahead (toward -z, the way he faces) at a speed, per second, for a while. */
    function walkAhead(speed: number, seconds: number): void
    {
        for (let frames = Math.round(seconds / SHORT_FRAME); frames > 0; frames--)
        {
            player.position.z -= speed * SHORT_FRAME;
            shortFrame();
        }
    }

    /** How far the camera turns in each of two short frames, a click's hit arriving with the first if given. */
    function turnsInTwoShortFrames(clickedPoint?: THREE.Vector3): number[]
    {
        const camera = GraphicsManager.getCamera();
        const turns: number[] = [];
        for (const hit of [clickedPoint, undefined])
        {
            const before = camera.quaternion.clone();
            shortFrame(hit);
            turns.push(before.angleTo(camera.quaternion));
        }
        return turns;
    }

    /** The camera's usual pace: the share of its turn to look down a fall that it makes in one short frame. */
    function usualShareTurned(): number
    {
        const camera = GraphicsManager.getCamera();
        const start = camera.quaternion.clone();
        player.position.y += FALL_HEIGHT;
        shortFrame();
        const turned = start.angleTo(camera.quaternion);
        frame();
        const share = turned / start.angleTo(camera.quaternion);

        player.position.y -= FALL_HEIGHT;
        frame();
        return share;
    }

    beforeEach(() => {
        player = new THREE.Object3D();
        player.position.set(10.5, 0.5 * PLAYER_HEIGHT, 10.5);
        controller = { gameObject: { obj: player, position: player.position } } as unknown as PlayerController;
        pointerInput = {dragDelta: new THREE.Vector2(), viewScale: 1, clickedPoint: undefined};
        playerCamera = new PlayerCamera();
        playerCamera.onSpawn(controller, pointerInput as unknown as PlayerPointerInput);
        frame();
    });

    afterEach(() => {
        playerCamera.onDespawn(controller);
        player.remove(GraphicsManager.getCamera());
    });

    it("looks down at what it hit below eye level, and up at what it hit above, until it shows level with the middle of the view", () => {
        const roomPitch = pitch();

        frame(FLOOR_POINT);
        expect(pitch()).toBeLessThan(roomPitch);
        expect(screenYOf(FLOOR_POINT)).toBeCloseTo(0, 6);

        frame(HIGH_WALL_POINT);
        expect(pitch()).toBeGreaterThan(roomPitch);
        expect(screenYOf(HIGH_WALL_POINT)).toBeCloseTo(0, 6);
    });

    it("holds the look while the user turns in place", () => {
        frame(FLOOR_POINT);
        const lookPitch = pitch();

        player.rotateY(1);
        frame();

        expect(pitch()).toBeCloseTo(lookPitch, 6);
    });

    it("keeps looking at what it hit while the user walks up to it slowly", () => {
        frame(FLOOR_POINT);
        const lookFromAfar = pitch();

        walkAhead(SLOW_WALK, 1);
        frame();

        expect(pitch()).toBeLessThan(lookFromAfar);
        expect(screenYOf(FLOOR_POINT)).toBeCloseTo(0, 6);
    });

    it("holds the look through a push, which is physics moving the user rather than him walking", () => {
        frame(FLOOR_POINT);

        const push = {x: 0, y: 0, z: -BRISK_WALK * SHORT_FRAME};
        player.position.z += push.z;
        pointerInput.clickedPoint = undefined;
        playerCamera.update(SHORT_FRAME, controller, push);
        frame();

        // Still trailing the push by a hair (see PlayerCamera).
        expect(screenYOf(FLOOR_POINT)).toBeCloseTo(0, 4);
    });

    it("lets the look go once the user walks briskly, and doesn't bring it back when he stops", () => {
        // Where the room alone pitches the camera, one brisk step ahead.
        const start = player.position.clone();
        walkAhead(BRISK_WALK, SHORT_FRAME);
        frame();
        const roomPitchAhead = pitch();
        player.position.copy(start);
        frame();

        frame(FLOOR_POINT);
        walkAhead(BRISK_WALK, SHORT_FRAME);
        frame();

        expect(pitch()).toBeCloseTo(roomPitchAhead, 6);
    });

    it("lets the look go when the user falls, though physics rather than walking moved him", () => {
        const roomPitch = pitch();
        frame(FLOOR_POINT);

        player.position.y += FALL_HEIGHT;
        frame();
        player.position.y -= FALL_HEIGHT;
        frame();

        expect(pitch()).toBeCloseTo(roomPitch, 6);
    });

    it("lets the look go when edit mode takes the camera away, rather than going back to it after", () => {
        const roomPitch = pitch();
        frame(FLOOR_POINT);

        GameModeUtil.enterEditMode(makeCharacter());
        frame();
        expect(cameraModeObservable.peek().type).toBe("orbit");
        GameModeUtil.exitEditMode();
        frame();

        expect(pitch()).toBeCloseTo(roomPitch, 6);
    });

    it("turns to what it hit, and back once the user walks off, setting off gently rather than at full speed", () => {
        const toLook = turnsInTwoShortFrames(FLOOR_POINT);
        frame();
        player.position.x += BRISK_WALK * SHORT_FRAME;
        const back = turnsInTwoShortFrames();

        // A turn that set off at full speed would turn furthest in its first frame.
        expect(toLook[1]).toBeGreaterThan(toLook[0]);
        expect(back[1]).toBeGreaterThan(back[0]);
    });

    it("turns at the usual pace again once it has settled back from the look", () => {
        const usualShare = usualShareTurned();
        frame(FLOOR_POINT);
        player.position.x += BRISK_WALK * SHORT_FRAME;
        shortFrame();
        frame();

        expect(usualShareTurned()).toBeCloseTo(usualShare, 6);
    });
});

describe("entering edit mode", () => {
    it("selects the voxel quad the camera faces and orbits it", () => {
        const quadIndex = floorQuadIndexOf(10, 10);

        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOnVoxelQuad(quadIndex)));

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(quadIndex);
        expect(ObjectSelection.isSelected()).toBe(false);

        const mode = cameraModeObservable.peek();
        expect(mode.type == "orbit" && [mode.target.center.x, mode.target.center.z]).toEqual(
            [VoxelQueryUtil.getWorldXAtVoxelColCenter(10), VoxelQueryUtil.getWorldZAtVoxelRowCenter(10)]);
    });

    it("selects the object the camera faces", () => {
        const picture = makePicture();

        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));

        expect(objectSelectionObservable.peek()?.gameObject).toBe(picture);
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });

    it("looks past objects the user may not select, to what stands behind them", () => {
        const quadIndex = floorQuadIndexOf(10, 10);

        GameModeUtil.enterEditMode(makeCharacter(),
            lookingAt(hitOn(makeOtherPlayer()), hitOnVoxelQuad(quadIndex)));

        expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(quadIndex);
    });

    it("never looks through a room surface, even one it may not select", () => {
        // What stands behind a wall is out of sight, so a refused quad ends the search.
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableVoxelQuadSelectionChange);
        const character = makeCharacter();

        GameModeUtil.enterEditMode(character,
            lookingAt(hitOnVoxelQuad(floorQuadIndexOf(10, 10)), hitOn(makePicture())));

        expect(objectSelectionObservable.peek()?.gameObject).toBe(character);
    });

    it("looks straight ahead only as far as its reach, and stops there once something is selected", () => {
        const casts: number[][] = [];

        GameModeUtil.enterEditMode(makeCharacter(), (maxDistance, pitchDownAngle) => {
            casts.push([maxDistance, pitchDownAngle]);
            return [hitOn(makePicture())];
        });

        expect(casts).toEqual([[EDIT_MODE_OPENING_REACH, 0]]);
        expect(ObjectSelection.isSelected()).toBe(true);
    });

    it("looks toward the ground, just as far, when nothing straight ahead can be selected", () => {
        // E.g. the user faces an open room whose far wall is out of reach.
        const quadIndex = floorQuadIndexOf(10, 10);
        const casts: number[][] = [];

        GameModeUtil.enterEditMode(makeCharacter(), (maxDistance, pitchDownAngle) => {
            casts.push([maxDistance, pitchDownAngle]);
            return (pitchDownAngle == 0) ? [hitOn(makeOtherPlayer())] : [hitOnVoxelQuad(quadIndex)];
        });

        expect(casts).toEqual([[EDIT_MODE_OPENING_REACH, 0], [EDIT_MODE_OPENING_REACH, EDIT_MODE_OPENING_TILT]]);
        expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(quadIndex);
    });

    it("falls back on the user's own character when nothing in view can be selected, and orbits it", () => {
        const character = makeCharacter();

        GameModeUtil.enterEditMode(character, () => [hitOn(makeOtherPlayer())]);

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(objectSelectionObservable.peek()?.gameObject).toBe(character);

        const mode = cameraModeObservable.peek();
        expect(mode.type).toBe("orbit");
        // Framed on the character itself, so its own size decides how far back the camera sits.
        expect(mode.type == "orbit" && mode.minDistance).toBe(0);
        expect(mode.type == "orbit" && mode.target.center.y).toBe(0.5 * PLAYER_HEIGHT);
    });

    it("opens on the user's own character even while a step holds the selection still", () => {
        // The mode always opens with something selected; only the lock on the mode itself keeps it shut.
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableAllSelectionChange);
        const character = makeCharacter();

        GameModeUtil.enterEditMode(character);

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(objectSelectionObservable.peek()?.gameObject).toBe(character);
    });

    it("opens in somebody else's room too, on the user's own character", () => {
        // The character may be customized in others' rooms; a hub has no owner, so use a Regular room.
        room = createRoom(`${ROOM_ID}-regular`, RoomTypeEnumMap.Regular);
        (App.getCurrentRoom as Mock).mockReturnValue(room);
        (App.getUser as Mock).mockReturnValue(userOwning(""));

        GameModeUtil.enterEditMode(makeCharacter());

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(ObjectSelection.isSelected()).toBe(true);
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });

    it("lets his click on a block in somebody else's room through", () => {
        // Ownership doesn't gate picking blocks; restricted zones block the tools, not the click.
        room = createRoom(`${ROOM_ID}-regular-click`, RoomTypeEnumMap.Regular);
        (App.getCurrentRoom as Mock).mockReturnValue(room);
        (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
        (App.getUser as Mock).mockReturnValue(userOwning(""));
        GameModeUtil.enterEditMode(makeCharacter());
        notificationMessageObservable.set(null);

        clickVoxel(10, 10, floorQuadIndexOf(10, 10));

        expect(VoxelQuadSelection.isSelected()).toBe(true);
        expect(notificationMessageObservable.peek()).toBeNull();
    });

    it("carries the selection over to a block the user picks next", () => {
        GameModeUtil.enterEditMode(makeCharacter());
        expect(selectQuad(10, 10, floorQuadIndexOf(10, 10))).toBe(true);

        expect(ObjectSelection.isSelected()).toBe(false);
        expect(VoxelQuadSelection.isSelected()).toBe(true);
        expect(GameModeUtil.isInEditMode()).toBe(true);

        const mode = cameraModeObservable.peek();
        expect(mode.type).toBe("orbit");
        // A block is judged against what surrounds it, so the camera keeps its distance from it.
        expect(mode.type == "orbit" && mode.minDistance).toBeGreaterThan(0);
    });

    it("is not left by a second click on the block being edited", () => {
        // The mode is left via the switch, not by clicking the edited thing.
        GameModeUtil.enterEditMode(makeCharacter());
        const quadIndex = floorQuadIndexOf(10, 10);
        selectQuad(10, 10, quadIndex);
        selectQuad(10, 10, quadIndex);

        expect(VoxelQuadSelection.isSelected()).toBe(true);
        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });

    it("is not left by a second click on the user's own character", () => {
        const character = makeCharacter();
        GameModeUtil.enterEditMode(character);
        ObjectSelection.trySelect(character);

        expect(ObjectSelection.isSelected()).toBe(true);
        expect(GameModeUtil.isInEditMode()).toBe(true);
    });

    it("leaves the current selection standing when asked for a quad nobody can see", () => {
        // A request that finds nothing there to pick out is not the user giving up what he has.
        GameModeUtil.enterEditMode(makeCharacter());
        const floorQuadIndex = floorQuadIndexOf(10, 10);
        selectQuad(10, 10, floorQuadIndex);

        // The side of a block that is not there.
        const hiddenQuadIndex = quadIndexOf(10, 10, "x", "+", COLLISION_LAYER_MIN);
        expect(isQuadVisible(room, hiddenQuadIndex)).toBe(false);

        expect(selectQuad(10, 10, hiddenQuadIndex)).toBe(false);
        expect(selectQuad(10, 10, -1)).toBe(false);

        expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(floorQuadIndex);
    });

    it("keeps the orbit through the gap left by a selection being replaced", () => {
        GameModeUtil.enterEditMode(makeCharacter());
        selectQuad(10, 10, floorQuadIndexOf(10, 10));

        // What an edit does on its way to moving the selection onto what it just built.
        VoxelQuadSelection.unselect();

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });
});

describe("the camera as edit mode opens", () => {
    // The voxel of the boundary wall (see WALL_ROW) the user faces, and where along the wall he stands to
    // face it squarely.
    const WALL_COL = 20;
    const USER_X = VoxelQueryUtil.getWorldXAtVoxelColCenter(WALL_COL);

    // How near to and far from the framed block a step might ask the camera to be.
    const DISTANCE_RANGE = {min: 2.5, max: 6};

    /**
     * Opens edit mode on the boundary wall's face in front of a user standing at (x, z), letting the real
     * camera settle before and after, then asks for a distance range (if given) the way a step does once
     * the mode is open. Returns where the camera was, where the orbit put it, and the block it frames.
     */
    function openEditModeFacingWall(x: number, z: number, wallCol: number,
        distanceRange?: {min: number, max: number}):
        {before: THREE.Vector3, after: THREE.Vector3, block: THREE.Box3}
    {
        const player = new THREE.Object3D();
        player.position.set(x, 0.5 * PLAYER_HEIGHT, z);
        const controller = { gameObject: { obj: player, position: player.position } } as unknown as PlayerController;
        const pointerInput = { dragDelta: new THREE.Vector2(), viewScale: 1 } as unknown as PlayerPointerInput;
        const playerCamera = new PlayerCamera();
        playerCamera.onSpawn(controller, pointerInput);
        try
        {
            // A whole second eases the camera all the way to its pose.
            playerCamera.update(1, controller, NO_IMPOSED_DISPLACEMENT);
            const before = GraphicsManager.getCamera().getWorldPosition(new THREE.Vector3());

            const eyeLayer = COLLISION_LAYER_MIN + Math.floor(before.y / COLLISION_LAYER_HEIGHT);
            const quadIndex = quadIndexOf(WALL_ROW, wallCol, "z", "+", eyeLayer);
            expect(isQuadVisible(room, quadIndex), "the wall face in view is not drawn").toBe(true);

            GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOnVoxelQuad(quadIndex)));
            expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(quadIndex);

            playerCamera.update(1, controller, NO_IMPOSED_DISPLACEMENT);
            if (distanceRange != undefined)
            {
                orbitCameraDistanceRangeRequestObservable.set(distanceRange);
                playerCamera.update(1, controller, NO_IMPOSED_DISPLACEMENT);
            }

            const blockCenter = new THREE.Vector3(VoxelQueryUtil.getWorldXAtVoxelColCenter(wallCol),
                VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(eyeLayer),
                VoxelQueryUtil.getWorldZAtVoxelRowCenter(WALL_ROW));
            const blockSize = new THREE.Vector3(VOXEL_CELL_SIZE, COLLISION_LAYER_HEIGHT, VOXEL_CELL_SIZE);
            return {before, after: GraphicsManager.getCamera().getWorldPosition(new THREE.Vector3()),
                block: new THREE.Box3().setFromCenterAndSize(blockCenter, blockSize)};
        }
        finally
        {
            playerCamera.onDespawn(controller);
            player.remove(GraphicsManager.getCamera());
        }
    }

    /** How far a point is from the nearest and the farthest point of a box. */
    function distancesToBox(point: THREE.Vector3, box: THREE.Box3): {nearest: number, farthest: number}
    {
        let farthest = 0;
        for (const x of [box.min.x, box.max.x])
            for (const y of [box.min.y, box.max.y])
                for (const z of [box.min.z, box.max.z])
                    farthest = Math.max(farthest, point.distanceTo(new THREE.Vector3(x, y, z)));
        return {nearest: box.distanceToPoint(point), farthest};
    }

    it("keeps the camera where it was when the wall faced is as far off as edit mode looks", () => {
        const {before, after} = openEditModeFacingWall(USER_X, WALL_FACE_Z + EDIT_MODE_OPENING_REACH, WALL_COL);

        expect(before.distanceTo(new THREE.Vector3(USER_X, before.y, WALL_FACE_Z)))
            .toBeGreaterThanOrEqual(EDIT_MODE_OPENING_REACH);
        expect(after.distanceTo(before)).toBeLessThan(1e-6);
    });

    it("keeps the camera where it was when the user stands close to the wall", () => {
        const {before, after} = openEditModeFacingWall(USER_X, WALL_FACE_Z + 1, WALL_COL);

        expect(after.distanceTo(before)).toBeLessThan(1e-6);
    });

    it("backs the camera off a wall the user stands against, as far as a step asks", () => {
        const {before, after, block} = openEditModeFacingWall(USER_X, WALL_FACE_Z + PLAYER_RADIUS_XZ, WALL_COL,
            DISTANCE_RANGE);

        expect(distancesToBox(before, block).nearest).toBeLessThan(DISTANCE_RANGE.min);
        const {nearest, farthest} = distancesToBox(after, block);
        expect(nearest).toBeGreaterThanOrEqual(DISTANCE_RANGE.min);
        expect(farthest).toBeLessThanOrEqual(DISTANCE_RANGE.max);
    });

    it("brings the camera in on a wall as far off as edit mode looks, as far as a step asks", () => {
        const {before, after, block} = openEditModeFacingWall(USER_X, WALL_FACE_Z + EDIT_MODE_OPENING_REACH,
            WALL_COL, DISTANCE_RANGE);

        expect(distancesToBox(before, block).farthest).toBeGreaterThan(DISTANCE_RANGE.max);
        const {nearest, farthest} = distancesToBox(after, block);
        expect(nearest).toBeGreaterThanOrEqual(DISTANCE_RANGE.min);
        expect(farthest).toBeLessThanOrEqual(DISTANCE_RANGE.max);
    });

    it("leaves a camera already within the range a step asks for where it was", () => {
        const {before, after} = openEditModeFacingWall(USER_X, WALL_FACE_Z + 4, WALL_COL, DISTANCE_RANGE);

        expect(after.distanceTo(before)).toBeLessThan(1e-6);
    });
});

describe("the orbit following the selection to another face", () => {
    // The voxel of the boundary wall (see WALL_ROW) whose face the mode opens on.
    const START_COL = 20;

    // How many voxels along the wall a face well off to one side lies: three world units.
    const WELL_ALONG = 3 / VOXEL_CELL_SIZE;

    // A row out on the open floor, between the user and the wall, for a block standing alone.
    const LONE_BLOCK_ROW = WALL_ROW + 1 + 2 / VOXEL_CELL_SIZE;

    /**
     * Opens edit mode on the wall's face in front of a user standing back from it, with the real camera
     * settled on it, and hands over that face's layer and a way to let the camera settle again. What is to
     * happen between the mode opening and the orbit's first frame is done on the way.
     */
    function withOrbitOnWall(run: (layer: number, settleCamera: () => void) => void,
        beforeFirstOrbitFrame: () => void = () => {}): void
    {
        const player = new THREE.Object3D();
        player.position.set(VoxelQueryUtil.getWorldXAtVoxelColCenter(START_COL), 0.5 * PLAYER_HEIGHT,
            WALL_FACE_Z + 5);
        const controller = { gameObject: { obj: player, position: player.position } } as unknown as PlayerController;
        const pointerInput = { dragDelta: new THREE.Vector2(), viewScale: 1 } as unknown as PlayerPointerInput;
        const playerCamera = new PlayerCamera();
        playerCamera.onSpawn(controller, pointerInput);
        // A whole second eases the camera all the way to its pose.
        const settleCamera = () => playerCamera.update(1, controller, NO_IMPOSED_DISPLACEMENT);
        try
        {
            settleCamera();
            const eye = GraphicsManager.getCamera().getWorldPosition(new THREE.Vector3());
            const layer = COLLISION_LAYER_MIN + Math.floor(eye.y / COLLISION_LAYER_HEIGHT);
            const quadIndex = quadIndexOf(WALL_ROW, START_COL, "z", "+", layer);
            GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOnVoxelQuad(quadIndex)));
            expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(quadIndex);
            beforeFirstOrbitFrame();
            settleCamera();

            run(layer, settleCamera);
        }
        finally
        {
            playerCamera.onDespawn(controller);
            player.remove(GraphicsManager.getCamera());
        }
    }

    function cameraPose(): {position: THREE.Vector3, facing: THREE.Vector3}
    {
        const camera = GraphicsManager.getCamera();
        return {position: camera.getWorldPosition(new THREE.Vector3()), facing: camera.getWorldDirection(new THREE.Vector3())};
    }

    it("slides alongside a face stepped to by a movement key, holding its angles", () => {
        withOrbitOnWall((layer, settleCamera) => {
            const before = cameraPose();

            // Looking toward -z, the view's right runs toward +x: three voxels along, a step at a time.
            for (let step = 1; step <= 3; ++step)
            {
                expect(SelectionStepUtil.tryStep("right")).toBe(true);
                expect(voxelQuadSelectionObservable.peek()?.quadIndex)
                    .toBe(quadIndexOf(WALL_ROW, START_COL + step, "z", "+", layer));
                settleCamera();
            }

            const after = cameraPose();
            const slid = new THREE.Vector3(3 * VOXEL_CELL_SIZE, 0, 0);
            expect(after.position.distanceTo(before.position.clone().add(slid))).toBeLessThan(1e-6);
            expect(after.facing.distanceTo(before.facing)).toBeLessThan(1e-6);
            expect(orbitCameraAngleHoldRequestObservable.peek()).toBe(false);
        });
    });

    it("turns to look at a face picked out by a click from where it stands", () => {
        withOrbitOnWall((layer, settleCamera) => {
            const before = cameraPose();

            const col = START_COL + WELL_ALONG;
            expect(selectQuad(WALL_ROW, col, quadIndexOf(WALL_ROW, col, "z", "+", layer))).toBe(true);
            settleCamera();

            // Still on the line from that face to where it stood, so facing it at a slant.
            const after = cameraPose();
            expect(after.facing.angleTo(before.facing)).toBeGreaterThan(THREE.MathUtils.degToRad(20));
            expect(after.position.x - before.position.x).toBeLessThan(1);
        });
    });

    it("begins from where the camera stands though a step was taken before its first frame, when it has no angles yet to hold", () => {
        let before = cameraPose();
        withOrbitOnWall((layer) => {
            expect(voxelQuadSelectionObservable.peek()?.quadIndex)
                .toBe(quadIndexOf(WALL_ROW, START_COL + 1, "z", "+", layer));
            expect(cameraPose().position.distanceTo(before.position)).toBeLessThan(1e-6);
            expect(orbitCameraAngleHoldRequestObservable.peek()).toBe(false);
        }, () => {
            before = cameraPose();
            expect(SelectionStepUtil.tryStep("right")).toBe(true);
        });
    });

    it("holds its angles for the one change of target they were asked for", () => {
        withOrbitOnWall((layer, settleCamera) => {
            expect(SelectionStepUtil.tryStep("right")).toBe(true);
            settleCamera();
            const before = cameraPose();

            const col = START_COL + 1 + WELL_ALONG;
            expect(selectQuad(WALL_ROW, col, quadIndexOf(WALL_ROW, col, "z", "+", layer))).toBe(true);
            settleCamera();

            expect(cameraPose().facing.angleTo(before.facing)).toBeGreaterThan(THREE.MathUtils.degToRad(20));
        });
    });

    it("slides alongside a face stepped to round a corner too, never turning to look at it", () => {
        withOrbitOnWall((_layer, settleCamera) => {
            // On the floor at the wall's foot, seen from above and in front: the wall rising there shows as well.
            expect(selectQuad(WALL_ROW + 1, START_COL, floorQuadIndexOf(WALL_ROW + 1, START_COL))).toBe(true);
            orbitCameraViewRequestObservable.set({azimuth: 0, polar: THREE.MathUtils.degToRad(70),
                zoomAmount: orbitCameraZoomObservable.peek()});
            settleCamera();
            const before = cameraPose();

            expect(SelectionStepUtil.tryStep("up")).toBe(true);
            expect(voxelQuadSelectionObservable.peek()?.quadIndex)
                .toBe(quadIndexOf(WALL_ROW, START_COL, "z", "+", COLLISION_LAYER_MIN));
            settleCamera();

            // Looking the same way, from as far off the wall's foot as it stood off the tile: a voxel further
            // on, and up by as much as the orbit looks at a block above a tile lying flat.
            const after = cameraPose();
            expect(after.facing.distanceTo(before.facing)).toBeLessThan(1e-6);
            expect(after.position.x - before.position.x).toBeCloseTo(0, 6);
            expect(after.position.z - before.position.z).toBeCloseTo(-VOXEL_CELL_SIZE, 6);
            expect(after.position.y - before.position.y).toBeGreaterThan(0.25);
            expect(after.position.y - before.position.y).toBeLessThan(0.5 * COLLISION_LAYER_HEIGHT + 0.25);
            expect(orbitCameraAngleHoldRequestObservable.peek()).toBe(false);
        });
    });

    it("stays as it is when a step is refused for a face turned away from it", () => {
        withOrbitOnWall((_layer, settleCamera) => {
            // A block standing alone between the user and the wall, seen squarely: its sides show edge-on at
            // best, and past each lies its back, turned away.
            buildPillar(room, LONE_BLOCK_ROW, START_COL, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
            const front = quadIndexOf(LONE_BLOCK_ROW, START_COL, "z", "+", COLLISION_LAYER_MIN);
            expect(selectQuad(LONE_BLOCK_ROW, START_COL, front)).toBe(true);
            settleCamera();
            const before = cameraPose();

            for (const direction of ["left", "right"] as const)
            {
                expect(SelectionStepUtil.tryStep(direction)).toBe(false);
                expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(front);
                expect(orbitCameraAngleHoldRequestObservable.peek()).toBe(false);
            }
            settleCamera();

            const after = cameraPose();
            expect(after.position.distanceTo(before.position)).toBeLessThan(1e-6);
            expect(after.facing.distanceTo(before.facing)).toBeLessThan(1e-6);
        });
    });

    it("steps round a corner exactly where the orbit, once slid alongside, sees the face from its front, and past it where not", () => {
        withOrbitOnWall((layer, settleCamera) => {
            // A block standing against the wall a voxel along: its side, turned toward -x, is in the way of a
            // step along the wall, and shows only from far enough round to that side. Past the side lies the
            // block's front, turned the way the wall is.
            const wallFace = quadIndexOf(WALL_ROW, START_COL, "z", "+", layer);
            const blockSide = quadIndexOf(WALL_ROW + 1, START_COL + 1, "x", "-", layer);
            const blockFront = quadIndexOf(WALL_ROW + 1, START_COL + 1, "z", "+", layer);
            const blockSideX = (START_COL + 1) * VOXEL_CELL_SIZE;
            buildPillar(room, WALL_ROW + 1, START_COL + 1, COLLISION_LAYER_MIN, layer);

            const sideTaken: boolean[] = [];
            for (const roundDeg of [-14, -11, -8, -6.5, -4, -2, 0, 3])
            {
                expect(selectQuad(WALL_ROW, START_COL, wallFace)).toBe(true);
                orbitCameraViewRequestObservable.set({azimuth: THREE.MathUtils.degToRad(roundDeg),
                    polar: THREE.MathUtils.degToRad(80), zoomAmount: orbitCameraZoomObservable.peek()});
                settleCamera();

                expect(SelectionStepUtil.tryStep("right")).toBe(true);
                const taken = voxelQuadSelectionObservable.peek()?.quadIndex == blockSide;
                sideTaken.push(taken);
                if (!taken)
                {
                    // Passed over for the front. Taken all the same, with the angles held as a step has them,
                    // it shows from behind.
                    expect(voxelQuadSelectionObservable.peek()?.quadIndex, `at ${roundDeg}`).toBe(blockFront);
                    expect(selectQuad(WALL_ROW + 1, START_COL + 1, blockSide)).toBe(true);
                    orbitCameraAngleHoldRequestObservable.set(true);
                }
                settleCamera();

                // Before the side's plane, which lies toward -x of it, or not.
                const beforeItsPlane = cameraPose().position.x < blockSideX;
                expect(beforeItsPlane, `${roundDeg} degrees round`).toBe(taken);
            }
            // Both sides of the line were tried, and the line falls where the face's depth in its block puts it.
            expect(sideTaken).toEqual([true, true, true, true, true, false, false, false]);
        });
    });

    it("slides alongside a face reached past one turned away, as to any other", () => {
        withOrbitOnWall((_layer, settleCamera) => {
            // A low block standing alone between the user and the wall, seen from before and above: past its
            // far side, which is turned away, lies the floor behind it.
            buildPillar(room, LONE_BLOCK_ROW, START_COL, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
            const top = quadIndexOf(LONE_BLOCK_ROW, START_COL, "y", "+", COLLISION_LAYER_MIN);
            expect(selectQuad(LONE_BLOCK_ROW, START_COL, top)).toBe(true);
            orbitCameraViewRequestObservable.set({azimuth: 0, polar: THREE.MathUtils.degToRad(60),
                zoomAmount: orbitCameraZoomObservable.peek()});
            settleCamera();
            const before = cameraPose();

            expect(SelectionStepUtil.tryStep("up")).toBe(true);
            expect(voxelQuadSelectionObservable.peek()?.quadIndex)
                .toBe(floorQuadIndexOf(LONE_BLOCK_ROW - 1, START_COL));
            settleCamera();

            // Looking the same way, a voxel further on and lower by as much as the tile lies under the block.
            const after = cameraPose();
            expect(after.facing.distanceTo(before.facing)).toBeLessThan(1e-6);
            expect(after.position.z - before.position.z).toBeCloseTo(-VOXEL_CELL_SIZE, 6);
            expect(after.position.y).toBeLessThan(before.position.y - 0.2);
            expect(after.position.y).toBeGreaterThan(0);
        });
    });
});

describe("the line of sight edit mode looks along", () => {
    // The camera's eye, looking level along -z.
    const EYE = new THREE.Vector3(10.5, 2, 20.5);

    const meshes: THREE.Mesh[] = [];
    const objectById: {[objectId: string]: GameObject} = {};

    // Boxes sit this far off their point, so a ray through the point doesn't run along the seam between
    // two triangles of a face and meet the box twice.
    const OFF_SEAM = new THREE.Vector3(0.03, 0.02, 0.01);

    /** A small box around a point, drawing an object of its own. */
    function objectAt(objectId: string, position: THREE.Vector3): GameObject
    {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial());
        mesh.name = objectId; // A plain mesh is named after its object (see CameraUtil).
        mesh.position.copy(position).add(OFF_SEAM);
        mesh.updateMatrixWorld();
        meshes.push(mesh);

        const gameObject = { params: { objectId } } as unknown as GameObject;
        objectById[objectId] = gameObject;
        return gameObject;
    }

    /** The point a distance along the camera's heading, tilted toward the ground by an angle. */
    function aheadOfEye(distance: number, pitchDownAngle: number = 0): THREE.Vector3
    {
        return new THREE.Vector3(EYE.x, EYE.y - distance * Math.sin(pitchDownAngle),
            EYE.z - distance * Math.cos(pitchDownAngle));
    }

    function objectsMet(maxDistance: number, pitchDownAngle: number): GameObject[]
    {
        return CameraUtil.getObjectsAlongLineOfSight(maxDistance, pitchDownAngle).map(hit => hit.gameObject);
    }

    function lookToward(target: THREE.Vector3): void
    {
        const camera = GraphicsManager.getCamera();
        camera.position.copy(EYE);
        camera.lookAt(target);
        camera.updateMatrixWorld();
    }

    beforeEach(() => {
        meshes.length = 0;
        lookToward(aheadOfEye(1));
        vi.spyOn(MeshFactory, "getMeshes").mockReturnValue(meshes);
        (ClientObjectManager.getObjectById as Mock).mockImplementation((objectId: string) => objectById[objectId]);
    });

    afterEach(() => {
        vi.mocked(MeshFactory.getMeshes).mockRestore();
    });

    it("meets what stands within reach, and nothing beyond it", () => {
        const near = objectAt("near", aheadOfEye(EDIT_MODE_OPENING_REACH - 1));
        objectAt("far", aheadOfEye(EDIT_MODE_OPENING_REACH + 1));

        expect(objectsMet(EDIT_MODE_OPENING_REACH, 0)).toEqual([near]);
    });

    it("tilts toward the ground by the angle asked for, keeping its heading", () => {
        const level = objectAt("level", aheadOfEye(3));
        const tilted = objectAt("tilted", aheadOfEye(3, EDIT_MODE_OPENING_TILT));

        expect(objectsMet(EDIT_MODE_OPENING_REACH, 0)).toEqual([level]);
        expect(objectsMet(EDIT_MODE_OPENING_REACH, EDIT_MODE_OPENING_TILT)).toEqual([tilted]);
    });

    it("tilts no further than straight down, rather than over onto what lies behind", () => {
        // Already looking steeply down, so the tilt would carry it past the vertical.
        const steepPitchDown = 0.5 * Math.PI - 0.5 * EDIT_MODE_OPENING_TILT;
        lookToward(aheadOfEye(1, steepPitchDown));
        const below = objectAt("below", new THREE.Vector3(EYE.x, EYE.y - 1.5, EYE.z));
        objectAt("behind", aheadOfEye(1.5, steepPitchDown + EDIT_MODE_OPENING_TILT));

        expect(objectsMet(EDIT_MODE_OPENING_REACH, EDIT_MODE_OPENING_TILT)).toEqual([below]);
    });

    // A picture is cut out of its quad, and what it draws at a point is the atlas's to say (see
    // texture-atlas.test.ts); here that answer is given, and the casts are watched for what they make of it.
    describe("through a picture", () => {
        // The middle of the view, which the line of sight runs through, as a pointer event names it.
        const MIDDLE_OF_VIEW = {clientX: 400, clientY: 300} as unknown as PointerEvent;
        const PICTURE_SIDE = 0.4;

        let numPictures = 0;
        let pictureMeshName = "";

        /** A picture facing the eye at a point: one instance of an instanced quad, owned by an object of its own. */
        function pictureAt(objectId: string, position: THREE.Vector3): GameObject
        {
            const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(PICTURE_SIDE, PICTURE_SIDE),
                new THREE.MeshBasicMaterial(), 1);
            mesh.name = pictureMeshName = `picture-mesh-${++numPictures}`; // Owners are kept by mesh name.
            mesh.setMatrixAt(0, new THREE.Matrix4().setPosition(position.clone().add(OFF_SEAM)));
            meshes.push(mesh);

            const gameObject = { params: { objectId } } as unknown as GameObject;
            const binding = new InstancedMeshBinding(new InstancedColorMaterialParams(), "Square", 1, false);
            binding.instancedMesh = mesh;
            binding.reserveInstance(gameObject, 0);
            return gameObject;
        }

        function objectClicked(): GameObject | undefined
        {
            const hit = CameraUtil.castFromPointer(MIDDLE_OF_VIEW);
            return hit && CameraUtil.getObjectFromIntersection(hit);
        }

        // What is asked of a picture, answered by the game itself unless a test answers for it.
        let isDrawn: MockInstance<typeof InstancedMeshGraphics.instanceIsDrawnAt>;

        beforeEach(() => {
            isDrawn = vi.spyOn(InstancedMeshGraphics, "instanceIsDrawnAt");
        });

        afterEach(() => {
            isDrawn.mockRestore();
        });

        it("passes where the picture draws nothing, to what stands behind it, as a click there does", () => {
            pictureAt("picture", aheadOfEye(2));
            const behind = objectAt("behind", aheadOfEye(3));
            isDrawn.mockReturnValue(false);

            expect(objectsMet(EDIT_MODE_OPENING_REACH, 0)).toEqual([behind]);
            expect(objectClicked()).toBe(behind);

            // Asked of the instance met, at the point of its quad the line runs through.
            const [meshName, instanceId, uv] = isDrawn.mock.calls[0];
            expect([meshName, instanceId]).toEqual([pictureMeshName, 0]);
            expect(uv.x).toBeCloseTo(0.5 - OFF_SEAM.x / PICTURE_SIDE, 5);
            expect(uv.y).toBeCloseTo(0.5 - OFF_SEAM.y / PICTURE_SIDE, 5);
        });

        it("stops at the picture where it draws something, as a click there does", () => {
            const picture = pictureAt("picture", aheadOfEye(2));
            const behind = objectAt("behind", aheadOfEye(3));
            isDrawn.mockReturnValue(true);

            expect(objectsMet(EDIT_MODE_OPENING_REACH, 0)).toEqual([picture, behind]);
            expect(objectClicked()).toBe(picture);
        });

        it("takes an instanced mesh nothing says otherwise of as drawn all over", () => {
            const picture = pictureAt("picture", aheadOfEye(2));
            const behind = objectAt("behind", aheadOfEye(3));

            expect(objectsMet(EDIT_MODE_OPENING_REACH, 0)).toEqual([picture, behind]);
            expect(objectClicked()).toBe(picture);
        });

        // Asking reads the atlas back from the GPU, which a cast made every frame must never do.
        it("is not asked what it draws by a cast between two points, which it stands in the way of all over", () => {
            pictureAt("picture", aheadOfEye(2));
            isDrawn.mockReturnValue(false);
            const getMeshesExcept = vi.spyOn(MeshFactory, "getMeshesExcept").mockImplementation((_excludedMeshId, out) => {
                out.length = 0;
                out.push(...meshes);
                return out;
            });

            const hits = CameraUtil.castBetweenPoints(EYE, aheadOfEye(3), []);
            getMeshesExcept.mockRestore();

            expect(hits.map(hit => hit.object.name)).toEqual([pictureMeshName]);
            expect(isDrawn).not.toHaveBeenCalled();
        });
    });
});

describe("a scripted step choosing what edit mode opens on", () => {
    // A face of the boundary wall (see WALL_ROW), as a step might pick it.
    const WALL_FACE_QUAD_INDEX = quadIndexOf(WALL_ROW, 10, "z", "+", COLLISION_LAYER_MIN + 2);

    function pickOpening(quadIndex: () => number): void
    {
        SinglePlayerActionMap["edit_mode_opening_voxel_quad"]({type: "edit_mode_opening_voxel_quad", quadIndex});
    }

    it("opens on the step's pick instead of anything the camera faces, past the step's selection lock", () => {
        expect(isQuadVisible(room, WALL_FACE_QUAD_INDEX), "the wall face is not drawn").toBe(true);
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableVoxelQuadSelectionChange);
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableObjectSelectionChange);
        pickOpening(() => WALL_FACE_QUAD_INDEX);
        const cast = vi.fn(lookingAt(hitOn(makePicture())));

        GameModeUtil.enterEditMode(makeCharacter(), cast);

        expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(WALL_FACE_QUAD_INDEX);
        expect(cast).not.toHaveBeenCalled();
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });

    it("picks as the mode opens, not as the step sets it up, since the user may still walk meanwhile", () => {
        let quadIndexWhereTheUserEndsUp = floorQuadIndexOf(10, 10);
        pickOpening(() => quadIndexWhereTheUserEndsUp);
        quadIndexWhereTheUserEndsUp = WALL_FACE_QUAD_INDEX;

        GameModeUtil.enterEditMode(makeCharacter(), lookingAt());

        expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(WALL_FACE_QUAD_INDEX);
    });

    it("opens as usual when the step's pick can't be selected, or once the step lets go", () => {
        const picture = makePicture();
        pickOpening(() => -1);

        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));
        expect(objectSelectionObservable.peek()?.gameObject).toBe(picture);

        GameModeUtil.exitEditMode();
        pickOpening(() => WALL_FACE_QUAD_INDEX);
        SinglePlayerActionMap["clear_edit_mode_opening_voxel_quad"]({type: "clear_edit_mode_opening_voxel_quad"});

        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));
        expect(objectSelectionObservable.peek()?.gameObject).toBe(picture);
    });
});

describe("leaving edit mode", () => {
    it("drops the selection and hands the camera back", () => {
        GameModeUtil.enterEditMode(makeCharacter());
        selectQuad(10, 10, floorQuadIndexOf(10, 10));

        GameModeUtil.exitEditMode();

        expect(WorldSpaceSelectionUtil.isAnythingSelected()).toBe(false);
        expect(GameModeUtil.isInEditMode()).toBe(false);
        expect(cameraModeObservable.peek().type).toBe("firstPerson");
    });

    it("takes a selection a scripted step had pinned along with it", () => {
        // Leaving the mode drops a step-pinned selection, or it would be invisible and unreleasable
        // (a step that keeps the user in the mode says so explicitly; see below).
        GameModeUtil.enterEditMode(makeCharacter());
        selectQuad(10, 10, floorQuadIndexOf(10, 10));
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableVoxelQuadSelectionChange);

        GameModeUtil.exitEditMode();

        expect(VoxelQuadSelection.isSelected()).toBe(false);
        expect(GameModeUtil.isInEditMode()).toBe(false);
        expect(cameraModeObservable.peek().type).toBe("firstPerson");
    });
});

describe("a selection the user makes by hand", () => {
    let announced: {before: VoxelQuadSelection | ObjectSelection | null, after: VoxelQuadSelection | ObjectSelection}[];

    beforeEach(() => {
        announced = [];
        manualSelectionObservable.addListener("game-mode.test", selection => { announced.push(selection); });
    });

    afterEach(() => {
        manualSelectionObservable.removeListener("game-mode.test");
    });

    it("is announced by a click on a face, with what it left and what it took", () => {
        const character = makeCharacter();
        GameModeUtil.enterEditMode(character);
        const quadIndex = floorQuadIndexOf(10, 10);

        clickVoxel(10, 10, quadIndex);

        expect(announced.length).toBe(1);
        expect((announced[0].before as ObjectSelection).gameObject).toBe(character);
        expect((announced[0].after as VoxelQuadSelection).quadIndex).toBe(quadIndex);
    });

    it("is announced by a click on an object", () => {
        const quadIndex = floorQuadIndexOf(10, 10);
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOnVoxelQuad(quadIndex)));
        const picture = makePicture();

        // The click path every kind of object shares, reached through a subclass that doesn't override it:
        // GameObject imported for its value would be entered first, and its subclasses made before it.
        VoxelGameObject.prototype.onClick.call(picture, -1, new THREE.Vector3());

        expect(announced.length).toBe(1);
        expect((announced[0].before as VoxelQuadSelection).quadIndex).toBe(quadIndex);
        expect((announced[0].after as ObjectSelection).gameObject).toBe(picture);
    });

    it("is not announced by a click that leaves the selection where it is", () => {
        GameModeUtil.enterEditMode(makeCharacter());
        const quadIndex = floorQuadIndexOf(10, 10);

        clickVoxel(10, 10, quadIndex);
        clickVoxel(10, 10, quadIndex);

        expect(announced.length).toBe(1);
        expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(quadIndex);
    });

    it("is not announced as edit mode opens, whatever it opens on", () => {
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOnVoxelQuad(floorQuadIndexOf(10, 10))));
        expect(VoxelQuadSelection.isSelected()).toBe(true);
        GameModeUtil.exitEditMode();

        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(makePicture())));
        expect(ObjectSelection.isSelected()).toBe(true);
        GameModeUtil.exitEditMode();

        GameModeUtil.enterEditMode(makeCharacter());
        expect(ObjectSelection.isSelected()).toBe(true);

        expect(announced).toEqual([]);
    });

    it("is not announced when code asks for it, nor by a click in play mode", () => {
        clickVoxel(10, 10, floorQuadIndexOf(10, 10));
        GameModeUtil.enterEditMode(makeCharacter());
        expect(selectQuad(10, 10, floorQuadIndexOf(10, 10))).toBe(true);
        expect(ObjectSelection.trySelect(makePicture())).toBe(true);

        expect(announced).toEqual([]);
    });
});

describe("a gizmo drag holding the view", () => {
    // A failed case must not leave the orbit held for the next one.
    afterEach(() => WorldSpaceSelectionUtil.releaseOrbitTarget());

    it("keeps the pivot where it was while the selection moves under it, and follows it once let go", () => {
        const picture = makePicture();
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));
        const startX = picture.position.x;

        WorldSpaceSelectionUtil.holdOrbitTarget();
        picture.position.x += 2;
        // Re-announced mid-drag (e.g. by somebody else's edit): still held.
        objectSelectionObservable.notify();

        const held = cameraModeObservable.peek();
        expect(held.type == "orbit" && held.target.center.x).toBe(startX);
        expect(held.type == "orbit" && held.target.center).not.toBe(picture.position);

        WorldSpaceSelectionUtil.releaseOrbitTarget();

        const released = cameraModeObservable.peek();
        expect(released.type == "orbit" && released.target.center).toBe(picture.position);
    });

    it("goes back to following the selection even when the drag moved nothing", () => {
        const picture = makePicture();
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));

        WorldSpaceSelectionUtil.holdOrbitTarget();
        WorldSpaceSelectionUtil.releaseOrbitTarget();

        // The held copy is traded back, so later moves carry the orbit along again.
        const released = cameraModeObservable.peek();
        expect(released.type == "orbit" && released.target.center).toBe(picture.position);
    });

    it("hands the camera back on release if edit mode was left during the drag", () => {
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(makePicture())));

        WorldSpaceSelectionUtil.holdOrbitTarget();
        GameModeUtil.exitEditMode();
        WorldSpaceSelectionUtil.releaseOrbitTarget();

        expect(cameraModeObservable.peek().type).toBe("firstPerson");
    });

    // Stands the camera a way off the picture, squarely before it, and tells the orbit it looks from there.
    const lookAtPictureFrom = (picture: GameObject, distance: number): void => {
        const camera = GraphicsManager.getCamera();
        camera.removeFromParent();
        camera.position.set(picture.position.x, picture.position.y, picture.position.z + distance);
        camera.updateMatrixWorld(true);
        orbitCameraAnglesObservable.set({azimuth: 0, polar: 0.5 * Math.PI});
    };
    // The way from the orbit's pivot to its camera, as its published angles have it.
    const orbitDirection = (): THREE.Vector3 => {
        const {azimuth, polar} = orbitCameraAnglesObservable.peek();
        return new THREE.Vector3().setFromSphericalCoords(1, polar, azimuth);
    };
    const degreesFrom = (facing: THREE.Vector3): number => THREE.MathUtils.radToDeg(orbitDirection().angleTo(facing));
    const heldPivot = (): {x: number, y: number, z: number} => {
        const mode = cameraModeObservable.peek();
        if (mode.type != "orbit")
            throw new Error(`The camera is not orbiting (mode = ${mode.type})`);
        return mode.target.center;
    };

    it("slides the held pivot toward a point by a share of the camera's distance, the selection staying where it is", () => {
        const picture = makePicture();
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));
        const start = {x: picture.position.x, y: picture.position.y, z: picture.position.z};
        lookAtPictureFrom(picture, 8);

        WorldSpaceSelectionUtil.holdOrbitTarget();
        const held = cameraModeObservable.peek();
        // A quarter of the eight units the camera stands off: two units, along the way to the point.
        WorldSpaceSelectionUtil.slideHeldOrbitTarget({x: start.x + 6, y: start.y, z: start.z + 8}, 0.25, 1, 1);

        // The same mode and the same target, moved: the orbit keeps its angles and goes alongside.
        expect(cameraModeObservable.peek()).toBe(held);
        expect(heldPivot().x).toBeCloseTo(start.x + 1.2, 10);
        expect(heldPivot().y).toBeCloseTo(start.y, 10);
        expect(heldPivot().z).toBeCloseTo(start.z + 1.6, 10);
        expect(picture.position).toMatchObject(start);

        // Let go, the orbit is back on the selection where that stands.
        WorldSpaceSelectionUtil.releaseOrbitTarget();
        const released = cameraModeObservable.peek();
        expect(released.type == "orbit" && released.target.center).toBe(picture.position);
    });

    it("slides it at a pace that goes by how far off the camera stands, and never past the point", () => {
        const picture = makePicture();
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));
        const startX = picture.position.x;
        const point = {x: startX + 3, y: picture.position.y, z: picture.position.z};

        lookAtPictureFrom(picture, 4);
        WorldSpaceSelectionUtil.holdOrbitTarget();
        WorldSpaceSelectionUtil.slideHeldOrbitTarget(point, 0.25, 1, 1);
        expect(heldPivot().x).toBeCloseTo(startX + 1, 10);
        WorldSpaceSelectionUtil.releaseOrbitTarget();

        // Twice as far off, twice the step.
        lookAtPictureFrom(picture, 8);
        WorldSpaceSelectionUtil.holdOrbitTarget();
        WorldSpaceSelectionUtil.slideHeldOrbitTarget(point, 0.25, 1, 1);
        expect(heldPivot().x).toBeCloseTo(startX + 2, 10);

        // A step longer than what is left of the way stops at the point, and one more goes nowhere.
        WorldSpaceSelectionUtil.slideHeldOrbitTarget(point, 0.25, 1, 1);
        expect(heldPivot()).toEqual(point);
        WorldSpaceSelectionUtil.slideHeldOrbitTarget(point, 0.25, 1, 1);
        expect(heldPivot()).toEqual(point);
    });

    it("goes only as much of the way across the view, and up or down the room, as it is told to", () => {
        const picture = makePicture();
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));
        const start = {x: picture.position.x, y: picture.position.y, z: picture.position.z};
        // A place to the east of the picture, above it, and nearer the camera that looks at it from the south.
        const place = {x: start.x + 3, y: start.y + 4, z: start.z + 2};
        // How far a slide with all the pace it needs takes the pivot, to the east, up, and toward the camera.
        const slideFromStart = (sideways: number, upDown: number): number[] => {
            lookAtPictureFrom(picture, 8);
            WorldSpaceSelectionUtil.holdOrbitTarget();
            WorldSpaceSelectionUtil.slideHeldOrbitTarget(place, 10, sideways, upDown);
            const {x, y, z} = heldPivot();
            WorldSpaceSelectionUtil.releaseOrbitTarget();
            return [x - start.x, y - start.y, z - start.z].map(n => Math.round(n * 1e9) / 1e9);
        };

        // Toward or away from the camera it always goes; across and up only as told.
        expect(slideFromStart(1, 1)).toEqual([3, 4, 2]);
        expect(slideFromStart(0, 0)).toEqual([0, 0, 2]);
        expect(slideFromStart(1, 0)).toEqual([3, 0, 2]);
        expect(slideFromStart(0, 1)).toEqual([0, 4, 2]);
        expect(slideFromStart(0.5, 0.25)).toEqual([1.5, 1, 2]);

        // Across is across the view, wherever it looks from: from the east, the room's north and south.
        const camera = GraphicsManager.getCamera();
        camera.position.set(start.x + 8, start.y, start.z);
        camera.lookAt(start.x, start.y, start.z);
        camera.updateMatrixWorld(true);
        WorldSpaceSelectionUtil.holdOrbitTarget();
        WorldSpaceSelectionUtil.slideHeldOrbitTarget(place, 10, 0, 0);
        expect(heldPivot().x - start.x).toBeCloseTo(3, 9);
        expect(heldPivot().y - start.y).toBeCloseTo(0, 9);
        expect(heldPivot().z - start.z).toBeCloseTo(0, 9);
        camera.rotation.set(0, 0, 0);
    });

    it("slides nothing that isn't held", () => {
        const picture = makePicture();
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));
        const start = {x: picture.position.x, y: picture.position.y, z: picture.position.z};
        const elsewhere = {x: start.x + 4, y: start.y, z: start.z};
        lookAtPictureFrom(picture, 8);

        // The orbit's own target is the selection's live position, which is never written.
        WorldSpaceSelectionUtil.slideHeldOrbitTarget(elsewhere, 0.5, 1, 1);
        expect(picture.position).toMatchObject(start);

        WorldSpaceSelectionUtil.holdOrbitTarget();
        WorldSpaceSelectionUtil.releaseOrbitTarget();
        WorldSpaceSelectionUtil.slideHeldOrbitTarget(elsewhere, 0.5, 1, 1);
        expect(picture.position).toMatchObject(start);
    });

    it("never slides or turns the view off a place a scripted step holds it on", () => {
        const stepsChosenPlace = {x: 20.5, y: 0, z: 30.5};
        const picture = makePicture();
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));
        lookAtPictureFrom(picture, 8);
        orbitCameraTargetOverrideObservable.set(stepsChosenPlace);

        WorldSpaceSelectionUtil.holdOrbitTarget();
        WorldSpaceSelectionUtil.slideHeldOrbitTarget({x: 0, y: 0, z: 0}, 0.5, 1, 1);
        WorldSpaceSelectionUtil.turnHeldOrbitToward({x: 1, y: 0, z: 0}, 0.25 * Math.PI, 0.5);

        expect(heldPivot()).toEqual(stepsChosenPlace);
        expect(stepsChosenPlace).toEqual({x: 20.5, y: 0, z: 30.5});
        expect(orbitCameraAnglesObservable.peek()).toEqual({azimuth: 0, polar: 0.5 * Math.PI});
    });

    it("slides and turns nothing under a camera that wasn't orbiting when the drag began", () => {
        const picture = makePicture();
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));
        lookAtPictureFrom(picture, 8);
        cameraModeObservable.set({type: "free"});

        WorldSpaceSelectionUtil.holdOrbitTarget();
        WorldSpaceSelectionUtil.slideHeldOrbitTarget({x: 0, y: 0, z: 0}, 0.5, 1, 1);
        WorldSpaceSelectionUtil.turnHeldOrbitToward({x: 1, y: 0, z: 0}, 0.25 * Math.PI, 0.5);

        expect(cameraModeObservable.peek()).toEqual({type: "free"});
        expect(orbitCameraAnglesObservable.peek()).toEqual({azimuth: 0, polar: 0.5 * Math.PI});
    });

    it("turns the held view toward seeing a facing, a step at a time, and no nearer head-on than asked", () => {
        const picture = makePicture();
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));
        lookAtPictureFrom(picture, 8);
        WorldSpaceSelectionUtil.holdOrbitTarget();

        // Squarely before a wall that looks south, the view sees one that looks west edge-on.
        const west = new THREE.Vector3(-1, 0, 0);
        expect(degreesFrom(west)).toBeCloseTo(90, 6);

        WorldSpaceSelectionUtil.turnHeldOrbitToward(west, THREE.MathUtils.degToRad(45), THREE.MathUtils.degToRad(10));
        expect(degreesFrom(west)).toBeCloseTo(80, 6);
        // Round the way that is shortest: level as it was, the camera gone toward the west.
        expect(orbitCameraAnglesObservable.peek().polar).toBeCloseTo(0.5 * Math.PI, 9);
        expect(orbitDirection().x).toBeLessThan(0);

        for (let i = 0; i < 10; ++i)
            WorldSpaceSelectionUtil.turnHeldOrbitToward(west, THREE.MathUtils.degToRad(45), THREE.MathUtils.degToRad(10));
        expect(degreesFrom(west)).toBeCloseTo(45, 6);

        // Seen well enough already, it is left as it is.
        const settled = orbitCameraAnglesObservable.peek();
        WorldSpaceSelectionUtil.turnHeldOrbitToward(west, THREE.MathUtils.degToRad(45), THREE.MathUtils.degToRad(10));
        WorldSpaceSelectionUtil.turnHeldOrbitToward(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(45), 1);
        expect(orbitCameraAnglesObservable.peek()).toBe(settled);
    });

    it("turns it down to see a floor and up to see a ceiling, round the far side of one seen from behind", () => {
        const picture = makePicture();
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));
        lookAtPictureFrom(picture, 8);
        WorldSpaceSelectionUtil.holdOrbitTarget();
        const turnFullyToward = (facing: THREE.Vector3): void => {
            for (let i = 0; i < 40; ++i)
                WorldSpaceSelectionUtil.turnHeldOrbitToward(facing, THREE.MathUtils.degToRad(45), THREE.MathUtils.degToRad(10));
        };

        // A floor: the camera rises over it, heading as it was.
        turnFullyToward(new THREE.Vector3(0, 1, 0));
        expect(THREE.MathUtils.radToDeg(orbitCameraAnglesObservable.peek().polar)).toBeCloseTo(45, 6);
        expect(orbitCameraAnglesObservable.peek().azimuth).toBeCloseTo(0, 9);

        // A ceiling: it drops beneath.
        turnFullyToward(new THREE.Vector3(0, -1, 0));
        expect(THREE.MathUtils.radToDeg(orbitCameraAnglesObservable.peek().polar)).toBeCloseTo(135, 6);
        expect(orbitCameraAnglesObservable.peek().azimuth).toBeCloseTo(0, 9);

        // A wall seen from straight behind: round either side of it, level, to its front.
        orbitCameraAnglesObservable.set({azimuth: 0, polar: 0.5 * Math.PI});
        const north = new THREE.Vector3(0, 0, -1);
        turnFullyToward(north);
        expect(degreesFrom(north)).toBeCloseTo(45, 6);
        expect(orbitCameraAnglesObservable.peek().polar).toBeCloseTo(0.5 * Math.PI, 9);
    });

    it("keeps the orbit's azimuth running on through a turn, as a drag leaves it, never wrapped", () => {
        const picture = makePicture();
        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOn(picture)));
        lookAtPictureFrom(picture, 8);
        WorldSpaceSelectionUtil.holdOrbitTarget();

        // Three whole turns on from due south, and a little short of the wrap: turning on toward the east crosses it.
        const turnsOn = 3 * 2 * Math.PI;
        orbitCameraAnglesObservable.set({azimuth: turnsOn + THREE.MathUtils.degToRad(170), polar: 0.5 * Math.PI});
        const northWest = new THREE.Vector3(-1, 0, -1).normalize();
        WorldSpaceSelectionUtil.turnHeldOrbitToward(northWest, 0, THREE.MathUtils.degToRad(30));

        expect(THREE.MathUtils.radToDeg(orbitCameraAnglesObservable.peek().azimuth - turnsOn)).toBeCloseTo(200, 6);
    });
});

describe("a scripted step holding the user in his mode", () => {
    // The hold applies to the crossing itself, not only to the switch that asks for it.
    it("keeps the way out shut", () => {
        GameModeUtil.enterEditMode(makeCharacter());
        selectQuad(10, 10, floorQuadIndexOf(10, 10));
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableGameModeTransition);

        GameModeUtil.exitEditMode(); // What the switch comes down to.

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(VoxelQuadSelection.isSelected()).toBe(true);
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });

    it("keeps the way in shut", () => {
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableGameModeTransition);

        GameModeUtil.enterEditMode(makeCharacter());

        expect(GameModeUtil.isInEditMode()).toBe(false);
        expect(ObjectSelection.isSelected()).toBe(false);
        expect(cameraModeObservable.peek().type).toBe("firstPerson");
    });

    it("lets the way out through again once it lets go", () => {
        // The step teaching the exit opens it; its pinned selection doesn't block leaving.
        GameModeUtil.enterEditMode(makeCharacter());
        selectQuad(10, 10, floorQuadIndexOf(10, 10));
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableVoxelQuadSelectionChange);
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableGameModeTransition);
        clientFeatureFlagsObservable.tryRemove(FeatureFlag.DisableGameModeTransition);

        GameModeUtil.exitEditMode();

        expect(GameModeUtil.isInEditMode()).toBe(false);
        expect(WorldSpaceSelectionUtil.isAnythingSelected()).toBe(false);
    });
});

describe("a scripted step pointing the camera", () => {
    // A tutorial step may hold the camera on its own focus, to show something not yet selectable.
    const stepsChosenPlace = {x: 20.5, y: 0, z: 30.5};

    it("holds the camera on its own place while the user's selection stands", () => {
        GameModeUtil.enterEditMode(makeCharacter());

        orbitCameraTargetOverrideObservable.set(stepsChosenPlace);

        const mode = cameraModeObservable.peek();
        expect(mode.type == "orbit" && mode.target.center.x).toBe(stepsChosenPlace.x);
        expect(mode.type == "orbit" && mode.target.center.z).toBe(stepsChosenPlace.z);
        // The step is showing the user somewhere, not picking anything out for him.
        expect(ObjectSelection.isSelected()).toBe(true);
    });

    it("outranks what the user selects meanwhile, and gives the camera back when it ends", () => {
        GameModeUtil.enterEditMode(makeCharacter());
        orbitCameraTargetOverrideObservable.set(stepsChosenPlace);
        selectQuad(10, 10, floorQuadIndexOf(10, 10));

        const heldMode = cameraModeObservable.peek();
        expect(heldMode.type == "orbit" && heldMode.target.center.x).toBe(stepsChosenPlace.x);

        orbitCameraTargetOverrideObservable.set(null);

        // Back onto the quad the user picked while the step was holding the view.
        const freedMode = cameraModeObservable.peek();
        expect(freedMode.type == "orbit" && freedMode.target.center.x)
            .toBe(VoxelQueryUtil.getWorldXAtVoxelColCenter(10));
        expect(freedMode.type == "orbit" && freedMode.target.center.z)
            .toBe(VoxelQueryUtil.getWorldZAtVoxelRowCenter(10));
    });

    it("leaves the camera where it is in play mode", () => {
        orbitCameraTargetOverrideObservable.set(stepsChosenPlace);

        expect(cameraModeObservable.peek().type).toBe("firstPerson");
    });
});

describe("only one thing at a time is selected", () => {
    it("replaces the character with a block, and the block with the character again", () => {
        const character = makeCharacter();
        GameModeUtil.enterEditMode(character);

        selectQuad(10, 10, floorQuadIndexOf(10, 10));
        expect(ObjectSelection.isSelected()).toBe(false);

        ObjectSelection.trySelect(character);
        expect(VoxelQuadSelection.isSelected()).toBe(false);
        expect(ObjectSelection.isSelected()).toBe(true);
    });

    it("replaces the character even while a step holds the character's own selection down", () => {
        GameModeUtil.enterEditMode(makeCharacter());
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableObjectSelectionChange);

        // The flag blocks deselecting the character, not selecting something else.
        selectQuad(10, 10, floorQuadIndexOf(10, 10));

        expect(ObjectSelection.isSelected()).toBe(false);
        expect(VoxelQuadSelection.isSelected()).toBe(true);
    });
});

/** Somebody's character, with its body and speech bubble reduced to whether each is hidden. */
function makeCharacterOf(sourceUserID: string): {character: PlayerGameObject, shown: {body: boolean, bubble: boolean}}
{
    const shown = {body: true, bubble: true};
    const character = Object.assign(Object.create(PlayerGameObject.prototype), {
        params: { objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Player"),
            sourceUserID,
            transform: unitTransform(10.5, 0.5 * PLAYER_HEIGHT, 10.5),
            metadata: {} },
        obj: new THREE.Object3D(),
        components: {},
        instancedMeshComposer: { setHidden: (hidden: boolean) => { shown.body = !hidden; } },
        speechBubble: { setHidden: (hidden: boolean) => { shown.bubble = !hidden; } },
    }) as PlayerGameObject;
    character.obj.position.set(10.5, 0.5 * PLAYER_HEIGHT, 10.5);
    return {character, shown};
}

/** Sets the character's ghost mode as a metadata change from the server would. */
function setGhostMode(character: PlayerGameObject, ghostMode: boolean): void
{
    const value = AdminPrefsUtil.encode({ghostMode});
    character.params.metadata[ObjectMetadataKeyEnumMap.AdminPrefs] = new EncodableByteString(value);
    character.onSetMetadata(ObjectMetadataKeyEnumMap.AdminPrefs, value);
}

describe("the user's own character", () => {
    function makeOwnCharacter(): {character: PlayerGameObject, shown: {body: boolean, bubble: boolean}}
    {
        return makeCharacterOf(App.getUser().id);
    }

    beforeEach(() => {
        myPlayerHiddenObservable.set(false);

        // Orbiting from well clear of the body, where it would ordinarily be shown.
        const camera = GraphicsManager.getCamera();
        camera.removeFromParent();
        camera.position.set(10.5, 4, 16.5);
        camera.updateMatrixWorld();
        cameraModeObservable.set({type: "orbit", target: {center: {x: 10.5, y: 1.25, z: 10.5},
            halfSize: {x: 0.5, y: 0.5, z: 0.5}}});
    });

    afterEach(() => {
        myPlayerHiddenObservable.set(false);
    });

    it("stays hidden, speech bubble and all, while a step hides it, and shows again once the step lets go", () => {
        const {character, shown} = makeOwnCharacter();
        character.update(0);
        expect(shown).toEqual({body: true, bubble: true});

        SinglePlayerActionMap["set_my_player_hidden"]({type: "set_my_player_hidden", hidden: true});
        character.update(0);
        expect(shown).toEqual({body: false, bubble: false});

        // Even as the thing edit mode orbits.
        ObjectSelection.trySelect(character, true);
        character.update(0);
        expect(shown).toEqual({body: false, bubble: false});

        SinglePlayerActionMap["set_my_player_hidden"]({type: "set_my_player_hidden", hidden: false});
        character.update(0);
        expect(shown).toEqual({body: true, bubble: true});
    });

    it("stays hidden, speech bubble and all, while in ghost mode, and shows again once it leaves", () => {
        const {character, shown} = makeOwnCharacter();
        setGhostMode(character, true);
        character.update(0);
        expect(shown).toEqual({body: false, bubble: false});

        setGhostMode(character, false);
        character.update(0);
        expect(shown).toEqual({body: true, bubble: true});
    });
});

describe("another player's character", () => {
    it("is hidden, speech bubble and all, while in ghost mode, and shown again once it leaves", () => {
        const {character, shown} = makeCharacterOf("someone-else");
        setGhostMode(character, true);
        expect(shown).toEqual({body: false, bubble: false});

        setGhostMode(character, false);
        expect(shown).toEqual({body: true, bubble: true});
    });

    it("stays hidden in ghost mode as it comes close to the camera and moves away", () => {
        const {character, shown} = makeCharacterOf("someone-else");
        setGhostMode(character, true);

        character.onPlayerProximityStart();
        expect(shown).toEqual({body: false, bubble: false});
        character.onPlayerProximityEnd();
        expect(shown).toEqual({body: false, bubble: false});
    });

    it("leaving ghost mode while too close to the camera shows only its speech bubble until it moves away", () => {
        const {character, shown} = makeCharacterOf("someone-else");
        setGhostMode(character, true);
        character.onPlayerProximityStart();

        setGhostMode(character, false);
        expect(shown).toEqual({body: false, bubble: true});

        character.onPlayerProximityEnd();
        expect(shown).toEqual({body: true, bubble: true});
    });
});
