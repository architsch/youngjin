/**
 * Scenario tests: play mode vs. edit mode
 *
 * Clicking something in the room means two different things depending on which of the two modes the
 * user is in. In play mode it is a way of looking at what was clicked and nothing more: the camera
 * stays at the player's eye. Edit mode is entered deliberately, begins on the user's own character,
 * and is the only mode in which a selection takes the camera into an orbit around it. These tests
 * walk the ways into and out of that mode, and the rules that only hold inside it.
 *
 * The logic under test is client-side, so the client modules that need a browser are stubbed out
 * and everything else — room generation, the selection modules, the framing rules — runs for real.
 */
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    const scene = new THREE.Scene();
    return { default: { getCamera: () => camera, getScene: () => scene } };
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

// Only what a click on a block asks of it, on its way to the permission check under test.
vi.mock("../../../src/client/object/clientObjectManager", () => ({
    default: { getMyPlayer: vi.fn(), getObjectById: vi.fn() },
}));

import * as THREE from "three";
import App from "../../../src/client/app";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import GameObject from "../../../src/client/object/types/gameObject";
import VoxelGameObject from "../../../src/client/object/types/voxelGameObject";
import ObjectSelection from "../../../src/client/graphics/types/gizmo/objectSelection";
import PlayerSelection from "../../../src/client/graphics/types/gizmo/playerSelection";
import VoxelQuadSelection from "../../../src/client/graphics/types/gizmo/voxelQuadSelection";
import WorldSpaceSelectionUtil from "../../../src/client/graphics/util/worldSpaceSelectionUtil";
import GameModeUtil from "../../../src/client/system/util/gameModeUtil";
import { cameraModeObservable, clientFeatureFlagsObservable, gameModeObservable,
    notificationMessageObservable, objectSelectionObservable, orbitCameraTargetOverrideObservable,
    playerSelectionObservable, userRoleObservable,
    voxelQuadSelectionObservable } from "../../../src/client/system/clientObservables";
import { FeatureFlag } from "../../../src/shared/system/types/featureFlag";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { UserRoleEnumMap } from "../../../src/shared/user/types/userRole";
import { PLAYER_HEIGHT } from "../../../src/shared/system/sharedConstants";
import Room from "../../../src/shared/room/types/room";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { createRoom, floorQuadIndexOf, voxelAt } from "../helpers/selectionHarness";

const ROOM_ID = "game-mode-room";

let room: Room;

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
 * leads to. Whether the user may edit this room at all is asked here, at the point of contact, so
 * these are the only tests that have to go the whole way round.
 */
function clickVoxel(row: number, col: number, quadIndex: number): void
{
    const voxel = voxelAt(room, row, col);
    VoxelGameObject.prototype.onClick.call(
        { getVoxel: () => voxel } as unknown as VoxelGameObject,
        quadIndex, new THREE.Vector3(col + 0.5, 0, row + 0.5));
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    for (const flag of [FeatureFlag.DisableAllSelectionChange, FeatureFlag.DisableVoxelQuadSelectionChange,
        FeatureFlag.DisableObjectSelectionChange, FeatureFlag.DisablePlayerSelectionChange,
        FeatureFlag.DisableGameModeTransition])
    {
        clientFeatureFlagsObservable.tryRemove(flag);
    }
    voxelQuadSelectionObservable.set(null);
    objectSelectionObservable.set(null);
    playerSelectionObservable.set(null);
    gameModeObservable.set("play");
    cameraModeObservable.set({type: "firstPerson"});
    orbitCameraTargetOverrideObservable.set(null);
    notificationMessageObservable.set(null);

    userRoleObservable.set(UserRoleEnumMap.Owner);
    room = createRoom(ROOM_ID);
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
});

describe("play mode", () => {
    it("leaves the camera alone when the user selects a block", () => {
        expect(selectQuad(10, 10, floorQuadIndexOf(10, 10))).toBe(true);

        expect(VoxelQuadSelection.isSelected()).toBe(true);
        expect(GameModeUtil.isInEditMode()).toBe(false);
        expect(cameraModeObservable.peek().type).toBe("firstPerson");
    });

    it("drops the selection when the user clicks the same block again", () => {
        const quadIndex = floorQuadIndexOf(10, 10);
        selectQuad(10, 10, quadIndex);
        selectQuad(10, 10, quadIndex);

        expect(VoxelQuadSelection.isSelected()).toBe(false);
    });
});

describe("entering edit mode", () => {
    it("selects the user's own character and orbits it", () => {
        GameModeUtil.enterEditMode(makeCharacter());

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(PlayerSelection.isSelected()).toBe(true);

        const mode = cameraModeObservable.peek();
        expect(mode.type).toBe("orbit");
        // Framed on the character itself, so its own size decides how far back the camera sits.
        expect(mode.type == "orbit" && mode.minDistance).toBeUndefined();
        expect(mode.type == "orbit" && mode.target.center.y).toBe(0.5 * PLAYER_HEIGHT);
    });

    it("opens for a user who may not edit the room, on his own character", () => {
        // The character is the user's own wherever he is standing, so the mode he changes it in is
        // open to him in a room that is not his. (What that room is *made* of is another matter:
        // the click that would pick a block out of it is what gets turned away — see below.)
        // A hub is everyone's to build in, so this has to be a room with an owner behind it.
        room = createRoom(`${ROOM_ID}-regular`, RoomTypeEnumMap.Regular);
        (App.getCurrentRoom as Mock).mockReturnValue(room);
        userRoleObservable.set(UserRoleEnumMap.Visitor);

        GameModeUtil.enterEditMode(makeCharacter());

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(PlayerSelection.isSelected()).toBe(true);
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });

    it("turns away that user's click on the room itself, and says why", () => {
        room = createRoom(`${ROOM_ID}-regular-click`, RoomTypeEnumMap.Regular);
        (App.getCurrentRoom as Mock).mockReturnValue(room);
        (ClientObjectManager.getMyPlayer as Mock).mockReturnValue(makeCharacter());
        userRoleObservable.set(UserRoleEnumMap.Visitor);
        GameModeUtil.enterEditMode(makeCharacter());
        notificationMessageObservable.set(null);

        clickVoxel(10, 10, floorQuadIndexOf(10, 10));

        expect(VoxelQuadSelection.isSelected()).toBe(false);
        expect(notificationMessageObservable.peek()).toContain("permission");
        // Turned away, not thrown out: what he came into the mode for is still his.
        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(PlayerSelection.isSelected()).toBe(true);
    });

    it("lets an editor's click on the room through", () => {
        room = createRoom(`${ROOM_ID}-regular-allowed`, RoomTypeEnumMap.Regular);
        (App.getCurrentRoom as Mock).mockReturnValue(room);
        (ClientObjectManager.getMyPlayer as Mock).mockReturnValue(makeCharacter());
        userRoleObservable.set(UserRoleEnumMap.Editor);
        GameModeUtil.enterEditMode(makeCharacter());
        notificationMessageObservable.set(null);

        clickVoxel(10, 10, floorQuadIndexOf(10, 10));

        expect(VoxelQuadSelection.isSelected()).toBe(true);
        expect(notificationMessageObservable.peek()).toBeNull();
    });

    it("carries the selection over to a block the user picks next", () => {
        GameModeUtil.enterEditMode(makeCharacter());
        expect(selectQuad(10, 10, floorQuadIndexOf(10, 10))).toBe(true);

        expect(PlayerSelection.isSelected()).toBe(false);
        expect(VoxelQuadSelection.isSelected()).toBe(true);
        expect(GameModeUtil.isInEditMode()).toBe(true);

        const mode = cameraModeObservable.peek();
        expect(mode.type).toBe("orbit");
        // A block is judged against what surrounds it, so the camera keeps its distance from it.
        expect(mode.type == "orbit" && mode.minDistance).toBeGreaterThan(0);
    });

    it("is left by a second click on the block being edited", () => {
        // Clicking what is already picked out is how it is let go of, and inside edit mode the mode
        // goes with it: the mode is that selection — the camera orbiting it, the player standing
        // still for it — so there is nothing for it to be kept up for once the selection is gone.
        GameModeUtil.enterEditMode(makeCharacter());
        const quadIndex = floorQuadIndexOf(10, 10);
        selectQuad(10, 10, quadIndex);
        selectQuad(10, 10, quadIndex);

        expect(VoxelQuadSelection.isSelected()).toBe(false);
        expect(GameModeUtil.isInEditMode()).toBe(false);
        expect(cameraModeObservable.peek().type).toBe("firstPerson");
    });

    it("is not left by a second click on the user's own character", () => {
        // The character is what the mode opens on, and opening it goes through the very same call,
        // which has to report the character picked out whether or not it already was.
        const character = makeCharacter();
        GameModeUtil.enterEditMode(character);
        PlayerSelection.trySelect(character);

        expect(PlayerSelection.isSelected()).toBe(true);
        expect(GameModeUtil.isInEditMode()).toBe(true);
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

    it("is left behind when the user's standing in the room is taken away", () => {
        // A room with an owner behind it, so that the user's role is what decides his editing.
        room = createRoom(`${ROOM_ID}-revoked`, RoomTypeEnumMap.Regular);
        (App.getCurrentRoom as Mock).mockReturnValue(room);
        userRoleObservable.set(UserRoleEnumMap.Editor);
        GameModeUtil.enterEditMode(makeCharacter());
        selectQuad(10, 10, floorQuadIndexOf(10, 10));

        // What the server sends down when the owner takes an editor's rights back.
        userRoleObservable.set(UserRoleEnumMap.Visitor);

        // What he had picked out of the room is no longer his to work on, and the mode goes with it
        // rather than being left standing empty: it holds the camera in an orbit and the player
        // still, while the way out of it is only offered alongside a selection.
        expect(WorldSpaceSelectionUtil.isAnythingSelected()).toBe(false);
        expect(GameModeUtil.isInEditMode()).toBe(false);
        expect(cameraModeObservable.peek().type).toBe("firstPerson");
    });

    it("is left behind even while a scripted step is holding that selection in place", () => {
        // A step's hold is on the user giving a selection up, not on it being taken from him.
        room = createRoom(`${ROOM_ID}-revoked-pinned`, RoomTypeEnumMap.Regular);
        (App.getCurrentRoom as Mock).mockReturnValue(room);
        userRoleObservable.set(UserRoleEnumMap.Editor);
        GameModeUtil.enterEditMode(makeCharacter());
        selectQuad(10, 10, floorQuadIndexOf(10, 10));
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableAllSelectionChange);

        userRoleObservable.set(UserRoleEnumMap.Visitor);

        expect(WorldSpaceSelectionUtil.isAnythingSelected()).toBe(false);
        expect(GameModeUtil.isInEditMode()).toBe(false);
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
    // itself rather than on the button that offers it, so every way across has to answer to it —
    // the back gesture and a second click on what is being edited go through no button at all.
    it("keeps the way out shut", () => {
        GameModeUtil.enterEditMode(makeCharacter());
        selectQuad(10, 10, floorQuadIndexOf(10, 10));
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableGameModeTransition);

        GameModeUtil.exitEditMode(); // What the exit button and the back gesture both come down to.

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(VoxelQuadSelection.isSelected()).toBe(true);
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });

    it("keeps the way in shut", () => {
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableGameModeTransition);

        GameModeUtil.enterEditMode(makeCharacter());

        expect(GameModeUtil.isInEditMode()).toBe(false);
        expect(PlayerSelection.isSelected()).toBe(false);
        expect(cameraModeObservable.peek().type).toBe("firstPerson");
    });

    it("turns away a second click on the block being edited, selection and all", () => {
        // The click is a way out of the mode, and the two cannot be told apart: dropping the
        // selection alone would leave the user in a mode with nothing under it. So the whole gesture
        // is refused and the block stays picked out.
        GameModeUtil.enterEditMode(makeCharacter());
        const quadIndex = floorQuadIndexOf(10, 10);
        selectQuad(10, 10, quadIndex);
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableGameModeTransition);

        selectQuad(10, 10, quadIndex);

        expect(GameModeUtil.isInEditMode()).toBe(true);
        expect(VoxelQuadSelection.isSelected()).toBe(true);
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
        expect(PlayerSelection.isSelected()).toBe(true);
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
        expect(PlayerSelection.isSelected()).toBe(false);

        PlayerSelection.trySelect(character);
        expect(VoxelQuadSelection.isSelected()).toBe(false);
        expect(ObjectSelection.isSelected()).toBe(false);
        expect(PlayerSelection.isSelected()).toBe(true);
    });

    it("replaces the character even while a step holds the character's own selection down", () => {
        GameModeUtil.enterEditMode(makeCharacter());
        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisablePlayerSelectionChange);

        // The flag stops the user from *dropping* the character, not from picking something else:
        // what replaces a selection is not the user giving that selection up.
        selectQuad(10, 10, floorQuadIndexOf(10, 10));

        expect(PlayerSelection.isSelected()).toBe(false);
        expect(VoxelQuadSelection.isSelected()).toBe(true);
    });
});
