/**
 * Which event sounds as what (see AudioTriggerUtil), with the audio itself stood in for: someone else's edits where they
 * are made (blocks, a face's texture, and the room's own objects as the same edit of a block, a change to one's settings as
 * a breath), the user's own alike from anywhere (a block's edit by its kind, an object added or placed as a click, none
 * for one that costs dollars, and nothing for one changed), never a player's, a bill's or a cannon ball's as an edit; an
 * attached object taken away as its coming apart, whoever took it (an NPC's going as any object's, a spent cannon's as
 * a puff); a cannon's shot and its ball's burst where they are, the burst alone of all its blast breaks; a cannon's own
 * gears while it turns to aim; others coming and going (not the user,
 * nor a ghost); dollars (the user's own as they reach the count, others' where they are collected, the day's reward as it
 * shows, a cash register as they are spent); a refusal; the UI (presses, popups and panels opening and closing, nothing
 * for no change, nor for the game mode itself); the selection (a face or an object picked out, another in its place,
 * letting go, never a refresh); the tutorial's marks (new ones shown, the last taken away); travel (a door shutting on
 * leaving, and one opening on every arrival, once the first has shut); the user's own line as it is sent; one action as
 * one sound (slight sounds wait out their moment and give way to more telling ones, and a telling sound is the only one of
 * its moment); and a sound that fails stopping none after it. And what tells of those events: the panels' count, a
 * refusal, and a press of a control (and none of what isn't one).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import * as THREE from "three";

const audio = vi.hoisted(() => ({fail: false,
    calls: [] as {method: string, clip: string, position?: {x: number, y: number, z: number}, options?: any,
        voice: {stops: number, positions: {x: number, y: number, z: number}[]}}[]}));
vi.mock("../../../src/client/audio/audioManager", () => {
    const record = (method: string, positioned: boolean) => (clip: string, ...rest: any[]) => {
        if (audio.fail)
            throw new Error("No sound today.");
        const voice = {stops: 0, positions: [] as {x: number, y: number, z: number}[], isEnded: () => false,
            stop() { ++this.stops; }, setPosition(position: {x: number, y: number, z: number}) { this.positions.push({...position}); }};
        audio.calls.push({method, clip, position: positioned ? {...rest[0]} : undefined,
            options: positioned ? rest[1] : rest[0], voice});
        return voice;
    };
    return {default: {play: record("play", false), playAt: record("playAt", true), playLoop: record("playLoop", false),
        playLoopAt: record("playLoopAt", true)}};
});
const me = vi.hoisted(() => ({userID: "me", playerObjectId: "my-player"}));
vi.mock("../../../src/client/app", () => ({default: {getUser: () => ({id: me.userID}),
    getCurrentRoom: () => ({id: "room"}), getWatchedUserID: () => ""}}));
vi.mock("../../../src/client/object/clientObjectManager", () => ({default: {
    getMyPlayer: () => ({params: {objectId: me.playerObjectId}}), setObjectTransform() {}}}));
vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    return {default: {getCamera: () => camera}};
});
vi.mock("../../../src/client/networking/client/socketsClient", () => ({default: {}}));
// The selection's own outlines, which would draw the stand-in selections below in a scene there isn't.
vi.mock("../../../src/client/graphics/types/gizmo/voxelQuadSelection", () => ({default: class {}}));
vi.mock("../../../src/client/graphics/types/gizmo/objectSelection", () => ({default: class {}}));

import AudioTriggerUtil, { ARRIVAL_SOUND_RANGE, CANNON_SOUND_RANGE, COLLECT_SOUND_RANGE, EDIT_SOUND_RANGE,
    OBJECT_SELECTION_RATE, PITCH_VARIATION, SOUND_MOMENT_MS } from "../../../src/client/audio/util/audioTriggerUtil";
import AudioBundleMap from "../../../src/client/audio/maps/audioBundleMap";
import ClosablePanelUtil from "../../../src/client/ui/util/closablePanelUtil";
import RefusalCoachMarkUtil from "../../../src/client/ui/util/refusalCoachMarkUtil";
import ControlPressUtil from "../../../src/client/ui/util/controlPressUtil";
import type VoxelQuadSelection from "../../../src/client/graphics/types/gizmo/voxelQuadSelection";
import type ObjectSelection from "../../../src/client/graphics/types/gizmo/objectSelection";
import FanGameObject, { ONE_BLADE_WIND_RATE, ONE_BLADE_WIND_VOLUME, WIND_HEARD_PAST_REACH, WIND_RATE_PER_BLADE,
    WIND_SOURCE_OFFSET, WIND_VOLUME_PER_BLADE } from "../../../src/client/object/types/gameObject/fanGameObject";
import FanObjectTypeConfig, { FAN_SETTINGS }
    from "../../../src/shared/object/types/objectTypeConfig/fanObjectTypeConfig";
import CannonGameObject, { TURN_SOUND_RANGE, TURN_SOUND_VOLUME }
    from "../../../src/client/object/types/gameObject/cannonGameObject";
import { CannonPhaseEnumMap } from "../../../src/shared/object/types/cannonPhase";
import CannonState from "../../../src/shared/object/types/cannonState";
import { CANNON_BALL_COUNT, CANNON_MAX_RANGE, CANNON_TURN_RATE }
    from "../../../src/shared/object/types/objectTypeConfig/cannonObjectTypeConfig";
import CannonAimUtil from "../../../src/shared/object/util/cannonAimUtil";
import CannonStateUtil from "../../../src/shared/object/util/cannonStateUtil";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import Geometry3DUtil from "../../../src/shared/math/util/geometry3DUtil";
import { cannonBallBurstObservable, cannonBlastObservable, cannonFiredObservable, chatLineSentObservable,
    clickRefusedObservable, controlPressedObservable, dollarsSpentObservable,
    gameModeObservable, headlineMessageObservable, inventoryGainObservable, loginRewardStageObservable,
    numOpenPanelsObservable, numOpenPopupsObservable, objectCollectedObservable, objectEditObservable,
    objectPlacedObservable, objectSelectionObservable, roomTravelObservable, screenArrowTargetObservable,
    screenDiagramObservable, voxelBlockEditObservable, voxelQuadSelectionObservable }
    from "../../../src/client/system/clientObservables";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { InventoryItemTypeEnumMap } from "../../../src/shared/inventory/types/inventoryItemType";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import AdminPrefsUtil from "../../../src/shared/object/util/adminPrefsUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { CANNON_PRICE_DOLLARS, COLLISION_LAYER_MIN, SIGNAL_BATCH_SEND_INTERVAL } from "../../../src/shared/system/sharedConstants";

const AT = {x: 3, y: 1, z: 5};

function makeObject(objectType: string, sourceUserID: string = "someone", metadata: {[key: number]: string} = {},
    objectId: string = `${objectType}-1`): AddObjectSignal
{
    const signal = new AddObjectSignal("room", sourceUserID, sourceUserID, ObjectTypeConfigMap.getIndexByType(objectType),
        objectId, new ObjectTransform({...AT}, {x: 0, y: 0, z: 1}, {x: 1, y: 1, z: 1}));
    for (const [key, value] of Object.entries(metadata))
        signal.metadata[Number(key)] = new EncodableByteString(value);
    return signal;
}

function expectVaried(rate: number): void
{
    expect(Math.abs(rate - 1)).toBeLessThanOrEqual(PITCH_VARIATION);
}

// The moment over: what waited in it is heard, and what it held quiet may sound again.
function settle(): void
{
    vi.advanceTimersByTime(SOUND_MOMENT_MS);
}

function clips(): string[]
{
    return audio.calls.map(call => call.clip);
}

function quad(quadIndex: number): VoxelQuadSelection
{
    return {quadIndex, voxel: {}} as unknown as VoxelQuadSelection;
}

function object(objectId: string): ObjectSelection
{
    return {gameObject: {params: {objectId}}} as unknown as ObjectSelection;
}

function arrow(targetElementId: string)
{
    return {targetElementId, arrowBias: "center" as const, arrowSide: "above" as const};
}

// One clock for the whole file, so that the moments of one test never reach into the next.
beforeAll(() => {
    vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout", "performance"]});
});

afterAll(() => {
    vi.useRealTimers();
});

beforeEach(() => {
    vi.advanceTimersByTime(10 * SOUND_MOMENT_MS);
    audio.calls.length = 0;
    audio.fail = false;
});

describe("which event sounds as what", () => {
    it("sounds someone else's edit of a block where the block is, and the user's own alike from anywhere", () => {
        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(10, 12, COLLISION_LAYER_MIN);
        const center = VoxelQueryUtil.getVoxelBlockBox(10, 12, COLLISION_LAYER_MIN).center;
        const sounds = {add: "edit/blockAdd", remove: "edit/blockRemove", move: "edit/blockMove",
            retexture: "edit/retexture"};
        for (const [kind, clip] of Object.entries(sounds))
        {
            for (const own of [false, true])
            {
                audio.calls.length = 0;
                voxelBlockEditObservable.set({kind: kind as keyof typeof sounds, quadIndex, own});
                expect(audio.calls).toMatchObject([own ? {method: "play", clip, position: undefined}
                    : {method: "playAt", clip, position: center, options: {range: EDIT_SOUND_RANGE}}]);
                expectVaried(audio.calls[0].options.rate);
                settle();
            }
        }
        // No two alike.
        audio.calls.length = 0;
        voxelBlockEditObservable.set({kind: "add", quadIndex, own: true});
        settle();
        voxelBlockEditObservable.set({kind: "add", quadIndex, own: true});
        expect(audio.calls[0].options.rate).not.toBe(audio.calls[1].options.rate);
    });

    it("sounds someone else's edit of one of the room's own objects where it is, as the same edit of a block would, " +
        "and a change to its settings as a breath", () => {
        // (What is taken away of those not attached to a face: an attached one comes apart, below.)
        for (const set of [
            () => objectEditObservable.set({kind: "add", object: makeObject("Prop"), own: false}),
            () => objectEditObservable.set({kind: "remove", object: makeObject("Volume"), own: false}),
            () => objectPlacedObservable.set({object: makeObject("Fan"), own: false}),
            () => objectEditObservable.set({kind: "change", object: makeObject("Canvas"), own: false})])
        {
            set();
            settle();
        }
        expect(audio.calls.map(call => [call.method, call.clip, call.position, call.options.range])).toEqual([
            ["playAt", "edit/blockAdd", AT, EDIT_SOUND_RANGE], ["playAt", "edit/blockRemove", AT, EDIT_SOUND_RANGE],
            ["playAt", "edit/blockMove", AT, EDIT_SOUND_RANGE], ["playAt", "edit/objectChange", AT, EDIT_SOUND_RANGE]]);
        audio.calls.forEach(call => expectVaried(call.options.rate));
    });

    it("clicks for the user's own object added or placed, sounds nothing of one changed, nor of one taken away that " +
        "hung on no face, and no player, bill or cannon ball as an edit", () => {
        objectEditObservable.set({kind: "add", object: makeObject("Prop"), own: true});
        settle();
        objectPlacedObservable.set({object: makeObject("Fan"), own: true});
        settle();
        objectEditObservable.set({kind: "remove", object: makeObject("Volume"), own: true});
        objectEditObservable.set({kind: "change", object: makeObject("Canvas"), own: true});
        settle();
        expect(audio.calls.map(call => [call.method, call.clip])).toEqual([["play", "ui/press"], ["play", "ui/press"]]);

        audio.calls.length = 0;
        for (const own of [false, true])
        {
            objectEditObservable.set({kind: "add", object: makeObject("DollarBill", ""), own});
            objectPlacedObservable.set({object: makeObject("DollarBill", ""), own});
            objectEditObservable.set({kind: "add", object: makeObject("CannonBall", ""), own});
            objectEditObservable.set({kind: "remove", object: makeObject("CannonBall", ""), own});
            objectPlacedObservable.set({object: makeObject("Player"), own});
            objectEditObservable.set({kind: "change", object: makeObject("Player"), own});
            settle();
        }
        expect(audio.calls).toEqual([]);
    });

    it("sounds an attached object taken away as its coming apart, whoever took it: someone else's from its middle, the " +
        "user's own from anywhere; but an NPC's going as any object's, and a spent cannon's as a puff", () => {
        const middleOf = (object: AddObjectSignal) =>
            PhysicsColliderStateUtil.getObjectColliderState(object.objectTypeIndex, object.transform)!.hitbox.center;
        const cannon = makeObject("Cannon");
        expect(middleOf(cannon), "a cannon's middle is in front of its face").not.toEqual(AT);

        for (const object of [makeObject("Lamp"), makeObject("Canvas"), makeObject("Door"), cannon])
        {
            audio.calls.length = 0;
            objectEditObservable.set({kind: "remove", object, own: false});
            settle();
            objectEditObservable.set({kind: "remove", object, own: true});
            settle();
            expect(audio.calls).toMatchObject([
                {method: "playAt", clip: "edit/objectDestroy", position: middleOf(object), options: {range: EDIT_SOUND_RANGE}},
                {method: "play", clip: "edit/objectDestroy", position: undefined}]);
            audio.calls.forEach(call => expectVaried(call.options.rate));
        }

        audio.calls.length = 0;
        objectEditObservable.set({kind: "remove", object: makeObject("Npc"), own: false});
        settle();
        objectEditObservable.set({kind: "remove", object: makeObject("Npc"), own: true});
        settle();
        expect(audio.calls.map(call => [call.method, call.clip])).toEqual([["playAt", "edit/blockRemove"]]);

        audio.calls.length = 0;
        const spent = makeObject("Cannon", "someone", {[ObjectMetadataKeyEnumMap.CannonState]: CannonStateUtil.encode(
            {...CannonStateUtil.decode(""), ballsLeft: 0})});
        objectEditObservable.set({kind: "remove", object: spent, own: false});
        expect(audio.calls).toMatchObject([{method: "playAt", clip: "cannon/puff", position: middleOf(spent),
            options: {range: EDIT_SOUND_RANGE}}]);
    });

    it("sounds a cannon's shot and its ball's burst where they are, far off too, whatever else the moment sounds", () => {
        const muzzle = {x: 7, y: 2, z: 9};
        cannonFiredObservable.set({position: muzzle, direction: {x: 1, y: 0, z: 0}});
        // In the moment of the user's own edit, which holds no burst back.
        voxelBlockEditObservable.set({kind: "add", quadIndex: 0, own: true});
        cannonBallBurstObservable.set({position: AT});
        expect(audio.calls).toMatchObject([
            {method: "playAt", clip: "cannon/fire", position: muzzle, options: {range: CANNON_SOUND_RANGE}},
            {method: "play", clip: "edit/blockAdd"},
            {method: "playAt", clip: "cannon/explosion", position: AT, options: {range: CANNON_SOUND_RANGE}}]);
        expect(CANNON_SOUND_RANGE).toBeGreaterThan(EDIT_SOUND_RANGE);
        expectVaried(audio.calls[0].options.rate);
        expectVaried(audio.calls[2].options.rate);
    });

    it("sounds no click for the user's own object added that costs dollars, which sounds as their spending does", () => {
        expect(ObjectTypeConfigMap.getConfigByIndex(ObjectTypeConfigMap.getIndexByType("Cannon")).price)
            .toBe(CANNON_PRICE_DOLLARS);
        objectEditObservable.set({kind: "add", object: makeObject("Cannon", me.userID), own: true});
        settle();
        expect(audio.calls).toEqual([]);
        // Someone else's is added as anything is.
        objectEditObservable.set({kind: "add", object: makeObject("Cannon"), own: false});
        expect(audio.calls).toMatchObject([{method: "playAt", clip: "edit/blockAdd"}]);
    });

    it("sounds others coming and going where they do, never the user, nor a ghost", () => {
        objectEditObservable.set({kind: "add", object: makeObject("Player"), own: false});
        objectEditObservable.set({kind: "remove", object: makeObject("Player"), own: false});
        expect(audio.calls.map(call => [call.clip, call.position, call.options.range])).toEqual([
            ["room/arrive", AT, ARRIVAL_SOUND_RANGE], ["room/leave", AT, ARRIVAL_SOUND_RANGE]]);

        audio.calls.length = 0;
        objectEditObservable.set({kind: "add", object: makeObject("Player", me.userID), own: false});
        objectEditObservable.set({kind: "add", object: makeObject("Player", "admin",
            {[ObjectMetadataKeyEnumMap.AdminPrefs]: AdminPrefsUtil.encode({ghostMode: true})}), own: false});
        settle();
        expect(audio.calls).toEqual([]);
    });

    it("sounds the user's dollars reaching their count, others' where they collect them, and the day's reward as it shows", () => {
        inventoryGainObservable.set("SomethingElse");
        inventoryGainObservable.set(InventoryItemTypeEnumMap.Dollar);
        objectCollectedObservable.set(makeObject("DollarBill", ""));
        loginRewardStageObservable.set("waiting");
        loginRewardStageObservable.set("shown");
        expect(audio.calls).toMatchObject([{method: "play", clip: "dollar/gain"},
            {method: "playAt", clip: "dollar/gain", position: AT, options: {range: COLLECT_SOUND_RANGE}},
            {method: "play", clip: "dollar/reward"}]);
    });

    it("sounds dollars spent as a cash register, and a click that came to nothing", () => {
        dollarsSpentObservable.set(5);
        settle();
        clickRefusedObservable.set("someButton");
        expect(audio.calls).toMatchObject([{method: "play", clip: "dollar/spend"}, {method: "play", clip: "ui/refusal"}]);
    });

    it("sounds the UI: a press, popups and panels coming and going, but nothing unchanged, nor the game mode itself", () => {
        controlPressedObservable.set("someButton");
        expect(audio.calls).toEqual([]);
        settle();
        expect(audio.calls).toMatchObject([{method: "play", clip: "ui/press"}]);
        expectVaried(audio.calls[0].options.rate);

        audio.calls.length = 0;
        const popups = numOpenPopupsObservable.peek();
        const panels = numOpenPanelsObservable.peek();
        for (const set of [() => numOpenPopupsObservable.set(popups + 1), () => numOpenPopupsObservable.set(popups + 1),
            () => numOpenPopupsObservable.set(popups), () => numOpenPanelsObservable.set(panels + 2),
            () => numOpenPanelsObservable.set(panels), () => gameModeObservable.set("edit"),
            () => gameModeObservable.set("play")])
        {
            set();
            settle();
        }
        expect(clips()).toEqual(["ui/popupOpen", "ui/popupClose", "ui/panelOpen", "ui/panelClose"]);
        expect(audio.calls.every(call => call.method == "play")).toBe(true);
    });

    it("sounds a block's face or an object picked out, another in its place, and letting go, never a refresh", () => {
        voxelQuadSelectionObservable.set(quad(40));
        settle();
        voxelQuadSelectionObservable.notify();
        voxelQuadSelectionObservable.set(quad(40));
        settle();
        voxelQuadSelectionObservable.set(quad(41));
        settle();
        // An object in the face's place, the one let go of as the other is picked: one sound, the object's.
        voxelQuadSelectionObservable.set(null);
        objectSelectionObservable.set(object("lamp-1"));
        settle();
        objectSelectionObservable.set(object("fan-2"));
        settle();
        objectSelectionObservable.set(null);
        settle();
        expect(audio.calls.map(call => [call.clip, call.options.rate])).toEqual([["edit/select", 1], ["edit/select", 1],
            ["edit/select", OBJECT_SELECTION_RATE], ["edit/select", OBJECT_SELECTION_RATE], ["edit/deselect", 1]]);
        expect(audio.calls.every(call => call.method == "play")).toBe(true);
    });

    it("sounds the tutorial's new marks as they show, and the last of them as it goes, once whatever shows at once", () => {
        // A step pointing with words and an arrow at once.
        headlineMessageObservable.set("Add a block.");
        screenArrowTargetObservable.set(arrow("addVoxelBlockButton"));
        settle();
        // The same words again.
        headlineMessageObservable.set("Add a block.");
        settle();
        expect(clips()).toEqual(["tutorial/show"]);

        audio.calls.length = 0;
        // Done: every mark taken away, then again with nothing left to take.
        headlineMessageObservable.set(null);
        screenArrowTargetObservable.set(null);
        settle();
        headlineMessageObservable.set(null);
        screenDiagramObservable.set(null);
        settle();
        expect(clips()).toEqual(["tutorial/clear"]);

        audio.calls.length = 0;
        // One step ending as the next begins.
        headlineMessageObservable.set("Remove the block.");
        settle();
        audio.calls.length = 0;
        headlineMessageObservable.set(null);
        headlineMessageObservable.set("Switch back to Play mode.");
        settle();
        expect(clips()).toEqual(["tutorial/show"]);
        headlineMessageObservable.set(null);
    });

    it("sounds a door shutting as the user leaves a room, and one opening on every arrival, once the first has shut", () => {
        const shutMs = 1000 * AudioBundleMap.clips["room/leave"].duration;
        roomTravelObservable.set({kind: "leave", roomID: "hub"});
        roomTravelObservable.set({kind: "arrive", roomID: "garden"});
        vi.advanceTimersByTime(shutMs - 1);
        expect(clips()).toEqual(["room/leave"]);
        vi.advanceTimersByTime(1);
        expect(clips()).toEqual(["room/leave", "room/arrive"]);

        // Back into the same room, as a connection taken up again comes, with no door to wait for.
        audio.calls.length = 0;
        settle();
        roomTravelObservable.set({kind: "arrive", roomID: "garden"});
        expect(clips()).toEqual(["room/arrive"]);

        // Off again before the arrival is heard: only the last is, after the last door.
        audio.calls.length = 0;
        settle();
        roomTravelObservable.set({kind: "leave", roomID: "garden"});
        roomTravelObservable.set({kind: "arrive", roomID: "hub"});
        vi.advanceTimersByTime(shutMs / 2);
        roomTravelObservable.set({kind: "leave", roomID: "hub"});
        roomTravelObservable.set({kind: "arrive", roomID: "garden"});
        vi.advanceTimersByTime(shutMs - 1);
        expect(clips()).toEqual(["room/leave", "room/leave"]);
        vi.advanceTimersByTime(1);
        expect(clips()).toEqual(["room/leave", "room/leave", "room/arrive"]);
        expect(audio.calls.every(call => call.method == "play")).toBe(true);
    });

    it("sounds the user's own line as it is sent", () => {
        chatLineSentObservable.set("hi");
        expect(audio.calls).toMatchObject([{method: "play", clip: "chat/send"}]);
    });

    it("lets a sound that fails stop none of the listeners after it, nor the timer it waited for", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        audio.fail = true;
        const after = vi.fn();
        dollarsSpentObservable.addListener("after", after);
        dollarsSpentObservable.set(5);
        expect(after).toHaveBeenCalled();
        expect(error).toHaveBeenCalledWith("AudioTriggerUtil :: Failed to play a sound", expect.any(Error));
        dollarsSpentObservable.removeListener("after");

        error.mockClear();
        settle();
        controlPressedObservable.set("someButton");
        expect(() => settle()).not.toThrow();
        expect(error).toHaveBeenCalledWith("AudioTriggerUtil :: Failed to play a sound", expect.any(Error));
        error.mockRestore();
        expect(AudioTriggerUtil).toBeDefined();
    });
});

describe("one action, one sound", () => {
    afterEach(() => {
        voxelQuadSelectionObservable.set(null);
        objectSelectionObservable.set(null);
        headlineMessageObservable.set(null);
        numOpenPanelsObservable.set(0);
    });

    it("hears a press as what it opens, or as the selection it changes over a panel that comes with it", () => {
        controlPressedObservable.set("customizeButton");
        numOpenPanelsObservable.set(1);
        settle();
        expect(clips()).toEqual(["ui/panelOpen"]);

        audio.calls.length = 0;
        // The mode switch: the face that edit mode opens on picked out, and the tools below it opening.
        controlPressedObservable.set("gameModeToggleSwitch");
        voxelQuadSelectionObservable.set(quad(77));
        numOpenPanelsObservable.set(2);
        settle();
        expect(clips()).toEqual(["edit/select"]);
    });

    it("hears the tutorial's step done in place of the selection that finished it", () => {
        headlineMessageObservable.set("Click the highlighted block to select it.");
        settle();
        audio.calls.length = 0;
        voxelQuadSelectionObservable.set(quad(12));
        headlineMessageObservable.set(null);
        settle();
        expect(clips()).toEqual(["tutorial/clear"]);
    });

    it("hears an edit at once, in place of the press that made it and of all it sets off in its moment", () => {
        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(3, 4, COLLISION_LAYER_MIN);
        voxelQuadSelectionObservable.set(quad(quadIndex));
        settle();
        audio.calls.length = 0;

        // The press, and a panel it opened on its way, both waiting when the add is heard.
        controlPressedObservable.set("addVoxelBlockButton");
        numOpenPanelsObservable.set(1);
        voxelBlockEditObservable.set({kind: "add", quadIndex, own: true});
        expect(clips()).toEqual(["edit/blockAdd"]);
        // The face of the new block picked out, and the tutorial's step it ends, as the add goes through.
        voxelQuadSelectionObservable.set(null);
        voxelQuadSelectionObservable.set(quad(quadIndex + 1));
        headlineMessageObservable.set("Remove the block.");
        // Another's block, arriving in the same moment.
        voxelBlockEditObservable.set({kind: "add", quadIndex, own: false});
        settle();
        expect(clips()).toEqual(["edit/blockAdd"]);

        // Once the moment is over, each is heard again.
        controlPressedObservable.set("removeVoxelBlockButton");
        settle();
        voxelBlockEditObservable.set({kind: "remove", quadIndex, own: true});
        expect(clips()).toEqual(["edit/blockAdd", "ui/press", "edit/blockRemove"]);
    });

    it("hears the user's own object added as one click, in place of the selection and the panel it brings", () => {
        controlPressedObservable.set("addObjectButton");
        objectEditObservable.set({kind: "add", object: makeObject("Prop", me.userID), own: true});
        objectSelectionObservable.set(object("Prop-1"));
        numOpenPanelsObservable.set(1);
        settle();
        expect(clips()).toEqual(["ui/press"]);
    });

    it("hears an attached object's coming apart alone, over the popup its removal was confirmed in and the selection " +
        "it moves; and of one that hung on no face, the popup", () => {
        for (const [objectType, heard] of [["Lamp", "edit/objectDestroy"], ["Volume", "ui/popupClose"]])
        {
            objectSelectionObservable.set(object(`${objectType}-1`));
            numOpenPopupsObservable.set(numOpenPopupsObservable.peek() + 1);
            settle();
            audio.calls.length = 0;
            // The confirming press, the popup going, the object with it, and a face picked out where it was.
            controlPressedObservable.set("confirmButton");
            numOpenPopupsObservable.set(numOpenPopupsObservable.peek() - 1);
            objectEditObservable.set({kind: "remove", object: makeObject(objectType, me.userID), own: true});
            objectSelectionObservable.set(null);
            voxelQuadSelectionObservable.set(quad(9));
            settle();
            expect(clips()).toEqual([heard]);
            voxelQuadSelectionObservable.set(null as unknown as VoxelQuadSelection);
            settle();
        }
    });

    it("hears a ball's burst alone of all its blast breaks, whether the burst was heard as the ball struck or with the " +
        "server's word of it", () => {
        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(10, 12, COLLISION_LAYER_MIN);
        const broken = () => {
            cannonBlastObservable.set({position: AT, hitObjectIds: []});
            objectEditObservable.set({kind: "remove", object: makeObject("Canvas"), own: false});
            voxelBlockEditObservable.set({kind: "remove", quadIndex, own: false});
        };
        // Told by the server, with what it broke right after.
        cannonBallBurstObservable.set({position: AT});
        broken();
        settle();
        expect(clips()).toEqual(["cannon/explosion"]);

        // Heard as the ball struck, a moment before the server's word.
        audio.calls.length = 0;
        cannonBallBurstObservable.set({position: AT});
        vi.advanceTimersByTime(4 * SOUND_MOMENT_MS);
        broken();
        settle();
        expect(clips()).toEqual(["cannon/explosion"]);

        // Its own moment over, a block goes with its usual sound again.
        audio.calls.length = 0;
        voxelBlockEditObservable.set({kind: "remove", quadIndex, own: false});
        expect(clips()).toEqual(["edit/blockRemove"]);
    });

    it("hears the most telling of the slight sounds of a moment, whatever their order", () => {
        headlineMessageObservable.set("Change the texture.");
        numOpenPanelsObservable.set(1);
        controlPressedObservable.set("someButton");
        voxelQuadSelectionObservable.set(quad(5));
        settle();
        expect(clips()).toEqual(["tutorial/show"]);
    });
});

describe("what tells of those events", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("counts the closable panels open, as they open and close", () => {
        const before = numOpenPanelsObservable.peek();
        const a = ClosablePanelUtil.register(() => {});
        const b = ClosablePanelUtil.register(() => {});
        expect(numOpenPanelsObservable.peek()).toBe(before + 2);
        ClosablePanelUtil.unregister(a);
        ClosablePanelUtil.unregister(a);
        expect(numOpenPanelsObservable.peek()).toBe(before + 1);
        ClosablePanelUtil.unregister(b);
        expect(numOpenPanelsObservable.peek()).toBe(before);
    });

    it("tells of a refusal with what was clicked", () => {
        const refused = vi.fn();
        clickRefusedObservable.addListener("test", refused);
        RefusalCoachMarkUtil.show("lockedShape", "Not yet.");
        RefusalCoachMarkUtil.hide();
        expect(refused).toHaveBeenCalledWith("lockedShape");
        clickRefusedObservable.removeListener("test");
    });

    it("tells of a press of anything that shows the hand pointer, by its id, and of nothing else", () => {
        class FakeElement
        {
            constructor(readonly id: string, readonly control: FakeElement | null) {}
            closest(selector: string): FakeElement | null { return (selector == ".cursor-pointer") ? this.control : null; }
        }
        let onClick: ((event: {target: unknown}) => void) | undefined;
        vi.stubGlobal("Element", FakeElement);
        vi.stubGlobal("window", {addEventListener: (type: string, listener: (event: {target: unknown}) => void,
            capture: boolean) => { if (type == "click" && capture) onClick = listener; }});
        ControlPressUtil.install();

        const pressed = vi.fn();
        controlPressedObservable.addListener("test", pressed);
        const button = new FakeElement("sendButton", null);
        const label = new FakeElement("", button as FakeElement);
        Object.assign(button, {control: button});
        onClick!({target: label});
        onClick!({target: new FakeElement("canvas", null)});
        onClick!({target: "text"});
        expect(pressed.mock.calls).toEqual([["sendButton"]]);
        controlPressedObservable.removeListener("test");
    });
});

describe("a fan's own sound", () => {
    it("is its wind where it blows, louder and higher the more blades it has, moving with it, until it goes", async () => {
        const facing = {x: 0, y: 0, z: 1};
        const setTo = (setting: typeof FAN_SETTINGS[number]) => {
            params.metadata[ObjectMetadataKeyEnumMap.ForceProperties] =
                new EncodableByteString(FanObjectTypeConfig.util.encodeForceProperties(setting));
        };
        const sourceAt = (pos: {x: number, y: number, z: number}) => {
            const normal = Geometry3DUtil.getAxisFacingBasis(facing).normal;
            return {x: pos.x + WIND_SOURCE_OFFSET * normal.x, y: pos.y + WIND_SOURCE_OFFSET * normal.y,
                z: pos.z + WIND_SOURCE_OFFSET * normal.z};
        };
        const expectWind = (call: typeof audio.calls[number], setting: typeof FAN_SETTINGS[number]) => {
            expect(call).toMatchObject({method: "playLoopAt", clip: "fan/wind", position: sourceAt(AT)});
            expect(call.options.volume).toBeCloseTo(ONE_BLADE_WIND_VOLUME + WIND_VOLUME_PER_BLADE * (setting.blades - 1), 12);
            expect(call.options.rate).toBeCloseTo(ONE_BLADE_WIND_RATE + WIND_RATE_PER_BLADE * (setting.blades - 1), 12);
            expect(call.options.range).toBe(setting.range + WIND_HEARD_PAST_REACH);
        };

        const params = makeObject("Fan");
        params.transform = new ObjectTransform({...AT}, facing, {x: 1, y: 1, z: 1});
        const [fewest, , most] = FAN_SETTINGS;
        setTo(fewest);
        // Its housing, blades and wind are its components', which play no part here.
        const fan = Object.assign(Object.create(FanGameObject.prototype), {params, components: {},
            obj: new THREE.Object3D(), instancedMeshComposer: {rebuildParts() {}}}) as FanGameObject;
        await fan.onSpawn();
        expectWind(audio.calls[0], fewest);

        // Set to more blades, a wind of its own starts in place of the last.
        setTo(most);
        fan.onSetMetadata(ObjectMetadataKeyEnumMap.ForceProperties, FanObjectTypeConfig.util.encodeForceProperties(most));
        expect(audio.calls[0].voice.stops).toBe(1);
        expectWind(audio.calls[1], most);

        const moved = {x: AT.x + 2, y: AT.y, z: AT.z};
        params.transform = new ObjectTransform({...moved}, facing, {x: 1, y: 1, z: 1});
        fan.onTransformChanged(false);
        expect(audio.calls[1].voice.positions).toEqual([sourceAt(moved)]);

        await fan.onDespawn();
        expect(audio.calls[1].voice.stops).toBe(1);
        expect(audio.calls.length).toBe(2);
    });
});

describe("a cannon's own sounds", () => {
    const FRAME_SECONDS = 1 / 60;
    const facing = {x: 0, y: 1, z: 0};

    function makeCannon(): {cannon: CannonGameObject, tell: (state: Partial<CannonState>) => void}
    {
        const params = makeObject("Cannon");
        params.transform = new ObjectTransform({...AT}, facing, {x: 1, y: 1, z: 1});
        const state = CannonStateUtil.getObjectState(params);
        // Its barrel and gauges are its composer's, which plays no part here.
        const cannon = Object.assign(Object.create(CannonGameObject.prototype), {params, components: {},
            obj: new THREE.Object3D(), instancedMeshComposer: {getParts: () => [], redrawParts() {}},
            state, shownAim: CannonStateUtil.getShownAim(state, facing), turnSoundSecondsLeft: 0}) as CannonGameObject;
        // As the server tells of it: what it now is, under its one key.
        const tell = (change: Partial<CannonState>) => {
            const value = CannonStateUtil.encode({...CannonStateUtil.getObjectState(params), ...change});
            params.metadata[ObjectMetadataKeyEnumMap.CannonState] = new EncodableByteString(value);
            cannon.onSetMetadata(ObjectMetadataKeyEnumMap.CannonState, value);
        };
        return {cannon, tell};
    }

    function turnFor(cannon: CannonGameObject, seconds: number): void
    {
        for (let elapsed = 0; elapsed < seconds; elapsed += FRAME_SECONDS)
            cannon.update(FRAME_SECONDS);
    }

    it("are its gears, from its pivot, for as long as it turns to aim at someone, and no longer", async () => {
        const {cannon, tell} = makeCannon();
        turnFor(cannon, 0.5);
        expect(audio.calls).toEqual([]);

        // Aiming, it is told where to turn a step at a time, as far as the server turns it between two flushes.
        const stepSeconds = SIGNAL_BATCH_SEND_INTERVAL / 1000;
        const pitch = CannonStateUtil.decode("").aim.pitch;
        const tellStep = (step: number) => tell({aim: {yaw: step * CANNON_TURN_RATE * stepSeconds, pitch}});
        tell({phase: CannonPhaseEnumMap.Aiming});
        cannon.update(FRAME_SECONDS);
        expect(audio.calls).toEqual([]);
        tellStep(1);
        cannon.update(FRAME_SECONDS);
        expect(audio.calls).toMatchObject([{method: "playLoopAt", clip: "cannon/turn",
            position: CannonAimUtil.getPivot(AT, facing), options: {volume: TURN_SOUND_VOLUME, range: TURN_SOUND_RANGE}}]);
        // Whoever it may fire at hears it turning.
        expect(TURN_SOUND_RANGE).toBeGreaterThan(CANNON_MAX_RANGE);

        // Still turning, a step after another: one voice, going on.
        for (let step = 2; step <= 12; ++step)
        {
            turnFor(cannon, stepSeconds);
            tellStep(step);
            expect(audio.calls.length).toBe(1);
            expect(audio.calls[0].voice.stops).toBe(0);
        }
        // There, and standing aimed: its gears stop.
        tell({phase: CannonPhaseEnumMap.Ready});
        turnFor(cannon, stepSeconds + 0.5);
        expect(audio.calls[0].voice.stops).toBe(1);
        expect(audio.calls.length).toBe(1);
    });

    it("stop while it stays on someone standing still, not aimed yet, and start again as they move", async () => {
        const {cannon, tell} = makeCannon();
        const stepSeconds = SIGNAL_BATCH_SEND_INTERVAL / 1000;
        const pitch = CannonStateUtil.decode("").aim.pitch;
        tell({phase: CannonPhaseEnumMap.Aiming});
        tell({aim: {yaw: CANNON_TURN_RATE * stepSeconds, pitch}});
        turnFor(cannon, stepSeconds);
        expect(audio.calls.length).toBe(1);
        // On them, and they stand still: nothing more is told while it stays on them, and it has nothing to turn for.
        turnFor(cannon, 0.5);
        expect(audio.calls[0].voice.stops).toBe(1);
        // They move again before it is aimed: its gears start again.
        tell({aim: {yaw: 2 * CANNON_TURN_RATE * stepSeconds, pitch}});
        cannon.update(FRAME_SECONDS);
        expect(audio.calls.length).toBe(2);
        expect(audio.calls[1].voice.stops).toBe(0);
    });

    it("are none as its barrel drops or rises with its switch, and its gears stop as it goes", async () => {
        const {cannon, tell} = makeCannon();
        tell({on: false});
        turnFor(cannon, 1);
        tell({on: true});
        turnFor(cannon, 1);
        expect(audio.calls).toEqual([]);

        tell({phase: CannonPhaseEnumMap.Aiming, aim: {yaw: 2, pitch: 0}});
        cannon.update(FRAME_SECONDS);
        expect(audio.calls.length).toBe(1);
        await cannon.onDespawn();
        expect(audio.calls[0].voice.stops).toBe(1);
    });

    it("are a shot from its barrel's mouth, the way it points, each time it has a ball fewer", () => {
        const {tell} = makeCannon();
        const aim = {yaw: 0.7, pitch: 0.2};
        tell({aim, phase: CannonPhaseEnumMap.Ready});
        expect(audio.calls).toEqual([]);

        const shots: {position: {x: number, y: number, z: number}, direction: {x: number, y: number, z: number}}[] = [];
        cannonFiredObservable.addListener("test", shot => { shots.push(shot); });
        tell({ballsLeft: CANNON_BALL_COUNT - 1, phase: CannonPhaseEnumMap.Waiting});
        cannonFiredObservable.removeListener("test");

        // (As its state keeps the aim, to less than a hundredth of a degree.)
        const kept = CannonStateUtil.decode(CannonStateUtil.encode({...CannonStateUtil.decode(""), aim})).aim;
        expect(shots).toHaveLength(1);
        expect(shots[0].position).toEqual(CannonAimUtil.getMuzzle(AT, facing, kept));
        expect(shots[0].direction).toEqual(CannonAimUtil.getDirection(facing, kept));
        expect(audio.calls).toMatchObject([{method: "playAt", clip: "cannon/fire", position: shots[0].position}]);
    });
});
