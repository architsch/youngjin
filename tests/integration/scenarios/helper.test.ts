/**
 * Integration tests: helpers (see HelperAgentUtil), the NPCs an admin stands in multiplayer rooms, which the server plays
 * as AI guides. Each keeps near where it was put, its home, which the room keeps it at while its steps, turns and speech
 * are only shown; greets each visitor as they come near, once a login; and answers people and agents nearby, or who name
 * it, through Claude (stood in for here), within limits every helper shares.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";

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
import HelperRouter from "../../../src/server/networking/router/api/helperRouter";
import { HELPER_PERSONALITIES } from "../../../src/server/agent/data/helperPersonalities";
import { HELPER_GUIDE } from "../../../src/server/agent/data/helperGuide";
import { HELPER_KNOWLEDGE } from "../../../src/server/agent/data/helperKnowledge";
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
import NpcFacingUtil from "../../../src/shared/object/util/npcFacingUtil";
import HoldObjectSignal from "../../../src/shared/object/types/holdObjectSignal";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import NpcPersonalityMap from "../../../src/shared/object/maps/npcPersonalityMap";
import HelperBehaviorUtil from "../../../src/shared/object/util/helperBehaviorUtil";
import AdminPrefsUtil from "../../../src/shared/object/util/adminPrefsUtil";
import MessageLinkUtil from "../../../src/shared/object/util/messageLinkUtil";
import { NPC_MESSAGE_MAX_LENGTH, NUM_VOXEL_COLS, OBJECT_MESSAGE_MAX_LENGTH, OBJECT_NAME_MAX_LENGTH,
    ROOM_EDITOR_SINGLE_PLAYER_MODE, SANDBOX_SINGLE_PLAYER_MODE,
    TUTORIAL_SINGLE_PLAYER_MODE } from "../../../src/shared/system/sharedConstants";
import { HELPER_DAILY_BUDGET_DOLLARS, HELPER_MAX_REPLIES_PER_AGENT_PER_HOUR,
    HELPER_MAX_REPLIES_PER_PERSON_PER_HOUR, HELPER_MODEL, HELPER_MODEL_PRICES } from "../../../src/server/system/serverConstants";
import Vec3 from "../../../src/shared/math/types/vec3";
import LogUtil from "../../../src/shared/system/util/logUtil";
import "../../../src/shared/graphics/image/imageMapDependencies";

const FIRST_HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const LATER_HUB_ID = "hubBBBBBBBBBBBBBBBBB";
const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");
const UP: Vec3 = {x: 0, y: 1, z: 0};
// A helper's walk ends on the grid vertex nearest where it was headed, at most half a cell's diagonal off.
const PATH_END_SLACK = 0.36;

// Claude, stood in for: what it was asked, the answers it gives in turn, the tokens it says each took, and what it waits
// for before it answers, if anything.
const REPLY_USAGE = {input_tokens: 1200, output_tokens: 30, cache_read_input_tokens: 0, cache_creation_input_tokens: 0};
const claude = {requests: [] as {body: any, headers: any}[], answers: [] as string[], failing: false,
    usage: REPLY_USAGE, thinking: undefined as Promise<void> | undefined};

async function fakeFetch(url: string | URL, init?: RequestInit): Promise<Response>
{
    if (!String(url).startsWith("https://api.anthropic.com/"))
        throw new Error(`Unexpected fetch of ${url}`);
    claude.requests.push({body: JSON.parse(init?.body as string), headers: init?.headers});
    await claude.thinking;
    if (claude.failing)
        return new Response("overloaded", {status: 529});
    return new Response(JSON.stringify({content: [{type: "text", text: claude.answers.shift() ?? "Happy to help!"}],
        usage: claude.usage}), {status: 200, headers: {"content-type": "application/json"}});
}

const SOME_HELPER: HelperIdentity = {key: "room/npc", name: "Mira", place: "one of the public hubs",
    personality: "guide"};

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

// An NPC an admin stood on a room's floor (by default a little in from the entrance), as the room keeps it, with any
// other values the admin gave it.
let npcCounter = 0;
function standNpc(roomID: string, name: string, at?: Vec3, quarterTurns: number = 0,
    values: {[metadataKey: number]: string} = {}): string
{
    const objectId = `npc${++npcCounter}`;
    const position = at ?? inFrontOfEntrance(roomID, 3, 1.5);
    ServerRoomManager.roomRuntimeMemories[roomID].room.objectById[objectId] = new AddObjectSignal(roomID, "admin",
        "Admin", NPC_TYPE_INDEX, objectId, new ObjectTransform({...position}, {...UP}, {x: 1, y: 1, z: 1}), {
            [ObjectMetadataKeyEnumMap.Label]: new EncodableByteString(name),
            [ObjectMetadataKeyEnumMap.QuarterTurns]: new EncodableByteString(QuarterTurnsUtil.encode(quarterTurns)),
            ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, new EncodableByteString(value)])),
        });
    return objectId;
}

// Gives a helper's NPC a value as an admin's edit leaves it in the room.
function setNpcValue(roomID: string, objectId: string, metadataKey: number, value: string): void
{
    ServerRoomManager.roomRuntimeMemories[roomID].room.objectById[objectId].metadata[metadataKey] =
        new EncodableByteString(value);
}

// What a helper has said, bubble by bubble, as the room was shown it (not what a newcomer was told it is saying).
function saidBy(objectId: string): string[]
{
    return shown.filter(({signalType, signal, userID}) => userID == undefined && signalType == "setObjectMetadataSignal"
        && signal.objectId == objectId && signal.metadataKey == ObjectMetadataKeyEnumMap.SentMessage
        && signal.metadataValue != "").map(({signal}) => signal.metadataValue);
}

// The ways a helper was shown facing, in turn, as the room was shown it (see NpcFacingUtil).
function facingsOf(objectId: string): number[]
{
    return shown.filter(({signalType, signal, userID}) => userID == undefined && signalType == "setObjectMetadataSignal"
        && signal.objectId == objectId && signal.metadataKey == ObjectMetadataKeyEnumMap.Facing)
        .map(({signal}) => NpcFacingUtil.decode(signal.metadataValue)!);
}

// Whether a helper was shown thinking of an answer, in turn, as the room was shown it.
function thinkingOf(objectId: string): string[]
{
    return shown.filter(({signalType, signal, userID}) => userID == undefined && signalType == "setObjectMetadataSignal"
        && signal.objectId == objectId && signal.metadataKey == ObjectMetadataKeyEnumMap.Thinking)
        .map(({signal}) => signal.metadataValue);
}

// Or the way it was put to face, if it hasn't been shown turning.
function lastFacingOf(objectId: string, quarterTurns: number = 0): number
{
    const facings = facingsOf(objectId);
    return facings[facings.length - 1] ?? facingPut(quarterTurns);
}

function degreesToward(from: Vec3, to: Vec3): number
{
    return NpcFacingUtil.getDegrees({x: to.x - from.x, y: 0, z: to.z - from.z});
}

// How far, in degrees, a facing at one point is from the way toward another.
function offFrom(facing: number, from: Vec3, to: Vec3): number
{
    return Math.abs(NpcFacingUtil.getTurn(facing, degreesToward(from, to)));
}

// The way an NPC put with these turns faces (see QuarterTurnsUtil).
function facingPut(quarterTurns: number): number
{
    return NpcFacingUtil.getDegrees(QuarterTurnsUtil.getContentUp(UP, quarterTurns));
}

// A person's line, sent as their browser sends it.
async function talk(person: ConnectedUser, text: string): Promise<void>
{
    await setOwnValue(person, ObjectMetadataKeyEnumMap.SentMessage, text);
}

// A value of a person's own player, set as their browser sets it.
async function setOwnValue(person: ConnectedUser, metadataKey: number, value: string): Promise<void>
{
    const bufferState = EncodingUtil.startEncoding();
    new SetObjectMetadataSignal(ServerRoomManager.currentRoomIDByUserID[person.user.id], playerOf(person.user.id).objectId,
        metadataKey, value).encode(bufferState);
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

// Moves a person this far into the first hub from its entrance, and then this far to one side: out of the doorway
// first, whose sides would stop the move across.
async function walkIn(person: ConnectedUser, distance: number, side: number = 0): Promise<void>
{
    await moveTo(person, inFrontOfEntrance(FIRST_HUB_ID, distance));
    if (side != 0)
        await moveTo(person, inFrontOfEntrance(FIRST_HUB_ID, distance, side));
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
        // The clock, and the helpers' own beat, which the tests give them. Noon (UTC), so no test's day ends as it runs.
        vi.useFakeTimers({toFake: ["Date", "setInterval", "clearInterval"]});
        vi.setSystemTime(new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`));
        vi.stubGlobal("fetch", fakeFetch);
        process.env.ANTHROPIC_API_KEY = "test-key";
        Object.assign(claude, {requests: [], answers: [], failing: false, usage: REPLY_USAGE, thinking: undefined});
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
        expect(saidBy(mira)).toEqual(["Hi Alice, welcome to ThingsPool! I'm Mira. Ask me anything, or just "
            + "look around!"]);

        // Out and in again, and a refresh, in the same login.
        await harness.disconnectUser(alice);
        await live(2);
        await joinPerson("Alice");
        await live(6);
        expect(saidBy(mira)).toHaveLength(1);

        // Back on another day: a new login, and one who has come back before.
        await harness.disconnectUser(harness.connectUser({id: "id-Alice", userName: "Alice"}));
        await joinPerson("Alice", "an", FIRST_HUB_ID, 1);
        await live(6);
        expect(saidBy(mira)[1]).toBe("Hi Alice, welcome back! I'm Mira. Ask me anything, or just look around!");
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
        expect(saidBy(mira)[0]).toBe("Hi, welcome to ThingsPool! I'm Mira. Ask me anything, or just look around!");
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

    it("turns to face whoever it greets, whichever way that is, and keeps them in view as they move", async () => {
        // Stood off to the side of the doorway, so that the arrival is off to one side of it.
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 1, 4));
        await live(1);
        const alice = await joinPerson("Alice");
        await live(4);
        const at = helperIn(FIRST_HUB_ID, mira).at;
        expect(offFrom(lastFacingOf(mira), at, playerOf(alice.user.id).transform.pos)).toBeLessThan(3);

        // Off at a slant, which none of the four ways an NPC is put to face would point at.
        await walkIn(alice, 4, 1);
        await live(1);
        expect(offFrom(lastFacingOf(mira), at, playerOf(alice.user.id).transform.pos)).toBeLessThan(3);
        expect(lastFacingOf(mira) % 90).not.toBe(0);

        // Done speaking (its greeting read), it keeps her in view while she stays near.
        await live(5);
        expect(saidBy(mira)).toHaveLength(1);
        await walkIn(alice, 5, -1);
        await live(1);
        expect(offFrom(lastFacingOf(mira), at, playerOf(alice.user.id).transform.pos)).toBeLessThan(3);
        expect(facingsOf(mira).length).toBeLessThan(10);
    });

    it("greeting several at once, looks at each in turn while it speaks", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 4));
        await live(1);
        const alice = await joinPerson("Alice");
        const bob = await joinPerson("Bob");
        const carol = await joinPerson("Carol");
        await walkIn(alice, 6, 3);
        await walkIn(bob, 6, -3);
        await walkIn(carol, 7);
        shown.length = 0;
        await live(6);

        expect(saidBy(mira)).toHaveLength(1);
        expect(saidBy(mira)[0]).toMatch(/^Hi everyone,/);
        const at = helperIn(FIRST_HUB_ID, mira).at;
        const toward = (person: ConnectedUser) => degreesToward(at, playerOf(person.user.id).transform.pos);
        expect(Math.abs(NpcFacingUtil.getTurn(toward(alice), toward(carol)))).toBeGreaterThan(30);
        expect(Math.abs(NpcFacingUtil.getTurn(toward(bob), toward(carol)))).toBeGreaterThan(30);
        const looks = facingsOf(mira).map(facing => [alice, bob, carol].findIndex(person =>
            offFrom(facing, at, playerOf(person.user.id).transform.pos) < 3));
        expect(looks.filter((person, i) => person >= 0 && person != looks[i - 1])).toEqual([0, 1, 2]);
    });

    it("looks at whoever it answers, one at a time, and at whoever talks to it while it's free", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 4));
        await live(1);
        const alice = await joinPerson("Alice", "an");
        const bob = await joinPerson("Bob", "an");
        // Near enough that it answers each where it stands; Bob the nearer, whom it keeps in view once it has greeted
        // them.
        await walkIn(alice, 6, 2);
        await walkIn(bob, 5.5, -2);
        await live(10);
        claude.answers = ["Hello Alice!", "Hello Bob!"];
        const facingAt = (person: ConnectedUser) => offFrom(lastFacingOf(mira), helperIn(FIRST_HUB_ID, mira).at,
            playerOf(person.user.id).transform.pos);
        expect(offFrom(degreesToward(helperIn(FIRST_HUB_ID, mira).at, playerOf(alice.user.id).transform.pos),
            helperIn(FIRST_HUB_ID, mira).at, playerOf(bob.user.id).transform.pos)).toBeGreaterThan(60);

        // Free, it turns to Alice as she talks, before it answers.
        expect(facingAt(bob)).toBeLessThan(3);
        await talk(alice, "hi Mira!");
        await live(1);
        expect(facingAt(alice)).toBeLessThan(3);
        expect(claude.requests).toHaveLength(0);

        // Bob talks to it while it answers her: it keeps to her until it is done, then turns to him to answer.
        await live(2);
        expect(saidBy(mira)).toContain("Hello Alice!");
        await talk(bob, "hello?");
        await live(1);
        expect(facingAt(alice)).toBeLessThan(3);
        // Thinking of what to say to him while she reads what it said to her (his answer shown only as this ends).
        await live(2);
        expect(claude.requests).toHaveLength(2);
        expect(facingAt(alice)).toBeLessThan(3);
        await live(3);
        expect(saidBy(mira)).toContain("Hello Bob!");
        expect(facingAt(bob)).toBeLessThan(3);
    });

    it("answers a person near it through Claude: the rules, guide and knowledge cached, then its name, place and "
        + "character, and that person's own lines, in one bubble", async () => {
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
        expect(body.system[0].text).toContain(HELPER_GUIDE);
        expect(body.system[0].text).toContain(HELPER_KNOWLEDGE);
        expect(body.system[0].cache_control).toEqual({type: "ephemeral"});
        // A guide, as one an admin has picked no character for is.
        expect(body.system[1].text).toBe("Your name is Mira. You stand in the main hub, the public room newcomers arrive "
            + `in.\n\nYour character: ${HELPER_PERSONALITIES.guide.character}`);
        expect(body.messages).toEqual([{role: "user", content: "Alice (new here): how do I build?"}]);
        expect(saidBy(mira).slice(1)).toEqual(["Switch to Edit mode with the toggle at the top. Then click a block, and "
            + "add one next to it!"]);

        await talk(alice, "thanks!");
        await live(6);
        expect(claude.requests[1].body.messages.map((turn: {role: string}) => turn.role))
            .toEqual(["user", "assistant", "user"]);
    });

    it("gives an address in a reply only as a link, and cuts a long reply short without cutting one", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice");
        await live(8);

        claude.answers.push("Read it at https://thingspool.net/essays/page-12.html, it's funny!");
        await talk(alice, "anything to read?");
        await live(6);
        expect(saidBy(mira).at(-1)).toBe("Read it at <link href=\"https://thingspool.net/essays/page-12.html\">"
            + "thingspool.net</link>, it's funny!");

        const kept = `${"Cats are great. ".repeat(11)}See <link href="https://thingspool.net/">this essay</link> now.`;
        claude.answers.push(`${kept} More words here.`);
        await talk(alice, "more?");
        await live(20);
        const said = saidBy(mira).at(-1)!;
        expect(MessageLinkUtil.getVisibleLength(`${kept} More words here.`)).toBeGreaterThan(NPC_MESSAGE_MAX_LENGTH);
        expect(said).toBe(kept);
        expect(claude.requests[1].body.messages.at(-1)).toEqual({role: "user", content: "Alice (new here): more?"});
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
        expect(toBo.system[1].text).toBe("Your name is Bo. You stand in one of the public hubs.\n\nYour character: "
            + HELPER_PERSONALITIES.guide.character);
        expect(toBo.messages).toEqual([{role: "user", content: "Alice (new here): hi Bo!"}]);
    });

    it("greets and answers in the character an admin picked for it, under the rules and guide every helper shares",
        async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", undefined, 0, {[ObjectMetadataKeyEnumMap.Personality]: "jester"});
        const bo = standNpc(LATER_HUB_ID, "Bo");
        await live(1);
        const alice = await joinPerson("Alice");
        await live(8);
        expect(saidBy(mira)).toEqual(["Hi Alice, welcome to ThingsPool! I'm Mira. Ask me anything. Some of "
            + "my answers are even serious!"]);
        await talk(alice, "what is this place?");
        await live(6);
        await harness.joinRoom(alice, LATER_HUB_ID);
        await live(8);
        expect(saidBy(bo)).toEqual(["Hi Alice, welcome to ThingsPool! I'm Bo. Ask me anything, or just look "
            + "around!"]);
        await talk(alice, "hi Bo!");
        await live(6);

        const [toMira, toBo] = claude.requests.map(request => request.body);
        expect(toMira.system[0]).toEqual(toBo.system[0]);
        expect(toMira.system[1].text).toContain(`Your character: ${HELPER_PERSONALITIES.jester.character}`);
        expect(toBo.system[1].text).toContain(`Your character: ${HELPER_PERSONALITIES.guide.character}`);

        // Another picked, it plays that one from then on.
        setNpcValue(FIRST_HUB_ID, mira, ObjectMetadataKeyEnumMap.Personality, "sage");
        await harness.joinRoom(alice, FIRST_HUB_ID);
        await live(6);
        await talk(alice, "Mira, are you still there?");
        await live(6);
        expect(claude.requests).toHaveLength(3);
        expect(claude.requests[2].body.system[1].text).toContain(`Your character: ${HELPER_PERSONALITIES.sage.character}`);
    });

    it("has a character to play for every personality an admin is offered that is played, each greeting a crowd in one "
        + "bubble", () => {
        const played = NpcPersonalityMap.getEntries().map(entry => entry.id).filter(NpcPersonalityMap.isPlayed);
        expect(played.sort()).toEqual(Object.keys(HELPER_PERSONALITIES).sort());
        for (const personality of played)
        {
            const helper = {...HelperBehaviorUtil.create(new AddObjectSignal("room", "admin", "Admin", NPC_TYPE_INDEX, "npc",
                new ObjectTransform({x: 0, y: 0, z: 0}, {...UP}, {x: 1, y: 1, z: 1}), {}), 0),
                name: "n".repeat(OBJECT_NAME_MAX_LENGTH), personality};
            const greeting = HelperBehaviorUtil.getGreeting(helper, ["Alice", "Bob"], false);
            expect(greeting).toBe(`Hi everyone, welcome to ThingsPool! I'm ${helper.name}. `
                + NpcPersonalityMap.getInvitation(personality));
            expect(greeting.length).toBeLessThanOrEqual(NPC_MESSAGE_MAX_LENGTH);
            // One with no name says what it is.
            expect(HelperBehaviorUtil.getGreeting({...helper, name: ""}, ["Alice"], false))
                .toContain(`I'm an AI ${NpcPersonalityMap.getRole(personality)}.`);
        }
    });

    it("points helpers only at pages the site has, and gives a character as favorite reads only writings the knowledge "
        + "every helper shares describes", () => {
        const addresses = [...`${HELPER_GUIDE}\n${HELPER_KNOWLEDGE}`.matchAll(/https:\/\/thingspool\.net\/[^\s),"<>]*/g)]
            .map(match => match[0].replace(/\.$/, ""));
        expect(addresses.length).toBeGreaterThan(10);
        for (const address of addresses)
            expect(fs.existsSync(path.resolve(__dirname, "../../../public", new URL(address).pathname.slice(1))), address)
                .toBe(true);

        const knowledge = HELPER_KNOWLEDGE.replace(/\s+/g, " ");
        for (const [personality, {character}] of Object.entries(HELPER_PERSONALITIES))
        {
            const reads = character.replace(/\s+/g, " ").match(/Favorite reads?[^:]*: (.*?) Voice:/)?.[1] ?? "";
            const titles = [...reads.matchAll(/"([^"]+)"/g)].map(match => match[1]);
            expect(titles.length, personality).toBeGreaterThan(0);
            for (const title of titles)
                expect(knowledge, `${personality}: ${title}`).toContain(`"${title}"`);
        }
    });

    it("answers an agent near it as it would a person, saying it is one, and greets it by name", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const agent = await registerAndAttend("Chatty-Agent", "10.9.9.7");
        await live(10);
        expect(saidBy(mira)[0]).toBe("Hi Chatty-Agent, welcome to ThingsPool! I'm Mira. Ask me anything, or "
            + "just look around!");

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

    it("plays no NPC whose personality isn't played: it neither greets, hears, walks nor turns", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 4), 0,
            {[ObjectMetadataKeyEnumMap.Personality]: "idle"});
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 6, 2);
        await live(6);
        await talk(alice, "hi Mira!");
        await talk(alice, "any helper around?");
        await live(60);

        expect(HelperAgentUtil.getHelpers(FIRST_HUB_ID)).toEqual([]);
        expect(shown.filter(({signal}) => signal.objectId == mira)).toEqual([]);
        expect(claude.requests).toEqual([]);
    });

    it("goes back home, the way it was put, and falls silent, once an admin makes it idle", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home);
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 11, 3);
        await live(6);
        await talk(alice, "over here!");
        await live(8);
        expect(across(helperIn(FIRST_HUB_ID, mira).at, home)).toBeGreaterThan(1);
        expect(saidBy(mira).at(-1)).toBe("Happy to help!");

        shown.length = 0;
        setNpcValue(FIRST_HUB_ID, mira, ObjectMetadataKeyEnumMap.Personality, "idle");
        await live(1);
        expect(HelperAgentUtil.getHelpers(FIRST_HUB_ID)).toEqual([]);
        const toRoom = shown.filter(({signal, userID}) => userID == undefined && signal.objectId == mira);
        expect(toRoom.filter(({signalType}) => signalType == "setObjectTransformSignal")
            .map(({signal}) => signal.transform.pos)).toEqual([home]);
        expect(toRoom.filter(({signal}) => signal.metadataKey == ObjectMetadataKeyEnumMap.SentMessage)
            .map(({signal}) => signal.metadataValue)).toEqual([""]);

        shown.length = 0;
        await talk(alice, "hello?");
        await live(30);
        expect(shown.filter(({signal}) => signal.objectId == mira)).toEqual([]);
        expect(claude.requests).toHaveLength(1);
    });

    it("answers a user in a single-player room for the helper their browser plays there, in its character", async () => {
        const alice = await joinPerson("Alice");
        const pip = {objectId: "npc", name: "Pip", personality: "jester"};
        expect(await HelperAgentUtil.answerAlone(alice.user.id, pip, "hi")).toBe("");

        await harness.joinRoom(alice, TUTORIAL_SINGLE_PLAYER_MODE);
        claude.answers.push("Hi Ana! Want a joke with that answer?");
        expect(await HelperAgentUtil.answerAlone(alice.user.id, pip, "hi there")).toBe("Hi Ana! Want a joke with that "
            + "answer?");
        const {body} = claude.requests[0];
        expect(body.system[1].text).toBe("Your name is Pip. You stand in a single-player room, where the visitor is on "
            + `their own with you.\n\nYour character: ${HELPER_PERSONALITIES.jester.character}`);
        expect(body.messages).toEqual([{role: "user", content: "Alice (new here): hi there"}]);

        // Nothing for an NPC that isn't played, however its personality is given, nor once the user has left the room.
        expect(await HelperAgentUtil.answerAlone(alice.user.id, {...pip, personality: "idle"}, "hi")).toBe("");
        await harness.joinRoom(alice, FIRST_HUB_ID);
        expect(await HelperAgentUtil.answerAlone(alice.user.id, pip, "still here?")).toBe("");
        expect(claude.requests).toHaveLength(1);
    });

    it("answers through its route only what a browser could ask: a few chat lines, for an NPC by its id and name",
        async () => {
        const alice = await joinPerson("Alice");
        await harness.joinRoom(alice, TUTORIAL_SINGLE_PLAYER_MODE);
        // Past the identification, as the user is known.
        const ask = async (body: object): Promise<{statusCode: number, body: unknown}> => {
            const route = (HelperRouter as any).stack.find((layer: any) => layer.route?.path == "/reply").route;
            const res: any = {statusCode: 200, status(code: number) { this.statusCode = code; return this; },
                send(data: unknown) { this.body = data; return this; }, json(data: unknown) { this.body = data; return this; }};
            await route.stack[route.stack.length - 1].handle({userString: alice.user.toString(), body}, res);
            return res;
        };
        const pip = {objectId: "npc", name: "Pip", personality: "jester"};
        claude.answers.push("Ha! Welcome aboard!");
        expect(await ask({...pip, text: "  hi there  "})).toMatchObject({statusCode: 200,
            body: {reply: "Ha! Welcome aboard!"}});
        expect(claude.requests[0].body.messages).toEqual([{role: "user", content: "Alice (new here): hi there"}]);

        for (const wrong of [{...pip, text: "x".repeat(4 * OBJECT_MESSAGE_MAX_LENGTH + 1)}, {...pip, text: "   "},
            {...pip, text: 7}, {...pip, objectId: undefined, text: "hi"},
            {...pip, name: "n".repeat(OBJECT_NAME_MAX_LENGTH + 1), text: "hi"}])
        {
            expect((await ask(wrong)).statusCode).toBe(400);
        }
        expect(claude.requests).toHaveLength(1);
    });

    it("answers nobody in a room being authored, and tells a single-player user why it can't answer, again only a "
        + "while later, within the limits every helper shares", async () => {
        const admin = harness.connectUser({id: "id-Admin", userName: "Admin", userType: UserTypeEnumMap.Admin});
        await harness.joinRoom(admin, ROOM_EDITOR_SINGLE_PLAYER_MODE);
        const pip = {objectId: "npc", name: "Pip", personality: "guide"};
        expect(await HelperAgentUtil.answerAlone(admin.user.id, pip, "hi")).toBe("");
        expect(claude.requests).toEqual([]);

        const alice = await joinPerson("Alice");
        await harness.joinRoom(alice, SANDBOX_SINGLE_PLAYER_MODE);
        for (let i = 0; i < HELPER_MAX_REPLIES_PER_PERSON_PER_HOUR; ++i)
            expect(await HelperAgentUtil.answerAlone(alice.user.id, pip, `question ${i}`)).toBe("Happy to help!");
        expect(await HelperAgentUtil.answerAlone(alice.user.id, pip, "one more")).toMatch(/^Let's take a little break/);
        expect(await HelperAgentUtil.answerAlone(alice.user.id, pip, "and another")).toBe("");
        vi.setSystemTime(Date.now() + 2 * 60_000 + 1000);
        expect(await HelperAgentUtil.answerAlone(alice.user.id, pip, "still there?")).toMatch(/^Let's take a little break/);
        expect(claude.requests).toHaveLength(HELPER_MAX_REPLIES_PER_PERSON_PER_HOUR);
    });

    it("never hears another helper, however near, so that helpers never talk to one another", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 3, 1.5));
        const bo = standNpc(FIRST_HUB_ID, "Bo", inFrontOfEntrance(FIRST_HUB_ID, 3, -1.5));
        await live(1);
        const alice = await joinPerson("Alice");
        await live(8);
        expect(saidBy(mira)).toHaveLength(1);
        expect(saidBy(bo)).toHaveLength(1);

        // One answers her, naming the other, and calling it a helper besides.
        claude.answers.push("Hello! Bo knows a lot too: ask Bo, the helper beside me.");
        await talk(alice, "Mira, hello!");
        await live(60);
        expect(saidBy(mira)).toHaveLength(2);
        expect(saidBy(bo)).toHaveLength(1);
        expect(claude.requests).toHaveLength(1);
    });

    it("says each reply whole in one bubble, links and all, longer than a person's, and gives it time to be read before "
        + "the next", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice");
        const bob = await joinPerson("Bob");
        await live(12);
        expect(saidBy(mira)).toHaveLength(1);

        // Read at the pace of what it shows, its link's label and not its address.
        const toAlice = "Agents can make rooms of their own, and anyone can visit them. If you run one, just give it "
            + "<link href=\"https://thingspool.net/skill.md\">the manual</link> and it can join right away.";
        expect(MessageLinkUtil.getVisibleLength(toAlice)).toBeGreaterThan(OBJECT_MESSAGE_MAX_LENGTH);
        claude.answers.push(toAlice, "Hi Bob!");
        await talk(alice, "can AIs play?");
        await live(3);
        expect(saidBy(mira).slice(1)).toEqual([toAlice]);

        // Bob's answer is ready in moments, but waits until hers has had time to be read, at an easy pace.
        await talk(bob, "hello!");
        await live(9);
        expect(claude.requests).toHaveLength(2);
        expect(saidBy(mira).slice(1)).toEqual([toAlice]);
        await live(4);
        expect(saidBy(mira).slice(1)).toEqual([toAlice, "Hi Bob!"]);
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
        expect(greetings[0]).toBe("Hi Alice, welcome to ThingsPool! I'm Mira. Ask me anything, or just look "
            + "around!");
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

    it("keeps to an agent's hourly limit, lower than a person's, telling it so (not at every line), and renews it the "
        + "next hour", async () => {
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
        const other: HelperIdentity = {key: "elsewhere/npc", name: "Bo", place: "one of the public hubs",
            personality: "guide"};
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

    it("without a model only greets, and tells whoever talks to it so, again only once a couple of minutes have passed",
        async () => {
        delete process.env.ANTHROPIC_API_KEY;
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await live(6);
        const greeted = saidBy(mira).length;
        const sorry = "Sorry, I can only say hello for now. Have fun exploring!";

        await talk(alice, "hi!");
        await live(4);
        await talk(alice, "hello?");
        await live(4);
        expect(saidBy(mira).slice(greeted)).toEqual([sorry]);

        // Still talking to it a while later, she is told again rather than met with silence.
        await live(100);
        await talk(alice, "how are you?");
        await live(4);
        expect(saidBy(mira).slice(greeted)).toEqual([sorry]);
        await live(20);
        await talk(alice, "what's your favorite food?");
        await live(4);
        expect(saidBy(mira).slice(greeted)).toEqual([sorry, sorry]);
        expect(claude.requests).toEqual([]);
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

    it("walks toward someone it answers from farther off, never past its wander radius, and home again a while after, "
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
        // As far as one an admin has set no radius for goes, give or take where a path's end falls.
        expect(across(met, home)).toBeGreaterThan(2);
        expect(across(met, home)).toBeLessThanOrEqual(3 + PATH_END_SLACK);
        expect(across(met, them)).toBeLessThan(across(home, them));
        expect(shown.some(({signalType, signal}) => signalType == "setObjectTransformSignal" && signal.objectId == mira))
            .toBe(true);
        expect(ServerRoomManager.roomRuntimeMemories[FIRST_HUB_ID].room.objectById[mira].transform.pos).toEqual(home);
        expect(offFrom(lastFacingOf(mira), met, them)).toBeLessThan(3);

        await live(45);
        expect(across(helperIn(FIRST_HUB_ID, mira).at, home)).toBeLessThan(0.05);
    });

    it("keeps a little way off from whom it answers: stays put for someone near, stops short of someone farther off",
        async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home, 0, {[ObjectMetadataKeyEnumMap.WanderRadius]: "8"});
        await live(1);
        // Bob is near it, though not so near that walking a little way short of him would take it nowhere, and off to one
        // side of the way to where Alice will be.
        const bob = await joinPerson("Bob", "an");
        await walkIn(bob, 6, -4);
        await live(6);
        await talk(bob, "hello!");
        await live(6);
        expect(saidBy(mira)).toContain("Happy to help!");
        expect(across(helperIn(FIRST_HUB_ID, mira).at, home)).toBeLessThan(0.05);

        const alice = await joinPerson("Alice", "an");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 11.5));
        await live(6);
        await talk(alice, "over here!");
        await live(8);
        const met = helperIn(FIRST_HUB_ID, mira).at;
        const her = playerOf(alice.user.id).transform.pos;
        expect(across(met, home)).toBeGreaterThan(2);
        expect(across(met, her)).toBeGreaterThan(3.5 - PATH_END_SLACK);
        expect(across(met, her)).toBeLessThan(across(home, her));
    });

    it("never steps up closer than a few steps to anyone in its way", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home, 0, {[ObjectMetadataKeyEnumMap.WanderRadius]: "8"});
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 11.5));
        const bob = await joinPerson("Bob", "an");
        await moveTo(bob, inFrontOfEntrance(FIRST_HUB_ID, 8.5));
        await live(6);

        await talk(alice, "over here!");
        const walked: Vec3[] = [];
        for (let i = 0; i < 10; ++i)
        {
            await live(1);
            walked.push(helperIn(FIRST_HUB_ID, mira).at);
        }
        const him = playerOf(bob.user.id).transform.pos;
        expect(walked.some(at => across(at, home) > 1)).toBe(true);
        expect(Math.min(...walked.map(at => across(at, him)))).toBeGreaterThanOrEqual(3);
    });

    it("walks on past an admin in ghost mode in its way, whom it doesn't see", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home, 0, {[ObjectMetadataKeyEnumMap.WanderRadius]: "8"});
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 11.5));
        const ghost = harness.connectUser({id: "id-Ghost", userName: "Ghost", userType: UserTypeEnumMap.Admin,
            playerMetadata: {[ObjectMetadataKeyEnumMap.AdminPrefs]: AdminPrefsUtil.encode({ghostMode: true})}});
        await harness.joinRoom(ghost, FIRST_HUB_ID);
        await moveTo(ghost, inFrontOfEntrance(FIRST_HUB_ID, 8.5));
        await live(6);

        await talk(alice, "over here!");
        const walked: Vec3[] = [];
        for (let i = 0; i < 10; ++i)
        {
            await live(1);
            walked.push(helperIn(FIRST_HUB_ID, mira).at);
        }
        const unseen = playerOf(ghost.user.id).transform.pos;
        expect(Math.min(...walked.map(at => across(at, unseen)))).toBeLessThan(3);
    });

    it("goes no farther from home than an admin sets, and nowhere at all when that is none", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 6);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home, 0, {[ObjectMetadataKeyEnumMap.WanderRadius]: "1"});
        await live(1);
        const seen: Vec3[] = [];
        for (let i = 0; i < 150; ++i)
        {
            await live(1);
            seen.push(helperIn(FIRST_HUB_ID, mira).at);
        }
        expect(seen.some(at => across(at, home) > 0.3)).toBe(true);
        expect(seen.every(at => across(at, home) <= 1 + PATH_END_SLACK)).toBe(true);

        // None: once home, it stays there, though called over from far off.
        setNpcValue(FIRST_HUB_ID, mira, ObjectMetadataKeyEnumMap.WanderRadius, "0");
        await live(30);
        const alice = await joinPerson("Alice", "an");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 13));
        await live(6);
        await talk(alice, "over here!");
        const after: Vec3[] = [];
        for (let i = 0; i < 90; ++i)
        {
            await live(1);
            after.push(helperIn(FIRST_HUB_ID, mira).at);
        }
        expect(saidBy(mira)).toContain("Happy to help!");
        expect(after.every(at => across(at, home) < 0.05)).toBe(true);
    });

    it("turns back the way it was put once it has been quiet a while at home", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 4));
        const alice = await joinPerson("Alice");
        await walkIn(alice, 6, 2);
        // So that the wander it goes on, as quiet as it is then, heads off a known way (toward the room's back wall).
        vi.spyOn(Math, "random").mockReturnValue(0.25);
        await live(6);
        const toAlice = degreesToward(helperIn(FIRST_HUB_ID, mira).at, playerOf(alice.user.id).transform.pos);
        expect(Math.abs(NpcFacingUtil.getTurn(lastFacingOf(mira), toAlice))).toBeLessThan(3);
        expect(Math.abs(NpcFacingUtil.getTurn(toAlice, facingPut(0)))).toBeGreaterThan(20);

        // She stays near, saying nothing.
        const looked = facingsOf(mira).length;
        await live(30);
        expect(facingsOf(mira).slice(looked)[0]).toBe(facingPut(0));
    });

    it("turns to whom it is thinking of an answer to as soon as its words to someone else have been read", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 4));
        await live(1);
        const alice = await joinPerson("Alice", "an");
        const bob = await joinPerson("Bob", "an");
        await walkIn(alice, 6, 2);
        await walkIn(bob, 6, -2);
        await live(10);
        const toAlice = "Hello Alice! The hub is where everyone arrives, so have a look around.";
        expect(toAlice.length).toBeLessThanOrEqual(OBJECT_MESSAGE_MAX_LENGTH);
        claude.answers = [toAlice, "Hello Bob!"];
        const facingAt = (person: ConnectedUser) => offFrom(lastFacingOf(mira), helperIn(FIRST_HUB_ID, mira).at,
            playerOf(person.user.id).transform.pos);
        await talk(alice, "hi Mira!");
        await live(3);
        expect(saidBy(mira)).toContain(toAlice);

        // Bob's answer is slow in coming: it thinks of it while she reads hers, looking at her until she has had time to.
        let answered = () => {};
        claude.thinking = new Promise(resolve => { answered = resolve; });
        await talk(bob, "hello?");
        await live(3);
        expect(claude.requests).toHaveLength(2);
        expect(facingAt(alice)).toBeLessThan(3);
        await live(4);
        expect(saidBy(mira)).not.toContain("Hello Bob!");
        expect(facingAt(bob)).toBeLessThan(3);

        answered();
        await live(2);
        expect(saidBy(mira)).toContain("Hello Bob!");
        expect(facingAt(bob)).toBeLessThan(3);
    });

    it("is shown thinking of an answer the moment it hears a line, before the pause it waits for", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await live(12);
        shown.length = 0;

        await talk(alice, "hi Mira!");
        expect(thinkingOf(mira)).toEqual(["1"]);
        expect(claude.requests).toEqual([]);
        await live(3);
        expect(claude.requests).toHaveLength(1);
    });

    it("stops being shown thinking once lines left waiting too long are let go, with nothing else to answer",
        async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice", "an");
        const bob = await joinPerson("Bob", "an");
        await live(12);
        let answered = () => {};
        claude.thinking = new Promise(resolve => { answered = resolve; });
        shown.length = 0;

        await talk(alice, "hi Mira!");
        await live(3);
        await talk(bob, "and me?");
        await live(65);
        expect(thinkingOf(mira)).toEqual(["1"]);

        // Alice's answer comes after Bob's line has been let go of, which leaves nothing to think of.
        answered();
        await live(3);
        expect(thinkingOf(mira)).toEqual(["1", ""]);
        expect(claude.requests).toHaveLength(1);
    });

    it("neither greets, hears nor turns to an admin in ghost mode, whom nobody sees, until they are seen again",
        async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const ghost = harness.connectUser({id: "id-Ghost", userName: "Ghost", userType: UserTypeEnumMap.Admin,
            playerMetadata: {[ObjectMetadataKeyEnumMap.AdminPrefs]: AdminPrefsUtil.encode({ghostMode: true})}});
        await harness.joinRoom(ghost, FIRST_HUB_ID);
        await live(6);
        await talk(ghost, "hi Mira!");
        await live(6);
        expect(saidBy(mira)).toEqual([]);
        expect(thinkingOf(mira)).toEqual([]);
        expect(facingsOf(mira)).toEqual([]);
        expect(claude.requests).toEqual([]);

        await setOwnValue(ghost, ObjectMetadataKeyEnumMap.AdminPrefs, AdminPrefsUtil.encode({ghostMode: false}));
        await live(3);
        expect(saidBy(mira)).toEqual([expect.stringMatching(/^Hi Ghost, welcome to ThingsPool!/)]);
    });

    it("is shown thinking of an answer, its last words still up, from when it hears a line until the answer is up",
        async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice", "an");
        const looker = await registerAndAttend("Looker", "10.0.0.9");
        await live(2);
        // Up for a good while yet (see HelperBehaviorUtil's pace).
        expect(saidBy(mira)).toEqual(["Hi everyone, welcome to ThingsPool! I'm Mira. Ask me anything, or just look "
            + "around!"]);
        const guideSeen = () => (AgentToolUtil.look(looker) as any).people.find((person: any) => person.name == "Mira");
        expect(guideSeen().thinking).toBeUndefined();

        let answered = () => {};
        claude.thinking = new Promise(resolve => { answered = resolve; });
        shown.length = 0;
        await talk(alice, "hi Mira, what is this place?");
        await live(3);
        expect(thinkingOf(mira)).toEqual(["1"]);
        expect(guideSeen().thinking).toBe(true);
        // Its greeting stays up meanwhile.
        expect(shown.filter(({signal}) => signal.objectId == mira
            && signal.metadataKey == ObjectMetadataKeyEnumMap.SentMessage)).toEqual([]);

        // An answer that comes while the greeting is still being read waits for it, and is thought of until it is up.
        answered();
        await live(2);
        expect(claude.requests).toHaveLength(1);
        expect(saidBy(mira)).toEqual([]);
        expect(thinkingOf(mira)).toEqual(["1"]);
        expect(guideSeen().thinking).toBe(true);
        await live(3);
        const toRoom = shown.filter(({signal, userID}) => userID == undefined && signal.objectId == mira
            && [ObjectMetadataKeyEnumMap.SentMessage, ObjectMetadataKeyEnumMap.Thinking].includes(signal.metadataKey))
            .map(({signal}) => [signal.metadataKey, signal.metadataValue]);
        expect(toRoom).toEqual([[ObjectMetadataKeyEnumMap.Thinking, "1"],
            [ObjectMetadataKeyEnumMap.SentMessage, "Happy to help!"], [ObjectMetadataKeyEnumMap.Thinking, ""]]);
        expect(guideSeen().thinking).toBeUndefined();
    });

    it("stops being shown thinking once it has nothing to say: a reply that fails, or a refusal it gave lately",
        async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await live(12);
        shown.length = 0;

        claude.failing = true;
        await talk(alice, "hello?");
        await live(4);
        expect(thinkingOf(mira)).toEqual(["1", ""]);

        delete process.env.ANTHROPIC_API_KEY;
        await talk(alice, "anyone there?");
        await live(12);
        await talk(alice, "hello??");
        await live(12);
        expect(saidBy(mira)).toEqual([expect.stringMatching(/^Sorry, I can only say hello/)]);
        expect(thinkingOf(mira)).toEqual(["1", "", "1", "", "1", ""]);
    });

    it("stops being shown thinking once an admin makes it idle as it thinks", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await live(6);
        claude.thinking = new Promise(() => {});
        await talk(alice, "hi Mira!");
        await live(3);
        expect(thinkingOf(mira)).toEqual(["1"]);

        setNpcValue(FIRST_HUB_ID, mira, ObjectMetadataKeyEnumMap.Personality, "idle");
        await live(1);
        expect(thinkingOf(mira)).toEqual(["1", ""]);
    });

    it("tells someone who comes into its room while it thinks of an answer that it is", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await live(6);
        claude.thinking = new Promise(() => {});
        await talk(alice, "hi Mira!");
        await live(3);

        const bob = await joinPerson("Bob", "an");
        await live(1);
        expect(shown.filter(({signal, userID}) => userID == bob.user.id && signal.objectId == mira
            && signal.metadataKey == ObjectMetadataKeyEnumMap.Thinking).map(({signal}) => signal.metadataValue))
            .toEqual(["1"]);
    });

    it("keeps looking at whom its words are for while they are read, and turns to the next with the next words",
        async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 4));
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 6, 2);
        await live(10);
        const answer = "Hello Alice! The hub is where everyone arrives, so have a look around.";
        expect(answer.length).toBeLessThanOrEqual(OBJECT_MESSAGE_MAX_LENGTH);
        claude.answers = [answer];
        const facingAt = (person: ConnectedUser) => offFrom(lastFacingOf(mira), helperIn(FIRST_HUB_ID, mira).at,
            playerOf(person.user.id).transform.pos);
        await talk(alice, "hi!");
        await live(3);
        expect(saidBy(mira)[saidBy(mira).length - 1]).toBe(answer);

        // Bob comes near as she reads it: his greeting waits for her to have read it, and so does the turn to him.
        const bob = await joinPerson("Bob", "an");
        await walkIn(bob, 6, -2);
        await live(2);
        expect(saidBy(mira)[saidBy(mira).length - 1]).toBe(answer);
        expect(facingAt(alice)).toBeLessThan(3);
        await live(6);
        expect(saidBy(mira).slice(-2)).toEqual([answer, expect.stringMatching(/^Hi Bob,/)]);
        expect(facingAt(bob)).toBeLessThan(3);
    });

    it("faces the way it walks, step by step, never one of four ways only", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home);
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 11, 3);
        await live(6);
        shown.length = 0;
        await talk(alice, "over here!");
        await live(8);

        // Each step against the way it was last shown facing as it took it.
        let facing: number | undefined = undefined;
        let from: Vec3 | undefined = undefined;
        const steps: {off: number, length: number}[] = [];
        for (const {signalType, signal, userID} of shown)
        {
            if (signal.objectId != mira || userID != undefined)
                continue;
            if (signalType == "setObjectMetadataSignal" && signal.metadataKey == ObjectMetadataKeyEnumMap.Facing)
                facing = NpcFacingUtil.decode(signal.metadataValue);
            else if (signalType == "setObjectTransformSignal")
            {
                const to = signal.transform.pos;
                if (from != undefined && facing != undefined && across(from, to) > 0.2)
                    steps.push({off: offFrom(facing, from, to), length: across(from, to)});
                from = to;
            }
        }
        expect(steps.length).toBeGreaterThan(3);
        // A step may round a bend in the path, which it faces past as it reaches it.
        expect(steps.filter(step => step.off > 45)).toEqual([]);
        expect(facingsOf(mira).some(degrees => degrees % 90 != 0)).toBe(true);
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
        expect(seen.every(at => across(at, moved) <= 3 + PATH_END_SLACK)).toBe(true);
    });

    it("walks round blocks in its way, never into one", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home, 0, {[ObjectMetadataKeyEnumMap.WanderRadius]: "8"});
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 10));
        // Then a wall across the way to her, three units out to each side.
        const room = ServerRoomManager.roomRuntimeMemories[FIRST_HUB_ID].room;
        const wall = inFrontOfEntrance(FIRST_HUB_ID, 5.5);
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
        expect(along(met)).toBeGreaterThan(2);
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
            && (signalType == "setObjectTransformSignal" || signal.metadataKey == ObjectMetadataKeyEnumMap.Facing));
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
        // Shown facing the way it was put, as the admin is shown it there; and then nothing of its own.
        await live(1);
        expect(lastFacingOf(mira)).toBe(facingPut(0));
        shown.length = 0;
        await live(24);
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

    it("stands at home, the way it was put, for everyone, as soon as an admin takes hold of it", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home);
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 11, 3);
        await live(6);
        await talk(alice, "over here!");
        await live(8);
        expect(across(helperIn(FIRST_HUB_ID, mira).at, home)).toBeGreaterThan(1);
        expect(lastFacingOf(mira)).not.toBe(facingPut(0));

        const admin = harness.connectUser({id: "id-Admin", userName: "Admin", userType: UserTypeEnumMap.Admin});
        await harness.joinRoom(admin, FIRST_HUB_ID);
        shown.length = 0;
        HelperAgentUtil.hold(admin.socketUserContext, new HoldObjectSignal(FIRST_HUB_ID, mira, true));
        expect(helperIn(FIRST_HUB_ID, mira).at).toEqual(home);
        expect(shown.filter(({signalType, signal, userID}) => userID == undefined && signal.objectId == mira
            && signalType == "setObjectTransformSignal").map(({signal}) => signal.transform.pos)).toEqual([home]);
        expect(facingsOf(mira)).toEqual([facingPut(0)]);
    });

    it("tells someone who comes into its room where it stands, when that isn't home", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home);
        await live(1);
        const alice = await joinPerson("Alice", "an");
        // Off to one side, so that it faces her the way it wasn't put to face.
        await walkIn(alice, 11, 3);
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
        // And which way it faces, since that isn't the way it was put either.
        const facingToBob = shown.filter(({signal, userID}) => userID == bob.user.id && signal.objectId == mira
            && signal.metadataKey == ObjectMetadataKeyEnumMap.Facing);
        expect(facingToBob).toHaveLength(1);
        expect(NpcFacingUtil.decode(facingToBob[0].signal.metadataValue)).toBe(lastFacingOf(mira));
        expect(lastFacingOf(mira)).not.toBe(facingPut(0));
    });

    it("turns, once an admin turns it, the way it was put, over the way it was facing", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 1, 4));
        await live(1);
        const alice = await joinPerson("Alice");
        await live(4);
        // Gone before it has looked away from where she was.
        await harness.joinRoom(alice, LATER_HUB_ID);
        await live(1);
        const quarterTurns = [1, 2, 3].find(turns =>
            Math.abs(NpcFacingUtil.getTurn(lastFacingOf(mira), facingPut(turns))) > 45)!;

        const room = ServerRoomManager.roomRuntimeMemories[FIRST_HUB_ID].room;
        room.objectById[mira].metadata[ObjectMetadataKeyEnumMap.QuarterTurns] =
            new EncodableByteString(QuarterTurnsUtil.encode(quarterTurns));
        await live(1);
        expect(lastFacingOf(mira)).toBe(facingPut(quarterTurns));
    });

    it("lets nobody set the way it faces or whether it is thinking, an admin included", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const admin = harness.connectUser({id: "id-Admin", userName: "Admin", userType: UserTypeEnumMap.Admin});
        await harness.joinRoom(admin, FIRST_HUB_ID);
        await live(1);
        const metadata = ServerRoomManager.roomRuntimeMemories[FIRST_HUB_ID].room.objectById[mira].metadata;
        const set = async (key: number, value: string) => {
            const bufferState = EncodingUtil.startEncoding();
            new SetObjectMetadataSignal(FIRST_HUB_ID, mira, key, value).encode(bufferState);
            await UserSignalDispatchUtil.dispatch(admin.socketUserContext, "setObjectMetadataSignal",
                EncodingUtil.endEncoding(bufferState));
        };
        shown.length = 0;

        await set(ObjectMetadataKeyEnumMap.Facing, "90");
        expect(metadata[ObjectMetadataKeyEnumMap.Facing]).toBeUndefined();
        expect(facingsOf(mira)).toEqual([]);
        await set(ObjectMetadataKeyEnumMap.Thinking, "1");
        expect(metadata[ObjectMetadataKeyEnumMap.Thinking]).toBeUndefined();
        expect(thinkingOf(mira)).toEqual([]);
        // As an admin's name for it is set, the same way.
        await set(ObjectMetadataKeyEnumMap.Label, "Mia");
        expect(metadata[ObjectMetadataKeyEnumMap.Label].str).toBe("Mia");
    });
});
