/**
 * Scenario tests: play vs. edit mode (see @docs/gameplay/game_mode.md). Play mode picks nothing and keeps
 * the eye camera; edit mode starts on what the camera faces (else on the user's character), and a
 * selection orbits the camera. Browser-bound client modules and the view's raycast are stubbed;
 * generation, selection and framing run for real.
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
        setViewDistance: () => {}, setPointLightSurroundings: () => {},
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
import { cameraModeObservable, clientFeatureFlagsObservable, gameModeObservable,
    notificationMessageObservable, objectSelectionObservable, orbitCameraTargetOverrideObservable,
    voxelQuadSelectionObservable } from "../../../src/client/system/clientObservables";
import { FeatureFlag } from "../../../src/shared/system/types/featureFlag";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MIN, NUM_VOXEL_COLS,
    NUM_VOXEL_ROWS } from "../../../src/shared/system/sharedConstants";
import Room from "../../../src/shared/room/types/room";
import User from "../../../src/shared/user/types/user";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { createRoom, floorQuadIndexOf, isQuadVisible, quadIndexOf, voxelAt } from "../helpers/selectionHarness";
import { createMockUser } from "../helpers/mockUser";
import VoxelQuadInstanceUtil from "../../../src/client/voxel/util/voxelQuadInstanceUtil";

const ROOM_ID = "game-mode-room";

let room: Room;

/** Somebody who owns the named room and nothing else — "" for somebody who owns nothing at all. */
function userOwning(ownedRoomID: string): User
{
    const {user} = createMockUser();
    user.ownedRoomID = ownedRoomID;
    return user;
}

/** A stand-in for the user's own character: only what the framing rules actually read of it. */
function makeCharacter(): GameObject
{
    return {
        params: { objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Player") },
        position: new THREE.Vector3(10.5, 0.5 * PLAYER_HEIGHT, 10.5),
        direction: new THREE.Vector3(0, 0, 1),
    } as unknown as GameObject;
}

/** A picture hanging on a wall, which anyone may select. */
function makePicture(): GameObject
{
    const picture = {
        params: { objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Canvas") },
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
        params: { objectTypeIndex: ObjectTypeConfigMap.getIndexByType("Player") },
        trySelect: (): boolean => false,
    } as unknown as GameObject;
}

/** An object as a line of sight meets it. */
function hitOn(gameObject: GameObject): ObjectHit
{
    return {gameObject, instanceId: -1};
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

        GameModeUtil.enterEditMode(makeCharacter(), [hitOnVoxelQuad(10, 10, quadIndex)]);

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(quadIndex);
        expect(ObjectSelection.isSelected()).toBe(false);

        const mode = cameraModeObservable.peek();
        expect(mode.type == "orbit" && [mode.target.center.x, mode.target.center.z]).toEqual([10.5, 10.5]);
    });

    it("selects the object the camera faces", () => {
        const picture = makePicture();

        GameModeUtil.enterEditMode(makeCharacter(), [hitOn(picture)]);

        expect(objectSelectionObservable.peek()?.gameObject).toBe(picture);
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });

    it("looks past objects the user may not select, to what stands behind them", () => {
        const quadIndex = floorQuadIndexOf(10, 10);

        GameModeUtil.enterEditMode(makeCharacter(),
            [hitOn(makeOtherPlayer()), hitOnVoxelQuad(10, 10, quadIndex)]);

        expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(quadIndex);
    });

    it("never looks through a room surface, even one it may not select", () => {
        // What stands behind a wall is out of sight, so a refused quad ends the search.
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableVoxelQuadSelectionChange);
        const character = makeCharacter();

        GameModeUtil.enterEditMode(character,
            [hitOnVoxelQuad(10, 10, floorQuadIndexOf(10, 10)), hitOn(makePicture())]);

        expect(objectSelectionObservable.peek()?.gameObject).toBe(character);
    });

    it("falls back on the user's own character when nothing in view can be selected, and orbits it", () => {
        const character = makeCharacter();

        GameModeUtil.enterEditMode(character, [hitOn(makeOtherPlayer())]);

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

    /**
     * Opens edit mode on the boundary wall's face in front of a user standing at (x, z), letting the real
     * camera settle before and after. Returns where the camera was, and where the orbit put it.
     */
    function openEditModeFacingWall(x: number, z: number, wallCol: number):
        {before: THREE.Vector3, after: THREE.Vector3}
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

            GameModeUtil.enterEditMode(makeCharacter(), [hitOnVoxelQuad(WALL_ROW, wallCol, quadIndex)]);
            expect(voxelQuadSelectionObservable.peek()?.quadIndex).toBe(quadIndex);

            playerCamera.update(1, controller);
            return {before, after: GraphicsManager.getCamera().getWorldPosition(new THREE.Vector3())};
        }
        finally
        {
            playerCamera.onDespawn(controller);
            player.remove(GraphicsManager.getCamera());
        }
    }

    it("keeps the camera where it was when the wall faced is across the room", () => {
        const {before, after} = openEditModeFacingWall(NUM_VOXEL_COLS - 1.5, NUM_VOXEL_ROWS - 1.5, 1);

        expect(before.distanceTo(new THREE.Vector3(1.5, before.y, WALL_FACE_Z))).toBeGreaterThan(NUM_VOXEL_ROWS);
        expect(after.distanceTo(before)).toBeLessThan(1e-6);
    });

    it("keeps the camera where it was when the user stands right up against the wall", () => {
        const {before, after} = openEditModeFacingWall(10.5, WALL_FACE_Z + PLAYER_RADIUS_XZ, 10);

        expect(after.distanceTo(before)).toBeLessThan(1e-6);
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
