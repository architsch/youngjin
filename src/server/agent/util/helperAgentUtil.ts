import Vec3 from "../../../shared/math/types/vec3";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import NpcPersonalityMap from "../../../shared/object/maps/npcPersonalityMap";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import HelperSurroundings from "../../../shared/object/types/helperSurroundings";
import QuarterTurnsUtil from "../../../shared/object/util/quarterTurnsUtil";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
import NpcFacingUtil from "../../../shared/object/util/npcFacingUtil";
import LabelTextUtil from "../../../shared/object/util/labelTextUtil";
import HelperBehaviorUtil, { ANSWER_PAUSE_MS,
    FROZEN_AFTER_MOVE_MS } from "../../../shared/object/util/helperBehaviorUtil";
import Room from "../../../shared/room/types/room";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import SinglePlayerModeConfigMap from "../../../shared/singlePlayer/maps/singlePlayerModeConfigMap";
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
import DBUserUtil from "../../db/util/dbUserUtil";
import { FunnelMilestoneEnumMap } from "../../analytics/types/funnelMilestone";
import { FTUEElementCodeEnumMap } from "../../../shared/user/types/ftueElementCode";
import FTUEElementUtil from "../../../shared/user/util/ftueElementUtil";
import AgentUserContext from "../types/agentUserContext";
import { HelperChatRefusal } from "../types/helperChatRefusal";
import HelperPendingLines from "../types/helperPendingLines";
import HelperState from "../types/helperState";
import HelperIdentity from "../types/helperIdentity";
import HelperChatUtil from "./helperChatUtil";
import HelperSmallTalkUtil from "./helperSmallTalkUtil";

// Helpers: the NPCs an admin stands in multiplayer rooms (see NpcObjectTypeConfig), which the server plays as AI guides,
// so that a newcomer never arrives to an empty world, each as its BehaviorPrefs have it (one whose personality isn't
// played isn't a helper). Each behaves as any helper does (see HelperBehaviorUtil); here, it greets each visitor as they
// come near, once a login, telling anyone never told how to walk and build, answers whoever talks to it nearby, or names
// it, people and agents alike, through Claude (see HelperChatUtil), and now and then chats with another helper near it in
// fixed words (see HelperSmallTalkUtil). What it does is shown to the room and never kept: the room keeps it at home, so
// an admin moving it moves its home. People are shown it is an AI (see NpcGameObject). A single-player room's helpers are
// played by the browser, which asks here for their answers and their chats (see answerAlone, smallTalkAlone).

const TICK_MS = 1000;
const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");
const UP: Vec3 = {x: 0, y: 1, z: 0};
// A person's lines are let go if still unanswered this long after they paused, by when they have likely moved on.
const UNANSWERED_LINES_TTL_MS = MINUTE_IN_MS;
// Someone it can't answer is told why, and told again at most this often while they keep talking to it, so that it
// neither seems to ignore them nor says the same thing to every line.
const REFUSAL_RETOLD_AFTER_MS = 2 * MINUTE_IN_MS;
const USAGE_LOG_INTERVAL_MS = HOUR_IN_MS;
const FAILURE_LOG_INTERVAL_MS = MINUTE_IN_MS;
// Where a single-player room's helper stands, as it is told.
const SINGLE_PLAYER_PLACE = "a single-player room, where the visitor is on their own with you";
// What it is told of a person, before their words: whether they have been told how to walk and build (see needsBasics).
// Never their name, which a model then puts in every reply.
const TOLD_TAG = "knows how to play";
const UNTOLD_TAG = "not yet told how to play";

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
            }
            startSmallTalks(now);
            for (const helper of helpers.values())
                HelperBehaviorUtil.beat(helper, surroundingsOf(helper), now, helper.linesByUserID.size > 0);
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
            HelperBehaviorUtil.act(helper, surroundingsOf(helper), seconds, now);
    },
    // A line someone said, as SocketsServer dispatched it (see UserSignalDispatchUtil), for whichever helper it is for
    // (see HelperBehaviorUtil.pickListener). Only a player's own lines come here: what a helper says goes to its room
    // directly (see send), so helpers never hear one another, and two near each other chat only in fixed words (see
    // startSmallTalks), never at the key's expense. A ghost isn't heard, since an answer would show everyone it is there.
    hear: (userID: string, signal: SetObjectMetadataSignal): void =>
    {
        const player = ServerUserManager.getPlayerObject(userID);
        if (player == undefined || player.objectId != signal.objectId)
            return;
        const text = signal.metadataValue.trim();
        const helper = findListener(userID, text);
        const ctx = ServerUserManager.getSocketUserContext(userID);
        if (helper == undefined || ctx == undefined)
            return;
        const now = Date.now();
        const pending: HelperPendingLines = helper.linesByUserID.get(userID) ?? {isAgent: ctx instanceof AgentUserContext,
            lines: [], lastAt: now};
        pending.lines.push(text);
        pending.lastAt = now;
        helper.linesByUserID.set(userID, pending);
        HelperBehaviorUtil.hear(helper, surroundingsOf(helper), userID, now);
    },
    // An admin's edit-mode selection taking hold of a helper, or letting go of it (see HoldObjectSignal). Held, it stands
    // still for everyone, as it does under the admin's own pointer: at home, the way it was put, as the room keeps the
    // helper the admin edits.
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
            if (helper.heldBy.size == 0)
                HelperBehaviorUtil.standAtHome(helper, surroundingsOf(helper));
            helper.heldBy.add(ctx.user.id);
        }
        else if (helper.heldBy.delete(ctx.user.id))
            letGo(helper, Date.now());
    },
    // What a single-player room's helper, which the browser plays, answers its user's line (see SinglePlayerHelperUtil),
    // in the character its NPC has: the answer, why there is none, or nothing ("") when it has said so lately, when no
    // answer could be had, or when nothing of the ask is right (the user isn't in a mode that plays NPCs, or that
    // character isn't played).
    answerAlone: async (userID: string, npc: {objectId: string, name: string, personality: string},
        text: string): Promise<string> =>
    {
        const ctx = ServerUserManager.getSocketUserContext(userID);
        const personality = NpcPersonalityMap.read(npc.personality);
        if (ctx == undefined || !SinglePlayerModeConfigMap[ctx.singlePlayerMode]?.playsNpcs
            || !NpcPersonalityMap.isPlayed(personality))
        {
            return "";
        }
        const refusalLine = await getRefusalLine(userID, false);
        if (refusalLine != undefined)
            return refusalLine;
        const identity: HelperIdentity = {key: `${ctx.singlePlayerMode}/${npc.objectId}`,
            name: LabelTextUtil.isShortName(npc.name) ? LabelTextUtil.toName(npc.name) : "", place: SINGLE_PLAYER_PLACE,
            personality};
        const tag = needsBasics(ctx) ? UNTOLD_TAG : TOLD_TAG;
        return await HelperChatUtil.reply(identity, userID, `(${tag}) ${text}`) ?? "";
    },
    // What two of a single-player room's helpers, which the browser plays, say to each other as they chat (see
    // SinglePlayerHelperUtil), as two in a multiplayer room would: each line by its speaker's place among them, and none
    // when nothing of the ask is right (the user isn't in a mode that plays NPCs, or either character isn't played).
    smallTalkAlone: (userID: string, npcs: {name: string, personality: string}[]): {by: number, text: string}[] =>
    {
        const ctx = ServerUserManager.getSocketUserContext(userID);
        if (ctx == undefined || !SinglePlayerModeConfigMap[ctx.singlePlayerMode]?.playsNpcs)
            return [];
        return HelperSmallTalkUtil.compose(npcs.map(npc => ({
            name: LabelTextUtil.isShortName(npc.name) ? LabelTextUtil.toName(npc.name) : "",
            personality: NpcPersonalityMap.read(npc.personality)})));
    },
    // What one sent a room is to be told of its helpers besides (see catchUpOn). The helpers tell a newcomer to the room
    // themselves; whatever else shows it (an agent's camera) asks.
    getCatchUpSignals: (roomID: string): {signalType: string, signal: EncodableData}[] =>
    {
        return [...helpers.values()].filter(helper => helper.roomID == roomID).flatMap(catchUpOn);
    },
    // The name of the helper a user's line is for, as hear finds it, so that an agent can be told whether it was heard.
    getListenerName: (userID: string, text: string): string | undefined =>
    {
        const helper = findListener(userID, text.trim());
        return (helper == undefined) ? undefined : (helper.name || "a guide");
    },
    // The helpers in a room as they are shown, for what agents see (see AgentToolUtil.look), with the helper each is
    // chatting with, if it is, by name.
    getHelpers: (roomID: string): {objectId: string, name: string, at: Vec3, saying: string, thinking: boolean,
        chattingWith: string | undefined}[] =>
    {
        return [...helpers.values()].filter(helper => helper.roomID == roomID).map(helper => {
            const partner = HelperBehaviorUtil.getSmallTalkPartner(helper);
            return {objectId: helper.objectId, name: helper.name, at: {...helper.at}, saying: helper.saying,
                thinking: helper.thinking, chattingWith: (partner == undefined) ? undefined : (partner.name || "a guide")};
        });
    },
}

// The helper in the user's room that a line of theirs is for (see HelperBehaviorUtil.pickListener). A ghost isn't heard.
function findListener(userID: string, text: string): HelperState | undefined
{
    const player = ServerUserManager.getPlayerObject(userID);
    const roomID = ServerRoomManager.currentRoomIDByUserID[userID];
    if (player == undefined || roomID == undefined || text.length == 0 || AdminPrefsUtil.isGhost(player))
        return undefined;
    return HelperBehaviorUtil.pickListener([...helpers.values()].filter(helper => helper.roomID == roomID), text,
        player.transform.pos);
}

// Its room as its behavior asks of it: shown to the room, whose players are the people about, ghosts aside. One
// unloaded since the last beat, which forgets its helpers, has no blocks or people left in it.
function surroundingsOf(helper: HelperState): HelperSurroundings
{
    const memory = ServerRoomManager.roomRuntimeMemories[helper.roomID] as RoomRuntimeMemory | undefined;
    const seenPlayerOf = (userID: string) => {
        const player = ServerUserManager.getPlayerObject(userID);
        return AdminPrefsUtil.isGhost(player) ? undefined : player;
    };
    return {
        voxels: memory?.room.voxelGrid.voxels ?? [],
        getPeople: () => Object.keys(memory?.participantUserNameByID ?? {})
            .map(userID => seenPlayerOf(userID)?.transform.pos)
            .filter((pos): pos is Vec3 => pos != undefined),
        getPerson: (userID: string) => (ServerRoomManager.currentRoomIDByUserID[userID] == helper.roomID)
            ? seenPlayerOf(userID)?.transform.pos : undefined,
        getOtherHelpers: () => [...helpers.values()].filter(other => other.roomID == helper.roomID && other !== helper)
            .map(other => other.at),
        hasLinesWaiting: () => helper.linesByUserID.size > 0,
        isHeld: () => helper.heldBy.size > 0,
        showAt: () => send(helper, "setObjectTransformSignal", transformSignal(helper)),
        showFacing: () => send(helper, "setObjectMetadataSignal", facingSignal(helper)),
        showSaying: () => send(helper, "setObjectMetadataSignal", speechSignal(helper, helper.saying)),
        showThinking: () => send(helper, "setObjectMetadataSignal", thinkingSignal(helper)),
    };
}

// Every NPC played as a helper in a loaded multiplayer room is one, from the beat after it is put there until it is
// taken away; one an admin makes no longer played goes back to how the room keeps it, silent.
function findHelpers(now: number): void
{
    const found = new Set<string>();
    for (const [roomID, memory] of Object.entries(ServerRoomManager.roomRuntimeMemories))
    {
        if (memory.room.roomType == RoomTypeEnumMap.SinglePlayer)
            continue;
        for (const obj of Object.values(memory.room.objectById))
        {
            if (obj.objectTypeIndex != NPC_TYPE_INDEX || !HelperBehaviorUtil.isPlayed(obj))
                continue;
            const key = `${roomID}/${obj.objectId}`;
            found.add(key);
            const helper = helpers.get(key) ?? newHelper(roomID, obj, now);
            HelperBehaviorUtil.takeSettings(helper, obj, now);
            helpers.set(key, helper);
        }
    }
    for (const [key, helper] of helpers)
    {
        if (found.has(key))
            continue;
        if (ServerRoomManager.roomRuntimeMemories[helper.roomID]?.room.objectById[helper.objectId] != undefined)
        {
            const surroundings = surroundingsOf(helper);
            HelperBehaviorUtil.standAtHome(helper, surroundings);
            HelperBehaviorUtil.fallSilent(helper, surroundings);
        }
        HelperBehaviorUtil.endSmallTalk(helper);
        helpers.delete(key);
    }
}

// Helpers near each other chat now and then, in fixed words (see HelperSmallTalkUtil): only while someone is in their
// room to see it, and never one held. One with someone to greet or answer has talked with them too lately to.
function startSmallTalks(now: number): void
{
    const byRoomID = new Map<string, HelperState[]>();
    for (const helper of helpers.values())
        byRoomID.set(helper.roomID, [...(byRoomID.get(helper.roomID) ?? []), helper]);
    for (const [roomID, inRoom] of byRoomID)
    {
        const free = inRoom.filter(helper => helper.heldBy.size == 0);
        if (free.length < 2 || surroundingsOf(free[0]).getPeople().length == 0)
            continue;
        const pair = HelperBehaviorUtil.findSmallTalkPair(free,
            ServerRoomManager.roomRuntimeMemories[roomID].room.voxelGrid.voxels, now);
        if (pair != undefined)
        {
            HelperBehaviorUtil.startSmallTalk(pair, HelperSmallTalkUtil.compose(pair.map(helper =>
                ({name: helper.name, personality: helper.prefs.personality}))), now);
        }
    }
}

function newHelper(roomID: string, obj: AddObjectSignal, now: number): HelperState
{
    return {...HelperBehaviorUtil.create(obj, now), roomID, objectId: obj.objectId, heldBy: new Set(),
        greetedLogins: new Map(), greetings: [], linesByUserID: new Map(), toldUserIDs: new Set()};
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

function letGo(helper: HelperState, now: number): void
{
    if (helper.heldBy.size == 0)
        HelperBehaviorUtil.letGo(helper, now);
}

// An admin moving it (or turning it) moves its home, the room's own copy, which it then stands still at for a while.
// The admin's edit has already shown it there to everyone; facing the way it was put is shown over the way it faced.
function followHome(helper: HelperState, room: Room, now: number): void
{
    const obj = room.objectById[helper.objectId];
    const quarterTurns = QuarterTurnsUtil.getQuarterTurns(obj);
    if (HelperBehaviorUtil.isSamePlace(obj.transform.pos, helper.home) && quarterTurns == helper.homeQuarterTurns)
        return;
    helper.home = {...obj.transform.pos};
    helper.homeQuarterTurns = quarterTurns;
    helper.at = {...helper.home};
    helper.path = [];
    helper.frozenUntil = now + FROZEN_AFTER_MOVE_MS;
    helper.facing = HelperBehaviorUtil.getFacingPut(quarterTurns);
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

// The room one is sent keeps the helper at home, so they are told where it is, which way it faces, what it is saying and
// whether it is thinking of an answer.
function catchUpOn(helper: HelperState): {signalType: string, signal: EncodableData}[]
{
    const signals: {signalType: string, signal: EncodableData}[] = [];
    if (!HelperBehaviorUtil.isSamePlace(helper.at, helper.home))
        signals.push({signalType: "setObjectTransformSignal", signal: transformSignal(helper)});
    if (helper.facing != HelperBehaviorUtil.getFacingPut(helper.homeQuarterTurns))
        signals.push({signalType: "setObjectMetadataSignal", signal: facingSignal(helper)});
    if (helper.saying.length > 0)
        signals.push({signalType: "setObjectMetadataSignal", signal: speechSignal(helper, helper.saying)});
    if (helper.thinking)
        signals.push({signalType: "setObjectMetadataSignal", signal: thinkingSignal(helper)});
    return signals;
}

// Each visitor who comes near is greeted once in each of their logins (see UserContext.loginCount), not each time they
// come into the room; a ghost not at all while it is one.
function noticeVisitors(helper: HelperState, memory: RoomRuntimeMemory, now: number): void
{
    for (const [userID, name] of Object.entries(memory.participantUserNameByID))
    {
        const ctx = ServerUserManager.getSocketUserContext(userID);
        const player = ServerUserManager.getPlayerObject(userID);
        if (ctx == undefined || player == undefined || helper.greetedLogins.get(userID)?.loginCount === ctx.loginCount
            || AdminPrefsUtil.isGhost(player) || !HelperBehaviorUtil.isInEarshot(helper, player.transform.pos))
        {
            continue;
        }
        helper.greetedLogins.set(userID, {loginCount: ctx.loginCount, at: now});
        helper.greetings.push({userID, name, returning: ctx.funnel.includes(FunnelMilestoneEnumMap.Returned)});
    }
}

// Those who came near together are greeted together, as are those who came while it was still talking, so that a crowd
// isn't greeted one by one long after it came. Whoever of them has never been told how to walk and build is told next,
// by the first helper to greet them.
function greet(helper: HelperState, now: number): void
{
    if (helper.greetings.length == 0 || helper.bubbles.length > 0 || now < helper.nextBubbleAt)
        return;
    const due = helper.greetings;
    helper.greetings = [];
    HelperBehaviorUtil.say(helper, HelperBehaviorUtil.getGreeting(helper, due.map(greeting => greeting.name),
        due.every(greeting => greeting.returning)), due.map(greeting => greeting.userID), now);
    const untold = due.map(greeting => ServerUserManager.getSocketUserContext(greeting.userID))
        .filter((ctx): ctx is UserContext => ctx != undefined && needsBasics(ctx));
    if (untold.length == 0)
        return;
    HelperBehaviorUtil.say(helper, HelperBehaviorUtil.getBasics(helper), untold.map(ctx => ctx.user.id), now);
    for (const ctx of untold)
    {
        // In memory at once, so that no other helper tells them too, and kept in their row for good.
        ctx.user.ftue += FTUEElementUtil.toChar(FTUEElementCodeEnumMap.Basics);
        void DBUserUtil.setFTUE(ctx.user.id, ctx.user.ftue);
    }
}

// Whether someone has never been told how to walk and build, by the tutorial or a helper (see
// FTUEElementCodeEnumMap.Basics). An agent plays through tools, which its manual tells it of.
function needsBasics(ctx: UserContext): boolean
{
    return !(ctx instanceof AgentUserContext) && !FTUEElementUtil.has(ctx.user.ftue, FTUEElementCodeEnumMap.Basics);
}

// Speakers who have paused are answered in turn, each once the helper has said all it was saying, as a person answers a
// crowd: it stops to answer (and turns to them, see HelperBehaviorUtil).
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
        HelperBehaviorUtil.startAnswering(helper, surroundingsOf(helper), userID, now);
        void answer(helper, userID, pending).finally(() => {
            // Shown to the room only while it is still a helper there (see findHelpers).
            if (helpers.get(`${helper.roomID}/${helper.objectId}`) === helper)
                HelperBehaviorUtil.stopAnswering(helper, surroundingsOf(helper));
            else
                helper.answering = undefined;
        });
        return;
    }
}

async function answer(helper: HelperState, userID: string, pending: HelperPendingLines): Promise<void>
{
    const refusalLine = await getRefusalLine(userID, pending.isAgent);
    if (refusalLine != undefined)
    {
        if (refusalLine.length > 0)
        {
            HelperBehaviorUtil.meet(helper, surroundingsOf(helper), userID, Date.now());
            HelperBehaviorUtil.sayAnswer(helper, refusalLine, [userID], Date.now());
        }
        return;
    }
    // As things stand now: they may have been told how to play while their lines waited.
    const ctx = ServerUserManager.getSocketUserContext(userID);
    const tag = pending.isAgent ? "an AI agent" : (ctx != undefined && needsBasics(ctx)) ? UNTOLD_TAG : TOLD_TAG;
    const line = `(${tag}) ${pending.lines.join(" ")}`;
    const reply = await HelperChatUtil.reply(identityOf(helper), userID, line);
    if (reply == undefined || !helpers.has(`${helper.roomID}/${helper.objectId}`))
        return;
    HelperBehaviorUtil.meet(helper, surroundingsOf(helper), userID, Date.now());
    HelperBehaviorUtil.sayAnswer(helper, reply, [userID], Date.now());
}

// Why no reply can be paid for this one now, as they are told, or "" when they have been told lately; undefined if one
// can.
async function getRefusalLine(userID: string, isAgent: boolean): Promise<string | undefined>
{
    const refusal = await HelperChatUtil.getRefusal(userID, isAgent);
    if (refusal == undefined)
        return undefined;
    const toldKey = `${userID} ${refusal}`;
    if (Date.now() - (state.refusalToldAt.get(toldKey) ?? -Infinity) < REFUSAL_RETOLD_AFTER_MS)
        return "";
    state.refusalToldAt.set(toldKey, Date.now());
    return REFUSAL_LINES[refusal];
}

function identityOf(helper: HelperState): HelperIdentity
{
    const room = ServerRoomManager.roomRuntimeMemories[helper.roomID]?.room;
    const place = (helper.roomID == RoomPickerUtil.getFirstHubRoomID()) ? "the main hub, the public room newcomers arrive in"
        : (room?.roomType == RoomTypeEnumMap.Hub) ? "one of the public hubs" : "a room one of the players made";
    return {key: `${helper.roomID}/${helper.objectId}`, name: helper.name, place, personality: helper.prefs.personality};
}

function transformSignal(helper: HelperState): SetObjectTransformSignal
{
    const scale = ServerRoomManager.roomRuntimeMemories[helper.roomID]?.room.objectById[helper.objectId]?.transform.scale
        ?? {x: 1, y: 1, z: 1};
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

function thinkingSignal(helper: HelperState): SetObjectMetadataSignal
{
    return new SetObjectMetadataSignal(helper.roomID, helper.objectId, ObjectMetadataKeyEnumMap.Thinking,
        helper.thinking ? "1" : "");
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

export default HelperAgentUtil;
