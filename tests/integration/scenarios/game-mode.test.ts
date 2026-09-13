/**
 * Scenario tests: play mode vs. edit mode
 *
 * Nothing in the room is picked out in play mode: a click on it is a click on the room, and the camera
 * stays at the player's eye. Edit mode is entered deliberately, begins on the user's own character,
 * and is where things are picked out — and where a selection takes the camera into an orbit around
 * it. These tests walk the ways into and out of that mode, and the rules that hold inside it.
 *
 * The logic under test is client-side, so the client modules that need a browser are stubbed out
 * and everything else — room generation, the selection modules, the framing rules — runs for real.
 */
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    const scene = new THREE.Scene();
    // A voxel edit invalidates the room's light map (see LightBlockMap). Nothing here draws
    // anything, so the map only has to exist and take the message.
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

// Imported by the modules under test, none of which asks anything of it here that needs a game
// running behind it.
vi.mock("../../../src/client/object/clientObjectManager", () => ({
    default: { getMyPlayer: vi.fn(), getObjectById: vi.fn() },
}));

import * as THREE from "three";
import App from "../../../src/client/app";
import GameObject from "../../../src/client/object/types/gameObject";
import VoxelGameObject from "../../../src/client/object/types/voxelGameObject";
import ObjectSelection from "../../../src/client/graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../../src/client/graphics/types/gizmo/voxelQuadSelection";
import WorldSpaceSelectionUtil from "../../../src/client/graphics/util/worldSpaceSelectionUtil";
import GameModeUtil from "../../../src/client/system/util/gameModeUtil";
import { cameraModeObservable, clientFeatureFlagsObservable, gameModeObservable,
    notificationMessageObservable, objectSelectionObservable, orbitCameraTargetOverrideObservable,
    voxelQuadSelectionObservable } from "../../../src/client/system/clientObservables";
import { FeatureFlag } from "../../../src/shared/system/types/featureFlag";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { COLLISION_LAYER_MIN } from "../../../src/shared/system/sharedConstants";
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

/** Selects a quad the way a click on it does, i.e. through the rules under test. */
function selectQuad(row: number, col: number, quadIndex: number): boolean
{
    return VoxelQuadSelection.trySelect(voxelAt(room, row, col), quadIndex);
}

/**
 * A click that actually lands on the block in the room, rather than the selection it ordinarily
 * leads to. Everything a click has to be before it picks anything out is asked on the way, which is
 * what the tests of play mode, and of whose room it is, turn on.
 */
function clickVoxel(row: number, col: number, quadIndex: number): void
{
    const voxel = voxelAt(room, row, col);
    // A click arrives naming the mesh instance it landed on, and the room lends its instances to
    // whichever quads are on show (see VoxelQuadInstanceUtil) — so a quad has to be holding one
    // before there is anything there to click.
    const instanceId = 0;
    VoxelQuadInstanceUtil.bind(quadIndex, instanceId);
    try
    {
        // The voxel's own class, standing on the voxel under test rather than on a spawned object,
        // so that the click is asked exactly what a real one is.
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

describe("play mode", () => {
    it("picks nothing out when the user clicks a block", () => {
        clickVoxel(10, 10, floorQuadIndexOf(10, 10));

        expect(WorldSpaceSelectionUtil.isAnythingSelected()).toBe(false);
        expect(GameModeUtil.isInEditMode()).toBe(false);
        expect(cameraModeObservable.peek().type).toBe("firstPerson");
    });

    it("refuses a selection asked for by code", () => {
        // What an edit re-picks once its answer has arrived, which can be after the mode was left.
        // The click is turned away before it gets this far; this is the rest of the line.
        expect(selectQuad(10, 10, floorQuadIndexOf(10, 10))).toBe(false);
        expect(ObjectSelection.trySelect(makeCharacter())).toBe(false);

        expect(WorldSpaceSelectionUtil.isAnythingSelected()).toBe(false);
    });
});

describe("entering edit mode", () => {
    it("selects the user's own character and orbits it", () => {
        GameModeUtil.enterEditMode(makeCharacter());

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(ObjectSelection.isSelected()).toBe(true);

        const mode = cameraModeObservable.peek();
        expect(mode.type).toBe("orbit");
        // Framed on the character itself, so its own size decides how far back the camera sits.
        expect(mode.type == "orbit" && mode.minDistance).toBe(0);
        expect(mode.type == "orbit" && mode.target.center.y).toBe(0.5 * PLAYER_HEIGHT);
    });

    it("opens in somebody else's room too, on the user's own character", () => {
        // The character is the user's own wherever he is standing, so the mode he changes it in is
        // open to him in a room that is not his. A hub is nobody's, so this has to be a room with an
        // owner behind it.
        room = createRoom(`${ROOM_ID}-regular`, RoomTypeEnumMap.Regular);
        (App.getCurrentRoom as Mock).mockReturnValue(room);
        (App.getUser as Mock).mockReturnValue(userOwning(""));

        GameModeUtil.enterEditMode(makeCharacter());

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(ObjectSelection.isSelected()).toBe(true);
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });

    it("lets his click on a block in somebody else's room through", () => {
        // Owning a room is no condition for picking out its blocks. What its owner keeps to himself
        // is drawn as restricted zones, and a zone turns down the tools a selection opens rather
        // than the click that made it.
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
        // The mode is left by saying so — the switch, or the back gesture — and not by a click on
        // the very thing being edited, which leaves that thing exactly where it is.
        GameModeUtil.enterEditMode(makeCharacter());
        const quadIndex = floorQuadIndexOf(10, 10);
        selectQuad(10, 10, quadIndex);
        selectQuad(10, 10, quadIndex);

        expect(VoxelQuadSelection.isSelected()).toBe(true);
        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });

    it("is not left by a second click on the user's own character", () => {
        // The character is what the mode opens on, and opening it goes through the very same call,
        // which has to report the character picked out whether or not it already was.
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
        // The step pinned that selection for the sake of what it was teaching *inside* the mode, and
        // the mode is what is being left: a selection left standing behind it would be one the user
        // could neither see nor let go of. (The step that means to keep him in the mode says so
        // outright — see below.)
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
    // What a tutorial step does while it teaches what is inside a mode. The hold is on the crossing
    // itself rather than on the switch that offers it, so every way across has to answer to it —
    // the back gesture goes through no control at all.
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
        // The step that teaches the way out opens it for itself, and the selection it had pinned
        // meanwhile is no obstacle to taking it.
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
    // A tutorial step may hold the camera on a place of its own for as long as it lasts, which is
    // how it shows the user something he has not picked out yet — and could not pick out without
    // first seeing it.
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

        // The flag stops the user from *dropping* the character, not from picking something else:
        // what replaces a selection is not the user giving that selection up.
        selectQuad(10, 10, floorQuadIndexOf(10, 10));

        expect(ObjectSelection.isSelected()).toBe(false);
        expect(VoxelQuadSelection.isSelected()).toBe(true);
    });
});
