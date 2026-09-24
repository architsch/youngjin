/**
 * Scenario tests: play vs. edit mode (see @docs/gameplay/game_mode.md). Play mode picks nothing and keeps
 * the eye camera; edit mode starts on a scripted step's pick, else on what the camera faces within reach
 * (straight ahead, then tilted toward the ground), else on the user's character, and a selection orbits
 * the camera. Browser-bound client modules are stubbed, and so is the view's raycast wherever edit mode
 * is entered; generation, selection, framing and the raycast itself run for real.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    const scene = new THREE.Scene();
    // Voxel edits invalidate the light map (see LightBlockMap); a stub suffices.
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {},
        getNearbyLightAt(_worldPos: unknown, out: any) { return out.setRGB(0, 0, 0); } };
    return { default: { getCamera: () => camera, getScene: () => scene,
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
import GameObject from "../../../src/client/object/types/gameObject";
import PlayerController from "../../../src/client/object/components/playerController";
import PlayerCamera from "../../../src/client/object/components/helpers/player/playerCamera";
import PlayerPointerInput from "../../../src/client/object/components/helpers/player/playerPointerInput";
import VoxelGameObject from "../../../src/client/object/types/voxelGameObject";
import ObjectSelection from "../../../src/client/graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../../src/client/graphics/types/gizmo/voxelQuadSelection";
import WorldSpaceSelectionUtil from "../../../src/client/graphics/util/worldSpaceSelectionUtil";
import ObjectHit from "../../../src/client/graphics/types/objectHit";
import GameModeUtil from "../../../src/client/system/util/gameModeUtil";
import CameraUtil from "../../../src/client/graphics/util/cameraUtil";
import MeshFactory from "../../../src/client/graphics/factories/meshFactory";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import SinglePlayerActionMap from "../../../src/client/singlePlayer/maps/singlePlayerActionMap";
import PlayerGameObject from "../../../src/client/object/types/playerGameObject";
import { cameraModeObservable, clientFeatureFlagsObservable, editModeOpeningOverrideObservable,
    gameModeObservable, myPlayerHiddenObservable, notificationMessageObservable, objectSelectionObservable,
    orbitCameraDistanceRangeRequestObservable, orbitCameraTargetOverrideObservable,
    voxelQuadSelectionObservable } from "../../../src/client/system/clientObservables";
import { EDIT_MODE_OPENING_REACH, EDIT_MODE_OPENING_TILT } from "../../../src/client/system/clientConstants";
import { FeatureFlag } from "../../../src/shared/system/types/featureFlag";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MIN,
    UNIT_VEC3, VOXEL_BLOCK_HITBOX_HALFSIZE } from "../../../src/shared/system/sharedConstants";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import Room from "../../../src/shared/room/types/room";
import User from "../../../src/shared/user/types/user";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { createRoom, floorQuadIndexOf, isQuadVisible, quadIndexOf, voxelAt } from "../helpers/selectionHarness";
import { createMockUser } from "../helpers/mockUser";
import VoxelQuadInstanceUtil from "../../../src/client/voxel/util/voxelQuadInstanceUtil";
import AdminPrefsUtil from "../../../src/shared/object/util/adminPrefsUtil";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";

const ROOM_ID = "game-mode-room";

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

/** A voxel quad as a line of sight meets it: the room's voxel, hit on the instance drawing that quad. */
function hitOnVoxelQuad(row: number, col: number, quadIndex: number): ObjectHit
{
    const voxel = voxelAt(room, row, col);
    const instanceId = boundInstances.length;
    VoxelQuadInstanceUtil.bind(quadIndex, instanceId);
    boundInstances.push({quadIndex, instanceId});

    // A real VoxelGameObject, so the quad is selected exactly as a real one selects it.
    const gameObject = Object.assign(Object.create(VoxelGameObject.prototype), {
        params: { objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Voxel") },
        getVoxel: () => voxel,
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
    const voxel = voxelAt(room, row, col);
    // A click names a mesh instance, so the quad must hold one (see VoxelQuadInstanceUtil).
    const instanceId = 0;
    VoxelQuadInstanceUtil.bind(quadIndex, instanceId);
    try
    {
        // A real VoxelGameObject, so the click is handled exactly as a real one.
        const clicked = Object.assign(Object.create(VoxelGameObject.prototype),
            { getVoxel: () => voxel }) as VoxelGameObject;
        clicked.onClick(instanceId, new THREE.Vector3(col + 0.5, 0, row + 0.5));
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

describe("entering edit mode", () => {
    it("selects the voxel quad the camera faces and orbits it", () => {
        const quadIndex = floorQuadIndexOf(10, 10);

        GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOnVoxelQuad(10, 10, quadIndex)));

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(quadIndex);
        expect(ObjectSelection.isSelected()).toBe(false);

        const mode = cameraModeObservable.peek();
        expect(mode.type == "orbit" && [mode.target.center.x, mode.target.center.z]).toEqual([10.5, 10.5]);
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
            lookingAt(hitOn(makeOtherPlayer()), hitOnVoxelQuad(10, 10, quadIndex)));

        expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(quadIndex);
    });

    it("never looks through a room surface, even one it may not select", () => {
        // What stands behind a wall is out of sight, so a refused quad ends the search.
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableVoxelQuadSelectionChange);
        const character = makeCharacter();

        GameModeUtil.enterEditMode(character,
            lookingAt(hitOnVoxelQuad(10, 10, floorQuadIndexOf(10, 10)), hitOn(makePicture())));

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
            return (pitchDownAngle == 0) ? [hitOn(makeOtherPlayer())] : [hitOnVoxelQuad(10, 10, quadIndex)];
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
        // The mode is left via the switch or back gesture, not by clicking the edited thing.
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
    // The boundary wall along row 0, whose inner face is the plane z = 1.
    const WALL_ROW = 0;
    const WALL_FACE_Z = WALL_ROW + 1;

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
            playerCamera.update(1, controller);
            const before = GraphicsManager.getCamera().getWorldPosition(new THREE.Vector3());

            const eyeLayer = COLLISION_LAYER_MIN + Math.floor(before.y / COLLISION_LAYER_HEIGHT);
            const quadIndex = quadIndexOf(WALL_ROW, wallCol, "z", "+", eyeLayer);
            expect(isQuadVisible(room, quadIndex), "the wall face in view is not drawn").toBe(true);

            GameModeUtil.enterEditMode(makeCharacter(), lookingAt(hitOnVoxelQuad(WALL_ROW, wallCol, quadIndex)));
            expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(quadIndex);

            playerCamera.update(1, controller);
            if (distanceRange != undefined)
            {
                orbitCameraDistanceRangeRequestObservable.set(distanceRange);
                playerCamera.update(1, controller);
            }

            const blockCenter = new THREE.Vector3(wallCol + 0.5,
                VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(eyeLayer), WALL_ROW + 0.5);
            const blockSize = new THREE.Vector3(VOXEL_BLOCK_HITBOX_HALFSIZE.x, VOXEL_BLOCK_HITBOX_HALFSIZE.y,
                VOXEL_BLOCK_HITBOX_HALFSIZE.z).multiplyScalar(2);
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
        const {before, after} = openEditModeFacingWall(10.5, WALL_FACE_Z + EDIT_MODE_OPENING_REACH, 10);

        expect(before.distanceTo(new THREE.Vector3(10.5, before.y, WALL_FACE_Z)))
            .toBeGreaterThanOrEqual(EDIT_MODE_OPENING_REACH);
        expect(after.distanceTo(before)).toBeLessThan(1e-6);
    });

    it("keeps the camera where it was when the user stands close to the wall", () => {
        const {before, after} = openEditModeFacingWall(10.5, WALL_FACE_Z + 1, 10);

        expect(after.distanceTo(before)).toBeLessThan(1e-6);
    });

    it("backs the camera off a wall the user stands against, as far as a step asks", () => {
        const {before, after, block} = openEditModeFacingWall(10.5, WALL_FACE_Z + PLAYER_RADIUS_XZ, 10,
            DISTANCE_RANGE);

        expect(distancesToBox(before, block).nearest).toBeLessThan(DISTANCE_RANGE.min);
        const {nearest, farthest} = distancesToBox(after, block);
        expect(nearest).toBeGreaterThanOrEqual(DISTANCE_RANGE.min);
        expect(farthest).toBeLessThanOrEqual(DISTANCE_RANGE.max);
    });

    it("brings the camera in on a wall as far off as edit mode looks, as far as a step asks", () => {
        const {before, after, block} = openEditModeFacingWall(10.5, WALL_FACE_Z + EDIT_MODE_OPENING_REACH, 10,
            DISTANCE_RANGE);

        expect(distancesToBox(before, block).farthest).toBeGreaterThan(DISTANCE_RANGE.max);
        const {nearest, farthest} = distancesToBox(after, block);
        expect(nearest).toBeGreaterThanOrEqual(DISTANCE_RANGE.min);
        expect(farthest).toBeLessThanOrEqual(DISTANCE_RANGE.max);
    });

    it("leaves a camera already within the range a step asks for where it was", () => {
        const {before, after} = openEditModeFacingWall(10.5, WALL_FACE_Z + 4, 10, DISTANCE_RANGE);

        expect(after.distanceTo(before)).toBeLessThan(1e-6);
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
});

describe("a scripted step choosing what edit mode opens on", () => {
    // A face of the boundary wall along row 0, as a step might pick it.
    const WALL_FACE_QUAD_INDEX = quadIndexOf(0, 10, "z", "+", COLLISION_LAYER_MIN + 2);

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
});

describe("a scripted step holding the user in his mode", () => {
    // The hold applies to the crossing itself, so every exit (including the back gesture) obeys it.
    it("keeps the way out shut", () => {
        GameModeUtil.enterEditMode(makeCharacter());
        selectQuad(10, 10, floorQuadIndexOf(10, 10));
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableGameModeTransition);

        GameModeUtil.exitEditMode(); // What the switch and the back gesture both come down to.

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
        expect(freedMode.type == "orbit" && freedMode.target.center.x).toBe(10.5);
        expect(freedMode.type == "orbit" && freedMode.target.center.z).toBe(10.5);
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
