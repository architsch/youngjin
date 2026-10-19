import Vec3 from "../../../shared/math/types/vec3";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import DoorObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { DoorTypeEnumMap } from "../../../shared/object/types/doorType";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import VoxelPathUtil from "../../../shared/voxel/util/voxelPathUtil";
import { HOUR_IN_MS, MINUTE_IN_MS, OBJECT_MESSAGE_MAX_LENGTH } from "../../../shared/system/sharedConstants";
import LogUtil from "../../../shared/system/util/logUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import DBUser from "../../db/types/row/dbUser";
import DBUserUtil from "../../db/util/dbUserUtil";
import DBSearchUtil from "../../db/util/dbSearchUtil";
import ServerRoomManager from "../../room/serverRoomManager";
import RoomPickerUtil from "../../room/util/roomPickerUtil";
import ServerUserManager from "../../user/serverUserManager";
import { FunnelMilestoneEnumMap } from "../../analytics/types/funnelMilestone";
import { AGENT_ACQUISITION_SOURCE_PREFIX, HELPER_AGENT_NAME } from "../../system/serverConstants";
import AgentUserContext from "../types/agentUserContext";
import AgentEvent from "../types/agentEvent";
import { HelperChatRefusal } from "../types/helperChatRefusal";
import AgentPresenceUtil from "./agentPresenceUtil";
import AgentToolUtil from "./agentToolUtil";
import AgentBodyUtil from "./agentBodyUtil";
import AgentRoomUtil from "./agentRoomUtil";
import HelperChatUtil from "./helperChatUtil";

// The Helper: the agent the server runs itself, so that a newcomer never arrives to an empty world. It stays near the
// door of the hub newcomers land in first (see RoomPickerUtil.getFirstHubRoomID), moving with that hub when the order
// changes; greets those on their first visit; and answers whoever talks to it nearby, or names it, people and agents
// alike, through Claude (see HelperChatUtil). It plays by the same tools and rules as any agent, and people are shown
// it is an AI (see ObjectMetadataKeyEnumMap.AgentMark).

const TICK_MS = 1000;
const HUB_CHECK_INTERVAL_MS = 10_000;
const POST_CHECK_INTERVAL_MS = 15_000;
// Its post: this far into the room from the door, and this far to one side, out of the way of arrivals.
const POST_DISTANCE = 3;
const POST_SIDE_OFFSET = 1.5;
// Walked back to once this far from it, or to face the door again once nobody has talked to it for this long.
const POST_TOLERANCE = 1.5;
const REFACE_DOOR_AFTER_MS = 30_000;
// Someone this near is heard; someone farther off only when they name the Helper.
const HEARING_DISTANCE = 8;
// A person's lines are answered together once they have paused this long.
const ANSWER_PAUSE_MS = 1500;
// An arrival is greeted once it has stepped out of the doorway.
const GREETING_DELAY_MS = 2500;
// How long a bubble stays before the next of the same reply, so it can be read.
const MIN_BUBBLE_MS = 2500;
const BUBBLE_MS_PER_CHAR = 55;
// How often what the Helper spends is logged.
const USAGE_LOG_INTERVAL_MS = HOUR_IN_MS;
const FAILURE_LOG_INTERVAL_MS = MINUTE_IN_MS;
const GUEST_NAME_PATTERN = /^guest-/i;

const REFUSAL_LINES: {[refusal in HelperChatRefusal]: string} = {
    noModel: "Sorry, I can only say hello for now. Have fun exploring!",
    dayLimit: "I've talked a lot today and need a rest. Explore away, and come back tomorrow!",
    hourlyLimit: "Let's take a little break. Try exploring, and talk to me again later!",
};

type PendingLines = {name: string, isAgent: boolean, firstVisit: boolean, lines: string[], lastAt: number};

const state = {
    account: undefined as DBUser | undefined,
    ctx: undefined as AgentUserContext | undefined,
    timer: undefined as NodeJS.Timeout | undefined,
    ticking: false,
    hubCheckedAt: -Infinity,
    postCheckedAt: -Infinity,
    usageLoggedAt: Date.now(),
    failureLoggedAt: -Infinity,
    walking: false,
    facingDoor: false,
    lastTalkAt: -Infinity,
    greetings: [] as {name: string, dueAt: number}[],
    linesByUserID: new Map<string, PendingLines>(),
    answering: new Set<string>(),
    bubbles: [] as string[],
    nextBubbleAt: 0,
    // When each person was last told why no reply came, by the reason.
    refusalToldAt: new Map<string, number>(),
};

const HelperAgentUtil =
{
    // Puts the Helper in its hub and keeps it there. Nothing is fatal: a Helper that can't start is logged and missed.
    start: async (): Promise<void> =>
    {
        state.account = await findOrCreateAccount();
        if (state.account == undefined)
        {
            LogUtil.log("Helper couldn't start", {reason: "no account"}, "high", "error");
            return;
        }
        await HelperAgentUtil.tick();
        state.timer = setInterval(() => void HelperAgentUtil.tick(), TICK_MS);
    },
    stop: async (): Promise<void> =>
    {
        clearInterval(state.timer);
        await HelperChatUtil.saveSpending(true);
        if (state.ctx != undefined && !state.ctx.isClosed())
            await AgentPresenceUtil.leave(state.ctx);
        Object.assign(state, {account: undefined, ctx: undefined, timer: undefined, ticking: false,
            hubCheckedAt: -Infinity, postCheckedAt: -Infinity, usageLoggedAt: Date.now(), walking: false,
            facingDoor: false, lastTalkAt: -Infinity, greetings: [], bubbles: [], nextBubbleAt: 0});
        state.linesByUserID.clear();
        state.answering.clear();
        state.refusalToldAt.clear();
    },
    getContext: (): AgentUserContext | undefined => state.ctx,
    // One beat of the Helper's life, every second.
    tick: async (): Promise<void> =>
    {
        if (state.ticking || state.account == undefined)
            return;
        state.ticking = true;
        try
        {
            const now = Date.now();
            const ctx = await stayPresent();
            if (ctx == undefined)
                return;
            if (now - state.hubCheckedAt >= HUB_CHECK_INTERVAL_MS)
            {
                state.hubCheckedAt = now;
                await keepToFirstHub(ctx);
            }
            for (const event of ctx.inbox.take())
                hear(ctx, event, now);
            greetArrivals(now);
            answerSpeakers(ctx, now);
            await speakNextBubble(ctx, now);
            if (now - state.postCheckedAt >= POST_CHECK_INTERVAL_MS)
            {
                state.postCheckedAt = now;
                keepToPost(ctx, now);
            }
            await HelperChatUtil.saveSpending();
            if (now - state.usageLoggedAt >= USAGE_LOG_INTERVAL_MS)
            {
                state.usageLoggedAt = now;
                LogUtil.log("Helper usage", HelperChatUtil.getUsageToday(), "low", "info");
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
}

// Its own account: an agent under the reserved name, made the first time, with no key, so nothing else can play it.
async function findOrCreateAccount(): Promise<DBUser | undefined>
{
    const found = await DBSearchUtil.users.withUserName(HELPER_AGENT_NAME);
    if (!found.success)
        return undefined;
    const existing = found.data.find(row => row.userType == UserTypeEnumMap.Agent);
    if (existing != undefined)
        return existing;
    const created = await DBUserUtil.createUser(HELPER_AGENT_NAME, UserTypeEnumMap.Agent, "", "",
        `${AGENT_ACQUISITION_SOURCE_PREFIX}-helper`);
    if (!created.success || created.data.length == 0)
        return undefined;
    return (await DBUserUtil.findUserById(created.data[0].id)) ?? undefined;
}

// Present, as an agent's requests keep it, coming back if it was taken out (say, when its room was reloaded).
async function stayPresent(): Promise<AgentUserContext | undefined>
{
    if (state.ctx == undefined || state.ctx.isClosed() || !ServerUserManager.hasUser(state.ctx.user.id))
    {
        state.ctx = await AgentPresenceUtil.attend(state.account as DBUser);
        state.hubCheckedAt = -Infinity;
        state.facingDoor = false;
    }
    state.ctx?.noteRequest();
    return state.ctx;
}

async function keepToFirstHub(ctx: AgentUserContext): Promise<void>
{
    const firstHubRoomID = RoomPickerUtil.getFirstHubRoomID();
    if (firstHubRoomID.length > 0 && ServerRoomManager.currentRoomIDByUserID[ctx.user.id] != firstHubRoomID)
    {
        await AgentToolUtil.travel(ctx, firstHubRoomID);
        state.facingDoor = false;
        state.postCheckedAt = -Infinity;
    }
}

// Newcomers, agents among them, are greeted with fixed words; whoever talks to it is answered, each within an hourly
// limit of their own (see HelperChatUtil.getRefusal).
function hear(ctx: AgentUserContext, event: AgentEvent, now: number): void
{
    if (event.who == undefined)
        return;
    if (event.kind == "arrival")
    {
        if (isOnFirstVisit(ctx, event.who))
            state.greetings.push({name: event.who, dueAt: now + GREETING_DELAY_MS});
    }
    else if (event.kind == "speech" && (event.text ?? "").length > 0)
    {
        const userID = findUserID(ctx, event.who);
        if (userID == undefined || !(isNear(ctx, userID) || /\bhelper\b/i.test(event.text as string)))
            return;
        const pending = state.linesByUserID.get(userID) ?? {name: event.who, isAgent: event.whoIsAgent == true,
            firstVisit: isOnFirstVisit(ctx, event.who), lines: [], lastAt: now};
        pending.lines.push(event.text as string);
        pending.lastAt = now;
        state.linesByUserID.set(userID, pending);
    }
}

// Those who arrived together are greeted together.
function greetArrivals(now: number): void
{
    const due = state.greetings.filter(greeting => greeting.dueAt <= now);
    if (due.length == 0)
        return;
    state.greetings = state.greetings.filter(greeting => greeting.dueAt > now);
    const name = (due.length == 1 && !GUEST_NAME_PATTERN.test(due[0].name)) ? ` ${due[0].name}` : "";
    const whom = due.length > 1 ? " everyone" : name;
    say([`Hi${whom}, welcome to ThingsPool! I'm Helper, an AI guide.`, "Ask me anything, or just look around!"]);
}

// Each speaker who has paused is answered, one model call at a time per person.
function answerSpeakers(ctx: AgentUserContext, now: number): void
{
    for (const [userID, pending] of state.linesByUserID)
    {
        if (now - pending.lastAt < ANSWER_PAUSE_MS || state.answering.has(userID))
            continue;
        state.linesByUserID.delete(userID);
        state.answering.add(userID);
        state.lastTalkAt = now;
        void answer(ctx, userID, pending).finally(() => state.answering.delete(userID));
    }
}

async function answer(ctx: AgentUserContext, userID: string, pending: PendingLines): Promise<void>
{
    const refusal = await HelperChatUtil.getRefusal(userID, pending.isAgent);
    if (refusal != undefined)
    {
        // Told once a day why no reply comes, or once an hour for their own limit.
        const toldKey = `${userID} ${refusal}`;
        const toldAt = state.refusalToldAt.get(toldKey) ?? -Infinity;
        if (Date.now() - toldAt >= (refusal == "hourlyLimit" ? HOUR_IN_MS : 24 * HOUR_IN_MS))
        {
            state.refusalToldAt.set(toldKey, Date.now());
            turnTo(ctx, userID);
            say([REFUSAL_LINES[refusal]]);
        }
        return;
    }
    const tags = [pending.isAgent ? "an AI agent" : "", pending.firstVisit ? "new here" : ""].filter(tag => tag != "");
    const line = `${pending.name}${tags.length > 0 ? ` (${tags.join(", ")})` : ""}: ${pending.lines.join(" ")}`;
    const reply = await HelperChatUtil.reply(userID, line);
    if (reply == undefined)
        return;
    turnTo(ctx, userID);
    say(toBubbles(reply));
}

// Queued, so that one reply's bubbles follow each other at a pace they can be read in.
function say(lines: string[]): void
{
    state.bubbles.push(...lines.flatMap(toBubbles));
}

async function speakNextBubble(ctx: AgentUserContext, now: number): Promise<void>
{
    if (state.bubbles.length == 0 || now < state.nextBubbleAt)
        return;
    const text = state.bubbles[0];
    const said = await AgentToolUtil.say(ctx, text);
    // Refused only for talking too fast, so it is tried again on a later beat.
    if ("error" in said)
        return;
    state.bubbles.shift();
    state.nextBubbleAt = now + Math.max(MIN_BUBBLE_MS, BUBBLE_MS_PER_CHAR * text.length);
}

// Bubble-sized pieces: whole sentences where they fit, else words.
function toBubbles(text: string): string[]
{
    const bubbles: string[] = [];
    let current = "";
    const add = (piece: string) => {
        const joined = current.length > 0 ? `${current} ${piece}` : piece;
        if (joined.length <= OBJECT_MESSAGE_MAX_LENGTH)
        {
            current = joined;
            return;
        }
        if (current.length > 0)
            bubbles.push(current);
        current = piece;
    };
    for (const sentence of (text.match(/[^.!?]+[.!?]*/g) ?? []).map(sentence => sentence.trim()))
    {
        if (sentence.length <= OBJECT_MESSAGE_MAX_LENGTH)
            add(sentence);
        else
            sentence.split(/\s+/).forEach(word => add(word.slice(0, OBJECT_MESSAGE_MAX_LENGTH)));
    }
    if (current.length > 0)
        bubbles.push(current);
    return bubbles.filter(bubble => bubble.length > 0);
}

// Its post in front of the hub's entrance (see SpawnHotspotUtil, which puts arrivals behind it), facing the door.
function keepToPost(ctx: AgentUserContext, now: number): void
{
    const room = AgentRoomUtil.getCurrentRoom(ctx);
    const me = AgentRoomUtil.getMyPlayer(ctx);
    const door = room == undefined ? undefined : findEntrance(Object.values(room.objectById));
    if (room == undefined || me == undefined || door == undefined || state.walking || state.answering.size > 0)
        return;
    const {pos, dir} = door.transform;
    const floorY = DoorObjectTypeConfig.util.getFloorY(door);
    const post: Vec3 = {
        x: pos.x + dir.x * POST_DISTANCE - dir.z * POST_SIDE_OFFSET,
        y: floorY,
        z: pos.z + dir.z * POST_DISTANCE + dir.x * POST_SIDE_OFFSET,
    };
    const feet = VoxelPathUtil.feetOf(me.transform.pos);
    const offPost = Math.hypot(feet.x - post.x, feet.z - post.z) > POST_TOLERANCE;
    if (!offPost && (state.facingDoor || now - state.lastTalkAt < REFACE_DOOR_AFTER_MS))
        return;
    const goal = VoxelPathUtil.findStandingVertexNear(room.voxelGrid.voxels, post);
    if (goal == undefined)
        return;
    state.walking = true;
    void AgentBodyUtil.walk(ctx, goal, {faceToward: pos})
        .then(outcome => { state.facingDoor = (outcome == "arrived"); })
        .finally(() => { state.walking = false; });
}

function turnTo(ctx: AgentUserContext, userID: string): void
{
    const room = AgentRoomUtil.getCurrentRoom(ctx);
    const me = AgentRoomUtil.getMyPlayer(ctx);
    const them = ServerUserManager.getPlayerObject(userID);
    if (room == undefined || me == undefined || them == undefined || state.walking)
        return;
    const here = VoxelPathUtil.findStandingVertexNear(room.voxelGrid.voxels, VoxelPathUtil.feetOf(me.transform.pos));
    if (here == undefined)
        return;
    state.walking = true;
    state.facingDoor = false;
    void AgentBodyUtil.walk(ctx, here, {faceToward: them.transform.pos}).finally(() => { state.walking = false; });
}

// The default entrance, else any door.
function findEntrance(objects: AddObjectSignal[]): AddObjectSignal | undefined
{
    const doors = objects.filter(obj => obj.objectTypeIndex == ObjectTypeConfigMap.getIndexByType("Door"));
    return doors.find(door => DoorObjectTypeConfig.util.getDoorType(door) == DoorTypeEnumMap.DefaultEntrance)
        ?? doors[0];
}

function findUserID(ctx: AgentUserContext, name: string): string | undefined
{
    const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
    const participants = roomID == undefined ? {} : ServerRoomManager.roomRuntimeMemories[roomID]?.participantUserNameByID ?? {};
    return Object.keys(participants).find(userID => participants[userID] == name);
}

// Not yet back on a later day (see FunnelMilestoneEnumMap.Returned).
function isOnFirstVisit(ctx: AgentUserContext, name: string): boolean
{
    const userID = findUserID(ctx, name);
    const userContext = userID == undefined ? undefined : ServerUserManager.getSocketUserContext(userID);
    return userContext != undefined && !userContext.funnel.includes(FunnelMilestoneEnumMap.Returned);
}

function isNear(ctx: AgentUserContext, userID: string): boolean
{
    const me = AgentRoomUtil.getMyPlayer(ctx);
    const them = ServerUserManager.getPlayerObject(userID);
    return me != undefined && them != undefined
        && Math.hypot(me.transform.pos.x - them.transform.pos.x, me.transform.pos.z - them.transform.pos.z)
            <= HEARING_DISTANCE;
}

export default HelperAgentUtil;
