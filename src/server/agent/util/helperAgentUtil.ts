import Vec3 from "../../../shared/math/types/vec3";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import QuarterTurnsUtil from "../../../shared/object/util/quarterTurnsUtil";
import NpcFacingUtil from "../../../shared/object/util/npcFacingUtil";
import LabelTextUtil from "../../../shared/object/util/labelTextUtil";
import Room from "../../../shared/room/types/room";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import VoxelPathUtil from "../../../shared/voxel/util/voxelPathUtil";
import EncodableData from "../../../shared/networking/types/encodableData";
import { DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS } from "../../../shared/system/sharedConstants";
import LogUtil from "../../../shared/system/util/logUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import ServerRoomManager from "../../room/serverRoomManager";
import RoomPickerUtil from "../../room/util/roomPickerUtil";
import ServerUserManager from "../../user/serverUserManager";
import HoldObjectSignal from "../../../shared/object/types/holdObjectSignal";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import UserContext from "../../sockets/types/userContext";
import { FunnelMilestoneEnumMap } from "../../analytics/types/funnelMilestone";
import { HELPER_AGENT_NAME } from "../../system/serverConstants";
import AgentUserContext from "../types/agentUserContext";
import { HelperChatRefusal } from "../types/helperChatRefusal";
import HelperPendingLines from "../types/helperPendingLines";
import HelperState from "../types/helperState";
import HelperIdentity from "../types/helperIdentity";
import HelperChatUtil from "./helperChatUtil";

// Helpers: the NPCs an admin stands in multiplayer rooms (see NpcObjectTypeConfig), which the server plays as AI guides,
// so that a newcomer never arrives to an empty world. Each keeps near where it was put, its home; greets each visitor as
// they come near, once a login; and answers whoever talks to it nearby, or names it, people and agents alike, through
// Claude (see HelperChatUtil), facing whom it talks with. What it does is shown to the room and never kept: the room keeps
// it at home, so an admin moving it moves its home. People are shown it is an AI (see NpcGameObject).

const TICK_MS = 1000;
const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");
const UP: Vec3 = {x: 0, y: 1, z: 0};
// Someone this near on its own floor (feet within this height of its own) is heard, and greeted; anyone else in the
// room is heard only when they name it.
const HEARING_DISTANCE = 8;
const SAME_FLOOR_HEIGHT = 1;
// A person's lines are answered together once they have paused this long, and let go if still unanswered after this
// long, by when whoever said them has likely moved on.
const ANSWER_PAUSE_MS = 1500;
const UNANSWERED_LINES_TTL_MS = MINUTE_IN_MS;
// Someone it can't answer is told why, and told again at most this often while they keep talking to it, so that it
// neither seems to ignore them nor says the same thing to every line.
const REFUSAL_RETOLD_AFTER_MS = 2 * MINUTE_IN_MS;
// How long a bubble stays before the next, so it can be read: a moment to notice it, then its words at an easy pace, as
// many read English as a second language. The last is taken down once it has been quiet this long.
const MIN_BUBBLE_MS = 3000;
const BUBBLE_NOTICE_MS = 1000;
const BUBBLE_MS_PER_CHAR = 80;
const BUBBLE_CLEARED_AFTER_MS = 20_000;
// A stroll, in world units a second.
const WALK_SPEED = 2;
// How far from home it goes: idly, and to meet someone talking to it from a little way off.
const WANDER_RADIUS = 2.5;
const LEASH_RADIUS = 5;
const APPROACH_FROM = 3;
const MEETING_DISTANCE = 1.5;
// Idle at home this long between wanders, and away this long before it heads back (or, after a talk, this long after it).
const WANDER_INTERVAL_MS = [20_000, 40_000];
const WANDER_STAY_MS = [8_000, 15_000];
const STAY_AFTER_TALK_MS = 30_000;
// Still this long after an admin has moved it, or has let go of it.
const FROZEN_AFTER_MOVE_MS = 10_000;
const FROZEN_AFTER_RELEASE_MS = 3000;
// Speaking to several at once, it looks at each in turn, this long each.
const GLANCE_MS = 2000;
// A turn smaller than this isn't shown.
const MIN_TURN_DEGREES = 2;
// Two positions this close are the same place.
const SAME_PLACE = 0.05;
const USAGE_LOG_INTERVAL_MS = HOUR_IN_MS;
const FAILURE_LOG_INTERVAL_MS = MINUTE_IN_MS;
const GUEST_NAME_PATTERN = /^guest-/i;

const REFUSAL_LINES: {[refusal in HelperChatRefusal]: string} = {
    noModel: "Sorry, I can only say hello for now. Have fun exploring!",
    dayLimit: "I've talked a lot today and need a rest. Explore away, and come back tomorrow!",
    hourlyLimit: "Let's take a little break. Try exploring, and talk to me again later!",
};

// By room and object id.
const helpers = new Map<string, HelperState>();
const state = {
    timer: undefined as NodeJS.Timeout | undefined,
    ticking: false,
    usageLoggedAt: Date.now(),
    failureLoggedAt: -Infinity,
    // When each person was last told why no reply came, by the reason; any helper's telling counts.
    refusalToldAt: new Map<string, number>(),
};

const HelperAgentUtil =
{
    start: (): void =>
    {
        state.timer = setInterval(() => void HelperAgentUtil.tick(), TICK_MS);
    },
    stop: async (): Promise<void> =>
    {
        clearInterval(state.timer);
        await HelperChatUtil.saveSpending(true);
        helpers.clear();
        state.refusalToldAt.clear();
        Object.assign(state, {timer: undefined, ticking: false, usageLoggedAt: Date.now(), failureLoggedAt: -Infinity});
    },
    // One beat of every helper's life, each second.
    tick: async (): Promise<void> =>
    {
        if (state.ticking)
            return;
        state.ticking = true;
        try
        {
            const now = Date.now();
            findHelpers(now);
            for (const helper of helpers.values())
            {
                const memory = ServerRoomManager.roomRuntimeMemories[helper.roomID];
                releaseLeavers(helper, memory, now);
                followHome(helper, memory.room, now);
                tellNewcomers(helper, memory);
                noticeVisitors(helper, memory, now);
                greet(helper, now);
                answerSpeakers(helper, now);
                speakNextBubble(helper, now);
                wander(helper, memory.room, now);
            }
            await HelperChatUtil.saveSpending();
            if (now - state.usageLoggedAt >= USAGE_LOG_INTERVAL_MS)
            {
                state.usageLoggedAt = now;
                LogUtil.log("Helper usage", HelperChatUtil.getUsageToday(), "low", "info");
                forgetOldLogins(now);
                forgetOldRefusals(now);
            }
        }
        catch (err)
        {
            if (Date.now() - state.failureLoggedAt >= FAILURE_LOG_INTERVAL_MS)
            {
                state.failureLoggedAt = Date.now();
                LogUtil.log("Helper tick failed", {error: ErrorUtil.getErrorMessage(err)}, "high", "error");
            }
        }
        finally
        {
            state.ticking = false;
        }
    },
    // Helpers take their steps, or else turn to whom they talk with, from SocketsServer's flush, so each goes out with it.
    stepAll: (seconds: number): void =>
    {
        const now = Date.now();
        for (const helper of helpers.values())
        {
            if (helper.path.length > 0)
                step(helper, seconds);
            else if (helper.heldBy.size == 0)
                look(helper, now);
        }
    },
    // A line someone said, as SocketsServer dispatched it (see UserSignalDispatchUtil): for a helper they named, else
    // the nearest one in earshot.
    hear: (userID: string, signal: SetObjectMetadataSignal): void =>
    {
        const player = ServerUserManager.getPlayerObject(userID);
        const roomID = ServerRoomManager.currentRoomIDByUserID[userID];
        const text = signal.metadataValue.trim();
        if (player == undefined || player.objectId != signal.objectId || roomID == undefined || text.length == 0)
            return;
        const inRoom = [...helpers.values()].filter(helper => helper.roomID == roomID);
        const named = inRoom.find(helper => helper.name.length > 0 && namedIn(text, helper.name));
        const nearest = inRoom.map(helper => ({helper, distance: distanceAcross(player.transform.pos, helper.at)}))
            .filter(({helper, distance}) => (distance <= HEARING_DISTANCE && onFloorOf(helper, player.transform.pos))
                || namedIn(text, HELPER_AGENT_NAME))
            .sort((a, b) => a.distance - b.distance)[0]?.helper;
        const helper = named ?? nearest;
        const ctx = ServerUserManager.getSocketUserContext(userID);
        if (helper == undefined || ctx == undefined)
            return;
        const now = Date.now();
        const pending: HelperPendingLines = helper.linesByUserID.get(userID) ?? {name: player.sourceUserName,
            isAgent: ctx instanceof AgentUserContext, firstVisit: !ctx.funnel.includes(FunnelMilestoneEnumMap.Returned),
            lines: [], lastAt: now};
        pending.lines.push(text);
        pending.lastAt = now;
        helper.linesByUserID.set(userID, pending);
        // It turns to whoever talks to it, unless it is still speaking to someone else.
        helper.lastTalkAt = now;
        if (!isSpeaking(helper, now))
            talkWith(helper, [userID], now);
    },
    // An admin's edit-mode selection taking hold of a helper, or letting go of it (see HoldObjectSignal). Held, it stands
    // still for everyone, as it does under the admin's own pointer.
    hold: (ctx: UserContext, signal: HoldObjectSignal): void =>
    {
        const key = `${signal.roomID}/${signal.objectId}`;
        // One just stood there, and selected as it was, may not have been found yet.
        if (!helpers.has(key))
            findHelpers(Date.now());
        const helper = helpers.get(key);
        if (helper == undefined || !RoomValidationUtil.userIsAdmin(ctx.user)
            || ServerRoomManager.currentRoomIDByUserID[ctx.user.id] != signal.roomID)
        {
            return;
        }
        if (signal.held)
        {
            helper.heldBy.add(ctx.user.id);
            helper.path = [];
        }
        else if (helper.heldBy.delete(ctx.user.id))
            letGo(helper, Date.now());
    },
    // The helpers in a room as they are shown, for what agents see (see AgentToolUtil.look).
    // What one sent a room is to be told of its helpers besides (see catchUpOn). The helpers tell a newcomer to the room
    // themselves; whatever else shows it (an agent's camera) asks.
    getCatchUpSignals: (roomID: string): {signalType: string, signal: EncodableData}[] =>
    {
        return [...helpers.values()].filter(helper => helper.roomID == roomID).flatMap(catchUpOn);
    },
    getHelpers: (roomID: string): {objectId: string, name: string, at: Vec3, saying: string}[] =>
    {
        return [...helpers.values()].filter(helper => helper.roomID == roomID)
            .map(helper => ({objectId: helper.objectId, name: helper.name, at: {...helper.at}, saying: helper.saying}));
    },
}

// Every NPC in a loaded multiplayer room is a helper, from the beat after it is put there until it is taken away.
function findHelpers(now: number): void
{
    const found = new Set<string>();
    for (const [roomID, memory] of Object.entries(ServerRoomManager.roomRuntimeMemories))
    {
        if (memory.room.roomType == RoomTypeEnumMap.SinglePlayer)
            continue;
        for (const obj of Object.values(memory.room.objectById))
        {
            if (obj.objectTypeIndex != NPC_TYPE_INDEX)
                continue;
            const key = `${roomID}/${obj.objectId}`;
            found.add(key);
            const helper = helpers.get(key) ?? newHelper(roomID, obj, now);
            helper.name = LabelTextUtil.toName(LabelTextUtil.getText(obj));
            helpers.set(key, helper);
        }
    }
    for (const key of helpers.keys())
    {
        if (!found.has(key))
            helpers.delete(key);
    }
}

function newHelper(roomID: string, obj: AddObjectSignal, now: number): HelperState
{
    const quarterTurns = QuarterTurnsUtil.getQuarterTurns(obj);
    return {roomID, objectId: obj.objectId, name: "", home: {...obj.transform.pos}, homeQuarterTurns: quarterTurns,
        at: {...obj.transform.pos}, facing: getFacingPut(quarterTurns), saying: "", path: [], talkingWith: [],
        talkingSince: 0, heldBy: new Set(), frozenUntil: 0,
        nextWanderAt: now + randomBetween(WANDER_INTERVAL_MS), returnHomeAt: 0, lastTalkAt: -Infinity,
        greetedLogins: new Map(), greetings: [], linesByUserID: new Map(), answering: undefined, bubbles: [],
        nextBubbleAt: 0, toldUserIDs: new Set()};
}

// An admin holding it who has left its room lets go of it.
function releaseLeavers(helper: HelperState, memory: RoomRuntimeMemory, now: number): void
{
    for (const userID of helper.heldBy)
    {
        if (memory.participantUserNameByID[userID] == undefined && helper.heldBy.delete(userID))
            letGo(helper, now);
    }
}

// Once nobody holds it, it stands still a moment more before it goes on.
function letGo(helper: HelperState, now: number): void
{
    if (helper.heldBy.size == 0)
        helper.frozenUntil = Math.max(helper.frozenUntil, now + FROZEN_AFTER_RELEASE_MS);
}

// An admin moving it (or turning it) moves its home, the room's own copy, which it then stands still at for a while.
// The admin's edit has already shown it there to everyone; facing the way it was put is shown over the way it faced.
function followHome(helper: HelperState, room: Room, now: number): void
{
    const obj = room.objectById[helper.objectId];
    const quarterTurns = QuarterTurnsUtil.getQuarterTurns(obj);
    if (distance(obj.transform.pos, helper.home) < SAME_PLACE && quarterTurns == helper.homeQuarterTurns)
        return;
    helper.home = {...obj.transform.pos};
    helper.homeQuarterTurns = quarterTurns;
    helper.at = {...helper.home};
    helper.path = [];
    helper.frozenUntil = now + FROZEN_AFTER_MOVE_MS;
    helper.facing = getFacingPut(quarterTurns);
    send(helper, "setObjectMetadataSignal", facingSignal(helper));
}

function tellNewcomers(helper: HelperState, memory: RoomRuntimeMemory): void
{
    for (const userID of helper.toldUserIDs)
    {
        if (memory.participantUserNameByID[userID] == undefined)
            helper.toldUserIDs.delete(userID);
    }
    for (const userID of Object.keys(memory.participantUserNameByID))
    {
        if (helper.toldUserIDs.has(userID))
            continue;
        helper.toldUserIDs.add(userID);
        for (const {signalType, signal} of catchUpOn(helper))
            send(helper, signalType, signal, userID);
    }
}

// The room one is sent keeps the helper at home, so they are told where it is, which way it faces and what it is saying.
function catchUpOn(helper: HelperState): {signalType: string, signal: EncodableData}[]
{
    const signals: {signalType: string, signal: EncodableData}[] = [];
    if (distance(helper.at, helper.home) >= SAME_PLACE)
        signals.push({signalType: "setObjectTransformSignal", signal: transformSignal(helper)});
    if (helper.facing != getFacingPut(helper.homeQuarterTurns))
        signals.push({signalType: "setObjectMetadataSignal", signal: facingSignal(helper)});
    if (helper.saying.length > 0)
        signals.push({signalType: "setObjectMetadataSignal", signal: speechSignal(helper, helper.saying)});
    return signals;
}

// Each visitor who comes near is greeted once in each of their logins (see UserContext.loginCount), not each time they
// come into the room.
function noticeVisitors(helper: HelperState, memory: RoomRuntimeMemory, now: number): void
{
    for (const [userID, name] of Object.entries(memory.participantUserNameByID))
    {
        const ctx = ServerUserManager.getSocketUserContext(userID);
        const player = ServerUserManager.getPlayerObject(userID);
        if (ctx == undefined || player == undefined || helper.greetedLogins.get(userID)?.loginCount === ctx.loginCount
            || distanceAcross(player.transform.pos, helper.at) > HEARING_DISTANCE || !onFloorOf(helper, player.transform.pos))
        {
            continue;
        }
        helper.greetedLogins.set(userID, {loginCount: ctx.loginCount, at: now});
        helper.greetings.push({userID, name, returning: ctx.funnel.includes(FunnelMilestoneEnumMap.Returned)});
    }
}

// Those who came near together are greeted together, as are those who came while it was still talking, so that a crowd
// isn't greeted one by one long after it came.
function greet(helper: HelperState, now: number): void
{
    if (helper.greetings.length == 0 || helper.bubbles.length > 0 || now < helper.nextBubbleAt)
        return;
    const due = helper.greetings;
    helper.greetings = [];
    const name = (due.length == 1 && !GUEST_NAME_PATTERN.test(due[0].name)) ? ` ${due[0].name}` : "";
    const whom = due.length > 1 ? " everyone" : name;
    const welcome = due.every(greeting => greeting.returning) ? "welcome back" : "welcome to ThingsPool";
    const me = helper.name.length > 0 ? `I'm ${helper.name}, an AI guide.` : "I'm an AI guide.";
    say(helper, `Hi${whom}, ${welcome}! ${me} Ask me anything, or just look around!`,
        due.map(greeting => greeting.userID));
}

// Speakers who have paused are answered in turn, each once the helper has said all it was saying, as a person answers a
// crowd: it stops to answer (and turns to them, see look).
function answerSpeakers(helper: HelperState, now: number): void
{
    for (const [userID, pending] of helper.linesByUserID)
    {
        if (now - pending.lastAt >= UNANSWERED_LINES_TTL_MS)
            helper.linesByUserID.delete(userID);
    }
    if (helper.answering != undefined || helper.bubbles.length > 0)
        return;
    for (const [userID, pending] of helper.linesByUserID)
    {
        if (now - pending.lastAt < ANSWER_PAUSE_MS)
            continue;
        helper.linesByUserID.delete(userID);
        helper.path = [];
        helper.answering = userID;
        helper.lastTalkAt = now;
        void answer(helper, userID, pending).finally(() => { helper.answering = undefined; });
        return;
    }
}

async function answer(helper: HelperState, userID: string, pending: HelperPendingLines): Promise<void>
{
    const refusal = await HelperChatUtil.getRefusal(userID, pending.isAgent);
    if (refusal != undefined)
    {
        const toldKey = `${userID} ${refusal}`;
        const toldAt = state.refusalToldAt.get(toldKey) ?? -Infinity;
        if (Date.now() - toldAt >= REFUSAL_RETOLD_AFTER_MS)
        {
            state.refusalToldAt.set(toldKey, Date.now());
            meet(helper, userID);
            say(helper, REFUSAL_LINES[refusal], [userID]);
        }
        return;
    }
    const tags = [pending.isAgent ? "an AI agent" : "", pending.firstVisit ? "new here" : ""].filter(tag => tag != "");
    const line = `${pending.name}${tags.length > 0 ? ` (${tags.join(", ")})` : ""}: ${pending.lines.join(" ")}`;
    const reply = await HelperChatUtil.reply(identityOf(helper), userID, line);
    if (reply == undefined || !helpers.has(`${helper.roomID}/${helper.objectId}`))
        return;
    meet(helper, userID);
    say(helper, reply, [userID]);
}

function identityOf(helper: HelperState): HelperIdentity
{
    const room = ServerRoomManager.roomRuntimeMemories[helper.roomID]?.room;
    const place = (helper.roomID == RoomPickerUtil.getFirstHubRoomID()) ? "the main hub, the public room newcomers arrive in"
        : (room?.roomType == RoomTypeEnumMap.Hub) ? "one of the public hubs" : "a room one of the players made";
    return {key: `${helper.roomID}/${helper.objectId}`, name: helper.name, place};
}

// Each thing it says is one bubble, a whole greeting or reply (see NPC_MESSAGE_MAX_LENGTH), queued behind whatever it is
// still saying.
function say(helper: HelperState, text: string, to: string[]): void
{
    helper.bubbles.push({text, to});
    helper.lastTalkAt = Date.now();
}

// It looks at whom each bubble is for as it shows.
function speakNextBubble(helper: HelperState, now: number): void
{
    if (helper.bubbles.length == 0)
    {
        if (helper.saying.length > 0 && now >= helper.nextBubbleAt + BUBBLE_CLEARED_AFTER_MS)
        {
            helper.saying = "";
            send(helper, "setObjectMetadataSignal", speechSignal(helper, ""));
        }
        return;
    }
    if (now < helper.nextBubbleAt)
        return;
    const {text, to} = helper.bubbles.shift()!;
    helper.saying = text;
    send(helper, "setObjectMetadataSignal", speechSignal(helper, text));
    helper.nextBubbleAt = now + Math.max(MIN_BUBBLE_MS, BUBBLE_NOTICE_MS + BUBBLE_MS_PER_CHAR * text.length);
    talkWith(helper, to, now);
}

// Walks up to whoever it answers from a little way off, as far as it goes from home.
function meet(helper: HelperState, userID: string): void
{
    const them = ServerUserManager.getPlayerObject(userID)?.transform.pos;
    const room = ServerRoomManager.roomRuntimeMemories[helper.roomID]?.room;
    if (them == undefined || room == undefined)
        return;
    helper.returnHomeAt = Date.now() + STAY_AFTER_TALK_MS;
    const feet = VoxelPathUtil.feetOf(them);
    const away = distanceAcross(feet, helper.at);
    if (away <= APPROACH_FROM || Date.now() < helper.frozenUntil || helper.heldBy.size > 0)
        return;
    // On its own floor, whichever one they stand on.
    walkTo(helper, room, clampToLeash(helper, {x: feet.x + (helper.at.x - feet.x) * MEETING_DISTANCE / away,
        y: helper.home.y, z: feet.z + (helper.at.z - feet.z) * MEETING_DISTANCE / away}));
}

// Idle, it wanders off now and then, and heads home a while after.
function wander(helper: HelperState, room: Room, now: number): void
{
    if (helper.path.length > 0 || helper.answering != undefined || helper.bubbles.length > 0
        || helper.linesByUserID.size > 0 || now < helper.frozenUntil || helper.heldBy.size > 0)
    {
        return;
    }
    if (distance(helper.at, helper.home) >= SAME_PLACE)
    {
        if (now >= helper.returnHomeAt)
            walkTo(helper, room, helper.home);
        return;
    }
    if (now < helper.nextWanderAt || now - helper.lastTalkAt < STAY_AFTER_TALK_MS)
        return;
    helper.nextWanderAt = now + randomBetween(WANDER_INTERVAL_MS);
    const angle = Math.random() * 2 * Math.PI;
    const reach = WANDER_RADIUS * (0.4 + 0.6 * Math.random());
    if (walkTo(helper, room, {x: helper.home.x + reach * Math.cos(angle), y: helper.home.y,
        z: helper.home.z + reach * Math.sin(angle)}))
    {
        helper.returnHomeAt = now + randomBetween(WANDER_STAY_MS);
    }
}

// A path over the room's floor to near the goal (to the goal itself when that is home), or false if there is none.
function walkTo(helper: HelperState, room: Room, goal: Vec3): boolean
{
    const voxels = room.voxelGrid.voxels;
    const start = VoxelPathUtil.findStandingVertexNear(voxels, helper.at, 1);
    const end = VoxelPathUtil.findStandingVertexNear(voxels, goal, 1);
    const path = (start == undefined || end == undefined) ? undefined : VoxelPathUtil.findPath(voxels, start, end);
    if (path == undefined)
        return false;
    helper.path = path.slice(1).map(vertex => VoxelPathUtil.toWorld(vertex));
    if (distance(goal, helper.home) < SAME_PLACE)
        helper.path.push({...helper.home});
    return helper.path.length > 0;
}

// Along its way, facing where it goes next.
function step(helper: HelperState, seconds: number): void
{
    let left = WALK_SPEED * seconds;
    while (left > 0 && helper.path.length > 0)
    {
        const next = helper.path[0];
        const gap = distance(helper.at, next);
        if (gap <= left)
        {
            helper.at = {...next};
            helper.path.shift();
            left -= gap;
        }
        else
        {
            helper.at = {x: helper.at.x + (next.x - helper.at.x) * left / gap, y: helper.at.y + (next.y - helper.at.y) *
                left / gap, z: helper.at.z + (next.z - helper.at.z) * left / gap};
            left = 0;
        }
    }
    if (helper.path.length > 0)
        faceToward(helper, helper.path[0]);
    send(helper, "setObjectTransformSignal", transformSignal(helper));
}

// Standing, it looks at whom it talks with, and once that is over, at home, the way it was put. Thinking of an answer,
// it turns to whom it is for as soon as it has nothing else left to say.
function look(helper: HelperState, now: number): void
{
    if (helper.answering != undefined && helper.bubbles.length == 0 && now >= helper.nextBubbleAt)
        talkWith(helper, [helper.answering], now);
    const them = getGazeTarget(helper, now);
    if (them != undefined)
        faceToward(helper, them);
    else if (distance(helper.at, helper.home) < SAME_PLACE && now - helper.lastTalkAt >= STAY_AFTER_TALK_MS)
        face(helper, getFacingPut(helper.homeQuarterTurns));
}

// Where whom it talks with stand: those it speaks to, or is about to answer, wherever they are in its room, each in turn
// for a moment when they are several; once it is done speaking, the nearest of them still in earshot on its floor,
// until it has been quiet a while.
function getGazeTarget(helper: HelperState, now: number): Vec3 | undefined
{
    const present = helper.talkingWith.filter(userID => ServerRoomManager.currentRoomIDByUserID[userID] == helper.roomID)
        .map(userID => ServerUserManager.getPlayerObject(userID)?.transform.pos)
        .filter((pos): pos is Vec3 => pos != undefined);
    if (present.length == 0)
        return undefined;
    if (isSpeaking(helper, now))
        return present[Math.floor((now - helper.talkingSince) / GLANCE_MS) % present.length];
    if (now - helper.lastTalkAt >= STAY_AFTER_TALK_MS)
        return undefined;
    return present.filter(pos => distanceAcross(pos, helper.at) <= HEARING_DISTANCE && onFloorOf(helper, pos))
        .sort((a, b) => distanceAcross(a, helper.at) - distanceAcross(b, helper.at))[0];
}

function talkWith(helper: HelperState, userIDs: string[], now: number): void
{
    helper.talkingWith = userIDs;
    helper.talkingSince = now;
}

// Saying something, about to, or thinking of what to say.
function isSpeaking(helper: HelperState, now: number): boolean
{
    return helper.answering != undefined || helper.bubbles.length > 0 || now < helper.nextBubbleAt;
}

function faceToward(helper: HelperState, point: Vec3): void
{
    if (distanceAcross(point, helper.at) >= SAME_PLACE)
        face(helper, NpcFacingUtil.getDegrees({x: point.x - helper.at.x, y: 0, z: point.z - helper.at.z}));
}

// Browsers turn it there over a moment (see NpcGameObject).
function face(helper: HelperState, degrees: number): void
{
    if (Math.abs(NpcFacingUtil.getTurn(helper.facing, degrees)) < MIN_TURN_DEGREES)
        return;
    helper.facing = degrees;
    send(helper, "setObjectMetadataSignal", facingSignal(helper));
}

// The way an admin put it to face (see QuarterTurnsUtil).
function getFacingPut(quarterTurns: number): number
{
    return NpcFacingUtil.getDegrees(QuarterTurnsUtil.getContentUp(UP, quarterTurns));
}

function transformSignal(helper: HelperState): SetObjectTransformSignal
{
    const scale = ServerRoomManager.roomRuntimeMemories[helper.roomID].room.objectById[helper.objectId].transform.scale;
    return new SetObjectTransformSignal(helper.roomID, helper.objectId, new ObjectTransform({...helper.at}, {...UP},
        {...scale}), true);
}

function facingSignal(helper: HelperState): SetObjectMetadataSignal
{
    return new SetObjectMetadataSignal(helper.roomID, helper.objectId, ObjectMetadataKeyEnumMap.Facing,
        NpcFacingUtil.encode(helper.facing));
}

function speechSignal(helper: HelperState, text: string): SetObjectMetadataSignal
{
    return new SetObjectMetadataSignal(helper.roomID, helper.objectId, ObjectMetadataKeyEnumMap.SentMessage, text);
}

// Shown to the room (or to one user in it), without changing what the room keeps.
function send(helper: HelperState, signalType: string, signal: EncodableData, userID?: string): void
{
    const roomContext = ServerRoomManager.socketRoomContexts[helper.roomID];
    if (roomContext == undefined)
        return;
    if (userID == undefined)
        roomContext.multicastSignal(signalType, signal);
    else
        roomContext.unicastSignal(signalType, signal, userID);
}

// Within its leash of home.
function clampToLeash(helper: HelperState, point: Vec3): Vec3
{
    const away = distanceAcross(point, helper.home);
    if (away <= LEASH_RADIUS)
        return point;
    return {x: helper.home.x + (point.x - helper.home.x) * LEASH_RADIUS / away, y: point.y,
        z: helper.home.z + (point.z - helper.home.z) * LEASH_RADIUS / away};
}

// Whose logins are long over, since a login lasts at most until a day without a visit.
function forgetOldLogins(now: number): void
{
    for (const helper of helpers.values())
    {
        for (const [userID, greeted] of helper.greetedLogins)
        {
            if (now - greeted.at > 2 * DAY_IN_MS)
                helper.greetedLogins.delete(userID);
        }
    }
}

// Whom it would tell why it can't answer again anyway.
function forgetOldRefusals(now: number): void
{
    for (const [toldKey, toldAt] of state.refusalToldAt)
    {
        if (now - toldAt >= REFUSAL_RETOLD_AFTER_MS)
            state.refusalToldAt.delete(toldKey);
    }
}

// Whether a player (by its position, at its middle) stands on the helper's own floor.
function onFloorOf(helper: HelperState, playerPos: Vec3): boolean
{
    return Math.abs(VoxelPathUtil.feetOf(playerPos).y - helper.at.y) <= SAME_FLOOR_HEIGHT;
}

function namedIn(text: string, name: string): boolean
{
    return new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu")
        .test(text);
}

function distance(a: Vec3, b: Vec3): number
{
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function distanceAcross(a: Vec3, b: Vec3): number
{
    return Math.hypot(a.x - b.x, a.z - b.z);
}

function randomBetween([min, max]: number[]): number
{
    return min + Math.random() * (max - min);
}

export default HelperAgentUtil;
