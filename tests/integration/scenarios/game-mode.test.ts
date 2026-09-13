/**
 * Scenario tests: play vs. edit mode (see @docs/gameplay/game_mode.md). Play mode picks nothing and keeps
 * the eye camera; edit mode starts on the user's character, and a selection orbits the camera.
 * Browser-bound client modules are stubbed; generation, selection and framing run for real.
 */
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";

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
        // Entering the mode uses the same call, which must report the character selected either way.
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
