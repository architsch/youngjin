/**
 * Integration tests: helpers (see HelperAgentUtil), the NPCs an admin stands in multiplayer rooms, which the server plays
 * as AI guides. Each keeps near where it was put, its home, which the room keeps it at while its steps, turns and speech
 * are only shown; greets each visitor as they come near, once a login; and answers people and agents nearby, or who name
 * it, through Claude (stood in for here), within limits every helper shares.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Analytics write to Firestore directly.
const _analytics = vi.hoisted(() => ({
    recordArrival: vi.fn(async () => {}),
    recordReturnVisit: vi.fn(async () => {}),
    recordMilestone: vi.fn(async () => {}),
}));
vi.mock("../../../src/server/analytics/serverAnalyticsManager", () => ({ default: _analytics }));
// The day's spending as Firestore would keep it, by date.
const _spending = vi.hoisted(() => ({byDate: new Map<string, number>(), failing: false}));
vi.mock("../../../src/server/db/util/dbHelperSpendingUtil", () => ({ default: {
    getSpent: vi.fn(async (date: string) => _spending.failing ? undefined : (_spending.byDate.get(date) ?? 0)),
    addSpent: vi.fn(async (date: string, microDollars: number) => {
        if (_spending.failing)
            return false;
        _spending.byDate.set(date, (_spending.byDate.get(date) ?? 0) + microDollars);
        return true;
    }),
}}));

import { harness, ConnectedUser } from "../helpers/serverHarness";
import HelperAgentUtil from "../../../src/server/agent/util/helperAgentUtil";
import HelperChatUtil from "../../../src/server/agent/util/helperChatUtil";
import AgentBodyUtil from "../../../src/server/agent/util/agentBodyUtil";
import AgentAccountUtil from "../../../src/server/agent/util/agentAccountUtil";
import AgentPresenceUtil from "../../../src/server/agent/util/agentPresenceUtil";
import AgentToolUtil from "../../../src/server/agent/util/agentToolUtil";
import AgentUserContext from "../../../src/server/agent/types/agentUserContext";
import HelperIdentity from "../../../src/server/agent/types/helperIdentity";
import SocketRoomContext from "../../../src/server/sockets/types/socketRoomContext";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import UserSignalDispatchUtil from "../../../src/server/user/util/userSignalDispatchUtil";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import EncodableData from "../../../src/shared/networking/types/encodableData";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { DoorTypeEnumMap } from "../../../src/shared/object/types/doorType";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import QuarterTurnsUtil from "../../../src/shared/object/util/quarterTurnsUtil";
import HoldObjectSignal from "../../../src/shared/object/types/holdObjectSignal";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import { NUM_VOXEL_COLS, OBJECT_MESSAGE_MAX_LENGTH } from "../../../src/shared/system/sharedConstants";
import { HELPER_DAILY_BUDGET_DOLLARS, HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR,
    HELPER_MAX_REPLIES_PER_PERSON_PER_HOUR, HELPER_MODEL, HELPER_MODEL_PRICES } from "../../../src/server/system/serverConstants";
import Vec3 from "../../../src/shared/math/types/vec3";
import LogUtil from "../../../src/shared/system/util/logUtil";
import "../../../src/shared/graphics/image/imageMapDependencies";

const FIRST_HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const LATER_HUB_ID = "hubBBBBBBBBBBBBBBBBB";
const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");
const UP: Vec3 = {x: 0, y: 1, z: 0};

// Claude, stood in for: what it was asked, the answers it gives in turn, and the tokens it says each took.
const REPLY_USAGE = {input_tokens: 1200, output_tokens: 30, cache_read_input_tokens: 0, cache_creation_input_tokens: 0};
const claude = {requests: [] as {body: any, headers: any}[], answers: [] as string[], failing: false,
    usage: REPLY_USAGE};

async function fakeFetch(url: string | URL, init?: RequestInit): Promise<Response>
{
    if (!String(url).startsWith("https://api.anthropic.com/"))
        throw new Error(`Unexpected fetch of ${url}`);
    claude.requests.push({body: JSON.parse(init?.body as string), headers: init?.headers});
    if (claude.failing)
        return new Response("overloaded", {status: 529});
    return new Response(JSON.stringify({content: [{type: "text", text: claude.answers.shift() ?? "Happy to help!"}],
        usage: claude.usage}), {status: 200, headers: {"content-type": "application/json"}});
}

const SOME_HELPER: HelperIdentity = {key: "room/npc", name: "Mira", place: "one of the public hubs"};

// Replies to different people until the budget refuses one, after a reply that cost what the usage says.
async function replyUntilRefused(): Promise<number>
{
    let replies = 0;
    while (await HelperChatUtil.getRefusal(`person-${replies}`, false) == undefined)
        await HelperChatUtil.reply(SOME_HELPER, `person-${replies++}`, `Person: hi`);
    return replies;
}

const today = () => new Date(Date.now()).toISOString().slice(0, 10);

// What makes a reply cost a tenth of the day's budget, at the model's prices.
function tenthOfBudgetUsage(): typeof REPLY_USAGE
{
    return {...REPLY_USAGE, output_tokens: 0,
        input_tokens: Math.round(HELPER_DAILY_BUDGET_DOLLARS / 10 * 1_000_000 / HELPER_MODEL_PRICES.input)};
}

// What the server showed rooms (and who to, when only one user was told).
const shown: {signalType: string, signal: any, userID?: string}[] = [];

// Seconds of the helpers' lives: each a tick, with the flushes between that step agents' bodies and walking helpers.
async function live(seconds: number): Promise<void>
{
    for (let i = 0; i < seconds; ++i)
    {
        for (let flush = 0; flush < 5; ++flush)
        {
            vi.setSystemTime(Date.now() + 200);
            AgentBodyUtil.stepAll(0.2);
            HelperAgentUtil.stepAll(0.2);
        }
        await HelperAgentUtil.tick();
        // Lets a reply that was asked for come back.
        for (let settle = 0; settle < 5; ++settle)
            await new Promise(resolve => setImmediate(resolve));
    }
}

function entranceOf(roomID: string): AddObjectSignal
{
    return Object.values(ServerRoomManager.roomRuntimeMemories[roomID].room.objectById).find(obj =>
        obj.objectTypeIndex == ObjectTypeConfigMap.getIndexByType("Door")
        && DoorObjectTypeConfig.util.getDoorType(obj) == DoorTypeEnumMap.DefaultEntrance)!;
}

// A floor point this far into the room from its entrance (and this far to one side).
function inFrontOfEntrance(roomID: string, distance: number, side: number = 0): Vec3
{
    const door = entranceOf(roomID);
    const {pos, dir} = door.transform;
    return {x: pos.x + dir.x * distance - dir.z * side, y: DoorObjectTypeConfig.util.getFloorY(door),
        z: pos.z + dir.z * distance + dir.x * side};
}

// An NPC an admin stood on a room's floor (by default a little in from the entrance), as the room keeps it.
let npcCounter = 0;
function standNpc(roomID: string, name: string, at?: Vec3, quarterTurns: number = 0): string
{
    const objectId = `npc${++npcCounter}`;
    const position = at ?? inFrontOfEntrance(roomID, 3, 1.5);
    ServerRoomManager.roomRuntimeMemories[roomID].room.objectById[objectId] = new AddObjectSignal(roomID, "admin",
        "Admin", NPC_TYPE_INDEX, objectId, new ObjectTransform({...position}, {...UP}, {x: 1, y: 1, z: 1}), {
            [ObjectMetadataKeyEnumMap.Label]: new EncodableByteString(name),
            [ObjectMetadataKeyEnumMap.QuarterTurns]: new EncodableByteString(QuarterTurnsUtil.encode(quarterTurns)),
        });
    return objectId;
}

// What a helper has said, bubble by bubble, as the room was shown it (not what a newcomer was told it is saying).
function saidBy(objectId: string): string[]
{
    return shown.filter(({signalType, signal, userID}) => userID == undefined && signalType == "setObjectMetadataSignal"
        && signal.objectId == objectId && signal.metadataKey == ObjectMetadataKeyEnumMap.SentMessage
        && signal.metadataValue != "").map(({signal}) => signal.metadataValue);
}

// A person's line, sent as their browser sends it.
async function talk(person: ConnectedUser, text: string): Promise<void>
{
    const bufferState = EncodingUtil.startEncoding();
    new SetObjectMetadataSignal(ServerRoomManager.currentRoomIDByUserID[person.user.id], playerOf(person.user.id).objectId,
        ObjectMetadataKeyEnumMap.SentMessage, text).encode(bufferState);
    await UserSignalDispatchUtil.dispatch(person.socketUserContext, "setObjectMetadataSignal",
        EncodingUtil.endEncoding(bufferState));
}

function helperIn(roomID: string, objectId: string)
{
    return HelperAgentUtil.getHelpers(roomID).find(helper => helper.objectId == objectId)!;
}

function playerOf(userID: string)
{
    return ServerUserManager.getPlayerObject(userID)!;
}

async function joinPerson(userName: string, funnel: string = "", roomID: string = FIRST_HUB_ID,
    loginCount: number = 0): Promise<ConnectedUser>
{
    const person = harness.connectUser({id: `id-${userName}`, userName});
    person.socketUserContext.funnel = funnel;
    person.socketUserContext.loginCount = loginCount;
    await harness.joinRoom(person, roomID);
    return person;
}

// Moves a person's player to where their feet stand on a floor point.
async function moveTo(person: ConnectedUser, floor: Vec3, roomID: string = FIRST_HUB_ID): Promise<void>
{
    const bufferState = EncodingUtil.startEncoding();
    const y = playerOf(person.user.id).transform.pos.y;
    new SetObjectTransformSignal(roomID, playerOf(person.user.id).objectId,
        new ObjectTransform({x: floor.x, y, z: floor.z}, {x: 0, y: 0, z: -1}, {x: 1, y: 1, z: 1}), false)
        .encode(bufferState);
    await UserSignalDispatchUtil.dispatch(person.socketUserContext, "setObjectTransformSignal",
        EncodingUtil.endEncoding(bufferState));
}

async function registerAndAttend(name: string, ip: string): Promise<AgentUserContext>
{
    const registered = await AgentAccountUtil.register(name, undefined, ip, "test-agent");
    return (await AgentPresenceUtil.attend((await AgentAccountUtil.findByKey((registered as any).key))!))!;
}

function across(a: Vec3, b: Vec3): number
{
    return Math.hypot(a.x - b.x, a.z - b.z);
}

describe("helpers", () => {
    beforeEach(async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        // The clock, and the helpers' own beat, which the tests give them.
        vi.useFakeTimers({toFake: ["Date", "setInterval", "clearInterval"]});
        vi.stubGlobal("fetch", fakeFetch);
        process.env.ANTHROPIC_API_KEY = "test-key";
        Object.assign(claude, {requests: [], answers: [], failing: false, usage: REPLY_USAGE});
        _spending.byDate.clear();
        _spending.failing = false;
        harness.reset();
        harness.seedHub(FIRST_HUB_ID, 1);
        harness.seedHub(LATER_HUB_ID, 5);
        await harness.loadRoom(FIRST_HUB_ID);
        await harness.loadRoom(LATER_HUB_ID);
        HelperChatUtil.reset();
        shown.length = 0;
        const multicast = SocketRoomContext.prototype.multicastSignal;
        vi.spyOn(SocketRoomContext.prototype, "multicastSignal").mockImplementation(function (this: SocketRoomContext,
            signalType: string, signal: EncodableData, userIDToExclude?: string) {
            shown.push({signalType, signal});
            return multicast.call(this, signalType, signal, userIDToExclude);
        });
        const unicast = SocketRoomContext.prototype.unicastSignal;
        vi.spyOn(SocketRoomContext.prototype, "unicastSignal").mockImplementation(function (this: SocketRoomContext,
            signalType: string, signal: EncodableData, userID: string) {
            shown.push({signalType, signal, userID});
            return unicast.call(this, signalType, signal, userID);
        });
        HelperAgentUtil.start();
    });

    afterEach(async () => {
        await HelperAgentUtil.stop();
        delete process.env.ANTHROPIC_API_KEY;
        vi.unstubAllGlobals();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("plays every NPC in a multiplayer room as a helper, by its name, from where the admin stood it", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        const bo = standNpc(LATER_HUB_ID, "Bo");
        await live(1);

        expect(HelperAgentUtil.getHelpers(FIRST_HUB_ID).map(helper => helper.name)).toEqual(["Mira"]);
        expect(helperIn(LATER_HUB_ID, bo).at).toEqual(
            ServerRoomManager.roomRuntimeMemories[LATER_HUB_ID].room.objectById[bo].transform.pos);

        delete ServerRoomManager.roomRuntimeMemories[FIRST_HUB_ID].room.objectById[mira];
        await live(1);
        expect(HelperAgentUtil.getHelpers(FIRST_HUB_ID)).toEqual([]);
    });

    it("greets a visitor who comes near once in each of their logins, not each time they come in, and asks no model",
        async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);

        const alice = await joinPerson("Alice");
        await live(6);
        expect(saidBy(mira)).toEqual(["Hi Alice, welcome to ThingsPool! I'm Mira, an AI guide.",
            "Ask me anything, or just look around!"]);

        // Out and in again, and a refresh, in the same login.
        await harness.disconnectUser(alice);
        await live(2);
        await joinPerson("Alice");
        await live(6);
        expect(saidBy(mira)).toHaveLength(2);

        // Back on another day: a new login, and one who has come back before.
        await harness.disconnectUser(harness.connectUser({id: "id-Alice", userName: "Alice"}));
        await joinPerson("Alice", "an", FIRST_HUB_ID, 1);
        await live(6);
        expect(saidBy(mira)[2]).toBe("Hi Alice, welcome back! I'm Mira, an AI guide.");
        expect(claude.requests).toEqual([]);
    });

    it("greets someone across the room only once they come near, and a guest without a name", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const guest = await joinPerson("Guest-1a2b");
        await moveTo(guest, inFrontOfEntrance(FIRST_HUB_ID, 16));
        await live(6);
        expect(saidBy(mira)).toEqual([]);

        await moveTo(guest, inFrontOfEntrance(FIRST_HUB_ID, 5));
        await live(3);
        expect(saidBy(mira)[0]).toBe("Hi, welcome to ThingsPool! I'm Mira, an AI guide.");
    });

    it("greets and hears by nearness only those on its own floor, and anyone in the room who names it", async () => {
        // Over the doorway, on the storey above.
        const below = inFrontOfEntrance(FIRST_HUB_ID, 3, 1.5);
        const mira = standNpc(FIRST_HUB_ID, "Mira", {...below, y: below.y + 4});
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await live(6);
        await talk(alice, "hello?");
        await live(6);
        expect(saidBy(mira)).toEqual([]);
        expect(claude.requests).toEqual([]);

        await talk(alice, "Mira, are you up there?");
        await live(6);
        expect(claude.requests).toHaveLength(1);
    });

    it("turns to face whoever it greets, keeping to the four ways an NPC faces", async () => {
        // Stood off to the side of the doorway, so that the arrival is off to one side of it.
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 1, 4));
        await live(1);
        const alice = await joinPerson("Alice");
        await live(4);

        const turns = shown.filter(({signalType, signal}) => signalType == "setObjectMetadataSignal"
            && signal.objectId == mira && signal.metadataKey == ObjectMetadataKeyEnumMap.QuarterTurns);
        expect(turns.length).toBeGreaterThan(0);
        const facing = QuarterTurnsUtil.getContentUp(UP, QuarterTurnsUtil.decode(turns[turns.length - 1].signal.metadataValue));
        const helper = helperIn(FIRST_HUB_ID, mira);
        const them = playerOf(alice.user.id).transform.pos;
        const toward = {x: them.x - helper.at.x, z: them.z - helper.at.z};
        expect((facing.x * toward.x + facing.z * toward.z) / Math.hypot(toward.x, toward.z)).toBeGreaterThan(0.7);
    });

    it("answers a person near it through Claude: the rules and guide cached, then its name and place, and that "
        + "person's own lines, in bubbles", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice");
        await live(8);

        claude.answers.push("Switch to Edit mode with the toggle at the top. Then click a block, and add one next "
            + "to it!");
        await talk(alice, "how do I build?");
        await live(8);

        expect(claude.requests).toHaveLength(1);
        const {body, headers} = claude.requests[0];
        expect(body.model).toBe(HELPER_MODEL);
        // Thinking would spend the reply's tokens before a word of it.
        expect(body.thinking).toEqual({type: "disabled"});
        expect(headers["x-api-key"]).toBe("test-key");
        expect(body.system[0].text).toContain("<guide>");
        expect(body.system[0].cache_control).toEqual({type: "ephemeral"});
        expect(body.system[1].text).toBe("Your name is Mira. You stand in the main hub, the public room newcomers arrive in.");
        expect(body.messages).toEqual([{role: "user", content: "Alice (new here): how do I build?"}]);
        expect(saidBy(mira).slice(2)).toEqual(["Switch to Edit mode with the toggle at the top.",
            "Then click a block, and add one next to it!"]);
        expect(saidBy(mira).every(bubble => bubble.length <= OBJECT_MESSAGE_MAX_LENGTH)).toBe(true);

        await talk(alice, "thanks!");
        await live(6);
        expect(claude.requests[1].body.messages.map((turn: {role: string}) => turn.role))
            .toEqual(["user", "assistant", "user"]);
    });

    it("has every helper ask with the same rules, a name and place of its own, and a talk of its own with each person",
        async () => {
        standNpc(FIRST_HUB_ID, "Mira");
        standNpc(LATER_HUB_ID, "Bo");
        await live(1);
        const alice = await joinPerson("Alice");
        await live(6);
        await talk(alice, "hi Mira!");
        await live(6);

        await harness.joinRoom(alice, LATER_HUB_ID);
        await live(6);
        await talk(alice, "hi Bo!");
        await live(6);

        expect(claude.requests).toHaveLength(2);
        const [toMira, toBo] = claude.requests.map(request => request.body);
        expect(toBo.system[0].text).toBe(toMira.system[0].text);
        expect(toBo.system[1].text).toBe("Your name is Bo. You stand in one of the public hubs.");
        expect(toBo.messages).toEqual([{role: "user", content: "Alice (new here): hi Bo!"}]);
    });

    it("answers an agent near it as it would a person, saying it is one, and greets it by name", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const agent = await registerAndAttend("Chatty-Agent", "10.9.9.7");
        await live(10);
        expect(saidBy(mira)[0]).toBe("Hi Chatty-Agent, welcome to ThingsPool! I'm Mira, an AI guide.");

        await AgentToolUtil.say(agent, "hello, what can I build?");
        await live(6);
        expect(claude.requests.map(request => request.body.messages.at(-1).content))
            .toEqual(["Chatty-Agent (an AI agent, new here): hello, what can I build?"]);
        expect(saidBy(mira).at(-1)).toBe("Happy to help!");
    });

    it("hears someone far off only when they name it, or call for a helper", async () => {
        standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const far = await joinPerson("Faraway", "an");
        await moveTo(far, inFrontOfEntrance(FIRST_HUB_ID, 18));
        await live(2);

        await talk(far, "hello?");
        await live(4);
        expect(claude.requests).toEqual([]);

        await talk(far, "Mira, what is this place?");
        await live(4);
        await talk(far, "any helper around?");
        await live(8);
        expect(claude.requests).toHaveLength(2);
    });

    it("keeps an address whole in its bubble, splitting a reply only where a sentence ends", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice");
        await live(8);

        claude.answers.push("Agents can make rooms of their own. Their manual is at https://thingspool.net/skill.md.");
        await talk(alice, "can AIs play?");
        await live(10);

        expect(saidBy(mira).slice(2)).toEqual(["Agents can make rooms of their own.",
            "Their manual is at https://thingspool.net/skill.md."]);
    });

    it("greets those who come near while it is still talking together, so that a crowd isn't greeted one by one",
        async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        await joinPerson("Alice");
        await live(1);
        for (const name of ["Bea", "Cyd", "Dee", "Eve", "Fay"])
        {
            await joinPerson(name);
            await live(1);
        }
        await live(20);

        const greetings = saidBy(mira).filter(text => text.includes("welcome to ThingsPool"));
        expect(greetings[0]).toBe("Hi Alice, welcome to ThingsPool! I'm Mira, an AI guide.");
        expect(greetings.length).toBeLessThanOrEqual(3);
        expect(greetings.slice(1).every(text => text.startsWith("Hi everyone,"))).toBe(true);
    });

    it("answers those who talk to it at once in turn, and lets go of lines left waiting over a minute", async () => {
        standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const crowd: ConnectedUser[] = [];
        for (let i = 1; i <= 8; ++i)
            crowd.push(await joinPerson(`Talker${i}`));
        await live(20);

        // Three bubbles each, about eleven seconds of speech.
        claude.answers.push(...crowd.map(() => "Walk around with the arrow keys and look at what others built here. "
            + "Switch to Edit mode with the toggle at the top right of the screen. "
            + "Then click a block, and press the cube to add one next to it!"));
        for (const person of crowd)
            await talk(person, "hi there!");
        await live(3);
        expect(claude.requests).toHaveLength(1);

        await live(120);
        const asked = claude.requests.map(request => request.body.messages.at(-1).content);
        expect(asked.length).toBeGreaterThanOrEqual(4);
        expect(asked.length).toBeLessThan(crowd.length);
        expect(asked).toEqual(crowd.slice(0, asked.length).map(person => `${person.user.userName} (new here): hi there!`));
    });

    it("keeps to an agent's hourly limit, lower than a person's, telling it once, and renews it the next hour",
        async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const agent = await registerAndAttend("Endless-Agent", "10.9.9.6");
        await live(10);
        expect(HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR).toBeLessThan(HELPER_MAX_REPLIES_PER_PERSON_PER_HOUR);

        for (let i = 0; i < HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR; ++i)
        {
            await AgentToolUtil.say(agent, `and another thing, ${i}`);
            await live(4);
        }
        expect(claude.requests).toHaveLength(HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR);
        await live(4);

        const before = saidBy(mira).length;
        await AgentToolUtil.say(agent, "one more?");
        await live(4);
        await AgentToolUtil.say(agent, "and another?");
        await live(4);
        expect(claude.requests).toHaveLength(HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR);
        expect(saidBy(mira).slice(before)).toEqual(["Let's take a little break. Try exploring, and talk to me again later!"]);

        vi.setSystemTime(Date.now() + 60 * 60 * 1000);
        await AgentToolUtil.say(agent, "back again!");
        await live(4);
        expect(claude.requests).toHaveLength(HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR + 1);
    });

    it("counts each person's replies across every helper against one hourly limit", async () => {
        const other: HelperIdentity = {key: "elsewhere/npc", name: "Bo", place: "one of the public hubs"};
        for (let i = 0; i < HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR; ++i)
        {
            expect(await HelperChatUtil.getRefusal("agent-1", true)).toBeUndefined();
            await HelperChatUtil.reply(i % 2 == 0 ? SOME_HELPER : other, "agent-1", "Agent: hi");
        }
        expect(await HelperChatUtil.getRefusal("agent-1", true)).toBe("hourlyLimit");
        expect(await HelperChatUtil.getRefusal("agent-2", true)).toBeUndefined();
    });

    it("pays for replies from the day's budget, at what the API says each took, and stops once it is spent",
        async () => {
        claude.usage = tenthOfBudgetUsage();

        expect(await replyUntilRefused()).toBe(10);
        expect(await HelperChatUtil.getRefusal("someone-new", false)).toBe("dayLimit");
        expect(claude.requests).toHaveLength(10);
    });

    it("keeps the day's spending through a restart, and has a new budget the next day", async () => {
        claude.usage = tenthOfBudgetUsage();
        for (let i = 0; i < 4; ++i)
        {
            expect(await HelperChatUtil.getRefusal(`early-${i}`, false)).toBeUndefined();
            await HelperChatUtil.reply(SOME_HELPER, `early-${i}`, "Person: hi");
        }
        await HelperChatUtil.saveSpending(true);
        expect(_spending.byDate.get(today())).toBe(4 * claude.usage.input_tokens * HELPER_MODEL_PRICES.input);

        // A restart: whatever was in memory is gone, and the day's spending is read back.
        HelperChatUtil.reset();
        expect(await replyUntilRefused()).toBe(6);

        vi.setSystemTime(new Date(`${today()}T23:59:59Z`).getTime() + 1000);
        expect(await HelperChatUtil.getRefusal("tomorrow", false)).toBeUndefined();
    });

    it("pays for nothing while the day's spending can't be read, and reads it again a minute later", async () => {
        _spending.failing = true;
        expect(await HelperChatUtil.getRefusal("someone", false)).toBe("dayLimit");

        _spending.failing = false;
        expect(await HelperChatUtil.getRefusal("someone", false)).toBe("dayLimit");
        vi.setSystemTime(Date.now() + 60_000);
        expect(await HelperChatUtil.getRefusal("someone", false)).toBeUndefined();
    });

    it("saves what it spent within half a minute, and the rest as it stops", async () => {
        standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await live(6);

        await talk(alice, "hi!");
        await live(3);
        const oneReply = Math.ceil(REPLY_USAGE.input_tokens * HELPER_MODEL_PRICES.input
            + REPLY_USAGE.output_tokens * HELPER_MODEL_PRICES.output);
        await live(31);
        expect(_spending.byDate.get(today())).toBe(oneReply);

        await talk(alice, "and again!");
        await live(3);
        await HelperAgentUtil.stop();
        expect(_spending.byDate.get(today())).toBe(2 * oneReply);
    });

    it("without a model only greets, and tells whoever talks to it so, once", async () => {
        delete process.env.ANTHROPIC_API_KEY;
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await live(6);
        const greeted = saidBy(mira).length;

        await talk(alice, "hi!");
        await live(4);
        await talk(alice, "hello?");
        await live(4);

        expect(claude.requests).toEqual([]);
        expect(saidBy(mira).slice(greeted)).toEqual(["Sorry, I can only say hello for now. Have fun exploring!"]);
    });

    it("says nothing when a reply fails, and logs the failure", async () => {
        const logSpy = vi.spyOn(LogUtil, "log");
        claude.failing = true;
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await live(6);
        const greeted = saidBy(mira).length;

        await talk(alice, "hi!");
        await live(4);

        expect(saidBy(mira).slice(greeted)).toEqual([]);
        expect(logSpy.mock.calls.some(([title]) => title == "Helper reply failed")).toBe(true);
    });

    it("walks up to someone it answers from a little way off, never past its leash, and home again a while after, "
        + "while the room keeps it at home", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home);
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 11));
        await live(6);

        await talk(alice, "over here!");
        await live(8);
        const met = helperIn(FIRST_HUB_ID, mira).at;
        const them = playerOf(alice.user.id).transform.pos;
        expect(across(met, home)).toBeGreaterThan(2);
        expect(across(met, home)).toBeLessThanOrEqual(5.01);
        expect(across(met, them)).toBeLessThan(across(home, them));
        expect(shown.some(({signalType, signal}) => signalType == "setObjectTransformSignal" && signal.objectId == mira))
            .toBe(true);
        expect(ServerRoomManager.roomRuntimeMemories[FIRST_HUB_ID].room.objectById[mira].transform.pos).toEqual(home);

        await live(45);
        expect(across(helperIn(FIRST_HUB_ID, mira).at, home)).toBeLessThan(0.05);
    });

    it("stands still a while at the home an admin moves it to, then wanders near it now and then", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const moved = inFrontOfEntrance(FIRST_HUB_ID, 6, -2);
        const room = ServerRoomManager.roomRuntimeMemories[FIRST_HUB_ID].room;
        room.objectById[mira].transform = new ObjectTransform({...moved}, {...UP}, {x: 1, y: 1, z: 1});
        await live(1);
        expect(helperIn(FIRST_HUB_ID, mira).at).toEqual(moved);

        shown.length = 0;
        await live(9);
        expect(shown.filter(({signal}) => signal.objectId == mira)).toEqual([]);

        const seen: Vec3[] = [];
        for (let i = 0; i < 120; ++i)
        {
            await live(1);
            seen.push(helperIn(FIRST_HUB_ID, mira).at);
        }
        expect(seen.some(at => across(at, moved) > 0.5)).toBe(true);
        expect(seen.every(at => across(at, moved) <= 2.6)).toBe(true);
    });

    it("walks round blocks in its way, never into one", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home);
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 10));
        // Then a wall across the way to her, three units out to each side.
        const room = ServerRoomManager.roomRuntimeMemories[FIRST_HUB_ID].room;
        const wall = inFrontOfEntrance(FIRST_HUB_ID, 7);
        const {dir} = entranceOf(FIRST_HUB_ID).transform;
        const row = VoxelQueryUtil.getVoxelRowFromWorldZ(wall.z);
        const col = VoxelQueryUtil.getVoxelColFromWorldX(wall.x);
        const facesAlongZ = Math.abs(dir.z) > Math.abs(dir.x);
        for (let offset = -6; offset <= 6; ++offset)
            room.voxelGrid.voxels[(facesAlongZ ? row : row + offset) * NUM_VOXEL_COLS + (facesAlongZ ? col + offset : col)]
                .blockLayerMask |= 0b1111111;
        const blocked = (at: Vec3) => (room.voxelGrid.voxels[VoxelQueryUtil.getVoxelRowFromWorldZ(at.z) * NUM_VOXEL_COLS
            + VoxelQueryUtil.getVoxelColFromWorldX(at.x)].blockLayerMask & 1) != 0;
        await live(6);
        expect(across(playerOf(alice.user.id).transform.pos, home)).toBeGreaterThan(5);

        await talk(alice, "come round here!");
        const walked: Vec3[] = [];
        for (let i = 0; i < 12; ++i)
        {
            await live(1);
            walked.push(helperIn(FIRST_HUB_ID, mira).at);
        }
        const met = walked[walked.length - 1];
        const along = (at: Vec3) => (at.x - home.x) * dir.x + (at.z - home.z) * dir.z;
        expect(along(met)).toBeGreaterThan(3.5);
        expect(walked.some(at => Math.abs((at.x - home.x) * dir.z - (at.z - home.z) * dir.x) > 2.5)).toBe(true);
        expect(walked.filter(blocked)).toEqual([]);
    });

    it("holds still for everyone while an admin holds it, the drop included, and goes on once let go", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home);
        await live(1);
        const admin = harness.connectUser({id: "id-Admin", userName: "Admin", userType: UserTypeEnumMap.Admin});
        await harness.joinRoom(admin, FIRST_HUB_ID);
        const member = await joinPerson("Member", "an");
        const hold = async (who: ConnectedUser, held: boolean) => {
            const bufferState = EncodingUtil.startEncoding();
            new HoldObjectSignal(FIRST_HUB_ID, mira, held).encode(bufferState);
            await UserSignalDispatchUtil.dispatch(who.socketUserContext, "holdObjectSignal",
                EncodingUtil.endEncoding(bufferState));
        };
        const moves = () => shown.filter(({signalType, signal}) => signal.objectId == mira
            && (signalType == "setObjectTransformSignal" || signal.metadataKey == ObjectMetadataKeyEnumMap.QuarterTurns));
        const alice = await joinPerson("Alice", "an");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 11));
        await live(8);

        // Held by the admin (a member's hold is no hold): it answers, but neither turns nor walks.
        await hold(member, true);
        await hold(admin, true);
        shown.length = 0;
        await talk(alice, "over here!");
        await live(8);
        expect(saidBy(mira)).toEqual(["Happy to help!"]);
        expect(moves()).toEqual([]);

        // Dropped somewhere else, still held: there it stays, past the while it would stand still after any move.
        const dropped = inFrontOfEntrance(FIRST_HUB_ID, 6, -2);
        ServerRoomManager.roomRuntimeMemories[FIRST_HUB_ID].room.objectById[mira].transform =
            new ObjectTransform({...dropped}, {...UP}, {x: 1, y: 1, z: 1});
        await live(25);
        await talk(alice, "and now?");
        await live(8);
        expect(moves()).toEqual([]);
        expect(helperIn(FIRST_HUB_ID, mira).at).toEqual(dropped);

        // Let go, it goes on.
        await hold(admin, false);
        await live(4);
        await talk(alice, "come here!");
        await live(8);
        expect(moves().length).toBeGreaterThan(0);
        expect(across(helperIn(FIRST_HUB_ID, mira).at, dropped)).toBeGreaterThan(1);
    });

    it("is let go of by an admin who leaves its room", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 4));
        await live(1);
        const admin = harness.connectUser({id: "id-Admin", userName: "Admin", userType: UserTypeEnumMap.Admin});
        await harness.joinRoom(admin, FIRST_HUB_ID);
        HelperAgentUtil.hold(admin.socketUserContext, new HoldObjectSignal(FIRST_HUB_ID, mira, true));
        const alice = await joinPerson("Alice", "an");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 11));
        await live(8);

        await harness.joinRoom(admin, LATER_HUB_ID);
        await live(5);
        shown.length = 0;
        await talk(alice, "over here!");
        await live(8);
        expect(shown.some(({signalType, signal}) => signalType == "setObjectTransformSignal" && signal.objectId == mira))
            .toBe(true);
    });

    it("tells someone who comes into its room where it stands, when that isn't home", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home);
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 11));
        await live(6);
        await talk(alice, "over here!");
        await live(10);
        expect(across(helperIn(FIRST_HUB_ID, mira).at, home)).toBeGreaterThan(1);

        const bob = await joinPerson("Bob", "an");
        await live(1);
        const toBob = shown.filter(({signalType, signal, userID}) => userID == bob.user.id && signal.objectId == mira
            && signalType == "setObjectTransformSignal");
        expect(toBob).toHaveLength(1);
        expect(toBob[0].signal.transform.pos).toEqual(helperIn(FIRST_HUB_ID, mira).at);
    });
});
