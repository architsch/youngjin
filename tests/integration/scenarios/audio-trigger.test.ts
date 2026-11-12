/**
 * Which event sounds as what (see AudioTriggerUtil), with the audio itself stood in for: nothing for any edit, whoever
 * made it (blocks and the room's own objects put up, taken away, moved, turned, repainted or changed, nor a player's, a
 * bill's or a cannon ball's), but a cannon that has fired its last ball as a puff as it goes; a cannon's shot and its
 * ball's burst where they are, louder and heard farther than the rest, the burst alone of all its blast breaks; a
 * ball's bounce where the ball then is, heard as far, two balls' off each other as one; a
 * cannon's own gears while it turns to aim; a fan's wind; others coming and going (not the user, nor a ghost); dollars
 * (the user's own as they reach the count, others' where they are collected, the day's reward as it shows, a cash
 * register as they are spent); nothing for the UI and the edit tools (popups, the selection, the tutorial's marks, the
 * game mode); travel (a door shutting on leaving, and one opening on every arrival, once the first has shut); one
 * moment as one sound; and a sound that fails stopping none after it.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
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

import AudioTriggerUtil, { ARRIVAL_SOUND_RANGE, CANNON_BOUNCE_VOLUME, CANNON_EXPLOSION_VOLUME, CANNON_FIRE_VOLUME,
    CANNON_SOUND_RANGE, COLLECT_SOUND_RANGE, PITCH_VARIATION, PUFF_SOUND_RANGE, SOUND_MOMENT_MS }
    from "../../../src/client/audio/util/audioTriggerUtil";
import AudioBundleMap from "../../../src/client/audio/maps/audioBundleMap";
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
import { cannonBallBounceObservable, cannonBallBurstObservable, cannonBlastObservable, cannonFiredObservable,
    dollarsSpentObservable, gameModeObservable, headlineMessageObservable, inventoryGainObservable,
    loginRewardStageObservable, numOpenPopupsObservable, objectCollectedObservable, objectEditObservable,
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
import { COLLISION_LAYER_MIN, SIGNAL_BATCH_SEND_INTERVAL } from "../../../src/shared/system/sharedConstants";

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

// The moment over: what waited in it is heard, and what it held quiet may sound again. A millisecond past its end,
// since the clock here holds fractions, which round either way right at it.
function settle(): void
{
    vi.advanceTimersByTime(SOUND_MOMENT_MS + 1);
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
    it("sounds nothing of a block put up, taken down, moved or repainted, whoever did it", () => {
        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(10, 12, COLLISION_LAYER_MIN);
        for (const kind of ["add", "remove", "move", "retexture"] as const)
        {
            for (const own of [false, true])
            {
                voxelBlockEditObservable.set({kind, quadIndex, own});
                settle();
            }
        }
        expect(audio.calls).toEqual([]);
    });

    it("sounds nothing of the room's own objects put up, taken away, moved, turned or changed, whoever did it, not " +
        "even one bought, and no player, bill or cannon ball as an edit", () => {
        // A turn is a placement facing another way.
        const turned = makeObject("Prop");
        turned.transform = new ObjectTransform({...AT}, {x: 1, y: 0, z: 0}, {x: 1, y: 1, z: 1});
        for (const own of [false, true])
        {
            for (const set of [
                () => objectEditObservable.set({kind: "add", object: makeObject("Prop"), own}),
                () => objectPlacedObservable.set({object: makeObject("Fan"), own}),
                () => objectPlacedObservable.set({object: turned, own}),
                () => objectEditObservable.set({kind: "remove", object: makeObject("Volume"), own}),
                () => objectEditObservable.set({kind: "change", object: makeObject("Canvas"), own})])
            {
                set();
                settle();
            }
        }
        // A cannon bought, which sounds as the dollars spent (see below), and nothing of its own.
        objectEditObservable.set({kind: "add", object: makeObject("Cannon", me.userID), own: true});
        settle();
        expect(audio.calls).toEqual([]);

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

    it("sounds nothing of an attached object taken away, whoever took it, but a cannon that has fired its last ball as " +
        "a puff from its middle", () => {
        const middleOf = (object: AddObjectSignal) =>
            PhysicsColliderStateUtil.getObjectColliderState(object.objectTypeIndex, object.transform)!.hitbox.center;
        for (const object of [makeObject("Lamp"), makeObject("Canvas"), makeObject("Door"), makeObject("Npc"),
            makeObject("Cannon")])
        {
            for (const own of [false, true])
            {
                objectEditObservable.set({kind: "remove", object, own});
                settle();
            }
        }
        expect(audio.calls).toEqual([]);

        const spent = makeObject("Cannon", "someone", {[ObjectMetadataKeyEnumMap.CannonState]: CannonStateUtil.encode(
            {...CannonStateUtil.decode(""), ballsLeft: 0})});
        expect(middleOf(spent), "a cannon's middle is in front of its face").not.toEqual(AT);
        objectEditObservable.set({kind: "remove", object: spent, own: false});
        expect(audio.calls).toMatchObject([{method: "playAt", clip: "cannon/puff", position: middleOf(spent),
            options: {range: PUFF_SOUND_RANGE}}]);
    });

    it("sounds a cannon's shot and its ball's burst where they are, louder and farther off than the rest, whatever " +
        "else the moment sounds", () => {
        const muzzle = {x: 7, y: 2, z: 9};
        cannonFiredObservable.set({position: muzzle, direction: {x: 1, y: 0, z: 0}});
        // In the moment of another sound, which holds no burst back.
        dollarsSpentObservable.set(5);
        cannonBallBurstObservable.set({position: AT});
        expect(audio.calls).toMatchObject([
            {method: "playAt", clip: "cannon/fire", position: muzzle,
                options: {volume: CANNON_FIRE_VOLUME, range: CANNON_SOUND_RANGE}},
            {method: "play", clip: "dollar/spend"},
            {method: "playAt", clip: "cannon/explosion", position: AT,
                options: {volume: CANNON_EXPLOSION_VOLUME, range: CANNON_SOUND_RANGE}}]);
        expectVaried(audio.calls[0].options.rate);
        expectVaried(audio.calls[2].options.rate);
        // Fading the slowest of all, as it carries the farthest.
        for (const range of [PUFF_SOUND_RANGE, ARRIVAL_SOUND_RANGE, COLLECT_SOUND_RANGE, TURN_SOUND_RANGE])
            expect(CANNON_SOUND_RANGE).toBeGreaterThan(range);
        for (const call of audio.calls.filter(call => call.method == "playAt"))
            expect(call.options.volume).toBeGreaterThan(1);
    });

    it("sounds a ball's bounce where the ball then is, heard as far off as its burst, whatever else the " +
        "moment sounds, and two balls' bounce off each other, told of as one each, as one", () => {
        const bouncedAt = {x: 7, y: 2, z: 9};
        dollarsSpentObservable.set(5);
        cannonBallBounceObservable.set({position: bouncedAt, normal: {x: 1, y: 0, z: 0}});
        expect(audio.calls).toMatchObject([{method: "play", clip: "dollar/spend"},
            {method: "playAt", clip: "cannon/bounce", position: bouncedAt,
                options: {volume: CANNON_BOUNCE_VOLUME, range: CANNON_SOUND_RANGE}}]);
        expectVaried(audio.calls[1].options.rate);
        expect(CANNON_BOUNCE_VOLUME).toBeGreaterThan(0);
        // The other ball's, in the same moment.
        cannonBallBounceObservable.set({position: AT, normal: {x: -1, y: 0, z: 0}});
        vi.advanceTimersByTime(0.5 * SOUND_MOMENT_MS);
        cannonBallBounceObservable.set({position: AT, normal: {x: -1, y: 0, z: 0}});
        expect(clips()).toEqual(["dollar/spend", "cannon/bounce"]);

        // The moment over, the next bounce is heard, and a burst in its moment as well.
        settle();
        cannonBallBounceObservable.set({position: AT, normal: {x: 0, y: 1, z: 0}});
        cannonBallBurstObservable.set({position: AT});
        expect(clips()).toEqual(["dollar/spend", "cannon/bounce", "cannon/bounce", "cannon/explosion"]);
        expect(audio.calls[2].position).toEqual(AT);
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

    it("sounds dollars spent as a cash register", () => {
        dollarsSpentObservable.set(5);
        expect(audio.calls).toMatchObject([{method: "play", clip: "dollar/spend"}]);
    });

    it("sounds nothing of the UI and the edit tools: popups, the selection, the tutorial's marks and the game mode", () => {
        const popups = numOpenPopupsObservable.peek();
        for (const set of [
            () => numOpenPopupsObservable.set(popups + 1), () => numOpenPopupsObservable.set(popups),
            () => gameModeObservable.set("edit"), () => gameModeObservable.set("play"),
            () => voxelQuadSelectionObservable.set(quad(40)), () => voxelQuadSelectionObservable.set(quad(41)),
            () => voxelQuadSelectionObservable.set(null), () => objectSelectionObservable.set(object("lamp-1")),
            () => objectSelectionObservable.set(null),
            () => headlineMessageObservable.set("Add a block."),
            () => screenArrowTargetObservable.set(arrow("addVoxelBlockButton")),
            () => screenDiagramObservable.set(null),
            () => headlineMessageObservable.set(null), () => screenArrowTargetObservable.set(null)])
        {
            set();
            settle();
        }
        expect(audio.calls).toEqual([]);
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

    it("lets a sound that fails stop none of the listeners after it, nor the timer it waited for", () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        audio.fail = true;
        const after = vi.fn();
        dollarsSpentObservable.addListener("after", after);
        dollarsSpentObservable.set(5);
        expect(after).toHaveBeenCalled();
        expect(error).toHaveBeenCalledWith("AudioTriggerUtil :: Failed to play a sound", expect.any(Error));
        dollarsSpentObservable.removeListener("after");

        // An arrival, which waited for the door the user left by.
        error.mockClear();
        audio.fail = false;
        settle();
        roomTravelObservable.set({kind: "leave", roomID: "hub"});
        audio.fail = true;
        roomTravelObservable.set({kind: "arrive", roomID: "garden"});
        expect(error).not.toHaveBeenCalled();
        expect(() => vi.advanceTimersByTime(1000 * AudioBundleMap.clips["room/leave"].duration)).not.toThrow();
        expect(error).toHaveBeenCalledWith("AudioTriggerUtil :: Failed to play a sound", expect.any(Error));
        error.mockRestore();
        expect(AudioTriggerUtil).toBeDefined();
    });
});

describe("one action, one sound", () => {
    it("hears the sounds of a moment as one, the first of them, and each again once it is over", () => {
        // Dollars spent twice at once, and the day's reward shown in the same moment.
        dollarsSpentObservable.set(5);
        dollarsSpentObservable.set(5);
        loginRewardStageObservable.set("shown");
        settle();
        expect(clips()).toEqual(["dollar/spend"]);

        loginRewardStageObservable.set("shown");
        settle();
        dollarsSpentObservable.set(5);
        expect(clips()).toEqual(["dollar/spend", "dollar/reward", "dollar/spend"]);
    });

    it("hears a ball's burst alone of all its blast breaks, whether the burst was heard as the ball struck or with the " +
        "server's word of it, and holds no other sound back", () => {
        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(10, 12, COLLISION_LAYER_MIN);
        const broken = () => {
            cannonBlastObservable.set({position: AT, hitObjectIds: []});
            objectEditObservable.set({kind: "remove", object: makeObject("Canvas"), own: false});
            objectEditObservable.set({kind: "remove", object: makeObject("Cannon"), own: false});
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

        // Another sound in the burst's own moment is heard too.
        audio.calls.length = 0;
        settle();
        cannonBallBurstObservable.set({position: AT});
        dollarsSpentObservable.set(5);
        expect(clips()).toEqual(["cannon/explosion", "dollar/spend"]);
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
        // Its barrel and counters are its composer's, which plays no part here.
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
