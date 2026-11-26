import Vec3 from "../../math/types/vec3";
import Voxel from "../../voxel/types/voxel";
import { PET_BODY_HEIGHT,
    PET_BODY_WIDTH } from "../../graphics/mesh/composition/types/compositionConstants/petCompositionConstants";
import PhysicsManager from "../../physics/physicsManager";
import { COLLISION_LAYER_HEIGHT, HOUR_IN_MS, PLAYER_MESSAGE_EXPIRATION_MS } from "../../system/sharedConstants";
import VoxelReach from "../../voxel/types/voxelReach";
import VoxelVertex from "../../voxel/types/voxelVertex";
import VoxelPathUtil from "../../voxel/util/voxelPathUtil";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import PetLineMap from "../maps/petLineMap";
import AddObjectSignal from "../types/addObjectSignal";
import { PetAction, PetActionEnumMap } from "../types/petAction";
import PetBehavior from "../types/petBehavior";
import { PetEditKind } from "../types/petEditKind";
import { PetExpressionEnumMap } from "../types/petExpression";
import PetIdentity from "../types/petIdentity";
import { PetInjection, PetInjectionEnumMap } from "../types/petInjection";
import PetLine from "../types/petLine";
import PetNeeds from "../types/petNeeds";
import PetNotice from "../types/petNotice";
import PetPersonSighting from "../types/petPersonSighting";
import PetShownState from "../types/petShownState";
import PetSighting from "../types/petSighting";
import { PetSpeechToneEnumMap } from "../types/petSpeechTone";
import PetSurroundings from "../types/petSurroundings";
import MessageLinkUtil from "./messageLinkUtil";
import NpcFacingUtil from "./npcFacingUtil";
import ObjectObstacleUtil from "./objectObstacleUtil";
import PetAffinityUtil from "./petAffinityUtil";
import PetBodyUtil, { PET_WALKER } from "./petBodyUtil";
import PetIdentityUtil, { PET_TRAIT_LEVELS } from "./petIdentityUtil";
import PetNeedsUtil from "./petNeedsUtil";
import PetShownStateUtil from "./petShownStateUtil";
import StringUtil from "../../math/util/stringUtil";

// How a pet behaves, wherever it is played: by its owner's browser (see PetDriverUtil), or by the server, for a pet
// the room keeps or an agent's (see PetPlayUtil). Whoever plays it moves its body by physics along the way it sets
// (see steer), gives it a beat a few times a second (see update), tells it what happens to it (a blast, a push, a
// fright, something built near it, a line someone said, someone speaking to it and what it answers, what was put into
// it), and shows the room what it then shows of itself (see getShownState).
//
// It does one thing at a time, and a thing that matters more takes over from one that matters less: panic first, then
// an attack, a flight, going to whoever said its name in a line another answers, a talk with someone who spoke to it
// (by its name too, which it answers where it stands), getting out of a fan's wind that holds it up (staying with
// whoever called it gives way to that too), sleep, and only then its idle doings (a word on what someone built, a chat
// with another pet, a hug, a word to someone near, a word on something placed near it, a wander), each a good while
// after the last. Out of battery it does none of these: it stands where it is. Put down behind a door, it walks out of it before anything else (see enter). Whatever happens
// to it, it reacts to only after a moment (see PET_REACTION_MS), though what a
// thing does to it, it does at once. Its health and its battery run down as it is played, unless its health is kept
// where it is (see PetIdentity), and its anger, horror and fatigue come and go with what happens to it and what it is
// like (see PetTraits).

// How long a pet's health lasts from full, and its battery, while it is played.
export const PET_HEALTH_HOURS = 12;
export const PET_ENERGY_HOURS = 1.5;
// Health left for less than this long is failing: it says so.
export const PET_DYING_HOURS = 1;
// How many times as fast its health goes while another pet attacks it, and the hours' worth a cannon ball's blast takes:
// so both take a share of its health that grows as that lasts less.
export const PET_ATTACK_DAMAGE_RATE = 180;
export const PET_BLAST_DAMAGE_HOURS = 3;
// The share of its health a wrench mends (see inject); a battery charges it in full.
export const PET_WRENCH_HEALTH = 1 / 3;
// How long it stays awake before it is worn out, and how long it sleeps that off, in seconds; the fatigue from which
// its eyes droop, and from which it lies down once it has nothing else on.
const AWAKE_SECONDS = 20 * 60;
const SLEEP_SECONDS = 90;
const SLEEPY_AT = 0.7;
const SLEEP_AT = 0.92;
// Anger and horror die down by this share a second: anger faster the less aggressive it is, and faster still over
// something pleasant; horror faster while it panics.
const ANGER_DECAY = 0.08;
const ANGER_DECAY_BY_AGGRESSIVENESS = [1.4, 1, 0.6];
const PLEASANT_CALM = 3;
const HORROR_DECAY = 0.06;
const PANIC_CALM = 4;
// What rouses it, by how aggressive it is (anger) and how brave (horror).
const ANGER_GAIN_BY_AGGRESSIVENESS = [0.6, 1, 1.5];
const HORROR_GAIN_BY_BRAVERY = [1.5, 1, 0.5];
// Anger a second while it is attacked, and while a pet it hates is this near.
const ATTACKED_ANGER_RATE = 0.15;
const HATED_ANGER_RATE = 0.03;
const HATED_DISTANCE = 3;
// It panics from this much horror up, and calms down only once it is well below that; from this much it runs from
// what frightened it for a moment.
export const PET_PANIC_START = 0.75;
export const PET_PANIC_STOP = 0.25;
const FLEE_HORROR = 0.4;
// It scowls from this much anger, and sets on a pet it hates from this much.
const ANGRY_AT = 0.5;
const ATTACK_ANGER = 0.7;
// A fright (see expose): how far it carries, losing little of its force at first and the most toward its end, and what
// an attack beginning, a cannon ball bursting and a body thrown by a fan's wind each rouse at its middle, in anger and
// in horror.
export const PET_FRIGHT_RADIUS = 10.5;
export const PET_ATTACK_FRIGHT = {anger: 0.3, horror: 0.5};
export const PET_BLAST_FRIGHT = {anger: 0.1, horror: 0.7};
export const PET_GUST_FRIGHT = {anger: 0.05, horror: 0.35};

// What it notices, it reacts to only after a moment, in milliseconds: something built, its name, someone speaking to
// it, what was put into it, another pet asking it to chat, its owner gone off; and what startles it (a blast, a push,
// a fright, being set on) sooner.
export const PET_REACTION_MS = [600, 1500];
export const PET_START_MS = [300, 700];

// How fast it goes, in world units a second: at a stroll, out of the door it comes into a room by, to see what someone
// has just built, after its owner, to whoever said its name, in a fright, at what it attacks and back from it, to
// someone it hugs and keeping by them, and out of a fan's wind.
const WALK_SPEED = 0.8;
const ENTERING_SPEED = 1.6;
const EDIT_VISIT_SPEED = 2;
const FOLLOW_SPEED = 2.4;
const COME_SPEED = 2.8;
const PANIC_SPEED = 4.5;
const FLEE_SPEED = 4;
const CHARGE_SPEED = 6;
const BACK_OFF_SPEED = 2.6;
const HUG_SPEED = 1.6;
const PRESS_SPEED = 1.2;
const WIND_ESCAPE_SPEED = 2;
// How fast it turns, in degrees a second, at its ease and in a fight or a fright; and how far off its way it may face
// and still go: farther off, it stands and turns to it first.
export const PET_TURN_RATE = 100;
export const PET_HURRIED_TURN_RATE = 300;
export const PET_MAX_DEGREES_OFF_WAY = 25;
// A point of its way is reached this near, and a way given up once it has got nowhere for this long; its way into a
// room, once it has taken this long over it.
const REACHED_DISTANCE = 0.12;
const STUCK_MS = 2500;
const PROGRESS_DISTANCE = 0.25;
export const PET_ENTERING_TIMEOUT_MS = 6000;
// A way set again counts as another only if it ends this far from where the last did.
const SAME_WAY_DISTANCE = 0.3;

// A wander: how far it looks for somewhere to go, up and down stairs too, the least it goes, how long it stands between
// two (and before its first, as it comes into a room, whose doorway it soon leaves), and how far from its owner it lets
// itself be across the floor plan, on whichever floor, by how it depends on them (the least dependent goes where it
// likes).
const WANDER_REACH = 12;
const MIN_WANDER_DISTANCE = 1.5;
const IDLE_MS = [8000, 24_000];
const FIRST_IDLE_MS = [500, 2000];
export const PET_LEASH_BY_DEPENDENCE = [Infinity, 8, 3.5];
// Dying, any pet keeps this close to its owner, or to what they look at while they edit, to be given a wrench.
export const PET_DYING_LEASH = 2;
const LEASH_SLACK = 1.5;
// Where it wanders to (see pickWanderPlace), by how curious it is: how often up or down a stair, where it can; how far
// it likes to go, a place this much farther off counting a share 1/e as much; and how much a place's oddity draws it,
// the least curious away from it, the most toward it. A place is odd for how high it is, a drop beside it, how walled
// in it is, a fan this near it, and how far it lies from the last few places it went to, which are known to it: up to
// one each, for a place a stair's height up, and one this far from the nearest known place.
export const PET_OTHER_FLOOR_CHANCE_BY_CURIOSITY = [0.15, 0.25, 0.4];
export const PET_WANDER_SCALE_BY_CURIOSITY = [1.5, 2.5, 8];
export const PET_CURIOSITY_PULL = [-1, 0.2, 1];
const NUM_PLACES_REMEMBERED = 8;
const UNKNOWN_DISTANCE = 4;
const HIGH_PLACE_HEIGHT = 2;
const DROP_LAYERS = 3;
const FAN_DISTANCE = 2.5;
// Past its leash, it looks for a way after its owner this often, out to a walk this long, and says so this often.
const FOLLOW_RETRY_MS = 2000;
const MAX_FOLLOW_REACH = 24;
const FOLLOW_WORDS_CHANCE = 0.3;
// It keeps this far from people and from other pets where it stops (no nearer a pet than two that chat may be), and
// seeks a pet out this often, by how sociable it is, to stop within this of one.
const PERSON_SPACE = 1.2;
const PET_SPACE = 1.4;
const COMPANY_CHANCE_BY_SOCIABILITY = [0.1, 0.35, 0.65];
const COMPANY_DISTANCE = 2.5;
// Going up to someone (to hug them, or at their call), it stops this far from them, middle to middle, give or take this:
// no nearer, so that their first-person view, looking level, shows its head and its eyes over the chat bar along the
// bottom of the screen, and all of its bubble.
export const PET_APPROACH_DISTANCE = 1.5;
export const PET_APPROACH_SLACK = 0.2;
// Two points are on one floor if no further apart in height.
const SAME_FLOOR_HEIGHT = 1;

// After any of its idle doings (a chat, a word, a hug, a talk with someone), it begins no other of its own accord
// for this long.
const QUIET_MS = [12_000, 25_000];
// A chat: how near and how often it begins one, by how sociable it is; how near the other may be, middle to middle,
// before it backs off from it, and how far it then backs, which leaves about a body's width between their faces; how
// long a line stays up to be read; and how long it waits on the other's answer past that.
const TALK_DISTANCE = 3.2;
const TALK_BREAK_DISTANCE = 5;
export const PET_TALK_MIN_SPACE = 1.4;
export const PET_TALK_SPACE = 1.7;
const TALK_INTERVAL_MS_BY_SOCIABILITY = [[240_000, 480_000], [100_000, 200_000], [50_000, 100_000]];
const TALK_RETRY_MS = 6000;
const TALK_GRACE_MS = 6000;
const MIN_BUBBLE_MS = 2000;
const BUBBLE_NOTICE_MS = 800;
const BUBBLE_MS_PER_CHAR = 60;
// What it says stays up a good while after it has been read, as long as a player's message does or this many times
// its reading, whichever is longer, unless it says something else first.
const BUBBLE_READS = 3;
// Its face keeps the mood of what it said or did this long after that is over (see getExpression).
export const PET_MOOD_LINGER_MS = [6000, 8000];
// A word on something near it: how near, and how often, the less sociable the oftener.
const REMARK_DISTANCE = 5;
const REMARK_INTERVAL_MS_BY_SOCIABILITY = [[70_000, 140_000], [120_000, 240_000], [180_000, 360_000]];
const REMARK_RETRY_MS = 15_000;
// A word on what someone has built: how near it notices, how likely by how it depends on its owner, how much likelier
// for its owner's doing than a stranger's, how long it keeps the thought, and how long it leaves between two. It says
// it in front of what was built, as seen from where whoever built it watches: from a place this far from it across
// the floor plan, the nearer the better to this far toward them, with no more than this between their heights, and
// gives up getting there after this long.
const EDIT_NOTICE_DISTANCE = 8;
const EDIT_REMARK_CHANCE_BY_DEPENDENCE = [0.1, 0.25, 0.45];
const OWNER_EDIT_WEIGHT = 1.5;
const STRANGER_EDIT_WEIGHT = 0.5;
const EDIT_THOUGHT_MS = 3000;
const EDIT_REMARK_INTERVAL_MS = 30_000;
export const PET_EDIT_VIEW_DISTANCE = [1, 2.5];
const EDIT_VIEW_IDEAL_DISTANCE = 1.6;
const EDIT_VIEW_HEIGHT = 3;
const EDIT_VISIT_MS = 8000;
// A hug, which only the most dependent gives: how often, to its owner this often and else to whoever is near, how long
// it keeps by them once there, and how far they may get before it gives up.
const HUG_INTERVAL_MS = [90_000, 200_000];
const HUG_OWNER_CHANCE = 0.8;
const HUG_SIGHT = 10;
const PRESS_MS = [4000, 7000];
const HUG_BREAK_DISTANCE = 12;
// An attack: how near a pet it hates must be, how long it lasts, how near a charge strikes, how far and how long it
// backs off between two, how far its victim may get before it gives up, what it takes off its anger, and how long
// before another. Struck from this near, a pet is being attacked. Set on after this long in peace, it starts. It
// fights back this often, by how aggressive it is, and else runs.
const ATTACK_SIGHT = 5;
const ATTACK_MS = [6000, 14_000];
// Bodies only push one another softly, so a charge stops short of the other (run on, it would pass through its victim):
// a hand's width short of two bodies face to face, which keeps two a little askew from overlapping at their corners. It
// strikes from past where two bodies come to rest.
export const PET_CHARGE_STOP_DISTANCE = PET_BODY_WIDTH + 0.2;
const HIT_DISTANCE = 1.2;
const BACK_OFF_DISTANCE = 1.4;
const BACK_OFF_MS = 700;
const ATTACK_BREAK_DISTANCE = 9;
const ATTACK_RELIEF = 0.5;
const ATTACK_COOLDOWN_MS = 20_000;
export const PET_ATTACK_REACH = 3;
const PEACE_MS = 20_000;
const COUNTER_CHANCE_BY_AGGRESSIVENESS = [0.15, 0.5, 0.9];
// A flight: for how long, and how far it looks for somewhere to run to.
const FLEE_MS = [3000, 5000];
const FLEE_REACH = 8;
// Out of a fan's wind that holds it up: how far it looks for a place no wind lifts it at.
const WIND_ESCAPE_REACH = 3;
// Its name said: how long it still heeds that while something more pressing keeps it, how long it stays with whoever
// said it, and how long it keeps trying to get there.
const CALL_HEED_MS = 4000;
const COME_STAY_MS = [3000, 5000];
const COME_TIMEOUT_MS = 20_000;
// A word to someone near who is doing nothing in particular: how near, how often by how it depends on its owner, how
// many times as likely to its owner as to any one other person, and how often it has one for anyone else at all.
const PERSON_REMARK_DISTANCE = 6;
const PERSON_REMARK_INTERVAL_MS_BY_DEPENDENCE = [[240_000, 480_000], [120_000, 240_000], [60_000, 120_000]];
const PERSON_REMARK_RETRY_MS = 10_000;
const OWNER_TALK_WEIGHT = 4;
const STRANGER_TALK_CHANCE = 0.5;
// Someone speaking to it (see attend): how long it still turns to them for while something more pressing keeps it, how
// long it waits turned to them for its answer, how long it stays so once that has been read, how far they may go
// meanwhile (anywhere, for one who spoke to it by its name from farther off still), and how long an answer keeps while
// it can't be said.
const HEARD_HEED_MS = 4000;
export const PET_ANSWER_WAIT_MS = 12_000;
const CHAT_STAY_MS = 6000;
const CHAT_BREAK_DISTANCE = 10;
const REPLY_KEEP_MS = 5000;
// A start: how long its face shows it. A mood from what it was given: how long that shows.
const STARTLED_MS = 1200;
const CHEER_MS = 3000;
// Its words for its needs: how long they take to read, and how long after that the next come.
const NEED_WORDS_MS = 5000;
const NEED_WORDS_INTERVAL_MS = [9000, 16_000];
// In poor health it looks sad in spells: each this long, the more of them the less health it has left below this.
const SAD_HEALTH = 1 / 3;
const SAD_SPELL_MS = 6000;
const SAD_SHARE = [0.3, 0.9];

const HEALTH_SECONDS = PET_HEALTH_HOURS * HOUR_IN_MS / 1000;
const ENERGY_SECONDS = PET_ENERGY_HOURS * HOUR_IN_MS / 1000;
const HEAD_HEIGHT = 0.8 * PET_BODY_HEIGHT;
// A point in a block is seen if this little of the way to it is hidden.
const SEEN_SHORT_OF = 0.3;
const TOP_LEVEL = PET_TRAIT_LEVELS - 1;
const ZERO: Vec3 = {x: 0, y: 0, z: 0};

const A = PetActionEnumMap;

const PetBehaviorUtil =
{
    // A pet as it comes into a room, standing idle, about to look around it.
    create: (objectId: string, ownerUserID: string, identity: PetIdentity, needs: PetNeeds, at: Vec3, facing: number,
        now: number): PetBehavior =>
    {
        const {sociability, dependence} = identity.traits;
        const b: PetBehavior = {
            objectId, ownerUserID, identity, needs: {...needs}, at: {...at}, facing,
            action: A.Idle, actionSince: now, actionUntil: Infinity, targetId: "", dead: false,
            path: [], speed: WALK_SPEED, pathRevision: 0, pathEnd: undefined, backingOff: false, standFacing: undefined,
            turning: false, wayFacing: undefined,
            progressFrom: {...at}, progressAt: now, stuck: false,
            saying: "", tone: PetSpeechToneEnumMap.Normal, sayingUntil: 0, bubbleUntil: 0, addressee: "",
            expression: PetExpressionEnumMap.Neutral, mood: 0, moodUntil: 0, startledUntil: 0, excited: false, hits: 0,
            nextWanderAt: now + randomBetween(FIRST_IDLE_MS), nextFollowAt: now,
            nextTalkAt: now + 0.5 * randomBetween(TALK_INTERVAL_MS_BY_SOCIABILITY[sociability]),
            nextRemarkAt: now + 0.5 * randomBetween(REMARK_INTERVAL_MS_BY_SOCIABILITY[sociability]),
            nextEditRemarkAt: now, nextHugAt: now + randomBetween(HUG_INTERVAL_MS), nextAttackAt: now,
            nextPersonRemarkAt: now + 0.3 * randomBetween(PERSON_REMARK_INTERVAL_MS_BY_DEPENDENCE[dependence]),
            nextNeedWordsAt: now + randomBetween([1000, 4000]), quietUntil: 0, heldUntil: 0, enteringUntil: 0, notices: [],
            topic: 0, turn: 0, talkStarter: false, talkNextAt: Infinity, talkDeadline: Infinity,
            talkedWith: "", talkedWithUntil: 0, invitation: undefined, charging: false, backOffUntil: 0, pressUntil: 0,
            lastAttackedAt: -Infinity, seenAttacking: {}, setOn: undefined, frightAt: undefined, strayed: false,
            visited: [{...at}], pendingEdit: undefined, editVisit: undefined, calledBy: undefined, stayUntil: 0,
            heard: undefined, reply: undefined, chatReach: CHAT_BREAK_DISTANCE, asksForBatteryNext: true,
        };
        keepFixedNeeds(b);
        return b;
    },
    // Has it come into its room first, along a way across the floor, as one put down behind a door walks out of it
    // (see PetEntranceUtil): until it is at the end of that, or has taken too long over it, it does nothing else,
    // with or without a charge in its battery.
    enter: (b: PetBehavior, way: Vec3[], now: number): void =>
    {
        if (b.dead || way.length == 0)
            return;
        b.enteringUntil = now + PET_ENTERING_TIMEOUT_MS;
        setPath(b, way.map(point => ({...point})), ENTERING_SPEED);
    },
    // A beat of its life, a few times a second: its needs for the seconds since the last, what it makes of the pets
    // about it, then whatever it does next, and the face and the words that go with it.
    update: (b: PetBehavior, s: PetSurroundings, seconds: number): void =>
    {
        if (b.dead)
            return;
        const attackers = s.pets.filter(pet => pet.shown.action == A.Attack && pet.shown.targetId == b.objectId
            && flatDistance(pet.at, b.at) <= PET_ATTACK_REACH && onSameFloor(pet.at, b.at));
        stepNeeds(b, s, seconds, attackers.length > 0);
        if (b.needs.health <= 0)
        {
            die(b, s.now);
            return;
        }
        // On its way in, it sees to nothing else; once in, it looks about it as one that has just come.
        if (b.enteringUntil > 0)
        {
            if (b.path.length > 0 && s.now < b.enteringUntil)
            {
                b.expression = getExpression(b, s.now);
                return;
            }
            b.enteringUntil = 0;
            setPath(b, [], WALK_SPEED);
            b.nextWanderAt = s.now + randomBetween(FIRST_IDLE_MS);
        }
        // Held, it stands as it was left, whatever goes on about it.
        if (s.now < b.heldUntil)
        {
            b.notices = [];
            b.expression = getExpression(b, s.now);
            return;
        }
        react(b, s);
        noticeAttacks(b, s, attackers);
        if (s.now >= b.bubbleUntil && b.saying.length > 0)
            hush(b);
        trackProgress(b, s.now);
        if (PetBehaviorUtil.isPowerless(b))
            actPowerless(b, s);
        else
            act(b, s);
        b.stuck = false;
        sayNeeds(b, s.now);
        b.expression = getExpression(b, s.now);
    },
    // The velocity it goes at for a step of its way, across the floor, turning it to face where it goes (or the way it
    // stands facing): for whoever plays it to move its body by, through physics. Facing too far off its way, it stands
    // and turns to it first (see PetBehavior.turning).
    steer: (b: PetBehavior, seconds: number): Vec3 =>
    {
        while (b.path.length > 0 && flatDistance(b.at, b.path[0]) < REACHED_DISTANCE)
            b.path.shift();
        aim(b);
        if (b.dead || b.path.length == 0 || b.backingOff)
        {
            if (b.standFacing != undefined)
                turnToward(b, b.standFacing, seconds);
        }
        else if (b.wayFacing != undefined)
            turnToward(b, b.wayFacing, seconds);
        if (b.dead || b.path.length == 0 || b.turning)
            return ZERO;
        const to = b.path[0];
        const distance = flatDistance(b.at, to);
        const speed = Math.min(b.speed, distance / Math.max(seconds, 1e-6));
        return {x: (to.x - b.at.x) / distance * speed, y: 0, z: (to.z - b.at.z) / distance * speed};
    },
    // How fast a pet turns at what it is doing, in degrees a second: for whoever plays it, and for a browser that only
    // shows it.
    getTurnRate: (action: PetAction): number =>
    {
        return (action == A.Attack || action == A.Panic || action == A.Flee) ? PET_HURRIED_TURN_RATE : PET_TURN_RATE;
    },
    // What it shows the room of itself (see PetShownState).
    getShownState: (b: PetBehavior): PetShownState =>
    {
        return {
            action: b.action,
            expression: b.expression,
            sleepy: !b.dead && b.action != A.Sleep && b.needs.fatigue >= SLEEPY_AT,
            powerless: !b.dead && PetBehaviorUtil.isPowerless(b),
            excited: b.excited,
            tone: b.tone,
            batteryLevel: PetShownStateUtil.getBatteryLevel(b.needs.energy),
            rust: PetShownStateUtil.getRust(b.needs.health),
            hits: b.hits,
            topic: b.topic,
            turn: b.turn,
            facing: b.turning ? b.wayFacing : (b.path.length == 0 || b.backingOff) ? b.standFacing : undefined,
            targetId: b.targetId,
        };
    },
    isPowerless: (b: PetBehavior): boolean =>
    {
        return b.needs.energy <= 0;
    },
    // Whether its health has not long left (see PET_DYING_HOURS).
    isDying: (needs: PetNeeds): boolean =>
    {
        return needs.health <= PET_DYING_HOURS / PET_HEALTH_HOURS;
    },
    // Something someone has just built or changed, where: near enough, with nothing else on, it may mean to say a word on
    // it once it has taken it in, the likelier the more it depends on its owner, and for its owner's doing above all.
    // viewFrom: where whoever did it watches it from, if whoever plays the pet knows (its user's own camera); else where
    // their player is.
    noticeEdit: (b: PetBehavior, s: PetSurroundings, kind: PetEditKind, at: Vec3, byUserID: string,
        viewFrom?: Vec3): void =>
    {
        if (b.dead || !isFree(b) || PetBehaviorUtil.isPowerless(b) || b.pendingEdit != undefined
            || s.now < Math.max(b.nextEditRemarkAt, b.heldUntil, b.quietUntil)
            || Math.hypot(at.x - b.at.x, at.y - b.at.y, at.z - b.at.z) > EDIT_NOTICE_DISTANCE)
        {
            return;
        }
        const chance = EDIT_REMARK_CHANCE_BY_DEPENDENCE[b.identity.traits.dependence]
            * ((byUserID == b.ownerUserID) ? OWNER_EDIT_WEIGHT : STRANGER_EDIT_WEIGHT);
        if (Math.random() < chance)
        {
            const from = s.now + randomBetween(PET_REACTION_MS);
            const watcher = viewFrom ?? s.people.find(person => person.userID == byUserID)?.at;
            b.pendingEdit = {kind, at: {...at}, byUserID, viewFrom: (watcher == undefined) ? undefined : {...watcher},
                from, until: from + EDIT_THOUGHT_MS};
        }
    },
    // A cannon ball's blast has reached it: it costs it health, and it starts, a moment later.
    takeBlast: (b: PetBehavior, s: PetSurroundings): void =>
    {
        if (b.dead)
            return;
        b.needs.health = Math.max(0, b.needs.health - PET_BLAST_DAMAGE_HOURS / PET_HEALTH_HOURS);
        keepFixedNeeds(b);
        note(b, {kind: "start", due: s.now + randomBetween(PET_START_MS)});
    },
    // Something has thrown it about (a blast, a fan's wind): it starts, a moment later.
    takePush: (b: PetBehavior, s: PetSurroundings): void =>
    {
        if (!b.dead)
            note(b, {kind: "start", due: s.now + randomBetween(PET_START_MS)});
    },
    // A fright near it (see PET_FRIGHT_RADIUS): a moment later, it rouses its anger and its horror, the less the farther
    // off it was, each by what the pet is like (see takeFright). fighterIds: the pets fighting there, if any.
    expose: (b: PetBehavior, s: PetSurroundings, at: Vec3, fright: {anger: number, horror: number},
        fighterIds: string[] = []): void =>
    {
        const distance = Math.hypot(at.x - b.at.x, at.y - b.at.y, at.z - b.at.z);
        if (b.dead || distance >= PET_FRIGHT_RADIUS)
            return;
        const share = PetBehaviorUtil.getFrightShare(distance);
        const {aggressiveness, bravery} = b.identity.traits;
        note(b, {kind: "fright", due: s.now + randomBetween(PET_START_MS), at: {...at},
            anger: fright.anger * ANGER_GAIN_BY_AGGRESSIVENESS[aggressiveness] * share,
            horror: fright.horror * HORROR_GAIN_BY_BRAVERY[bravery] * share, fighterIds});
    },
    // The share of a fright's force that reaches so far from it: nearly all of it for a good way, then less and less,
    // none at PET_FRIGHT_RADIUS.
    getFrightShare: (distance: number): number =>
    {
        const reach = Math.min(1, Math.max(0, distance / PET_FRIGHT_RADIUS));
        return 1 - reach * reach;
    },
    // The server's word that someone has put a battery or a wrench into it (see InjectPetSignal): a battery charges it
    // in full, and a wrench mends a share of its health, unless either is kept where it is; a moment later, it says so.
    inject: (b: PetBehavior, s: PetSurroundings, injection: PetInjection): void =>
    {
        if (b.dead)
            return;
        const charged = injection == PetInjectionEnumMap.Battery;
        if (charged)
            b.needs.energy = 1;
        else
            b.needs.health = Math.min(1, b.needs.health + PET_WRENCH_HEALTH);
        keepFixedNeeds(b);
        note(b, {kind: "injection", due: s.now + randomBetween(PET_REACTION_MS), charged});
    },
    // A line someone has just said in its room: at its own name, it goes to them, once it has taken that in and
    // whatever more pressing it is at lets it, if that is soon; but not when the line is for it, which it answers
    // instead (see attend), whichever of the two it is told first. Out of battery it hears nothing.
    hear: (b: PetBehavior, s: PetSurroundings, byUserID: string, text: string): void =>
    {
        if (b.dead || PetBehaviorUtil.isPowerless(b) || s.now < b.heldUntil || !PetBehaviorUtil.mentions(text, b.identity.name))
            return;
        const speaker = s.people.find(person => person.userID == byUserID);
        if (speaker != undefined && isTurningTo(b, speaker.objectId))
            return;
        const from = s.now + randomBetween(PET_REACTION_MS);
        b.calledBy = {userID: byUserID, from, until: from + CALL_HEED_MS};
    },
    // Someone has spoken to it, by their player's object, as whoever finds whom a line is for tells whoever plays it
    // (see PetChatUtil): once it has taken that in and whatever more pressing it is at lets it, if that is soon, it
    // leaves its idle doings and stands turned to them where it is, for its answer to come (see answer), going to them at
    // their call no longer. Asleep, only its name reaches it (see PetListenerUtil), which wakes it; out of battery,
    // nothing does.
    attend: (b: PetBehavior, s: PetSurroundings, personObjectId: string): void =>
    {
        if (b.dead || PetBehaviorUtil.isPowerless(b) || s.now < b.heldUntil)
            return;
        const userID = s.people.find(person => person.objectId == personObjectId)?.userID;
        if (userID != undefined && b.calledBy?.userID == userID)
            b.calledBy = undefined;
        if (b.action == A.Come && b.targetId == personObjectId)
            endAction(b, s.now);
        if (b.action == A.Chat && b.targetId == personObjectId)
            b.actionUntil = Math.max(b.actionUntil, s.now + PET_ANSWER_WAIT_MS);
        else if (b.heard?.personObjectId != personObjectId)
        {
            const from = s.now + randomBetween(PET_REACTION_MS);
            b.heard = {personObjectId, from, until: from + HEARD_HEED_MS};
        }
    },
    // Its answer to someone who spoke to it, as Claude wrote it (see PetChatUtil): said once it is turned to them, if
    // that is soon.
    answer: (b: PetBehavior, s: PetSurroundings, personObjectId: string, line: PetLine): void =>
    {
        if (b.dead || PetBehaviorUtil.isPowerless(b) || s.now < b.heldUntil)
            return;
        b.reply = {personObjectId, line, until: s.now + PET_REACTION_MS[1] + REPLY_KEEP_MS};
        PetBehaviorUtil.attend(b, s, personObjectId);
    },
    // Keeps it standing idle and silent where it is for a while, whatever else it would do (a pet just generated, while
    // its owner is told something of it; see PetDriverUtil).
    hold: (b: PetBehavior, now: number, milliseconds: number): void =>
    {
        if (b.dead)
            return;
        endAction(b, now);
        hush(b);
        b.heard = undefined;
        b.reply = undefined;
        b.heldUntil = now + milliseconds;
    },
    // Whether a line names a pet, letter case aside. Where the name begins or ends in a plain letter or digit, the line
    // has none right against it there, so that a short name isn't found inside a longer word; scripts written without
    // spaces are taken as they come.
    mentions: (text: string, name: string): boolean =>
    {
        const line = text.toLocaleLowerCase();
        const word = name.toLocaleLowerCase();
        if (word.length == 0)
            return false;
        const isPlain = (char: string | undefined) => char != undefined && /[a-z0-9]/.test(char);
        for (let at = line.indexOf(word); at >= 0; at = line.indexOf(word, at + 1))
        {
            const runsOnBefore = isPlain(word[0]) && isPlain(line[at - 1]);
            const runsOnAfter = isPlain(word[word.length - 1]) && isPlain(line[at + word.length]);
            if (!runsOnBefore && !runsOnAfter)
                return true;
        }
        return false;
    },
    // How long a line stays up to be read, in milliseconds.
    getReadTime: (text: string): number =>
    {
        return Math.max(MIN_BUBBLE_MS, BUBBLE_NOTICE_MS + BUBBLE_MS_PER_CHAR * MessageLinkUtil.getVisibleLength(text));
    },
}

// Its health and its battery run down, the faster for an attack; its fatigue grows awake and goes asleep; its anger
// and its horror die down, and anger grows under attack and beside a pet it hates.
function stepNeeds(b: PetBehavior, s: PetSurroundings, seconds: number, attacked: boolean): void
{
    const needs = b.needs;
    const {aggressiveness} = b.identity.traits;
    needs.health -= seconds / HEALTH_SECONDS * (attacked ? PET_ATTACK_DAMAGE_RATE : 1);
    needs.energy -= seconds / ENERGY_SECONDS;
    needs.fatigue += (b.action == A.Sleep) ? -seconds / SLEEP_SECONDS : seconds / AWAKE_SECONDS;

    const pleasant = s.now < b.moodUntil && b.mood > 0;
    needs.anger *= Math.exp(-ANGER_DECAY * ANGER_DECAY_BY_AGGRESSIVENESS[aggressiveness] * (pleasant ? PLEASANT_CALM : 1)
        * seconds);
    const gain = ANGER_GAIN_BY_AGGRESSIVENESS[aggressiveness] * seconds;
    if (attacked)
        needs.anger += ATTACKED_ANGER_RATE * gain;
    if (s.pets.some(pet => flatDistance(pet.at, b.at) <= HATED_DISTANCE && onSameFloor(pet.at, b.at) && hates(b, pet)))
        needs.anger += HATED_ANGER_RATE * gain;
    needs.horror *= Math.exp(-HORROR_DECAY * ((b.action == A.Panic) ? PANIC_CALM : 1) * seconds);
    PetNeedsUtil.clamp(needs);
    keepFixedNeeds(b);
}

// A pet whose health or charge is kept where it is has that, whatever has just happened to it (see PetIdentity).
function keepFixedNeeds(b: PetBehavior): void
{
    const fixedHealth = PetIdentityUtil.getFixedHealth(b.identity);
    if (fixedHealth != undefined)
        b.needs.health = fixedHealth;
    const fixedEnergy = PetIdentityUtil.getFixedEnergy(b.identity);
    if (fixedEnergy != undefined)
        b.needs.energy = fixedEnergy;
}

// Keeps something that has happened to it, to react to once it is due; past this many, the oldest gives way.
const MAX_NOTICES = 16;
function note(b: PetBehavior, notice: PetNotice): void
{
    b.notices.push(notice);
    b.notices.splice(0, Math.max(0, b.notices.length - MAX_NOTICES));
}

// Reacts to whatever has happened to it that is now due: a start, a fright, a word on what was put into it.
function react(b: PetBehavior, s: PetSurroundings): void
{
    const due = b.notices.filter(notice => s.now >= notice.due);
    if (due.length == 0)
        return;
    b.notices = b.notices.filter(notice => s.now < notice.due);
    for (const notice of due)
    {
        if (notice.kind == "start")
            startle(b, s.now);
        else if (notice.kind == "fright")
            takeFright(b, s, notice);
        else
        {
            speak(b, s.now, PetLineMap.pickCueLine(notice.charged ? "charged" : "repaired"));
            b.mood = 1;
            b.moodUntil = Math.max(b.moodUntil, s.now + CHEER_MS);
        }
    }
}

// A fright, taken in: its anger and its horror rise, and it wakes. Roused enough to fight, the most aggressive joins in
// against whichever of the pets fighting there it likes least; frightened short of panic, it runs from there for a
// moment.
function takeFright(b: PetBehavior, s: PetSurroundings, fright: Extract<PetNotice, {kind: "fright"}>): void
{
    b.needs.anger = Math.min(1, b.needs.anger + fright.anger);
    b.needs.horror = Math.min(1, b.needs.horror + fright.horror);
    b.frightAt = {...fright.at};
    wake(b, s.now);
    if (PetBehaviorUtil.isPowerless(b) || b.action == A.Attack || b.action == A.Panic || b.needs.horror >= PET_PANIC_START)
        return;

    const fighters = s.pets.filter(pet => fright.fighterIds.includes(pet.objectId) && pet.objectId != b.objectId);
    if (b.identity.traits.aggressiveness == TOP_LEVEL && b.needs.anger >= ATTACK_ANGER && fighters.length > 0
        && s.now >= b.nextAttackAt)
    {
        const score = (pet: PetSighting) => PetAffinityUtil.getScore(b.objectId, b.identity.traits, pet.objectId,
            pet.identity.traits);
        startAttack(b, s, fighters.sort((a, c) => score(a) - score(c))[0].objectId);
    }
    else if (b.needs.horror >= FLEE_HORROR && b.action != A.Flee)
        startFlee(b, s, fright.at);
}

// Set on by another pet after a time in peace, it starts a moment later, and fights back or runs; and an attack it sees
// begin near it is a fright (see PetBehaviorUtil.expose).
function noticeAttacks(b: PetBehavior, s: PetSurroundings, attackers: PetSighting[]): void
{
    if (attackers.length > 0)
    {
        if (s.now - b.lastAttackedAt > PEACE_MS && b.setOn == undefined)
            b.setOn = {byId: attackers[0].objectId, due: s.now + randomBetween(PET_START_MS)};
        b.lastAttackedAt = s.now;
    }
    if (b.setOn != undefined && s.now >= b.setOn.due)
    {
        const attacker = s.pets.find(pet => pet.objectId == b.setOn!.byId);
        b.setOn = undefined;
        startle(b, s.now);
        if (attacker != undefined && !PetBehaviorUtil.isPowerless(b) && b.action != A.Attack && b.action != A.Panic)
        {
            if (Math.random() < COUNTER_CHANCE_BY_AGGRESSIVENESS[b.identity.traits.aggressiveness])
                startAttack(b, s, attacker.objectId);
            else
            {
                startFlee(b, s, attacker.at);
                speak(b, s.now, PetLineMap.pickCueLine("attacked"));
            }
        }
    }

    const seen: {[objectId: string]: boolean} = {};
    for (const pet of s.pets)
    {
        const attacking = pet.shown.action == A.Attack;
        seen[pet.objectId] = attacking;
        if (attacking && !b.seenAttacking[pet.objectId] && pet.shown.targetId != b.objectId)
            PetBehaviorUtil.expose(b, s, pet.at, PET_ATTACK_FRIGHT, [pet.objectId, pet.shown.targetId]);
    }
    b.seenAttacking = seen;
}

// What it does next, with a charge in its battery: the thing that matters most of those it is at, or has cause to
// begin.
function act(b: PetBehavior, s: PetSurroundings): void
{
    const now = s.now;

    if (b.action == A.Panic)
    {
        if (b.needs.horror >= PET_PANIC_STOP)
        {
            runAbout(b, s);
            return;
        }
        endAction(b, now);
    }
    else if (b.needs.horror >= PET_PANIC_START)
    {
        startPanic(b, s);
        return;
    }

    if (b.action == A.Attack)
    {
        if (continueAttack(b, s))
            return;
        endAttack(b, now);
    }
    if (b.action == A.Flee)
    {
        if (now < b.actionUntil)
        {
            if (b.path.length == 0 && b.frightAt != undefined)
                runFrom(b, s, b.frightAt);
            return;
        }
        endAction(b, now);
    }
    const victim = findVictim(b, s);
    if (victim != undefined)
    {
        startAttack(b, s, victim.objectId);
        return;
    }

    // Its name said, it leaves whatever else it was at and goes to whoever said it, once it has taken that in.
    if (b.calledBy != undefined && now >= b.calledBy.until)
        b.calledBy = undefined;
    if (b.calledBy != undefined && now >= b.calledBy.from)
    {
        const caller = s.people.find(person => person.userID == b.calledBy!.userID);
        b.calledBy = undefined;
        if (caller != undefined)
        {
            startCome(b, s, caller);
            return;
        }
    }

    // Standing in a fan's wind that holds it up, it steps out of it, whatever it stood there for but an answer it owes
    // someone; and nothing of its own accord stops it on its way out (a walk at that speed is only ever that one).
    if (b.action != A.Chat && (b.path.length > 0 ? isFree(b) && b.speed == WIND_ESCAPE_SPEED : escapeWind(b, s)))
        return;

    if (b.action == A.Come)
    {
        if (continueCome(b, s))
            return;
        endIdleDoing(b, now);
    }

    // Spoken to, it leaves its idle doings and turns to whoever spoke, likewise, woken if asleep.
    if (b.heard != undefined && now >= b.heard.until)
        b.heard = undefined;
    if (b.reply != undefined && now >= b.reply.until)
        b.reply = undefined;
    if (b.heard != undefined && now >= b.heard.from)
    {
        const personObjectId = b.heard.personObjectId;
        b.heard = undefined;
        if (s.people.some(person => person.objectId == personObjectId))
            startChat(b, s, personObjectId);
    }
    if (b.action == A.Chat)
    {
        if (continueChat(b, s))
            return;
        endIdleDoing(b, now);
    }

    if (b.action == A.Sleep)
    {
        if (b.needs.fatigue > 0)
            return;
        endAction(b, now);
    }
    else if (isFree(b) && b.needs.fatigue >= SLEEP_AT)
    {
        setAction(b, now, A.Sleep);
        hush(b);
        return;
    }

    if (b.action == A.EditRemark && b.editVisit != undefined)
    {
        continueEditVisit(b, s);
        return;
    }
    if (b.action == A.EditRemark || b.action == A.ObjectRemark || b.action == A.PersonRemark)
    {
        if (now < b.actionUntil)
        {
            faceTarget(b, s);
            return;
        }
        endIdleDoing(b, now);
    }
    if (b.pendingEdit != undefined && now >= b.pendingEdit.until)
        b.pendingEdit = undefined;
    if (b.pendingEdit != undefined && now >= b.pendingEdit.from && isFree(b))
    {
        remarkOnEdit(b, s, b.pendingEdit);
        return;
    }

    // Its idle doings, each begun only a good while after the last (see QUIET_MS).
    const quiet = now < b.quietUntil;
    if (b.action == A.SmallTalk)
    {
        if (continueTalk(b, s))
            return;
        endTalk(b, now);
    }
    else if (isFree(b))
    {
        // Asked to chat by another pet, it takes that up once it has taken it in.
        const inviter = s.pets.find(pet => pet.shown.action == A.SmallTalk && pet.shown.targetId == b.objectId
            && pet.shown.turn == 1 && flatDistance(pet.at, b.at) <= TALK_BREAK_DISTANCE
            && !(pet.objectId == b.talkedWith && now < b.talkedWithUntil));
        if (inviter == undefined)
            b.invitation = undefined;
        else if (b.invitation?.byId != inviter.objectId)
            b.invitation = {byId: inviter.objectId, due: now + randomBetween(PET_REACTION_MS)};
        else if (now >= b.invitation.due)
        {
            b.invitation = undefined;
            joinTalk(b, s, inviter);
            return;
        }
        if (!quiet && inviter == undefined && now >= b.nextTalkAt)
        {
            const partner = findTalkPartner(b, s);
            const topic = (partner == undefined) ? undefined : PetLineMap.pickSmallTalk();
            if (partner != undefined && topic != undefined)
            {
                startTalk(b, s, partner, topic);
                return;
            }
            b.nextTalkAt = now + TALK_RETRY_MS;
        }
    }

    if (b.action == A.Hug)
    {
        if (continueHug(b, s))
            return;
        endIdleDoing(b, now);
        b.nextHugAt = now + randomBetween(HUG_INTERVAL_MS);
    }
    else if (!quiet && isFree(b) && now >= b.nextHugAt && b.identity.traits.dependence == TOP_LEVEL)
    {
        b.nextHugAt = now + randomBetween(HUG_INTERVAL_MS);
        const person = pickPersonToHug(b, s);
        if (person != undefined)
        {
            setAction(b, now, A.Hug, person.objectId);
            b.pressUntil = 0;
            continueHug(b, s);
            return;
        }
    }

    if (!quiet && isFree(b) && now >= b.nextPersonRemarkAt)
    {
        const person = pickPersonToTalkTo(b, s);
        b.nextPersonRemarkAt = now + ((person == undefined) ? PERSON_REMARK_RETRY_MS
            : randomBetween(PERSON_REMARK_INTERVAL_MS_BY_DEPENDENCE[b.identity.traits.dependence]));
        if (person != undefined)
        {
            remarkOnPerson(b, s, person);
            return;
        }
    }

    if (!quiet && isFree(b) && now >= b.nextRemarkAt)
    {
        const sociability = b.identity.traits.sociability;
        const thing = findThingToRemarkOn(b, s);
        b.nextRemarkAt = now + ((thing == undefined) ? REMARK_RETRY_MS
            : randomBetween(REMARK_INTERVAL_MS_BY_SOCIABILITY[sociability]));
        if (thing != undefined)
        {
            remarkOnThing(b, s, thing);
            return;
        }
    }

    wander(b, s);
    faceAddressee(b, s);
}

// Out of battery it does nothing of all that: it stands where it is, until someone puts a battery into it.
function actPowerless(b: PetBehavior, s: PetSurroundings): void
{
    if (b.action != A.Idle)
        endAction(b, s.now);
    else if (b.path.length > 0)
        setPath(b, [], b.speed);
    b.standFacing = undefined;
    b.pendingEdit = undefined;
    b.calledBy = undefined;
    b.heard = undefined;
    b.reply = undefined;
    b.invitation = undefined;
}

// Idle, it strolls off now and then to somewhere it can get to, up or down a stair as readily: within its leash of its
// owner, where it has one, the most sociable often up to another pet, and where else is as curious as it is (see
// pickWanderPlace), though not while its words to someone are still up. Farther from its owner than its leash lets it,
// it goes after them, to their floor, once it has taken that in, leaving a stroll for it. Dying, it keeps close to them,
// or to what they look at while they edit.
function wander(b: PetBehavior, s: PetSurroundings): void
{
    const now = s.now;
    const owner = s.people.find(person => person.userID == b.ownerUserID);
    const dying = owner != undefined && PetBehaviorUtil.isDying(b.needs);
    const anchor = dying ? (s.ownerFocus ?? owner.at) : owner?.at;
    const leash = dying ? PET_DYING_LEASH : PET_LEASH_BY_DEPENDENCE[b.identity.traits.dependence];
    const strayed = anchor != undefined && flatDistance(anchor, b.at) > leash + LEASH_SLACK;
    if (strayed && !b.strayed)
        b.nextFollowAt = Math.max(b.nextFollowAt, now + randomBetween(PET_REACTION_MS));
    b.strayed = strayed;
    const strolling = b.action == A.Wander;
    if (strolling)
    {
        if (b.path.length == 0 || b.stuck)
        {
            endAction(b, now);
            return;
        }
        // It goes on with a stroll, unless its owner has got too far off meanwhile and it finds a way after them.
        if (b.speed != WALK_SPEED)
            return;
    }
    const due = !strolling && now >= b.nextWanderAt && getAddressee(b, s) == undefined;
    if (!due && !(strayed && now >= b.nextFollowAt))
        return;
    b.nextFollowAt = now + FOLLOW_RETRY_MS;
    if (due)
        b.nextWanderAt = now + randomBetween(IDLE_MS);

    const reach = findReach(b, s, strayed ? Math.min(MAX_FOLLOW_REACH, flatDistance(anchor!, b.at) + LEASH_SLACK)
        : WANDER_REACH);
    if (reach == undefined)
        return;
    const roomy = reach.vertices.filter(vertex => isRoomy(s, VoxelPathUtil.toWorld(vertex)));
    const isFarEnough = (vertex: VoxelVertex) => getSpan(VoxelPathUtil.toWorld(vertex), b.at) >= MIN_WANDER_DISTANCE;
    const seeksCompany = !strayed && Math.random() < COMPANY_CHANCE_BY_SOCIABILITY[b.identity.traits.sociability];
    const company = seeksCompany ? s.pets.filter(pet => !hates(b, pet)).map(pet => pet.at) : [];
    const kept = roomy.filter(vertex => {
        const place = VoxelPathUtil.toWorld(vertex);
        if (anchor != undefined && leash != Infinity
            && (flatDistance(place, anchor) > leash || (strayed && !onSameFloor(anchor, place))))
        {
            return false;
        }
        return (strayed || isFarEnough(vertex)) && (company.length == 0
            || company.some(at => onSameFloor(at, place) && flatDistance(at, place) <= COMPANY_DISTANCE));
    });
    // With nowhere such to go (its owner out of its reach, say), anywhere it can get to will do, in its own time.
    const places = (kept.length > 0) ? kept : due ? roomy.filter(isFarEnough) : [];
    if (places.length == 0)
        return;
    const follows = strayed && kept.length > 0;
    const goal = follows ? places[Math.floor(Math.random() * places.length)] : pickWanderPlace(b, s, places);
    setAction(b, now, A.Wander);
    walkAlong(b, s, reach, goal, follows ? FOLLOW_SPEED : WALK_SPEED);
    rememberPlace(b, VoxelPathUtil.toWorld(goal));
    if (follows && now >= b.sayingUntil && Math.random() < FOLLOW_WORDS_CHANCE)
        speak(b, now, PetLineMap.pickCueLine("follow"), owner!.objectId);
}

// Whom its words are for, while they are still up, if they are in the room.
function getAddressee(b: PetBehavior, s: PetSurroundings): PetPersonSighting | undefined
{
    return (b.addressee.length == 0) ? undefined : s.people.find(person => person.objectId == b.addressee);
}

// Standing idle, it stays turned to whoever its words are for while they are up, wherever they go.
function faceAddressee(b: PetBehavior, s: PetSurroundings): void
{
    const addressee = (b.action == A.Idle && b.path.length == 0) ? getAddressee(b, s) : undefined;
    if (addressee != undefined)
        b.standFacing = getFacingToward(b.at, addressee.at) ?? b.standFacing;
}

// Which of the places it could wander to it goes to, at random: now and then one up or down a stair, the more often the
// more curious it is (any pet does, where it can); and of those on the floor it goes to, a nearer one the likelier, and
// an odder one the likelier the more curious it is, and the less likely the less.
function pickWanderPlace(b: PetBehavior, s: PetSurroundings, vertices: VoxelVertex[]): VoxelVertex
{
    const {curiosity} = b.identity.traits;
    const here = vertices.filter(vertex => onSameFloor(VoxelPathUtil.toWorld(vertex), b.at));
    const elsewhere = vertices.filter(vertex => !onSameFloor(VoxelPathUtil.toWorld(vertex), b.at));
    const goesElsewhere = elsewhere.length > 0
        && (here.length == 0 || Math.random() < PET_OTHER_FLOOR_CHANCE_BY_CURIOSITY[curiosity]);
    const pool = goesElsewhere ? elsewhere : here;

    const fanTypeIndex = ObjectTypeConfigMap.getIndexByType("Fan");
    const fans = Object.values(s.objectById).filter(obj => obj.objectTypeIndex == fanTypeIndex).map(fan => fan.transform.pos);
    const weights = pool.map(vertex => {
        const place = VoxelPathUtil.toWorld(vertex);
        return Math.exp(-getSpan(place, b.at) / PET_WANDER_SCALE_BY_CURIOSITY[curiosity]
            + PET_CURIOSITY_PULL[curiosity] * getOddity(b, s.voxels, vertex, place, fans));
    });
    let draw = Math.random() * weights.reduce((total, weight) => total + weight, 0);
    const picked = pool.findIndex((_, i) => (draw -= weights[i]) < 0);
    return pool[(picked < 0) ? pool.length - 1 : picked];
}

// How odd a place is for a pet to go to: from none, for one no higher than it is, in the open, by no fan and where it
// has lately been, up by as much as each of these is the other way.
function getOddity(b: PetBehavior, voxels: Voxel[], vertex: VoxelVertex, place: Vec3, fans: Vec3[]): number
{
    const high = Math.min(1, Math.max(0, (place.y - b.at.y) / HIGH_PLACE_HEIGHT));
    const {walls, drop} = getSurrounds(voxels, vertex);
    const nearFan = fans.some(fan => getSpan(fan, place) <= FAN_DISTANCE) ? 1 : 0;
    const unknown = Math.min(1, b.visited.reduce((least, seen) => Math.min(least, getSpan(seen, place)), Infinity)
        / UNKNOWN_DISTANCE);
    return high + walls / 4 + (drop ? 1 : 0) + nearFan + unknown;
}

// What is right beside a place a body stands on, on each of its four sides: how many are walled at the body's feet, and
// whether any falls away by a drop deeper than a step.
function getSurrounds(voxels: Voxel[], vertex: VoxelVertex): {walls: number, drop: boolean}
{
    const {row, col, layer} = vertex;
    // The two cells beyond the four the body stands among, on each side.
    const sides = [[[row - 1, col - 2], [row, col - 2]], [[row - 1, col + 1], [row, col + 1]],
        [[row - 2, col - 1], [row - 2, col]], [[row + 1, col - 1], [row + 1, col]]];
    let walls = 0;
    let drop = false;
    for (const cells of sides)
    {
        const blocked = (dLayer: number) => cells.some(([r, c]) => VoxelQueryUtil.isVoxelBlockPresentAt(voxels, r, c,
            layer + dLayer));
        if (blocked(0) || blocked(1))
            ++walls;
        else if (!Array.from({length: DROP_LAYERS}, (_, i) => blocked(-1 - i)).some(Boolean))
            drop = true;
    }
    return {walls, drop};
}

// Keeps where it last went, what it knows best of a room.
function rememberPlace(b: PetBehavior, place: Vec3): void
{
    b.visited.push({...place});
    b.visited.splice(0, Math.max(0, b.visited.length - NUM_PLACES_REMEMBERED));
}

// Whether a place has room for a pet to stop at: nobody stands near it on its floor.
function isRoomy(s: PetSurroundings, place: Vec3): boolean
{
    return !s.pets.some(pet => onSameFloor(pet.at, place) && flatDistance(pet.at, place) < PET_SPACE)
        && !s.people.some(person => onSameFloor(person.at, place) && flatDistance(person.at, place) < PERSON_SPACE);
}

// In a panic it runs from place to place, wherever it can get to.
function startPanic(b: PetBehavior, s: PetSurroundings): void
{
    setAction(b, s.now, A.Panic);
    b.excited = true;
    speak(b, s.now, PetLineMap.pickCueLine("panic"));
    runAbout(b, s);
}

function runAbout(b: PetBehavior, s: PetSurroundings): void
{
    if (b.path.length > 0 && !b.stuck)
        return;
    const reach = findReach(b, s, FLEE_REACH);
    const places = (reach?.vertices ?? []).filter(vertex =>
        flatDistance(VoxelPathUtil.toWorld(vertex), b.at) >= MIN_WANDER_DISTANCE);
    if (reach != undefined && places.length > 0)
        walkAlong(b, s, reach, places[Math.floor(Math.random() * places.length)], PANIC_SPEED);
}

function startFlee(b: PetBehavior, s: PetSurroundings, from: Vec3): void
{
    setAction(b, s.now, A.Flee);
    b.actionUntil = s.now + randomBetween(FLEE_MS);
    b.frightAt = {...from};
    runFrom(b, s, from);
}

// Standing where a fan's wind blowing upward holds it (or would, once it comes down), it steps out of it, as it faces: to
// the nearest place it can get to that no wind lifts it at, nobody standing there. Whether it sets off.
function escapeWind(b: PetBehavior, s: PetSurroundings): boolean
{
    const start = findStart(b, s);
    if (start == undefined || !isLifted(s, VoxelPathUtil.toWorld(start)))
        return false;
    const reach = findReach(b, s, WIND_ESCAPE_REACH, start);
    let best: VoxelVertex | undefined = undefined;
    let bestDistance = Infinity;
    for (const vertex of reach?.vertices ?? [])
    {
        const place = VoxelPathUtil.toWorld(vertex);
        const distance = flatDistance(b.at, place);
        if (distance < bestDistance && isRoomy(s, place) && !isLifted(s, place))
        {
            best = vertex;
            bestDistance = distance;
        }
    }
    if (reach == undefined || best == undefined)
        return false;
    setAction(b, s.now, A.Wander);
    walkAlong(b, s, reach, best, WIND_ESCAPE_SPEED);
    b.backingOff = true;
    b.standFacing = b.facing;
    return true;
}

// Whether a wind blowing upward has hold of its body, standing on a point of a floor (see PhysicsForceUtil).
function isLifted(s: PetSurroundings, feet: Vec3): boolean
{
    return PhysicsManager.hasRoom(s.roomID)
        && PhysicsManager.getPush(s.roomID, PetBodyUtil.getBox(PetBodyUtil.getStandingPos(feet))).y > 0;
}

// Off to the place it can get to that is farthest from there.
function runFrom(b: PetBehavior, s: PetSurroundings, from: Vec3): void
{
    const reach = findReach(b, s, FLEE_REACH);
    let farthest: VoxelVertex | undefined = undefined;
    let farthestDistance = flatDistance(b.at, from);
    for (const vertex of reach?.vertices ?? [])
    {
        const distance = flatDistance(VoxelPathUtil.toWorld(vertex), from);
        if (distance > farthestDistance)
        {
            farthest = vertex;
            farthestDistance = distance;
        }
    }
    if (reach != undefined && farthest != undefined)
        walkAlong(b, s, reach, farthest, FLEE_SPEED);
}

// A pet it hates, near it on its floor, once it is angry enough and has not just fought: the nearest. None while it
// sleeps.
function findVictim(b: PetBehavior, s: PetSurroundings): PetSighting | undefined
{
    if (b.needs.anger < ATTACK_ANGER || s.now < b.nextAttackAt || b.action == A.Sleep)
        return undefined;
    return s.pets.filter(pet => pet.shown.action != A.Dead && flatDistance(pet.at, b.at) <= ATTACK_SIGHT
        && onSameFloor(pet.at, b.at) && hates(b, pet))
        .sort((a, c) => flatDistance(a.at, b.at) - flatDistance(c.at, b.at))[0];
}

function startAttack(b: PetBehavior, s: PetSurroundings, victimId: string): void
{
    setAction(b, s.now, A.Attack, victimId);
    b.actionUntil = s.now + randomBetween(ATTACK_MS);
    b.charging = true;
    b.mood = -1;
    b.moodUntil = b.actionUntil;
    speak(b, s.now, PetLineMap.pickCueLine("attack"));
    continueAttack(b, s);
}

// Charges straight at its victim, up to a little short of it, and having struck it backs off a little, facing it, for
// another go; until its time is up, or its victim is gone, out of reach, or too far off. Whether it goes on.
function continueAttack(b: PetBehavior, s: PetSurroundings): boolean
{
    const victim = s.pets.find(pet => pet.objectId == b.targetId);
    if (victim == undefined || victim.shown.action == A.Dead || s.now >= b.actionUntil || b.stuck
        || flatDistance(victim.at, b.at) > ATTACK_BREAK_DISTANCE || !onSameFloor(victim.at, b.at))
    {
        return false;
    }
    const distance = flatDistance(victim.at, b.at);
    b.standFacing = getFacingToward(b.at, victim.at) ?? b.facing;
    if (b.charging)
    {
        b.backingOff = false;
        // (Of one that charges it back, half the way there: the other comes the rest.)
        const chargedBack = victim.shown.action == A.Attack && victim.shown.targetId == b.objectId;
        const share = (chargedBack ? 0.5 : 1) * Math.max(0, distance - PET_CHARGE_STOP_DISTANCE) / Math.max(distance, 1e-6);
        setPath(b, [{x: b.at.x + (victim.at.x - b.at.x) * share, y: victim.at.y, z: b.at.z + (victim.at.z - b.at.z) * share}],
            CHARGE_SPEED);
        if (distance <= HIT_DISTANCE)
        {
            b.hits = PetShownStateUtil.countHit(b.hits);
            b.charging = false;
            b.backOffUntil = s.now + BACK_OFF_MS;
            const away = (distance > 1e-6) ? {x: (b.at.x - victim.at.x) / distance, z: (b.at.z - victim.at.z) / distance}
                : {x: 1, z: 0};
            b.backingOff = true;
            setPath(b, [{x: b.at.x + away.x * BACK_OFF_DISTANCE, y: b.at.y, z: b.at.z + away.z * BACK_OFF_DISTANCE}],
                BACK_OFF_SPEED);
        }
    }
    else if (s.now >= b.backOffUntil)
        b.charging = true;
    return true;
}

// Its anger spent in part, it leaves off for a while.
function endAttack(b: PetBehavior, now: number): void
{
    b.needs.anger = Math.max(0, b.needs.anger - ATTACK_RELIEF);
    b.nextAttackAt = now + ATTACK_COOLDOWN_MS;
    endAction(b, now);
}

// Sets off for whoever has said its name, with a word to say so.
function startCome(b: PetBehavior, s: PetSurroundings, caller: PetPersonSighting): void
{
    setAction(b, s.now, A.Come, caller.objectId);
    b.actionUntil = s.now + COME_TIMEOUT_MS;
    b.stayUntil = 0;
    speak(b, s.now, PetLineMap.pickCueLine("called"), caller.objectId);
    continueCome(b, s);
}

// Goes up to them, wherever they go, and once there stays by them a while (see keepNear). Whether it goes on: not past
// its time, nor without them, nor without a way to them.
function continueCome(b: PetBehavior, s: PetSurroundings): boolean
{
    const now = s.now;
    const person = s.people.find(them => them.objectId == b.targetId);
    if (person == undefined || now >= b.actionUntil || (b.stayUntil > 0 && now >= b.stayUntil))
        return false;
    if (b.stayUntil == 0 && isNear(b, person.at))
    {
        b.stayUntil = Math.max(now + randomBetween(COME_STAY_MS), b.sayingUntil);
        b.actionUntil = b.stayUntil;
    }
    return (b.stayUntil > 0) ? keepNear(b, s, person.at, PRESS_SPEED) : approach(b, s, person.at, COME_SPEED);
}

// Whether it has come up to someone (see PET_APPROACH_DISTANCE).
function isNear(b: PetBehavior, at: Vec3): boolean
{
    return onSameFloor(at, b.at) && flatDistance(at, b.at) <= PET_APPROACH_DISTANCE + PET_APPROACH_SLACK;
}

// On its way up to someone: straight for a little way off them wherever it can walk straight there, and else by a way
// round the blocks. Whether it has a way.
function approach(b: PetBehavior, s: PetSurroundings, at: Vec3, speed: number): boolean
{
    const to = getApproachPoint(b, at);
    if (canWalkStraightTo(b, s, to))
        setPath(b, [to], speed);
    else if (b.path.length == 0 || b.stuck || b.speed != speed
        || flatDistance(b.path[b.path.length - 1], at) > PET_APPROACH_DISTANCE)
    {
        const way = findWayTo(b, s, at);
        if (way == undefined)
            return false;
        setPath(b, way, speed);
    }
    return true;
}

// Keeps by someone it has come up to, a little way off them, turned to them: after them where they get farther, and
// back from them, facing them still, where they come nearer, if it has the floor to back onto there. Whether it can.
function keepNear(b: PetBehavior, s: PetSurroundings, at: Vec3, speed: number): boolean
{
    b.standFacing = getFacingToward(b.at, at) ?? b.standFacing;
    const distance = flatDistance(at, b.at);
    const going = b.path.length > 0 && !b.backingOff;
    const backing = b.path.length > 0 && b.backingOff;
    if (distance > PET_APPROACH_DISTANCE + (going ? 0 : PET_APPROACH_SLACK))
    {
        if (backing)
            setPath(b, [], b.speed);
        b.backingOff = false;
        return approach(b, s, at, speed);
    }
    const to = getApproachPoint(b, at);
    if (distance < PET_APPROACH_DISTANCE - (backing ? 0 : PET_APPROACH_SLACK) && flatDistance(b.at, to) > REACHED_DISTANCE
        && VoxelPathUtil.findStandingVertexNear(s.voxels, to, 0, ObjectObstacleUtil.getClearance(s.objectById),
            PET_WALKER) != undefined)
    {
        b.backingOff = true;
        setPath(b, [to], speed);
    }
    else if (b.path.length > 0)
    {
        b.backingOff = false;
        setPath(b, [], b.speed);
    }
    return true;
}

// The point a little way off someone (see PET_APPROACH_DISTANCE), on the line from them to it.
function getApproachPoint(b: PetBehavior, at: Vec3): Vec3
{
    const distance = flatDistance(at, b.at);
    // (Right over or under them, it stands off to one side.)
    const away = (distance > 1e-6) ? {x: (b.at.x - at.x) / distance, z: (b.at.z - at.z) / distance} : {x: 1, z: 0};
    return {x: at.x + away.x * PET_APPROACH_DISTANCE, y: at.y, z: at.z + away.z * PET_APPROACH_DISTANCE};
}

// Leaves whichever of its idle doings it is at and stands turned to someone who spoke to it, for its answer to come;
// already turned to them, it waits on.
function startChat(b: PetBehavior, s: PetSurroundings, personObjectId: string): void
{
    if (b.action == A.Chat && b.targetId == personObjectId)
    {
        b.actionUntil = Math.max(b.actionUntil, s.now + PET_ANSWER_WAIT_MS);
        return;
    }
    if (b.action == A.SmallTalk)
        endTalk(b, s.now);
    else if (b.action == A.Hug)
        b.nextHugAt = s.now + randomBetween(HUG_INTERVAL_MS);
    setAction(b, s.now, A.Chat, personObjectId);
    b.actionUntil = s.now + PET_ANSWER_WAIT_MS;
    const person = s.people.find(them => them.objectId == personObjectId);
    b.chatReach = (person != undefined && flatDistance(person.at, b.at) > CHAT_BREAK_DISTANCE) ? Infinity
        : CHAT_BREAK_DISTANCE;
}

// Whether it is turned to someone who spoke to it, or about to turn to them (see attend).
function isTurningTo(b: PetBehavior, personObjectId: string): boolean
{
    return b.heard?.personObjectId == personObjectId || (b.action == A.Chat && b.targetId == personObjectId);
}

// Turned to them wherever they go, it says its answer once it has one, and stays so a while after that has been read.
// Whether it goes on: not past its time, nor without them, nor once they have gone far off.
function continueChat(b: PetBehavior, s: PetSurroundings): boolean
{
    const person = s.people.find(them => them.objectId == b.targetId);
    if (person == undefined || s.now >= b.actionUntil || flatDistance(person.at, b.at) > b.chatReach)
        return false;
    b.standFacing = getFacingToward(b.at, person.at) ?? b.standFacing;
    if (b.reply != undefined && b.reply.personObjectId == b.targetId)
    {
        speak(b, s.now, b.reply.line, b.targetId);
        b.reply = undefined;
        b.actionUntil = b.sayingUntil + CHAT_STAY_MS;
    }
    return true;
}

// The way to a place round the blocks and what is as solid as one; undefined if it has none.
function findWayTo(b: PetBehavior, s: PetSurroundings, place: Vec3): Vec3[] | undefined
{
    const isOpen = ObjectObstacleUtil.getClearance(s.objectById);
    const start = findStart(b, s);
    const goal = VoxelPathUtil.findStandingVertexNear(s.voxels, place, 1, isOpen, PET_WALKER);
    if (start == undefined || goal == undefined)
        return undefined;
    const way = VoxelPathUtil.findPath(s.voxels, start, goal, isOpen, PET_WALKER);
    return (way == undefined) ? undefined : startFromHere(b, s, way.map(VoxelPathUtil.toWorld), start.layer);
}

// Whether it can walk straight from where it stands to a place, with no step up or down on the way.
function canWalkStraightTo(b: PetBehavior, s: PetSurroundings, place: Vec3): boolean
{
    const start = findStart(b, s);
    return start != undefined && VoxelPathUtil.canWalkStraight(s.voxels, b.at, place, start.layer,
        ObjectObstacleUtil.getClearance(s.objectById), PET_WALKER);
}

// A way planned over the grid, set off on from where it stands on a layer: straight for its farthest point it can walk
// straight to, never first back to the grid's point nearest it, which may be behind it.
function startFromHere(b: PetBehavior, s: PetSurroundings, way: Vec3[], layer: number): Vec3[]
{
    const isOpen = ObjectObstacleUtil.getClearance(s.objectById);
    for (let i = way.length - 1; i > 0; --i)
    {
        if (VoxelPathUtil.canWalkStraight(s.voxels, b.at, way[i], layer, isOpen, PET_WALKER))
            return way.slice(i);
    }
    return way;
}

// Someone near it on its floor, in its sight, to say a word to: its owner far likelier than any one other, and anyone
// else only so often.
function pickPersonToTalkTo(b: PetBehavior, s: PetSurroundings): PetPersonSighting | undefined
{
    const eyes = {x: b.at.x, y: b.at.y + HEAD_HEIGHT, z: b.at.z};
    const near = s.people.filter(person => flatDistance(person.at, b.at) <= PERSON_REMARK_DISTANCE
        && onSameFloor(person.at, b.at)
        && VoxelQueryUtil.isLineClear(s.voxels, eyes, {x: person.at.x, y: person.at.y + HEAD_HEIGHT, z: person.at.z}));
    const weightOf = (person: PetPersonSighting) => (person.userID == b.ownerUserID) ? OWNER_TALK_WEIGHT : 1;
    let draw = Math.random() * near.reduce((total, person) => total + weightOf(person), 0);
    const picked = near.find(person => (draw -= weightOf(person)) < 0);
    if (picked == undefined || (picked.userID != b.ownerUserID && Math.random() >= STRANGER_TALK_CHANCE))
        return undefined;
    return picked;
}

// Stays turned to whatever its word is about, wherever that has got to: someone, another pet, or a thing.
function faceTarget(b: PetBehavior, s: PetSurroundings): void
{
    const at = s.people.find(person => person.objectId == b.targetId)?.at
        ?? s.pets.find(pet => pet.objectId == b.targetId)?.at
        ?? s.objectById[b.targetId]?.transform.pos;
    if (at != undefined)
        b.standFacing = getFacingToward(b.at, at) ?? b.standFacing;
}

function remarkOnPerson(b: PetBehavior, s: PetSurroundings, person: PetPersonSighting): void
{
    const line = PetLineMap.pickPersonRemark(person.userID == b.ownerUserID, person.name);
    if (line == undefined)
        return;
    setAction(b, s.now, A.PersonRemark, person.objectId);
    b.standFacing = getFacingToward(b.at, person.at);
    speak(b, s.now, line, person.objectId);
    b.actionUntil = b.sayingUntil;
}

// Goes to say a word, with a smile, on what someone has just built: right in front of it, where whoever built it is
// looking, if it finds a way there (see findEditView); else where it is.
function remarkOnEdit(b: PetBehavior, s: PetSurroundings, edit: NonNullable<PetBehavior["pendingEdit"]>): void
{
    const line = PetLineMap.pickEditRemark(edit.kind);
    b.pendingEdit = undefined;
    if (line == undefined)
        return;
    setAction(b, s.now, A.EditRemark);
    b.nextEditRemarkAt = s.now + EDIT_REMARK_INTERVAL_MS;
    b.editVisit = {at: {...edit.at}, line: {text: line.text, mood: 1}, until: s.now + EDIT_VISIT_MS};
    const view = findEditView(b, s, edit);
    if (view != undefined)
        walkAlong(b, s, view.reach, view.vertex, EDIT_VISIT_SPEED);
    continueEditVisit(b, s);
}

// On its way to say its word on what was built: once there, or having taken too long to get there, it turns to it, and
// then says it.
function continueEditVisit(b: PetBehavior, s: PetSurroundings): void
{
    const visit = b.editVisit!;
    const late = s.now >= visit.until;
    if (b.path.length > 0 && !b.stuck && !late)
        return;
    if (b.path.length > 0)
        setPath(b, [], b.speed);
    b.standFacing = getFacingToward(b.at, visit.at) ?? b.standFacing;
    if (!late && b.standFacing != undefined && Math.abs(NpcFacingUtil.getTurn(b.facing, b.standFacing)) > PET_MAX_DEGREES_OFF_WAY)
        return;
    b.editVisit = undefined;
    speak(b, s.now, visit.line);
    b.actionUntil = b.sayingUntil;
}

// Where to stand to say a word on what was built: a place it can get to, with room for it, from which it sees the
// thing, in front of it as whoever built it watches it (see PET_EDIT_VIEW_DISTANCE); the nearest to right in front.
// Undefined where there is none.
function findEditView(b: PetBehavior, s: PetSurroundings, edit: NonNullable<PetBehavior["pendingEdit"]>):
    {reach: VoxelReach, vertex: VoxelVertex} | undefined
{
    const reach = findReach(b, s, EDIT_NOTICE_DISTANCE + PET_EDIT_VIEW_DISTANCE[1]);
    if (reach == undefined)
        return undefined;
    const {at} = edit;
    const watcher = edit.viewFrom ?? b.at;
    const toward = {x: watcher.x - at.x, z: watcher.z - at.z};
    const length = Math.hypot(toward.x, toward.z);
    const front = (length < 1e-6) ? {x: at.x, z: at.z} : {x: at.x + toward.x / length * EDIT_VIEW_IDEAL_DISTANCE,
        z: at.z + toward.z / length * EDIT_VIEW_IDEAL_DISTANCE};
    let best: VoxelVertex | undefined = undefined;
    let bestScore = Infinity;
    for (const vertex of reach.vertices)
    {
        const place = VoxelPathUtil.toWorld(vertex);
        const across = flatDistance(place, at);
        const score = Math.hypot(place.x - front.x, place.z - front.z);
        if (across < PET_EDIT_VIEW_DISTANCE[0] || across > PET_EDIT_VIEW_DISTANCE[1] || Math.abs(at.y - place.y) > EDIT_VIEW_HEIGHT
            || score >= bestScore || !isRoomy(s, place) || !canSee(s, place, at))
        {
            continue;
        }
        best = vertex;
        bestScore = score;
    }
    return (best == undefined) ? undefined : {reach, vertex: best};
}

// Whether a pet standing on a place sees a point, which may be in a block just built: a little this side of it counts.
function canSee(s: PetSurroundings, place: Vec3, point: Vec3): boolean
{
    const eyes = {x: place.x, y: place.y + HEAD_HEIGHT, z: place.z};
    const span = Math.hypot(point.x - eyes.x, point.y - eyes.y, point.z - eyes.z);
    if (span < 1e-6)
        return true;
    const near = Math.max(0, span - SEEN_SHORT_OF) / span;
    return VoxelQueryUtil.isLineClear(s.voxels, eyes, {x: eyes.x + (point.x - eyes.x) * near,
        y: eyes.y + (point.y - eyes.y) * near, z: eyes.z + (point.z - eyes.z) * near});
}

// Something placed near it, in its sight, that pets have a word for: any of them.
function findThingToRemarkOn(b: PetBehavior, s: PetSurroundings): AddObjectSignal | undefined
{
    const eyes = {x: b.at.x, y: b.at.y + HEAD_HEIGHT, z: b.at.z};
    const things: AddObjectSignal[] = [];
    for (const objectId in s.objectById)
    {
        const obj = s.objectById[objectId];
        const {pos} = obj.transform;
        if (Math.hypot(pos.x - b.at.x, pos.y - eyes.y, pos.z - b.at.z) > REMARK_DISTANCE
            || !PetLineMap.hasObjectRemark(ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).objectType))
        {
            continue;
        }
        // Looked at a little way off the face it rests on, which would otherwise hide it.
        const point = {x: pos.x + 0.1 * obj.transform.dir.x, y: pos.y + 0.1 * obj.transform.dir.y,
            z: pos.z + 0.1 * obj.transform.dir.z};
        if (VoxelQueryUtil.isLineClear(s.voxels, eyes, point))
            things.push(obj);
    }
    return things[Math.floor(Math.random() * things.length)];
}

function remarkOnThing(b: PetBehavior, s: PetSurroundings, thing: AddObjectSignal): void
{
    const line = PetLineMap.pickObjectRemark(ObjectTypeConfigMap.getConfigByIndex(thing.objectTypeIndex).objectType);
    if (line == undefined)
        return;
    setAction(b, s.now, A.ObjectRemark, thing.objectId);
    b.standFacing = getFacingToward(b.at, thing.transform.pos);
    speak(b, s.now, line);
    b.actionUntil = b.sayingUntil;
}

// A pet near it on its floor, in its sight, with nothing on, that it doesn't hate: the nearest, one it likes first.
function findTalkPartner(b: PetBehavior, s: PetSurroundings): PetSighting | undefined
{
    const eyes = {x: b.at.x, y: b.at.y + HEAD_HEIGHT, z: b.at.z};
    const likes = (pet: PetSighting) => PetAffinityUtil.loves(b.objectId, b.identity.traits, pet.objectId, pet.identity.traits);
    return s.pets.filter(pet => (pet.shown.action == A.Idle || pet.shown.action == A.Wander) && !pet.shown.powerless
        && flatDistance(pet.at, b.at) <= TALK_DISTANCE && onSameFloor(pet.at, b.at) && !hates(b, pet)
        && VoxelQueryUtil.isLineClear(s.voxels, eyes, {x: pet.at.x, y: pet.at.y + HEAD_HEIGHT, z: pet.at.z}))
        .sort((a, c) => (Number(likes(c)) - Number(likes(a))) || (flatDistance(a.at, b.at) - flatDistance(c.at, b.at)))[0];
}

// Begins a chat with another pet: its first line, said to it, which the other answers if whoever plays it has it do so.
function startTalk(b: PetBehavior, s: PetSurroundings, partner: PetSighting, topic: number): void
{
    setAction(b, s.now, A.SmallTalk, partner.objectId);
    b.topic = topic;
    b.turn = 0;
    b.talkStarter = true;
    sayTalkLine(b, s.now);
}

// Takes up a chat another pet began with it: its answer follows once their line has been read.
function joinTalk(b: PetBehavior, s: PetSurroundings, inviter: PetSighting): void
{
    setAction(b, s.now, A.SmallTalk, inviter.objectId);
    b.topic = inviter.shown.topic;
    b.turn = inviter.shown.turn;
    b.talkStarter = false;
    b.talkNextAt = s.now + PetBehaviorUtil.getReadTime(PetLineMap.getSmallTalk(b.topic)[b.turn - 1]?.text ?? "");
    b.talkDeadline = Infinity;
}

// Its part in a chat: turned to the other, and no nearer it than two keep, it says its next line once theirs has been
// read, and waits on theirs in turn; until the lines are out, or the other has left off, gone too far, or kept it
// waiting too long. Whether it goes on.
function continueTalk(b: PetBehavior, s: PetSurroundings): boolean
{
    const now = s.now;
    const partner = s.pets.find(pet => pet.objectId == b.targetId);
    if (partner == undefined || flatDistance(partner.at, b.at) > TALK_BREAK_DISTANCE)
        return false;
    b.standFacing = getFacingToward(b.at, partner.at);
    keepTalkSpace(b, s, partner);
    const lines = PetLineMap.getSmallTalk(b.topic);
    const chatting = partner.shown.action == A.SmallTalk && partner.shown.targetId == b.objectId
        && partner.shown.topic == b.topic;
    if (!chatting)
    {
        // Two that asked each other at once: the one whose id comes first takes up the other's chat.
        const askedToo = partner.shown.action == A.SmallTalk && partner.shown.targetId == b.objectId
            && partner.shown.turn == 1;
        if (b.talkStarter && b.turn == 1 && askedToo && b.objectId < partner.objectId)
        {
            joinTalk(b, s, partner);
            return true;
        }
        // Not yet in it, having been asked; or out of it, which ends it once its own last words have been read.
        const stillAsking = b.talkStarter && b.turn == 1 && now < b.talkDeadline;
        return stillAsking || (b.turn > 1 && now < b.sayingUntil);
    }
    if (partner.shown.turn > b.turn)
    {
        b.turn = partner.shown.turn;
        b.talkNextAt = now + PetBehaviorUtil.getReadTime(lines[b.turn - 1]?.text ?? "");
        b.talkDeadline = Infinity;
    }
    const isMyTurn = (b.turn % 2 == 0) == b.talkStarter;
    if (!isMyTurn)
        return now < b.talkDeadline;
    if (now < b.talkNextAt)
        return true;
    if (b.turn >= lines.length)
        return false;
    sayTalkLine(b, now);
    return true;
}

// Too near the pet it chats with (see PET_TALK_MIN_SPACE), it backs off from it, facing it still, to where two keep, if
// it has a floor to back onto there; once there, or that far from it, it stands again.
function keepTalkSpace(b: PetBehavior, s: PetSurroundings, partner: PetSighting): void
{
    const distance = flatDistance(partner.at, b.at);
    // (Two on one spot part by their ids.)
    const away = (distance > 1e-6) ? {x: (b.at.x - partner.at.x) / distance, z: (b.at.z - partner.at.z) / distance}
        : {x: (b.objectId < partner.objectId) ? 1 : -1, z: 0};
    const to = {x: partner.at.x + away.x * PET_TALK_SPACE, y: b.at.y, z: partner.at.z + away.z * PET_TALK_SPACE};
    const tooNear = onSameFloor(partner.at, b.at) && distance < (b.backingOff ? PET_TALK_SPACE : PET_TALK_MIN_SPACE)
        && flatDistance(b.at, to) > REACHED_DISTANCE;
    if (tooNear && VoxelPathUtil.findStandingVertexNear(s.voxels, to, 0, ObjectObstacleUtil.getClearance(s.objectById),
        PET_WALKER) != undefined)
    {
        b.backingOff = true;
        setPath(b, [to], WALK_SPEED);
    }
    else if (b.backingOff)
    {
        b.backingOff = false;
        setPath(b, [], b.speed);
    }
}

// Says the chat's next line, which is its own to say, and waits on an answer for as long as the line takes to read, and
// a while more.
function sayTalkLine(b: PetBehavior, now: number): void
{
    const line = PetLineMap.getSmallTalk(b.topic)[b.turn];
    if (line == undefined)
        return;
    speak(b, now, PetLineMap.vary(line));
    b.excited = line.mood > 0 && b.identity.traits.sociability == TALK_INTERVAL_MS_BY_SOCIABILITY.length - 1;
    b.turn += 1;
    b.talkNextAt = Infinity;
    b.talkDeadline = b.sayingUntil + TALK_GRACE_MS;
}

function endTalk(b: PetBehavior, now: number): void
{
    b.nextTalkAt = now + randomBetween(TALK_INTERVAL_MS_BY_SOCIABILITY[b.identity.traits.sociability]);
    b.talkedWith = b.targetId;
    b.talkedWithUntil = now + TALK_INTERVAL_MS_BY_SOCIABILITY[TOP_LEVEL][0];
    endIdleDoing(b, now);
}

// Whom the most dependent goes and presses up against: its owner, most often, or else anyone near.
function pickPersonToHug(b: PetBehavior, s: PetSurroundings): PetPersonSighting | undefined
{
    const near = s.people.filter(person => flatDistance(person.at, b.at) <= HUG_SIGHT && onSameFloor(person.at, b.at));
    const owner = near.find(person => person.userID == b.ownerUserID);
    const strangers = near.filter(person => person.userID != b.ownerUserID);
    if (owner != undefined && (strangers.length == 0 || Math.random() < HUG_OWNER_CHANCE))
        return owner;
    return strangers[Math.floor(Math.random() * strangers.length)];
}

// Goes up to them, wherever they go, and once there keeps by them for a while (see keepNear). Whether it goes on.
function continueHug(b: PetBehavior, s: PetSurroundings): boolean
{
    const now = s.now;
    const person = s.people.find(them => them.objectId == b.targetId);
    if (person == undefined || flatDistance(person.at, b.at) > HUG_BREAK_DISTANCE || !onSameFloor(person.at, b.at)
        || (b.pressUntil > 0 && now >= b.pressUntil))
    {
        return false;
    }
    if (b.pressUntil == 0 && isNear(b, person.at))
    {
        b.pressUntil = now + randomBetween(PRESS_MS);
        speak(b, now, PetLineMap.pickCueLine("hug"), person.objectId);
        b.moodUntil = Math.max(b.moodUntil, b.pressUntil + randomBetween(PET_MOOD_LINGER_MS));
    }
    return (b.pressUntil > 0) ? keepNear(b, s, person.at, PRESS_SPEED) : approach(b, s, person.at, HUG_SPEED);
}

// Says what it needs, now and then, for as long as it needs it: a wrench as its health fails, a battery once its own is
// empty; one after the other, if both. Never while its other words are still being read.
function sayNeeds(b: PetBehavior, now: number): void
{
    const dying = PetBehaviorUtil.isDying(b.needs);
    const powerless = PetBehaviorUtil.isPowerless(b);
    if (!(dying || powerless) || now < b.nextNeedWordsAt || b.action == A.Sleep
        || (now < b.sayingUntil && b.tone == PetSpeechToneEnumMap.Normal && !powerless))
    {
        return;
    }
    const forBattery = powerless && (!dying || b.asksForBatteryNext);
    b.asksForBatteryNext = !forBattery;
    const line = forBattery ? PetLineMap.getPowerlessLine() : PetLineMap.getDyingLine();
    b.saying = line.text;
    b.addressee = "";
    b.tone = forBattery ? PetSpeechToneEnumMap.Powerless : PetSpeechToneEnumMap.Dying;
    b.sayingUntil = now + NEED_WORDS_MS;
    b.bubbleUntil = now + Math.max(BUBBLE_READS * NEED_WORDS_MS, PLAYER_MESSAGE_EXPIRATION_MS);
    b.nextNeedWordsAt = b.sayingUntil + randomBetween(NEED_WORDS_INTERVAL_MS);
}

// The face it shows: a start first; then its panic, its sleep (its eyes shut, whatever else it feels) and its anger;
// then the mood of what it says or does; and with nothing of the kind, sadness in spells once its health is poor.
function getExpression(b: PetBehavior, now: number): number
{
    const E = PetExpressionEnumMap;
    if (now < b.startledUntil)
        return E.Surprised;
    if (b.action == A.Panic)
        return E.Panicked;
    if (b.action == A.Sleep)
        return E.Asleep;
    if (b.action == A.Attack || b.needs.anger >= ANGRY_AT)
        return E.Angry;
    if (now < b.moodUntil)
        return (b.mood > 0) ? E.Happy : (b.mood < 0) ? E.Sad : E.Neutral;
    if (b.needs.health <= SAD_HEALTH)
    {
        const share = SAD_SHARE[0] + (SAD_SHARE[1] - SAD_SHARE[0]) * (1 - b.needs.health / SAD_HEALTH);
        const spell = Math.floor(now / SAD_SPELL_MS);
        const draw = (((StringUtil.getHashCode(`${b.objectId}/${spell}`) % 1000) + 1000) % 1000) / 1000;
        if (draw < share)
            return E.Sad;
    }
    return E.Neutral;
}

// Whether it has nothing on that a new thing to do would cut short.
function isFree(b: PetBehavior): boolean
{
    return b.action == A.Idle || b.action == A.Wander;
}

function setAction(b: PetBehavior, now: number, action: number, targetId: string = ""): void
{
    b.action = action;
    b.actionSince = now;
    b.actionUntil = Infinity;
    b.targetId = targetId;
    b.excited = false;
    b.backingOff = false;
    b.standFacing = undefined;
    b.editVisit = undefined;
    if (b.path.length > 0)
        setPath(b, [], b.speed);
    else
        b.pathEnd = undefined;
}

// Back to standing idle, a while before it wanders again.
function endAction(b: PetBehavior, now: number): void
{
    setAction(b, now, A.Idle);
    b.speed = WALK_SPEED;
    b.nextWanderAt = Math.max(b.nextWanderAt, now + randomBetween(IDLE_MS));
}

// Likewise after one of its idle doings, none of which it then begins of its own accord for a while. Its face keeps the
// mood that went with it a while longer.
function endIdleDoing(b: PetBehavior, now: number): void
{
    endAction(b, now);
    b.quietUntil = now + randomBetween(QUIET_MS);
    if (now < b.moodUntil)
        b.moodUntil = Math.max(b.moodUntil, now + randomBetween(PET_MOOD_LINGER_MS));
}

function die(b: PetBehavior, now: number): void
{
    setAction(b, now, A.Dead);
    b.dead = true;
    b.needs.health = 0;
    b.expression = PetExpressionEnumMap.Off;
    hush(b);
}

// A face of surprise for a moment; asleep, it wakes.
function startle(b: PetBehavior, now: number): void
{
    b.startledUntil = now + STARTLED_MS;
    wake(b, now);
}

function wake(b: PetBehavior, now: number): void
{
    if (b.action != A.Sleep)
        return;
    endAction(b, now);
    speak(b, now, PetLineMap.pickCueLine("woken"));
}

// Says a line, to someone (their player's object) or to nobody in particular: taking as long as it does to read, and
// leaving it up a good while after (see BUBBLE_READS), its face in the line's mood meanwhile, and a while after it has
// been read.
function speak(b: PetBehavior, now: number, line: PetLine, addressee: string = ""): void
{
    const readTime = PetBehaviorUtil.getReadTime(line.text);
    b.saying = line.text;
    b.addressee = addressee;
    b.tone = PetSpeechToneEnumMap.Normal;
    b.sayingUntil = now + readTime;
    b.bubbleUntil = now + Math.max(BUBBLE_READS * readTime, PLAYER_MESSAGE_EXPIRATION_MS);
    b.mood = line.mood;
    b.moodUntil = b.sayingUntil + randomBetween(PET_MOOD_LINGER_MS);
}

function hush(b: PetBehavior): void
{
    b.saying = "";
    b.addressee = "";
    b.tone = PetSpeechToneEnumMap.Normal;
}

// Where it can get to from where it stands, out to a walk of about so far, round what is as solid as a block (see
// ObjectObstacleUtil). None where it stands on nothing a body could.
function findReach(b: PetBehavior, s: PetSurroundings, maxDistance: number,
    start: VoxelVertex | undefined = findStart(b, s)): VoxelReach | undefined
{
    const isOpen = ObjectObstacleUtil.getClearance(s.objectById);
    return (start == undefined) ? undefined
        : VoxelPathUtil.findReach(s.voxels, start, maxDistance, undefined, isOpen, PET_WALKER);
}

// Where its ways start: the point of a floor it stands on, or, held up off its feet (by a fan's wind), the one it would
// come down on.
function findStart(b: PetBehavior, s: PetSurroundings): VoxelVertex | undefined
{
    for (let y = b.at.y; y > -COLLISION_LAYER_HEIGHT; y -= COLLISION_LAYER_HEIGHT)
    {
        const start = VoxelPathUtil.findStandingVertexNear(s.voxels, {x: b.at.x, y, z: b.at.z}, 1, undefined, PET_WALKER);
        if (start != undefined)
            return start;
    }
    return undefined;
}

// Sets off along the way a reach found to one of its places.
function walkAlong(b: PetBehavior, s: PetSurroundings, reach: VoxelReach, goal: VoxelVertex, speed: number): void
{
    const way = VoxelPathUtil.getPathWithin(reach, goal);
    if (way != undefined)
        setPath(b, startFromHere(b, s, straighten(way).map(VoxelPathUtil.toWorld), reach.start.layer), speed);
}

// The ends of each straight run of a way on one layer, which is all it needs to steer between.
function straighten(way: VoxelVertex[]): VoxelVertex[]
{
    return way.filter((here, i) => {
        const prev = way[i - 1], next = way[i + 1];
        return prev == undefined || next == undefined || prev.layer != here.layer || next.layer != here.layer
            || here.row - prev.row != next.row - here.row || here.col - prev.col != next.col - here.col;
    });
}

// Its way from here on. Counted as another way only if it is: a straight one set again and again after something that
// moves (a victim, someone to hug) is the same way until its end has moved some way from where it was counted.
function setPath(b: PetBehavior, path: Vec3[], speed: number): void
{
    const end = path[path.length - 1];
    const counted = b.pathEnd;
    const sameEnd = (end == undefined) ? counted == undefined
        : counted != undefined && Math.hypot(end.x - counted.x, end.y - counted.y, end.z - counted.z) < SAME_WAY_DISTANCE;
    b.path = path;
    aim(b);
    if (speed == b.speed && path.length <= 1 && sameEnd)
        return;
    b.speed = speed;
    b.pathEnd = (end == undefined) ? undefined : {...end};
    ++b.pathRevision;
}

// Where the next point of its way lies, and whether it faces too far off that to go on (see PetBehavior.turning). Backing
// off, it turns to nothing.
function aim(b: PetBehavior): void
{
    const to = b.path[0];
    if (b.dead || to == undefined || b.backingOff || flatDistance(b.at, to) < 1e-6)
    {
        b.turning = false;
        b.wayFacing = undefined;
        return;
    }
    b.wayFacing = NpcFacingUtil.getDegrees({x: to.x - b.at.x, y: 0, z: to.z - b.at.z});
    b.turning = Math.abs(NpcFacingUtil.getTurn(b.facing, b.wayFacing)) > PET_MAX_DEGREES_OFF_WAY;
}

// A way it has got nowhere along for a while is given up, and whatever it was on told so (see PetBehavior.stuck).
function trackProgress(b: PetBehavior, now: number): void
{
    if (b.path.length == 0 || flatDistance(b.at, b.progressFrom) >= PROGRESS_DISTANCE
        || Math.abs(b.at.y - b.progressFrom.y) >= PROGRESS_DISTANCE)
    {
        b.progressFrom = {...b.at};
        b.progressAt = now;
        return;
    }
    if (now - b.progressAt < STUCK_MS)
        return;
    setPath(b, [], b.speed);
    b.stuck = true;
    b.progressAt = now;
}

// Turns as far toward a facing as a step allows, at the rate of what it is doing.
function turnToward(b: PetBehavior, facing: number, seconds: number): void
{
    const most = PetBehaviorUtil.getTurnRate(b.action) * seconds;
    const turn = Math.max(-most, Math.min(most, NpcFacingUtil.getTurn(b.facing, facing)));
    b.facing = (((b.facing + turn) % 360) + 360) % 360;
}

// The way across the floor from one point to another, or none for a point right over or under the other.
function getFacingToward(from: Vec3, to: Vec3): number | undefined
{
    return (flatDistance(from, to) < 1e-6) ? undefined
        : NpcFacingUtil.getDegrees({x: to.x - from.x, y: 0, z: to.z - from.z});
}

function hates(b: PetBehavior, pet: PetSighting): boolean
{
    return PetAffinityUtil.hates(b.objectId, b.identity.traits, pet.objectId, pet.identity.traits);
}

function onSameFloor(a: Vec3, b: Vec3): boolean
{
    return Math.abs(a.y - b.y) <= SAME_FLOOR_HEIGHT;
}

function flatDistance(a: Vec3, b: Vec3): number
{
    return Math.hypot(a.x - b.x, a.z - b.z);
}

// How far apart two points are for a walker: across the floor, and up or down.
function getSpan(a: Vec3, b: Vec3): number
{
    return flatDistance(a, b) + Math.abs(a.y - b.y);
}

function randomBetween([min, max]: number[]): number
{
    return min + Math.random() * (max - min);
}

export default PetBehaviorUtil;
