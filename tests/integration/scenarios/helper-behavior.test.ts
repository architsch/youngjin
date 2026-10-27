/**
 * Integration tests: how a helper wanders and chats wherever it is played (HelperBehaviorUtil), driven directly over a
 * grid built for each case, with whoever plays it stood in for: where it wanders to (only where it can walk to, on the
 * floor of home unless it may climb), home after each place or on from place to place, how long it idles between, what
 * it does when kept from where it is going, how it passes other helpers, two helpers chatting in turn, where it goes to
 * look at something, and when, and how it stands waiting on someone typing it a line.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import HelperBehaviorUtil from "../../../src/shared/object/util/helperBehaviorUtil";
import BehaviorPrefsUtil from "../../../src/shared/object/util/behaviorPrefsUtil";
import BehaviorPrefs from "../../../src/shared/object/types/behaviorPrefs";
import HelperBehavior from "../../../src/shared/object/types/helperBehavior";
import HelperSurroundings from "../../../src/shared/object/types/helperSurroundings";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { PLAYER_HEIGHT,
    PLAYER_RADIUS_XZ } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import Voxel from "../../../src/shared/voxel/types/voxel";
import VoxelPathUtil from "../../../src/shared/voxel/util/voxelPathUtil";
import NpcFacingUtil from "../../../src/shared/object/util/npcFacingUtil";
import Vec3 from "../../../src/shared/math/types/vec3";
import { NUM_VOXEL_COLS } from "../../../src/shared/system/sharedConstants";

const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");

// A room with nothing in it: every voxel open, the room's own floor under all of them.
function openGrid(): Voxel[]
{
    const voxels = VoxelGrid.createBaseGrid().voxels;
    for (const voxel of voxels)
        voxel.blockLayerMask = 0;
    return voxels;
}

function fill(voxels: Voxel[], rows: [number, number], cols: [number, number], layers: [number, number]): void
{
    for (let row = rows[0]; row <= rows[1]; ++row)
        for (let col = cols[0]; col <= cols[1]; ++col)
            for (let layer = layers[0]; layer <= layers[1]; ++layer)
                voxels[row * NUM_VOXEL_COLS + col].blockLayerMask |= 1 << layer;
}

// Two platforms two units high (four layers) in an open room, each with stairs of one-block steps up its west side and a
// sheer drop everywhere else, the ground between them: home is on top of the first (x up to 22.5), at (20, 2, 16), and
// the second (x from 27) is as high, but there is no way to it but down to the ground and up again.
const PLATFORM_HOME: Vec3 = {x: 20, y: 2, z: 16};
const FIRST_PLATFORM_EAST_EDGE = 22.5;
function platformGrid(): Voxel[]
{
    const voxels = openGrid();
    for (const [westCol, eastCol] of [[20, 44], [54, 62]])
    {
        fill(voxels, [20, 44], [westCol, eastCol], [0, 3]);
        for (let step = 1; step <= 3; ++step)
            fill(voxels, [30, 33], [westCol - 8 + 2 * step, westCol - 7 + 2 * step], [0, step - 1]);
    }
    return voxels;
}

// An NPC an admin stood there, with these settings (the rest the defaults).
function npcAt(home: Vec3, prefs: Partial<BehaviorPrefs>): AddObjectSignal
{
    return new AddObjectSignal("room", "admin", "Admin", NPC_TYPE_INDEX, `npc-${home.x}-${home.z}`,
        new ObjectTransform({...home}, {x: 0, y: 1, z: 0}, {x: 1, y: 1, z: 1}),
        {[ObjectMetadataKeyEnumMap.BehaviorPrefs]: new EncodableByteString(
            BehaviorPrefsUtil.encode({...BehaviorPrefsUtil.decode(""), ...prefs}))});
}

// A helper as that NPC would be played.
function helperAt(home: Vec3, prefs: Partial<BehaviorPrefs>, now: number = 0): HelperBehavior
{
    return HelperBehaviorUtil.create(npcAt(home, prefs), now);
}

// Where it is played: these blocks, people standing at these floor points (a player's position is its middle), other
// helpers, and things placed there.
function around(voxels: Voxel[], peopleFeet: Vec3[] = [], others: HelperBehavior[] = [],
    objects: AddObjectSignal[] = []): HelperSurroundings
{
    const people = () => peopleFeet.map(feet => ({x: feet.x, y: feet.y + 0.5 * PLAYER_HEIGHT, z: feet.z}));
    return {voxels, objectById: Object.fromEntries(objects.map(obj => [obj.objectId, obj])), getPeople: people,
        getPerson: () => undefined, getOtherHelpers: () => others, hasLinesWaiting: () => false, isHeld: () => false,
        showAt: () => {}, showFacing: () => {}, showSaying: () => {}, showThinking: () => {}};
}

// A corridor running east and west from x = 10 to x = 22.5, as many voxels wide as given (from row 31 on), walled in
// north and south of it, the open floor beyond either end; the z of each row of vertices a body stands on in it.
function corridorGrid(width: number): {voxels: Voxel[], lanes: number[]}
{
    const voxels = openGrid();
    fill(voxels, [0, 30], [20, 44], [0, 7]);
    fill(voxels, [31 + width, 63], [20, 44], [0, 7]);
    return {voxels, lanes: Array.from({length: width - 1}, (_, i) => 16 + 0.5 * i)};
}

// Seconds of several helpers' lives together, each with the others about it, as whoever plays them gives them (see
// live), the places each stood at after each flush seen; the moment after them.
function liveTogether(helpers: HelperBehavior[], voxels: Voxel[], from: number, seconds: number,
    seen: Vec3[][] = helpers.map(() => [])): number
{
    const surroundings = helpers.map(helper => around(voxels, [], helpers.filter(other => other !== helper)));
    let now = from;
    for (let i = 0; i < seconds; ++i)
    {
        for (let flush = 0; flush < 5; ++flush)
        {
            now += 200;
            helpers.forEach((helper, j) => {
                HelperBehaviorUtil.act(helper, surroundings[j], 0.2, now);
                seen[j].push({...helper.at});
            });
        }
        helpers.forEach((helper, j) => HelperBehaviorUtil.beat(helper, surroundings[j], now, false));
    }
    return now;
}

// A helper away from home, which it heads back to at once.
function headingHome(home: Vec3, at: Vec3, prefs: Partial<BehaviorPrefs> = {}): HelperBehavior
{
    const helper = helperAt(home, prefs);
    helper.at = {...at};
    helper.returnHomeAt = 0;
    return helper;
}

// Seconds of its life from a moment on, as whoever plays it gives them (a beat each second, flushes between), each place
// it stood at after a flush seen; the moment after them.
function live(helper: HelperBehavior, surroundings: HelperSurroundings, from: number, seconds: number,
    seen: Vec3[] = []): number
{
    let now = from;
    for (let i = 0; i < seconds; ++i)
    {
        for (let flush = 0; flush < 5; ++flush)
        {
            now += 200;
            HelperBehaviorUtil.act(helper, surroundings, 0.2, now);
            seen.push({...helper.at});
        }
        HelperBehaviorUtil.beat(helper, surroundings, now, false);
    }
    return now;
}

// Sets it off wandering from where it stands, as a beat does once it is time: where it is going.
function wanderNow(helper: HelperBehavior, surroundings: HelperSurroundings, now: number): Vec3 | undefined
{
    helper.path = [];
    helper.nextWanderAt = now;
    HelperBehaviorUtil.beat(helper, surroundings, now, false);
    return helper.path[helper.path.length - 1];
}

// Steps it until it stands blocked on its way, as flushes do: the moment it was first.
function stepUntilBlocked(helper: HelperBehavior, surroundings: HelperSurroundings, from: number): number
{
    let now = from;
    while (helper.blockedSince == undefined && now - from < 10_000)
    {
        now += 200;
        HelperBehaviorUtil.act(helper, surroundings, 0.2, now);
    }
    expect(helper.blockedSince).toBeDefined();
    return now;
}

// A random sequence the same every run.
function seedRandom(seed: number): void
{
    let state = seed;
    vi.spyOn(Math, "random").mockImplementation(() => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    });
}

function across(a: Vec3, b: Vec3): number
{
    return Math.hypot(a.x - b.x, a.z - b.z);
}

function isStandable(voxels: Voxel[], feet: Vec3): boolean
{
    const vertex = VoxelPathUtil.toVertex(feet);
    return vertex != undefined && VoxelPathUtil.isStandable(voxels, vertex);
}

describe("how a helper wanders", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("wanders only to where it can walk, never into mid-air, on the floor of home unless it may climb", () => {
        seedRandom(7);
        const voxels = platformGrid();
        const surroundings = around(voxels);
        for (const canClimb of [false, true])
        {
            const helper = helperAt(PLATFORM_HOME, {wanderRadius: 10, canClimb});
            const goals: Vec3[] = [];
            for (let pick = 0; pick < 25; ++pick)
            {
                helper.at = {...PLATFORM_HOME};
                const goal = wanderNow(helper, surroundings, 1000 * pick)!;
                expect(goal, `pick ${pick}`).toBeDefined();
                goals.push(goal);
                // Every step of the way is one a body can stand on, and each is one step from the last.
                for (let i = 0; i < helper.path.length; ++i)
                {
                    expect(isStandable(voxels, helper.path[i]), JSON.stringify(helper.path[i])).toBe(true);
                    if (i > 0)
                        expect(across(helper.path[i - 1], helper.path[i])).toBeLessThan(0.75);
                }
            }
            expect(goals.every(goal => across(goal, PLATFORM_HOME) <= 10)).toBe(true);
            const onGround = goals.filter(goal => goal.y == 0);
            if (canClimb)
                expect(onGround.length).toBeGreaterThan(0);
            else
            {
                // Never by the ground, so never to the other platform, which is as high.
                expect(goals.every(goal => Math.abs(goal.y - PLATFORM_HOME.y) <= 1)).toBe(true);
                expect(goals.every(goal => goal.x <= FIRST_PLATFORM_EAST_EDGE)).toBe(true);
            }
        }
    });

    it("keeps to the floor of home on its way, as well as where it goes, unless it may climb", () => {
        seedRandom(17);
        const voxels = platformGrid();
        const surroundings = around(voxels);
        const helper = helperAt(PLATFORM_HOME, {wanderRadius: 10, canClimb: false});
        for (let pick = 0; pick < 25; ++pick)
        {
            helper.at = {...PLATFORM_HOME};
            wanderNow(helper, surroundings, 1000 * pick);
            expect(helper.path.every(point => Math.abs(point.y - PLATFORM_HOME.y) <= 1), `pick ${pick}`).toBe(true);
        }
    });

    it("finds its way back up to the floor of home, if it stands off it once it may no longer climb", () => {
        seedRandom(3);
        const voxels = platformGrid();
        const helper = helperAt(PLATFORM_HOME, {wanderRadius: 10, canClimb: false, anchoredToHome: false});
        // Stood on the ground between the platforms, as one that could climb had left it.
        helper.at = {x: 24, y: 0, z: 16};
        const surroundings = around(voxels);
        for (let pick = 0; pick < 10; ++pick)
        {
            const goal = wanderNow(helper, surroundings, 1000 * pick)!;
            expect(Math.abs(goal.y - PLATFORM_HOME.y), JSON.stringify(goal)).toBeLessThanOrEqual(1);
            expect(helper.path.some(point => point.y > 0 && point.y < 2)).toBe(true);
        }
    });

    it("goes home after each place it wanders to when anchored there, and wanders on from place to place when not",
        () => {
        seedRandom(11);
        const home: Vec3 = {x: 16.25, y: 0, z: 16.25};
        const voxels = openGrid();
        const surroundings = around(voxels);
        for (const anchoredToHome of [true, false])
        {
            const helper = helperAt(home, {wanderRadius: 8, anchoredToHome});
            const seen: Vec3[] = [];
            const walks = new Set<string>();
            let now = 0;
            for (let second = 0; second < 400; ++second)
            {
                now = live(helper, surroundings, now, 1, seen);
                if (helper.path.length > 0)
                    walks.add(helper.walk);
            }
            // Each place it stood a while at, all within its radius (and its ways between them close by).
            const stays = seen.filter((at, i) => i > 0 && HelperBehaviorUtil.isSamePlace(at, seen[i - 1]))
                .filter((at, i, all) => i == 0 || !HelperBehaviorUtil.isSamePlace(at, all[i - 1]));
            expect(stays.every(at => across(at, home) <= 8)).toBe(true);
            expect(seen.every(at => across(at, home) <= 9)).toBe(true);
            const atHome = stays.filter(at => HelperBehaviorUtil.isSamePlace(at, home));
            if (anchoredToHome)
            {
                expect(walks).toEqual(new Set(["wander", "home"]));
                // Home, then somewhere, then home again.
                expect(atHome.length).toBeGreaterThanOrEqual(stays.length / 2 - 1);
                expect(stays.length).toBeGreaterThan(4);
            }
            else
            {
                expect(walks).toEqual(new Set(["wander"]));
                expect(atHome).toHaveLength(1);
                expect(stays.length).toBeGreaterThan(4);
            }
        }
    });

    it("idles between wanders a while picked at random between the least and the most an admin sets, taking new times up "
        + "at once", () => {
        seedRandom(23);
        const home: Vec3 = {x: 16.25, y: 0, z: 16.25};
        const surroundings = around(openGrid());
        // Roaming, so that it stands idle between every two wanders, from each arrival to the next set-off.
        const roaming = helperAt(home, {wanderRadius: 3, anchoredToHome: false, minIdleTime: 2, maxIdleTime: 5});
        const idles: number[] = [];
        let arrivedAt: number | undefined = undefined;
        let now = 0;
        for (let second = 0; second < 120; ++second)
        {
            for (let flush = 0; flush < 5; ++flush)
            {
                now += 200;
                const walking = roaming.path.length > 0;
                HelperBehaviorUtil.act(roaming, surroundings, 0.2, now);
                if (walking && roaming.path.length == 0)
                    arrivedAt = now;
            }
            const standing = roaming.path.length == 0;
            HelperBehaviorUtil.beat(roaming, surroundings, now, false);
            if (standing && roaming.path.length > 0 && arrivedAt != undefined)
                idles.push(now - arrivedAt);
        }
        // Each up to a beat past the while picked, as it sets off on a beat.
        expect(idles.length).toBeGreaterThan(8);
        expect(idles.every(idle => idle >= 2000 && idle < 6000), String(idles)).toBe(true);
        expect(new Set(idles).size).toBeGreaterThan(2);

        // Waiting at home as it was stood there to, it waits as long as new times say instead, once it is given them.
        const npc = npcAt(home, {});
        const helper = HelperBehaviorUtil.create(npc, 0);
        const waitingUntil = helper.nextWanderAt;
        expect(waitingUntil).toBeGreaterThanOrEqual(20_000);
        HelperBehaviorUtil.takeSettings(helper, npc, 1000);
        expect(helper.nextWanderAt).toBe(waitingUntil);
        HelperBehaviorUtil.takeSettings(helper, npcAt(home, {minIdleTime: 1, maxIdleTime: 2}), 1000);
        expect(helper.nextWanderAt).toBeGreaterThanOrEqual(2000);
        expect(helper.nextWanderAt).toBeLessThanOrEqual(3000);
    });

    it("picks somewhere else at once, far from where it was headed, once someone has stood in its way a while", () => {
        seedRandom(5);
        const home: Vec3 = {x: 16, y: 0, z: 16};
        const voxels = openGrid();
        const helper = helperAt(home, {wanderRadius: 15});
        const goal = wanderNow(helper, around(voxels), 0)!;
        expect(across(goal, home)).toBeGreaterThan(4);
        // Someone steps onto its way, a few steps ahead of it.
        const inTheWay = around(voxels, [helper.path[8]]);
        let now = stepUntilBlocked(helper, inTheWay, 0);
        const blockedAt = {...helper.at};
        while (now - helper.blockedSince! < 1800)
        {
            now += 200;
            HelperBehaviorUtil.act(helper, inTheWay, 0.2, now);
        }
        // Still on its way there, standing where it stopped.
        expect(helper.path[helper.path.length - 1]).toEqual(goal);
        expect(helper.at).toEqual(blockedAt);

        now += 200;
        HelperBehaviorUtil.act(helper, inTheWay, 0.2, now);
        const newGoal = helper.path[helper.path.length - 1];
        expect(newGoal).toBeDefined();
        expect(across(newGoal, goal)).toBeGreaterThanOrEqual(6);
        expect(across(newGoal, home)).toBeLessThanOrEqual(15);
        // And off it goes, never up close to whoever stood in its way.
        const stoppedAt = {...helper.at};
        const seen: Vec3[] = [];
        live(helper, inTheWay, now, 10, seen);
        expect(seen.some(at => across(at, stoppedAt) > 1)).toBe(true);
        const them = inTheWay.getPeople()[0];
        expect(seen.every(at => across(at, them) >= 3 || across(at, them) >= across(stoppedAt, them))).toBe(true);
    });

    it("never stops for another helper standing in its way, but walks on past it, a body's width or more to one side",
        () => {
        seedRandom(5);
        const home: Vec3 = {x: 16, y: 0, z: 16};
        const voxels = openGrid();
        const helper = helperAt(home, {wanderRadius: 15});
        const goal = wanderNow(helper, around(voxels), 0)!;
        const other = helperAt(helper.path[8], {});
        const inTheWay = around(voxels, [], [other]);
        const seen: Vec3[] = [];
        for (let now = 200; helper.path.length > 0 && now < 20_000; now += 200)
        {
            HelperBehaviorUtil.act(helper, inTheWay, 0.2, now);
            expect(helper.blockedSince).toBeUndefined();
            seen.push({...helper.at});
        }
        expect(helper.at).toEqual(goal);
        expect(Math.min(...seen.map(at => across(at, other.at)))).toBeGreaterThanOrEqual(0.9);
    });

    it("goes on past another helper coming the other way, however narrow the way, so that neither waits on the other "
        + "for good", () => {
        // Each stands at the other's home, its own a few steps along the corridor the other way, as two that met on
        // their ways home would.
        for (const width of [2, 3, 4, 6])
        {
            const {voxels, lanes} = corridorGrid(width);
            const lane = lanes[Math.floor((lanes.length - 1) / 2)];
            const helpers = [headingHome({x: 17, y: 0, z: lane}, {x: 12, y: 0, z: lane}),
                headingHome({x: 12, y: 0, z: lane}, {x: 17, y: 0, z: lane})];
            liveTogether(helpers, voxels, 0, 10);
            for (const helper of helpers)
                expect(helper.at, `${width} voxels wide`).toEqual(helper.home);
        }
    });

    it("passes one coming the other way on its own right where there is room, a body's width or more from it", () => {
        const {voxels, lanes} = corridorGrid(4);
        // On the middle of three lanes, each bound for where the other stands.
        const lane = lanes[1];
        const eastward = headingHome({x: 17, y: 0, z: lane}, {x: 12, y: 0, z: lane});
        const westward = headingHome({x: 12, y: 0, z: lane}, {x: 17, y: 0, z: lane});
        const seen: Vec3[][] = [[], []];
        liveTogether([eastward, westward], voxels, 0, 10, seen);
        const flushes = seen[0].map((_, i) => i);
        expect(Math.min(...flushes.map(i => across(seen[0][i], seen[1][i])))).toBeGreaterThanOrEqual(0.9);
        // The right of one bound east is south (more z), of one bound west north.
        const abreast = flushes.filter(i => Math.abs(seen[0][i].x - seen[1][i].x) < 0.5);
        expect(abreast.length).toBeGreaterThan(0);
        expect(abreast.every(i => seen[0][i].z > lane && seen[1][i].z < lane)).toBe(true);
        expect(eastward.at).toEqual(eastward.home);
        expect(westward.at).toEqual(westward.home);
    });

    it("falls in behind another helper walking its way abreast of it, where the way is too narrow for two", () => {
        const {voxels, lanes} = corridorGrid(3);
        // Abreast on the corridor's two lanes, bound east: the one on the south, to the right of the other, goes first.
        const north = headingHome({x: 21, y: 0, z: lanes[0]}, {x: 11, y: 0, z: lanes[0]});
        const south = headingHome({x: 25, y: 0, z: lanes[1]}, {x: 11, y: 0, z: lanes[1]});
        const seen: Vec3[][] = [[], []];
        liveTogether([north, south], voxels, 0, 3, seen);
        // From the first beat, which sets them off.
        const distances = seen[0].map((at, i) => across(at, seen[1][i])).slice(5);
        expect(distances.filter(distance => distance < 2 * PLAYER_RADIUS_XZ).length).toBeLessThanOrEqual(1);
        expect(Math.min(...distances.slice(3))).toBeGreaterThanOrEqual(0.9);
        expect(seen[1].every((at, i) => at.x >= seen[0][i].x)).toBe(true);
        liveTogether([north, south], voxels, 3000, 10);
        expect(north.at).toEqual(north.home);
        expect(south.at).toEqual(south.home);
    });

    it("stops a little way short of another helper standing where it is going, never walking into it", () => {
        const home: Vec3 = {x: 16, y: 0, z: 16};
        const voxels = openGrid();
        const helper = headingHome(home, {x: 22, y: 0, z: 16}, {wanderRadius: 10});
        // Another stands on its home, never wandering.
        const onHome = helperAt({x: 16.5, y: 0, z: 16}, {wanderRadius: 0});
        // Long enough for it to try for home again a while after it stops there, which may take it a step nearer.
        const seen: Vec3[][] = [[], []];
        liveTogether([helper, onHome], voxels, 0, 20, seen);
        expect(onHome.at).toEqual(onHome.home);
        expect(Math.min(...seen[0].map(at => across(at, onHome.at)))).toBeGreaterThanOrEqual(2 * PLAYER_RADIUS_XZ);
        // There a while, short of its home.
        expect(seen[0].slice(-25).every(at => HelperBehaviorUtil.isSamePlace(at, helper.at))).toBe(true);
        expect(across(helper.at, onHome.at)).toBeLessThan(1.5);
    });

    it("never wanders to where another helper stands, or is going", () => {
        seedRandom(19);
        const home: Vec3 = {x: 16, y: 0, z: 16};
        const voxels = openGrid();
        const standing = helperAt({x: 18, y: 0, z: 17}, {});
        const walking = helperAt({x: 14, y: 0, z: 17}, {});
        walking.path = [{x: 14, y: 0, z: 16.5}, {x: 14, y: 0, z: 16}];
        const helper = helperAt(home, {wanderRadius: 4});
        const surroundings = around(voxels, [], [standing, walking]);
        for (let pick = 0; pick < 40; ++pick)
        {
            helper.at = {...home};
            const goal = wanderNow(helper, surroundings, 1000 * pick)!;
            expect(across(goal, standing.at), `pick ${pick}`).toBeGreaterThanOrEqual(1);
            expect(across(goal, {x: 14, y: 0, z: 16}), `pick ${pick}`).toBeGreaterThanOrEqual(1);
        }
    });

    it("walks round someone standing between it and home, rather than waiting on them", () => {
        const home: Vec3 = {x: 16, y: 0, z: 16};
        const voxels = openGrid();
        const helper = helperAt(home, {wanderRadius: 10});
        helper.at = {x: 22, y: 0, z: 16};
        helper.returnHomeAt = 0;
        // Off to one side of the straight way, well within a few steps of it.
        const person = {x: 19, y: 0, z: 18.5};
        const inTheWay = around(voxels, [person]);
        const seen: Vec3[] = [];
        live(helper, inTheWay, 0, 20, seen);
        expect(seen.some(at => HelperBehaviorUtil.isSamePlace(at, home))).toBe(true);
        expect(Math.min(...seen.map(at => across(at, person)))).toBeGreaterThanOrEqual(3);
        expect(seen.some(at => at.z < 15.5)).toBe(true);
    });

    it("turns the way it was put as soon as it is home from a walk, though it talked a moment ago, with nobody near to "
        + "look at", () => {
        const home: Vec3 = {x: 16, y: 0, z: 16};
        const put = HelperBehaviorUtil.getFacingPut(0);
        const ahead = NpcFacingUtil.getDir(put);
        // Out in front of home, so that it walks back in facing away from the way it was put.
        const helper = helperAt(home, {wanderRadius: 10});
        helper.at = {x: home.x + 4 * ahead.x, y: 0, z: home.z + 4 * ahead.z};
        helper.returnHomeAt = 0;
        // Its greeting to someone who has gone since.
        HelperBehaviorUtil.say(helper, "Hi, welcome to ThingsPool!", ["gone"], 0);
        const surroundings = around(openGrid());
        let now = live(helper, surroundings, 0, 2);
        expect(helper.walk).toBe("home");
        expect(helper.path.length).toBeGreaterThan(0);
        expect(Math.abs(NpcFacingUtil.getTurn(helper.facing, put))).toBeGreaterThan(150);

        for (let second = 0; second < 5 && !HelperBehaviorUtil.isSamePlace(helper.at, home); ++second)
            now = live(helper, surroundings, now, 1);
        expect(HelperBehaviorUtil.isSamePlace(helper.at, home)).toBe(true);
        // Long before the talk would be over.
        expect(now).toBeLessThan(10_000);
        expect(helper.facing).toBe(put);
    });

    it("goes on where it was headed once whoever stood in its way steps aside in time", () => {
        seedRandom(5);
        const home: Vec3 = {x: 16, y: 0, z: 16};
        const voxels = openGrid();
        const helper = helperAt(home, {wanderRadius: 15});
        const goal = wanderNow(helper, around(voxels), 0)!;
        const inTheWay = around(voxels, [helper.path[8]]);
        let now = stepUntilBlocked(helper, inTheWay, 0);
        for (let flush = 0; flush < 8; ++flush)
        {
            now += 200;
            HelperBehaviorUtil.act(helper, inTheWay, 0.2, now);
        }
        expect(helper.path[helper.path.length - 1]).toEqual(goal);
        const seen: Vec3[] = [];
        live(helper, around(voxels), now, 30, seen);
        expect(seen.some(at => HelperBehaviorUtil.isSamePlace(at, goal))).toBe(true);
    });

    it("gives up a way a block has come to stand in, and wanders off somewhere else instead", () => {
        seedRandom(9);
        const home: Vec3 = {x: 16, y: 0, z: 16};
        const voxels = openGrid();
        const surroundings = around(voxels);
        const helper = helperAt(home, {wanderRadius: 15});
        const goal = wanderNow(helper, surroundings, 0)!;
        // A pillar on its way, a few steps on.
        const vertex = VoxelPathUtil.toVertex(helper.path[Math.min(4, helper.path.length - 1)])!;
        fill(voxels, [vertex.row - 1, vertex.row], [vertex.col - 1, vertex.col], [0, 7]);

        const seen: Vec3[] = [];
        let now = 0;
        for (let flush = 0; flush < 25; ++flush)
        {
            now += 200;
            HelperBehaviorUtil.act(helper, surroundings, 0.2, now);
            seen.push({...helper.at});
        }
        expect(helper.path[helper.path.length - 1]).not.toEqual(goal);
        expect(seen.every(at => !(across(at, VoxelPathUtil.toWorld(vertex)) < 0.1))).toBe(true);
    });

    it("stays still a while when there is nowhere it can wander to, and tries again later", () => {
        const home: Vec3 = {x: 16, y: 0, z: 16};
        const voxels = openGrid();
        // Walled in, a body's width each way.
        fill(voxels, [30, 30], [30, 33], [0, 15]);
        fill(voxels, [33, 33], [30, 33], [0, 15]);
        fill(voxels, [30, 33], [30, 30], [0, 15]);
        fill(voxels, [30, 33], [33, 33], [0, 15]);
        const surroundings = around(voxels);
        const helper = helperAt(home, {wanderRadius: 8});
        expect(wanderNow(helper, surroundings, 0)).toBeUndefined();
        expect(helper.nextWanderAt).toBeGreaterThanOrEqual(20_000);
        const later = live(helper, surroundings, 0, 15);
        expect(helper.path).toEqual([]);
        expect(helper.at).toEqual(home);
        expect(later).toBeLessThan(helper.nextWanderAt);
    });

    it("gives up and stays still a while, kept from home with nowhere far enough from it to go instead", () => {
        const home: Vec3 = {x: 16, y: 0, z: 16};
        const voxels = openGrid();
        const helper = helperAt(home, {wanderRadius: 3});
        helper.at = {x: 19, y: 0, z: 16};
        helper.returnHomeAt = 0;
        const seen: Vec3[] = [];
        // Someone stands on its home a few seconds, then goes.
        let now = live(helper, around(voxels, [home]), 0, 3, seen);
        expect(helper.path).toEqual([]);
        // Still there, though its home is free again, for the while it drew when it gave up.
        const setsOffAt = helper.returnHomeAt;
        expect(setsOffAt).toBeGreaterThan(now);
        while (now < setsOffAt)
            now = live(helper, around(voxels), now, 1, seen);
        expect(seen.every(at => HelperBehaviorUtil.isSamePlace(at, {x: 19, y: 0, z: 16}))).toBe(true);
        live(helper, around(voxels), now, 20, seen);
        expect(seen.some(at => HelperBehaviorUtil.isSamePlace(at, home))).toBe(true);
    });

    it("wanders off far from home instead while someone stands on its home, once it has waited a moment", () => {
        seedRandom(13);
        const home: Vec3 = {x: 16, y: 0, z: 16};
        const voxels = openGrid();
        const helper = helperAt(home, {wanderRadius: 10});
        helper.at = {x: 22, y: 0, z: 16};
        helper.returnHomeAt = 0;
        // Someone stands at its home.
        const onHome = around(voxels, [{x: 16.5, y: 0, z: 16}]);
        let now = live(helper, onHome, 0, 1);
        expect(helper.path).toEqual([]);
        now = live(helper, onHome, now, 2);
        const goal = helper.path[helper.path.length - 1];
        expect(goal).toBeDefined();
        expect(across(goal, home)).toBeGreaterThanOrEqual(6);
        expect(helper.walk).toBe("wander");
    });
});

describe("helpers chatting", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const LINES = [{by: 0, text: "Hey Bo! Why did the block go to school?"}, {by: 1, text: "To build is to think."},
        {by: 0, text: "Ha! I'll steal that one."}];

    // Two helpers a few steps apart on an open floor, each free to chat.
    function twoHelpers(): {a: HelperBehavior, b: HelperBehavior, voxels: Voxel[]}
    {
        const a = helperAt({x: 15, y: 0, z: 16}, {wanderRadius: 6});
        const b = helperAt({x: 18, y: 0, z: 16}, {wanderRadius: 6});
        a.nextSmallTalkAt = b.nextSmallTalkAt = 0;
        return {a, b, voxels: openGrid()};
    }

    it("finds two to chat only near each other on one floor, in sight, not lately talking with someone, and not again "
        + "too soon", () => {
        const {a, b, voxels} = twoHelpers();
        const now = 100_000;
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], voxels, now)).toEqual([a, b]);

        // Farther apart.
        b.at = {x: 20, y: 0, z: 16};
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], voxels, now)).toBeUndefined();
        b.at = {x: 18, y: 0, z: 16};
        // A wall between them, taller than they are.
        const wall = openGrid();
        fill(wall, [28, 36], [33, 33], [0, 7]);
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], wall, now)).toBeUndefined();
        // A counter between them is no wall.
        const counter = openGrid();
        fill(counter, [28, 36], [33, 33], [0, 1]);
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], counter, now)).toEqual([a, b]);
        // One on another floor.
        b.at = {x: 18, y: 4, z: 16};
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], voxels, now)).toBeUndefined();
        b.at = {x: 18, y: 0, z: 16};
        // One that has just talked with someone.
        HelperBehaviorUtil.say(a, "Hi Alice!", ["alice"], now);
        HelperBehaviorUtil.beat(a, around(voxels), now, false);
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], voxels, now + 10_000)).toBeUndefined();
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], voxels, now + 40_000)).toEqual([a, b]);
        // Once they have chatted, not again for a while.
        HelperBehaviorUtil.startSmallTalk([a, b], [], now + 40_000);
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], voxels, now + 50_000)).toBeUndefined();
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], voxels, now + 400_000)).toEqual([a, b]);
    });

    it("takes turns, each once the other's last words have been read, facing each other, and walks on after", () => {
        seedRandom(21);
        const {a, b, voxels} = twoHelpers();
        let now = 100_000;
        // One of them is on its way somewhere.
        const goal = wanderNow(a, around(voxels, [], [b]), now)!;
        expect(goal).toBeDefined();
        const [aAround, bAround] = [around(voxels, [], [b]), around(voxels, [], [a])];
        HelperBehaviorUtil.startSmallTalk([a, b], LINES, now);
        expect(HelperBehaviorUtil.getSmallTalkPartner(a)).toBe(b);

        const said: {who: string, text: string, at: number}[] = [];
        const lastSaid = {a: "", b: ""};
        const startedAt = {...a.at};
        const seen: Vec3[] = [];
        // Seconds in a row both bubbles were up: the one before is taken down within a beat of the answer.
        let bothUp = 0;
        let mostBothUp = 0;
        for (let second = 0; second < 30; ++second)
        {
            for (let flush = 0; flush < 5; ++flush)
            {
                now += 200;
                HelperBehaviorUtil.act(a, aAround, 0.2, now);
                HelperBehaviorUtil.act(b, bAround, 0.2, now);
            }
            HelperBehaviorUtil.beat(a, aAround, now, false);
            HelperBehaviorUtil.beat(b, bAround, now, false);
            seen.push({...a.at});
            for (const [who, helper] of [["a", a], ["b", b]] as [keyof typeof lastSaid, HelperBehavior][])
            {
                if (helper.saying != lastSaid[who] && helper.saying.length > 0)
                    said.push({who, text: helper.saying, at: now});
                lastSaid[who] = helper.saying;
            }
            bothUp = (a.saying.length > 0 && b.saying.length > 0) ? bothUp + 1 : 0;
            mostBothUp = Math.max(mostBothUp, bothUp);
            if (a.smallTalk != undefined)
            {
                // Standing where it was, its way kept, and the two looking at each other.
                expect(a.at).toEqual(startedAt);
                expect(a.path[a.path.length - 1]).toEqual(goal);
                if (second > 0)
                {
                    expect(a.facing).toBe(90);
                    expect(b.facing).toBe(270);
                }
            }
        }
        expect(said.map(({who, text}) => ({who, text}))).toEqual([{who: "a", text: LINES[0].text},
            {who: "b", text: LINES[1].text}, {who: "a", text: LINES[2].text}]);
        // Each waits until the words before have been up long enough to read, a few seconds at least.
        expect(said[1].at - said[0].at).toBeGreaterThanOrEqual(3000);
        expect(said[2].at - said[1].at).toBeGreaterThanOrEqual(3000);
        // One bubble at a time, but for the beat an answer takes to bring the line before down.
        expect(mostBothUp).toBe(1);
        expect(b.saying).toBe("");
        expect(a.saying).toBe(LINES[2].text);
        expect(a.smallTalk).toBeUndefined();
        expect(b.smallTalk).toBeUndefined();
        // Then on to where it was headed, though it may be home again by the end.
        expect(seen.some(at => HelperBehaviorUtil.isSamePlace(at, goal))).toBe(true);
    });

    it("ends a chat for both the moment someone talks to either, turning to them", () => {
        const {a, b, voxels} = twoHelpers();
        let now = 100_000;
        const surroundings = around(voxels);
        HelperBehaviorUtil.startSmallTalk([a, b], LINES, now);
        HelperBehaviorUtil.beat(a, surroundings, now, false);
        expect(a.saying).toBe(LINES[0].text);

        now += 1000;
        HelperBehaviorUtil.hear(b, surroundings, "alice", now);
        expect(a.smallTalk).toBeUndefined();
        expect(b.smallTalk).toBeUndefined();
        expect(b.talkingWith).toEqual(["alice"]);
        for (let second = 0; second < 20; ++second)
        {
            now += 1000;
            HelperBehaviorUtil.beat(a, surroundings, now, false);
            HelperBehaviorUtil.beat(b, surroundings, now, true);
        }
        expect(b.saying).toBe("");
    });

    it("starts no chat it is no longer free for, and none in no words", () => {
        const {a, b} = twoHelpers();
        const now = 100_000;
        HelperBehaviorUtil.startSmallTalk([a, b], [], now);
        expect(a.smallTalk).toBeUndefined();
        a.nextSmallTalkAt = b.nextSmallTalkAt = 0;
        HelperBehaviorUtil.startAnswering(a, around(openGrid()), "alice", now);
        HelperBehaviorUtil.startSmallTalk([a, b], LINES, now);
        expect(a.smallTalk).toBeUndefined();
        expect(b.smallTalk).toBeUndefined();
    });
});

describe("helpers looking at things", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const CANVAS_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Canvas");
    // Someone far off, so that someone is about to see it.
    const SOMEONE: Vec3[] = [{x: 4, y: 0, z: 4}];
    const REMARK = "What a lovely picture!";

    // A wall running east and west from x = 10 to x = 22, from z = 20 to z = 21, taller than anyone.
    function wallGrid(): Voxel[]
    {
        const voxels = openGrid();
        fill(voxels, [40, 41], [20, 44], [0, 7]);
        return voxels;
    }

    // A painting hung at x on the wall's north face, or on its south face, facing away from the north.
    function canvasAt(x: number, face: "north" | "south" = "north"): AddObjectSignal
    {
        return new AddObjectSignal("room", "admin", "Admin", CANVAS_TYPE_INDEX, "canvas",
            new ObjectTransform({x, y: 1.5, z: (face == "north") ? 20 : 21}, {x: 0, y: 0, z: (face == "north") ? -1 : 1},
                {x: 1, y: 1, z: 1}), {[ObjectMetadataKeyEnumMap.ImagePath]: new EncodableByteString("1/3")});
    }

    // A helper at home with nothing to do, just as it would wander off.
    function dueHelper(home: Vec3, prefs: Partial<BehaviorPrefs> = {}): HelperBehavior
    {
        const helper = helperAt(home, {wanderRadius: 3, ...prefs});
        helper.nextSightAt = 0;
        helper.nextWanderAt = 0;
        return helper;
    }

    it("finds things to look at only from where it may stand in front of them, in sight of them, and only as it would "
        + "wander off, with someone about to see it", () => {
        const voxels = wallGrid();
        const helper = dueHelper({x: 16, y: 0, z: 17});
        const surroundings = around(voxels, SOMEONE, [], [canvasAt(16)]);
        const now = 100_000;
        expect(HelperBehaviorUtil.isDueForSight(helper, surroundings, now)).toBe(true);
        expect(HelperBehaviorUtil.findSights(helper, surroundings))
            .toEqual([{objectId: "canvas", subject: {objectType: "Canvas", picture: "1/3"}}]);
        // Not with nobody about, nor before it would wander off, nor if it never wanders.
        expect(HelperBehaviorUtil.isDueForSight(helper, around(voxels, [], [], [canvasAt(16)]), now)).toBe(false);
        helper.nextWanderAt = now + 1000;
        expect(HelperBehaviorUtil.isDueForSight(helper, surroundings, now)).toBe(false);
        expect(HelperBehaviorUtil.isDueForSight(dueHelper({x: 16, y: 0, z: 17}, {wanderRadius: 0}), surroundings, now))
            .toBe(false);
        // None on the wall's far side, none seen only from far off to one side (past the wall's end, though nothing
        // stands between), none beyond where it may go, and none with a screen between.
        expect(HelperBehaviorUtil.findSights(helper, around(voxels, SOMEONE, [], [canvasAt(16, "south")]))).toEqual([]);
        expect(HelperBehaviorUtil.findSights(dueHelper({x: 26, y: 0, z: 20.5}),
            around(voxels, SOMEONE, [], [canvasAt(21)]))).toEqual([]);
        expect(HelperBehaviorUtil.findSights(dueHelper({x: 16, y: 0, z: 10}), surroundings)).toEqual([]);
        const screened = wallGrid();
        fill(screened, [38, 38], [24, 40], [0, 7]);
        expect(HelperBehaviorUtil.findSights(helper, around(screened, SOMEONE, [], [canvasAt(16)]))).toEqual([]);
    });

    it("walks to a place in front of what it was given to look at, faces it, says its remark once it has looked a moment, "
        + "and stays there a while once its words have been read", () => {
        const voxels = wallGrid();
        // One that roams, which stays there a while as anywhere it wanders to (one anchored to home heads home).
        const helper = dueHelper({x: 16, y: 0, z: 14}, {wanderRadius: 4, anchoredToHome: false});
        const surroundings = around(voxels, SOMEONE, [], [canvasAt(16)]);
        let now = 100_000;
        const [sight] = HelperBehaviorUtil.findSights(helper, surroundings);
        HelperBehaviorUtil.startSight(helper, surroundings, sight, REMARK, now);
        // Somewhere in front of the painting, as far off as suits one its size.
        const point: Vec3 = {x: 16, y: 1.5, z: 19.9};
        const end = helper.path[helper.path.length - 1];
        expect(across(end, point)).toBeGreaterThanOrEqual(1.5);
        expect(across(end, point)).toBeLessThanOrEqual(3.5);
        expect(point.z - end.z).toBeGreaterThanOrEqual(Math.cos(50 * Math.PI / 180) * across(end, point));
        expect(HelperBehaviorUtil.getLookedAt(helper)).toBeUndefined();

        let arrivedAt: number | undefined = undefined;
        let saidAt: number | undefined = undefined;
        let doneAt: number | undefined = undefined;
        for (let second = 0; second < 20; ++second)
        {
            for (let flush = 0; flush < 5; ++flush)
            {
                now += 200;
                HelperBehaviorUtil.act(helper, surroundings, 0.2, now);
                if (arrivedAt == undefined && helper.sight?.saysAt != undefined)
                {
                    arrivedAt = now;
                    // Turned away, it turns back to look.
                    helper.facing = (helper.facing + 180) % 360;
                }
            }
            HelperBehaviorUtil.beat(helper, surroundings, now, false);
            if (saidAt == undefined && helper.saying == REMARK)
            {
                saidAt = now;
                expect(HelperBehaviorUtil.getLookedAt(helper)).toBe("canvas");
                expect(helper.at).toEqual(end);
            }
            if (saidAt != undefined && doneAt == undefined && helper.sight == undefined)
                doneAt = now;
            // Facing it, from when it is there until it is done.
            if (helper.sight?.saysAt != undefined && now > helper.sight.saysAt)
            {
                const toward = NpcFacingUtil.getDegrees({x: point.x - helper.at.x, y: 0, z: point.z - helper.at.z});
                expect(Math.abs(NpcFacingUtil.getTurn(helper.facing, toward))).toBeLessThan(2);
            }
        }
        expect(saidAt! - arrivedAt!).toBeGreaterThanOrEqual(1500);
        // Up as long as any bubble before it goes on, and a moment more.
        expect(doneAt! - saidAt!).toBeGreaterThanOrEqual(4000);
        expect(helper.at).toEqual(end);
        expect(helper.nextWanderAt).toBeGreaterThan(doneAt!);
    });

    it("stops looking the moment someone talks to it, types it a line or it greets someone, and once the thing is taken "
        + "away or moved", () => {
        const voxels = wallGrid();
        const start = () => {
            const helper = dueHelper({x: 16, y: 0, z: 17});
            const surroundings = around(voxels, SOMEONE, [], [canvasAt(16)]);
            const [sight] = HelperBehaviorUtil.findSights(helper, surroundings);
            HelperBehaviorUtil.startSight(helper, surroundings, sight, REMARK, 100_000);
            expect(helper.sight).toBeDefined();
            return {helper, surroundings};
        };
        let {helper, surroundings} = start();
        HelperBehaviorUtil.hear(helper, surroundings, "alice", 100_500);
        expect(helper.sight).toBeUndefined();
        ({helper, surroundings} = start());
        HelperBehaviorUtil.waitFor(helper, "alice", 100_500);
        expect(helper.sight).toBeUndefined();
        expect(helper.path).toEqual([]);
        ({helper, surroundings} = start());
        HelperBehaviorUtil.say(helper, "Hi Alice!", ["alice"], 100_500);
        expect(helper.sight).toBeUndefined();
        ({helper, surroundings} = start());
        delete surroundings.objectById["canvas"];
        HelperBehaviorUtil.beat(helper, surroundings, 101_000, false);
        expect(helper.sight).toBeUndefined();
        ({helper, surroundings} = start());
        surroundings.objectById["canvas"] = canvasAt(14);
        HelperBehaviorUtil.beat(helper, surroundings, 101_000, false);
        expect(helper.sight).toBeUndefined();
    });

    it("goes to look at nothing without words for it, or once it is no longer free to, and looks for nothing else a "
        + "while, a shorter while when there was nothing to look at", () => {
        const surroundings = around(wallGrid(), SOMEONE, [], [canvasAt(16)]);
        const helper = dueHelper({x: 16, y: 0, z: 17});
        const now = 100_000;
        const [sight] = HelperBehaviorUtil.findSights(helper, surroundings);
        // However the whiles fall, one after nothing to look at is shorter than any after a look.
        const whiles = (given: typeof sight | undefined) => Array.from({length: 10}, () => {
            helper.nextSightAt = 0;
            HelperBehaviorUtil.startSight(helper, surroundings, given, "", now);
            expect(helper.sight).toBeUndefined();
            return helper.nextSightAt - now;
        });
        expect(Math.min(...whiles(undefined))).toBeGreaterThan(0);
        expect(Math.max(...whiles(undefined))).toBeLessThan(Math.min(...whiles(sight)));
        helper.nextSightAt = 0;
        HelperBehaviorUtil.startAnswering(helper, surroundings, "alice", now);
        HelperBehaviorUtil.startSight(helper, surroundings, sight, REMARK, now);
        expect(helper.sight).toBeUndefined();
    });

    it("chats with no other helper while it looks at something", () => {
        const voxels = wallGrid();
        const a = dueHelper({x: 15, y: 0, z: 17});
        const b = helperAt({x: 18, y: 0, z: 17}, {wanderRadius: 6});
        a.nextSmallTalkAt = b.nextSmallTalkAt = 0;
        const now = 100_000;
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], voxels, now)).toEqual([a, b]);
        const surroundings = around(voxels, SOMEONE, [b], [canvasAt(16)]);
        const [sight] = HelperBehaviorUtil.findSights(a, surroundings);
        HelperBehaviorUtil.startSight(a, surroundings, sight, REMARK, now);
        expect(a.sight).toBeDefined();
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], voxels, now)).toBeUndefined();
    });
});

describe("helpers waiting on someone typing them a line", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const HOME: Vec3 = {x: 16, y: 0, z: 16};
    // A few steps from home: in earshot of it, and of anywhere a few steps from it.
    const ALICE: Vec3 = {x: 16, y: 0, z: 20};
    // Off the other way, farther than it answers anyone from without walking up to them.
    const BOB: Vec3 = {x: 16, y: 0, z: 9};

    // Where it is played, with Alice and Bob there by their user ids, and these other helpers.
    function withPeople(voxels: Voxel[], others: HelperBehavior[] = []): HelperSurroundings
    {
        const middle = (feet: Vec3) => ({x: feet.x, y: feet.y + 0.5 * PLAYER_HEIGHT, z: feet.z});
        return {...around(voxels, [ALICE, BOB], others),
            getPerson: (userID: string) => (userID == "alice") ? middle(ALICE) : (userID == "bob") ? middle(BOB) : undefined};
    }

    // Seconds of its life as whoever plays it gives them (see live), with whoever types it a line meanwhile, if anyone:
    // each place it stood at after a flush seen; the moment after them.
    function liveTypedTo(helper: HelperBehavior, surroundings: HelperSurroundings, from: number, seconds: number,
        typist: string | undefined, seen: Vec3[] = []): number
    {
        let now = from;
        for (let i = 0; i < seconds; ++i)
        {
            for (let flush = 0; flush < 5; ++flush)
            {
                now += 200;
                HelperBehaviorUtil.act(helper, surroundings, 0.2, now);
                seen.push({...helper.at});
            }
            HelperBehaviorUtil.waitFor(helper, typist, now);
            HelperBehaviorUtil.beat(helper, surroundings, now, false);
        }
        return now;
    }

    function faces(helper: HelperBehavior, feet: Vec3): boolean
    {
        return Math.abs(NpcFacingUtil.getTurn(helper.facing,
            NpcFacingUtil.getDegrees({x: feet.x - helper.at.x, y: 0, z: feet.z - helper.at.z}))) < 2;
    }

    it("stops where it is on its way, faces whoever types it a line, and stands there until they stop, and a while "
        + "after, as after a talk", () => {
        seedRandom(5);
        const surroundings = withPeople(openGrid());
        const helper = helperAt(HOME, {wanderRadius: 15});
        wanderNow(helper, surroundings, 0);
        let now = 0;
        for (let flush = 0; flush < 5; ++flush)
        {
            now += 200;
            HelperBehaviorUtil.act(helper, surroundings, 0.2, now);
        }
        expect(helper.path.length).toBeGreaterThan(0);
        const stopped = {...helper.at};

        const seen: Vec3[] = [];
        HelperBehaviorUtil.waitFor(helper, "alice", now);
        now = liveTypedTo(helper, surroundings, now, 60, "alice", seen);
        expect(seen.every(at => HelperBehaviorUtil.isSamePlace(at, stopped))).toBe(true);
        expect(faces(helper, ALICE)).toBe(true);

        // Once she stops, it stays, still facing her; then heads home, as it does a while after each wander.
        const after: Vec3[] = [];
        now = liveTypedTo(helper, surroundings, now, 25, undefined, after);
        expect(after.every(at => HelperBehaviorUtil.isSamePlace(at, stopped))).toBe(true);
        expect(faces(helper, ALICE)).toBe(true);
        liveTypedTo(helper, surroundings, now, 30, undefined, after);
        expect(after.some(at => HelperBehaviorUtil.isSamePlace(at, HOME))).toBe(true);
    });

    it("breaks off a chat with another helper for someone typing it a line, turning to them, and while they type starts "
        + "no other, nor goes to look at anything", () => {
        const voxels = openGrid();
        const a = helperAt({x: 15, y: 0, z: 16}, {wanderRadius: 6});
        const b = helperAt({x: 18, y: 0, z: 16}, {wanderRadius: 6});
        const surroundings = withPeople(voxels, [b]);
        let now = 100_000;
        HelperBehaviorUtil.startSmallTalk([a, b], [{by: 0, text: "Hey Bo!"}, {by: 1, text: "Hello!"}], now);
        HelperBehaviorUtil.beat(a, surroundings, now, false);
        expect(a.saying).toBe("Hey Bo!");

        HelperBehaviorUtil.waitFor(a, "alice", now + 500);
        expect(a.smallTalk).toBeUndefined();
        expect(b.smallTalk).toBeUndefined();
        HelperBehaviorUtil.act(a, surroundings, 0.2, now + 700);
        expect(faces(a, ALICE)).toBe(true);

        // Long after, when both would be free to chat again, and it to go and look at something as it would wander off,
        // had nobody talked to it lately: not while she types.
        now += 1_000_000;
        HelperBehaviorUtil.waitFor(a, "alice", now);
        Object.assign(a, {nextSmallTalkAt: 0, nextSightAt: 0, nextWanderAt: 0, lastTalkAt: -Infinity});
        b.nextSmallTalkAt = 0;
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], voxels, now)).toBeUndefined();
        expect(HelperBehaviorUtil.isDueForSight(a, surroundings, now)).toBe(false);
        HelperBehaviorUtil.waitFor(a, undefined, now);
        a.lastTalkAt = -Infinity;
        expect(HelperBehaviorUtil.findSmallTalkPair([a, b], voxels, now)).toEqual([a, b]);
        expect(HelperBehaviorUtil.isDueForSight(a, surroundings, now)).toBe(true);
    });

    it("turns to someone typing it a line only once its words to someone else have been read, and walks up to nobody "
        + "while they type", () => {
        const surroundings = withPeople(openGrid());
        const helper = helperAt(HOME, {wanderRadius: 10});
        let now = 100_000;
        HelperBehaviorUtil.sayAnswer(helper, "Hello Bob, welcome!", ["bob"], now);
        HelperBehaviorUtil.beat(helper, surroundings, now, false);
        expect(helper.saying).toBe("Hello Bob, welcome!");

        HelperBehaviorUtil.waitFor(helper, "alice", now + 200);
        HelperBehaviorUtil.act(helper, surroundings, 0.2, now + 400);
        expect(faces(helper, BOB)).toBe(true);
        HelperBehaviorUtil.meet(helper, surroundings, "bob", now + 400);
        expect(helper.path).toEqual([]);
        now = liveTypedTo(helper, surroundings, now + 400, 5, "alice");
        expect(faces(helper, ALICE)).toBe(true);
        expect(helper.at).toEqual(HOME);

        // Done waiting, it walks up to whom it answers from farther off, as ever.
        HelperBehaviorUtil.waitFor(helper, undefined, now);
        HelperBehaviorUtil.meet(helper, surroundings, "bob", now);
        expect(helper.path.length).toBeGreaterThan(0);
    });
});
