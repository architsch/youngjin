/**
 * Scenario tests: cannon balls as a browser shows them (see CannonBallGameObject), flown through a real room's
 * physics with what draws them stood in for — flying by the clock between the server's words, as the server flies
 * them; passing through other balls; shown bursting at once on what stands still, once, with the server's word
 * of it bringing only what the blast did; waiting at a body for that word, and no longer than a moment; taken up
 * again where the server has one that a burst was shown of too soon; and a word that turns one drawn without a
 * jump. And what a blast does to the user's own player (see CannonBlastThrowUtil): thrown as the server throws an
 * agent's, with a shake of the view in play mode alone. And a cannon's gauges (see CannonGameObject), whose green
 * dims as the camera goes farther from it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as THREE from "three";

const me = vi.hoisted(() => ({userID: "me", playerObjectId: "my-player", position: {x: 0, y: 0, z: 0}, roomID: "cannon-room"}));
vi.mock("../../../src/client/app", () => ({default: {getUser: () => ({id: me.userID}),
    getCurrentRoom: () => ({id: me.roomID}), getWatchedUserID: () => ""}}));
vi.mock("../../../src/client/object/clientObjectManager", () => ({default: {
    getMyPlayer: () => ({params: {objectId: me.playerObjectId}, position: me.position}), setObjectTransform() {}}}));
vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    return {default: {getCamera: () => camera}};
});
vi.mock("../../../src/client/networking/client/socketsClient", () => ({default: {}}));
// A cannon's gears, which sound nothing here.
vi.mock("../../../src/client/audio/audioManager", () => ({default: {}}));
vi.mock("../../../src/client/graphics/types/gizmo/voxelQuadSelection", () => ({default: class {}}));
vi.mock("../../../src/client/graphics/types/gizmo/objectSelection", () => ({default: class {}}));

import { createTestRoom } from "../helpers/roomContent";
import CannonBallGameObject, { MAX_HELD_SECONDS, MAX_UNCONFIRMED_SECONDS }
    from "../../../src/client/object/types/gameObject/cannonBallGameObject";
import CannonGameObject, { GAUGE_DIM_END_DISTANCE, GAUGE_DIM_START_DISTANCE }
    from "../../../src/client/object/types/gameObject/cannonGameObject";
import GraphicsManager from "../../../src/client/graphics/graphicsManager";
import CannonCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/cannonCompositionConstants";
import CannonCompositionUtil from "../../../src/shared/graphics/mesh/composition/util/cannonCompositionUtil";
import CannonAimUtil from "../../../src/shared/object/util/cannonAimUtil";
import CannonStateUtil from "../../../src/shared/object/util/cannonStateUtil";
import "../../../src/client/object/util/cannonBlastThrowUtil";
import { cameraShakeObservable, cannonBallBurstObservable, cannonBlastObservable,
    gameModeObservable } from "../../../src/client/system/clientObservables";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { CANNON_BALL_RADIUS, CANNON_BALL_SPEED }
    from "../../../src/shared/object/types/objectTypeConfig/cannonBallObjectTypeConfig";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import CannonBallStateUtil from "../../../src/shared/object/util/cannonBallStateUtil";
import CannonBlastUtil from "../../../src/shared/object/util/cannonBlastUtil";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import Vec3 from "../../../src/shared/math/types/vec3";
import Vector3DUtil from "../../../src/shared/math/util/vector3DUtil";
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";

const ROOM_ID = me.roomID;
const BALL_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("CannonBall");
const PLAYER_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Player");
const STATE_KEY = ObjectMetadataKeyEnumMap.CannonState;
const FRAME_MS = 1000 / 60;
const STANDING_Y = 0.5 * PLAYER_HEIGHT;
// The height balls fly at across the lower storey, and where a lone block stands in their way.
const FLIGHT_Y = 2;
const BLOCK_X = 16;
const EAST: Vec3 = {x: CANNON_BALL_SPEED, y: 0, z: 0};
// How finely a ball's place is kept in what the server tells of it.
const PLACE_STEP = 0.02;

let room: Room;
let bursts: Vec3[];
let blasts: {position: Vec3, hitObjectIds: string[]}[];
let shakes: number[];
let numBalls = 0;

function stateOf(pos: Vec3, vel: Vec3, burst?: {hitObjectIds: string[]}): string
{
    return CannonBallStateUtil.encode({pos, vel, exploded: burst != undefined, hitObjectIds: burst?.hitObjectIds ?? []});
}

// A ball as the room sends one, with what draws it stood in for.
async function makeBall(pos: Vec3, vel: Vec3 = EAST)
{
    const params = new AddObjectSignal(ROOM_ID, "", "", BALL_TYPE_INDEX, `ball-${++numBalls}`,
        new ObjectTransform({...pos}, {x: 1, y: 0, z: 0}, {...UNIT_VEC3}), {[STATE_KEY]: new EncodableByteString(stateOf(pos, vel))});
    room.objectGroup.addObject(params);
    const shown = {hidden: false};
    const kept = CannonBallStateUtil.getObjectState(params);
    const ball = Object.assign(Object.create(CannonBallGameObject.prototype), {params, components: {},
        config: ObjectTypeConfigMap.getConfigByIndex(BALL_TYPE_INDEX), obj: new THREE.Object3D(),
        instancedMeshComposer: {setHidden: (hidden: boolean) => { shown.hidden = hidden; }},
        at: kept.pos, vel: kept.vel, drawnOffset: {x: 0, y: 0, z: 0}, heldSeconds: 0, owedSeconds: 0,
        burstShownAt: undefined, unconfirmedSeconds: 0, burstConfirmed: false, strikesUnseen: false,
        updatedAt: performance.now()}) as CannonBallGameObject;
    ball.obj.position.set(pos.x, pos.y, pos.z);
    await ball.onSpawn();
    // What the server tells of it, under its one key.
    const tell = (value: string) => {
        params.metadata[STATE_KEY] = new EncodableByteString(value);
        ball.onSetMetadata(STATE_KEY, value);
    };
    const drawnAt = (): Vec3 => ({x: ball.obj.position.x, y: ball.obj.position.y, z: ball.obj.position.z});
    return {ball, tell, shown, drawnAt};
}

// Frames drawn over a while, each a sixtieth of a second after the last.
function fly(balls: CannonBallGameObject | CannonBallGameObject[], seconds: number): void
{
    for (let elapsed = 0; elapsed < 1000 * seconds - 0.001; elapsed += FRAME_MS)
    {
        vi.advanceTimersByTime(FRAME_MS);
        for (const ball of [balls].flat())
            ball.update(FRAME_MS / 1000);
    }
}

function placeBlock(x: number, y: number, z: number): void
{
    const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, VoxelQueryUtil.getVoxelRowFromWorldZ(z),
        VoxelQueryUtil.getVoxelColFromWorldX(x))!;
    voxel.blockLayerMask |= 1 << VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(y);
}

function standPlayer(objectId: string, pos: Vec3): void
{
    const player = new AddObjectSignal(ROOM_ID, objectId, objectId, PLAYER_TYPE_INDEX, objectId,
        new ObjectTransform({...pos}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}));
    room.objectGroup.addObject(player);
    PhysicsManager.addObject(ROOM_ID, objectId, PLAYER_TYPE_INDEX,
        PhysicsColliderStateUtil.getObjectColliderState(PLAYER_TYPE_INDEX, player.transform)!);
}

function dist(a: Vec3, b: Vec3): number
{
    return Math.sqrt(Vector3DUtil.distSqr(a, b));
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.useFakeTimers({toFake: ["performance"]});
    room = createTestRoom(ROOM_ID, "", RoomTypeEnumMap.Hub);
    room.objectGroup = new ObjectGroup([]);
    PhysicsManager.load(new RoomRuntimeMemory(room, {}));
    bursts = [];
    blasts = [];
    shakes = [];
    cannonBallBurstObservable.addListener("test", ({position}) => { bursts.push({...position}); });
    cannonBlastObservable.addListener("test", blast => { blasts.push({position: {...blast.position}, hitObjectIds: [...blast.hitObjectIds]}); });
    cameraShakeObservable.addListener("test", strength => { shakes.push(strength); });
    gameModeObservable.set("play");
});

afterEach(() => {
    cannonBallBurstObservable.removeListener("test");
    cannonBlastObservable.removeListener("test");
    cameraShakeObservable.removeListener("test");
    PhysicsManager.unload(ROOM_ID);
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("a cannon ball in a browser", () => {
    it("flies on by itself between the server's words, straight, as fast as it was told it goes", async () => {
        const from = {x: 8, y: FLIGHT_Y, z: 12};
        const vel = Vector3DUtil.scale(Vector3DUtil.normalize({x: 2, y: 0.2, z: 1}), CANNON_BALL_SPEED);
        const {ball, shown, drawnAt} = await makeBall(from, vel);
        fly(ball, 2);
        expect(dist(drawnAt(), Vector3DUtil.add(from, Vector3DUtil.scale(vel, 2)))).toBeLessThan(0.05);
        expect(shown.hidden).toBe(false);
        expect(bursts).toEqual([]);
    });

    it("flies by the clock, however few frames are drawn, though never more than a moment's way in one", async () => {
        const from = {x: 8, y: FLIGHT_Y, z: 12};
        const {ball, drawnAt} = await makeBall(from);
        vi.advanceTimersByTime(100);
        ball.update(1 / 20);
        expect(drawnAt().x - from.x).toBeCloseTo(0.1 * CANNON_BALL_SPEED, 1);

        // A page long out of sight flies none of what it missed.
        const before = drawnAt().x;
        vi.advanceTimersByTime(60_000);
        ball.update(1 / 20);
        expect(drawnAt().x - before).toBeLessThan(CANNON_BALL_SPEED);
        expect(drawnAt().x - before).toBeGreaterThan(0);
    });

    it("is shown bursting the moment it strikes a block, once, and hidden; the server's word then brings only the blast", async () => {
        placeBlock(BLOCK_X + 0.25, FLIGHT_Y, 12.25);
        const {ball, tell, shown} = await makeBall({x: BLOCK_X - 3, y: FLIGHT_Y, z: 12.25});
        const struckAt = {x: BLOCK_X - CANNON_BALL_RADIUS, y: FLIGHT_Y, z: 12.25};
        fly(ball, (3 - CANNON_BALL_RADIUS) / CANNON_BALL_SPEED - 0.05);
        expect(bursts).toEqual([]);
        fly(ball, 0.1);
        expect(bursts).toHaveLength(1);
        expect(dist(bursts[0], struckAt)).toBeLessThan(0.02);
        expect(shown.hidden).toBe(true);
        expect(blasts).toEqual([]);

        // The server's word a moment later, of the same burst.
        fly(ball, 0.15);
        tell(stateOf(struckAt, EAST, {hitObjectIds: ["someone"]}));
        expect(bursts).toHaveLength(1);
        expect(blasts).toHaveLength(1);
        expect(blasts[0].hitObjectIds).toEqual(["someone"]);
        expect(dist(blasts[0].position, struckAt)).toBeLessThan(PLACE_STEP);
        // And nothing more of it, however long it is until it is taken away.
        fly(ball, 2 * MAX_UNCONFIRMED_SECONDS);
        expect(bursts).toHaveLength(1);
        expect(shown.hidden).toBe(true);
    });

    it("is shown bursting on the room's own floor too", async () => {
        const {ball, shown} = await makeBall({x: 12, y: 1, z: 12}, {x: 0, y: -CANNON_BALL_SPEED, z: 0});
        fly(ball, 0.5);
        expect(bursts).toHaveLength(1);
        expect(bursts[0].y).toBeCloseTo(CANNON_BALL_RADIUS, 2);
        expect(shown.hidden).toBe(true);
    });

    it("is shown bursting where the server says it did, if it had struck nothing here", async () => {
        const {ball, tell, shown} = await makeBall({x: 8, y: FLIGHT_Y, z: 12});
        fly(ball, 0.5);
        const told = {x: 9.4, y: FLIGHT_Y, z: 12};
        tell(stateOf(told, EAST, {hitObjectIds: []}));
        expect(bursts).toHaveLength(1);
        expect(dist(bursts[0], told)).toBeLessThan(PLACE_STEP);
        expect(blasts).toHaveLength(1);
        expect(shown.hidden).toBe(true);
    });

    it("waits at a body it strikes for the server to say what came of it, and bursts there on its word", async () => {
        standPlayer("someone", {x: BLOCK_X, y: STANDING_Y, z: 12});
        const {ball, tell, shown, drawnAt} = await makeBall({x: BLOCK_X - 3, y: STANDING_Y, z: 12});
        const touchingX = BLOCK_X - PLAYER_RADIUS_XZ - CANNON_BALL_RADIUS;
        fly(ball, (3 - PLAYER_RADIUS_XZ - CANNON_BALL_RADIUS) / CANNON_BALL_SPEED + 0.5 * MAX_HELD_SECONDS);
        expect(drawnAt().x).toBeCloseTo(touchingX, 2);
        expect(bursts).toEqual([]);
        expect(shown.hidden).toBe(false);

        tell(stateOf({x: touchingX, y: STANDING_Y, z: 12}, EAST, {hitObjectIds: ["someone"]}));
        expect(bursts).toHaveLength(1);
        expect(blasts.map(blast => blast.hitObjectIds)).toEqual([["someone"]]);
        expect(shown.hidden).toBe(true);
    });

    it(`flies on through a body the server has said nothing of for ${MAX_HELD_SECONDS} seconds, making up the time`, async () => {
        standPlayer("someone", {x: BLOCK_X, y: STANDING_Y, z: 12});
        const from = {x: BLOCK_X - 2, y: STANDING_Y, z: 12};
        const {ball, shown, drawnAt} = await makeBall(from);
        const untilTouching = (2 - PLAYER_RADIUS_XZ - CANNON_BALL_RADIUS) / CANNON_BALL_SPEED;
        fly(ball, untilTouching + MAX_HELD_SECONDS + 0.2);
        expect(drawnAt().x).toBeGreaterThan(BLOCK_X - PLAYER_RADIUS_XZ - CANNON_BALL_RADIUS + 0.1);
        expect(bursts).toEqual([]);
        expect(shown.hidden).toBe(false);
        // Before long it is where the server's ball is, which never stopped.
        fly(ball, 1.3);
        const elapsed = untilTouching + MAX_HELD_SECONDS + 1.5;
        expect(drawnAt().x).toBeCloseTo(from.x + CANNON_BALL_SPEED * elapsed, 1);
    });

    it("passes through other balls, whose bounces the server tells of", async () => {
        const a = await makeBall({x: 10, y: FLIGHT_Y, z: 12}, EAST);
        const b = await makeBall({x: 13, y: FLIGHT_Y, z: 12}, {x: -CANNON_BALL_SPEED, y: 0, z: 0});
        fly([a.ball, b.ball], 1);
        expect(a.drawnAt().x).toBeCloseTo(13, 1);
        expect(b.drawnAt().x).toBeCloseTo(10, 1);
        expect(bursts).toEqual([]);

        // Told how each goes after their bounce, each follows.
        a.tell(stateOf({x: 11.2, y: FLIGHT_Y, z: 12}, {x: -CANNON_BALL_SPEED, y: 0, z: 0}));
        fly([a.ball, b.ball], 1);
        expect(a.drawnAt().x).toBeCloseTo(11.2 - CANNON_BALL_SPEED, 1);
    });

    it("is drawn without a jump when the server's word moves it, and soon where that has it", async () => {
        const {ball, tell, drawnAt} = await makeBall({x: 8, y: FLIGHT_Y, z: 12});
        fly(ball, 1);
        const before = drawnAt();
        const told = {x: before.x + 0.4, y: FLIGHT_Y + 0.3, z: 12.2};
        const turned = {x: 0, y: 0, z: CANNON_BALL_SPEED};
        tell(stateOf(told, turned));
        fly(ball, 1 / 60);
        expect(dist(drawnAt(), before)).toBeLessThan(0.15);
        fly(ball, 1);
        expect(dist(drawnAt(), Vector3DUtil.add(told, Vector3DUtil.scale(turned, 1 + 1 / 60)))).toBeLessThan(0.05);
    });

    it("is drawn again, and flies where the server has it, if the server tells of it flying after a burst was shown", async () => {
        placeBlock(BLOCK_X + 0.25, FLIGHT_Y, 12.25);
        const {ball, tell, shown, drawnAt} = await makeBall({x: BLOCK_X - 1, y: FLIGHT_Y, z: 12.25});
        fly(ball, 0.5);
        expect(bursts).toHaveLength(1);
        expect(shown.hidden).toBe(true);

        // The server's ball was turned aside just short of the block.
        const told = {x: BLOCK_X - 0.4, y: FLIGHT_Y, z: 12.25};
        const turned = {x: 0, y: 0, z: -CANNON_BALL_SPEED};
        tell(stateOf(told, turned));
        expect(shown.hidden).toBe(false);
        fly(ball, 1);
        expect(dist(drawnAt(), Vector3DUtil.add(told, Vector3DUtil.scale(turned, 1)))).toBeLessThan(0.06);
        // From then on it bursts on the server's word alone, whatever it meets here.
        tell(stateOf({x: BLOCK_X - 1, y: FLIGHT_Y, z: 12.25}, EAST));
        fly(ball, 1);
        expect(bursts).toHaveLength(1);
        expect(drawnAt().x).toBeGreaterThan(BLOCK_X);
    });

    it(`takes a burst the server hasn't told of in ${MAX_UNCONFIRMED_SECONDS} seconds for none, and flies on`, async () => {
        placeBlock(BLOCK_X + 0.25, FLIGHT_Y, 12.25);
        const {ball, shown, drawnAt} = await makeBall({x: BLOCK_X - 1, y: FLIGHT_Y, z: 12.25});
        fly(ball, 0.5);
        expect(shown.hidden).toBe(true);
        fly(ball, MAX_UNCONFIRMED_SECONDS - 0.3);
        expect(shown.hidden).toBe(true);
        fly(ball, 0.5);
        expect(shown.hidden).toBe(false);
        expect(drawnAt().x).toBeGreaterThan(BLOCK_X - CANNON_BALL_RADIUS);
        expect(bursts).toHaveLength(1);
    });

    it("shows the server's burst as well as its own, where the two are far apart", async () => {
        placeBlock(BLOCK_X + 0.25, FLIGHT_Y, 12.25);
        const {ball, tell} = await makeBall({x: BLOCK_X - 1, y: FLIGHT_Y, z: 12.25});
        fly(ball, 0.5);
        expect(bursts).toHaveLength(1);
        const elsewhere = {x: BLOCK_X + 6, y: FLIGHT_Y, z: 14};
        tell(stateOf(elsewhere, EAST, {hitObjectIds: []}));
        expect(bursts).toHaveLength(2);
        expect(dist(bursts[1], elsewhere)).toBeLessThan(PLACE_STEP);
    });
});

describe("a blast that reaches the user's own player", () => {
    const BURST_AT = {x: 10, y: STANDING_Y, z: 10};

    beforeEach(() => {
        Object.assign(me.position, {x: 10.6, y: STANDING_Y, z: 10.3});
        standPlayer(me.playerObjectId, me.position);
        standPlayer("someone-else", {x: 9, y: STANDING_Y, z: 10});
    });

    const carried = (objectId: string) => PhysicsManager.physicsRooms[ROOM_ID].objectById[objectId].carriedVelocity;

    it("throws them as the server throws an agent's: away from the burst and up, and shakes their view in play mode", () => {
        cannonBlastObservable.set({position: BURST_AT, hitObjectIds: ["someone-else", me.playerObjectId]});
        expect(carried(me.playerObjectId)).toEqual(CannonBlastUtil.getThrow(BURST_AT, me.position));
        expect(carried(me.playerObjectId).y).toBeGreaterThan(0);
        expect(carried(me.playerObjectId).x).toBeGreaterThan(0);
        // Nobody else's player is this browser's to move.
        expect(carried("someone-else")).toEqual({x: 0, y: 0, z: 0});
        expect(shakes).toEqual([1]);
    });

    it("throws them in edit mode too, where no view is shaken", () => {
        gameModeObservable.set("edit");
        cannonBlastObservable.set({position: BURST_AT, hitObjectIds: [me.playerObjectId]});
        expect(carried(me.playerObjectId)).toEqual(CannonBlastUtil.getThrow(BURST_AT, me.position));
        expect(shakes).toEqual([]);
    });

    it("leaves them be where the blast reached only others, or nobody", () => {
        cannonBlastObservable.set({position: BURST_AT, hitObjectIds: ["someone-else"]});
        cannonBlastObservable.set({position: BURST_AT, hitObjectIds: []});
        expect(carried(me.playerObjectId)).toEqual({x: 0, y: 0, z: 0});
        expect(shakes).toEqual([]);
    });

    it("adds a second blast's throw to what the first still carries them by", () => {
        cannonBlastObservable.set({position: BURST_AT, hitObjectIds: [me.playerObjectId]});
        cannonBlastObservable.set({position: {x: 10.6, y: STANDING_Y, z: 9.5}, hitObjectIds: [me.playerObjectId]});
        const both = Vector3DUtil.add(CannonBlastUtil.getThrow(BURST_AT, me.position),
            CannonBlastUtil.getThrow({x: 10.6, y: STANDING_Y, z: 9.5}, me.position));
        expect(dist(carried(me.playerObjectId), both)).toBeLessThan(0.000001);
    });
});

describe("a cannon's gauges in a browser", () => {
    const C = CannonCompositionConstants;
    const AT: Vec3 = {x: 16.5, y: 0, z: 16.5};
    const FACING: Vec3 = {x: 0, y: 1, z: 0};
    const pivot = CannonAimUtil.getPivot(AT, FACING);

    // A cannon as the room sends one, with its real parts and what draws them stood in for.
    function makeCannon()
    {
        const params = new AddObjectSignal(ROOM_ID, "", "", ObjectTypeConfigMap.getIndexByType("Cannon"), "a-cannon",
            new ObjectTransform({...AT}, {...FACING}, {...UNIT_VEC3}));
        const state = CannonStateUtil.getObjectState(params);
        const drawn = {parts: CannonCompositionUtil.buildParts(), redraws: 0};
        const cannon = Object.assign(Object.create(CannonGameObject.prototype), {params, components: {},
            obj: new THREE.Object3D(), instancedMeshComposer: {getParts: () => drawn.parts, redrawParts() { ++drawn.redraws; }},
            state, shownAim: CannonStateUtil.getShownAim(state, FACING), turnSoundSecondsLeft: 0}) as CannonGameObject;
        const green = () => drawn.parts.slice(C.firstGaugeIndex + C.numGauges, C.firstGaugeIndex + 2 * C.numGauges)
            .map(part => part.color as Vec3);
        const dark = () => drawn.parts.slice(C.firstGaugeIndex, C.firstGaugeIndex + C.numGauges).map(part => part.color as Vec3);
        return {cannon, drawn, green, dark};
    }

    // The camera a distance from the cannon's pivot, off to one side of it and above.
    function watchFrom(cannon: CannonGameObject, distance: number): void
    {
        const away = Vector3DUtil.normalize({x: 2, y: 1, z: -1});
        GraphicsManager.getCamera().position.set(pivot.x + away.x * distance, pivot.y + away.y * distance, pivot.z + away.z * distance);
        GraphicsManager.getCamera().updateMatrixWorld(true);
        cannon.update(FRAME_MS / 1000);
    }

    // How much of its own color a strip shows, from none (the dark strip's) to all of it.
    function glowOf(color: Vec3): number
    {
        return (color.y - C.gaugeColor.y) / (C.gaugeFillColor.y - C.gaugeColor.y);
    }

    it(`glow in full from within ${GAUGE_DIM_START_DISTANCE} units, dim evenly from there on, and are dimmed out, no more ` +
        `to be told from the dark strips behind them, from ${GAUGE_DIM_END_DISTANCE}`, () => {
        const {cannon, green, dark} = makeCannon();
        for (const distance of [0.5, 0.5 * GAUGE_DIM_START_DISTANCE, GAUGE_DIM_START_DISTANCE])
        {
            watchFrom(cannon, distance);
            for (const color of green())
                expect(color).toEqual(C.gaugeFillColor);
        }
        const span = GAUGE_DIM_END_DISTANCE - GAUGE_DIM_START_DISTANCE;
        let last = 1;
        for (const share of [0.1, 0.25, 0.5, 0.75, 0.9])
        {
            watchFrom(cannon, GAUGE_DIM_START_DISTANCE + share * span);
            for (const color of green())
            {
                // In steps too fine to see, each color between the two in the same measure.
                expect(glowOf(color)).toBeCloseTo(1 - share, 1);
                expect((color.x - C.gaugeColor.x) / (C.gaugeFillColor.x - C.gaugeColor.x)).toBeCloseTo(glowOf(color), 9);
                expect((color.z - C.gaugeColor.z) / (C.gaugeFillColor.z - C.gaugeColor.z)).toBeCloseTo(glowOf(color), 9);
                expect(glowOf(color)).toBeLessThan(last);
            }
            last = glowOf(green()[0]);
        }
        for (const distance of [GAUGE_DIM_END_DISTANCE, 1.5 * GAUGE_DIM_END_DISTANCE, 100])
        {
            watchFrom(cannon, distance);
            for (const color of green())
                expect(color).toEqual(C.gaugeColor);
        }
        // The dark strips are as they were, and it all comes back as the camera does.
        for (const color of dark())
            expect(color).toEqual(C.gaugeColor);
        watchFrom(cannon, 1);
        for (const color of green())
            expect(color).toEqual(C.gaugeFillColor);
    });

    it("are drawn again only as their glow changes, and dimmed again after its parts are made anew", () => {
        const {cannon, drawn, green} = makeCannon();
        watchFrom(cannon, 1);
        expect(drawn.redraws).toBe(0);
        const far = 0.5 * (GAUGE_DIM_START_DISTANCE + GAUGE_DIM_END_DISTANCE);
        watchFrom(cannon, far);
        expect(drawn.redraws).toBe(1);
        // The camera still, or moved less than shows.
        watchFrom(cannon, far);
        watchFrom(cannon, far + 0.001);
        expect(drawn.redraws).toBe(1);

        // Its parts made anew, as a recomposing leaves them: in full glow, until its next frame.
        const dimmed = green()[0];
        drawn.parts = CannonCompositionUtil.buildParts();
        expect(green()[0]).toEqual(C.gaugeFillColor);
        watchFrom(cannon, far);
        expect(green()[0]).toEqual(dimmed);
        expect(drawn.redraws).toBe(2);
    });
});
