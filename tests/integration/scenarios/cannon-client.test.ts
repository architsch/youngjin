/**
 * Scenario tests: cannon balls as a browser shows them (see CannonBallGameObject), flown through a real room's
 * physics with what draws them stood in for — flying by the clock between the server's words, as the server flies
 * them; passing through other balls; bouncing at once off a mirror, an NPC or a cannon, as the server's does, the
 * faster for it, with the server's word of it moving it by nothing, a bounce the server never tells of taken back,
 * and no burst shown meanwhile on what it leads to; each bounce shown once, where the ball then is, as it is made
 * here or as the server's word tells of one made by its ball alone; shown bursting at once on what else stands still,
 * once, with the server's word of it bringing only what the blast did; waiting at a body for that word, and no longer
 * than a moment; taken up again where the server has one that a burst was shown of too soon; and a word that turns
 * one drawn without a jump. And what a blast does to the bodies this browser moves (see CannonBlastThrowUtil), the
 * user's own player among them: thrown as the server throws an agent's, the way the server tells if the ball itself
 * struck them and away from the burst if not, with a shake of the view in play mode alone. And a cannon's counters
 * (see CannonGameObject), whose digits dim as the camera goes farther from it, and turn red and blink when few balls
 * are left.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as THREE from "three";

// The game objects this browser has, by object id: one it moves itself has a Rigidbody.
const me = vi.hoisted(() => ({userID: "me", playerObjectId: "my-player", position: {x: 0, y: 0, z: 0}, roomID: "cannon-room",
    gameObjects: {} as {[objectId: string]: {params: {objectId: string}, position: {x: number, y: number, z: number},
        components: {rigidbody?: object}}}}));
vi.mock("../../../src/client/app", () => ({default: {getUser: () => ({id: me.userID}),
    getCurrentRoom: () => ({id: me.roomID}), getWatchedUserID: () => ""}}));
vi.mock("../../../src/client/object/clientObjectManager", () => ({default: {
    getMyPlayer: () => me.gameObjects[me.playerObjectId], getObjectById: (objectId: string) => me.gameObjects[objectId],
    setObjectTransform() {}}}));
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
import CannonBallGameObject, { MAX_HELD_SECONDS, MAX_UNCONFIRMED_SECONDS, MAX_UNTOLD_BOUNCE_SECONDS }
    from "../../../src/client/object/types/gameObject/cannonBallGameObject";
import CannonGameObject, { COUNTER_BLINK_SECONDS, COUNTER_DIM_END_DISTANCE, COUNTER_DIM_START_DISTANCE,
    COUNTER_WARNING_BALLS } from "../../../src/client/object/types/gameObject/cannonGameObject";
import GraphicsManager from "../../../src/client/graphics/graphicsManager";
import CannonCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/cannonCompositionConstants";
import CannonCompositionUtil from "../../../src/shared/graphics/mesh/composition/util/cannonCompositionUtil";
import CannonAimUtil from "../../../src/shared/object/util/cannonAimUtil";
import CannonStateUtil from "../../../src/shared/object/util/cannonStateUtil";
import "../../../src/client/object/util/cannonBlastThrowUtil";
import { cameraShakeObservable, cannonBallBounceObservable, cannonBallBurstObservable, cannonBlastObservable,
    gameModeObservable } from "../../../src/client/system/clientObservables";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { CANNON_BALL_BOUNCE_BOOST, CANNON_BALL_MAX_SPEED, CANNON_BALL_RADIUS, CANNON_BALL_SPEED }
    from "../../../src/shared/object/types/objectTypeConfig/cannonBallObjectTypeConfig";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import CannonBallStateUtil from "../../../src/shared/object/util/cannonBallStateUtil";
import CannonBlastUtil from "../../../src/shared/object/util/cannonBlastUtil";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import AABB3 from "../../../src/shared/math/types/aabb3";
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
const MIRROR_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Mirror");
const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");
const CANNON_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Cannon");
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
let bounced: {position: Vec3, normal: Vec3}[];
let blasts: {position: Vec3, hitObjectIds: string[], struck?: {objectId: string, heading: number}}[];
let shakes: number[];
let numBalls = 0;

// What the server tells of a ball: flying, having bounced so many times, or burst.
function stateOf(pos: Vec3, vel: Vec3, burst?: {hitObjectIds: string[], struck?: {objectId: string, heading: number}},
    bounces: number = 0): string
{
    return CannonBallStateUtil.encode({pos, vel, exploded: burst != undefined, hitObjectIds: burst?.hitObjectIds ?? [],
        struck: burst?.struck, bounces});
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
        at: kept.pos, vel: kept.vel, bounces: kept.bounces, bouncesShown: kept.bounces,
        drawnOffset: {x: 0, y: 0, z: 0}, heldSeconds: 0, owedSeconds: 0,
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

// Something a ball bounces off, as the room sends it and physics has it: its box.
function stand(objectTypeIndex: number, objectId: string, pos: Vec3, facing: Vec3): AABB3
{
    const params = new AddObjectSignal(ROOM_ID, "", "", objectTypeIndex, objectId,
        new ObjectTransform({...pos}, {...facing}, {...UNIT_VEC3}));
    room.objectGroup.addObject(params);
    const colliderState = PhysicsColliderStateUtil.getObjectColliderState(objectTypeIndex, params.transform)!;
    PhysicsManager.addObject(ROOM_ID, objectId, objectTypeIndex, colliderState);
    return colliderState.hitbox;
}

// A mirror a unit square hanging across the balls' way, facing west, with the place a ball's middle is as it touches
// the mirror's own middle.
function hangMirror(): {box: AABB3, struckAt: Vec3}
{
    const box = stand(MIRROR_TYPE_INDEX, "a-mirror", {x: BLOCK_X, y: FLIGHT_Y, z: 12.5}, {x: -1, y: 0, z: 0});
    return {box, struckAt: {x: box.center.x - box.halfSize.x - CANNON_BALL_RADIUS, y: FLIGHT_Y, z: 12.5}};
}

// How a ball goes on from a bounce off something that stands still, which turns it some way: that way, faster by
// what a bounce adds, never past the most a ball goes.
function boosted(turned: Vec3): Vec3
{
    const speed = Vector3DUtil.length(turned);
    return Vector3DUtil.scale(turned, Math.min(speed + CANNON_BALL_BOUNCE_BOOST, CANNON_BALL_MAX_SPEED) / speed);
}

// How long the clock has run since a moment, in seconds: how long a ball drawn at every frame since has flown.
function secondsSince(start: number): number
{
    return 0.001 * (performance.now() - start);
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
    bounced = [];
    blasts = [];
    shakes = [];
    for (const objectId of Object.keys(me.gameObjects))
        delete me.gameObjects[objectId];
    cannonBallBounceObservable.addListener("test", ({position, normal}) => {
        bounced.push({position: {...position}, normal: {...normal}}); });
    cannonBallBurstObservable.addListener("test", ({position}) => { bursts.push({...position}); });
    cannonBlastObservable.addListener("test", blast => { blasts.push({position: {...blast.position},
        hitObjectIds: [...blast.hitObjectIds], struck: blast.struck}); });
    cameraShakeObservable.addListener("test", strength => { shakes.push(strength); });
    gameModeObservable.set("play");
});

afterEach(() => {
    cannonBallBounceObservable.removeListener("test");
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

        // With whom it threw, and the way it threw the one it struck.
        tell(stateOf({x: touchingX, y: STANDING_Y, z: 12}, EAST, {hitObjectIds: ["another", "someone"],
            struck: {objectId: "someone", heading: 0.75}}));
        expect(bursts).toHaveLength(1);
        expect(blasts.map(blast => blast.hitObjectIds)).toEqual([["another", "someone"]]);
        expect(blasts[0].struck?.objectId).toBe("someone");
        expect(blasts[0].struck?.heading).toBeCloseTo(0.75, 2);
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
        expect(bounced).toEqual([]);

        // Told how each goes after their bounce, each follows.
        const west = boosted({x: -CANNON_BALL_SPEED, y: 0, z: 0});
        a.tell(stateOf({x: 11.2, y: FLIGHT_Y, z: 12}, west, undefined, 1));
        fly([a.ball, b.ball], 1);
        expect(a.drawnAt().x).toBeCloseTo(11.2 + west.x, 1);
    });

    it("shows a bounce that only the server's ball made as its word of it comes, once: where this one is drawn, out " +
        "the way the word turns it", async () => {
        const {ball, tell, drawnAt} = await makeBall({x: 10, y: FLIGHT_Y, z: 12}, EAST);
        fly(ball, 1);
        const drawn = drawnAt();
        // Off something to its south-east, which sends it north, faster.
        const north = boosted({x: 0, y: 0, z: -CANNON_BALL_SPEED});
        const wayOff = Vector3DUtil.normalize(Vector3DUtil.subtract(north, EAST));
        tell(stateOf({x: 13.1, y: FLIGHT_Y, z: 11.9}, north, undefined, 1));
        expect(bounced).toHaveLength(1);
        expect(dist(bounced[0].normal, wayOff)).toBeLessThan(0.001);
        expect(dist(bounced[0].position, drawn)).toBeLessThan(0.000001);

        // Told again of how it goes, having bounced no more, it shows nothing; another bounce, another.
        fly(ball, 0.25);
        tell(stateOf({x: 13.1, y: FLIGHT_Y, z: 10.4}, {...north, x: 0.5}, undefined, 1));
        expect(bounced).toHaveLength(1);
        tell(stateOf({x: 13.1, y: FLIGHT_Y, z: 10.3}, boosted({x: Vector3DUtil.length(north), y: 0, z: 0}), undefined, 2));
        expect(bounced).toHaveLength(2);
        expect(bursts).toEqual([]);
    });

    it("bounces off a mirror the moment it strikes it, as the server's ball does, the faster for it, showing the " +
        "bounce where it then is, and is moved by nothing, and shows none again, when the server's word of that " +
        "comes", async () => {
        const {struckAt} = hangMirror();
        // Let go a second's flight from the mirror's middle, coming at a slant across it and up it.
        const vel = Vector3DUtil.scale(Vector3DUtil.normalize({x: 2, y: 0.2, z: 0.5}), CANNON_BALL_SPEED);
        const after = boosted({x: -vel.x, y: vel.y, z: vel.z});
        expect(Vector3DUtil.length(after)).toBeGreaterThan(CANNON_BALL_SPEED);
        const whereAfter = (seconds: number): Vec3 =>
            Vector3DUtil.add(struckAt, Vector3DUtil.scale((seconds < 1) ? vel : after, seconds - 1));
        const {ball, tell, shown, drawnAt} = await makeBall(whereAfter(0), vel);
        const start = performance.now();
        fly(ball, 0.9);
        expect(bounced).toEqual([]);
        fly(ball, 0.3);
        expect(dist(drawnAt(), whereAfter(secondsSince(start)))).toBeLessThan(PLACE_STEP);
        expect(drawnAt().x).toBeLessThan(struckAt.x - 0.5);
        expect(bursts).toEqual([]);
        expect(shown.hidden).toBe(false);
        // Where its middle was as it touched the glass, with the way the mirror faces.
        expect(bounced).toHaveLength(1);
        expect(dist(bounced[0].position, struckAt)).toBeLessThan(PLACE_STEP);
        expect(dist(bounced[0].normal, {x: -1, y: 0, z: 0})).toBeLessThan(0.000001);

        // The server's word of how its ball goes since, having bounced once.
        tell(stateOf(whereAfter(secondsSince(start)), after, undefined, 1));
        fly(ball, 1 / 60);
        expect(dist(drawnAt(), whereAfter(secondsSince(start)))).toBeLessThan(2 * PLACE_STEP);
        // Long past when a bounce the server never told of would have been taken back, it flies the same way.
        fly(ball, 2 * MAX_UNTOLD_BOUNCE_SECONDS);
        expect(dist(drawnAt(), whereAfter(secondsSince(start)))).toBeLessThan(2 * PLACE_STEP);
        expect(bursts).toEqual([]);
        expect(bounced).toHaveLength(1);
    });

    it("shows a bounce once, though the server's word takes it back to before it and it makes it again", async () => {
        const {struckAt} = hangMirror();
        const {ball, tell} = await makeBall(Vector3DUtil.subtract(struckAt, EAST));
        fly(ball, 1.1);
        expect(bounced).toHaveLength(1);

        // A word of its ball a little short of the mirror still, turned a little by the air, which is no bounce.
        const turned = {x: CANNON_BALL_SPEED, y: 0.1, z: 0};
        tell(stateOf(Vector3DUtil.subtract(struckAt, Vector3DUtil.scale(turned, 0.1)), turned));
        fly(ball, 0.3);
        expect(ball.obj.position.x).toBeLessThan(struckAt.x - 0.3);
        expect(bounced).toHaveLength(1);
        const back = boosted({x: -turned.x, y: turned.y, z: turned.z});
        tell(stateOf(Vector3DUtil.add(struckAt, Vector3DUtil.scale(back, 0.2)), back, undefined, 1));
        fly(ball, 0.5);
        expect(bounced).toHaveLength(1);
    });

    it("bounces off an NPC as off a round body, off its side where it strikes it, the faster for it, as the server's " +
        "ball does", async () => {
        const box = stand(NPC_TYPE_INDEX, "an-npc", {x: BLOCK_X, y: 0, z: 12}, {x: 0, y: 1, z: 0});
        const reach = box.halfSize.x + CANNON_BALL_RADIUS;
        // Past its middle line by some way.
        const aside = 0.3;
        const struckAt = {x: box.center.x - Math.sqrt(reach * reach - aside * aside), y: STANDING_Y, z: box.center.z + aside};
        const wayOut = Vector3DUtil.normalize({x: struckAt.x - box.center.x, y: 0, z: aside});
        const after = boosted(Vector3DUtil.subtract(EAST, Vector3DUtil.scale(wayOut, 2 * Vector3DUtil.dot(EAST, wayOut))));
        const {ball, shown, drawnAt} = await makeBall(Vector3DUtil.subtract(struckAt, EAST));
        const start = performance.now();
        fly(ball, 1.3);
        // (As near as its place and its speed were told to begin with.)
        expect(dist(drawnAt(), Vector3DUtil.add(struckAt, Vector3DUtil.scale(after, secondsSince(start) - 1))))
            .toBeLessThan(PLACE_STEP);
        expect(after.x).toBeLessThan(0);
        expect(after.z).toBeGreaterThan(0);
        expect(bursts).toEqual([]);
        expect(shown.hidden).toBe(false);
        // The bounce is shown where its middle was as it touched its side, with the way out of it.
        expect(bounced).toHaveLength(1);
        expect(dist(bounced[0].position, struckAt)).toBeLessThan(2 * PLACE_STEP);
        expect(dist(bounced[0].normal, wayOut)).toBeLessThan(0.05);
    });

    it("bounces off a cannon as off the box it is, off the side it strikes, the faster for it, as the server's ball " +
        "does, and shows no burst", async () => {
        const box = stand(CANNON_TYPE_INDEX, "a-cannon", {x: BLOCK_X, y: 0, z: 12}, {x: 0, y: 1, z: 0});
        // Low on its west side, from a second's flight away, coming at a slant across it and up it.
        const struckAt = {x: box.center.x - box.halfSize.x - CANNON_BALL_RADIUS, y: box.center.y + 0.3, z: box.center.z};
        const vel = Vector3DUtil.scale(Vector3DUtil.normalize({x: 2, y: 0.2, z: 0.5}), CANNON_BALL_SPEED);
        const after = boosted({x: -vel.x, y: vel.y, z: vel.z});
        const {ball, shown, drawnAt} = await makeBall(Vector3DUtil.subtract(struckAt, vel), vel);
        const start = performance.now();
        fly(ball, 1.3);
        expect(dist(drawnAt(), Vector3DUtil.add(struckAt, Vector3DUtil.scale(after, secondsSince(start) - 1))))
            .toBeLessThan(PLACE_STEP);
        expect(bursts).toEqual([]);
        expect(shown.hidden).toBe(false);
        // Where its middle was as it touched that side, with the way out of it there.
        expect(bounced).toHaveLength(1);
        expect(dist(bounced[0].position, struckAt)).toBeLessThan(PLACE_STEP);
        expect(dist(bounced[0].normal, {x: -1, y: 0, z: 0})).toBeLessThan(0.000001);
    });

    it("shows the next bounce it makes after one it took back, which counts for nothing, and the one after that", async () => {
        const box = stand(NPC_TYPE_INDEX, "an-npc", {x: BLOCK_X - 2, y: 0, z: 12}, {x: 0, y: 1, z: 0});
        const mirror = stand(MIRROR_TYPE_INDEX, "a-mirror", {x: BLOCK_X, y: STANDING_Y, z: 12}, {x: -1, y: 0, z: 0});
        const struckAt = {x: box.center.x - box.halfSize.x - CANNON_BALL_RADIUS, y: STANDING_Y, z: 12};
        const mirrorStruckAt = {...struckAt, x: mirror.center.x - mirror.halfSize.x - CANNON_BALL_RADIUS};
        const from = Vector3DUtil.subtract(struckAt, EAST);
        const west = boosted({x: -CANNON_BALL_SPEED, y: 0, z: 0});
        // Another NPC behind where it sets off, in its way back from the mirror: farther than it gets back off the
        // first before that bounce is taken back.
        const farBox = stand(NPC_TYPE_INDEX, "a-far-npc", {x: struckAt.x + 1.5 * west.x * MAX_UNTOLD_BOUNCE_SECONDS, y: 0, z: 12},
            {x: 0, y: 1, z: 0});
        const farStruckAt = {...struckAt, x: farBox.center.x + farBox.halfSize.x + CANNON_BALL_RADIUS};
        const {ball, tell, drawnAt} = await makeBall(from);
        fly(ball, 1 + 0.5 * MAX_UNTOLD_BOUNCE_SECONDS);
        expect(bounced).toHaveLength(1);

        // Through the NPC after all, as if it had never turned, and off the mirror past it a moment ago.
        const untilMirror = (mirrorStruckAt.x - struckAt.x) / CANNON_BALL_SPEED;
        expect(untilMirror).toBeGreaterThan(MAX_UNTOLD_BOUNCE_SECONDS);
        fly(ball, untilMirror - 0.5 * MAX_UNTOLD_BOUNCE_SECONDS + 0.1);
        expect(bounced).toHaveLength(2);
        expect(dist(bounced[1].position, mirrorStruckAt)).toBeLessThan(2 * PLACE_STEP);
        expect(drawnAt().x).toBeLessThan(mirrorStruckAt.x);
        expect(drawnAt().x).toBeGreaterThan(box.center.x + box.halfSize.x);

        // The server's word of that one, its ball's first: and off the far NPC, its second, shown as well.
        tell(stateOf(Vector3DUtil.add(mirrorStruckAt, Vector3DUtil.scale(west, 0.1)), west, undefined, 1));
        expect(bounced).toHaveLength(2);
        fly(ball, (mirrorStruckAt.x - farStruckAt.x) / -west.x);
        expect(bounced).toHaveLength(3);
        expect(dist(bounced[2].position, farStruckAt)).toBeLessThan(2 * PLACE_STEP);
    });

    it("shows a bounce the server's word tells of after one it took back, which counts for nothing", async () => {
        const box = stand(NPC_TYPE_INDEX, "an-npc", {x: BLOCK_X, y: 0, z: 12}, {x: 0, y: 1, z: 0});
        const struckAt = {x: box.center.x - box.halfSize.x - CANNON_BALL_RADIUS, y: STANDING_Y, z: 12};
        const {ball, tell} = await makeBall(Vector3DUtil.subtract(struckAt, EAST));
        fly(ball, 1 + MAX_UNTOLD_BOUNCE_SECONDS + 0.2);
        expect(bounced).toHaveLength(1);

        // Its ball's first bounce, off something this one never met.
        tell(stateOf({x: box.center.x + 1, y: STANDING_Y, z: 12}, boosted({x: 0, y: 0, z: CANNON_BALL_SPEED}), undefined, 1));
        expect(bounced).toHaveLength(2);
    });

    it(`takes back a bounce the server hasn't told of in ${MAX_UNTOLD_BOUNCE_SECONDS} seconds, and is soon where the ` +
        "server's ball is, which flew straight on past what this one bounced off", async () => {
        const box = stand(NPC_TYPE_INDEX, "an-npc", {x: BLOCK_X, y: 0, z: 12}, {x: 0, y: 1, z: 0});
        const struckAt = {x: box.center.x - box.halfSize.x - CANNON_BALL_RADIUS, y: STANDING_Y, z: 12};
        const from = Vector3DUtil.subtract(struckAt, EAST);
        const {ball, shown, drawnAt} = await makeBall(from);
        const start = performance.now();
        // Back off it the way it came, faster, for nearly as long as the server's word may take.
        fly(ball, 1 + MAX_UNTOLD_BOUNCE_SECONDS - 0.1);
        const back = boosted({x: -CANNON_BALL_SPEED, y: 0, z: 0});
        expect(Math.abs(drawnAt().x - (struckAt.x + back.x * (secondsSince(start) - 1)))).toBeLessThan(PLACE_STEP);

        // No word of it: it never bounced.
        fly(ball, 1.1);
        expect(dist(drawnAt(), Vector3DUtil.add(from, Vector3DUtil.scale(EAST, secondsSince(start))))).toBeLessThan(PLACE_STEP);
        expect(drawnAt().x).toBeGreaterThan(box.center.x + box.halfSize.x);
        expect(bursts).toEqual([]);
        expect(shown.hidden).toBe(false);
    });

    it("passes what it bounced off for nothing, even where taking the bounce back leaves it short of that", async () => {
        const box = stand(NPC_TYPE_INDEX, "an-npc", {x: BLOCK_X, y: 0, z: 12}, {x: 0, y: 1, z: 0});
        const struckAt = {x: box.center.x - box.halfSize.x - CANNON_BALL_RADIUS, y: STANDING_Y, z: 12};
        // Slowed by some wind to where it gets no farther in that while than into the NPC.
        const slow = {x: 1, y: 0, z: 0};
        expect(slow.x * MAX_UNTOLD_BOUNCE_SECONDS).toBeLessThan(box.halfSize.x + CANNON_BALL_RADIUS);
        const from = Vector3DUtil.subtract(struckAt, slow);
        const {ball, drawnAt} = await makeBall(from, slow);
        const start = performance.now();
        // Taken back to inside the NPC, short of its middle line, it flies on through, never off it again.
        fly(ball, 1 + MAX_UNTOLD_BOUNCE_SECONDS + 0.3);
        expect(drawnAt().x).toBeGreaterThan(box.center.x);
        fly(ball, 2);
        expect(dist(drawnAt(), Vector3DUtil.add(from, Vector3DUtil.scale(slow, secondsSince(start))))).toBeLessThan(PLACE_STEP);
        expect(drawnAt().x).toBeGreaterThan(box.center.x + box.halfSize.x);
    });

    it("takes back the first of several bounces the server told of none of, and all that followed from it", async () => {
        const {struckAt} = hangMirror();
        const vel = Vector3DUtil.scale(Vector3DUtil.normalize({x: 1, y: 0, z: 1}), CANNON_BALL_SPEED);
        const after = boosted({x: -vel.x, y: 0, z: vel.z});
        // An NPC right in the way the mirror sends it, a moment's flight on, which sends it straight back.
        const flightBetween = 0.15;
        const npcRadius = PhysicsColliderStateUtil.getObjectColliderState(NPC_TYPE_INDEX, new ObjectTransform(
            {x: 0, y: 0, z: 0}, {x: 0, y: 1, z: 0}, {...UNIT_VEC3}))!.hitbox.halfSize.x;
        const npcAt = Vector3DUtil.add(struckAt, Vector3DUtil.scale(Vector3DUtil.normalize(after),
            Vector3DUtil.length(after) * flightBetween + npcRadius + CANNON_BALL_RADIUS));
        stand(NPC_TYPE_INDEX, "an-npc", {x: npcAt.x, y: 0, z: npcAt.z}, {x: 0, y: 1, z: 0});
        const from = Vector3DUtil.subtract(struckAt, vel);
        const {ball, shown, drawnAt} = await makeBall(from, vel);
        const start = performance.now();
        fly(ball, 1 + 1.5 * flightBetween);
        // Off the mirror, off the NPC, and on its way back to the mirror.
        expect(drawnAt().x).toBeGreaterThan(struckAt.x + after.x * flightBetween);
        expect(drawnAt().x).toBeLessThan(struckAt.x - 0.05);
        expect(drawnAt().z).toBeGreaterThan(struckAt.z + 0.05);

        fly(ball, MAX_UNTOLD_BOUNCE_SECONDS + 1);
        expect(dist(drawnAt(), Vector3DUtil.add(from, Vector3DUtil.scale(vel, secondsSince(start))))).toBeLessThan(PLACE_STEP);
        expect(bursts).toEqual([]);
        expect(shown.hidden).toBe(false);
    });

    it("shows no burst on what a bounce the server has yet to tell of leads it to: it waits there, and bursts once " +
        "the server's word of the bounce has come", async () => {
        const {struckAt} = hangMirror();
        const vel = Vector3DUtil.scale(Vector3DUtil.normalize({x: 1, y: 0, z: 1}), CANNON_BALL_SPEED);
        const after = boosted({x: -vel.x, y: 0, z: vel.z});
        // A block a little way on from the mirror, the way it sends the ball: its south side a quarter unit short of
        // where the ball's middle then is.
        placeBlock(struckAt.x - 0.5, FLIGHT_Y + 0.25, struckAt.z + 0.75);
        const heldAt = Vector3DUtil.add(struckAt, Vector3DUtil.scale(after, (0.5 - CANNON_BALL_RADIUS) / after.z));
        const {ball, tell, shown, drawnAt} = await makeBall(Vector3DUtil.subtract(struckAt, vel), vel);
        fly(ball, 1 + 0.6 * MAX_UNTOLD_BOUNCE_SECONDS);
        expect(dist(drawnAt(), heldAt)).toBeLessThan(0.01);
        expect(bursts).toEqual([]);
        expect(shown.hidden).toBe(false);

        // The server's word of the bounce, as its ball was a moment after it, short of the block still.
        tell(stateOf(Vector3DUtil.add(struckAt, Vector3DUtil.scale(Vector3DUtil.normalize(after), 0.15)), after, undefined, 1));
        fly(ball, 0.2);
        expect(bursts).toHaveLength(1);
        expect(dist(bursts[0], heldAt)).toBeLessThan(2 * PLACE_STEP);
        expect(shown.hidden).toBe(true);
        expect(bounced).toHaveLength(1);
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
        // A turn that came of no bounce shows none.
        expect(bounced).toEqual([]);
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
    const ELSEWHERE = {x: 9, y: STANDING_Y, z: 10};

    // The user's own player is this browser's to move; someone else's is only drawn here.
    beforeEach(() => {
        Object.assign(me.position, {x: 10.6, y: STANDING_Y, z: 10.3});
        standPlayer(me.playerObjectId, me.position);
        standPlayer("someone-else", ELSEWHERE);
        me.gameObjects[me.playerObjectId] = {params: {objectId: me.playerObjectId}, position: me.position,
            components: {rigidbody: {}}};
        me.gameObjects["someone-else"] = {params: {objectId: "someone-else"}, position: ELSEWHERE, components: {}};
    });

    const carried = (objectId: string) => PhysicsManager.physicsRooms[ROOM_ID].objectById[objectId].carriedVelocity;
    // The throw of someone the blast reached without the ball striking them: away from the burst, from where they are.
    const throwFrom = (burstAt: Vec3) => CannonBlastUtil.getThrow(CannonBlastUtil.getHeading(burstAt, me.position));

    it("throws them as the server throws an agent's: away from the burst and up, and shakes their view in play mode", () => {
        cannonBlastObservable.set({position: BURST_AT, hitObjectIds: ["someone-else", me.playerObjectId]});
        expect(carried(me.playerObjectId)).toEqual(throwFrom(BURST_AT));
        expect(carried(me.playerObjectId).y).toBeGreaterThan(0);
        expect(carried(me.playerObjectId).x).toBeGreaterThan(0);
        expect(carried(me.playerObjectId).z).toBeGreaterThan(0);
        // Nobody else's player is this browser's to move.
        expect(carried("someone-else")).toEqual({x: 0, y: 0, z: 0});
        expect(shakes).toEqual([1]);
    });

    it("throws them the way the server says the ball met them, if it was them it struck, wherever they have got to " +
        "since", () => {
        // Struck from the east, as the server had them: thrown west, though by now they are east of where it burst.
        const heading = Math.PI - 0.2;
        cannonBlastObservable.set({position: BURST_AT, hitObjectIds: [me.playerObjectId],
            struck: {objectId: me.playerObjectId, heading}});
        expect(carried(me.playerObjectId)).toEqual(CannonBlastUtil.getThrow(heading));
        expect(carried(me.playerObjectId).x).toBeLessThan(0);
        expect(throwFrom(BURST_AT).x).toBeGreaterThan(0);
        expect(shakes).toEqual([1]);
    });

    it("throws them away from the burst, from where they are, if it was someone else the ball struck", () => {
        cannonBlastObservable.set({position: BURST_AT, hitObjectIds: ["someone-else", me.playerObjectId],
            struck: {objectId: "someone-else", heading: Math.PI - 0.2}});
        expect(carried(me.playerObjectId)).toEqual(throwFrom(BURST_AT));
        expect(carried("someone-else")).toEqual({x: 0, y: 0, z: 0});
    });

    it("throws them in edit mode too, where no view is shaken", () => {
        gameModeObservable.set("edit");
        cannonBlastObservable.set({position: BURST_AT, hitObjectIds: [me.playerObjectId]});
        expect(carried(me.playerObjectId)).toEqual(throwFrom(BURST_AT));
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
        const both = Vector3DUtil.add(throwFrom(BURST_AT), throwFrom({x: 10.6, y: STANDING_Y, z: 9.5}));
        expect(dist(carried(me.playerObjectId), both)).toBeLessThan(0.000001);
    });

    it("throws any other body this browser moves the same way, each from where it is, and shakes the view for the " +
        "user's own player alone", () => {
        // (With a player's collider, the one type there is with a Rigidbody.)
        const bodyAt = {x: 9.5, y: STANDING_Y, z: 9.2};
        standPlayer("another-body", bodyAt);
        me.gameObjects["another-body"] = {params: {objectId: "another-body"}, position: bodyAt, components: {rigidbody: {}}};
        cannonBlastObservable.set({position: BURST_AT, hitObjectIds: ["another-body"]});
        const thrown = CannonBlastUtil.getThrow(CannonBlastUtil.getHeading(BURST_AT, bodyAt));
        expect(carried("another-body")).toEqual(thrown);
        expect(thrown.y).toBe(throwFrom(BURST_AT).y);
        expect(Math.hypot(thrown.x, thrown.z)).toBeCloseTo(Math.hypot(throwFrom(BURST_AT).x, throwFrom(BURST_AT).z), 9);
        expect(carried(me.playerObjectId)).toEqual({x: 0, y: 0, z: 0});
        expect(shakes).toEqual([]);

        // Struck by the ball itself, it goes the way the server says, beside the user's player, which goes its own.
        const heading = -0.4;
        cannonBlastObservable.set({position: BURST_AT, hitObjectIds: [me.playerObjectId, "another-body", "someone-else"],
            struck: {objectId: "another-body", heading}});
        expect(dist(carried("another-body"), Vector3DUtil.add(thrown, CannonBlastUtil.getThrow(heading)))).toBeLessThan(0.000001);
        expect(carried(me.playerObjectId)).toEqual(throwFrom(BURST_AT));
        expect(carried("someone-else")).toEqual({x: 0, y: 0, z: 0});
        expect(shakes).toEqual([1]);
    });
});

describe("a cannon's counters in a browser", () => {
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
            state, shownAim: CannonStateUtil.getShownAim(state, FACING), turnSoundSecondsLeft: 0,
            warningSeconds: 0}) as CannonGameObject;
        const digits = () => drawn.parts.slice(C.firstSegmentIndex).map(part => part.color as Vec3);
        const panels = () => drawn.parts.slice(C.firstCounterIndex, C.firstSegmentIndex).map(part => part.color as Vec3);
        // As the server tells of it: the balls it has left now.
        const tellBallsLeft = (ballsLeft: number) => {
            const value = CannonStateUtil.encode({...CannonStateUtil.getObjectState(params), ballsLeft});
            params.metadata[ObjectMetadataKeyEnumMap.CannonState] = new EncodableByteString(value);
            cannon.onSetMetadata(ObjectMetadataKeyEnumMap.CannonState, value);
        };
        return {cannon, drawn, digits, panels, tellBallsLeft};
    }

    // Which segments the counters light, and how, for a number of balls, as any cannon composes them.
    function segmentsShowing(ballsLeft: number): Vec3[]
    {
        const parts = CannonCompositionUtil.buildParts();
        CannonCompositionUtil.pose(parts, FACING, {x: 0, y: 0, z: 1}, ballsLeft);
        return parts.slice(C.firstSegmentIndex).map(part => part.scale);
    }

    // The camera a distance from the cannon's pivot, off to one side of it and above.
    function placeCamera(distance: number): void
    {
        const away = Vector3DUtil.normalize({x: 2, y: 1, z: -1});
        GraphicsManager.getCamera().position.set(pivot.x + away.x * distance, pivot.y + away.y * distance, pivot.z + away.z * distance);
        GraphicsManager.getCamera().updateMatrixWorld(true);
    }

    function watchFrom(cannon: CannonGameObject, distance: number): void
    {
        placeCamera(distance);
        cannon.update(FRAME_MS / 1000);
    }

    // How much of its own color a digit shows, from none (the black behind it) to all of it.
    function glowOf(color: Vec3): number
    {
        return (color.y - C.counterColor.y) / (C.digitColor.y - C.counterColor.y);
    }

    it(`glow in full from within ${COUNTER_DIM_START_DISTANCE} units, dim evenly from there on, and are dimmed out, no ` +
        `more to be told from the black behind them, from ${COUNTER_DIM_END_DISTANCE}`, () => {
        const {cannon, digits, panels} = makeCannon();
        for (const distance of [0.5, 0.5 * COUNTER_DIM_START_DISTANCE, COUNTER_DIM_START_DISTANCE])
        {
            watchFrom(cannon, distance);
            for (const color of digits())
                expect(color).toEqual(C.digitColor);
        }
        const span = COUNTER_DIM_END_DISTANCE - COUNTER_DIM_START_DISTANCE;
        let last = 1;
        for (const share of [0.1, 0.25, 0.5, 0.75, 0.9])
        {
            watchFrom(cannon, COUNTER_DIM_START_DISTANCE + share * span);
            for (const color of digits())
            {
                // In steps too fine to see, each color between the two in the same measure.
                expect(glowOf(color)).toBeCloseTo(1 - share, 1);
                expect((color.x - C.counterColor.x) / (C.digitColor.x - C.counterColor.x)).toBeCloseTo(glowOf(color), 9);
                expect((color.z - C.counterColor.z) / (C.digitColor.z - C.counterColor.z)).toBeCloseTo(glowOf(color), 9);
                expect(glowOf(color)).toBeLessThan(last);
            }
            last = glowOf(digits()[0]);
        }
        for (const distance of [COUNTER_DIM_END_DISTANCE, 1.5 * COUNTER_DIM_END_DISTANCE, 100])
        {
            watchFrom(cannon, distance);
            for (const color of digits())
                expect(color).toEqual(C.counterColor);
        }
        // The panels are as black as they were, and it all comes back as the camera does.
        for (const color of panels())
            expect(color).toEqual(C.counterColor);
        watchFrom(cannon, 1);
        for (const color of digits())
            expect(color).toEqual(C.digitColor);
    });

    it("are drawn again only as their glow changes, and dimmed again after its parts are made anew", () => {
        const {cannon, drawn, digits} = makeCannon();
        watchFrom(cannon, 1);
        expect(drawn.redraws).toBe(0);
        const far = 0.5 * (COUNTER_DIM_START_DISTANCE + COUNTER_DIM_END_DISTANCE);
        watchFrom(cannon, far);
        expect(drawn.redraws).toBe(1);
        // The camera still, or moved less than shows.
        watchFrom(cannon, far);
        watchFrom(cannon, far + 0.001);
        expect(drawn.redraws).toBe(1);

        // Its parts made anew, as a recomposing leaves them: in full glow, until its next frame.
        const dimmed = digits()[0];
        drawn.parts = CannonCompositionUtil.buildParts();
        expect(digits()[0]).toEqual(C.digitColor);
        watchFrom(cannon, far);
        expect(digits()[0]).toEqual(dimmed);
        expect(drawn.redraws).toBe(2);
    });

    it(`show each ball fired, steady green above ${COUNTER_WARNING_BALLS} left, and red from then on, blinking from ` +
        `the shot that left so few, lit for the first half of every ${COUNTER_BLINK_SECONDS} seconds, and dimmed with ` +
        "distance as the green is", () => {
        const {cannon, drawn, digits, tellBallsLeft} = makeCannon();
        const blink = COUNTER_BLINK_SECONDS;
        const look = () => digits().every(color => Vector3DUtil.equal(color, C.digitWarningColor)) ? "red"
            : digits().every(color => Vector3DUtil.equal(color, C.digitColor)) ? "green"
            : digits().every(color => Vector3DUtil.equal(color, C.counterColor)) ? "dark" : "mixed";
        // To 0.1, 0.4, 0.6, 0.9, 1.1, 1.4 and 1.6 blinks.
        const steps = [0.1, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2];
        const watch = () => steps.map(share => { cannon.update(share * blink); return look(); });
        watchFrom(cannon, 1);

        tellBallsLeft(COUNTER_WARNING_BALLS + 1);
        expect(drawn.parts.slice(C.firstSegmentIndex).map(part => part.scale))
            .toEqual(segmentsShowing(COUNTER_WARNING_BALLS + 1));
        expect(watch()).toEqual(Array(steps.length).fill("green"));

        tellBallsLeft(COUNTER_WARNING_BALLS);
        expect(drawn.parts.slice(C.firstSegmentIndex).map(part => part.scale))
            .toEqual(segmentsShowing(COUNTER_WARNING_BALLS));
        expect(watch()).toEqual(["red", "red", "dark", "dark", "red", "red", "dark"]);

        // Drawn again only as it blinks: four times in two blinks.
        const redraws = drawn.redraws;
        for (let frame = 0; frame < Math.round(2 * blink * 1000 / FRAME_MS); ++frame)
            cannon.update(FRAME_MS / 1000);
        expect(drawn.redraws - redraws).toBe(4);

        // Lit (at 4.2 blinks) halfway through the dimming, and dimmed out past it.
        const span = COUNTER_DIM_END_DISTANCE - COUNTER_DIM_START_DISTANCE;
        placeCamera(COUNTER_DIM_START_DISTANCE + 0.5 * span);
        cannon.update(0.6 * blink);
        for (const color of digits())
        {
            expect(color).toEqual({x: (C.counterColor.x + C.digitWarningColor.x) / 2,
                y: (C.counterColor.y + C.digitWarningColor.y) / 2, z: (C.counterColor.z + C.digitWarningColor.z) / 2});
        }
        watchFrom(cannon, COUNTER_DIM_END_DISTANCE);
        expect(look()).toBe("dark");

        // Its last ball, and none: the blink goes on as it was, with no break.
        watchFrom(cannon, 1);
        tellBallsLeft(1);
        tellBallsLeft(0);
        expect(drawn.parts.slice(C.firstSegmentIndex).map(part => part.scale)).toEqual(segmentsShowing(0));
        cannon.update(FRAME_MS / 1000);
        expect(look()).toBe("red");
    });
});
