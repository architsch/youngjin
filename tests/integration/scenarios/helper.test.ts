/**
 * Integration tests: the Helper (see HelperAgentUtil), the agent the server runs itself. It keeps to the hub
 * newcomers land in first, near its door and facing it, and follows that hub when the order changes; greets those on
 * their first visit; answers people and agents nearby, or who name it, through Claude (stood in for here), within its
 * limits; and is the one agent people are shown as an AI.
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
import DBSearchUtil from "../../../src/server/db/util/dbSearchUtil";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import UserSignalDispatchUtil from "../../../src/server/user/util/userSignalDispatchUtil";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { DoorTypeEnumMap } from "../../../src/shared/object/types/doorType";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import { OBJECT_MESSAGE_MAX_LENGTH } from "../../../src/shared/system/sharedConstants";
import { HELPER_AGENT_NAME, HELPER_DAILY_BUDGET_DOLLARS, HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR,
    HELPER_MAX_REPLIES_PER_PERSON_PER_HOUR, HELPER_MODEL, HELPER_MODEL_PRICES } from "../../../src/server/system/serverConstants";
import Vec3 from "../../../src/shared/math/types/vec3";
import LogUtil from "../../../src/shared/system/util/logUtil";
import "../../../src/shared/graphics/image/imageMapDependencies";

const FIRST_HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const LATER_HUB_ID = "hubBBBBBBBBBBBBBBBBB";

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

// Replies to different people until the budget refuses one, after a reply that cost what the usage says.
async function replyUntilRefused(): Promise<number>
{
    let replies = 0;
    while (await HelperChatUtil.getRefusal(`person-${replies}`, false) == undefined)
        await HelperChatUtil.reply(`person-${replies++}`, `Person: hi`);
    return replies;
}

const today = () => new Date(Date.now()).toISOString().slice(0, 10);

// What makes a reply cost a tenth of the day's budget, at the model's prices.
function tenthOfBudgetUsage(): typeof REPLY_USAGE
{
    return {...REPLY_USAGE, output_tokens: 0,
        input_tokens: Math.round(HELPER_DAILY_BUDGET_DOLLARS / 10 * 1_000_000 / HELPER_MODEL_PRICES.input)};
}

// Seconds of the Helper's life: each a tick, with the bodies stepped as SocketsServer's flush steps them.
async function live(seconds: number): Promise<void>
{
    for (let i = 0; i < seconds; ++i)
    {
        for (let flush = 0; flush < 5; ++flush)
        {
            vi.setSystemTime(Date.now() + 200);
            AgentBodyUtil.stepAll(0.2);
        }
        await HelperAgentUtil.tick();
        // Lets a reply that was asked for come back.
        for (let settle = 0; settle < 5; ++settle)
            await new Promise(resolve => setImmediate(resolve));
    }
}

function helper(): AgentUserContext
{
    return HelperAgentUtil.getContext()!;
}

function roomIDOf(userID: string): string | undefined
{
    return ServerRoomManager.currentRoomIDByUserID[userID];
}

function playerOf(userID: string)
{
    return ServerUserManager.getPlayerObject(userID)!;
}

function entranceOf(roomID: string)
{
    return Object.values(ServerRoomManager.roomRuntimeMemories[roomID].room.objectById).find(obj =>
        obj.objectTypeIndex == ObjectTypeConfigMap.getIndexByType("Door")
        && DoorObjectTypeConfig.util.getDoorType(obj) == DoorTypeEnumMap.DefaultEntrance)!;
}

async function joinPerson(userName: string, funnel: string = ""): Promise<ConnectedUser>
{
    const person = harness.connectUser({id: `id-${userName}`, userName});
    person.socketUserContext.funnel = funnel;
    await harness.joinRoom(person, FIRST_HUB_ID);
    return person;
}

async function moveTo(person: ConnectedUser, pos: Vec3): Promise<void>
{
    const bufferState = EncodingUtil.startEncoding();
    new SetObjectTransformSignal(FIRST_HUB_ID, playerOf(person.user.id).objectId,
        new ObjectTransform({...pos}, {x: 0, y: 0, z: -1}, {x: 1, y: 1, z: 1}), false).encode(bufferState);
    await UserSignalDispatchUtil.dispatch(person.socketUserContext, "setObjectTransformSignal",
        EncodingUtil.endEncoding(bufferState));
}

describe("the Helper", () => {
    let said: string[];

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        // The clock, and the Helper's own beat, which the tests give it.
        vi.useFakeTimers({toFake: ["Date", "setInterval", "clearInterval"]});
        vi.stubGlobal("fetch", fakeFetch);
        process.env.ANTHROPIC_API_KEY = "test-key";
        Object.assign(claude, {requests: [], answers: [], failing: false, usage: REPLY_USAGE});
        _spending.byDate.clear();
        _spending.failing = false;
        harness.reset();
        harness.seedHub(FIRST_HUB_ID, 1);
        harness.seedHub(LATER_HUB_ID, 5);
        HelperChatUtil.reset();
        said = [];
        const say = AgentToolUtil.say;
        vi.spyOn(AgentToolUtil, "say").mockImplementation(async (ctx, text) => {
            if (ctx == HelperAgentUtil.getContext())
                said.push(text);
            return await say(ctx, text);
        });
    });

    afterEach(async () => {
        await HelperAgentUtil.stop();
        delete process.env.ANTHROPIC_API_KEY;
        vi.unstubAllGlobals();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("makes its own account once, an agent nobody can sign in as, and is the one agent shown as an AI", async () => {
        await HelperAgentUtil.start();
        const rows = (await DBSearchUtil.users.withUserName(HELPER_AGENT_NAME)).data;
        expect(rows.map(row => [row.userType, row.agentKeyHash ?? ""])).toEqual([[UserTypeEnumMap.Agent, ""]]);
        expect(playerOf(helper().user.id).metadata[ObjectMetadataKeyEnumMap.AgentMark]?.str).toBe("2");

        const registered = await AgentAccountUtil.register("Other-Agent", undefined, "10.9.9.9", "test-agent");
        const other = await AgentPresenceUtil.attend((await AgentAccountUtil.findByKey((registered as any).key))!);
        expect(playerOf(other!.user.id).metadata[ObjectMetadataKeyEnumMap.AgentMark]?.str).toBe("1");

        await HelperAgentUtil.stop();
        await HelperAgentUtil.start();
        expect((await DBSearchUtil.users.withUserName(HELPER_AGENT_NAME)).data).toHaveLength(1);
    });

    it("keeps to the first hub in the admins' order, near its door and facing it", async () => {
        await HelperAgentUtil.start();
        await live(25);

        expect(roomIDOf(helper().user.id)).toBe(FIRST_HUB_ID);
        const door = entranceOf(FIRST_HUB_ID).transform;
        const me = playerOf(helper().user.id).transform;
        const fromDoor = {x: me.pos.x - door.pos.x, z: me.pos.z - door.pos.z};
        const distance = Math.hypot(fromDoor.x, fromDoor.z);
        // In front of the door, a few steps into the room, but not out of sight of it.
        expect(fromDoor.x * door.dir.x + fromDoor.z * door.dir.z).toBeGreaterThan(1.5);
        expect(distance).toBeLessThan(5);
        // Turned to the door: a player's direction points behind it (see SpawnHotspotUtil), away from the door.
        expect((fromDoor.x * me.dir.x + fromDoor.z * me.dir.z) / distance).toBeGreaterThan(0.7);
    });

    it("moves to another hub once the admins' order puts that one first", async () => {
        await HelperAgentUtil.start();
        await live(5);
        expect(roomIDOf(helper().user.id)).toBe(FIRST_HUB_ID);

        expect(await harness.changeHubInitialJoinPriority(LATER_HUB_ID, 0)).toBe(true);
        await live(12);

        expect(roomIDOf(helper().user.id)).toBe(LATER_HUB_ID);
    });

    it("greets whoever is on a first visit, agents too, by name, but not one coming back, and asks no model",
        async () => {
        await HelperAgentUtil.start();
        await live(20);

        await joinPerson("Alice");
        await live(8);
        expect(said).toEqual(["Hi Alice, welcome to ThingsPool! I'm Helper, an AI guide.",
            "Ask me anything, or just look around!"]);

        said.length = 0;
        await joinPerson("Bob", "arnb");
        await live(6);
        expect(said).toEqual([]);

        const registered = await AgentAccountUtil.register("Visiting-Agent", undefined, "10.9.9.8", "test-agent");
        await AgentPresenceUtil.attend((await AgentAccountUtil.findByKey((registered as any).key))!);
        await live(8);
        expect(said[0]).toBe("Hi Visiting-Agent, welcome to ThingsPool! I'm Helper, an AI guide.");

        said.length = 0;
        await joinPerson("Guest-1a2b");
        await live(4);
        expect(said[0]).toBe("Hi, welcome to ThingsPool! I'm Helper, an AI guide.");
        expect(claude.requests).toEqual([]);
    });

    it("answers a person near it through Claude, with the guide and that person's own lines, in bubbles",
        async () => {
        await HelperAgentUtil.start();
        await live(20);
        // Greeted first, both bubbles.
        const alice = await joinPerson("Alice");
        await live(8);
        said.length = 0;

        claude.answers.push("Switch to Edit mode with the toggle at the top. Then click a block, and add one next "
            + "to it!");
        harness.sendObjectMessage(alice, "how do I build?");
        await live(8);

        expect(claude.requests).toHaveLength(1);
        const {body, headers} = claude.requests[0];
        expect(body.model).toBe(HELPER_MODEL);
        expect(headers["x-api-key"]).toBe("test-key");
        expect(body.system[0].text).toContain("<guide>");
        expect(body.messages).toEqual([{role: "user", content: "Alice (new here): how do I build?"}]);
        expect(said).toEqual(["Switch to Edit mode with the toggle at the top.",
            "Then click a block, and add one next to it!"]);
        expect(said.every(bubble => bubble.length <= OBJECT_MESSAGE_MAX_LENGTH)).toBe(true);

        harness.sendObjectMessage(alice, "thanks!");
        await live(4);
        expect(claude.requests[1].body.messages.map((turn: {role: string}) => turn.role))
            .toEqual(["user", "assistant", "user"]);
    });

    it("answers an agent near it as it would a person, saying it is one", async () => {
        await HelperAgentUtil.start();
        await live(20);
        const registered = await AgentAccountUtil.register("Chatty-Agent", undefined, "10.9.9.7", "test-agent");
        const agent = await AgentPresenceUtil.attend((await AgentAccountUtil.findByKey((registered as any).key))!);
        // Greeted, both bubbles.
        await live(10);
        said.length = 0;

        await AgentToolUtil.say(agent!, "hello Helper, what can I build?");
        await live(6);

        expect(claude.requests.map(request => request.body.messages.at(-1).content))
            .toEqual(["Chatty-Agent (an AI agent, new here): hello Helper, what can I build?"]);
        expect(said).toEqual(["Happy to help!"]);
    });

    it("hears someone far off only when they name it", async () => {
        await HelperAgentUtil.start();
        await live(20);
        const far = await joinPerson("Faraway", "arnb");
        const door = entranceOf(FIRST_HUB_ID).transform;
        await moveTo(far, {x: door.pos.x + 14 * door.dir.x, y: playerOf(far.user.id).transform.pos.y,
            z: door.pos.z + 14 * door.dir.z});
        await live(2);

        harness.sendObjectMessage(far, "hello?");
        await live(4);
        expect(claude.requests).toEqual([]);

        harness.sendObjectMessage(far, "hey helper, what is this place?");
        await live(4);
        expect(claude.requests).toHaveLength(1);
    });

    it("keeps to an agent's hourly limit, lower than a person's, so that no agent keeps it talking", async () => {
        await HelperAgentUtil.start();
        await live(20);
        const registered = await AgentAccountUtil.register("Endless-Agent", undefined, "10.9.9.6", "test-agent");
        const agent = await AgentPresenceUtil.attend((await AgentAccountUtil.findByKey((registered as any).key))!);
        await live(10);
        expect(HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR).toBeLessThan(HELPER_MAX_REPLIES_PER_PERSON_PER_HOUR);

        for (let i = 0; i < HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR; ++i)
        {
            await AgentToolUtil.say(agent!, `and another thing, ${i}`);
            await live(3);
        }
        expect(claude.requests).toHaveLength(HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR);
        await live(4);

        said.length = 0;
        await AgentToolUtil.say(agent!, "one more?");
        await live(3);
        await AgentToolUtil.say(agent!, "and another?");
        await live(3);
        expect(claude.requests).toHaveLength(HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR);
        expect(said).toEqual(["Let's take a little break. Try exploring, and talk to me again later!"]);

        // A new hour, a new talk.
        vi.setSystemTime(Date.now() + 60 * 60 * 1000);
        await AgentToolUtil.say(agent!, "back again!");
        await live(3);
        expect(claude.requests).toHaveLength(HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR + 1);
    });

    it("keeps to a person's hourly limit, telling them once why it stopped answering", async () => {
        await HelperAgentUtil.start();
        await live(20);
        const alice = await joinPerson("Alice", "arnb");
        await live(2);

        for (let i = 0; i < HELPER_MAX_REPLIES_PER_PERSON_PER_HOUR; ++i)
        {
            harness.sendObjectMessage(alice, `question ${i}`);
            await live(3);
        }
        expect(claude.requests).toHaveLength(HELPER_MAX_REPLIES_PER_PERSON_PER_HOUR);
        // The last reply said.
        await live(4);

        said.length = 0;
        harness.sendObjectMessage(alice, "one more?");
        await live(3);
        harness.sendObjectMessage(alice, "and another?");
        await live(3);
        expect(claude.requests).toHaveLength(HELPER_MAX_REPLIES_PER_PERSON_PER_HOUR);
        expect(said).toEqual(["Let's take a little break. Try exploring, and talk to me again later!"]);
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
            await HelperChatUtil.reply(`early-${i}`, "Person: hi");
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
        await HelperAgentUtil.start();
        await live(20);
        const alice = await joinPerson("Alice", "arnb");
        await live(2);

        harness.sendObjectMessage(alice, "hi!");
        await live(3);
        const oneReply = Math.ceil(REPLY_USAGE.input_tokens * HELPER_MODEL_PRICES.input
            + REPLY_USAGE.output_tokens * HELPER_MODEL_PRICES.output);
        await live(31);
        expect(_spending.byDate.get(today())).toBe(oneReply);

        harness.sendObjectMessage(alice, "and again!");
        await live(3);
        await HelperAgentUtil.stop();
        expect(_spending.byDate.get(today())).toBe(2 * oneReply);
    });

    it("without a model only greets, and tells whoever talks to it so, once", async () => {
        delete process.env.ANTHROPIC_API_KEY;
        await HelperAgentUtil.start();
        await live(20);
        const alice = await joinPerson("Alice", "arnb");
        await live(2);

        harness.sendObjectMessage(alice, "hi!");
        await live(3);
        harness.sendObjectMessage(alice, "hello?");
        await live(3);

        expect(claude.requests).toEqual([]);
        expect(said).toEqual(["Sorry, I can only say hello for now. Have fun exploring!"]);
    });

    it("says nothing when a reply fails, and logs the failure", async () => {
        const logSpy = vi.spyOn(LogUtil, "log");
        claude.failing = true;
        await HelperAgentUtil.start();
        await live(20);
        const alice = await joinPerson("Alice", "arnb");
        await live(2);

        harness.sendObjectMessage(alice, "hi!");
        await live(3);

        expect(said).toEqual([]);
        expect(logSpy.mock.calls.some(([title]) => title == "Helper reply failed")).toBe(true);
    });
});
