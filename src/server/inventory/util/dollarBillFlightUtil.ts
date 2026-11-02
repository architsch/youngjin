import Vec3 from "../../../shared/math/types/vec3";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import { DOLLAR_BILL_REACH, DOLLAR_BILL_REST_HEIGHT } from "../../../shared/object/types/objectTypeConfig/dollarBillObjectTypeConfig";
import ObjectWaypoint from "../../../shared/object/types/objectWaypoint";
import { COLLISION_LAYER_HEIGHT } from "../../../shared/system/sharedConstants";
import Voxel from "../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";

// A bill keeps this far from a block's side, about its reach as it lies however it is turned.
const CLEARANCE = 0.3;
// Its lower edges keep this far over what it lies on.
const SKIM = 0.01;
// How finely a way is searched for blocks.
const SEARCH_STEP = 0.1;
// A flight is worked out a step at a time, in seconds, each step a waypoint, unless too short to be worth one, and ends by
// this long at the latest, which bounds its waypoints (see SetObjectPathSignal).
const FLIGHT_STEP = 0.1;
const MAX_FLIGHT_SECONDS = 15;
const MIN_LEG = 0.01;
// Paper takes on the wind's speed almost at once, a share a second, and less of it where it drags along a floor. Out of the
// wind it keeps going a while, glides, and goes no faster than a path can say.
const WIND_GRIP = 7;
const GLIDE_GRIP = 2.5;
const FLOOR_DRAG = 0.5;
const MAX_SPEED = 12;
// It drops as slowly as paper does, in world units a second, and swings from side to side like a falling leaf, in a wind
// across its way down: how fast that blows, and how fast it swings, in radians a second. It falls this much of its speed at
// the ends of a swing, and this much more through the middle.
const FALL_SPEED = 1.4;
const FLUTTER_SPEED = [1, 3];
const FLUTTER_RATE = [3.5, 6];
const FLUTTER_SLOWEST_FALL = 0.6;
const FLUTTER_FALL_SWING = 0.8;
// A gust is a wind of one push or, now and then, a blow: several in a row, each coming before the last has died down
// (at this share of its length), carrying a bill much farther, and mostly along rather than up. A push hits at once and
// dies away. How long it lasts in seconds, and how fast it blows across the room and upward, in world units a second.
// Sometimes it doesn't lift at all, and a bill skids along the floor.
const BLOW_CHANCE = 0.3;
const BLOW_PUSHES = [3, 6];
const BLOW_OVERLAP = [0.5, 0.85];
const PUSH_SECONDS = [0.5, 1.2];
const PUSH_SPEED = [3.5, 7.5];
const BLOW_PUSH_SPEED = [5, 10];
const PUSH_LIFT = [1.5, 5];
const BLOW_PUSH_LIFT = [0.5, 4];
const SKID_CHANCE = 0.3;
// What sets one gust's curve from another's, besides: how far its way turns over its length, in radians, and an eddy,
// which swings a bill round as it goes, into a wave or not at all: how fast it blows, and how fast it turns, in radians a
// second, either way. A whirl, now and then, is mostly eddy: it spirals a bill upward rather than carrying it along.
const GUST_TURN = [-0.8, 0.8];
const EDDY_SPEED = [0, 3.5];
const EDDY_RATE = [3, 8];
const WHIRL_CHANCE = 0.15;
const WHIRL_ALONG = 0.2;
const WHIRL_SECONDS = [1, 2.4];
const WHIRL_LIFT = [2.5, 4];
const WHIRL_SPEED = [4, 7];
// Directions are tried evenly round a bill, enough that a few people can't rule them all out; one this near the way to
// anyone (in radians) is one blowing it toward them, and one with less than this much room goes nowhere much.
const GUST_DIRECTIONS = 12;
const GUST_MIN_ANGLE = Math.PI / 6;
const GUST_MIN_ROOM = 0.5;
// A gust's curve may bring a bill nearer to someone only while it stays this far from them, out of their reach; this many
// curves are tried, and with none of them keeping clear, it doesn't blow.
const GUST_KEEP_AWAY = DOLLAR_BILL_REACH + 1;
const GUST_TRIES = 6;
// A stream carries a bill as fast as the root of its push by this much, to read about as its strength does, and rises
// this fast going across the room.
const BLOWN_PACE = 0.6;
const BLOWN_LIFT = 0.4;
const CALM: Vec3 = {x: 0, y: 0, z: 0};

// Where a bill flies: paths of waypoints that never pass through a block, worked out from the wind it is blown on, and
// ending lying on whatever is under it.
const DollarBillFlightUtil =
{
    isInBlock: (voxels: Voxel[], pos: Vec3): boolean =>
    {
        return !isFree(voxels, pos);
    },
    // Whether it lies on something, rather than hanging in the air.
    isLying: (voxels: Voxel[], pos: Vec3): boolean =>
    {
        return pos.y - getLyingHeight(voxels, pos) <= SKIM;
    },
    // Whether no block stands on the straight way from one place to another, as an eye sees past them.
    isInSight: (voxels: Voxel[], from: Vec3, to: Vec3): boolean =>
    {
        const numSteps = Math.ceil(Math.sqrt(Vector3DUtil.distSqr(from, to)) / SEARCH_STEP);
        for (let step = 1; step < numSteps; ++step)
        {
            const t = step / numSteps;
            if (VoxelQueryUtil.isVoxelBlockPresentAt(voxels, VoxelQueryUtil.getVoxelRowFromWorldZ(from.z + (to.z - from.z) * t),
                VoxelQueryUtil.getVoxelColFromWorldX(from.x + (to.x - from.x) * t),
                VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(from.y + (to.y - from.y) * t)))
                return false;
        }
        return true;
    },
    // A random gust's flight, no two of the same curve, toward nobody; none if it can find no such flight.
    planGust: (voxels: Voxel[], from: Vec3, people: Vec3[]): ObjectWaypoint[] =>
    {
        const numPushes = (Math.random() < BLOW_CHANCE) ? Math.round(randomBetween(BLOW_PUSHES)) : 1;
        for (let i = 0; i < GUST_TRIES; ++i)
        {
            const gust = createGust(DollarBillFlightUtil.pickGustDirection(voxels, from, people), numPushes);
            const flight = DollarBillFlightUtil.planFlight(voxels, from, gust.wind, gust.seconds);
            if (keepsAway(flight, from, people))
                return flight;
        }
        return [];
    },
    // A random way a gust might blow, of those pointing at nobody with room for it to go. Failing that, of those pointing
    // at nobody, the one with the most room; failing that, the one bearing least on anyone.
    pickGustDirection: (voxels: Voxel[], from: Vec3, people: Vec3[]): Vec3 =>
    {
        const firstAngle = 2 * Math.PI * Math.random();
        let best: Vec3 = {x: 1, y: 0, z: 0};
        let bestScore = -Infinity;
        for (let i = 0; i < GUST_DIRECTIONS; ++i)
        {
            const angle = firstAngle + 2 * Math.PI * i / GUST_DIRECTIONS;
            const direction = {x: Math.cos(angle), y: 0, z: Math.sin(angle)};
            const offPeople = Math.min(Math.PI, ...people.map(person => getAngleOff(from, direction, person)));
            const wanted = Vector3DUtil.add(from, Vector3DUtil.scale(direction, GUST_MIN_ROOM));
            const room = Math.sqrt(Vector3DUtil.distSqr(from, getReached(voxels, from, wanted)));
            const score = (offPeople < GUST_MIN_ANGLE) ? offPeople / GUST_MIN_ANGLE
                : (room < GUST_MIN_ROOM) ? 1 + room / GUST_MIN_ROOM : 2 + Math.random();
            if (score > bestScore)
            {
                best = direction;
                bestScore = score;
            }
        }
        return best;
    },
    // What a stream does to it (see PhysicsForceUtil.getStrongestStream): takes it to the end of its reach, or to the first
    // block, the stronger the faster.
    planBlow: (voxels: Voxel[], from: Vec3, stream: {normal: Vec3, distance: number, acceleration: number,
        range: number}): ObjectWaypoint[] =>
    {
        const speed = Math.min(MAX_SPEED, BLOWN_PACE * Math.sqrt(stream.acceleration));
        const wind = {x: stream.normal.x * speed, y: stream.normal.y * speed + FALL_SPEED + BLOWN_LIFT,
            z: stream.normal.z * speed};
        return DollarBillFlightUtil.planFlight(voxels, from, () => wind, (stream.range - stream.distance) / speed);
    },
    // A flight on a wind, given as how it blows at each moment for so many seconds, then down onto whatever is under where
    // that leaves it. Whatever it runs into stops it and it drops, but it skids along a floor. No waypoints if it can go
    // nowhere.
    planFlight: (voxels: Voxel[], from: Vec3, wind: (seconds: number) => Vec3, windSeconds: number): ObjectWaypoint[] =>
    {
        const waypoints: ObjectWaypoint[] = [];
        const velocity = {x: 0, y: 0, z: 0};
        const windGrip = getGrip(WIND_GRIP);
        const glideGrip = getGrip(GLIDE_GRIP);
        const flutter = createFlutter();
        let at = from;
        let secondsOnLeg = 0;
        for (let seconds = 0; seconds < MAX_FLIGHT_SECONDS; seconds += FLIGHT_STEP)
        {
            const blowing = seconds < windSeconds;
            const lying = DollarBillFlightUtil.isLying(voxels, at);
            if (lying && !blowing)
                break;

            const blow = blowing ? wind(seconds) : flutter(seconds);
            const grip = blowing ? windGrip : glideGrip;
            const drag = lying ? FLOOR_DRAG : 1;
            velocity.x += (blow.x * drag - velocity.x) * grip;
            velocity.y += (blow.y - FALL_SPEED - velocity.y) * windGrip;
            velocity.z += (blow.z * drag - velocity.z) * grip;

            const wanted = {x: at.x + velocity.x * FLIGHT_STEP, y: at.y + velocity.y * FLIGHT_STEP,
                z: at.z + velocity.z * FLIGHT_STEP};
            const floor = getLyingHeight(voxels, {x: wanted.x, y: at.y, z: wanted.z});
            if (wanted.y <= floor + SKIM)
            {
                wanted.y = floor;
                velocity.y = 0;
            }
            const reached = getReached(voxels, at, wanted);
            secondsOnLeg += FLIGHT_STEP;
            const length = Math.sqrt(Vector3DUtil.distSqr(at, reached));
            if (length >= MIN_LEG)
            {
                waypoints.push({pos: reached, speed: Math.min(MAX_SPEED, length / secondsOnLeg)});
                at = reached;
                secondsOnLeg = 0;
            }
            if (reached !== wanted)
                break;
        }
        return [...waypoints, ...DollarBillFlightUtil.planFall(voxels, at)];
    },
    // Straight down onto whatever is under it; no waypoints if it lies there already.
    planFall: (voxels: Voxel[], from: Vec3): ObjectWaypoint[] =>
    {
        if (DollarBillFlightUtil.isLying(voxels, from))
            return [];
        return [{pos: {x: from.x, y: getLyingHeight(voxels, from), z: from.z}, speed: FALL_SPEED}];
    },
    // Down through still air, like a leaf.
    planFlutterDown: (voxels: Voxel[], from: Vec3): ObjectWaypoint[] =>
    {
        return DollarBillFlightUtil.planFlight(voxels, from, () => CALM, 0);
    },
}

// A share of the way to what it follows, taken in each step of a flight.
function getGrip(grip: number): number
{
    return 1 - Math.exp(-grip * FLIGHT_STEP);
}

// The wind a bill feels as it falls: to and fro along a random line, and up against its fall at the ends of each swing.
function createFlutter(): (seconds: number) => Vec3
{
    const angle = 2 * Math.PI * Math.random();
    const speed = randomBetween(FLUTTER_SPEED);
    const rate = randomBetween(FLUTTER_RATE);
    return (seconds: number): Vec3 =>
    {
        const swing = Math.sin(rate * seconds);
        return {x: speed * swing * Math.cos(angle), z: speed * swing * Math.sin(angle),
            y: FALL_SPEED * (1 - FLUTTER_SLOWEST_FALL - FLUTTER_FALL_SWING * swing * swing)};
    };
}

// A random gust along a direction: its wind, and how long it blows. Its pushes share its way and its eddy, which die down
// with them.
function createGust(direction: Vec3, numPushes: number): {wind: (seconds: number) => Vec3, seconds: number}
{
    const blow = numPushes > 1;
    const whirl = !blow && Math.random() < WHIRL_CHANCE;
    const pushes: {start: number, seconds: number, speed: number, lift: number}[] = [];
    let start = 0;
    for (let i = 0; i < numPushes; ++i)
    {
        const seconds = randomBetween(whirl ? WHIRL_SECONDS : PUSH_SECONDS);
        const speed = randomBetween(blow ? BLOW_PUSH_SPEED : PUSH_SPEED) * (whirl ? WHIRL_ALONG : 1);
        const lift = whirl ? randomBetween(WHIRL_LIFT) : (Math.random() < SKID_CHANCE) ? 0
            : randomBetween(blow ? BLOW_PUSH_LIFT : PUSH_LIFT);
        pushes.push({start, seconds, speed, lift});
        start += seconds * randomBetween(BLOW_OVERLAP);
    }
    const lastPush = pushes[pushes.length - 1];
    const seconds = lastPush.start + lastPush.seconds;

    const firstAngle = Math.atan2(direction.z, direction.x);
    const turn = randomBetween(GUST_TURN);
    const eddySpeed = randomBetween(whirl ? WHIRL_SPEED : EDDY_SPEED);
    const eddyRate = randomBetween(EDDY_RATE) * ((Math.random() < 0.5) ? -1 : 1);
    const eddyPhase = 2 * Math.PI * Math.random();

    const wind = (now: number): Vec3 =>
    {
        let along = 0, up = 0, level = 0;
        for (const push of pushes)
        {
            const pushLevel = getPushLevel((now - push.start) / push.seconds);
            along += pushLevel * push.speed;
            up += pushLevel * push.lift;
            level = Math.max(level, pushLevel);
        }
        const angle = firstAngle + turn * now / seconds;
        const eddyAngle = eddyPhase + eddyRate * now;
        return {x: along * Math.cos(angle) + level * eddySpeed * Math.cos(eddyAngle), y: up,
            z: along * Math.sin(angle) + level * eddySpeed * Math.sin(eddyAngle)};
    };
    return {wind, seconds};
}

// How hard a push blows, from none to full, at a share of its length: all at once, then dying away.
function getPushLevel(share: number): number
{
    return (share <= 0 || share >= 1) ? 0 : Math.sin(Math.PI * Math.sqrt(share));
}

// Whether a flight brings a bill no nearer to anyone than it was, while it is near them at all.
function keepsAway(flight: ObjectWaypoint[], from: Vec3, people: Vec3[]): boolean
{
    return people.every(person =>
    {
        const nearest = Math.min(GUST_KEEP_AWAY, getDistanceAcross(from, person));
        return flight.every(({pos}) => getDistanceAcross(pos, person) >= nearest);
    });
}

// How far apart two places are across the room. Over or under counts for nothing.
function getDistanceAcross(a: Vec3, b: Vec3): number
{
    return Math.hypot(a.x - b.x, a.z - b.z);
}

// Whether a bill there touches no block, nor anything beyond the room.
function isFree(voxels: Voxel[], pos: Vec3): boolean
{
    return isWayFree(voxels, pos, pos);
}

// Whether a bill touches no block on the straight way between two places a search step apart: anywhere on it, it is
// within the box around both, so that even a block's corner it would only clip counts.
function isWayFree(voxels: Voxel[], from: Vec3, to: Vec3): boolean
{
    const lowest = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(Math.min(from.y, to.y) - DOLLAR_BILL_REST_HEIGHT + SKIM);
    const highest = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(Math.max(from.y, to.y));
    for (let layer = lowest; layer <= highest; ++layer)
    {
        if (isAreaOverBlock(voxels, Math.min(from.x, to.x) - CLEARANCE, Math.max(from.x, to.x) + CLEARANCE,
            Math.min(from.z, to.z) - CLEARANCE, Math.max(from.z, to.z) + CLEARANCE, layer))
            return false;
    }
    return true;
}

// Whether any part of a bill there lies over a block in the layer.
function isOverBlock(voxels: Voxel[], pos: Vec3, layer: number): boolean
{
    return isAreaOverBlock(voxels, pos.x - CLEARANCE, pos.x + CLEARANCE, pos.z - CLEARANCE, pos.z + CLEARANCE, layer);
}

// Asked at the middle and at each edge of an area narrower than two blocks, so that no block comes between the points asked.
function isAreaOverBlock(voxels: Voxel[], minX: number, maxX: number, minZ: number, maxZ: number, layer: number): boolean
{
    for (const z of [minZ, 0.5 * (minZ + maxZ), maxZ])
    {
        for (const x of [minX, 0.5 * (minX + maxX), maxX])
        {
            if (VoxelQueryUtil.isVoxelBlockPresentAt(voxels, VoxelQueryUtil.getVoxelRowFromWorldZ(z),
                VoxelQueryUtil.getVoxelColFromWorldX(x), layer))
                return true;
        }
    }
    return false;
}

// Where a bill lies, on the first thing under it: its height over the room's floor, which counts as a block.
function getLyingHeight(voxels: Voxel[], pos: Vec3): number
{
    let layer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(pos.y - DOLLAR_BILL_REST_HEIGHT + SKIM);
    while (!isOverBlock(voxels, pos, layer - 1))
        --layer;
    return layer * COLLISION_LAYER_HEIGHT + DOLLAR_BILL_REST_HEIGHT;
}

// The last place free of blocks on the straight way from one place to another; the very object "to", if all of it is.
function getReached(voxels: Voxel[], from: Vec3, to: Vec3): Vec3
{
    const numSteps = Math.ceil(Math.sqrt(Vector3DUtil.distSqr(from, to)) / SEARCH_STEP);
    let reached = from;
    for (let step = 1; step <= numSteps; ++step)
    {
        const t = step / numSteps;
        const place = {x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t};
        if (!isWayFree(voxels, reached, place))
            return reached;
        reached = place;
    }
    return to;
}

// The angle between a direction across the room and the way to someone, in radians. Over or under it counts for nothing.
function getAngleOff(from: Vec3, direction: Vec3, person: Vec3): number
{
    const x = person.x - from.x, z = person.z - from.z;
    const distance = Math.hypot(x, z);
    return (distance == 0) ? Math.PI : Math.acos(Math.max(-1, Math.min(1, (x * direction.x + z * direction.z) / distance)));
}

function randomBetween(range: number[]): number
{
    return range[0] + Math.random() * (range[1] - range[0]);
}

export default DollarBillFlightUtil;
