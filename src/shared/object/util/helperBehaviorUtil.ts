import Vec3 from "../../math/types/vec3";
import { HELPER_AGENT_NAME } from "../../system/sharedConstants";
import VoxelPathUtil from "../../voxel/util/voxelPathUtil";
import NpcPersonalityMap from "../maps/npcPersonalityMap";
import AddObjectSignal from "../types/addObjectSignal";
import HelperBehavior from "../types/helperBehavior";
import HelperSurroundings from "../types/helperSurroundings";
import NpcObjectTypeConfig from "../types/objectTypeConfig/npcObjectTypeConfig";
import LabelTextUtil from "./labelTextUtil";
import MessageLinkUtil from "./messageLinkUtil";
import NpcFacingUtil from "./npcFacingUtil";
import QuarterTurnsUtil from "./quarterTurnsUtil";

// How an NPC behaves as a helper, wherever it is played: by the server in a multiplayer room (see HelperAgentUtil), and
// by the browser in a single-player room, which is the browser's alone (see SinglePlayerHelperUtil). It keeps within its
// wander radius of home and a little way off from people, walks round blocks, faces whom it talks with, and says one
// thing at a time, each up long enough to be read. Whoever plays it decides whom it greets, and what it answers.

const UP: Vec3 = {x: 0, y: 1, z: 0};
// Someone this near on its own floor (feet within this height of its own) is in earshot.
const HEARING_DISTANCE = 8;
const SAME_FLOOR_HEIGHT = 1;
// Someone's lines are answered together once they have paused this long.
export const ANSWER_PAUSE_MS = 1500;
// How long a bubble stays before the next, so it can be read: a moment to notice it, then its words at an easy pace, as
// many read English as a second language. The last is taken down once it has been quiet this long.
const MIN_BUBBLE_MS = 3000;
const BUBBLE_NOTICE_MS = 1000;
const BUBBLE_MS_PER_CHAR = 80;
const BUBBLE_CLEARED_AFTER_MS = 20_000;
// A stroll, in world units a second.
const WALK_SPEED = 2;
// It goes from home as far as its wander radius allows (see NpcObjectTypeConfig), idly, and part of the way to meet
// someone it answers from farther off than APPROACH_FROM, to stop MEETING_DISTANCE short of them. It never walks up
// closer than PERSONAL_SPACE to anyone, so that its bubble keeps in their view, and tries a few ways to wander before
// giving up on one that close to someone.
const APPROACH_FROM = 5;
const MEETING_DISTANCE = 3.5;
const PERSONAL_SPACE = 3;
const WANDER_TRIES = 4;
// Idle at home this long between wanders, and away this long before it heads back (or, after a talk, this long after it).
const WANDER_INTERVAL_MS = [20_000, 40_000];
const WANDER_STAY_MS = [8_000, 15_000];
const STAY_AFTER_TALK_MS = 30_000;
// Still this long after it was moved somewhere new, or let go of.
export const FROZEN_AFTER_MOVE_MS = 10_000;
const FROZEN_AFTER_RELEASE_MS = 3000;
// Speaking to several at once, it looks at each in turn, this long each.
const GLANCE_MS = 2000;
// A turn smaller than this isn't shown.
const MIN_TURN_DEGREES = 2;
// Two positions this close are the same place.
const SAME_PLACE = 0.05;
const GUEST_NAME_PATTERN = /^guest-/i;

const HelperBehaviorUtil =
{
    // A helper as first found where its NPC stands.
    create: (obj: AddObjectSignal, now: number): HelperBehavior =>
    {
        const quarterTurns = QuarterTurnsUtil.getQuarterTurns(obj);
        const behavior: HelperBehavior = {name: "", wanderRadius: 0, personality: "guide", home: {...obj.transform.pos},
            homeQuarterTurns: quarterTurns, at: {...obj.transform.pos},
            facing: HelperBehaviorUtil.getFacingPut(quarterTurns), saying: "", path: [], talkingWith: [], talkingSince: 0,
            frozenUntil: 0,
            nextWanderAt: now + randomBetween(WANDER_INTERVAL_MS), returnHomeAt: 0, lastTalkAt: -Infinity,
            answering: undefined, bubbles: [], nextBubbleAt: 0};
        HelperBehaviorUtil.takeSettings(behavior, obj);
        return behavior;
    },
    // What an admin has set on its NPC (see NpcObjectTypeConfig), taken up as it changes.
    takeSettings: (behavior: HelperBehavior, obj: AddObjectSignal): void =>
    {
        behavior.name = LabelTextUtil.toName(LabelTextUtil.getText(obj));
        behavior.wanderRadius = NpcObjectTypeConfig.util.getWanderRadius(obj);
        behavior.personality = NpcObjectTypeConfig.util.getPersonality(obj);
    },
    // Whether an NPC is played as a helper at all, as its personality has it.
    isPlayed: (obj: AddObjectSignal): boolean =>
    {
        return NpcPersonalityMap.isPlayed(NpcObjectTypeConfig.util.getPersonality(obj));
    },
    // A flush's worth of its life: a step along its way, or else a look at whom it talks with.
    act: (behavior: HelperBehavior, surroundings: HelperSurroundings, seconds: number, now: number): void =>
    {
        if (behavior.path.length > 0)
            step(behavior, surroundings, seconds);
        else if (!surroundings.isHeld())
            look(behavior, surroundings, now);
    },
    // A beat's worth, each second, once whoever plays it has had it greet and answer: its next bubble, and a wander,
    // unless someone's lines wait for an answer.
    beat: (behavior: HelperBehavior, surroundings: HelperSurroundings, now: number, linesWaiting: boolean): void =>
    {
        speakNextBubble(behavior, surroundings, now);
        if (!linesWaiting)
            wander(behavior, surroundings, now);
    },
    // Of the helpers in a room, the one a line is for: one it names, else the nearest in earshot of whoever said it, or
    // the nearest at all to one calling for a helper.
    pickListener: <T extends HelperBehavior>(helpers: T[], text: string, speaker: Vec3): T | undefined =>
    {
        const named = helpers.find(helper => helper.name.length > 0 && namedIn(text, helper.name));
        if (named != undefined)
            return named;
        const callsForHelper = namedIn(text, HELPER_AGENT_NAME);
        return helpers.filter(helper => callsForHelper || HelperBehaviorUtil.isInEarshot(helper, speaker))
            .sort((a, b) => distanceAcross(speaker, a.at) - distanceAcross(speaker, b.at))[0];
    },
    // It turns to whoever talks to it, unless it is still speaking to someone else.
    hear: (behavior: HelperBehavior, userID: string, now: number): void =>
    {
        behavior.lastTalkAt = now;
        if (!HelperBehaviorUtil.isSpeaking(behavior, now))
            HelperBehaviorUtil.talkWith(behavior, [userID], now);
    },
    // Whether a player (by its position, at its middle) is near enough on its own floor to be heard, and greeted.
    isInEarshot: (behavior: HelperBehavior, playerPos: Vec3): boolean =>
    {
        return distanceAcross(playerPos, behavior.at) <= HEARING_DISTANCE && onFloorOf(behavior, playerPos);
    },
    // Each thing it says is one bubble, a whole greeting or reply (see NPC_MESSAGE_MAX_LENGTH), queued behind whatever it
    // is still saying.
    say: (behavior: HelperBehavior, text: string, to: string[], now: number): void =>
    {
        behavior.bubbles.push({text, to});
        behavior.lastTalkAt = now;
    },
    // Walks toward whoever it answers from farther off, to a little way short of them, as far as it goes from home.
    meet: (behavior: HelperBehavior, surroundings: HelperSurroundings, userID: string, now: number): void =>
    {
        const them = surroundings.getPerson(userID);
        if (them == undefined)
            return;
        behavior.returnHomeAt = now + STAY_AFTER_TALK_MS;
        const feet = VoxelPathUtil.feetOf(them);
        const away = distanceAcross(feet, behavior.at);
        if (away <= APPROACH_FROM || now < behavior.frozenUntil || surroundings.isHeld())
            return;
        // On its own floor, whichever one they stand on.
        const short = MEETING_DISTANCE / away;
        walkTo(behavior, surroundings, clampToLeash(behavior, {x: feet.x + (behavior.at.x - feet.x) * short,
            y: behavior.home.y, z: feet.z + (behavior.at.z - feet.z) * short}));
    },
    talkWith: (behavior: HelperBehavior, userIDs: string[], now: number): void =>
    {
        behavior.talkingWith = userIDs;
        behavior.talkingSince = now;
    },
    // Saying something, about to, or thinking of what to say.
    isSpeaking: (behavior: HelperBehavior, now: number): boolean =>
    {
        return behavior.answering != undefined || behavior.bubbles.length > 0 || now < behavior.nextBubbleAt;
    },
    // Shown back at home, the way it was put, wherever it had gone.
    standAtHome: (behavior: HelperBehavior, surroundings: HelperSurroundings): void =>
    {
        behavior.path = [];
        if (!HelperBehaviorUtil.isSamePlace(behavior.at, behavior.home))
        {
            behavior.at = {...behavior.home};
            surroundings.showAt();
        }
        face(behavior, surroundings, HelperBehaviorUtil.getFacingPut(behavior.homeQuarterTurns));
    },
    // Taken down, whatever it was saying.
    fallSilent: (behavior: HelperBehavior, surroundings: HelperSurroundings): void =>
    {
        behavior.bubbles = [];
        if (behavior.saying.length > 0)
        {
            behavior.saying = "";
            surroundings.showSaying();
        }
    },
    // Once nobody holds it, it stands still a moment more before it goes on.
    letGo: (behavior: HelperBehavior, now: number): void =>
    {
        behavior.frozenUntil = Math.max(behavior.frozenUntil, now + FROZEN_AFTER_RELEASE_MS);
    },
    // How it greets those who come near (several at once all together), by their names; returning: whether they have
    // all been here before.
    getGreeting: (behavior: HelperBehavior, names: string[], returning: boolean): string =>
    {
        const name = (names.length == 1 && !GUEST_NAME_PATTERN.test(names[0])) ? ` ${names[0]}` : "";
        const whom = names.length > 1 ? " everyone" : name;
        const welcome = returning ? "welcome back" : "welcome to ThingsPool";
        // A name alone, which a role after it may only repeat ("Guide, an AI guide"); its bubble says it is an AI (see
        // NpcGameObject.getSpeakerName). One with no name says what it is.
        const me = behavior.name.length > 0 ? `I'm ${behavior.name}.`
            : `I'm an AI ${NpcPersonalityMap.getRole(behavior.personality)}.`;
        return `Hi${whom}, ${welcome}! ${me} ${NpcPersonalityMap.getInvitation(behavior.personality)}`;
    },
    // The way an admin put it to face (see QuarterTurnsUtil).
    getFacingPut: (quarterTurns: number): number =>
    {
        return NpcFacingUtil.getDegrees(QuarterTurnsUtil.getContentUp(UP, quarterTurns));
    },
    isSamePlace: (a: Vec3, b: Vec3): boolean =>
    {
        return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < SAME_PLACE;
    },
}

// It looks at whom each bubble is for as it shows.
function speakNextBubble(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number): void
{
    if (behavior.bubbles.length == 0)
    {
        if (behavior.saying.length > 0 && now >= behavior.nextBubbleAt + BUBBLE_CLEARED_AFTER_MS)
        {
            behavior.saying = "";
            surroundings.showSaying();
        }
        return;
    }
    if (now < behavior.nextBubbleAt)
        return;
    const {text, to} = behavior.bubbles.shift()!;
    behavior.saying = text;
    surroundings.showSaying();
    behavior.nextBubbleAt = now + Math.max(MIN_BUBBLE_MS,
        BUBBLE_NOTICE_MS + BUBBLE_MS_PER_CHAR * MessageLinkUtil.getVisibleLength(text));
    HelperBehaviorUtil.talkWith(behavior, to, now);
}

// Idle, it wanders off now and then, though not up to anyone, and heads home a while after.
function wander(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number): void
{
    if (behavior.path.length > 0 || behavior.answering != undefined || behavior.bubbles.length > 0
        || now < behavior.frozenUntil || surroundings.isHeld())
    {
        return;
    }
    if (!HelperBehaviorUtil.isSamePlace(behavior.at, behavior.home))
    {
        if (now >= behavior.returnHomeAt)
            walkTo(behavior, surroundings, behavior.home);
        return;
    }
    if (behavior.wanderRadius <= 0 || now < behavior.nextWanderAt || now - behavior.lastTalkAt < STAY_AFTER_TALK_MS)
        return;
    behavior.nextWanderAt = now + randomBetween(WANDER_INTERVAL_MS);
    const people = getPeopleOnFloor(behavior, surroundings);
    for (let tries = 0; tries < WANDER_TRIES; ++tries)
    {
        const angle = Math.random() * 2 * Math.PI;
        const reach = behavior.wanderRadius * (0.4 + 0.6 * Math.random());
        const goal = {x: behavior.home.x + reach * Math.cos(angle), y: behavior.home.y,
            z: behavior.home.z + reach * Math.sin(angle)};
        if (people.some(them => distanceAcross(them, goal) < PERSONAL_SPACE))
            continue;
        if (walkTo(behavior, surroundings, goal))
            behavior.returnHomeAt = now + randomBetween(WANDER_STAY_MS);
        return;
    }
}

// A path over the room's floor to near the goal (to the goal itself when that is home), or false if there is none.
function walkTo(behavior: HelperBehavior, surroundings: HelperSurroundings, goal: Vec3): boolean
{
    const start = VoxelPathUtil.findStandingVertexNear(surroundings.voxels, behavior.at, 1);
    const end = VoxelPathUtil.findStandingVertexNear(surroundings.voxels, goal, 1);
    const path = (start == undefined || end == undefined) ? undefined
        : VoxelPathUtil.findPath(surroundings.voxels, start, end);
    if (path == undefined)
        return false;
    behavior.path = path.slice(1).map(vertex => VoxelPathUtil.toWorld(vertex));
    if (HelperBehaviorUtil.isSamePlace(goal, behavior.home))
        behavior.path.push({...behavior.home});
    return behavior.path.length > 0;
}

// Along its way, facing where it goes next. It stops short instead of stepping up closer to anyone than PERSONAL_SPACE.
function step(behavior: HelperBehavior, surroundings: HelperSurroundings, seconds: number): void
{
    let at = behavior.at;
    let reached = 0;
    let left = WALK_SPEED * seconds;
    while (left > 0 && reached < behavior.path.length)
    {
        const next = behavior.path[reached];
        const gap = Math.hypot(next.x - at.x, next.y - at.y, next.z - at.z);
        if (gap <= left)
        {
            at = {...next};
            ++reached;
            left -= gap;
        }
        else
        {
            at = {x: at.x + (next.x - at.x) * left / gap, y: at.y + (next.y - at.y) * left / gap,
                z: at.z + (next.z - at.z) * left / gap};
            left = 0;
        }
    }
    if (getPeopleOnFloor(behavior, surroundings).some(them =>
        distanceAcross(them, at) < PERSONAL_SPACE && distanceAcross(them, at) < distanceAcross(them, behavior.at)))
    {
        behavior.path = [];
        return;
    }
    behavior.at = at;
    behavior.path.splice(0, reached);
    if (behavior.path.length > 0)
        faceToward(behavior, surroundings, behavior.path[0]);
    surroundings.showAt();
}

// Standing, it looks at whom it talks with, and once that is over, at home, the way it was put. Thinking of an answer,
// it turns to whom it is for as soon as it has nothing else left to say.
function look(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number): void
{
    if (behavior.answering != undefined && behavior.bubbles.length == 0 && now >= behavior.nextBubbleAt)
        HelperBehaviorUtil.talkWith(behavior, [behavior.answering], now);
    const them = getGazeTarget(behavior, surroundings, now);
    if (them != undefined)
        faceToward(behavior, surroundings, them);
    else if (HelperBehaviorUtil.isSamePlace(behavior.at, behavior.home) && now - behavior.lastTalkAt >= STAY_AFTER_TALK_MS)
        face(behavior, surroundings, HelperBehaviorUtil.getFacingPut(behavior.homeQuarterTurns));
}

// Where whom it talks with stand: those it speaks to, or is about to answer, wherever they are in its room, each in turn
// for a moment when they are several; once it is done speaking, the nearest of them still in earshot, until it has been
// quiet a while.
function getGazeTarget(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number): Vec3 | undefined
{
    const present = behavior.talkingWith.map(userID => surroundings.getPerson(userID))
        .filter((pos): pos is Vec3 => pos != undefined);
    if (present.length == 0)
        return undefined;
    if (HelperBehaviorUtil.isSpeaking(behavior, now))
        return present[Math.floor((now - behavior.talkingSince) / GLANCE_MS) % present.length];
    if (now - behavior.lastTalkAt >= STAY_AFTER_TALK_MS)
        return undefined;
    return present.filter(pos => HelperBehaviorUtil.isInEarshot(behavior, pos))
        .sort((a, b) => distanceAcross(a, behavior.at) - distanceAcross(b, behavior.at))[0];
}

function faceToward(behavior: HelperBehavior, surroundings: HelperSurroundings, point: Vec3): void
{
    if (distanceAcross(point, behavior.at) >= SAME_PLACE)
        face(behavior, surroundings,
            NpcFacingUtil.getDegrees({x: point.x - behavior.at.x, y: 0, z: point.z - behavior.at.z}));
}

// Browsers turn it there over a moment (see NpcGameObject).
function face(behavior: HelperBehavior, surroundings: HelperSurroundings, degrees: number): void
{
    if (Math.abs(NpcFacingUtil.getTurn(behavior.facing, degrees)) < MIN_TURN_DEGREES)
        return;
    behavior.facing = degrees;
    surroundings.showFacing();
}

// Within its wander radius of home.
function clampToLeash(behavior: HelperBehavior, point: Vec3): Vec3
{
    const away = distanceAcross(point, behavior.home);
    if (away <= behavior.wanderRadius)
        return point;
    return {x: behavior.home.x + (point.x - behavior.home.x) * behavior.wanderRadius / away, y: point.y,
        z: behavior.home.z + (point.z - behavior.home.z) * behavior.wanderRadius / away};
}

function getPeopleOnFloor(behavior: HelperBehavior, surroundings: HelperSurroundings): Vec3[]
{
    return surroundings.getPeople().filter(pos => onFloorOf(behavior, pos));
}

// Whether a player (by its position, at its middle) stands on the helper's own floor.
function onFloorOf(behavior: HelperBehavior, playerPos: Vec3): boolean
{
    return Math.abs(VoxelPathUtil.feetOf(playerPos).y - behavior.at.y) <= SAME_FLOOR_HEIGHT;
}

function namedIn(text: string, name: string): boolean
{
    return new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu")
        .test(text);
}

function distanceAcross(a: Vec3, b: Vec3): number
{
    return Math.hypot(a.x - b.x, a.z - b.z);
}

function randomBetween([min, max]: number[]): number
{
    return min + Math.random() * (max - min);
}

export default HelperBehaviorUtil;
