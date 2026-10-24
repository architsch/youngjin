import Vec3 from "../../math/types/vec3";
import { HELPER_AGENT_NAME, VOXEL_CELL_SIZE } from "../../system/sharedConstants";
import Voxel from "../../voxel/types/voxel";
import VoxelReach from "../../voxel/types/voxelReach";
import VoxelVertex from "../../voxel/types/voxelVertex";
import VoxelPathUtil from "../../voxel/util/voxelPathUtil";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import NpcPersonalityMap from "../maps/npcPersonalityMap";
import AddObjectSignal from "../types/addObjectSignal";
import BehaviorPrefs from "../types/behaviorPrefs";
import HelperBehavior from "../types/helperBehavior";
import HelperSmallTalk from "../types/helperSmallTalk";
import HelperSurroundings from "../types/helperSurroundings";
import { PLAYER_HEIGHT } from "../types/objectTypeConfig/playerObjectTypeConfig";
import BehaviorPrefsUtil from "./behaviorPrefsUtil";
import LabelTextUtil from "./labelTextUtil";
import MessageLinkUtil from "./messageLinkUtil";
import NpcFacingUtil from "./npcFacingUtil";
import QuarterTurnsUtil from "./quarterTurnsUtil";

// How an NPC behaves as a helper, wherever it is played: by the server in a multiplayer room (see HelperAgentUtil), and
// by the browser in a single-player room, which is the browser's alone (see SinglePlayerHelperUtil). It goes only to
// places within its wander radius of home (its way there may run past it), keeps a little way off from people, walks
// round blocks, faces whom it talks with, says one thing at a time, each up long enough to be read, and now and then
// chats with another helper near it. Whoever plays it decides whom it greets, what it answers, and what it says to
// another helper.

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
// Where it goes, idly or part of the way to meet someone it answers from farther off than APPROACH_FROM (to stop
// MEETING_DISTANCE short of them), is within its wander radius of home (see BehaviorPrefs). It never walks up closer
// than PERSONAL_SPACE to anyone, so that its bubble keeps in their view, nor into another helper.
const APPROACH_FROM = 5;
const MEETING_DISTANCE = 3.5;
const PERSONAL_SPACE = 3;
const HELPER_SPACE = 1;
// Its ways are planned a cell farther off from people than that, since a step between two vertices just clear of
// someone cuts in closer to them.
const PLANNED_SPACE = PERSONAL_SPACE + VOXEL_CELL_SIZE;
// Where it wanders to is at least this share of its radius from where it stands. Kept from going there (or home) this
// long, it wanders off at once to somewhere at least REPICK_DISTANCE from there instead, or as far as its radius allows.
const MIN_WANDER_SHARE = 0.4;
const BLOCKED_GIVE_UP_MS = 2000;
const REPICK_DISTANCE = 2 * PERSONAL_SPACE;
// Its way anywhere is looked for out to a walk this many times as long as the farthest it may go, and a little more.
const MAX_DETOUR = 3;
const DETOUR_SLACK = 4;
// Idle at home (or, roaming, wherever it is) between wanders as long as its prefs say (see BehaviorPrefs), and away this
// long before it heads back (or, after a talk, this long after it).
const WANDER_STAY_MS = [8_000, 15_000];
const STAY_AFTER_TALK_MS = 30_000;
// Still this long after it was moved somewhere new, or let go of.
export const FROZEN_AFTER_MOVE_MS = 10_000;
const FROZEN_AFTER_RELEASE_MS = 3000;
// Speaking to several at once, it looks at each in turn, this long each.
const GLANCE_MS = 2000;
// A turn smaller than this isn't shown.
const MIN_TURN_DEGREES = 2;
// Two helpers this near on one floor, in sight of each other at about head height, chat now and then: each first a
// while after it is found, then a while after each chat it begins.
const SMALL_TALK_DISTANCE = 4;
const FIRST_SMALL_TALK_MS = [45_000, 90_000];
const SMALL_TALK_INTERVAL_MS = [120_000, 300_000];
const SIGHT_HEIGHT = 0.8 * PLAYER_HEIGHT;
const SIGHT_STEP = 0.25;
// Two positions this close are the same place.
const SAME_PLACE = 0.05;
const GUEST_NAME_PATTERN = /^guest-/i;

const HelperBehaviorUtil =
{
    // A helper as first found where its NPC stands.
    create: (obj: AddObjectSignal, now: number): HelperBehavior =>
    {
        const quarterTurns = QuarterTurnsUtil.getQuarterTurns(obj);
        const prefs = BehaviorPrefsUtil.getObjectPrefs(obj);
        const behavior: HelperBehavior = {name: "", prefs,
            home: {...obj.transform.pos}, homeQuarterTurns: quarterTurns, at: {...obj.transform.pos},
            facing: HelperBehaviorUtil.getFacingPut(quarterTurns), saying: "", path: [], walk: "wander",
            blockedSince: undefined, talkingWith: [], talkingSince: 0, frozenUntil: 0,
            nextWanderAt: now + getIdleTime(prefs), returnHomeAt: 0, lastTalkAt: -Infinity,
            answering: undefined, thinking: false, bubbles: [], nextBubbleAt: 0, smallTalk: undefined,
            nextSmallTalkAt: now + randomBetween(FIRST_SMALL_TALK_MS)};
        HelperBehaviorUtil.takeSettings(behavior, obj, now);
        return behavior;
    },
    // What an admin has set on its NPC (see NpcObjectTypeConfig), taken up as it changes: new idle times at once, in
    // place of the wait it was in.
    takeSettings: (behavior: HelperBehavior, obj: AddObjectSignal, now: number): void =>
    {
        behavior.name = LabelTextUtil.toName(LabelTextUtil.getText(obj));
        const prefs = BehaviorPrefsUtil.getObjectPrefs(obj);
        if (prefs.minIdleTime != behavior.prefs.minIdleTime || prefs.maxIdleTime != behavior.prefs.maxIdleTime)
            behavior.nextWanderAt = now + getIdleTime(prefs);
        behavior.prefs = prefs;
    },
    // Whether an NPC is played as a helper at all, as its personality has it.
    isPlayed: (obj: AddObjectSignal): boolean =>
    {
        return NpcPersonalityMap.isPlayed(BehaviorPrefsUtil.getObjectPrefs(obj).personality);
    },
    // A flush's worth of its life: a step along its way (which waits while it chats), or else a look at whom it talks
    // with. Its words in a chat are taken down as soon as the other has answered.
    act: (behavior: HelperBehavior, surroundings: HelperSurroundings, seconds: number, now: number): void =>
    {
        takeDownAnswered(behavior, surroundings);
        if (behavior.path.length > 0 && behavior.smallTalk == undefined)
            step(behavior, surroundings, seconds, now);
        else if (!surroundings.isHeld())
            look(behavior, surroundings, now);
    },
    // A beat's worth, each second, once whoever plays it has had it greet and answer: its next line in a chat with
    // another helper, its next bubble, and a wander, unless someone's lines wait for an answer.
    beat: (behavior: HelperBehavior, surroundings: HelperSurroundings, now: number, linesWaiting: boolean): void =>
    {
        chatOn(behavior, now);
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
    // A line for it, once whoever plays it has kept it to answer: it turns to whoever said it, unless it is still
    // speaking to someone else, and is shown thinking of an answer at once. A chat with another helper ends for it.
    hear: (behavior: HelperBehavior, surroundings: HelperSurroundings, userID: string, now: number): void =>
    {
        const chatting = behavior.smallTalk != undefined;
        HelperBehaviorUtil.endSmallTalk(behavior);
        behavior.lastTalkAt = now;
        if (chatting || !HelperBehaviorUtil.isSpeaking(behavior, now))
            HelperBehaviorUtil.talkWith(behavior, [userID], now);
        showThinking(behavior, surroundings);
    },
    // Whether a player (by its position, at its middle) is near enough on its own floor to be heard, and greeted.
    isInEarshot: (behavior: HelperBehavior, playerPos: Vec3): boolean =>
    {
        return distanceAcross(playerPos, behavior.at) <= HEARING_DISTANCE && onFloorOf(behavior, playerPos);
    },
    // Each thing it says is one bubble, a whole greeting or reply (see NPC_MESSAGE_MAX_LENGTH), queued behind whatever it
    // is still saying, which a chat with another helper isn't.
    say: (behavior: HelperBehavior, text: string, to: string[], now: number): void =>
    {
        HelperBehaviorUtil.endSmallTalk(behavior);
        behavior.bubbles.push({text, to, answer: false});
        behavior.lastTalkAt = now;
    },
    // Likewise, an answer, which it is shown thinking of until its bubble is up.
    sayAnswer: (behavior: HelperBehavior, text: string, to: string[], now: number): void =>
    {
        behavior.bubbles.push({text, to, answer: true});
        behavior.lastTalkAt = now;
    },
    // It stops to think of an answer to someone, and is shown thinking of it, its last words still up.
    startAnswering: (behavior: HelperBehavior, surroundings: HelperSurroundings, userID: string, now: number): void =>
    {
        HelperBehaviorUtil.endSmallTalk(behavior);
        behavior.path = [];
        behavior.answering = userID;
        behavior.lastTalkAt = now;
        showThinking(behavior, surroundings);
    },
    // Done thinking: its answer, if it has one, waits its turn among its bubbles.
    stopAnswering: (behavior: HelperBehavior, surroundings: HelperSurroundings): void =>
    {
        behavior.answering = undefined;
        showThinking(behavior, surroundings);
    },
    // Walks toward whoever it answers from farther off, as near as it gets to a little way short of them, as far as it
    // goes from home.
    meet: (behavior: HelperBehavior, surroundings: HelperSurroundings, userID: string, now: number): void =>
    {
        const them = surroundings.getPerson(userID);
        if (them == undefined)
            return;
        behavior.returnHomeAt = now + STAY_AFTER_TALK_MS;
        const feet = VoxelPathUtil.feetOf(them);
        const away = distanceAcross(feet, behavior.at);
        if (away <= APPROACH_FROM || behavior.prefs.wanderRadius <= 0 || now < behavior.frozenUntil
            || surroundings.isHeld())
        {
            return;
        }
        // On its own floor, whichever one they stand on.
        const short = MEETING_DISTANCE / away;
        const target = clampToLeash(behavior, {x: feet.x + (behavior.at.x - feet.x) * short, y: behavior.at.y,
            z: feet.z + (behavior.at.z - feet.z) * short});
        const reach = findReach(behavior, surroundings);
        let nearest: VoxelVertex | undefined = undefined;
        let nearestDistance = distanceAcross(behavior.at, target) - VOXEL_CELL_SIZE;
        for (const vertex of reach?.vertices ?? [])
        {
            const place = VoxelPathUtil.toWorld(vertex);
            const distance = distanceAcross(place, target);
            if (distance < nearestDistance && Math.abs(place.y - behavior.at.y) <= SAME_FLOOR_HEIGHT
                && distanceAcross(place, behavior.home) <= behavior.prefs.wanderRadius)
            {
                nearest = vertex;
                nearestDistance = distance;
            }
        }
        if (reach != undefined && nearest != undefined)
            walkAlong(behavior, VoxelPathUtil.getPathWithin(reach, nearest)!, "meet");
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
        HelperBehaviorUtil.endSmallTalk(behavior);
        behavior.path = [];
        if (!HelperBehaviorUtil.isSamePlace(behavior.at, behavior.home))
        {
            behavior.at = {...behavior.home};
            surroundings.showAt();
        }
        face(behavior, surroundings, HelperBehaviorUtil.getFacingPut(behavior.homeQuarterTurns));
    },
    // Taken down, whatever it was saying or thinking of.
    fallSilent: (behavior: HelperBehavior, surroundings: HelperSurroundings): void =>
    {
        HelperBehaviorUtil.endSmallTalk(behavior);
        behavior.bubbles = [];
        if (behavior.saying.length > 0)
        {
            behavior.saying = "";
            surroundings.showSaying();
        }
        if (behavior.thinking)
        {
            behavior.thinking = false;
            surroundings.showThinking();
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
        const {personality} = behavior.prefs;
        const me = behavior.name.length > 0 ? `I'm ${behavior.name}.` : `I'm an AI ${NpcPersonalityMap.getRole(personality)}.`;
        return `Hi${whom}, ${welcome}! ${me} ${NpcPersonalityMap.getInvitation(personality)}`;
    },
    // Of a room's helpers free to chat (whoever plays them leaves out any held, or with someone to greet or answer), the
    // two nearest each other, if they are near enough on one floor and in sight of each other.
    findSmallTalkPair: <T extends HelperBehavior>(helpers: T[], voxels: Voxel[], now: number): T[] | undefined =>
    {
        const free = helpers.filter(helper => isFreeToChat(helper, now));
        let pair: T[] | undefined = undefined;
        let pairDistance = SMALL_TALK_DISTANCE;
        for (let i = 0; i < free.length; ++i)
        {
            for (let j = i + 1; j < free.length; ++j)
            {
                const distance = distanceAcross(free[i].at, free[j].at);
                if (distance <= pairDistance && Math.abs(free[i].at.y - free[j].at.y) <= SAME_FLOOR_HEIGHT
                    && canSee(voxels, free[i].at, free[j].at))
                {
                    pair = [free[i], free[j]];
                    pairDistance = distance;
                }
            }
        }
        return pair;
    },
    // Two helpers chat in the words given (each line by its speaker's place among them), if they are still free to:
    // each stands where it is, its way on kept for after, and faces the other. Either way, neither begins another for a
    // while.
    startSmallTalk: (helpers: HelperBehavior[], lines: {by: number, text: string}[], now: number): void =>
    {
        const free = helpers.every(helper => isFreeToChat(helper, now));
        for (const helper of helpers)
            helper.nextSmallTalkAt = now + randomBetween(SMALL_TALK_INTERVAL_MS);
        if (!free || lines.length == 0)
            return;
        const smallTalk: HelperSmallTalk = {helpers, lines: [...lines], saidLast: undefined};
        for (const helper of helpers)
            helper.smallTalk = smallTalk;
    },
    // Its chat with another helper is over for both, whatever was left to say: as someone needs it, or as it stops being
    // played.
    endSmallTalk: (behavior: HelperBehavior): void =>
    {
        const smallTalk = behavior.smallTalk;
        if (smallTalk == undefined)
            return;
        smallTalk.lines = [];
        for (const helper of smallTalk.helpers)
        {
            if (helper.smallTalk === smallTalk)
                helper.smallTalk = undefined;
        }
    },
    // The helper it chats with, while it does.
    getSmallTalkPartner: (behavior: HelperBehavior): HelperBehavior | undefined =>
    {
        return behavior.smallTalk?.helpers.find(helper => helper !== behavior);
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
    showThinking(behavior, surroundings);
    behavior.nextBubbleAt = now + Math.max(MIN_BUBBLE_MS,
        BUBBLE_NOTICE_MS + BUBBLE_MS_PER_CHAR * MessageLinkUtil.getVisibleLength(text));
    HelperBehaviorUtil.talkWith(behavior, to, now);
}

// Its next line in a chat with another helper, once it is its turn and what was said last has been read. The chat is
// over once all of it has been.
function chatOn(behavior: HelperBehavior, now: number): void
{
    const smallTalk = behavior.smallTalk;
    if (smallTalk == undefined
        || !smallTalk.helpers.every(helper => helper.bubbles.length == 0 && now >= helper.nextBubbleAt))
    {
        return;
    }
    const next = smallTalk.lines[0];
    if (next == undefined)
        HelperBehaviorUtil.endSmallTalk(behavior);
    else if (smallTalk.helpers[next.by] === behavior)
    {
        smallTalk.lines.shift();
        smallTalk.saidLast = behavior;
        behavior.bubbles.push({text: next.text, to: [], answer: false});
    }
}

// In a chat with another helper, its words come down once the other has answered, so that a chat reads one bubble at a
// time, which two side by side on a narrow screen wouldn't.
function takeDownAnswered(behavior: HelperBehavior, surroundings: HelperSurroundings): void
{
    const saidLast = behavior.smallTalk?.saidLast;
    if (saidLast != undefined && saidLast !== behavior && saidLast.saying.length > 0 && behavior.bubbles.length == 0
        && behavior.saying.length > 0)
    {
        behavior.saying = "";
        surroundings.showSaying();
    }
}

// Shown thinking from when it hears a line until its answer is up, or it has none to say.
function showThinking(behavior: HelperBehavior, surroundings: HelperSurroundings): void
{
    const thinking = surroundings.hasLinesWaiting() || behavior.answering != undefined
        || behavior.bubbles.some(bubble => bubble.answer);
    if (thinking == behavior.thinking)
        return;
    behavior.thinking = thinking;
    surroundings.showThinking();
}

// Idle, it wanders off now and then, though not up to anyone, and heads home a while after; or, roaming, wanders on from
// there a while after.
function wander(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number): void
{
    if (behavior.path.length > 0 || behavior.answering != undefined || behavior.bubbles.length > 0
        || behavior.smallTalk != undefined || now < behavior.frozenUntil || surroundings.isHeld())
    {
        return;
    }
    const {wanderRadius, anchoredToHome} = behavior.prefs;
    // One that roams is at home wherever it is within its radius.
    const roams = !anchoredToHome && distanceAcross(behavior.at, behavior.home) <= wanderRadius + SAME_PLACE;
    if (!roams && !HelperBehaviorUtil.isSamePlace(behavior.at, behavior.home))
    {
        if (now >= behavior.returnHomeAt)
            goHome(behavior, surroundings, now);
        return;
    }
    if (wanderRadius <= 0 || now < behavior.nextWanderAt || now - behavior.lastTalkAt < STAY_AFTER_TALK_MS)
        return;
    behavior.nextWanderAt = now + getIdleTime(behavior.prefs);
    wanderOff(behavior, surroundings, now);
}

// Off to somewhere within its wander radius of home, a little way at least from where it stands (and, kept from going
// somewhere, far from there), on another floor only if it may climb: one of the places it can reach (see findReach),
// picked at random, so never one in mid-air or out of its reach. With nowhere such, it gives up and stays still a while.
function wanderOff(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number, keptFrom?: Vec3): void
{
    const {wanderRadius, canClimb} = behavior.prefs;
    const reach = findReach(behavior, surroundings);
    const places = (reach?.vertices ?? []).filter(vertex => {
        const place = VoxelPathUtil.toWorld(vertex);
        return distanceAcross(place, behavior.home) <= wanderRadius
            && distanceAcross(place, behavior.at) >= MIN_WANDER_SHARE * wanderRadius
            && (canClimb || onFloorOfHome(behavior, place))
            && (keptFrom == undefined || distanceAcross(place, keptFrom) >= Math.min(REPICK_DISTANCE, wanderRadius));
    });
    if (reach == undefined || places.length == 0)
    {
        behavior.nextWanderAt = now + getIdleTime(behavior.prefs);
        behavior.returnHomeAt = now + randomBetween(WANDER_STAY_MS);
        return;
    }
    walkAlong(behavior, VoxelPathUtil.getPathWithin(reach, places[Math.floor(Math.random() * places.length)])!,
        "wander");
}

// Back home, unless its way there is blocked a while: then it wanders off far from home instead, to try again later.
// One that stands where no body could (built in since) is shown back at home at once.
function goHome(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number): void
{
    const reach = findReach(behavior, surroundings);
    if (reach == undefined)
    {
        HelperBehaviorUtil.standAtHome(behavior, surroundings);
        return;
    }
    const end = VoxelPathUtil.findStandingVertexNear(surroundings.voxels, behavior.home, 1);
    const way = (end == undefined) ? undefined : VoxelPathUtil.getPathWithin(reach, end);
    if (way != undefined)
        walkAlong(behavior, way, "home", behavior.home);
    else if (behavior.blockedSince == undefined)
        behavior.blockedSince = now;
    else if (now - behavior.blockedSince >= BLOCKED_GIVE_UP_MS)
        wanderOff(behavior, surroundings, now, behavior.home);
}

// Where it can walk from where it stands, and how: never up closer than PLANNED_SPACE to anyone (but on away from someone
// already that close), and on the floor of home unless it may climb, or has strayed off it and must find its way back;
// out to a walk long enough to reach anywhere it may go. None where it stands on nothing a body could.
function findReach(behavior: HelperBehavior, surroundings: HelperSurroundings): VoxelReach | undefined
{
    const start = VoxelPathUtil.findStandingVertexNear(surroundings.voxels, behavior.at, 1);
    if (start == undefined)
        return undefined;
    const from = VoxelPathUtil.toWorld(start);
    const people = surroundings.getPeople().map(pos => VoxelPathUtil.feetOf(pos));
    const keepsToFloor = !behavior.prefs.canClimb && onFloorOfHome(behavior, from);
    const maxDistance = MAX_DETOUR * (distanceAcross(behavior.at, behavior.home) + behavior.prefs.wanderRadius)
        + DETOUR_SLACK;
    return VoxelPathUtil.findReach(surroundings.voxels, start, maxDistance, vertex => {
        const point = VoxelPathUtil.toWorld(vertex);
        return (!keepsToFloor || onFloorOfHome(behavior, point)) && !people.some(feet =>
            Math.abs(feet.y - point.y) <= SAME_FLOOR_HEIGHT && distanceAcross(feet, point) < PLANNED_SPACE
            && distanceAcross(feet, point) <= distanceAcross(feet, from));
    });
}

// Sets off along a way it found, from where it stands, to its end, and on to a place off the grid's vertices beyond it
// (home), if given.
function walkAlong(behavior: HelperBehavior, way: VoxelVertex[], walk: HelperBehavior["walk"], end?: Vec3): void
{
    const path = way.map(vertex => VoxelPathUtil.toWorld(vertex));
    if (path.length > 0 && HelperBehaviorUtil.isSamePlace(path[0], behavior.at))
        path.shift();
    if (end != undefined && !HelperBehaviorUtil.isSamePlace(path[path.length - 1] ?? behavior.at, end))
        path.push({...end});
    behavior.path = path;
    behavior.walk = walk;
    behavior.blockedSince = undefined;
}

// Along its way, facing where it goes next. It stops short instead of stepping up closer than PERSONAL_SPACE to anyone,
// into another helper, or where a block has come to be since it set off: on its way to meet someone, for good; anywhere
// else for a moment, before it gives up going there and wanders off somewhere else instead.
function step(behavior: HelperBehavior, surroundings: HelperSurroundings, seconds: number, now: number): void
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
    if (isBlocked(behavior, surroundings, at, reached))
    {
        if (behavior.walk == "meet")
            behavior.path = [];
        else if (behavior.blockedSince == undefined)
            behavior.blockedSince = now;
        else if (now - behavior.blockedSince >= BLOCKED_GIVE_UP_MS)
        {
            const goal = behavior.path[behavior.path.length - 1];
            behavior.path = [];
            wanderOff(behavior, surroundings, now, goal);
        }
        return;
    }
    behavior.blockedSince = undefined;
    behavior.at = at;
    behavior.path.splice(0, reached);
    if (behavior.path.length > 0)
        faceToward(behavior, surroundings, behavior.path[0]);
    else
        arrive(behavior, now);
    surroundings.showAt();
}

// Whether a step to there, past the first `reached` points of its way, is kept from it: by a block on a vertex it would
// step on (home, where it was put, aside), or by coming up closer to someone than it may (stepping away from someone
// already that close is fine).
function isBlocked(behavior: HelperBehavior, surroundings: HelperSurroundings, to: Vec3, reached: number): boolean
{
    const steppedOn = behavior.path.slice(0, reached + 1)
        .filter(point => !HelperBehaviorUtil.isSamePlace(point, behavior.home))
        .map(point => VoxelPathUtil.toVertex(point))
        .filter((vertex): vertex is VoxelVertex => vertex != undefined);
    if (steppedOn.some(vertex => !VoxelPathUtil.isStandable(surroundings.voxels, vertex)))
        return true;
    const closesIn = (them: Vec3, space: number) =>
        distanceAcross(them, to) < space && distanceAcross(them, to) < distanceAcross(them, behavior.at);
    return getPeopleOnFloor(behavior, surroundings).some(them => closesIn(them, PERSONAL_SPACE))
        || surroundings.getOtherHelpers().some(them =>
            Math.abs(them.y - behavior.at.y) <= SAME_FLOOR_HEIGHT && closesIn(them, HELPER_SPACE));
}

// Where it was going: there a while before it heads home (or, roaming, on), and home a while before it wanders off.
function arrive(behavior: HelperBehavior, now: number): void
{
    if (behavior.walk == "wander" && behavior.prefs.anchoredToHome)
        behavior.returnHomeAt = now + randomBetween(WANDER_STAY_MS);
    else if (behavior.walk != "meet")
        behavior.nextWanderAt = now + getIdleTime(behavior.prefs);
}

// How long it idles before it next wanders, in milliseconds.
function getIdleTime(prefs: BehaviorPrefs): number
{
    return 1000 * randomBetween([prefs.minIdleTime, prefs.maxIdleTime]);
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

// Where whom it talks with stand: the helper it chats with; those it speaks to, or is about to answer, wherever they are
// in its room, each in turn for a moment when they are several; once it is done speaking, the nearest of them still in
// earshot, until it has been quiet a while.
function getGazeTarget(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number): Vec3 | undefined
{
    const partner = HelperBehaviorUtil.getSmallTalkPartner(behavior);
    if (partner != undefined)
        return partner.at;
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

// Free to chat with another helper: not chatting already, nor saying anything or thinking of it, nor still after a move,
// nor lately talking with someone, and not waiting to chat again.
function isFreeToChat(behavior: HelperBehavior, now: number): boolean
{
    return behavior.smallTalk == undefined && now >= behavior.nextSmallTalkAt && now >= behavior.frozenUntil
        && !HelperBehaviorUtil.isSpeaking(behavior, now) && now - behavior.lastTalkAt >= STAY_AFTER_TALK_MS;
}

// Whether nothing stands between two helpers (by their feet) at about the height of their heads.
function canSee(voxels: Voxel[], a: Vec3, b: Vec3): boolean
{
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / SIGHT_STEP);
    for (let i = 1; i < steps; ++i)
    {
        const t = i / steps;
        if (VoxelQueryUtil.isPointInVoxelBlock(voxels, {x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t + SIGHT_HEIGHT, z: a.z + (b.z - a.z) * t}))
        {
            return false;
        }
    }
    return true;
}

// Within its wander radius of home.
function clampToLeash(behavior: HelperBehavior, point: Vec3): Vec3
{
    const radius = behavior.prefs.wanderRadius;
    const away = distanceAcross(point, behavior.home);
    if (away <= radius)
        return point;
    return {x: behavior.home.x + (point.x - behavior.home.x) * radius / away, y: point.y,
        z: behavior.home.z + (point.z - behavior.home.z) * radius / away};
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

// Whether a point stands at about the height of home.
function onFloorOfHome(behavior: HelperBehavior, point: Vec3): boolean
{
    return Math.abs(point.y - behavior.home.y) <= SAME_FLOOR_HEIGHT;
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
