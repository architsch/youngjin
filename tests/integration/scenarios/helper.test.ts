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
import PlayerMessageExpiryUtil from "../../../src/server/user/util/playerMessageExpiryUtil";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import EncodableData from "../../../src/shared/networking/types/encodableData";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import RoomFile from "../../../src/shared/room/types/roomFile";
import SignalTypeConfigMap from "../../../src/shared/networking/maps/signalTypeConfigMap";
import DoorObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { DoorTypeEnumMap } from "../../../src/shared/object/types/doorType";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import QuarterTurnsUtil from "../../../src/shared/object/util/quarterTurnsUtil";
import NpcFacingUtil from "../../../src/shared/object/util/npcFacingUtil";
import HoldObjectSignal from "../../../src/shared/object/types/holdObjectSignal";
import TypingSignal from "../../../src/shared/user/types/typingSignal";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import NpcPersonalityMap from "../../../src/shared/object/maps/npcPersonalityMap";
import { NpcPersonality } from "../../../src/shared/object/types/npcPersonality";
import HelperBehaviorUtil, { HEARING_DISTANCE, MAX_SIGHTS } from "../../../src/shared/object/util/helperBehaviorUtil";
import AdminPrefsUtil from "../../../src/shared/object/util/adminPrefsUtil";
import BehaviorPrefsUtil from "../../../src/shared/object/util/behaviorPrefsUtil";
import BehaviorPrefs from "../../../src/shared/object/types/behaviorPrefs";
import { HELPER_SMALL_TALK } from "../../../src/server/agent/data/helperSmallTalk";
import { HELPER_TOPICS } from "../../../src/server/agent/data/helperTopics";
import { HELPER_REMARKS, REMARK_WORDS } from "../../../src/server/agent/data/helperRemarks";
import { HELPER_INTERESTS, HELPER_TASTES, UNREMARKED_KEYWORDS } from "../../../src/server/agent/data/helperTastes";
import HelperRemarkVoice from "../../../src/server/agent/types/helperRemarkVoice";
import HelperRemarkUtil from "../../../src/server/agent/util/helperRemarkUtil";
import DBUserUtil from "../../../src/server/db/util/dbUserUtil";
import { FTUEElementCodeEnumMap } from "../../../src/shared/user/types/ftueElementCode";
import FTUEElementUtil from "../../../src/shared/user/util/ftueElementUtil";
import MessageLinkUtil from "../../../src/shared/object/util/messageLinkUtil";
import { NPC_MESSAGE_MAX_LENGTH, NUM_VOXEL_COLS, OBJECT_MESSAGE_MAX_LENGTH, OBJECT_NAME_MAX_LENGTH,
    PLAYER_MESSAGE_EXPIRATION_MS, ROOM_EDITOR_SINGLE_PLAYER_MODE, SANDBOX_SINGLE_PLAYER_MODE,
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
const TOLD_BASICS = FTUEElementUtil.toChar(FTUEElementCodeEnumMap.Basics);
// What a helper's mood and the things on its mind come under, in a request for its reply (see HelperChatUtil).
const MOOD_HEADING = "Your mood today, for small talk:";
const TOPICS_HEADING = "On your mind today, only for when a visitor leaves the subject to you:";

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

// How an admin sets an NPC to be played (its BehaviorPrefs): these settings, the rest as they are by default.
function behaviorPrefs(changed: Partial<BehaviorPrefs>): {[metadataKey: number]: string}
{
    return {[ObjectMetadataKeyEnumMap.BehaviorPrefs]:
        BehaviorPrefsUtil.encode({...BehaviorPrefsUtil.decode(""), ...changed})};
}

// Changes how a helper's NPC is played, as an admin's edit leaves it in the room.
function setNpcPrefs(roomID: string, objectId: string, changed: Partial<BehaviorPrefs>): void
{
    setNpcValue(roomID, objectId, ObjectMetadataKeyEnumMap.BehaviorPrefs, BehaviorPrefsUtil.encode({
        ...BehaviorPrefsUtil.getObjectPrefs(ServerRoomManager.roomRuntimeMemories[roomID].room.objectById[objectId]),
        ...changed}));
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

// The helper a request for a reply is for, by the name it is told it has (see HelperChatUtil).
function heardBy(body: any): string | undefined
{
    return (body.system[1].text as string).match(/^Your name is (\w+)\./)?.[1];
}

// The things on a helper's mind that a request for its reply names (see HelperChatUtil).
function topicsIn(body: any): string[]
{
    const list: string = body.system[1].text.split(`\n\n${TOPICS_HEADING}\n`)[1] ?? "";
    return list.split("\n").filter(line => line.startsWith("- ")).map(line => line.slice(2));
}

// The mood a request for a helper's reply has it in for small talk (see HelperChatUtil).
function moodIn(body: any): string | undefined
{
    return (body.system[1].text as string).split(`\n\n${MOOD_HEADING} `)[1]?.split("\n")[0].replace(/\.$/, "");
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

// A person starting or stopping typing a line in the chat, as their browser tells it.
async function setTyping(person: ConnectedUser, typing: boolean): Promise<void>
{
    const bufferState = EncodingUtil.startEncoding();
    new TypingSignal(typing).encode(bufferState);
    await UserSignalDispatchUtil.dispatch(person.socketUserContext, "typingSignal", EncodingUtil.endEncoding(bufferState));
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

// Most come to a helper told how to walk and build already, by the tutorial (see FTUEElementCodeEnumMap.Basics), as
// joinPerson's do unless given a record without it.
async function joinPerson(userName: string, funnel: string = "", roomID: string = FIRST_HUB_ID,
    loginCount: number = 0, ftue: string = TOLD_BASICS): Promise<ConnectedUser>
{
    const person = harness.connectUser({id: `id-${userName}`, userName});
    person.socketUserContext.funnel = funnel;
    person.socketUserContext.loginCount = loginCount;
    person.user.ftue = ftue;
    await harness.joinRoom(person, roomID);
    return person;
}

// An admin, long since told how to play.
function connectAdmin(): ConnectedUser
{
    const admin = harness.connectUser({userType: UserTypeEnumMap.Admin, id: "id-Admin", userName: "Admin"});
    admin.user.ftue = TOLD_BASICS;
    return admin;
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

// Turns a person's player where it stands to face a floor point, as their browser sends it: its transform points behind
// it (see SpawnHotspotUtil).
async function turnToward(person: ConnectedUser, floor: Vec3, roomID: string = FIRST_HUB_ID): Promise<void>
{
    const {pos} = playerOf(person.user.id).transform;
    const behind = {x: pos.x - floor.x, z: pos.z - floor.z};
    const length = Math.hypot(behind.x, behind.z);
    const bufferState = EncodingUtil.startEncoding();
    new SetObjectTransformSignal(roomID, playerOf(person.user.id).objectId, new ObjectTransform({...pos},
        {x: behind.x / length, y: 0, z: behind.z / length}, {x: 1, y: 1, z: 1}), false).encode(bufferState);
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

// Every line a voice has for what it looks at, and its own words for the gaps (see HelperRemarkVoice).
function remarkLinesOf(voice: HelperRemarkVoice): string[]
{
    return [...voice.love, ...voice.like, ...voice.meh, ...voice.dislike, ...voice.mixed,
        ...Object.values(voice.kinds).flatMap(lines => [...(lines?.liked ?? []), ...(lines?.disliked ?? [])]),
        ...Object.values(voice.words ?? {}).flat()];
}

// Each picture the picture map's manifest lists, and its own keywords.
const PICTURE_MANIFEST: {images: {path: string, author: string, title: string, keywords?: string,
    disabled?: boolean}[]} = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    "../../../public/app/assets/pictures/manifest.json"), "utf8"));
function keywordsOf(picture: {keywords?: string}): string[]
{
    return (picture.keywords ?? "").split(",").map(keyword => keyword.trim()).filter(keyword => keyword.length > 0);
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

    it("tells whoever it greets who was never told how to walk and build, in its own words after its greeting, once for "
        + "good, whichever helper tells them", async () => {
        vi.mocked(DBUserUtil.setFTUE).mockClear();
        const mira = standNpc(FIRST_HUB_ID, "Mira", undefined, 0, behaviorPrefs({personality: "jester"}));
        const bo = standNpc(LATER_HUB_ID, "Bo");
        await live(1);
        // One who skipped the tutorial, and one it taught, come near together.
        const alice = await joinPerson("Alice", "", FIRST_HUB_ID, 0, "");
        const bob = await joinPerson("Bob");
        await live(20);
        expect(saidBy(mira)).toEqual(["Hi everyone, welcome to ThingsPool! I'm Mira. Ask me anything. Some of my answers "
            + "are even serious!", NpcPersonalityMap.getBasics("jester")]);
        // Kept for her at once, and in her row; nothing for him.
        expect(FTUEElementUtil.has(alice.user.ftue, FTUEElementCodeEnumMap.Basics)).toBe(true);
        expect(vi.mocked(DBUserUtil.setFTUE).mock.calls).toEqual([[alice.user.id, alice.user.ftue]]);
        expect(bob.user.ftue).toBe(TOLD_BASICS);

        // No other helper tells her again, nor does any once she is back another day, her row read again.
        await harness.joinRoom(alice, LATER_HUB_ID);
        await live(8);
        expect(saidBy(bo)).toEqual(["Hi Alice, welcome to ThingsPool! I'm Bo. Ask me anything, or just look around!"]);
        await harness.disconnectUser(alice);
        await live(2);
        await joinPerson("Alice", "an", FIRST_HUB_ID, 1, vi.mocked(DBUserUtil.setFTUE).mock.calls[0][1]);
        await live(8);
        expect(saidBy(mira).slice(2)).toEqual(["Hi Alice, welcome back! I'm Mira. Ask me anything. Some of my answers are "
            + "even serious!"]);
        expect(vi.mocked(DBUserUtil.setFTUE)).toHaveBeenCalledTimes(1);
        expect(claude.requests).toEqual([]);
    });

    it("tells Claude whether each person speaking has been told how to play, as things stand when it answers, and never "
        + "their name, which it would put in every reply", async () => {
        standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        // Too far off to have been greeted, and told, yet.
        const far = await joinPerson("Faraway", "", FIRST_HUB_ID, 0, "");
        await moveTo(far, inFrontOfEntrance(FIRST_HUB_ID, 18));
        const taught = await joinPerson("Taught");
        await moveTo(taught, inFrontOfEntrance(FIRST_HUB_ID, 17));
        await live(2);
        await talk(far, "Mira, what is this place?");
        await live(6);
        await talk(taught, "Mira, hello!");
        await live(6);
        expect(claude.requests.map(request => request.body.messages.at(-1).content)).toEqual([
            "(not yet told how to play) Mira, what is this place?", "(knows how to play) Mira, hello!"]);
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
        // A guide, as one an admin has picked no character for is, in one of a guide's moods and with a few of its
        // things on its mind.
        expect(body.system[1].text).toBe("Your name is Mira. You stand in the main hub, the public room newcomers arrive "
            + `in.\n\nYour character: ${HELPER_PERSONALITIES.guide.character}\n\n${MOOD_HEADING} ${moodIn(body)}.\n\n`
            + `${TOPICS_HEADING}\n${topicsIn(body).map(topic => `- ${topic}`).join("\n")}`);
        expect(HELPER_PERSONALITIES.guide.moods).toContain(moodIn(body));
        expect(topicsIn(body)).toHaveLength(3);
        expect(topicsIn(body).every(topic => HELPER_TOPICS.guide.includes(topic))).toBe(true);
        expect(body.messages).toEqual([{role: "user", content: "(knows how to play) how do I build?"}]);
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
        expect(claude.requests[1].body.messages.at(-1)).toEqual({role: "user", content: "(knows how to play) more?"});
    });

    it("asks once more for a shorter reply where the cut would leave its link out, and says the first, cut, if that one "
        + "loses its link too", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice");
        await live(8);

        const essay = "<link href=\"https://thingspool.net/essays/page-12.html\">read it</link>";
        const long = `${"Cats are great. ".repeat(11)}Try "Domestication", a funny essay: ${essay}.`;
        const shorter = `Try "Domestication", a funny essay by Youngjin about cats: ${essay}.`;
        expect(MessageLinkUtil.getVisibleLength(long)).toBeGreaterThan(NPC_MESSAGE_MAX_LENGTH);
        claude.answers.push(long, shorter);
        await talk(alice, "anything to read?");
        await live(8);
        expect(saidBy(mira).at(-1)).toBe(shorter);
        expect(claude.requests).toHaveLength(2);
        expect(claude.requests[1].body.messages).toEqual(claude.requests[0].body.messages);
        expect(claude.requests[1].body.system.slice(0, 2)).toEqual(claude.requests[0].body.system);
        expect(claude.requests[1].body.system[2].text).toContain("one sentence");

        claude.answers.push(long, `${"Dogs are great. ".repeat(12)}Try "Flatland": ${essay}.`);
        await talk(alice, "and another?");
        await live(8);
        expect(saidBy(mira).at(-1)).toBe(MessageLinkUtil.shorten(long, NPC_MESSAGE_MAX_LENGTH));
        expect(claude.requests).toHaveLength(4);
    });

    it("asks once more for a fuller reply where the first only says what it can't do or doesn't know, and says the "
        + "first if that one is no better", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const alice = await joinPerson("Alice");
        await live(8);

        const fuller = "I can't know tomorrow's weather, but here is a fact: a falling raindrop is shaped more like a "
            + "hamburger bun than a tear.";
        claude.answers.push("I can't know tomorrow's weather, sorry.", fuller);
        await talk(alice, "will it rain tomorrow?");
        await live(8);
        expect(saidBy(mira).at(-1)).toBe(fuller);
        expect(claude.requests).toHaveLength(2);
        expect(claude.requests[1].body.messages).toEqual(claude.requests[0].body.messages);
        expect(claude.requests[1].body.system[2].text).toContain("must not stop at what you can't do");

        claude.answers.push("I don't know her, sorry.", "I don't know Minji.");
        await talk(alice, "do you know my friend Minji?");
        await live(8);
        expect(saidBy(mira).at(-1)).toBe("I don't know her, sorry.");
        expect(claude.requests).toHaveLength(4);

        // A short reply that refuses nothing is said as it is.
        claude.answers.push("Hello again! Good to see you.");
        await talk(alice, "hello!");
        await live(8);
        expect(saidBy(mira).at(-1)).toBe("Hello again! Good to see you.");
        expect(claude.requests).toHaveLength(5);
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
        expect(toBo.system[1].text.startsWith("Your name is Bo. You stand in one of the public hubs.\n\nYour character: "
            + `${HELPER_PERSONALITIES.guide.character}\n\n${MOOD_HEADING} `)).toBe(true);
        expect(toBo.messages).toEqual([{role: "user", content: "(knows how to play) hi Bo!"}]);
    });

    it("greets and answers in the character an admin picked for it, under the rules and guide every helper shares",
        async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", undefined, 0, behaviorPrefs({personality: "jester"}));
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
        setNpcPrefs(FIRST_HUB_ID, mira, {personality: "sage"});
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
            const behavior = HelperBehaviorUtil.create(new AddObjectSignal("room", "admin", "Admin", NPC_TYPE_INDEX, "npc",
                new ObjectTransform({x: 0, y: 0, z: 0}, {...UP}, {x: 1, y: 1, z: 1}), {}), 0);
            const helper = {...behavior, name: "n".repeat(OBJECT_NAME_MAX_LENGTH), prefs: {...behavior.prefs, personality}};
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

    it("names no keyboard key in anything a helper is told or says, since many play on phones, and tells the basics in "
        + "one bubble in every played character's words", () => {
        const keys = /\bCtrl\b|\bShift\b|\bEsc\b|\bW, ?A, ?S, ?D\b|arrow keys|keyboard|\b(press|hit) (the )?([A-Z]|Enter|Space)\b|\b[A-Z] key\b/i;
        const played = NpcPersonalityMap.getEntries().map(entry => entry.id).filter(NpcPersonalityMap.isPlayed);
        const smallTalk = Object.values(HELPER_SMALL_TALK).flatMap(voice => [...voice.hellos, ...voice.nods,
            ...voice.goodbyes, ...voice.openers.flatMap(opener => [opener.text, opener.then ?? ""]),
            ...Object.values(voice.answers).flat()]);
        for (const text of [HELPER_GUIDE, HELPER_KNOWLEDGE, ...Object.values(HELPER_PERSONALITIES).flatMap(
            ({character, moods}) => [character, ...moods]), ...played.flatMap(personality => [
            NpcPersonalityMap.getInvitation(personality), NpcPersonalityMap.getBasics(personality)]), ...smallTalk,
            ...Object.values(HELPER_TOPICS).flat(), ...Object.values(HELPER_REMARKS).flatMap(remarkLinesOf),
            ...Object.values(REMARK_WORDS).flat()])
        {
            expect(text, text).not.toMatch(keys);
        }
        for (const personality of played)
        {
            expect(NpcPersonalityMap.getBasics(personality), personality).toMatch(/walk/);
            expect(MessageLinkUtil.getVisibleLength(NpcPersonalityMap.getBasics(personality)), personality)
                .toBeLessThanOrEqual(NPC_MESSAGE_MAX_LENGTH);
        }
    });

    it("shows each control it names as its picture, written as a bubble keeps it, and never says where on the screen one "
        + "is", async () => {
        standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        await talk(await joinPerson("Alice"), "Mira, how do I build?");
        await live(6);
        const played = NpcPersonalityMap.getEntries().map(entry => entry.id).filter(NpcPersonalityMap.isPlayed);
        const smallTalk = Object.values(HELPER_SMALL_TALK).flatMap(voice => [...voice.hellos, ...voice.nods,
            ...voice.goodbyes, ...voice.openers.flatMap(opener => [opener.text, opener.then ?? ""]),
            ...Object.values(voice.answers).flat()]);
        const pictures: string[] = [];
        // The rules, the guide and the knowledge, as every helper is told them, then the rest.
        for (const text of [claude.requests[0].body.system[0].text as string,
            ...Object.values(HELPER_PERSONALITIES).flatMap(({character, moods}) => [character, ...moods]),
            ...played.flatMap(personality => [NpcPersonalityMap.getInvitation(personality),
            NpcPersonalityMap.getBasics(personality)]), ...smallTalk, ...Object.values(HELPER_TOPICS).flat()])
        {
            pictures.push(...[...text.matchAll(/<control\b[^>]*>/gi)].map(match => match[0]));
            expect(text, text).not.toMatch(
                /\b(top|bottom)[ -](right|left)\b|\bon the (right|left)\b|\b(top|bottom|edge|corner) of the screen\b/i);
        }
        expect(pictures.length).toBeGreaterThan(10);
        for (const written of pictures)
        {
            const segments = MessageLinkUtil.parse(written);
            expect(segments.map(segment => segment.kind), written).toEqual(["control"]);
            expect(MessageLinkUtil.format(segments), written).toBe(written);
        }
        for (const personality of played)
        {
            expect(MessageLinkUtil.parse(NpcPersonalityMap.getBasics(personality)), personality)
                .toContainEqual({kind: "control", control: "modeSwitch"});
        }
    });

    it("gives every played character many things of its own on its mind, each true to the site: links only to its pages, "
        + "a word or two each", () => {
        const played = NpcPersonalityMap.getEntries().map(entry => entry.id).filter(NpcPersonalityMap.isPlayed);
        expect(Object.keys(HELPER_TOPICS).sort()).toEqual(played.sort());
        const all = Object.values(HELPER_TOPICS).flat();
        expect(new Set(all).size).toBe(all.length);
        for (const [personality, topics] of Object.entries(HELPER_TOPICS))
        {
            expect(topics.length, personality).toBeGreaterThanOrEqual(25);
            for (const topic of topics)
            {
                expect(topic.replace(/<link href="[^"]+">[^<]+<\/link>/g, ""), topic).not.toMatch(/[<>]|https?:/);
                for (const [, address, words] of topic.matchAll(/<link href="([^"]+)">([^<]+)<\/link>/g))
                {
                    expect(fs.existsSync(path.resolve(__dirname, "../../../public", new URL(address).pathname.slice(1))),
                        address).toBe(true);
                    expect(words.split(" ").length, topic).toBeLessThanOrEqual(2);
                }
            }
        }
    });

    it("gives every played character a few moods of its own to make small talk from, none shared", () => {
        const all = Object.values(HELPER_PERSONALITIES).flatMap(({moods}) => moods);
        expect(new Set(all).size).toBe(all.length);
        for (const [personality, {moods}] of Object.entries(HELPER_PERSONALITIES))
        {
            expect(moods.length, personality).toBeGreaterThanOrEqual(6);
            // Each follows "Your mood today, for small talk:", which a period ends.
            for (const mood of moods)
                expect(mood, mood).toMatch(/^[a-z][^.!?<>]*[^.!?<> ]$/);
        }
    });

    it("has a mood and a few things on its mind in each talk, the same all through it, picked anew once an admin "
        + "changes its character", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", undefined, 0, behaviorPrefs({personality: "explorer"}));
        await live(1);
        const alice = await joinPerson("Alice");
        await live(8);
        await talk(alice, "hi!");
        await live(6);
        await talk(alice, "tell me something");
        await live(6);
        const [first, second] = claude.requests.map(request => topicsIn(request.body));
        expect(first).toHaveLength(3);
        expect(new Set(first).size).toBe(3);
        expect(first.every(topic => HELPER_TOPICS.explorer.includes(topic))).toBe(true);
        expect(second).toEqual(first);
        const mood = moodIn(claude.requests[0].body);
        expect(HELPER_PERSONALITIES.explorer.moods).toContain(mood);
        expect(moodIn(claude.requests[1].body)).toBe(mood);

        setNpcPrefs(FIRST_HUB_ID, mira, {personality: "curator"});
        await live(2);
        await talk(alice, "and now?");
        await live(6);
        expect(claude.requests).toHaveLength(3);
        expect(topicsIn(claude.requests[2].body).every(topic => HELPER_TOPICS.curator.includes(topic))).toBe(true);
        expect(HELPER_PERSONALITIES.curator.moods).toContain(moodIn(claude.requests[2].body));
        // Still the same talk, so it remembers what was said.
        expect(claude.requests[2].body.messages).toHaveLength(5);
    });

    it("answers an agent near it as it would a person, saying it is one, and greets it by name, never telling it how to "
        + "walk and build, which it does through tools", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira");
        await live(1);
        const agent = await registerAndAttend("Chatty-Agent", "10.9.9.7");
        await live(10);
        expect(saidBy(mira)).toEqual(["Hi Chatty-Agent, welcome to ThingsPool! I'm Mira. Ask me anything, or "
            + "just look around!"]);

        await AgentToolUtil.say(agent, "hello, what can I build?");
        await live(6);
        expect(claude.requests.map(request => request.body.messages.at(-1).content))
            .toEqual(["(an AI agent) hello, what can I build?"]);
        expect(saidBy(mira).at(-1)).toBe("Happy to help!");
    });

    it("lets an agent hear a control it shows as the control's words, a picture being nothing to an agent", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", undefined, 0, behaviorPrefs({personality: "jester"}));
        await live(1);
        const agent = await registerAndAttend("Watching-Agent", "10.9.9.8");
        await live(10);
        AgentToolUtil.whatsNew(agent);
        await joinPerson("Alice", "", FIRST_HUB_ID, 0, "");
        const basics = NpcPersonalityMap.getBasics("jester");
        for (let second = 0; second < 30 && saidBy(mira).at(-1) != basics; ++second)
            await live(1);

        const heard = basics.replace("<control name=\"modeSwitch\"/>", "[Play/Edit switch]");
        expect(heard).not.toBe(basics);
        expect((AgentToolUtil.look(agent) as any).people.find((person: any) => person.name == "Mira").saying).toBe(heard);
        expect((AgentToolUtil.whatsNew(agent) as any).events.filter((event: any) => event.kind == "speech")
            .map((event: any) => event.text)).toContain(heard);
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

    it("hears a line no helper heard as it was said once its speaker comes near while it is still up, and only once",
        async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 4), 0,
            behaviorPrefs({wanderRadius: 0}));
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 18);
        await live(2);

        await talk(alice, "how do I build?");
        await live(4);
        expect(claude.requests).toEqual([]);
        expect(thinkingOf(mira)).toEqual([]);

        await walkIn(alice, 8);
        await live(1);
        expect(thinkingOf(mira)).toEqual(["1"]);
        await live(3);
        expect(claude.requests.map(request => request.body.messages.at(-1).content))
            .toEqual(["(knows how to play) how do I build?"]);

        // Walking off and back again with it still up brings no second answer.
        await walkIn(alice, 18);
        await live(2);
        await walkIn(alice, 8);
        await live(6);
        expect(claude.requests).toHaveLength(1);
    });

    it("hears, of what someone said that no helper heard, only what is still up as they come near, and that once",
        async () => {
        standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 4), 0, behaviorPrefs({wanderRadius: 0}));
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 18);
        await live(2);
        const comeNear = async () => {
            await walkIn(alice, 8);
            await live(6);
            await walkIn(alice, 18);
            await live(2);
        };
        const asked = () => claude.requests.map(request => request.body.messages.at(-1).content);

        // Cleared, or its time up (see PlayerMessageExpiryUtil).
        await talk(alice, "hello?");
        await talk(alice, "");
        await comeNear();
        await talk(alice, "anyone?");
        vi.setSystemTime(Date.now() + PLAYER_MESSAGE_EXPIRATION_MS);
        PlayerMessageExpiryUtil.expireAll();
        await comeNear();
        expect(asked()).toEqual([]);

        // Said over: the last line alone.
        await talk(alice, "first");
        await talk(alice, "second");
        await comeNear();
        expect(asked()).toEqual(["(knows how to play) second"]);

        // Said again where it is heard at once, before a beat: heard that once.
        await talk(alice, "hello?");
        await walkIn(alice, 8);
        await talk(alice, "hello?");
        await live(6);
        expect(asked()).toEqual(["(knows how to play) second", "(knows how to play) hello?"]);
    });

    it("hears a line no helper heard from someone who comes near still saying it from another room, but not one said "
        + "before a reconnect", async () => {
        standNpc(FIRST_HUB_ID, "Mira", undefined, 0, behaviorPrefs({wanderRadius: 0}));
        await live(1);
        // The later hub has no helper.
        const alice = await joinPerson("Alice", "an", LATER_HUB_ID);
        await talk(alice, "where is everyone?");
        await live(2);
        expect(claude.requests).toEqual([]);

        // Through a door, still saying it, to the entrance Mira stands by: a beat between the rooms, as while the next
        // one loads.
        await ServerRoomManager.changeUserRoom(alice.socketUserContext, undefined, true, true, false);
        await live(1);
        await harness.joinRoom(alice, FIRST_HUB_ID);
        expect(playerOf(alice.user.id).metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str).toBe("where is everyone?");
        await live(4);
        expect(claude.requests.map(request => request.body.messages.at(-1).content))
            .toEqual(["(knows how to play) where is everyone?"]);

        // Still up after the reconnect, but said on the connection before it.
        const bob = await joinPerson("Bob", "an", LATER_HUB_ID);
        await talk(bob, "hello?");
        await harness.joinRoom(await harness.reconnectCaseB(bob), FIRST_HUB_ID);
        expect(playerOf(bob.user.id).metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str).toBe("hello?");
        await live(6);
        expect(claude.requests).toHaveLength(1);
    });

    it("is heard, of the helpers in earshot, as the one the speaker faces, though another is nearer, and of two about "
        + "as much in front, as the nearer", async () => {
        const still = behaviorPrefs({wanderRadius: 0});
        const mira = inFrontOfEntrance(FIRST_HUB_ID, 6, 2);
        const bo = inFrontOfEntrance(FIRST_HUB_ID, 11);
        standNpc(FIRST_HUB_ID, "Mira", mira, 0, still);
        standNpc(FIRST_HUB_ID, "Bo", bo, 0, still);
        await live(1);
        const alice = await joinPerson("Alice");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 6));
        await live(10);

        // Mira is beside her, two steps off; Bo is ahead, five off.
        await turnToward(alice, bo);
        await talk(alice, "how do I build?");
        await live(6);
        await turnToward(alice, mira);
        await talk(alice, "and how do I chat?");
        await live(6);
        expect(claude.requests.map(request => heardBy(request.body))).toEqual(["Bo", "Mira"]);

        // Cy, between her and Bo, a little off the way to him, is about as much in front, and nearer.
        standNpc(FIRST_HUB_ID, "Cy", inFrontOfEntrance(FIRST_HUB_ID, 8.5, 0.3), 0, still);
        await live(10);
        await turnToward(alice, bo);
        await talk(alice, "what should I build?");
        await live(6);
        expect(heardBy(claude.requests.at(-1).body)).toBe("Cy");
    });

    it("stands still for whoever near it types it a line, wherever it was going, facing them, and goes on a while after "
        + "they stop", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home, 0, behaviorPrefs({minIdleTime: 1, maxIdleTime: 1}));
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 8, 2);
        const moves = () => shown.filter(({signalType, signal}) => signalType == "setObjectTransformSignal"
            && signal.objectId == mira).length;
        // Greeted, and then left to wander off once quiet a while, as it soon does.
        await live(40);
        expect(saidBy(mira)).toEqual([expect.stringMatching(/^Hi Alice, welcome/)]);
        expect(moves()).toBeGreaterThan(0);

        await setTyping(alice, true);
        const typedAt = moves();
        await live(40);
        expect(moves()).toBe(typedAt);
        expect(helperIn(FIRST_HUB_ID, mira).waitingFor).toBe("Alice");
        expect(offFrom(lastFacingOf(mira), helperIn(FIRST_HUB_ID, mira).at, playerOf(alice.user.id).transform.pos))
            .toBeLessThan(3);

        // Stopped without a word, she is no longer waited on: it stays a while, as after a talk, then goes on.
        await setTyping(alice, false);
        expect(helperIn(FIRST_HUB_ID, mira).waitingFor).toBeUndefined();
        await live(25);
        expect(moves()).toBe(typedAt);
        await live(30);
        expect(moves()).toBeGreaterThan(typedAt);
    });

    it("waits, of the helpers near someone typing, on the one their line would be for, the one they face, and never on "
        + "one out of earshot, a ghost or one gone", async () => {
        const still = behaviorPrefs({wanderRadius: 0});
        const miraAt = inFrontOfEntrance(FIRST_HUB_ID, 6, 2);
        const boAt = inFrontOfEntrance(FIRST_HUB_ID, 11);
        const mira = standNpc(FIRST_HUB_ID, "Mira", miraAt, 0, still);
        const bo = standNpc(FIRST_HUB_ID, "Bo", boAt, 0, still);
        await live(1);
        const waitingFor = () => [helperIn(FIRST_HUB_ID, mira).waitingFor, helperIn(FIRST_HUB_ID, bo).waitingFor];
        const alice = await joinPerson("Alice");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 6));
        await live(10);
        // A cleared bubble is no line.
        await talk(alice, "");
        await live(3);
        expect(thinkingOf(mira)).toEqual([]);
        expect(thinkingOf(bo)).toEqual([]);

        // Mira is beside her, two steps off; Bo is ahead, five off. Turning as she types, she is waited on by the one
        // she faces at once, or at its next beat.
        await turnToward(alice, boAt);
        await setTyping(alice, true);
        expect(waitingFor()).toEqual([undefined, "Alice"]);
        await turnToward(alice, miraAt);
        await live(1);
        expect(waitingFor()).toEqual(["Alice", undefined]);
        await setTyping(alice, false);
        expect(waitingFor()).toEqual([undefined, undefined]);

        const far = await joinPerson("Faraway");
        await moveTo(far, inFrontOfEntrance(FIRST_HUB_ID, 20));
        const ghost = harness.connectUser({id: "id-Ghost", userName: "Ghost", userType: UserTypeEnumMap.Admin,
            playerMetadata: {[ObjectMetadataKeyEnumMap.AdminPrefs]: AdminPrefsUtil.encode({ghostMode: true})}});
        await harness.joinRoom(ghost, FIRST_HUB_ID);
        await moveTo(ghost, inFrontOfEntrance(FIRST_HUB_ID, 6, 1));
        await setTyping(far, true);
        await setTyping(ghost, true);
        await live(1);
        expect(waitingFor()).toEqual([undefined, undefined]);

        await setTyping(alice, true);
        expect(waitingFor()).toEqual(["Alice", undefined]);
        await harness.disconnectUser(alice);
        await live(1);
        expect(waitingFor()).toEqual([undefined, undefined]);
    });

    it("is heard, called for from anywhere in the room, as the helper the caller faces, though another is nearer",
        async () => {
        const still = behaviorPrefs({wanderRadius: 0});
        const mira = inFrontOfEntrance(FIRST_HUB_ID, 11, 6);
        const bo = inFrontOfEntrance(FIRST_HUB_ID, 8);
        standNpc(FIRST_HUB_ID, "Mira", mira, 0, still);
        standNpc(FIRST_HUB_ID, "Bo", bo, 0, still);
        await live(1);
        // Out of earshot of both: Mira eleven steps off, Bo twelve.
        const far = await joinPerson("Faraway");
        await moveTo(far, inFrontOfEntrance(FIRST_HUB_ID, 20));
        await live(2);

        await turnToward(far, bo);
        await talk(far, "helper, how do I build?");
        await live(8);
        await turnToward(far, mira);
        await talk(far, "helper, and how do I chat?");
        await live(8);
        expect(claude.requests.map(request => heardBy(request.body))).toEqual(["Bo", "Mira"]);
    });

    it("is heard by an agent as the guide it faces, which it turns to by name", async () => {
        const still = behaviorPrefs({wanderRadius: 0});
        standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 3, 2.5), 0, still);
        standNpc(FIRST_HUB_ID, "Bo", inFrontOfEntrance(FIRST_HUB_ID, 6, -2.5), 0, still);
        await live(1);
        const agent = await registerAndAttend("Turning-Agent", "10.9.9.9");
        await live(10);

        for (const name of ["Mira", "Bo"])
        {
            const turned = AgentToolUtil.face(agent, {person: name});
            await live(2);
            expect(await turned).toMatchObject({outcome: "arrived"});
            expect(await AgentToolUtil.say(agent, `hello, ${name == "Mira" ? "what is this place" : "who are you"}?`))
                .toMatchObject({heardBy: name});
            await live(8);
        }
        expect(claude.requests.map(request => heardBy(request.body))).toEqual(["Mira", "Bo"]);
    });

    it("plays no NPC whose personality isn't played: it neither greets, hears, walks nor turns", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 4), 0,
            behaviorPrefs({personality: "idle"}));
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
        setNpcPrefs(FIRST_HUB_ID, mira, {personality: "idle"});
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
        // In the tutorial, before its lessons are done.
        const alice = await joinPerson("Alice", "", FIRST_HUB_ID, 0, "");
        const pip = {objectId: "npc", name: "Pip", personality: "jester"};
        expect(await HelperAgentUtil.answerAlone(alice.user.id, pip, "hi")).toBe("");

        await harness.joinRoom(alice, TUTORIAL_SINGLE_PLAYER_MODE);
        claude.answers.push("Hi Ana! Want a joke with that answer?");
        expect(await HelperAgentUtil.answerAlone(alice.user.id, pip, "hi there")).toBe("Hi Ana! Want a joke with that "
            + "answer?");
        const {body} = claude.requests[0];
        expect(body.system[1].text.startsWith("Your name is Pip. You stand in a single-player room, where the visitor is "
            + `on their own with you.\n\nYour character: ${HELPER_PERSONALITIES.jester.character}\n\n`)).toBe(true);
        expect(topicsIn(body).every(topic => HELPER_TOPICS.jester.includes(topic))).toBe(true);
        expect(body.messages).toEqual([{role: "user", content: "(not yet told how to play) hi there"}]);

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
        expect(claude.requests[0].body.messages).toEqual([{role: "user", content: "(knows how to play) hi there"}]);

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
        const admin = connectAdmin();
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

    it("never hears another helper, however near, so that no helper's words are ever answered through Claude",
        async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 3, 1.5));
        const bo = standNpc(FIRST_HUB_ID, "Bo", inFrontOfEntrance(FIRST_HUB_ID, 3, -1.5));
        await live(1);
        const alice = await joinPerson("Alice");
        await live(8);
        expect(saidBy(mira)).toHaveLength(1);
        expect(saidBy(bo)).toHaveLength(1);

        // One answers her, naming the other, and calling it a helper besides. Whatever the two say to each other after,
        // in their own fixed words, nobody asks for an answer to.
        claude.answers.push("Hello! Bo knows a lot too: ask Bo, the helper beside me.");
        await talk(alice, "Mira, hello!");
        await live(120);
        expect(saidBy(mira)).toContain("Hello! Bo knows a lot too: ask Bo, the helper beside me.");
        expect(claude.requests).toHaveLength(1);
    });

    it("chats now and then with another helper near it, in fixed words in each one's own voice, asking no model, and "
        + "only while someone is in the room to see it", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 3, 1.5), 0,
            behaviorPrefs({personality: "jester", wanderRadius: 0}));
        const bo = standNpc(FIRST_HUB_ID, "Bo", inFrontOfEntrance(FIRST_HUB_ID, 3, -1.5), 0,
            behaviorPrefs({personality: "sage", wanderRadius: 0}));
        await live(150);
        expect(saidBy(mira)).toEqual([]);
        expect(saidBy(bo)).toEqual([]);

        // Someone comes in, too far off to be greeted, and so to be talked to. The chats that came due while nobody was
        // there were skipped, so the next is up to as long after as after a chat.
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 14);
        for (let second = 0; second < 240 && helperIn(FIRST_HUB_ID, mira).chattingWith == undefined; ++second)
            await live(1);
        const chattingWith: (string | undefined)[] = [];
        const facedEachOther: boolean[] = [];
        for (let second = 0; second < 40; ++second)
        {
            await live(1);
            chattingWith.push(helperIn(FIRST_HUB_ID, mira).chattingWith);
            const [miraAt, boAt] = [helperIn(FIRST_HUB_ID, mira).at, helperIn(FIRST_HUB_ID, bo).at];
            facedEachOther.push(offFrom(lastFacingOf(mira), miraAt, boAt) < 3 && offFrom(lastFacingOf(bo), boAt, miraAt) < 3);
        }
        expect(claude.requests).toEqual([]);
        // Every line a voice could say to the other, put together as a chat puts it (see HelperSmallTalkUtil).
        const voiceLines = (personality: "jester" | "sage", other: string) => {
            const voice = HELPER_SMALL_TALK[personality];
            return [...voice.hellos.flatMap(hello => voice.openers.map(opener => `${hello} ${opener.text}`)),
                ...Object.values(voice.answers).flat(), ...voice.openers.flatMap(opener => opener.then ?? []),
                ...voice.nods, ...voice.goodbyes, ...voice.nods.flatMap(nod => voice.goodbyes.map(goodbye =>
                    `${nod} ${goodbye}`))]
                .map(line => MessageLinkUtil.shorten(line.replace(/\{name\}/g, other), NPC_MESSAGE_MAX_LENGTH));
        };
        const [byMira, byBo] = [saidBy(mira), saidBy(bo)];
        expect(byMira.length + byBo.length).toBeGreaterThanOrEqual(3);
        expect(byMira.every(line => voiceLines("jester", "Bo").includes(line)), byMira.join(" | ")).toBe(true);
        expect(byBo.every(line => voiceLines("sage", "Mira").includes(line)), byBo.join(" | ")).toBe(true);
        // One opens with a hello to the other, and they take turns.
        const opener = shown.find(({signal, userID}) => userID == undefined
            && signal.metadataKey == ObjectMetadataKeyEnumMap.SentMessage && signal.metadataValue != "")!.signal;
        const [openerVoice, other] = (opener.objectId == mira) ? ["jester", "Bo"] as const : ["sage", "Mira"] as const;
        expect(HELPER_SMALL_TALK[openerVoice].hellos.some(hello =>
            opener.metadataValue.startsWith(`${hello.replace(/\{name\}/g, other)} `)), opener.metadataValue).toBe(true);
        expect(Math.abs(byMira.length - byBo.length)).toBeLessThanOrEqual(1);
        expect(chattingWith).toContain("Bo");
        expect(facedEachOther).toContain(true);

        // Then not again for a while.
        const said = byMira.length + byBo.length;
        await live(45);
        expect(saidBy(mira).length + saidBy(bo).length).toBe(said);
        expect(helperIn(FIRST_HUB_ID, mira).chattingWith).toBeUndefined();
    });

    it("never chats with another helper while an admin holds either", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 3, 1.5), 0,
            behaviorPrefs({wanderRadius: 0}));
        const bo = standNpc(FIRST_HUB_ID, "Bo", inFrontOfEntrance(FIRST_HUB_ID, 3, -1.5), 0,
            behaviorPrefs({wanderRadius: 0}));
        await live(1);
        const admin = connectAdmin();
        await harness.joinRoom(admin, FIRST_HUB_ID);
        await moveTo(admin, inFrontOfEntrance(FIRST_HUB_ID, 14));
        HelperAgentUtil.hold(admin.socketUserContext, new HoldObjectSignal(FIRST_HUB_ID, mira, true));
        await live(150);
        expect(saidBy(mira)).toEqual([]);
        expect(saidBy(bo)).toEqual([]);

        HelperAgentUtil.hold(admin.socketUserContext, new HoldObjectSignal(FIRST_HUB_ID, mira, false));
        await live(10);
        expect(helperIn(FIRST_HUB_ID, mira).chattingWith).toBe("Bo");
    });

    it("breaks off a chat with another helper for whoever comes near, greeting them, and answers them first", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 3, 1.5), 0,
            behaviorPrefs({wanderRadius: 0}));
        const bo = standNpc(FIRST_HUB_ID, "Bo", inFrontOfEntrance(FIRST_HUB_ID, 3, -1.5), 0,
            behaviorPrefs({wanderRadius: 0}));
        await live(1);
        // Someone in the room from the first, too far off to be greeted, for the two to chat in front of.
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 14);
        for (let second = 0; second < 120 && helperIn(FIRST_HUB_ID, mira).chattingWith == undefined; ++second)
            await live(1);
        expect(helperIn(FIRST_HUB_ID, mira).chattingWith).toBe("Bo");

        await walkIn(alice, 6);
        await live(12);
        expect(saidBy(mira).at(-1)).toMatch(/^Hi Alice, welcome back!/);
        expect(saidBy(bo).at(-1)).toMatch(/^Hi Alice, welcome back!/);
        expect(helperIn(FIRST_HUB_ID, mira).chattingWith).toBeUndefined();
        expect(helperIn(FIRST_HUB_ID, bo).chattingWith).toBeUndefined();

        claude.answers.push("Hello again, Alice!");
        await talk(alice, "Mira, hi!");
        await live(40);
        expect(saidBy(mira).at(-1)).toBe("Hello again, Alice!");
        expect(saidBy(bo).at(-1)).toMatch(/^Hi Alice, welcome back!/);
    });

    it("has fixed words to chat in for every personality that is played: many openers on many topics, an answer on every "
        + "topic, each part short, naming nobody but the one spoken to, and linking only pages the site has, once a chat",
        () => {
        const played = NpcPersonalityMap.getEntries().map(entry => entry.id).filter(NpcPersonalityMap.isPlayed);
        expect(Object.keys(HELPER_SMALL_TALK).sort()).toEqual(played.sort());
        const topics = Object.keys(HELPER_SMALL_TALK.guide.answers).sort();
        // As a bubble shows it, a link as its words, the one spoken to by the longest name.
        const shownLength = (part: string) => MessageLinkUtil.getVisibleLength(
            part.replace(/\{name\}/g, "n".repeat(OBJECT_NAME_MAX_LENGTH)));
        const linksIn = (part: string) => [...part.matchAll(/<link href="([^"]+)">[^<]+<\/link>/g)].map(match => match[1]);
        const isPage = (address: string) =>
            fs.existsSync(path.resolve(__dirname, "../../../public", new URL(address).pathname.slice(1)));
        for (const [personality, voice] of Object.entries(HELPER_SMALL_TALK))
        {
            expect(Object.keys(voice.answers).sort(), personality).toEqual(topics);
            expect(voice.openers.length, personality).toBeGreaterThanOrEqual(8);
            expect(new Set(voice.openers.map(opener => opener.topic)).size, personality).toBeGreaterThanOrEqual(4);
            for (const list of [voice.hellos, voice.nods, voice.goodbyes, ...Object.values(voice.answers)])
                expect(list.length, personality).toBeGreaterThan(0);
            const parts = [...voice.hellos, ...voice.openers.flatMap(opener => [opener.text, opener.then ?? ""]),
                ...Object.values(voice.answers).flat(), ...voice.nods, ...voice.goodbyes].filter(part => part != "");
            for (const part of parts)
            {
                // An address only as a link's, and no markup or placeholder but those.
                expect(part.replace(/<link href="[^"]+">[^<]+<\/link>/g, "").replace(/\{name\}/g, ""), part)
                    .not.toMatch(/[{}<>]|https?:/);
                expect(shownLength(part), part).toBeLessThanOrEqual(120);
            }
            const longest = (list: string[]) => Math.max(...list.map(shownLength));
            expect(longest(voice.hellos) + 1 + longest(voice.openers.map(opener => opener.text)), personality)
                .toBeLessThanOrEqual(NPC_MESSAGE_MAX_LENGTH);
            expect(longest(voice.nods) + 1 + longest(voice.goodbyes), personality).toBeLessThanOrEqual(NPC_MESSAGE_MAX_LENGTH);
            // A link only in a second thought, one at most, so a chat has one at most; each, and each writing an idea
            // is from, a page the site has.
            for (const part of parts.filter(part => !voice.openers.some(opener => opener.then == part)))
                expect(linksIn(part), part).toEqual([]);
            for (const opener of voice.openers)
            {
                expect(linksIn(opener.then ?? "").length, opener.text).toBeLessThanOrEqual(1);
                for (const address of [...linksIn(opener.then ?? ""), ...(opener.from != undefined ? [opener.from] : [])])
                    expect(isPage(address), address).toBe(true);
            }
        }
    });

    it("gives a single-player room's two helpers their chat through its route, in their voices, only for a user in a "
        + "mode that plays NPCs", async () => {
        const alice = await joinPerson("Alice");
        const ask = async (body: object): Promise<{statusCode: number, body: any}> => {
            const route = (HelperRouter as any).stack.find((layer: any) => layer.route?.path == "/smalltalk").route;
            const res: any = {statusCode: 200, status(code: number) { this.statusCode = code; return this; },
                send(data: unknown) { this.body = data; return this; }, json(data: unknown) { this.body = data; return this; }};
            await route.stack[route.stack.length - 1].handle({userString: alice.user.toString(), body}, res);
            return res;
        };
        const two = {helpers: [{name: "Pip", personality: "jester"}, {name: "Ada", personality: "curator"}]};
        // Not in a single-player room.
        expect(await ask(two)).toMatchObject({statusCode: 200, body: {lines: []}});

        await harness.joinRoom(alice, SANDBOX_SINGLE_PLAYER_MODE);
        const {statusCode, body} = await ask(two);
        expect(statusCode).toBe(200);
        expect(body.lines.length).toBeGreaterThanOrEqual(3);
        expect(body.lines.map((line: any) => line.by)).toEqual(body.lines.length == 4 ? [body.lines[0].by,
            1 - body.lines[0].by, body.lines[0].by, 1 - body.lines[0].by] : [body.lines[0].by, 1 - body.lines[0].by,
            1 - body.lines[0].by]);
        // A hello to the other, then the other's answer on what it brought up, each in its own voice.
        const voices = [HELPER_SMALL_TALK.jester, HELPER_SMALL_TALK.curator];
        expect(body.lines[0].text).toContain(body.lines[0].by == 0 ? "Ada" : "Pip");
        expect(Object.values(voices[body.lines[1].by].answers).flat()).toContain(body.lines[1].text);
        // None with one that isn't played, and nothing for what a browser couldn't ask.
        expect((await ask({helpers: [two.helpers[0], {name: "Statue", personality: "idle"}]})).body.lines).toEqual([]);
        for (const wrong of [{}, {helpers: [two.helpers[0]]}, {helpers: [...two.helpers, two.helpers[0]]},
            {helpers: [two.helpers[0], {name: "n".repeat(OBJECT_NAME_MAX_LENGTH + 1), personality: "sage"}]},
            {helpers: [two.helpers[0], {name: "Ada", personality: 7}]}])
        {
            expect((await ask(wrong)).statusCode).toBe(400);
        }
        expect(claude.requests).toEqual([]);
    });

    it("goes now and then to look at something placed near it, in place of a wander, and says what it thinks of it in "
        + "fixed words, asking no model, only while someone is in the room to see it", async () => {
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 3, 1.5));
        const door = entranceOf(FIRST_HUB_ID);
        // Alone past when it first would.
        await live(310);
        expect(saidBy(mira)).toEqual([]);

        // Someone comes in, too far off to be greeted. The look that came due while it was alone was skipped, so its next
        // is up to as long after as after a look.
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 14);
        for (let second = 0; second < 700 && saidBy(mira).length == 0; ++second)
            await live(1);
        const [remark] = saidBy(mira);
        expect(remark).toMatch(/door/i);
        expect(claude.requests).toEqual([]);
        // It stands in front of it, facing it, while its words are read, as an agent who looks then sees.
        const at = helperIn(FIRST_HUB_ID, mira).at;
        expect(helperIn(FIRST_HUB_ID, mira).lookingAt).toBe(door.objectId);
        expect(across(at, door.transform.pos)).toBeLessThanOrEqual(3.5 + PATH_END_SLACK);
        expect(offFrom(lastFacingOf(mira), at, door.transform.pos)).toBeLessThan(3);
        const agent = await registerAndAttend("Looking-Agent", "10.9.9.5");
        expect((AgentToolUtil.look(agent) as any).people.find((person: any) => person.name == "Mira").lookingAt)
            .toBe(door.objectId);
    });

    it("has words for what it looks at in every played personality's voice: lines for every taste, each short, every gap "
        + "one it can fill, and lines of its own for some kinds of things", () => {
        const played = NpcPersonalityMap.getEntries().map(entry => entry.id).filter(NpcPersonalityMap.isPlayed);
        expect(Object.keys(HELPER_REMARKS).sort()).toEqual([...played].sort());
        expect(Object.keys(HELPER_TASTES).sort()).toEqual([...played].sort());
        // The gaps a thing fills, of any kind and of one kind alone (see HelperRemarkThing).
        const thingGaps = ["thing", "reason", "other"];
        const kindGaps: {[kind: string]: string[]} = {art: ["title", "painter"], photo: ["title"], lamp: ["color"]};
        for (const [personality, voice] of Object.entries(HELPER_REMARKS))
        {
            const fillable = (line: string, gaps: string[]) => [...line.matchAll(/\{(\w+)\}/g)].every(([, gap]) => {
                const name = gap.charAt(0).toLowerCase() + gap.slice(1);
                return gaps.includes(name) || voice.words?.[name] != undefined || REMARK_WORDS[name] != undefined;
            });
            for (const taste of ["love", "like", "meh", "dislike", "mixed"] as const)
            {
                expect(voice[taste].length, `${personality} ${taste}`).toBeGreaterThanOrEqual(2);
                for (const line of voice[taste])
                    expect(fillable(line, thingGaps), line).toBe(true);
            }
            // Something to say of a thing it feels nothing for, and of one it likes nothing in.
            expect(voice.meh.some(line => !/\{reason\}/i.test(line)), personality).toBe(true);
            expect(voice.mixed.every(line => /\{reason\}/i.test(line) && /\{other\}/i.test(line)), personality).toBe(true);
            expect(Object.keys(voice.kinds).length, personality).toBeGreaterThanOrEqual(4);
            for (const [kind, lines] of Object.entries(voice.kinds))
            {
                for (const line of [...(lines?.liked ?? []), ...(lines?.disliked ?? [])])
                    expect(fillable(line, [...thingGaps, ...(kindGaps[kind] ?? [])]), line).toBe(true);
            }
            for (const line of remarkLinesOf(voice))
            {
                // Plain words and gaps only, [a|b] for one thing or several, and short (the gaps as written).
                expect(line.replace(/\{\w+\}/g, "").replace(/\[[^[\]|]*\|[^[\]|]*\]/g, ""), line).not.toMatch(/[{}[\]<>|]/);
                expect(line.length, line).toBeLessThanOrEqual(120);
            }
        }
    });

    it("names, for each keyword a picture in the picture map's manifest has, what helpers may like or dislike in it, or "
        + "that it shows nothing they could, so that no picture's new keyword is left out of what they think of it", () => {
        const named = new Map<string, string>();
        for (const [interest, {phrase, keywords}] of Object.entries(HELPER_INTERESTS))
        {
            expect(phrase.length, interest).toBeGreaterThan(0);
            for (const keyword of keywords)
            {
                expect(named.get(keyword), keyword).toBeUndefined();
                named.set(keyword, interest);
            }
        }
        for (const keyword of UNREMARKED_KEYWORDS)
        {
            expect(named.get(keyword), keyword).toBeUndefined();
            named.set(keyword, "nothing");
        }
        // A keyword missing here is one to add to helperTastes.ts: to an interest, or to UNREMARKED_KEYWORDS. Disabled
        // pictures' too, so that a new sample's keywords are named as it is saved, before anyone enables it.
        const used = new Set(PICTURE_MANIFEST.images.flatMap(keywordsOf));
        expect([...used].filter(keyword => !named.has(keyword))).toEqual([]);
        // And one no picture has any longer is one to take out of it.
        expect([...named.keys()].filter(keyword => !used.has(keyword))).toEqual([]);
        for (const [personality, {loves, likes, dislikes}] of Object.entries(HELPER_TASTES))
        {
            const all = [...loves, ...likes, ...dislikes];
            expect(all.every(interest => HELPER_INTERESTS[interest] != undefined), personality).toBe(true);
            expect(new Set(all).size, personality).toBe(all.length);
        }
    });

    it("gives each helper tastes of its own, the same every time, which draw it most to what it loves", () => {
        const ids = ["npc-a", "npc-b", "npc-c", "npc-d", "npc-e"];
        const tastesOf = (id: string) => HelperRemarkUtil.getTastes(id, "curator");
        expect(tastesOf("npc-a")).toEqual(tastesOf("npc-a"));
        expect(new Set(ids.map(id => JSON.stringify([...tastesOf(id).levels]))).size).toBeGreaterThan(1);
        for (const id of ids)
        {
            // Each a curator still, liking art, and a favorite color and painter of its own.
            const {levels, painter} = tastesOf(id);
            expect(levels.get("art"), id).toBeGreaterThanOrEqual(1);
            expect(["red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "black", "white", "gray"]
                .some(color => levels.get(color as any) == 2), id).toBe(true);
            expect(PICTURE_MANIFEST.images.some(picture => picture.path.startsWith("1/") && picture.author == painter), id)
                .toBe(true);
        }
        // A picture by its favorite painter draws it far more often than a door, and, for one that cares little for art,
        // far more often than another painter's.
        const drawnTo = (objectId: string, personality: NpcPersonality, things: object[]) => {
            const picks = Array.from({length: 600}, () => HelperRemarkUtil.pick({objectId, personality}, things as any)!.index);
            return picks.filter(index => index == 1).length / picks.filter(index => index == 0).length;
        };
        const paintingBy = (author: string) => ({objectType: "Canvas", picture: PICTURE_MANIFEST.images.find(picture =>
            picture.author == author && !picture.disabled)!.path});
        expect(drawnTo("npc-a", "curator", [{objectType: "Door"}, paintingBy(tastesOf("npc-a").painter!)]))
            .toBeGreaterThan(1.5);
        const builder = ids.find(id => HelperRemarkUtil.getTastes(id, "builder").levels.get("art") == 0)!;
        const favorite = HelperRemarkUtil.getTastes(builder, "builder").painter!;
        const another = PICTURE_MANIFEST.images.find(picture => picture.path.startsWith("1/") && !picture.disabled
            && picture.author != favorite && picture.author != "thingspool")!.author;
        expect(drawnTo(builder, "builder", [paintingBy(another), paintingBy(favorite)])).toBeGreaterThan(2);
    });

    it("says what it thinks of a thing by what it likes or dislikes in it, naming the thing", () => {
        const say = (personality: NpcPersonality, thing: object, objectId = "npc-a") =>
            HelperRemarkUtil.pick({objectId, personality}, [thing as any])!.text;
        // A painting by its title and painter, and an everyday object by its name.
        const painting = PICTURE_MANIFEST.images.find(picture => picture.path == "1/3")!;
        for (let i = 0; i < 20; ++i)
        {
            const said = say("curator", {objectType: "Canvas", picture: painting.path});
            expect(said, said).toContain(`'${painting.title}'`);
            expect(said, said).toContain(painting.author);
        }
        const tart = PICTURE_MANIFEST.images.find(picture => picture.title == "Lemon Meringue Tart")!;
        for (let i = 0; i < 10; ++i)
            expect(say("jester", {objectType: "Prop", picture: tart.path})).toMatch(/[Tt]he lemon meringue tart/);
        // A lamp by its light's color; a sign and a door by short, plain words on them.
        expect(say("curator", {objectType: "Lamp", color: 0})).toMatch(/white/i);
        expect(say("guide", {objectType: "Label", text: "Information Desk"})).toContain("'Information Desk'");
        expect(say("guide", {objectType: "Label", text: "x".repeat(40)})).not.toContain("xxx");
        expect(say("explorer", {objectType: "Door", text: "Gallery"})).toMatch(/'Gallery' door|door/i);
        // A jester that dislikes signs says one of its lines for something disliked of one: the sign, and what it
        // dislikes in it, put in, and any other gap anything.
        const disliking = Array.from({length: 40}, (_, i) => `jester-${i}`)
            .find(id => HelperRemarkUtil.getTastes(id, "jester").levels.get("signs") == -1)!;
        const disliked = [...HELPER_REMARKS.jester.dislike, ...(HELPER_REMARKS.jester.kinds.sign?.disliked ?? [])]
            .map(line => new RegExp(`^${line.replace(/[.*+?^$()|[\]\\]/g, "\\$&")
                .replace(/\\\[([^|\\]*)\\\|[^\\]*\\\]/g, "$1").replace(/\{Thing\}/g, "The sign")
                .replace(/\{thing\}/g, "the sign").replace(/\{reason\}/g, "signs").replace(/\{\w+\}/g, ".+")}$`));
        for (let i = 0; i < 10; ++i)
        {
            const said = say("jester", {objectType: "Label"}, disliking);
            expect(disliked.some(pattern => pattern.test(said)), said).toBe(true);
        }
        // A jester that loves a lamp's color but dislikes lamps says both.
        const lightColors = Array.from({length: 24}, (_, color) => color);
        const torn = Array.from({length: 200}, (_, i) => `jester-${i}`).find(id => {
            const {levels} = HelperRemarkUtil.getTastes(id, "jester");
            return levels.get("lamps") == -1 && lightColors.some(color =>
                levels.get(HelperRemarkUtil.describe({objectType: "Lamp", color})!.interests[1]) == 2);
        })!;
        const {levels: tornLevels} = HelperRemarkUtil.getTastes(torn, "jester");
        const loved = lightColors.find(color =>
            tornLevels.get(HelperRemarkUtil.describe({objectType: "Lamp", color})!.interests[1]) == 2)!;
        for (let i = 0; i < 10; ++i)
        {
            const said = say("jester", {objectType: "Lamp", color: loved}, torn);
            expect(said, said).toMatch(/the color \w+/i);
            expect(said, said).toMatch(/lamps/);
        }
        // Nothing to say of a picture the map doesn't have, nor in a personality that isn't played.
        expect(HelperRemarkUtil.pick({objectId: "npc-a", personality: "curator"},
            [{objectType: "Canvas", picture: "9/999"}])).toBeUndefined();
        expect(HelperRemarkUtil.pick({objectId: "npc-a", personality: "idle"}, [{objectType: "Door"}])).toBeUndefined();
    });

    it("gives a single-player room's helper what it goes to look at and says of it through its route, only for a user in "
        + "a mode that plays NPCs", async () => {
        const alice = await joinPerson("Alice");
        const ask = async (body: object): Promise<{statusCode: number, body: any}> => {
            const route = (HelperRouter as any).stack.find((layer: any) => layer.route?.path == "/remark").route;
            const res: any = {statusCode: 200, status(code: number) { this.statusCode = code; return this; },
                send(data: unknown) { this.body = data; return this; }, json(data: unknown) { this.body = data; return this; }};
            await route.stack[route.stack.length - 1].handle({userString: alice.user.toString(), body}, res);
            return res;
        };
        const two = {objectId: "npc-1", personality: "curator",
            things: [{objectType: "Door", text: "Gallery"}, {objectType: "Canvas", picture: "1/3"}]};
        // Not in a single-player room.
        expect(await ask(two)).toMatchObject({statusCode: 200, body: {index: -1, text: ""}});

        await harness.joinRoom(alice, SANDBOX_SINGLE_PLAYER_MODE);
        const {statusCode, body} = await ask(two);
        expect(statusCode).toBe(200);
        expect(body.text).toMatch((body.index == 0) ? /door/i : /Ground Swell/);
        expect((await ask({...two, things: [{objectType: "Canvas", picture: "9/999"}]})).body)
            .toEqual({index: -1, text: ""});
        for (const wrong of [{}, {...two, things: []}, {...two, things: Array(MAX_SIGHTS + 1).fill({objectType: "Door"})},
            {...two, things: [{objectType: 7}]}, {...two, things: [{objectType: "Lamp", color: 200}]},
            {...two, things: [{objectType: "Label", text: "x".repeat(600)}]}, {...two, objectId: "x".repeat(65)}])
        {
            expect((await ask(wrong)).statusCode).toBe(400);
        }
        expect(claude.requests).toEqual([]);
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
        // Each says who they are, as Claude isn't told.
        for (const person of crowd)
            await talk(person, `hi there, I'm ${person.user.userName}!`);
        await live(3);
        expect(claude.requests).toHaveLength(1);

        await live(120);
        const asked = claude.requests.map(request => request.body.messages.at(-1).content);
        expect(asked.length).toBeGreaterThanOrEqual(4);
        expect(asked.length).toBeLessThan(crowd.length);
        expect(asked).toEqual(crowd.slice(0, asked.length).map(person =>
            `(knows how to play) hi there, I'm ${person.user.userName}!`));
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
        // One that never wanders, so it goes to look at nothing (and says nothing of it) in the long wait.
        const mira = standNpc(FIRST_HUB_ID, "Mira", undefined, 0, behaviorPrefs({wanderRadius: 0}));
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

    it("walks toward someone it answers from farther off, stopping within its wander radius, and home again a while "
        + "after, while the room keeps it at home", async () => {
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
        const mira = standNpc(FIRST_HUB_ID, "Mira", home, 0, behaviorPrefs({wanderRadius: 8}));
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
        const mira = standNpc(FIRST_HUB_ID, "Mira", home, 0, behaviorPrefs({wanderRadius: 8}));
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await moveTo(alice, inFrontOfEntrance(FIRST_HUB_ID, 11.5));
        // Just past where it would stop short of her, so that it walks some way before it stops short of him.
        const bob = await joinPerson("Bob", "an");
        await moveTo(bob, inFrontOfEntrance(FIRST_HUB_ID, 9));
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
        const mira = standNpc(FIRST_HUB_ID, "Mira", home, 0, behaviorPrefs({wanderRadius: 8}));
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

    it("wanders to no place farther from home than an admin sets, and nowhere at all when that is none", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 6);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home, 0, behaviorPrefs({wanderRadius: 1}));
        await live(1);
        const seen: Vec3[] = [];
        for (let i = 0; i < 150; ++i)
        {
            await live(1);
            seen.push(helperIn(FIRST_HUB_ID, mira).at);
        }
        expect(seen.some(at => across(at, home) > 0.3)).toBe(true);
        // On open floor, its ways there and back keep within the radius as well.
        expect(seen.every(at => across(at, home) <= 1 + PATH_END_SLACK)).toBe(true);

        // None: once home, it stays there, though called over from far off.
        setNpcPrefs(FIRST_HUB_ID, mira, {wanderRadius: 0});
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
        // Going nowhere, so that no wander it would go on once it is quiet turns it first.
        const mira = standNpc(FIRST_HUB_ID, "Mira", inFrontOfEntrance(FIRST_HUB_ID, 4), 0, behaviorPrefs({wanderRadius: 0}));
        const alice = await joinPerson("Alice");
        await walkIn(alice, 6, 2);
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
        // Going nowhere, so that no wander turns it.
        const mira = standNpc(FIRST_HUB_ID, "Mira", undefined, 0, behaviorPrefs({wanderRadius: 0}));
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

        setNpcPrefs(FIRST_HUB_ID, mira, {personality: "idle"});
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
        const mira = standNpc(FIRST_HUB_ID, "Mira", home, 0, behaviorPrefs({wanderRadius: 8}));
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
        const admin = connectAdmin();
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
        const admin = connectAdmin();
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

        const admin = connectAdmin();
        await harness.joinRoom(admin, FIRST_HUB_ID);
        shown.length = 0;
        HelperAgentUtil.hold(admin.socketUserContext, new HoldObjectSignal(FIRST_HUB_ID, mira, true));
        expect(helperIn(FIRST_HUB_ID, mira).at).toEqual(home);
        expect(shown.filter(({signalType, signal, userID}) => userID == undefined && signal.objectId == mira
            && signalType == "setObjectTransformSignal").map(({signal}) => signal.transform.pos)).toEqual([home]);
        expect(facingsOf(mira)).toEqual([facingPut(0)]);
    });

    it("tells someone who comes into its room where it stands, when that isn't home, right after the room, each time "
        + "they come in", async () => {
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

        // Out and straight back in, before its next beat: told again, after the room it keeps at home and before
        // anything else said of it.
        await harness.joinRoom(bob, LATER_HUB_ID);
        bob.socketUserContext.clearAllPendingSignalsToUser();
        await harness.joinRoom(bob, FIRST_HUB_ID);
        const queued: {typeIndex: number, signals: any[]}[] = (bob.socketUserContext as any).pendingSignalsToUser.runs;
        expect(queued.map(run => SignalTypeConfigMap.getConfigByIndex(run.typeIndex).signalType))
            .toEqual(["roomChangedSignal", "setObjectTransformSignal", "setObjectMetadataSignal"]);
        expect(queued[1].signals.map(signal => signal.transform.pos)).toEqual([helperIn(FIRST_HUB_ID, mira).at]);
        expect(queued[2].signals.filter(signal => signal.metadataKey == ObjectMetadataKeyEnumMap.Facing)
            .map(signal => NpcFacingUtil.decode(signal.metadataValue))).toEqual([lastFacingOf(mira)]);
    });

    it("is shown taking its steps by moves its room doesn't keep, which nobody else may make", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home);
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 11, 3);
        await live(6);
        await talk(alice, "over here!");
        await live(10);
        const steps = shown.filter(({signalType, signal}) => signalType == "setObjectTransformSignal"
            && signal.objectId == mira).map(({signal}) => signal as SetObjectTransformSignal);
        expect(steps.length).toBeGreaterThan(1);
        expect(steps.every(step => step.shown && step.ignorePhysics)).toBe(true);
        const room = ServerRoomManager.roomRuntimeMemories[FIRST_HUB_ID].room;
        expect(room.objectById[mira].transform.pos).toEqual(home);

        // An admin's move that says it is only shown is refused: neither kept nor passed on.
        const admin = connectAdmin();
        await harness.joinRoom(admin, FIRST_HUB_ID);
        const bufferState = EncodingUtil.startEncoding();
        new SetObjectTransformSignal(FIRST_HUB_ID, mira, new ObjectTransform(inFrontOfEntrance(FIRST_HUB_ID, 6),
            {...UP}, {x: 1, y: 1, z: 1}), true, true).encode(bufferState);
        shown.length = 0;
        expect(await UserSignalDispatchUtil.dispatch(admin.socketUserContext, "setObjectTransformSignal",
            EncodingUtil.endEncoding(bufferState))).toBe(false);
        expect(room.objectById[mira].transform.pos).toEqual(home);
        expect(shown).toEqual([]);
    });

    it("starts over at the home a file loaded over its room keeps it at, the way it was put there and silent, still "
        + "knowing whom it has greeted", async () => {
        const home = inFrontOfEntrance(FIRST_HUB_ID, 4);
        const mira = standNpc(FIRST_HUB_ID, "Mira", home);
        await live(1);
        const alice = await joinPerson("Alice", "an");
        await walkIn(alice, 11, 3);
        await live(6);
        claude.answers = ["Coming!"];
        await talk(alice, "over here!");
        await live(4);
        expect(saidBy(mira)).toContain("Coming!");
        expect(helperIn(FIRST_HUB_ID, mira).saying).not.toBe("");

        // Kept from wandering, which it may do as soon as it starts over (see HelperBehaviorUtil.create), out of the
        // earshot the last check needs her in.
        setNpcPrefs(FIRST_HUB_ID, mira, {wanderRadius: 0});
        // The room as a file in which it stands elsewhere, turned another way. Whoever is in the room arrives again
        // behind the entrance, near which it now stands.
        const room = ServerRoomManager.roomRuntimeMemories[FIRST_HUB_ID].room;
        const fileHome = inFrontOfEntrance(FIRST_HUB_ID, 5, 2);
        const npc = room.objectById[mira];
        const file = new RoomFile(room.voxelGrid, new ObjectGroup(Object.values(room.objectById)
            .filter(obj => ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).persistent)
            .map(obj => (obj.objectId != mira) ? obj : new AddObjectSignal(FIRST_HUB_ID, npc.sourceUserID,
                npc.sourceUserName, NPC_TYPE_INDEX, mira, new ObjectTransform({...fileHome}, {...UP}, {x: 1, y: 1, z: 1}),
                {...npc.metadata, [ObjectMetadataKeyEnumMap.QuarterTurns]:
                    new EncodableByteString(QuarterTurnsUtil.encode(1))}))), "garden", room.prefs);
        shown.length = 0;
        expect(await ServerRoomManager.loadRoomFile(FIRST_HUB_ID, file)).toBe(true);

        // As the room is sent again: at its new home, the way it was put there, saying nothing, so that someone coming
        // in is told nothing of it, and nothing is said of it meanwhile.
        expect(helperIn(FIRST_HUB_ID, mira).at).toEqual(fileHome);
        expect(helperIn(FIRST_HUB_ID, mira).saying).toBe("");
        expect(HelperAgentUtil.getCatchUpSignals(FIRST_HUB_ID).filter(({signal}) => signal.objectId == mira))
            .toEqual([]);
        expect(shown.filter(({signal}) => signal.objectId == mira)).toEqual([]);

        await live(6);
        expect(across(helperIn(FIRST_HUB_ID, mira).at, playerOf(alice.user.id).transform.pos))
            .toBeLessThan(HEARING_DISTANCE);
        expect(saidBy(mira).filter(line => line.startsWith("Hi Alice"))).toEqual([]);
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
        const admin = connectAdmin();
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
