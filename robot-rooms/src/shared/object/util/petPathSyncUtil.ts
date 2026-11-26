import Vec3 from "../../math/types/vec3";
import ObjectWaypoint from "../types/objectWaypoint";
import PetBehavior from "../types/petBehavior";
import PetPathSync from "../types/petPathSync";
import NpcFacingUtil from "./npcFacingUtil";
import ObjectPathUtil from "./objectPathUtil";
import { PET_MAX_DEGREES_OFF_WAY } from "./petBehaviorUtil";
import PetBodyUtil from "./petBodyUtil";

// A pet is off its way once its body has been this far from where its room has had it since its last beat, or has it
// going soon; and, once the room is told so, for as long as its body goes on being any farther than that from where
// the room is yet to have it.
const DRIFT_DISTANCE = 0.25;
const CARRIED_DISTANCE = 0.02;
// Soon: within a beat, by which the room may have the pet behind its body (see takeWaypoints), and this much more.
const LAG_MARGIN_SECONDS = 0.1;
// Where its body is is kept this often, in seconds, and no more such points than this from one beat to the next.
const TRAIL_STEP_SECONDS = 0.05;
const MAX_TRAIL_POINTS = 8;
// A point of a trail nearer the one before it than this is passed over, unless it is the last; and none counts as
// reached in less time than this.
const MIN_TRAIL_DISTANCE = 0.01;
const MIN_TRAIL_SECONDS = 0.01;
// The fastest and the slowest a waypoint's speed holds, in world units a second (see SetObjectPathSignal).
const MAX_SPEED = 15.9;
const MIN_SPEED = 1 / 16;
// The most points of a way told at once.
export const PET_WAY_MAX_WAYPOINTS = 32;
// A stretch shorter than this turns it nowhere.
const TURNING_DISTANCE = 0.05;

// How whoever plays a pet keeps its room in step with it without telling every move (see SetObjectPathSignal): the room
// is told the way the pet sets off on, and how fast, and plays that out by itself; this plays it out likewise. Whenever
// physics has the pet off that way (a push, a fall, a fan's wind), the room is told where its body has been instead, a
// few points to each beat, and plays those a beat behind, each in the time the body took: so the pet is never brought
// anywhere at a rush, however it is thrown about.
const PetPathSyncUtil =
{
    create: (pos: Vec3): PetPathSync =>
    {
        return {waypoints: [], next: 0, shownAt: {...pos}, revision: -1, turning: false, untold: 0, carried: false,
            shownTrail: [{...pos}], trail: [], sinceTrail: 0};
    },
    // Moves where the room has the pet on by a stretch of time, as each browser does.
    advance: (sync: PetPathSync, seconds: number): void =>
    {
        const from = sync.next;
        sync.next = ObjectPathUtil.advance(sync.waypoints, from, sync.shownAt, seconds);
        for (let i = from; i < sync.next; ++i)
            sync.shownTrail.push(sync.waypoints[i].pos);
    },
    // Keeps where the pet's body is, a step of so many seconds after it was last kept: from whoever plays it, at each
    // step of its body.
    trace: (sync: PetPathSync, pos: Vec3, seconds: number): void =>
    {
        sync.sinceTrail += seconds;
        if (sync.sinceTrail < TRAIL_STEP_SECONDS)
            return;
        sync.trail.push({pos: {...pos}, seconds: sync.sinceTrail});
        sync.sinceTrail = 0;
        // (A beat late in coming: the oldest points go, and their time to the next.)
        while (sync.trail.length > MAX_TRAIL_POINTS)
        {
            const oldest = sync.trail.shift()!;
            sync.trail[0].seconds += oldest.seconds;
        }
    },
    // The way to tell the room now, if it is to be told one, at each beat of the pet. Its own way, when it has set off
    // on another, has stopped to turn to its way or has turned to it, or has gone as far as it was told: a stretch at a
    // time, as far as the next point it stands and turns at (see PetBehavior.turning), where the room has it stand until
    // it is told the next. And ahead of that, where its body has been since the last beat, whenever that was off the way
    // the room plays: at first only where it is now, which the room takes it to in a beat's time, and from then on every
    // point kept. pos: its middle, as physics has left it.
    takeWaypoints: (sync: PetPathSync, b: PetBehavior, pos: Vec3): ObjectWaypoint[] | undefined =>
    {
        const trail = takeTrail(sync, pos);
        const seconds = trail.reduce((total, point) => total + point.seconds, 0);
        // Told where its body had been, the room has it a beat behind that, coming the same way: only where it is yet to
        // have the pet tells whether the body has moved on of itself, or not at all.
        const shown = getShownWay(sync, seconds + LAG_MARGIN_SECONDS, !sync.carried);
        const reach = sync.carried ? CARRIED_DISTANCE : DRIFT_DISTANCE;
        const offWay = trail.some(point => getDistanceToWay(point.pos, shown) > reach);
        sync.shownTrail = [{...sync.shownAt}];
        const going = b.path.length > 0 && !b.turning;
        const stretchDone = going && sync.untold > 0 && b.path.length <= sync.untold;
        if (b.pathRevision == sync.revision && b.turning == sync.turning && !stretchDone && !offWay)
        {
            sync.carried = false;
            return undefined;
        }
        sync.revision = b.pathRevision;
        sync.turning = b.turning;

        const waypoints: ObjectWaypoint[] = [];
        if (offWay)
            addTrail(waypoints, sync.shownAt, sync.carried ? trail : [{pos, seconds}]);
        sync.carried = offWay;
        if (going)
        {
            const count = Math.min(countStretch(b), PET_WAY_MAX_WAYPOINTS - waypoints.length);
            let from = pos;
            for (const feet of b.path.slice(0, count))
            {
                const to = PetBodyUtil.getStandingPos(feet);
                waypoints.push({pos: to, speed: getPace(from, to, b.speed)});
                from = to;
            }
            sync.untold = b.path.length - count;
        }
        else
        {
            sync.untold = b.path.length;
            if (!offWay)
            {
                // Standing, which the room has it do already where the way it was told ends about here.
                const end = sync.waypoints[sync.waypoints.length - 1]?.pos ?? sync.shownAt;
                if (getDistance(pos, end) <= DRIFT_DISTANCE)
                    return undefined;
                addTrail(waypoints, sync.shownAt, [{pos, seconds}]);
            }
        }
        sync.waypoints = waypoints;
        sync.next = 0;
        return waypoints;
    },
    // Plays a way a room was told out for a stretch of time, as each browser does, and the server: moves a pet's middle
    // on along it, in place, and gives the waypoint it goes to after that, with the way it faces across the floor
    // meanwhile (see NpcFacingUtil), if its way says: toward the next place it goes to by itself, wherever it is carried
    // first.
    follow: (waypoints: ObjectWaypoint[], next: number, pos: Vec3, seconds: number): {next: number, facing: number | undefined} =>
    {
        let own = next;
        while (own < waypoints.length && waypoints[own].carried)
            ++own;
        const to = waypoints[own];
        const turns = to != undefined && Math.hypot(to.pos.x - pos.x, to.pos.z - pos.z) > TURNING_DISTANCE;
        const facing = turns ? NpcFacingUtil.getDegrees({x: to.pos.x - pos.x, y: 0, z: to.pos.z - pos.z}) : undefined;
        return {next: ObjectPathUtil.advance(waypoints, next, pos, seconds), facing};
    },
}

// Where a pet's body has been since this was last asked, ending where it is now. What is kept starts anew.
function takeTrail(sync: PetPathSync, pos: Vec3): {pos: Vec3, seconds: number}[]
{
    const trail = sync.trail;
    const last = trail[trail.length - 1];
    if (last != undefined && sync.sinceTrail < MIN_TRAIL_SECONDS)
    {
        last.pos = {...pos};
        last.seconds += sync.sinceTrail;
    }
    else
        trail.push({pos: {...pos}, seconds: sync.sinceTrail});
    sync.trail = [];
    sync.sinceTrail = 0;
    return trail;
}

// Adds the points of a trail to a way, as places the pet is carried to from where the room has it, each in the time
// its body took.
function addTrail(waypoints: ObjectWaypoint[], from: Vec3, trail: {pos: Vec3, seconds: number}[]): void
{
    let at = from;
    let seconds = 0;
    trail.forEach((point, i) => {
        seconds += point.seconds;
        const distance = getDistance(at, point.pos);
        if (distance < MIN_TRAIL_DISTANCE && i < trail.length - 1)
            return;
        const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, distance / Math.max(seconds, MIN_TRAIL_SECONDS)));
        waypoints.push({pos: {...point.pos}, speed, carried: true});
        at = point.pos;
        seconds = 0;
    });
}

// The way the room has the pet come, as the points it goes through: since the pet's last beat, if that is asked for,
// and from where it has the pet now on for a stretch of time.
function getShownWay(sync: PetPathSync, seconds: number, sinceLastBeat: boolean): Vec3[]
{
    const way = sinceLastBeat ? [...sync.shownTrail, sync.shownAt] : [sync.shownAt];
    let from = sync.shownAt;
    let secondsLeft = seconds;
    for (let i = sync.next; i < sync.waypoints.length && secondsLeft > 0; ++i)
    {
        const to = sync.waypoints[i].pos;
        const speed = Math.max(MIN_SPEED, sync.waypoints[i].speed);
        const length = getDistance(from, to);
        const share = (length < 1e-9) ? 1 : Math.min(1, speed * secondsLeft / length);
        way.push({x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share,
            z: from.z + (to.z - from.z) * share});
        secondsLeft -= length / speed;
        from = to;
    }
    return way;
}

// How far a point is from the nearest point of a way, given as the points it goes through.
function getDistanceToWay(pos: Vec3, way: Vec3[]): number
{
    let least = getDistance(pos, way[0]);
    for (let i = 0; i + 1 < way.length; ++i)
    {
        const from = way[i];
        const along = {x: way[i + 1].x - from.x, y: way[i + 1].y - from.y, z: way[i + 1].z - from.z};
        const lengthSqr = along.x * along.x + along.y * along.y + along.z * along.z;
        const at = (lengthSqr < 1e-12) ? 0 : Math.min(1, Math.max(0,
            ((pos.x - from.x) * along.x + (pos.y - from.y) * along.y + (pos.z - from.z) * along.z) / lengthSqr));
        least = Math.min(least,
            Math.hypot(pos.x - from.x - along.x * at, pos.y - from.y - along.y * at, pos.z - from.z - along.z * at));
    }
    return least;
}

// How fast a stretch of a pet's own way is played, for the room to have it keep the pet's pace across the floor: a
// climb or a drop makes the stretch longer than the floor it covers.
function getPace(from: Vec3, to: Vec3, speed: number): number
{
    const flat = Math.hypot(to.x - from.x, to.z - from.z);
    return (flat < TURNING_DISTANCE) ? speed : Math.min(MAX_SPEED, speed * getDistance(from, to) / flat);
}

function getDistance(a: Vec3, b: Vec3): number
{
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

// How many points of its way a pet goes to before the first it will stand and turn at: a corner sharper than it takes
// going.
function countStretch(b: PetBehavior): number
{
    for (let i = 0; i + 1 < b.path.length; ++i)
    {
        if (getCorner((i == 0) ? b.at : b.path[i - 1], b.path[i], b.path[i + 1]) > PET_MAX_DEGREES_OFF_WAY)
            return i + 1;
    }
    return b.path.length;
}

// How far a way turns at a point of it, across the floor, in degrees: nothing where either stretch is too short to
// turn anything.
function getCorner(from: Vec3, at: Vec3, to: Vec3): number
{
    const before = {x: at.x - from.x, y: 0, z: at.z - from.z};
    const after = {x: to.x - at.x, y: 0, z: to.z - at.z};
    if (Math.hypot(before.x, before.z) < TURNING_DISTANCE || Math.hypot(after.x, after.z) < TURNING_DISTANCE)
        return 0;
    return Math.abs(NpcFacingUtil.getTurn(NpcFacingUtil.getDegrees(before), NpcFacingUtil.getDegrees(after)));
}

export default PetPathSyncUtil;
