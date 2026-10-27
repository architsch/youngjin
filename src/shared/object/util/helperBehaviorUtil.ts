import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import { HELPER_AGENT_NAME, VOXEL_CELL_SIZE } from "../../system/sharedConstants";
import Voxel from "../../voxel/types/voxel";
import VoxelReach from "../../voxel/types/voxelReach";
import VoxelVertex from "../../voxel/types/voxelVertex";
import VoxelPathUtil from "../../voxel/util/voxelPathUtil";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import NpcPersonalityMap from "../maps/npcPersonalityMap";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import AddObjectSignal from "../types/addObjectSignal";
import BehaviorPrefs from "../types/behaviorPrefs";
import HelperBehavior from "../types/helperBehavior";
import HelperRemarkSubject from "../types/helperRemarkSubject";
import HelperSight from "../types/helperSight";
import HelperSmallTalk from "../types/helperSmallTalk";
import HelperSurroundings from "../types/helperSurroundings";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import LampObjectTypeConfig from "../types/objectTypeConfig/lampObjectTypeConfig";
import MirrorObjectTypeConfig from "../types/objectTypeConfig/mirrorObjectTypeConfig";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../types/objectTypeConfig/playerObjectTypeConfig";
import BehaviorPrefsUtil from "./behaviorPrefsUtil";
import LabelTextUtil from "./labelTextUtil";
import MessageLinkUtil from "./messageLinkUtil";
import NpcFacingUtil from "./npcFacingUtil";
import ObjectScaleUtil from "./objectScaleUtil";
import QuarterTurnsUtil from "./quarterTurnsUtil";

// How an NPC behaves as a helper, wherever it is played: by the server in a multiplayer room (see HelperAgentUtil), and
// by the browser in a single-player room, which is the browser's alone (see SinglePlayerHelperUtil). It goes only to
// places within its wander radius of home (its way there may run past it), keeps a little way off from people, walks
// round blocks and past other helpers, faces whom it talks with, says one thing at a time, each up long enough to be
// read, now and then chats with another helper near it, and now and then goes and looks at something placed near it, to
// say what it thinks of it. Whoever plays it decides whom it greets (and tells the basics), what it answers, whom it
// stands waiting on as they type it a line, what it says to another helper, and which thing it looks at, and what it
// says of it.

const UP: Vec3 = {x: 0, y: 1, z: 0};
// Someone this near on its own floor (feet within this height of its own) is in earshot.
export const HEARING_DISTANCE = 8;
const SAME_FLOOR_HEIGHT = 1;
// A helper this little farther off the way a speaker faces than the one most in front of them is as good as faced too,
// and the nearest of those hears them (see pickListener): a helper just behind another in view isn't the one faced.
const FACING_TIE_DEGREES = 10;
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
// than PERSONAL_SPACE to anyone, so that its bubble keeps in their view.
const APPROACH_FROM = 5;
const MEETING_DISTANCE = 3.5;
const PERSONAL_SPACE = 3;
// Another helper it never stops for, since two that did would wait on each other for good: it passes one up to
// PASSING_LOOKAHEAD ahead HELPER_SPACE off to one side, up to MAX_ASIDE_LANES grid steps off its way, as far as the
// floor there allows (see getAside).
const HELPER_SPACE = 1;
const PASSING_LOOKAHEAD = 3;
const MAX_ASIDE_LANES = 2;
// The most of its pace it walks at while it lets another helper walking its way go first (see getStride).
const YIELDING_PACE = 0.5;
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
const WANDER_STAY_MS = [1_000, 8_000];
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
// Now and then, in place of a wander, it goes and looks a while at one of the things placed near it: first a while after
// it is found, then a while after each look, or after finding nothing to look at. It stands this far from the thing (but from about its size
// away, for a thing too large to take in from nearer), in front of one on a wall, looking up or down at most this
// steeply, with nothing between it and the thing at about the height of its eyes. It looks a moment before it speaks,
// and goes on a moment after its words have been read.
const FIRST_SIGHT_MS = [30_000, 90_000];
const SIGHT_INTERVAL_MS = [90_000, 240_000];
const SIGHT_RETRY_MS = 30_000;
// Whoever plays it picks which to look at from this many things at most (see findSights).
export const MAX_SIGHTS = 16;
const VIEW_DISTANCE = [1.5, 3.5];
const VIEW_DISTANCE_PER_SIZE = [0.5, 1.2];
const MOST_VIEW_DEGREES_OFF = 50;
const MOST_VIEW_SLOPE = 1.5;
const SIGHT_QUIET_MS = [1500, 3000];
const SIGHT_AFTER_MS = 1500;
// How far in front of the face a thing rests on it is looked at, so that the face's own block never hides it. Of the
// places to look at a thing from, only this many of the best are tried for a clear sight of it, which bounds the cost
// in a large room of things behind walls.
const FACE_GAP = 0.1;
const MOST_VIEWS_TRIED = 16;
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
            answering: undefined, waitingFor: undefined, thinking: false, bubbles: [], nextBubbleAt: 0,
            smallTalk: undefined, nextSmallTalkAt: now + randomBetween(FIRST_SMALL_TALK_MS), sight: undefined,
            nextSightAt: now + randomBetween(FIRST_SIGHT_MS)};
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
    // another helper, or its remark on what it looks at, its next bubble, and a wander, unless it waits on something
    // (someone's lines it is to answer, or the words for a remark, see startSight).
    beat: (behavior: HelperBehavior, surroundings: HelperSurroundings, now: number, waiting: boolean): void =>
    {
        chatOn(behavior, now);
        lookOn(behavior, surroundings, now);
        speakNextBubble(behavior, surroundings, now);
        if (!waiting)
            wander(behavior, surroundings, now);
    },
    // Of the helpers in a room, the one a line is for: one it names, else, of those in earshot of whoever said it (all of
    // them, to one calling for a helper), the one they face, which the way they face decides before nearness does.
    pickListener: <T extends HelperBehavior>(helpers: T[], text: string, speaker: Vec3, facing: Vec3): T | undefined =>
    {
        const named = helpers.find(helper => helper.name.length > 0 && namedIn(text, helper.name));
        if (named != undefined)
            return named;
        const callsForHelper = namedIn(text, HELPER_AGENT_NAME);
        const hearing = helpers.filter(helper => callsForHelper || HelperBehaviorUtil.isInEarshot(helper, speaker))
            .map(helper => ({helper, off: degreesOffFacing(speaker, facing, helper.at)}));
        const leastOff = Math.min(...hearing.map(({off}) => off));
        return hearing.filter(({off}) => off <= leastOff + FACING_TIE_DEGREES)
            .sort((a, b) => distanceAcross(speaker, a.helper.at) - distanceAcross(speaker, b.helper.at))[0]?.helper;
    },
    // A line for it, once whoever plays it has kept it to answer: it turns to whoever said it, unless it is still
    // speaking to someone else, and is shown thinking of an answer at once. A chat with another helper ends for it, as
    // does a look at something.
    hear: (behavior: HelperBehavior, surroundings: HelperSurroundings, userID: string, now: number): void =>
    {
        const chatting = behavior.smallTalk != undefined;
        HelperBehaviorUtil.endSmallTalk(behavior);
        dropSight(behavior);
        behavior.lastTalkAt = now;
        if (chatting || !HelperBehaviorUtil.isSpeaking(behavior, now))
            HelperBehaviorUtil.talkWith(behavior, [userID], now);
        showThinking(behavior, surroundings);
    },
    // Someone typing it a line, as whoever plays it finds (the one it would be for, see pickListener), or nobody: it
    // stands where it is, turning to them as it would to a line, until they say it or stop, and stays a while after, as
    // after a talk. A chat with another helper ends for it, as does a look at something.
    waitFor: (behavior: HelperBehavior, userID: string | undefined, now: number): void =>
    {
        const started = userID != undefined && userID != behavior.waitingFor;
        behavior.waitingFor = userID;
        if (userID == undefined)
            return;
        const chatting = behavior.smallTalk != undefined;
        if (started)
        {
            HelperBehaviorUtil.endSmallTalk(behavior);
            dropSight(behavior);
            behavior.path = [];
        }
        behavior.lastTalkAt = now;
        behavior.returnHomeAt = now + STAY_AFTER_TALK_MS;
        if (chatting || !HelperBehaviorUtil.isSpeaking(behavior, now))
            HelperBehaviorUtil.talkWith(behavior, [userID], now);
    },
    // Whether a player (by its position, at its middle) is near enough on its own floor to be heard, and greeted.
    isInEarshot: (behavior: HelperBehavior, playerPos: Vec3): boolean =>
    {
        return distanceAcross(playerPos, behavior.at) <= HEARING_DISTANCE && onFloorOf(behavior, playerPos);
    },
    // Each thing it says is one bubble, a whole greeting or reply (see NPC_MESSAGE_MAX_LENGTH), queued behind whatever it
    // is still saying, which a chat with another helper, or a look at something, isn't.
    say: (behavior: HelperBehavior, text: string, to: string[], now: number): void =>
    {
        HelperBehaviorUtil.endSmallTalk(behavior);
        dropSight(behavior);
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
        dropSight(behavior);
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
    // goes from home; but not while someone types it a line.
    meet: (behavior: HelperBehavior, surroundings: HelperSurroundings, userID: string, now: number): void =>
    {
        const them = surroundings.getPerson(userID);
        if (them == undefined)
            return;
        behavior.returnHomeAt = now + STAY_AFTER_TALK_MS;
        const feet = VoxelPathUtil.feetOf(them);
        const away = distanceAcross(feet, behavior.at);
        if (away <= APPROACH_FROM || behavior.prefs.wanderRadius <= 0 || now < behavior.frozenUntil
            || surroundings.isHeld() || behavior.waitingFor != undefined)
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
        dropSight(behavior);
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
        dropSight(behavior);
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
    // How to walk and build, which it says after its greeting to anyone greeted who has never been told: once for good,
    // by whichever helper (or the tutorial) tells them first, as whoever plays it keeps (see FTUEElementCodeEnumMap.Basics).
    getBasics: (behavior: HelperBehavior): string =>
    {
        return NpcPersonalityMap.getBasics(behavior.prefs.personality);
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
    // Whether it is time it went and looked at something, in place of a wander, and it is free to (see isFreeToLook).
    isDueForSight: (behavior: HelperBehavior, surroundings: HelperSurroundings, now: number): boolean =>
    {
        return now >= behavior.nextSightAt && isFreeToLook(behavior, surroundings, now);
    },
    // The things placed in its room it could go and look at now (see describeSight), each from a place it can stand at
    // (see findViewingPlaces) that is a good one to look at it from (see findView): MAX_SIGHTS at most, picked at random.
    findSights: (behavior: HelperBehavior, surroundings: HelperSurroundings): HelperSight[] =>
    {
        const {places} = findViewingPlaces(behavior, surroundings);
        const sights: HelperSight[] = [];
        for (const obj of Object.values(surroundings.objectById))
        {
            const subject = describeSight(obj);
            if (subject != undefined && findView(surroundings, places, obj) != undefined)
                sights.push({objectId: obj.objectId, subject});
        }
        while (sights.length > MAX_SIGHTS)
            sights.splice(Math.floor(Math.random() * sights.length), 1);
        return sights;
    },
    // It goes to look at one of them, whichever whoever plays it picked, from the best place to see it from, to say the
    // remark given once there; if it is still free to (whoever plays it holds its wander while it finds the words, see
    // beat), and there is a remark. Either way, it goes to look at nothing else for a while, a shorter while if there was
    // nothing to look at.
    startSight: (behavior: HelperBehavior, surroundings: HelperSurroundings, sight: HelperSight | undefined,
        remark: string, now: number): void =>
    {
        behavior.nextSightAt = now + ((sight == undefined) ? SIGHT_RETRY_MS : randomBetween(SIGHT_INTERVAL_MS));
        const obj = (sight == undefined) ? undefined : surroundings.objectById[sight.objectId];
        if (obj == undefined || remark.length == 0 || !isFreeToLook(behavior, surroundings, now))
            return;
        const {reach, places} = findViewingPlaces(behavior, surroundings);
        const view = findView(surroundings, places, obj);
        if (view == undefined)
            return;
        behavior.sight = {objectId: obj.objectId, at: {...obj.transform.pos}, point: view.point, remark,
            saysAt: undefined, said: false};
        walkAlong(behavior, (reach == undefined || view.vertex == undefined) ? []
            : VoxelPathUtil.getPathWithin(reach, view.vertex)!, "see");
        if (behavior.path.length == 0)
            arrive(behavior, now);
    },
    // The thing it stands looking at, by its id, while it does.
    getLookedAt: (behavior: HelperBehavior): string | undefined =>
    {
        return (behavior.sight?.saysAt == undefined) ? undefined : behavior.sight.objectId;
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

// Once it has looked a moment at what it went to see, it says its remark on it; once that has been read, and a moment
// more, it is done, and stays there a while as after a wander. It stops looking once the thing is taken away or moved,
// and gives up on it if its way there was cut short.
function lookOn(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number): void
{
    const sight = behavior.sight;
    if (sight == undefined)
        return;
    const obj = surroundings.objectById[sight.objectId];
    if (obj == undefined || !HelperBehaviorUtil.isSamePlace(obj.transform.pos, sight.at)
        || (sight.saysAt == undefined && behavior.path.length == 0))
    {
        dropSight(behavior);
        return;
    }
    if (sight.saysAt == undefined || now < sight.saysAt)
        return;
    if (!sight.said)
    {
        sight.said = true;
        behavior.bubbles.push({text: sight.remark, to: [], answer: false});
    }
    else if (behavior.bubbles.length == 0 && now >= behavior.nextBubbleAt + SIGHT_AFTER_MS)
    {
        behavior.sight = undefined;
        if (behavior.prefs.anchoredToHome && !HelperBehaviorUtil.isSamePlace(behavior.at, behavior.home))
            behavior.returnHomeAt = now + randomBetween(WANDER_STAY_MS);
        else
            behavior.nextWanderAt = now + getIdleTime(behavior.prefs);
    }
}

// It stops looking at what it went to see, walking on to where it was going to see it from (if it still was) as to
// anywhere else.
function dropSight(behavior: HelperBehavior): void
{
    behavior.sight = undefined;
    if (behavior.walk == "see")
        behavior.walk = "wander";
}

// Free to go and look at something, which it does in place of wandering off somewhere (see wander), so only when it
// would: one that never wanders never does, keeping to its post. Besides, someone is in its room to see it, and nobody's
// lines wait for an answer.
function isFreeToLook(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number): boolean
{
    return isDueToWanderOff(behavior, surroundings, now) && !HelperBehaviorUtil.isSpeaking(behavior, now)
        && !surroundings.hasLinesWaiting() && surroundings.getPeople().length > 0;
}

// What a thing placed in its room is, as whoever finds the words for a remark on it asks (see HelperRemarkSubject), if
// it is worth a look: a canvas or prop showing a picture, a lamp, a fan, a sign or a door (with the words on it), or a
// mirror that shows a reflection (none, wholly covered over).
function describeSight(obj: AddObjectSignal): HelperRemarkSubject | undefined
{
    const objectType = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).objectType;
    const picture = obj.metadata[ObjectMetadataKeyEnumMap.ImagePath]?.str ?? "";
    if (objectType == "Canvas" || objectType == "Prop")
        return (picture.length > 0) ? {objectType, picture} : undefined;
    if (objectType == "Lamp")
        return {objectType, color: LampObjectTypeConfig.util.getColorIndex(obj)};
    if (objectType == "Label" || objectType == "Door")
        return {objectType, text: LabelTextUtil.getText(obj)};
    if (objectType == "Mirror")
        return (MirrorObjectTypeConfig.util.getOpacity(obj) < 1) ? {objectType} : undefined;
    return (objectType == "Fan") ? {objectType} : undefined;
}

// Where it could stand to look at something: where it stands, and the places it can walk to within its wander radius of
// home (on home's floor, unless it may climb), but where another helper stands or is going; each ranked by how far it
// walks there, from none to one.
function findViewingPlaces(behavior: HelperBehavior, surroundings: HelperSurroundings):
    {reach: VoxelReach | undefined, places: {place: Vec3, vertex?: VoxelVertex, walk: number}[]}
{
    const {wanderRadius, canClimb} = behavior.prefs;
    const reach = findReach(behavior, surroundings);
    const vertices = reach?.vertices ?? [];
    const taken = surroundings.getOtherHelpers().map(other => other.path[other.path.length - 1] ?? other.at);
    const places = vertices
        .map((vertex, i) => ({place: VoxelPathUtil.toWorld(vertex), vertex, walk: (i + 1) / vertices.length}))
        .filter(({place}) => distanceAcross(place, behavior.home) <= wanderRadius
            && (canClimb || onFloorOfHome(behavior, place))
            && !taken.some(spot => Math.abs(spot.y - place.y) <= SAME_FLOOR_HEIGHT
                && distanceAcross(spot, place) < HELPER_SPACE));
    return {reach, places: [{place: {...behavior.at}, walk: 0}, ...places]};
}

// Of those places, the one to look at a thing from: as far from the face it rests on as suits the thing's size, in front
// of one on a wall (any way round one on a floor or ceiling), looking no more steeply than a person would, and with
// nothing between its eyes and the thing; the best of these nearest the middle of those distances, most square on to
// it, and the shortest walk away. With the point it faces there.
function findView(surroundings: HelperSurroundings, places: {place: Vec3, vertex?: VoxelVertex, walk: number}[],
    obj: AddObjectSignal): {place: Vec3, vertex?: VoxelVertex, point: Vec3} | undefined
{
    const {normal} = Geometry3DUtil.getAxisFacingBasis(obj.transform.dir);
    const {pos} = obj.transform;
    const point = {x: pos.x + FACE_GAP * normal.x, y: pos.y + FACE_GAP * normal.y, z: pos.z + FACE_GAP * normal.z};
    const size = ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale);
    const extent = Math.max(size.x, size.y);
    const [nearest, farthest] = VIEW_DISTANCE.map((distance, i) =>
        Math.max(distance, VIEW_DISTANCE_PER_SIZE[i] * extent));
    const middle = (nearest + farthest) / 2;
    const onWall = Math.abs(normal.y) < 0.5;
    const views: {place: Vec3, vertex?: VoxelVertex, eyes: Vec3, score: number}[] = [];
    for (const {place, vertex, walk} of places)
    {
        const away = distanceAcross(place, point);
        const eyes = {x: place.x, y: place.y + SIGHT_HEIGHT, z: place.z};
        const squareness = onWall ? ((place.x - point.x) * normal.x + (place.z - point.z) * normal.z) / away : 1;
        if (away >= nearest && away <= farthest && Math.abs(point.y - eyes.y) <= MOST_VIEW_SLOPE * away
            && squareness >= Math.cos(MOST_VIEW_DEGREES_OFF * Math.PI / 180))
        {
            views.push({place, vertex, eyes, score: Math.abs(away - middle) / middle + (1 - squareness) + walk});
        }
    }
    const view = views.sort((a, b) => a.score - b.score).slice(0, MOST_VIEWS_TRIED)
        .find(({eyes}) => isInSight(surroundings.voxels, eyes, point));
    return (view == undefined) ? undefined : {place: view.place, vertex: view.vertex, point};
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
    if (!isIdle(behavior, surroundings, now))
        return;
    if (!roamsFrom(behavior) && !HelperBehaviorUtil.isSamePlace(behavior.at, behavior.home))
    {
        if (now >= behavior.returnHomeAt)
            goHome(behavior, surroundings, now);
        return;
    }
    if (!isDueToWanderOff(behavior, surroundings, now))
        return;
    behavior.nextWanderAt = now + getIdleTime(behavior.prefs);
    wanderOff(behavior, surroundings, now);
}

// Standing with nothing to do: not on its way anywhere, answering, waiting on someone typing, saying anything, chatting
// or looking at something, nor still after a move, nor held.
function isIdle(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number): boolean
{
    return behavior.path.length == 0 && behavior.answering == undefined && behavior.waitingFor == undefined
        && behavior.bubbles.length == 0 && behavior.smallTalk == undefined && behavior.sight == undefined
        && now >= behavior.frozenUntil && !surroundings.isHeld();
}

// Whether it is time it wandered off from where it stands, idle: home, or anywhere within its radius for one that
// roams; once it has idled there long enough, and not lately talked with anyone. Never, for one that never wanders.
function isDueToWanderOff(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number): boolean
{
    return isIdle(behavior, surroundings, now) && behavior.prefs.wanderRadius > 0
        && (roamsFrom(behavior) || HelperBehaviorUtil.isSamePlace(behavior.at, behavior.home))
        && now >= behavior.nextWanderAt && now - behavior.lastTalkAt >= STAY_AFTER_TALK_MS;
}

// Whether it roams from where it stands: one not anchored to home is at home wherever it is within its radius.
function roamsFrom(behavior: HelperBehavior): boolean
{
    return !behavior.prefs.anchoredToHome
        && distanceAcross(behavior.at, behavior.home) <= behavior.prefs.wanderRadius + SAME_PLACE;
}

// Off to somewhere within its wander radius of home, a little way at least from where it stands (and, kept from going
// somewhere, far from there), on another floor only if it may climb, and not where another helper stands or is going:
// one of the places it can reach (see findReach), picked at random, so never one in mid-air or out of its reach. With
// nowhere such, it gives up and stays still a while.
function wanderOff(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number, keptFrom?: Vec3): void
{
    const {wanderRadius, canClimb} = behavior.prefs;
    const reach = findReach(behavior, surroundings);
    const taken = surroundings.getOtherHelpers().map(other => other.path[other.path.length - 1] ?? other.at);
    const places = (reach?.vertices ?? []).filter(vertex => {
        const place = VoxelPathUtil.toWorld(vertex);
        return distanceAcross(place, behavior.home) <= wanderRadius
            && distanceAcross(place, behavior.at) >= MIN_WANDER_SHARE * wanderRadius
            && (canClimb || onFloorOfHome(behavior, place))
            && (keptFrom == undefined || distanceAcross(place, keptFrom) >= Math.min(REPICK_DISTANCE, wanderRadius))
            && !taken.some(spot => Math.abs(spot.y - place.y) <= SAME_FLOOR_HEIGHT
                && distanceAcross(spot, place) < HELPER_SPACE);
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
// (home), if given. Off anywhere but to see something, it is done with what it went to see.
function walkAlong(behavior: HelperBehavior, way: VoxelVertex[], walk: HelperBehavior["walk"], end?: Vec3): void
{
    const path = way.map(vertex => VoxelPathUtil.toWorld(vertex));
    if (path.length > 0 && HelperBehaviorUtil.isSamePlace(path[0], behavior.at))
        path.shift();
    if (end != undefined && !HelperBehaviorUtil.isSamePlace(path[path.length - 1] ?? behavior.at, end))
        path.push({...end});
    if (walk != "see")
        behavior.sight = undefined;
    behavior.path = path;
    behavior.walk = walk;
    behavior.blockedSince = undefined;
}

// Along its way, or to one side of it to pass another helper (see getAside), facing where it goes next. It stops short
// instead of stepping up closer than PERSONAL_SPACE to anyone, or where a block has come to be since it set off: on its
// way to meet someone, for good; anywhere else for a moment, before it gives up going there and wanders off somewhere
// else instead. Coming up to another helper where it is going, it is there, and tries for home again a while after.
function step(behavior: HelperBehavior, surroundings: HelperSurroundings, seconds: number, now: number): void
{
    const aside = getAside(behavior, surroundings);
    let at = behavior.at;
    let reached = 0;
    let left = getStride(behavior, surroundings, WALK_SPEED * seconds);
    while (left > 0 && reached < behavior.path.length)
    {
        const {index, point: next} = getNextAim(behavior, surroundings, at, aside, reached);
        reached = index;
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
    if (isHelperAtEnd(behavior, surroundings, at))
    {
        behavior.path = [];
        behavior.returnHomeAt = now + randomBetween(WANDER_STAY_MS);
        arrive(behavior, now);
        return;
    }
    behavior.at = at;
    behavior.path.splice(0, reached);
    if (behavior.path.length > 0)
        faceToward(behavior, surroundings, getNextAim(behavior, surroundings, at, aside, 0).point);
    else
    {
        arrive(behavior, now);
        look(behavior, surroundings, now, true);
    }
    surroundings.showAt();
}

// Of the points of its way from one on, the first it heads for from where it is, and where (see aim). One to the side
// of its way beside a turn may be no farther on than it is already, either way it walks there, and is passed by.
function getNextAim(behavior: HelperBehavior, surroundings: HelperSurroundings, at: Vec3, aside: number,
    from: number): {index: number, point: Vec3}
{
    let index = from;
    while (index < behavior.path.length - 1)
    {
        const point = behavior.path[index];
        const aimed = aim(behavior, surroundings, index, aside);
        const on = behavior.path[index + 1];
        const isAhead = (x: number, z: number) => (aimed.x - at.x) * x + (aimed.z - at.z) * z > 0;
        if (aimed === point || (isAhead(on.x - point.x, on.z - point.z) && isAhead(point.x - at.x, point.z - at.z)))
        {
            return {index, point: aimed};
        }
        ++index;
    }
    return {index, point: behavior.path[index]};
}

// How many grid steps across its way (to its right, if positive) it walks for now to pass the other helpers ahead on
// its floor (but any walking across it): the lane (see countLanes) nearest its way that keeps HELPER_SPACE from each,
// else the one keeping farthest. One coming toward it is passed on the side it is on already, else away from that one,
// else on its right, as that one does likewise, and is reckoned where its own way runs so that the two reckon alike.
// One beside or behind only keeps it aside. None on its way's last step, which ends where it ends.
function getAside(behavior: HelperBehavior, surroundings: HelperSurroundings): number
{
    const [point, next] = behavior.path;
    const width = (next == undefined) ? 0 : distanceAcross(point, next);
    if (width < SAME_PLACE)
        return 0;
    const ahead = {x: (next.x - point.x) / width, z: (next.z - point.z) / width};
    const acrossOf = (place: Vec3) => (place.z - point.z) * ahead.x - (place.x - point.x) * ahead.z;
    const lanesNow = acrossOf(behavior.at) / width;
    const sideNow = (Math.abs(lanesNow) >= 0.5) ? Math.sign(lanesNow) : undefined;
    // Each by how far across its way, and how far behind it (none, for one ahead, which it passes that far across).
    const passing: {across: number, behind: number, coming: boolean}[] = [];
    for (const other of surroundings.getOtherHelpers())
    {
        const heading = getHeading(other);
        const along = (heading == undefined) ? 0 : heading.x * ahead.x + heading.z * ahead.z;
        const coming = along < 0;
        const forward = (other.at.x - behavior.at.x) * ahead.x + (other.at.z - behavior.at.z) * ahead.z;
        if ((heading == undefined || Math.abs(heading.z * ahead.x - heading.x * ahead.z) <= Math.abs(along))
            && Math.abs(other.at.y - behavior.at.y) <= SAME_FLOOR_HEIGHT && forward < PASSING_LOOKAHEAD
            && (forward >= 0 || (forward > -HELPER_SPACE && sideNow != undefined)))
        {
            passing.push({across: acrossOf((coming && forward >= 0) ? other.path[0] : other.at),
                behind: Math.min(forward, 0), coming: coming && forward >= 0});
        }
    }
    const clearance = (lanes: number) => Math.min(...passing.map(({across, behind}) =>
        Math.hypot(behind, across - lanes * width)));
    const clears = (lanes: number) => clearance(lanes) >= HELPER_SPACE;
    if (clears(0))
        return 0;
    // Clearing them all, then nearer its way; else keeping farther from them; of two alike, nearer where it walks now.
    const isBetter = (lanes: number, than: number) => (clears(lanes) != clears(than)) ? clears(lanes)
        : (clears(lanes) && Math.abs(lanes) != Math.abs(than)) ? Math.abs(lanes) < Math.abs(than)
        : (!clears(lanes) && Math.abs(clearance(lanes) - clearance(than)) > SAME_PLACE)
            ? clearance(lanes) > clearance(than)
        : Math.abs(lanes - lanesNow) < Math.abs(than - lanesNow) - SAME_PLACE;
    let best = 0;
    for (const side of [1, -1])
    {
        if (passing.some(({across, coming}) => coming && Math.abs(across) < HELPER_SPACE
            && side != (sideNow ?? ((across > SAME_PLACE) ? -1 : 1))))
        {
            continue;
        }
        const room = countLanes(behavior, surroundings, 0, side, MAX_ASIDE_LANES);
        for (let lanes = side; Math.abs(lanes) <= room; lanes += side)
        {
            if (isBetter(lanes, best))
                best = lanes;
        }
    }
    return best;
}

// How far it walks in a step of a stride: less while another helper walking its way within HELPER_SPACE beyond the
// stride goes first, so that two in a way too narrow to walk abreast fall in line: YIELDING_PACE of it at most, and
// never up level with that one. Of two, reckoned alike along the way between theirs, the one ahead goes first, else the
// one on the right, else the one put farther west (or north), so that only one gives way, and one ahead never stops it.
function getStride(behavior: HelperBehavior, surroundings: HelperSurroundings, stride: number): number
{
    const mine = getHeading(behavior);
    let most = stride;
    for (const other of surroundings.getOtherHelpers())
    {
        const theirs = getHeading(other);
        if (mine == undefined || theirs == undefined || Math.abs(other.at.y - behavior.at.y) > SAME_FLOOR_HEIGHT
            || distanceAcross(other.at, behavior.at) >= HELPER_SPACE + stride
            || Math.abs(mine.z * theirs.x - mine.x * theirs.z) > mine.x * theirs.x + mine.z * theirs.z)
        {
            continue;
        }
        const length = Math.hypot(mine.x + theirs.x, mine.z + theirs.z);
        const way = {x: (mine.x + theirs.x) / length, z: (mine.z + theirs.z) / length};
        const forward = (other.at.x - behavior.at.x) * way.x + (other.at.z - behavior.at.z) * way.z;
        const right = (other.at.z - behavior.at.z) * way.x - (other.at.x - behavior.at.x) * way.z;
        const putFirst = other.home.x < behavior.home.x
            || (other.home.x == behavior.home.x && other.home.z < behavior.home.z);
        if (forward > SAME_PLACE || (forward > -SAME_PLACE
            && (right > SAME_PLACE || (right > -SAME_PLACE && putFirst))))
        {
            most = Math.min(most, YIELDING_PACE * stride, Math.max(0, forward - SAME_PLACE));
        }
    }
    return most;
}

// Which way across the floor it walks, as its way runs on from the point it heads for (so that walking to one side of
// it skews nothing): a unit vector, or none while it stands.
function getHeading(behavior: HelperBehavior): {x: number, z: number} | undefined
{
    if (behavior.path.length == 0 || behavior.smallTalk != undefined)
        return undefined;
    const [from, to] = (behavior.path.length > 1) ? behavior.path : [behavior.at, behavior.path[0]];
    const length = distanceAcross(from, to);
    return (length < SAME_PLACE) ? undefined : {x: (to.x - from.x) / length, z: (to.z - from.z) / length};
}

// How many lanes beside its way at a point of it there are to one side (1, its right; -1, its left), up to a most: grid
// steps across its way on from there a body can stand on one after another, beside the points before and after it
// too, so that it cuts no corner coming to the lane or leaving it.
function countLanes(behavior: HelperBehavior, surroundings: HelperSurroundings, index: number, side: number,
    most: number): number
{
    const point = behavior.path[index];
    const next = behavior.path[index + 1];
    if (next == undefined || VoxelPathUtil.toVertex(next) == undefined)
        return 0;
    const along = {x: next.x - point.x, z: next.z - point.z};
    let lanes = 0;
    while (lanes < most && [-1, 0, 1].every(i => {
        const vertex = VoxelPathUtil.toVertex({x: point.x + i * along.x - side * (lanes + 1) * along.z, y: point.y,
            z: point.z + i * along.z + side * (lanes + 1) * along.x});
        return vertex != undefined && VoxelPathUtil.isStandable(surroundings.voxels, vertex);
    }))
    {
        ++lanes;
    }
    return lanes;
}

// Where it heads for a point of its way: there, or a number of grid steps across its way (see getAside), as many of
// them as there are lanes.
function aim(behavior: HelperBehavior, surroundings: HelperSurroundings, index: number, aside: number): Vec3
{
    const point = behavior.path[index];
    const side = Math.sign(aside);
    const lanes = (aside == 0) ? 0 : side * countLanes(behavior, surroundings, index, side, Math.abs(aside));
    if (lanes == 0)
        return point;
    const next = behavior.path[index + 1];
    return {x: point.x - lanes * (next.z - point.z), y: point.y, z: point.z + lanes * (next.x - point.x)};
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
    return getPeopleOnFloor(behavior, surroundings).some(them => closesIn(behavior, them, to, PERSONAL_SPACE));
}

// Whether a step to there brings it up closer than HELPER_SPACE to another helper that near the end of its way, where
// it stands clear of every one, so that it stops short there rather than inside one.
function isHelperAtEnd(behavior: HelperBehavior, surroundings: HelperSurroundings, to: Vec3): boolean
{
    const end = behavior.path[behavior.path.length - 1];
    const others = surroundings.getOtherHelpers().map(({at}) => at)
        .filter(at => Math.abs(at.y - behavior.at.y) <= SAME_FLOOR_HEIGHT);
    return others.some(at => distanceAcross(at, end) < HELPER_SPACE && closesIn(behavior, at, to, HELPER_SPACE))
        && others.every(at => distanceAcross(at, behavior.at) >= 2 * PLAYER_RADIUS_XZ);
}

function closesIn(behavior: HelperBehavior, them: Vec3, to: Vec3, space: number): boolean
{
    return distanceAcross(them, to) < space && distanceAcross(them, to) < distanceAcross(them, behavior.at);
}

// Where it was going: there a while before it heads home (or, roaming, on), and home a while before it wanders off. Come
// to see something, it looks a moment before it says its remark.
function arrive(behavior: HelperBehavior, now: number): void
{
    if (behavior.walk == "see" && behavior.sight != undefined)
        behavior.sight.saysAt = now + randomBetween(SIGHT_QUIET_MS);
    else if (behavior.walk == "wander" && behavior.prefs.anchoredToHome)
        behavior.returnHomeAt = now + randomBetween(WANDER_STAY_MS);
    else if (behavior.walk != "meet")
        behavior.nextWanderAt = now + getIdleTime(behavior.prefs);
}

// How long it idles before it next wanders, in milliseconds.
function getIdleTime(prefs: BehaviorPrefs): number
{
    return 1000 * randomBetween([prefs.minIdleTime, prefs.maxIdleTime]);
}

// Standing, it looks at whom it talks with, else at what it came to see, and else, at home, the way it was put: once a
// talk is over, or as soon as it walks in, which leaves it facing the way it came. Thinking of an answer, it turns to
// whom it is for as soon as it has nothing else left to say.
function look(behavior: HelperBehavior, surroundings: HelperSurroundings, now: number, arrived: boolean = false): void
{
    if (behavior.answering != undefined && behavior.bubbles.length == 0 && now >= behavior.nextBubbleAt)
        HelperBehaviorUtil.talkWith(behavior, [behavior.answering], now);
    const them = getGazeTarget(behavior, surroundings, now);
    if (them != undefined)
        faceToward(behavior, surroundings, them);
    else if (behavior.sight?.saysAt != undefined)
        faceToward(behavior, surroundings, behavior.sight.point);
    else if (HelperBehaviorUtil.isSamePlace(behavior.at, behavior.home)
        && (arrived || now - behavior.lastTalkAt >= STAY_AFTER_TALK_MS))
    {
        face(behavior, surroundings, HelperBehaviorUtil.getFacingPut(behavior.homeQuarterTurns));
    }
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

// Free to chat with another helper: not chatting already, nor looking at something, nor waiting on someone typing, nor
// saying anything or thinking of it, nor still after a move, nor lately talking with someone, and not waiting to chat
// again.
function isFreeToChat(behavior: HelperBehavior, now: number): boolean
{
    return behavior.smallTalk == undefined && behavior.sight == undefined && behavior.waitingFor == undefined
        && now >= behavior.nextSmallTalkAt && now >= behavior.frozenUntil
        && !HelperBehaviorUtil.isSpeaking(behavior, now) && now - behavior.lastTalkAt >= STAY_AFTER_TALK_MS;
}

// Whether nothing stands between two helpers (by their feet) at about the height of their heads.
function canSee(voxels: Voxel[], a: Vec3, b: Vec3): boolean
{
    return isInSight(voxels, {x: a.x, y: a.y + SIGHT_HEIGHT, z: a.z}, {x: b.x, y: b.y + SIGHT_HEIGHT, z: b.z});
}

// Whether no block stands between two points.
function isInSight(voxels: Voxel[], from: Vec3, to: Vec3): boolean
{
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / SIGHT_STEP);
    for (let i = 1; i < steps; ++i)
    {
        const t = i / steps;
        if (VoxelQueryUtil.isPointInVoxelBlock(voxels, {x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t}))
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

// How many degrees the way across the floor to a point is off the way someone faces (none, for where they stand).
function degreesOffFacing(from: Vec3, facing: Vec3, to: Vec3): number
{
    if (distanceAcross(from, to) == 0)
        return 0;
    return Math.abs(NpcFacingUtil.getTurn(NpcFacingUtil.getDegrees(facing),
        NpcFacingUtil.getDegrees({x: to.x - from.x, y: 0, z: to.z - from.z})));
}

function randomBetween([min, max]: number[]): number
{
    return min + Math.random() * (max - min);
}

export default HelperBehaviorUtil;
