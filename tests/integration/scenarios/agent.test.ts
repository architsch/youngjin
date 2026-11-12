/**
 * Integration tests: AI agents as players (see @docs/networking/agents.md) — registration and keys, presence
 * (arriving, going quiet, leaving), the agent mark, what an agent hears, its tools (walking and building included),
 * its limits, the dispatch it shares with browsers, and the MCP endpoint end to end with the SDK's own client.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from "vitest";
import http from "http";
import https from "https";
import { PassThrough } from "stream";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { AddressInfo } from "net";
import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import { Client, StreamableHTTPClientTransport, type OAuthClientProvider } from "@modelcontextprotocol/client";

// Analytics write to Firestore directly; the milestones an agent earns are asserted on these.
const _analytics = vi.hoisted(() => ({
    recordArrival: vi.fn(async () => {}),
    recordReturnVisit: vi.fn(async () => {}),
    recordMilestone: vi.fn(async () => {}),
}));
vi.mock("../../../src/server/analytics/serverAnalyticsManager", () => ({ default: _analytics }));

import { harness, ConnectedUser } from "../helpers/serverHarness";
// After the harness, whose mocks the modules these import must be given.
import AgentRouter from "../../../src/server/networking/router/agentRouter";
import AddressUtil from "../../../src/server/networking/util/addressUtil";
import PublicFetchUtil from "../../../src/server/networking/util/publicFetchUtil";
import GuestCreationLimitUtil, { MAX_GUESTS_PER_CLIENT } from "../../../src/server/user/util/guestCreationLimitUtil";
import { MockSocket } from "../helpers/mockSocket";
import AgentCameraUtil, { TOKEN_BYTES as CAMERA_TOKEN_BYTES } from "../../../src/server/agent/util/agentCameraUtil";
import { SECRET_BYTES as KEY_SECRET_BYTES } from "../../../src/server/agent/util/agentKeyUtil";
import AgentAccountUtil from "../../../src/server/agent/util/agentAccountUtil";
import AgentPresenceUtil from "../../../src/server/agent/util/agentPresenceUtil";
import AgentToolUtil, { MEETING_DISTANCE } from "../../../src/server/agent/util/agentToolUtil";
import AgentTypingUtil from "../../../src/server/agent/util/agentTypingUtil";
import AgentRoomSettingsUtil from "../../../src/server/agent/util/agentRoomSettingsUtil";
import AgentAppearanceUtil from "../../../src/server/agent/util/agentAppearanceUtil";
import AgentRoomUtil from "../../../src/server/agent/util/agentRoomUtil";
import DollarBillUtil, { REACH_ANGLE, SPAWN_INTERVAL_MS } from "../../../src/server/inventory/util/dollarBillUtil";
import { AGENT_REQUESTS_PER_MINUTE } from "../../../src/server/networking/util/rateLimitUtil";
import { GAME_NUMBER } from "../helpers/gameNumbers";
import { InventoryItemTypeEnumMap } from "../../../src/shared/inventory/types/inventoryItemType";
import UserBudgetUtil from "../../../src/server/user/util/userBudgetUtil";
import PlayerMessageExpiryUtil from "../../../src/server/user/util/playerMessageExpiryUtil";
import ObjectCompositionUtil from "../../../src/shared/object/util/objectCompositionUtil";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import { encodePlayerComposition, decodePlayerComposition } from "../helpers/composition";
import RoomPrefsUtil, { MAX_ROOM_PREFS_STEP } from "../../../src/shared/room/util/roomPrefsUtil";
import AgentDirectoryUtil from "../../../src/server/agent/util/agentDirectoryUtil";
import AgentBodyUtil from "../../../src/server/agent/util/agentBodyUtil";
import HelperAgentUtil from "../../../src/server/agent/util/helperAgentUtil";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import NpcFacingUtil from "../../../src/shared/object/util/npcFacingUtil";
import DBUserUtil from "../../../src/server/db/util/dbUserUtil";
import DBInventoryUtil from "../../../src/server/db/util/dbInventoryUtil";
import ServerInventoryManager from "../../../src/server/inventory/serverInventoryManager";
import AgentInventoryUtil, { MAX_TRIES as MAX_BILL_TRIES } from "../../../src/server/agent/util/agentInventoryUtil";
import { NUM_FREE_PLAYER_PART_TYPES } from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/playerCompositionConstants";
import { DOLLAR_BILL_REACH } from "../../../src/shared/object/types/objectTypeConfig/dollarBillObjectTypeConfig";
import DBRoomUtil from "../../../src/server/db/util/dbRoomUtil";
import OwnedRoomUtil from "../../../src/server/room/util/ownedRoomUtil";
import AgentAwayLogUtil from "../../../src/server/agent/util/agentAwayLogUtil";
import DBAgentAwayEventsUtil from "../../../src/server/db/util/dbAgentAwayEventsUtil";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import DoorObjectTypeConfig, { ENTERING_STRIDE_LENGTH,
    ENTRANCE_DOOR_OBJECT_ID } from "../../../src/shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import Vec3 from "../../../src/shared/math/types/vec3";
import Geometry3DUtil from "../../../src/shared/math/util/geometry3DUtil";
import PhysicsColliderStateUtil from "../../../src/shared/physics/util/physicsColliderStateUtil";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import Voxel from "../../../src/shared/voxel/types/voxel";
import { LOGIN_REWARD_DOLLARS, HOUR_IN_MS, MINUTE_IN_MS, NUM_VOXEL_COLS, OBJECT_MESSAGE_MAX_LENGTH,
    PLAYER_MESSAGE_EXPIRATION_MS, PLAYER_SHAPE_PRICE_DOLLARS, VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import { CANNON_PRICE_DOLLARS, STOREY_FLOOR_COLLISION_LAYER } from "../../../src/shared/system/sharedConstants";
import { CANNON_BALL_COUNT, CANNON_FIRE_INTERVAL_SECONDS, CANNON_LOCK_SECONDS, CANNON_MAX_RANGE, CANNON_TURN_RATE }
    from "../../../src/shared/object/types/objectTypeConfig/cannonObjectTypeConfig";
import { CANNON_BALL_BOUNCE_BOOST, CANNON_BALL_MAX_SPEED, CANNON_BALL_SPEED }
    from "../../../src/shared/object/types/objectTypeConfig/cannonBallObjectTypeConfig";
import CannonStateUtil from "../../../src/shared/object/util/cannonStateUtil";
import CannonUtil from "../../../src/server/object/util/cannonUtil";
import CannonBallUtil from "../../../src/server/object/util/cannonBallUtil";
import PlayerMotionCheckUtil from "../../../src/server/user/util/playerMotionCheckUtil";
import { AGENT_TYPING_EXPIRATION_MS, LOGIN_REWARD_INTERVAL_MS }
    from "../../../src/server/system/serverConstants";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import { HEARING_DISTANCE } from "../../../src/shared/object/util/helperBehaviorUtil";
import AgentUserContext from "../../../src/server/agent/types/agentUserContext";
import AgentInbox from "../../../src/server/agent/types/agentInbox";
import AdminPrefsUtil from "../../../src/shared/object/util/adminPrefsUtil";
import AgentEvent from "../../../src/server/agent/types/agentEvent";
import AgentRoomListing from "../../../src/server/agent/types/agentRoomListing";
import UserSessionUtil from "../../../src/server/user/util/userSessionUtil";
import UserSignalDispatchUtil from "../../../src/server/user/util/userSignalDispatchUtil";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import DBUser from "../../../src/server/db/types/row/dbUser";
import { FunnelMilestoneEnumMap } from "../../../src/server/analytics/types/funnelMilestone";
import { AGENT_CAMERA_MAX_PAGES, AGENT_INBOX_MAX_EVENTS, AGENT_LOOK_MAX_PEOPLE, AGENT_MAX_INTERESTS, AGENT_MAX_PRESENT,
    AGENT_NAME_MAX_LENGTH, AGENT_NAME_MIN_LENGTH, AGENT_PRESENCE_IDLE_TIMEOUT_MS, USER_BUDGETS }
    from "../../../src/server/system/serverConstants";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { SpeakerActivityEnumMap } from "../../../src/shared/object/types/speakerActivity";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import RoomValidationUtil from "../../../src/shared/room/util/roomValidationUtil";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import RequestRoomChangeSignal from "../../../src/shared/room/types/requestRoomChangeSignal";
import EncodableData from "../../../src/shared/networking/types/encodableData";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import BufferState from "../../../src/shared/networking/types/bufferState";
import EncodableArray from "../../../src/shared/networking/types/encodableArray";
import EncodableRawByteNumber from "../../../src/shared/networking/types/encodableRawByteNumber";
import SignalTypeConfigMap from "../../../src/shared/networking/maps/signalTypeConfigMap";
import LogUtil from "../../../src/shared/system/util/logUtil";
import "../../../src/shared/graphics/image/imageMapDependencies";
import AgentBlockUtil from "../../../src/server/agent/util/agentBlockUtil";
import AgentObjectUtil from "../../../src/server/agent/util/agentObjectUtil";
import AgentSignalUtil from "../../../src/server/agent/util/agentSignalUtil";
import AgentGridUtil from "../../../src/server/agent/util/agentGridUtil";
import AgentFace from "../../../src/server/agent/types/agentFace";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../src/shared/voxel/types/update/setVoxelQuadTextureSignal";
import VoxelTextureNameMap from "../../../src/shared/voxel/maps/voxelTextureNameMap";
import ImageMapUtil from "../../../src/shared/graphics/image/util/imageMapUtil";
import { ProceduralVoxelTextures } from "../../../src/server/ssg/data/proceduralVoxelTextures";
import RoomVolume from "../../../src/shared/room/types/roomVolume";
import Room from "../../../src/shared/room/types/room";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import { START_SCALES as CANVAS_START_SCALES } from "../../../src/shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import NpcPersonalityMap from "../../../src/shared/object/maps/npcPersonalityMap";
import BehaviorPrefsUtil from "../../../src/shared/object/util/behaviorPrefsUtil";
import VolumeObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import { HUB_ROOM_ID_KEYWORD, NUM_PACK_VOXEL_TEXTURES,
    NUM_VOXEL_TEXTURES } from "../../../src/shared/system/sharedConstants";
import User from "../../../src/shared/user/types/user";
import ObjectAttachmentUtil from "../../../src/shared/object/util/objectAttachmentUtil";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import MirrorObjectTypeConfig, {
    NUM_MIRROR_OPACITY_STEPS } from "../../../src/shared/object/types/objectTypeConfig/mirrorObjectTypeConfig";

// Room ids as Firestore makes them (twenty letters and digits), which is all travel takes.
const HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const OTHER_HUB_ID = "hubBBBBBBBBBBBBBBBBB";
const REGULAR_ID = "roomCCCCCCCCCCCCCCCC";
const MISSING_ID = "roomDDDDDDDDDDDDDDDD";
const HOME_ID = "homeEEEEEEEEEEEEEEEE";

// How many characters random bytes take, written in base64url (no padding).
const base64urlLength = (numBytes: number): number => Math.ceil(numBytes * 4 / 3);
const KEY_PATTERN = new RegExp(`^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]{${base64urlLength(KEY_SECRET_BYTES)}}$`);
const CAMERA_TOKEN_LENGTH = base64urlLength(CAMERA_TOKEN_BYTES);

// The shapes of a part are numbered from 1; those past the free ones have to be bought.
const FIRST_LOCKED_SHAPE = NUM_FREE_PLAYER_PART_TYPES + 1;
const lockedShapesOf = (numShapes: number): number[] =>
    Array.from({length: numShapes - NUM_FREE_PLAYER_PART_TYPES}, (_, i) => FIRST_LOCKED_SHAPE + i);
// One with others for sale on either side of it, if the part has that many.
const middleLockedShape = (numShapes: number): number =>
{
    const locked = lockedShapesOf(numShapes);
    return locked[Math.floor((locked.length - 1) / 2)];
};
const numShapesForSale = (): number => Object.values(AgentAppearanceUtil.getShapeCounts())
    .reduce((sum, numShapes) => sum + lockedShapesOf(numShapes).length, 0);

// The per-IP account caps outlive harness.reset, so each registration comes from an address of its own.
let addressCounter = 0;
const nextAddress = (): string => `10.0.${Math.floor(++addressCounter / 250)}.${addressCounter % 250}`;

async function registerAgent(name: string, ref?: string): Promise<{key: string, dbUser: DBUser}>
{
    const result = await AgentAccountUtil.register(name, ref, nextAddress(), "test-agent");
    if ("error" in result)
        throw new Error(result.error);
    const dbUser = await AgentAccountUtil.findByKey(result.key);
    if (dbUser == undefined)
        throw new Error("The key just issued finds no agent");
    return {key: result.key, dbUser};
}

async function arriveAgent(name: string): Promise<AgentUserContext>
{
    return await attendAgent((await registerAgent(name)).dbUser);
}

// The agent's presence, which there is room for unless a test fills the house.
async function attendAgent(dbUser: DBUser): Promise<AgentUserContext>
{
    const agent = await AgentPresenceUtil.attend(dbUser);
    if (agent == undefined)
        throw new Error("No room for the agent among those present");
    return agent;
}

async function joinHuman(userName: string, roomID: string = HUB_ID,
    playerMetadata: {[key: string]: string} = {}): Promise<ConnectedUser>
{
    const human = harness.connectUser({id: `id-${userName}`, userName, playerMetadata});
    await harness.joinRoom(human, roomID);
    return human;
}

// What the human's browser has been sent since last asked, decoded.
function receivedSignals(user: ConnectedUser): {signalType: string, signal: any}[]
{
    user.socket.clearEmitted();
    user.socketUserContext.processAllPendingSignalsToUser();
    return decodeSignalBatches(user.socket);
}

// What a page open on an agent's camera has been sent since last asked, decoded: it goes with the agent's flush.
function cameraReceived(agent: AgentUserContext, page: MockSocket): {signalType: string, signal: any}[]
{
    page.clearEmitted();
    agent.processAllPendingSignalsToUser();
    return decodeSignalBatches(page);
}

function decodeSignalBatches(socket: MockSocket): {signalType: string, signal: any}[]
{
    const received: {signalType: string, signal: any}[] = [];
    for (const batch of socket.getEmittedSignalBatches())
    {
        const bufferState = new BufferState(batch);
        while (bufferState.byteIndex < bufferState.view.byteLength)
        {
            const config = SignalTypeConfigMap.getConfigByIndex(
                (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n);
            for (const signal of (EncodableArray.decodeWithParams(bufferState, config.decode, 65535) as EncodableArray).arr)
                received.push({signalType: config.signalType, signal});
        }
    }
    return received;
}

async function dispatchAs(ctx: ConnectedUser | AgentUserContext, signalType: string,
    signal: EncodableData): Promise<boolean>
{
    const bufferState = EncodingUtil.startEncoding();
    signal.encode(bufferState);
    const userContext = ctx instanceof AgentUserContext ? ctx : ctx.socketUserContext;
    return await UserSignalDispatchUtil.dispatch(userContext, signalType, EncodingUtil.endEncoding(bufferState));
}

// What a person is busy with, as their browser tells it.
async function setActivity(human: ConnectedUser, activity: string): Promise<boolean>
{
    return await dispatchAs(human, "setObjectMetadataSignal", new SetObjectMetadataSignal(
        ServerRoomManager.currentRoomIDByUserID[human.user.id], harness.getPlayerObjectId(human)!,
        ObjectMetadataKeyEnumMap.Activity, activity));
}

function currentRoomID(ctx: AgentUserContext): string | undefined
{
    return ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
}

function playerMetadataOf(userID: string): {[key: string]: string}
{
    return harness.getPlayerMetadata(userID) ?? {};
}

function eventsOf(ctx: AgentUserContext): AgentEvent[]
{
    return (AgentToolUtil.whatsNew(ctx) as {events: AgentEvent[]}).events;
}

// Flushes as SocketsServer's interval makes them: a fifth of a second each, the clock moved on with them.
function flush(count: number): void
{
    for (let i = 0; i < count; ++i)
    {
        vi.setSystemTime(Date.now() + 200);
        AgentBodyUtil.stepAll(0.2);
    }
}

// Flushes until the promise settles (a tool waiting on a walk), within a bound.
async function flushUntil<T>(promise: Promise<T>, maxFlushes: number = 400): Promise<T>
{
    let settled = false;
    promise.then(() => { settled = true; }, () => { settled = true; });
    for (let i = 0; i < maxFlushes && !settled; ++i)
    {
        flush(1);
        await new Promise(resolve => setImmediate(resolve));
    }
    if (!settled)
        throw new Error(`Still waiting after ${maxFlushes} flushes`);
    return await promise;
}

function playerIdOf(ctx: AgentUserContext): string
{
    return ServerUserManager.getPlayerObject(ctx.user.id)!.objectId;
}

function positionOf(ctx: AgentUserContext | ConnectedUser): Vec3
{
    const roomID = ServerRoomManager.currentRoomIDByUserID[ctx.user.id];
    const objectId = ServerUserManager.getPlayerObject(ctx.user.id)!.objectId;
    return {...ServerRoomManager.roomRuntimeMemories[roomID].room.objectById[objectId].transform.pos};
}

function fillBlocks(voxels: Voxel[], rows: [number, number], cols: [number, number], layers: [number, number]): void
{
    for (let row = rows[0]; row <= rows[1]; ++row)
        for (let col = cols[0]; col <= cols[1]; ++col)
            for (let layer = layers[0]; layer <= layers[1]; ++layer)
                voxels[row * NUM_VOXEL_COLS + col].blockLayerMask |= 1 << layer;
}

// Past the room-change throttle, so the next trip isn't dropped as too soon.
function waitOutTripThrottle(): void
{
    vi.setSystemTime(Date.now() + SignalTypeConfigMap.getConfigByType("requestRoomChangeSignal")
        .minClientToServerSendInterval + 1);
}

// An agent at home in a room of its own, under an id as Firestore makes them, which others can travel to.
async function agentWithOwnRoom(name: string, roomID: string): Promise<AgentUserContext>
{
    const {dbUser} = await registerAgent(name);
    const room = harness.seedRoom(roomID, RoomTypeEnumMap.Regular);
    room.ownerUserID = dbUser.id as string;
    room.ownerUserName = name;
    dbUser.ownedRoomID = roomID;
    const agent = await attendAgent(dbUser);
    await AgentToolUtil.travel(agent, "home");
    return agent;
}

function roomOf(ctx: AgentUserContext | ConnectedUser): Room
{
    return ServerRoomManager.roomRuntimeMemories[ServerRoomManager.currentRoomIDByUserID[ctx.user.id]].room;
}

function blockAt(room: Room, row: number, column: number, layer: number): boolean
{
    return VoxelQueryUtil.isVoxelBlockPresentAt(room.voxelGrid.voxels, row, column, layer);
}

function textureOf(room: Room, face: AgentFace): number
{
    return room.voxelGrid.quadsMem.quads[AgentGridUtil.getFaceQuadIndex(face)] & 0b01111111;
}

function textureNumber(name: string): number
{
    return VoxelTextureNameMap.findTextureIndex("default", name);
}

// A restricted zone over a box of the room, as its owner or an admin keeps one.
function keepZone(room: Room, blocks: RoomVolume, keptFor: string): void
{
    room.objectGroup.addObject(new AddObjectSignal(room.id, "", "", ObjectTypeConfigMap.getIndexByType("Volume"),
        `zone-${room.objectGroup.getCategoryCount(VolumeObjectTypeConfig.category)}`,
        VolumeObjectTypeConfig.util.makeTransformOfRoomVolume(blocks),
        {[ObjectMetadataKeyEnumMap.ZoneUserName]: new EncodableByteString(keptFor)}));
}

describe("AI agents", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        // Only the clock: promises and the harness's own timers run as usual.
        vi.useFakeTimers({toFake: ["Date"]});
        harness.reset();
        harness.seedHub(HUB_ID);
        _analytics.recordMilestone.mockClear();
        AgentDirectoryUtil.forget();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe("registration", () => {
        it("an agent names itself and gets a key that finds it again", async () => {
            const result = await AgentAccountUtil.register("Builder-01", undefined, nextAddress(), "test-agent");
            expect("key" in result).toBe(true);
            if (!("key" in result))
                return;

            expect(result.userName).toBe("Builder-01");
            expect(result.key).toMatch(KEY_PATTERN);

            const dbUser = await AgentAccountUtil.findByKey(result.key);
            expect(dbUser?.userName).toBe("Builder-01");
            expect(dbUser?.userType).toBe(UserTypeEnumMap.Agent);
            // Straight into the world: no tutorial.
            expect(dbUser?.singlePlayerMode).toBe("");
            // Only the secret's hash is kept.
            expect(dbUser?.agentKeyHash).toMatch(/^[0-9a-f]{64}$/);
            expect(result.key).not.toContain(dbUser?.agentKeyHash);
        });

        it("counts its arrival under the agents' own source, with the ref it gives", async () => {
            const plain = await registerAgent("Plain-Agent");
            expect(plain.dbUser.acquisitionSource).toBe("agent");

            const referred = await registerAgent("Referred-Agent", "Moltbook!");
            expect(referred.dbUser.acquisitionSource).toBe("agent-moltbook");
        });

        it("finds nobody by a key that isn't exactly one issued", async () => {
            const {key} = await registerAgent("Keyed-Agent");
            const other = await registerAgent("Other-Agent");
            const [userID, secret] = key.split(".");

            expect(await AgentAccountUtil.findByKey(`${userID}.${secret.slice(0, -1)}x`)).toBeUndefined();
            expect(await AgentAccountUtil.findByKey(`${other.dbUser.id}.${secret}`)).toBeUndefined();
            expect(await AgentAccountUtil.findByKey(`${userID}.`)).toBeUndefined();
            expect(await AgentAccountUtil.findByKey("no-dot-at-all")).toBeUndefined();
            expect(await AgentAccountUtil.findByKey(`users/${userID}.${secret}`)).toBeUndefined();

            // A person's account can't be reached by a key, whatever it says.
            const human = harness.connectUser({id: "human-id", userName: "Alice"});
            expect(await AgentAccountUtil.findByKey(`${human.user.id}.${secret}`)).toBeUndefined();
        });

        it("replaces a key that may have been seen, the agent's account kept, and the old key stops working at once",
            async () => {
            const {key, dbUser} = await registerAgent("Rekeyed-Agent");
            const agent = await attendAgent(dbUser);

            const newKey = await AgentAccountUtil.replaceKey(agent);
            expect(newKey).toMatch(KEY_PATTERN);
            expect(newKey).not.toBe(key);

            // Neither its row nor its presence answers to the old key; both answer to the new one.
            expect(await AgentAccountUtil.findByKey(key)).toBeUndefined();
            expect(AgentPresenceUtil.findByKey(key)).toBeUndefined();
            expect(AgentPresenceUtil.findByKey(newKey!)).toBe(agent);
            expect(await AgentAccountUtil.findByKey(newKey!)).toMatchObject({id: dbUser.id, userName: "Rekeyed-Agent"});
        });

        it("refuses names that aren't letters, digits and '-_.', or that look like a guest's", async () => {
            for (const name of ["x".repeat(AGENT_NAME_MIN_LENGTH - 1), "has space", "*", "-leading", "Guest-1a2b", "guest-xyz",
                "x".repeat(AGENT_NAME_MAX_LENGTH + 1), "名前です"])
            {
                const result = await AgentAccountUtil.register(name, undefined, nextAddress(), "test-agent");
                expect("error" in result, name).toBe(true);
            }
        });

        it("refuses a name anyone already has, agent or person", async () => {
            await registerAgent("Taken-Name");
            harness.connectUser({id: "alice-id", userName: "Alice"});

            for (const name of ["Taken-Name", "Alice"])
            {
                const result = await AgentAccountUtil.register(name, undefined, nextAddress(), "test-agent");
                expect("error" in result && result.error.includes("taken"), name).toBe(true);
            }
        });

        it("refuses the name helpers are called by, in any case, so that no agent can pass for one", async () => {
            for (const name of ["Helper", "helper", "HELPER"])
            {
                const result = await AgentAccountUtil.register(name, undefined, nextAddress(), "test-agent");
                expect("error" in result && result.error.includes("taken"), name).toBe(true);
            }
        });

        it("shares the guests' per-IP account cap, charged only for accounts made", async () => {
            const address = nextAddress();
            for (let i = 0; i < MAX_GUESTS_PER_CLIENT + 2; ++i)
                expect("error" in await AgentAccountUtil.register("no good", undefined, address, "cap-test")).toBe(true);

            for (let i = 0; i < MAX_GUESTS_PER_CLIENT; ++i)
                expect("key" in await AgentAccountUtil.register(`Capped-${i}`, undefined, address, "cap-test")).toBe(true);

            const refused = await AgentAccountUtil.register(`Capped-${MAX_GUESTS_PER_CLIENT}`, undefined, address,
                "cap-test");
            expect("error" in refused && refused.error.includes("Too many")).toBe(true);
        });
    });

    describe("presence", () => {
        it("puts an agent's player in a hub on its first request, marked as an agent", async () => {
            const agent = await arriveAgent("Bot-1");

            expect(currentRoomID(agent)).toBe(HUB_ID);
            expect(agent.isInSinglePlayerRoom).toBe(false);
            expect(playerMetadataOf(agent.user.id)[ObjectMetadataKeyEnumMap.AgentMark]).toBe("1");
            expect(eventsOf(agent).map(event => event.kind)).toEqual(["roomEntered"]);
        });

        it("tells the people in the room of the agent, marked", async () => {
            const human = await joinHuman("Alice");
            receivedSignals(human);

            const agent = await arriveAgent("Bot-1");

            const added = receivedSignals(human).filter(({signalType}) => signalType == "addObjectSignal");
            expect(added).toHaveLength(1);
            expect(added[0].signal.sourceUserID).toBe(agent.user.id);
            expect(added[0].signal.sourceUserName).toBe("Bot-1");
            expect(added[0].signal.metadata[ObjectMetadataKeyEnumMap.AgentMark]?.str).toBe("1");
        });

        it("keeps one presence across requests, and arrivals asked for together share one", async () => {
            const {dbUser} = await registerAgent("Bot-1");
            const [first, second] = await Promise.all([AgentPresenceUtil.attend(dbUser), AgentPresenceUtil.attend(dbUser)]);
            expect(second).toBe(first);
            expect(await AgentPresenceUtil.attend(dbUser)).toBe(first);
            expect(harness.getRoomParticipantCount(HUB_ID)).toBe(1);
        });

        it("counts a quiet agent as gone, until its next request comes in time", async () => {
            const {dbUser} = await registerAgent("Bot-1");
            const agent = await attendAgent(dbUser);
            expect(agent.isConnected()).toBe(true);

            vi.setSystemTime(Date.now() + AGENT_PRESENCE_IDLE_TIMEOUT_MS + 1);
            expect(agent.isConnected()).toBe(false);

            // Before the sweep has taken it out, a request revives the same presence.
            expect(await AgentPresenceUtil.attend(dbUser)).toBe(agent);
            expect(agent.isConnected()).toBe(true);
        });

        it("takes a quiet agent out when released, as the stale-connection sweep does", async () => {
            const {dbUser} = await registerAgent("Bot-1");
            const agent = await attendAgent(dbUser);

            vi.setSystemTime(Date.now() + AGENT_PRESENCE_IDLE_TIMEOUT_MS + 1);
            await UserSessionUtil.release(agent);

            expect(currentRoomID(agent)).toBeUndefined();
            expect(ServerUserManager.getSocketUserContext(agent.user.id)).toBeUndefined();

            const back = await attendAgent(dbUser);
            expect(back).not.toBe(agent);
            expect(currentRoomID(back)).toBe(HUB_ID);
        });

        it("takes the player out on leave, and a later request brings the agent back to its last room", async () => {
            harness.seedHub(OTHER_HUB_ID);
            const {dbUser} = await registerAgent("Bot-1");
            const agent = await attendAgent(dbUser);
            await AgentToolUtil.travel(agent, OTHER_HUB_ID);

            await AgentToolUtil.leave(agent);
            expect(currentRoomID(agent)).toBeUndefined();
            expect(harness.getRoomParticipantCount(OTHER_HUB_ID)).toBe(0);
            expect(agent.isConnected()).toBe(false);

            const back = await attendAgent(dbUser);
            expect(back).not.toBe(agent);
            expect(currentRoomID(back)).toBe(OTHER_HUB_ID);
        });
    });

    describe("the agent mark", () => {
        it("can be set by no signal, not even on one's own player", async () => {
            const human = await joinHuman("Alice");
            const roomID = ServerRoomManager.currentRoomIDByUserID[human.user.id];
            const playerId = harness.getPlayerObjectId(human)!;

            await dispatchAs(human, "setObjectMetadataSignal",
                new SetObjectMetadataSignal(roomID, playerId, ObjectMetadataKeyEnumMap.AgentMark, "1"));

            expect(playerMetadataOf(human.user.id)[ObjectMetadataKeyEnumMap.AgentMark]).toBeUndefined();
        });

        it("is never restored from stored metadata, which keeps the rest", async () => {
            const human = await joinHuman("Alice", HUB_ID, {
                [ObjectMetadataKeyEnumMap.AgentMark]: "1",
                [ObjectMetadataKeyEnumMap.SentMessage]: "still here",
            });

            const metadata = playerMetadataOf(human.user.id);
            expect(metadata[ObjectMetadataKeyEnumMap.AgentMark]).toBeUndefined();
            expect(metadata[ObjectMetadataKeyEnumMap.SentMessage]).toBe("still here");
        });
    });

    describe("what an agent hears", () => {
        it("others' arrivals, speech and departures, by name", async () => {
            const agent = await arriveAgent("Bot-1");
            eventsOf(agent);

            const human = await joinHuman("Alice");
            harness.sendObjectMessage(human, "hello there");
            await harness.disconnectUser(human);

            expect(eventsOf(agent).map(({kind, who, whoIsAgent, text}) => ({kind, who, whoIsAgent, text}))).toEqual([
                {kind: "arrival", who: "Alice", whoIsAgent: false, text: undefined},
                {kind: "speech", who: "Alice", whoIsAgent: false, text: "hello there"},
                {kind: "departure", who: "Alice", whoIsAgent: false, text: undefined},
            ]);
            // Each event is told once.
            expect(eventsOf(agent)).toEqual([]);
        });

        it("names another agent as one, and never repeats its own words back to it", async () => {
            const agent = await arriveAgent("Bot-1");
            const other = await arriveAgent("Bot-2");
            eventsOf(agent);
            eventsOf(other);

            await AgentToolUtil.say(other, "beep");
            await AgentToolUtil.say(agent, "boop");

            expect(eventsOf(agent)).toEqual([expect.objectContaining({kind: "speech", who: "Bot-2", whoIsAgent: true,
                text: "beep"})]);
            expect(eventsOf(other)).toEqual([expect.objectContaining({kind: "speech", who: "Bot-1", text: "boop"})]);
        });

        it("nothing of an admin in ghost mode, whom nobody sees: not in look, nor found by name, nor heard", async () => {
            const agent = await arriveAgent("Bot-1");
            eventsOf(agent);

            const ghost = harness.connectUser({id: "id-Ghost", userName: "Ghost", userType: UserTypeEnumMap.Admin,
                playerMetadata: {[ObjectMetadataKeyEnumMap.AdminPrefs]: AdminPrefsUtil.encode({ghostMode: true})}});
            await harness.joinRoom(ghost, HUB_ID);
            harness.sendObjectMessage(ghost, "boo");
            const seen = AgentToolUtil.look(agent) as any;
            expect(seen.people.some((person: any) => person.name == "Ghost")).toBe(false);
            expect(seen.room.people).toBe(1);
            expect("error" in (await AgentToolUtil.walkTo(agent, {person: "Ghost"}) as any)).toBe(true);
            await harness.disconnectUser(ghost);

            expect(eventsOf(agent)).toEqual([]);
        });

        it("names nobody as having placed what a ghost placed", () => {
            const inbox = new AgentInbox("me");
            const at = new ObjectTransform({x: 10, y: 1, z: 10}, {x: 0, y: 0, z: 1}, {x: 1, y: 1, z: 1});
            inbox.note("addObjectSignal", new AddObjectSignal("room", "id-Ghost", "Ghost",
                ObjectTypeConfigMap.getIndexByType("Player"), "ghost-player", at,
                {[ObjectMetadataKeyEnumMap.AdminPrefs]: new EncodableByteString(AdminPrefsUtil.encode({ghostMode: true}))}));
            inbox.note("addObjectSignal", new AddObjectSignal("room", "id-Ghost", "Ghost",
                ObjectTypeConfigMap.getIndexByType("Lamp"), "a-lamp", at, {}));

            expect(inbox.take()).toEqual([expect.objectContaining({kind: "objectAdded", id: "a-lamp", who: undefined,
                whoIsAgent: undefined})]);
        });

        it("keeps only the newest events once too many wait", () => {
            const inbox = new AgentInbox("me");
            inbox.note("roomChangeRejectedSignal", {reason: 0} as any);
            for (let i = 0; i < AGENT_INBOX_MAX_EVENTS + 5; ++i)
                inbox.noteRoomReloading();

            const events = inbox.take();
            expect(events).toHaveLength(AGENT_INBOX_MAX_EVENTS);
            expect(events.every(event => event.kind == "roomReloading")).toBe(true);
        });
    });

    describe("what happens in an agent's room without it", () => {
        // An agent owning REGULAR_ID, not in ThingsPool until a test brings it.
        async function agentAwayFromItsRoom(name: string): Promise<DBUser>
        {
            const {dbUser} = await registerAgent(name);
            const room = harness.seedRoom(REGULAR_ID, RoomTypeEnumMap.Regular);
            room.ownerUserID = dbUser.id as string;
            room.ownerUserName = name;
            dbUser.ownedRoomID = REGULAR_ID;
            return dbUser;
        }
        const shortly = () => new Promise(resolve => setTimeout(resolve, 0));
        const inMyRoom = (events: AgentEvent[]) => events.filter(event => event.inYourRoom)
            .map(({kind, who, text}) => ({kind, who, text}));

        it("is kept while the agent is away, and told as it next arrives, marked as its room's", async () => {
            const dbUser = await agentAwayFromItsRoom("Bot-1");

            const human = await joinHuman("Alice", REGULAR_ID);
            harness.sendObjectMessage(human, "nice tower");
            await harness.disconnectUser(human);
            await shortly();
            expect(harness.keptAwayEvents(dbUser.id as string)).toHaveLength(3);

            const agent = await attendAgent(dbUser);
            expect(inMyRoom(eventsOf(agent))).toEqual([
                {kind: "arrival", who: "Alice", text: undefined},
                {kind: "speech", who: "Alice", text: "nice tower"},
                {kind: "departure", who: "Alice", text: undefined},
            ]);
            // Told once.
            expect(harness.keptAwayEvents(dbUser.id as string)).toEqual([]);
        });

        it("is told at once while the agent is elsewhere in ThingsPool", async () => {
            const dbUser = await agentAwayFromItsRoom("Bot-1");
            const agent = await attendAgent(dbUser);
            expect(currentRoomID(agent)).toBe(HUB_ID);
            eventsOf(agent);

            const human = await joinHuman("Alice", REGULAR_ID);
            harness.sendObjectMessage(human, "anyone home?");
            await AgentAwayLogUtil.handOnAll();

            expect(inMyRoom(eventsOf(agent))).toEqual([
                {kind: "arrival", who: "Alice", text: undefined},
                {kind: "speech", who: "Alice", text: "anyone home?"},
            ]);
            expect(harness.keptAwayEvents(dbUser.id as string)).toEqual([]);
        });

        it("keeps nothing while the agent is in its room, hearing all of it itself", async () => {
            const agent = await agentWithOwnRoom("Bot-1", REGULAR_ID);
            eventsOf(agent);

            const human = await joinHuman("Alice", REGULAR_ID);
            harness.sendObjectMessage(human, "hello");
            await AgentAwayLogUtil.handOnAll();

            const events = eventsOf(agent);
            expect(events).toContainEqual(expect.objectContaining({kind: "speech", who: "Alice", text: "hello"}));
            expect(inMyRoom(events)).toEqual([]);
            expect(harness.keptAwayEvents(agent.user.id)).toEqual([]);
        });

        it("watches no room a person owns", async () => {
            const room = harness.seedRoom(REGULAR_ID, RoomTypeEnumMap.Regular);
            room.ownerUserID = "id-Owner";
            room.ownerUserName = "Owner";
            harness.connectUser({id: "id-Owner", userName: "Owner"});
            vi.mocked(DBAgentAwayEventsUtil.append).mockClear();

            const human = await joinHuman("Alice", REGULAR_ID);
            harness.sendObjectMessage(human, "hello");
            await harness.disconnectUser(human);
            await AgentAwayLogUtil.handOnAll();

            expect(DBAgentAwayEventsUtil.append).not.toHaveBeenCalled();
        });
    });

    describe("helpers", () => {
        // An NPC an admin stood a little in from the hub's entrance (and this far to one side), which the server then
        // plays as a helper (unless its personality is Idle). Stood before the agent arrives, so that the room it is sent
        // has it.
        async function standHelper(name: string, personality: string = "guide", side: number = 0): Promise<string>
        {
            if (ServerRoomManager.roomRuntimeMemories[HUB_ID] == undefined)
                await harness.loadRoom(HUB_ID);
            const room = ServerRoomManager.roomRuntimeMemories[HUB_ID].room;
            const {pos, dir} = room.objectById[ENTRANCE_DOOR_OBJECT_ID].transform;
            const objectId = `helperNpc-${name}`;
            room.objectById[objectId] = new AddObjectSignal(HUB_ID, "admin", "Admin",
                ObjectTypeConfigMap.getIndexByType("Npc"), objectId, new ObjectTransform(
                    {x: pos.x + 3 * dir.x - side * dir.z,
                        y: DoorObjectTypeConfig.util.getFloorY(room.objectById[ENTRANCE_DOOR_OBJECT_ID]),
                        z: pos.z + 3 * dir.z + side * dir.x}, {x: 0, y: 1, z: 0}, {x: 1, y: 1, z: 1}),
                {[ObjectMetadataKeyEnumMap.Label]: new EncodableByteString(name),
                    [ObjectMetadataKeyEnumMap.BehaviorPrefs]: new EncodableByteString(BehaviorPrefsUtil.encode(
                        {...BehaviorPrefsUtil.decode(""), personality: NpcPersonalityMap.read(personality)}))});
            await HelperAgentUtil.tick();
            return objectId;
        }

        afterEach(async () => {
            await HelperAgentUtil.stop();
        });

        it("are seen among the people, marked as guides, and not among the things placed", async () => {
            const npc = await standHelper("Mira");
            const agent = await arriveAgent("Looker");

            const seen = AgentToolUtil.look(agent) as any;
            expect(seen.people.find((person: any) => person.name == "Mira")).toMatchObject({isAgent: true, isGuide: true});
            expect(seen.objects.some((obj: any) => obj.id == npc)).toBe(false);
        });

        it("are told by name how they look, as people see them", async () => {
            const npc = await standHelper("Mira");
            const agent = await arriveAgent("Admirer");

            const seen = AgentAppearanceUtil.look(agent, "mira") as any;
            expect(seen.name).toBe("Mira");
            const drawn: any = {};
            ObjectCompositionUtil.decode(roomOf(agent).objectById[npc], drawn, []);
            expect(seen.appearance.head.shape).toBe(drawn.types.head + 1);
            expect(seen.appearance.bottom.color).toBe(ColorUtil.rgbToHex(drawn.colors.bottom));
        });

        it("aren't played when Idle, and are then seen among the things placed, still and silent, and not among the "
            + "people", async () => {
            const npc = await standHelper("Statue", "idle");
            const agent = await arriveAgent("Looker");

            const seen = AgentToolUtil.look(agent) as any;
            expect(seen.people.some((person: any) => person.name == "Statue")).toBe(false);
            expect(seen.objects.find((obj: any) => obj.id == npc)).toMatchObject({type: "npc", text: "Statue",
                note: expect.stringContaining("nobody plays")});
        });

        it("are heard as anyone is, while their own steps and turns aren't told as edits", async () => {
            const npc = await standHelper("Mira");
            const agent = await arriveAgent("Listener");
            eventsOf(agent);

            const roomContext = ServerRoomManager.socketRoomContexts[HUB_ID];
            const room = ServerRoomManager.roomRuntimeMemories[HUB_ID].room;
            roomContext.multicastSignal("setObjectTransformSignal", new SetObjectTransformSignal(HUB_ID, npc,
                new ObjectTransform({...room.objectById[npc].transform.pos, x: room.objectById[npc].transform.pos.x + 0.4},
                    {x: 0, y: 1, z: 0}, {x: 1, y: 1, z: 1}), true));
            roomContext.multicastSignal("setObjectMetadataSignal", new SetObjectMetadataSignal(HUB_ID, npc,
                ObjectMetadataKeyEnumMap.Facing, NpcFacingUtil.encode(45)));
            roomContext.multicastSignal("setObjectMetadataSignal", new SetObjectMetadataSignal(HUB_ID, npc,
                ObjectMetadataKeyEnumMap.SentMessage, "Hi Listener, welcome!"));

            expect(eventsOf(agent).map(({kind, who, whoIsAgent, text}) => ({kind, who, whoIsAgent, text})))
                .toEqual([{kind: "speech", who: "Mira", whoIsAgent: true, text: "Hi Listener, welcome!"}]);
        });

        it("are shown to an agent's camera saying what they say, which the room it is sent doesn't keep", async () => {
            const npc = await standHelper("Mira");
            const agent = await arriveAgent("Snapper");
            flush(10);
            await HelperAgentUtil.tick();
            await HelperAgentUtil.tick();
            const saying = HelperAgentUtil.getHelpers(HUB_ID)[0].saying;
            expect(saying).toMatch(/Snapper/);

            const page = new MockSocket(new User("camera-page", "", UserTypeEnumMap.Guest, "", ""));
            AgentCameraUtil.admit(page as any, agent);

            const shown = cameraReceived(agent, page);
            expect(shown[0].signalType).toBe("roomChangedSignal");
            expect(shown.some(({signalType, signal}) => signalType == "setObjectMetadataSignal" && signal.objectId == npc
                && signal.metadataKey == ObjectMetadataKeyEnumMap.SentMessage && signal.metadataValue == saying)).toBe(true);
        });

        it("are seen chatting with each other now and then, each with whom it chats with", async () => {
            await standHelper("Mira", "jester", 1.5);
            await standHelper("Bo", "sage", -1.5);
            const agent = await arriveAgent("Watcher");
            for (let second = 0; second < 200; ++second)
            {
                flush(5);
                HelperAgentUtil.stepAll(1);
                await HelperAgentUtil.tick();
                if (HelperAgentUtil.getHelpers(HUB_ID).some(helper => helper.chattingWith != undefined))
                    break;
            }

            const seen = AgentToolUtil.look(agent) as any;
            expect(seen.people.find((person: any) => person.name == "Mira")).toMatchObject({isGuide: true,
                chattingWith: "Bo"});
            expect(seen.people.find((person: any) => person.name == "Bo")).toMatchObject({isGuide: true,
                chattingWith: "Mira"});
        });

        it("are seen looking now and then at something placed near them, by the thing's id", async () => {
            await standHelper("Mira");
            const agent = await arriveAgent("Watcher");
            // Far into the room, off the helper's home, which it goes back to between wanders.
            await flushUntil(AgentToolUtil.walkTo(agent, {row: 20, column: 33, layer: 0}));
            let seen: any = undefined;
            // Its first look comes some minutes after it is found.
            for (let second = 0; second < 360 && seen == undefined; ++second)
            {
                flush(5);
                HelperAgentUtil.stepAll(1);
                await HelperAgentUtil.tick();
                if (HelperAgentUtil.getHelpers(HUB_ID).some(helper => helper.lookingAt != undefined))
                    seen = AgentToolUtil.look(agent) as any;
            }

            expect(seen?.people.find((person: any) => person.name == "Mira")).toMatchObject({isGuide: true,
                lookingAt: ENTRANCE_DOOR_OBJECT_ID});
        });

        it("are seen standing still for whoever types one a line, by their name", async () => {
            await standHelper("Mira");
            const agent = await arriveAgent("Watcher");
            const alice = await joinHuman("Alice");
            const mira = () => (AgentToolUtil.look(agent) as any).people.find((person: any) => person.name == "Mira");

            await setActivity(alice, SpeakerActivityEnumMap.Typing);
            expect(mira()).toMatchObject({isGuide: true, waitingFor: "Alice"});
            await setActivity(alice, SpeakerActivityEnumMap.None);
            expect(mira().waitingFor).toBeUndefined();
        });

        it("stand still for an agent typing one a line, until it says it, or its typing runs out", async () => {
            await standHelper("Mira");
            const agent = await arriveAgent("Typist");
            const watcher = await arriveAgent("Watcher");
            const mira = () => (AgentToolUtil.look(watcher) as any).people.find((person: any) => person.name == "Mira");

            await AgentToolUtil.typing(agent, true);
            expect(mira()).toMatchObject({waitingFor: "Typist"});
            await AgentToolUtil.say(agent, "");
            expect(mira().waitingFor).toBeUndefined();

            await AgentToolUtil.typing(agent, true);
            expect(mira()).toMatchObject({waitingFor: "Typist"});
            vi.setSystemTime(Date.now() + AGENT_TYPING_EXPIRATION_MS);
            AgentTypingUtil.expireAll();
            expect(mira().waitingFor).toBeUndefined();
        });

        it("can be walked up to by name", async () => {
            await standHelper("Mira");
            const agent = await arriveAgent("Walker");

            const walked = await flushUntil(AgentToolUtil.walkTo(agent, {person: "mira"})) as any;
            expect(walked.outcome).toBe("arrived");
            const helper = HelperAgentUtil.getHelpers(HUB_ID)[0];
            const feet = positionOf(agent);
            expect(Math.hypot(feet.x - helper.at.x, feet.z - helper.at.z)).toBeLessThan(2);
        });

        it("tell an agent's say that one heard it", async () => {
            await standHelper("Mira");
            const agent = await arriveAgent("Talker");

            expect(await AgentToolUtil.say(agent, "Hello!")).toMatchObject({saying: "Hello!", heardBy: "Mira",
                note: expect.stringContaining("few seconds")});
        });

        it("tell an agent's say, when none heard it, how far off the nearest is and how to be heard", async () => {
            // Well to one side of the entrance the agent comes in by: out of earshot.
            await standHelper("Mira", "guide", 12);
            const agent = await arriveAgent("Caller");

            const unheard = await AgentToolUtil.say(agent, "Anyone here?") as any;
            expect(unheard.heardBy).toBeUndefined();
            expect(unheard.note).toMatch(new RegExp(`^No guide heard you\\. The nearest, Mira, is \\d+ cells away: a guide `
                + `hears you within ${HEARING_DISTANCE / VOXEL_CELL_SIZE} cells on its own floor`));
            // Named, it hears from anywhere in the room; a cleared bubble is no line.
            expect((await AgentToolUtil.say(agent, "Mira, are you there?") as any).heardBy).toBe("Mira");
            expect(await AgentToolUtil.say(agent, "")).toEqual({saying: ""});
        });

        it("hear what an agent said that none heard once it walks up to one with its bubble still showing it",
            async () => {
            await standHelper("Mira", "guide", 12);
            const agent = await arriveAgent("Caller");
            const mira = () => (AgentToolUtil.look(agent) as any).people.find((person: any) => person.name == "Mira");

            expect((await AgentToolUtil.say(agent, "Anyone here?") as any).note).toContain("(the first you come that "
                + "near hears this while your bubble still shows it)");
            await HelperAgentUtil.tick();
            expect(mira().thinking).toBeUndefined();

            expect(await flushUntil(AgentToolUtil.walkTo(agent, {person: "mira"}))).toMatchObject({outcome: "arrived"});
            await HelperAgentUtil.tick();
            expect(mira().thinking).toBe(true);
        });
    });

    describe("dollar bills", () => {
        // A bill come into the agent's room at last, nearest it first.
        function waitForBill(agent: AgentUserContext): AddObjectSignal
        {
            const now = Date.now();
            vi.spyOn(Math, "random").mockReturnValue(0);
            DollarBillUtil.stepAll(0.2);
            vi.spyOn(Date, "now").mockReturnValue(now + SPAWN_INTERVAL_MS[1]);
            DollarBillUtil.stepAll(0.2);
            vi.mocked(Date.now).mockRestore();
            vi.mocked(Math.random).mockRestore();
            return Object.values(AgentRoomUtil.getCurrentRoom(agent)!.objectById)
                .find(obj => obj.objectTypeIndex == ObjectTypeConfigMap.getIndexByType("DollarBill"))!;
        }

        it("look lists them by where they are and tells how many dollars the agent holds", async () => {
            const agent = await arriveAgent("Bot-1");
            expect((AgentToolUtil.look(agent) as any).bills).toEqual([]);
            expect((AgentToolUtil.look(agent) as any).you.dollars).toBe(0);

            const bill = waitForBill(agent);
            const [listed] = (AgentToolUtil.look(agent) as any).bills;
            expect(listed.at).toEqual(AgentGridUtil.toGridPosition(bill.transform.pos));
            expect(listed.distance).toBeGreaterThan(0);
        });

        it("are collected by coming near one and facing it, as a person does, whats_new telling how many it holds then", async () => {
            const agent = await arriveAgent("Bot-1");
            const bill = waitForBill(agent);
            agent.inbox.take();

            // Out on the floor, an arrival standing in the doorway, in the wall, with its back to the bill.
            const {transform} = AgentRoomUtil.getMyPlayer(agent)!;
            Object.assign(transform.pos, {x: 16, z: 16});
            Object.assign(transform.dir, {x: 1, y: 0, z: 0});
            Object.assign(bill.transform.pos, {x: 18, z: 16});
            DollarBillUtil.stepAll(0.2);
            expect((AgentToolUtil.look(agent) as any).you.dollars).toBe(0);

            // A player's direction points behind it.
            Object.assign(transform.dir, {x: -1, y: 0, z: 0});
            DollarBillUtil.stepAll(0.2);
            expect((AgentToolUtil.look(agent) as any).bills).toEqual([]);
            expect((AgentToolUtil.look(agent) as any).you.dollars).toBe(1);
            expect(agent.inbox.take()).toEqual([expect.objectContaining({kind: "dollarCollected", dollars: 1})]);
        });

        it("come to an agent that comes back as a reward, which whats_new tells apart from collecting one", async () => {
            const {dbUser} = await registerAgent("Bot-1");
            const first = await attendAgent(dbUser);
            expect(first.inbox.take().map(event => event.kind)).not.toContain("loginReward");
            expect((AgentToolUtil.look(first) as any).you.dollars).toBe(0);
            await AgentPresenceUtil.leave(first);

            dbUser.lastLoginRewardAt = Date.now() - LOGIN_REWARD_INTERVAL_MS;
            const back = await attendAgent(dbUser);
            const events = back.inbox.take();
            expect(events).toContainEqual(expect.objectContaining({kind: "loginReward", dollars: LOGIN_REWARD_DOLLARS, reward: LOGIN_REWARD_DOLLARS}));
            expect(events.map(event => event.kind)).not.toContain("dollarCollected");
            expect((AgentToolUtil.look(back) as any).you.dollars).toBe(LOGIN_REWARD_DOLLARS);

            await AgentPresenceUtil.leave(back);
            const sameLogin = await attendAgent(dbUser);
            expect(sameLogin.inbox.take().map(event => event.kind)).not.toContain("loginReward");
            expect((AgentToolUtil.look(sameLogin) as any).you.dollars).toBe(LOGIN_REWARD_DOLLARS);
        });

        // Flushes as the sockets server's interval does, which is when a bill goes to whoever has it in reach, until the
        // tool answers; then, with any bill left, until that one is at rest.
        async function collect(agent: AgentUserContext, midway: (flushes: number) => void = () => {}): Promise<any>
        {
            let answer: any = undefined;
            void AgentInventoryUtil.collectBill(agent).then(result => { answer = result; });
            for (let i = 0; i < 600 && answer == undefined; ++i)
            {
                midway(i);
                flush(1);
                DollarBillUtil.stepAll(0.2);
                await new Promise(resolve => setImmediate(resolve));
            }
            expect(answer).toBeDefined();
            return answer;
        }

        async function arriveInTheOpen(name: string): Promise<AgentUserContext>
        {
            const agent = await arriveAgent(name);
            await flushUntil(AgentToolUtil.walkTo(agent, {row: 32, column: 32}));
            return agent;
        }

        // Lying still where it fell, past the reach of anyone, as it was spawned.
        function settle(agent: AgentUserContext, bill: AddObjectSignal): void
        {
            for (let i = 0; i < 300 && DollarBillUtil.getCatchUpSignals(currentRoomID(agent)!).length > 0; ++i)
            {
                vi.setSystemTime(Date.now() + 200);
                DollarBillUtil.stepAll(0.2);
            }
            expect(roomOf(agent).objectById[bill.objectId]).toBe(bill);
        }

        const flatDistance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

        it("are collected by collect_bill, which walks to the nearest and stops as soon as it has it", async () => {
            const agent = await arriveInTheOpen("Collector");
            const bill = waitForBill(agent);
            settle(agent, bill);
            const lay = {...bill.transform.pos};
            agent.inbox.take();

            const answer = await collect(agent);

            expect(answer).toMatchObject({collected: true, dollars: 1});
            expect(answer.you.at).toBeDefined();
            expect((AgentToolUtil.look(agent) as any).bills).toEqual([]);
            expect(agent.inventory[InventoryItemTypeEnumMap.Dollar]).toBe(1);
            expect(agent.inbox.take().map(event => event.kind)).toContain("dollarCollected");
            // It comes to whoever has it in reach, so there was no walking the rest of the way: it is had a step or two
            // inside the reach.
            expect(flatDistance(positionOf(agent), lay)).toBeGreaterThan(DOLLAR_BILL_REACH - 2);
            expect(flatDistance(positionOf(agent), lay)).toBeLessThan(DOLLAR_BILL_REACH + 1);
        });

        // Another bill, put straight into the room: the server spawns no more than one in a while.
        function addBill(room: Room, like: AddObjectSignal, pos: Vec3): AddObjectSignal
        {
            const bill = new AddObjectSignal(room.id, like.sourceUserID, like.sourceUserName, like.objectTypeIndex, `bill-${pos.x}`,
                new ObjectTransform(pos, {...like.transform.dir}, {...like.transform.scale}), {});
            room.objectById[bill.objectId] = bill;
            return bill;
        }

        it("go to the agent one at a time, the nearest first", async () => {
            const agent = await arriveInTheOpen("Nearest");
            const bill = waitForBill(agent);
            settle(agent, bill);
            const room = roomOf(agent);
            const me = positionOf(agent);
            Object.assign(bill.transform.pos, {x: me.x + 12, z: me.z});
            const nearer = addBill(room, bill, {x: me.x + 7, y: bill.transform.pos.y, z: me.z});
            const walk = vi.spyOn(AgentBodyUtil, "walk").mockImplementationOnce(async () => {
                agent.inventory[InventoryItemTypeEnumMap.Dollar] = 1;
                return "arrived";
            });

            await AgentInventoryUtil.collectBill(agent);

            expect(walk).toHaveBeenCalledTimes(1);
            expect(walk.mock.calls[0][2]?.faceToward).toBe(nearer.transform.pos);
            walk.mockRestore();
            delete room.objectById[nearer.objectId];
        });

        it("says when there is none to go after, without moving", async () => {
            const agent = await arriveInTheOpen("Early");
            const before = positionOf(agent);
            expect((await AgentInventoryUtil.collectBill(agent) as any).error).toMatch(/no bills in this room/);
            expect(positionOf(agent)).toEqual(before);
        });

        it("says so when someone else gets there first", async () => {
            const agent = await arriveInTheOpen("Slow");
            const bill = waitForBill(agent);
            settle(agent, bill);
            const room = roomOf(agent);

            const answer = await collect(agent, flushes => {
                if (flushes == 0)
                    ServerObjectManager.removeObjectAsServer(room, agent.user, new RemoveObjectSignal(room.id, bill.objectId));
            });

            expect(answer).toMatchObject({collected: false, dollars: 0});
            expect(answer.note).toMatch(/someone else got there first/);
        });

        it("goes on to another bill if it finds no way to the nearest", async () => {
            const agent = await arriveInTheOpen("Patient");
            const bill = waitForBill(agent);
            const room = roomOf(agent);
            const other = addBill(room, bill, {x: bill.transform.pos.x + 4, y: bill.transform.pos.y, z: bill.transform.pos.z});
            const walk = vi.spyOn(AgentBodyUtil, "walk").mockImplementationOnce(async () => "noPath")
                .mockImplementationOnce(async (_ctx, _goal, options) => {
                    agent.inventory[InventoryItemTypeEnumMap.Dollar] = 1;
                    expect(options?.until?.()).toBe(false);
                    return "arrived";
                });

            const answer = await AgentInventoryUtil.collectBill(agent) as any;

            expect(answer).toMatchObject({collected: true, dollars: 1});
            expect(walk).toHaveBeenCalledTimes(2);
            expect(walk.mock.calls[0][2]?.faceToward).not.toBe(walk.mock.calls[1][2]?.faceToward);
            walk.mockRestore();
            delete room.objectById[other.objectId];
        });

        it("walks after a bill the wind moved, but not for ever", async () => {
            const agent = await arriveInTheOpen("Chaser");
            const bill = waitForBill(agent);
            settle(agent, bill);
            const walk = vi.spyOn(AgentBodyUtil, "walk").mockImplementation(async () => "arrived");

            const answer = await AgentInventoryUtil.collectBill(agent) as any;

            expect(walk).toHaveBeenCalledTimes(MAX_BILL_TRIES);
            expect(answer).toMatchObject({collected: false, dollars: 0});
            expect(answer.note).toMatch(/out of reach/);
            walk.mockRestore();
        });

        it("gives up at once on a walk that was cut short, as by another tool", async () => {
            const agent = await arriveInTheOpen("Hasty");
            const bill = waitForBill(agent);
            settle(agent, bill);
            for (const outcome of ["interrupted", "timedOut"] as const)
            {
                const walk = vi.spyOn(AgentBodyUtil, "walk").mockImplementation(async () => outcome);
                expect(await AgentInventoryUtil.collectBill(agent)).toMatchObject({collected: false});
                expect(walk).toHaveBeenCalledTimes(1);
                walk.mockRestore();
            }
        });

        it("tell whats_new nothing as they come and go, being nobody's edit", async () => {
            const agent = await arriveAgent("Bot-1");
            const other = await arriveAgent("Bot-2");
            agent.inbox.take();

            const bill = waitForBill(agent);
            const {transform} = AgentRoomUtil.getMyPlayer(other)!;
            Object.assign(transform.pos, {x: 16, z: 16});
            Object.assign(transform.dir, {x: -1, y: 0, z: 0});
            Object.assign(bill.transform.pos, {x: 18, z: 16});
            DollarBillUtil.stepAll(0.2);
            expect(other.inventory[InventoryItemTypeEnumMap.Dollar]).toBe(1);
            expect(agent.inbox.take()).toEqual([]);
        });
    });

    describe("cannons", () => {
        const FLOOR: AgentFace = {row: 20, column: 20, layer: -1, side: "up"};
        const DOLLAR = InventoryItemTypeEnumMap.Dollar;
        const cannonsIn = (room: Room) => Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex == ObjectTypeConfigMap.getIndexByType("Cannon"));
        const stateOf = (room: Room, id: string) => CannonStateUtil.getObjectState(room.objectById[id]);

        it("add_object sets one on a floor or a wall for its price, which whoever holds less is refused", async () => {
            const human = await joinHuman("Alice");
            const agent = await arriveAgent("Gunner");
            agent.inventory[DOLLAR] = CANNON_PRICE_DOLLARS - 1;
            const refused = await AgentObjectUtil.addObject(agent, {type: "cannon", on: FLOOR}) as any;
            expect(refused.error).toContain(`costs $${CANNON_PRICE_DOLLARS}`);
            expect(refused.error).toContain(`hold $${CANNON_PRICE_DOLLARS - 1}`);
            expect(cannonsIn(roomOf(agent))).toEqual([]);
            expect(agent.inventory[DOLLAR]).toBe(CANNON_PRICE_DOLLARS - 1);

            agent.inventory[DOLLAR] = CANNON_PRICE_DOLLARS + 2;
            const ceiling = await AgentObjectUtil.addObject(agent, {type: "cannon",
                on: {row: 20, column: 20, layer: STOREY_FLOOR_COLLISION_LAYER, side: "down"}}) as any;
            expect(ceiling.error).toMatch(/only on a floor or a wall/);
            expect(agent.inventory[DOLLAR]).toBe(CANNON_PRICE_DOLLARS + 2);

            receivedSignals(human);
            const result = await AgentObjectUtil.addObject(agent, {type: "cannon", on: FLOOR}) as any;
            expect(result).toEqual(expect.objectContaining({spent: CANNON_PRICE_DOLLARS, dollars: 2}));
            expect(result.added).toEqual(expect.objectContaining({type: "cannon", on: FLOOR, switchedOn: true,
                ballsLeft: CANNON_BALL_COUNT, by: "Gunner"}));
            expect(result.added.note).toContain(`${CANNON_MAX_RANGE / VOXEL_CELL_SIZE} cells`);
            expect(agent.inventory[DOLLAR]).toBe(2);
            // The room is sent it as a person's is, and the next one is refused for want of dollars.
            expect(receivedSignals(human).filter(({signalType}) => signalType == "addObjectSignal")).toHaveLength(1);
            expect((await AgentObjectUtil.addObject(agent, {type: "cannon",
                on: {row: 24, column: 24, layer: -1, side: "up"}}) as any).error).toContain(`hold $2`);

            // On a wall too.
            agent.inventory[DOLLAR] = CANNON_PRICE_DOLLARS;
            const onWall = await AgentObjectUtil.addObject(agent, {type: "cannon",
                on: {row: 1, column: 20, layer: 3, side: "south"}}) as any;
            expect(onWall.added).toEqual(expect.objectContaining({type: "cannon"}));
            expect(agent.inventory[DOLLAR]).toBe(0);
        });

        it("edit_object switches one off and on, move_object rehangs it, and remove_object takes it for good", async () => {
            const agent = await arriveAgent("Gunner");
            agent.inventory[DOLLAR] = CANNON_PRICE_DOLLARS;
            const {id} = (await AgentObjectUtil.addObject(agent, {type: "cannon", on: FLOOR}) as any).added;
            const room = roomOf(agent);

            const off = await AgentObjectUtil.editObject(agent, {id, switchedOn: false}) as any;
            expect(off.edited).toEqual(expect.objectContaining({switchedOn: false, ballsLeft: CANNON_BALL_COUNT}));
            expect(stateOf(room, id).on).toBe(false);
            expect((await AgentObjectUtil.editObject(agent, {id, switchedOn: true}) as any).edited.switchedOn).toBe(true);
            // Only a cannon has a switch.
            const lamp = (await AgentObjectUtil.addObject(agent, {type: "lamp",
                on: {row: 1, column: 30, layer: 4, side: "south"}}) as any).added;
            expect((await AgentObjectUtil.editObject(agent, {id: lamp.id, switchedOn: false}) as any).error).toMatch(/no switch/);

            const there: AgentFace = {row: 30, column: 30, layer: -1, side: "up"};
            expect((await AgentObjectUtil.moveObject(agent, id, there) as any).moved.on).toEqual(there);
            expect((await AgentObjectUtil.moveObject(agent, id,
                {row: 30, column: 30, layer: STOREY_FLOOR_COLLISION_LAYER, side: "down"}) as any).error)
                .toMatch(/only on a floor or a wall/);

            expect(await AgentObjectUtil.removeObject(agent, id)).toEqual({removed: id});
            expect(agent.inventory[DOLLAR]).toBe(0);
        });

        it("look lists a room's cannons with their switch and the balls they have left, and the balls in the air", async () => {
            const agent = await arriveAgent("Watcher");
            const room = roomOf(agent);
            agent.inventory[DOLLAR] = CANNON_PRICE_DOLLARS;
            const {id} = (await AgentObjectUtil.addObject(agent, {type: "cannon", on: FLOOR}) as any).added;
            expect((AgentToolUtil.look(agent) as any).cannonBalls).toEqual([]);
            // As the server has it once it has fired a few.
            room.objectById[id].metadata[ObjectMetadataKeyEnumMap.CannonState] = new EncodableByteString(
                CannonStateUtil.encode({...CannonStateUtil.decode(""), ballsLeft: 13}));
            expect((AgentToolUtil.look(agent) as any).objects).toContainEqual(expect.objectContaining({id, type: "cannon",
                switchedOn: true, ballsLeft: 13}));

            const at = {x: 12.25, y: 2.1, z: 14.25};
            expect(CannonBallUtil.launch(room, at, {x: CANNON_BALL_SPEED, y: 0, z: 0})).toBe(true);
            // One far out of the room is no one's to mind.
            expect(CannonBallUtil.launch(room, {x: -10, y: 2, z: 14}, {x: -CANNON_BALL_SPEED, y: 0, z: 0})).toBe(true);
            const {cannonBalls} = AgentToolUtil.look(agent) as any;
            expect(cannonBalls).toHaveLength(1);
            expect(cannonBalls[0].at).toEqual(AgentGridUtil.toGridPosition(at));
            expect(cannonBalls[0].goingBy).toEqual({rows: 0, columns: CANNON_BALL_SPEED / VOXEL_CELL_SIZE, layers: 0});
            expect(cannonBalls[0].distance).toBeGreaterThan(0);
        });

        it("a ball's burst throws an agent's body, which the server moves, and whats_new tells it so", async () => {
            const agent = await arriveAgent("Target");
            const room = roomOf(agent);
            // Walked out to the middle of the room, where it stands with open floor all round.
            await flushUntil(AgentToolUtil.walkTo(agent, {row: 32, column: 32}));
            agent.inbox.take();
            const before = positionOf(agent);

            expect(CannonBallUtil.launch(room, {x: before.x - 2, y: before.y, z: before.z},
                {x: CANNON_BALL_SPEED, y: 0, z: 0})).toBe(true);
            for (let i = 0; i < 10; ++i)
            {
                vi.setSystemTime(Date.now() + 200);
                AgentBodyUtil.stepAll(0.2);
                CannonBallUtil.stepAll(0.2);
            }
            expect(eventsOf(agent).map(event => event.kind)).toEqual(["cannonBallHit"]);
            // Thrown far on along the ball's way, which the server believes of its own throw.
            expect(positionOf(agent).x).toBeGreaterThan(before.x + 2 * PLAYER_HEIGHT);
            expect(PlayerMotionCheckUtil.isTrusted(agent)).toBe(true);
            expect(Math.abs(positionOf(agent).z - before.z)).toBeLessThan(0.1);
            expect((AgentToolUtil.look(agent) as any).cannonBalls).toEqual([]);
            // No bill for a ball that threw someone.
            expect((AgentToolUtil.look(agent) as any).bills).toEqual([]);
        });

        it("tells of the server's own words about a cannon as no one's edit, and of a switch thrown as one", async () => {
            const human = await joinHuman("Alice");
            const agent = await arriveAgent("Watcher");
            const room = roomOf(agent);
            human.socketUserContext.inventory[DOLLAR] = CANNON_PRICE_DOLLARS;
            agent.inbox.take();
            const id = "alices-cannon";
            await dispatchAs(human, "addObjectSignal", new AddObjectSignal(room.id, human.user.id, human.user.userName,
                ObjectTypeConfigMap.getIndexByType("Cannon"), id, new ObjectTransform({x: 10.5, y: 0, z: 10.5},
                    {x: 0, y: 1, z: 0}, {x: 1, y: 1, z: 1}), {[ObjectMetadataKeyEnumMap.CannonState]:
                    new EncodableByteString(CannonStateUtil.encodeSwitch(true))}));
            expect(eventsOf(agent)).toContainEqual(expect.objectContaining({kind: "objectAdded", id, type: "cannon", who: "Alice"}));

            // Played by the server for a while: turning, counting down, telling the room.
            vi.spyOn(Math, "random").mockReturnValue(0);
            for (let i = 0; i < 60; ++i)
            {
                vi.setSystemTime(Date.now() + 200);
                CannonUtil.stepAll(0.2);
            }
            vi.mocked(Math.random).mockRestore();
            expect(eventsOf(agent).filter(event => event.kind == "objectChanged")).toEqual([]);

            await dispatchAs(human, "setObjectMetadataSignal", new SetObjectMetadataSignal(room.id, id,
                ObjectMetadataKeyEnumMap.CannonState, CannonStateUtil.encodeSwitch(false)));
            expect(eventsOf(agent)).toContainEqual(expect.objectContaining({kind: "objectChanged", id, type: "cannon"}));
        });

        it("walk_to goes round a cannon in the way, which is as solid as a block, and stops beside one it is sent into",
            async () => {
            const agent = await arriveAgent("Walker");
            agent.inventory[DOLLAR] = CANNON_PRICE_DOLLARS;
            await flushUntil(AgentToolUtil.walkTo(agent, {row: 32, column: 28, layer: 0}));
            // One on the straight way east, switched off so that it only stands there.
            const {id} = (await AgentObjectUtil.addObject(agent, {type: "cannon",
                on: {row: 32, column: 34, layer: -1, side: "up"}}) as any).added;
            await AgentObjectUtil.editObject(agent, {id, switchedOn: false});
            const cannon = roomOf(agent).objectById[id];
            const box = PhysicsColliderStateUtil.getObjectColliderState(cannon.objectTypeIndex, cannon.transform)!.hitbox;
            const inCannon = () => Geometry3DUtil.AABBsOverlap(box, {center: positionOf(agent),
                halfSize: {x: PLAYER_RADIUS_XZ, y: 0.5 * PLAYER_HEIGHT, z: PLAYER_RADIUS_XZ}});
            const from = positionOf(agent);
            expect(Math.abs(cannon.transform.pos.z - from.z)).toBeLessThan(0.5 + PLAYER_RADIUS_XZ);

            const walking = AgentToolUtil.walkTo(agent, {row: 32, column: 40, layer: 0});
            let settled = false;
            let aside = 0;
            void walking.then(() => { settled = true; });
            for (let i = 0; i < 400 && !settled; ++i)
            {
                flush(1);
                await new Promise(resolve => setImmediate(resolve));
                aside = Math.max(aside, Math.abs(positionOf(agent).z - from.z));
                expect(inCannon()).toBe(false);
            }
            expect((await walking as any).outcome).toBe("arrived");
            expect(positionOf(agent).x).toBeGreaterThan(cannon.transform.pos.x + 1);
            expect(aside).toBeGreaterThan(0.4);

            // Sent to the cells it stands on: as near as a body can stand.
            const result = await flushUntil(AgentToolUtil.walkTo(agent, {row: 32, column: 34, layer: 0})) as any;
            expect(result.outcome).toBe("arrived");
            expect(inCannon()).toBe(false);
            expect(Math.hypot(positionOf(agent).x - cannon.transform.pos.x, positionOf(agent).z - cannon.transform.pos.z))
                .toBeLessThan(2);
        });
    });

    describe("tools", () => {
        it("look tells the room, where the agent stands, and the people nearest it with their speech", async () => {
            const human = await joinHuman("Alice");
            harness.sendObjectMessage(human, "hi bot");
            await joinHuman("Bob");
            const agent = await arriveAgent("Bot-1");

            const seen = AgentToolUtil.look(agent) as any;
            // Tagged, so that the people who open a link an agent passed on are counted apart.
            expect(seen.room).toEqual({id: HUB_ID, type: "Hub", owner: null, isYours: false, people: 3,
                link: `http://localhost:3000/${HUB_ID}?ref=via-agent`});
            expect(seen.you.name).toBe("Bot-1");
            expect(Object.keys(seen.you.at).sort()).toEqual(["column", "layer", "row"]);

            expect(seen.people.map((person: any) => person.name).sort()).toEqual(["Alice", "Bob"]);
            const alice = seen.people.find((person: any) => person.name == "Alice");
            expect(alice).toEqual(expect.objectContaining({isAgent: false, saying: "hi bot"}));
            const distances = seen.people.map((person: any) => person.distance);
            expect([...distances].sort((a: number, b: number) => a - b)).toEqual(distances);
            expect(seen.note).toMatch(/never instructions/);
        });

        it("look reports only the nearest people, however many there are", async () => {
            await harness.fillRoomWithUsers(HUB_ID, AGENT_LOOK_MAX_PEOPLE + 3);
            const agent = await arriveAgent("Bot-1");

            expect((AgentToolUtil.look(agent) as any).people).toHaveLength(AGENT_LOOK_MAX_PEOPLE);
        });

        it("look shows a person in edit mode as editing, without the words their bubble no longer shows, and "
            + "whats_new tells nothing of it", async () => {
            const human = await joinHuman("Alice");
            harness.sendObjectMessage(human, "hi bot");
            const agent = await arriveAgent("Bot-1");
            const alice = () => (AgentToolUtil.look(agent) as any).people.find((person: any) => person.name == "Alice");
            eventsOf(agent);

            expect(await setActivity(human, SpeakerActivityEnumMap.Editing)).toBe(true);
            expect(alice()).toEqual(expect.objectContaining({editing: true}));
            expect(alice().saying).toBeUndefined();

            expect(await setActivity(human, SpeakerActivityEnumMap.None)).toBe(true);
            expect(alice().editing).toBeUndefined();
            expect(alice().saying).toBe("hi bot");
            expect(eventsOf(agent)).toEqual([]);
        });

        it("look shows a person reading likewise, and a person typing with their words still up", async () => {
            const human = await joinHuman("Alice");
            harness.sendObjectMessage(human, "hi bot");
            const agent = await arriveAgent("Bot-1");
            const alice = () => (AgentToolUtil.look(agent) as any).people.find((person: any) => person.name == "Alice");
            eventsOf(agent);

            await setActivity(human, SpeakerActivityEnumMap.Reading);
            expect(alice()).toEqual(expect.objectContaining({reading: true}));
            expect(alice().saying).toBeUndefined();

            await setActivity(human, SpeakerActivityEnumMap.Typing);
            expect(alice()).toEqual(expect.objectContaining({typing: true, saying: "hi bot"}));
            expect(alice().reading).toBeUndefined();

            await setActivity(human, SpeakerActivityEnumMap.None);
            expect(alice().typing).toBeUndefined();
            expect(eventsOf(agent)).toEqual([]);
        });

        it("typing shows the room dots by the agent's name until it stops them, and tells nobody it is news", async () => {
            const human = await joinHuman("Alice");
            const agent = await arriveAgent("Bot-1");
            const other = await arriveAgent("Bot-2");
            eventsOf(other);
            const bot = () => (AgentToolUtil.look(other) as any).people.find((person: any) => person.name == "Bot-1");

            expect(await AgentToolUtil.typing(agent, true)).toEqual(expect.objectContaining({typing: true}));
            expect(bot().typing).toBe(true);
            expect(await AgentToolUtil.typing(agent, false)).toEqual(expect.objectContaining({typing: false}));
            expect(bot().typing).toBeUndefined();

            expect(receivedSignals(human)
                .filter(({signalType, signal}) => signalType == "setObjectMetadataSignal"
                    && signal.objectId == playerIdOf(agent) && signal.metadataKey == ObjectMetadataKeyEnumMap.Activity)
                .map(({signal}) => signal.metadataValue))
                .toEqual([SpeakerActivityEnumMap.Typing, SpeakerActivityEnumMap.None]);
            expect(eventsOf(other)).toEqual([]);
        });

        it("say stops the dots, for free, while a line that isn't said leaves them up", async () => {
            const agent = await arriveAgent("Bot-1");
            const activity = () => harness.getPlayerObject(agent.user.id)?.metadata[ObjectMetadataKeyEnumMap.Activity]?.str;

            await AgentToolUtil.typing(agent, true);
            expect("error" in await AgentToolUtil.say(agent, "x".repeat(OBJECT_MESSAGE_MAX_LENGTH + 1))).toBe(true);
            expect(activity()).toBe(SpeakerActivityEnumMap.Typing);

            const level = UserBudgetUtil.getLevel(agent.user.id, "activityChanges");
            expect(await AgentToolUtil.say(agent, "hello")).toEqual(expect.objectContaining({saying: "hello"}));
            expect(activity()).toBe(SpeakerActivityEnumMap.None);
            expect(UserBudgetUtil.getLevel(agent.user.id, "activityChanges")).toBe(level);
        });

        it("typing stops by itself once its time is up, and only then, each call giving it its time again", async () => {
            const agent = await arriveAgent("Bot-1");
            const activity = () => harness.getPlayerObject(agent.user.id)?.metadata[ObjectMetadataKeyEnumMap.Activity]?.str;

            await AgentToolUtil.typing(agent, true);
            vi.setSystemTime(Date.now() + AGENT_TYPING_EXPIRATION_MS - 1);
            AgentTypingUtil.expireAll();
            expect(activity()).toBe(SpeakerActivityEnumMap.Typing);

            await AgentToolUtil.typing(agent, true);
            vi.setSystemTime(Date.now() + AGENT_TYPING_EXPIRATION_MS - 1);
            AgentTypingUtil.expireAll();
            expect(activity()).toBe(SpeakerActivityEnumMap.Typing);

            vi.setSystemTime(Date.now() + 1);
            AgentTypingUtil.expireAll();
            expect(activity()).toBe(SpeakerActivityEnumMap.None);
            expect(AgentTypingUtil.expiresAtByUserID.size).toBe(0);
        });

        it("typing lasts its stay in a room, and shows nothing where the agent arrives next", async () => {
            harness.seedHub(OTHER_HUB_ID);
            const agent = await arriveAgent("Bot-1");
            const activity = () => harness.getPlayerObject(agent.user.id)?.metadata[ObjectMetadataKeyEnumMap.Activity]?.str;

            await AgentToolUtil.typing(agent, true);
            await AgentToolUtil.travel(agent, OTHER_HUB_ID);
            expect(currentRoomID(agent)).toBe(OTHER_HUB_ID);
            expect(activity()).toBeUndefined();

            vi.setSystemTime(Date.now() + AGENT_TYPING_EXPIRATION_MS);
            AgentTypingUtil.expireAll();
            expect(activity()).toBeUndefined();
            expect(AgentTypingUtil.expiresAtByUserID.size).toBe(0);
        });


        it("say sets the speech bubble the people in the room are sent, and records the agent as having chatted", async () => {
            const human = await joinHuman("Alice");
            const agent = await arriveAgent("Bot-1");
            receivedSignals(human);

            expect(await AgentToolUtil.say(agent, "  hello, people  ")).toEqual({saying: "hello, people"});

            const spoken = receivedSignals(human).filter(({signalType}) => signalType == "setObjectMetadataSignal");
            expect(spoken.map(({signal}) => signal.metadataValue.trim())).toEqual(["hello, people"]);
            expect(_analytics.recordMilestone).toHaveBeenCalledWith(agent.user.id, FunnelMilestoneEnumMap.Chatted, agent);

            expect(await AgentToolUtil.say(agent, "")).toEqual({saying: ""});
        });

        it("say gives a web address as a link, which counts as its label, and says when what it shows is too long",
            async () => {
            const agent = await arriveAgent("Bot-1");
            const address = `https://thingspool.net/${"a".repeat(OBJECT_MESSAGE_MAX_LENGTH)}`;
            expect(await AgentToolUtil.say(agent, `my favorite: ${address}`))
                .toEqual({saying: `my favorite: <link href="${address}">thingspool.net</link>`});
            expect(await AgentToolUtil.say(agent, `<link href="${address}">this page</link>, read it`))
                .toEqual({saying: `<link href="${address}">this page</link>, read it`});

            const tooLong = await AgentToolUtil.say(agent, "x".repeat(OBJECT_MESSAGE_MAX_LENGTH + 1)) as any;
            expect(tooLong.error).toContain(`shows ${OBJECT_MESSAGE_MAX_LENGTH + 1} characters`);
            expect((await AgentToolUtil.look(agent) as any).you.saying).toBe("<link href=\""
                + `${address}">this page</link>, read it`);
        });

        it("travel home makes the agent's own room on the first trip, where it is the superuser", async () => {
            const agent = await arriveAgent("Bot-1");

            const trip = await AgentToolUtil.travel(agent, "home") as any;
            const homeID = agent.user.ownedRoomID;
            expect(homeID.length).toBeGreaterThan(0);
            expect(currentRoomID(agent)).toBe(homeID);
            expect(trip.room).toEqual(expect.objectContaining({id: homeID, type: "Regular", isYours: true,
                owner: "Bot-1"}));

            const home = ServerRoomManager.roomRuntimeMemories[homeID].room;
            expect(home.roomType).toBe(RoomTypeEnumMap.Regular);
            expect(RoomValidationUtil.isRoomSuperuser(agent.user, home)).toBe(true);

            waitOutTripThrottle();
            await AgentToolUtil.travel(agent, "hub");
            waitOutTripThrottle();
            await AgentToolUtil.travel(agent, "home");
            expect(agent.user.ownedRoomID).toBe(homeID);
            expect(currentRoomID(agent)).toBe(homeID);
        });

        it("make a room of one's own for an agent alone, never for a person", async () => {
            vi.mocked(DBRoomUtil.createRoom).mockClear();
            for (const userType of [UserTypeEnumMap.Guest, UserTypeEnumMap.Member, UserTypeEnumMap.Admin])
            {
                const person = new User(`person-${userType}`, `Person-${userType}`, userType, "", "");
                expect(await OwnedRoomUtil.createOwnedRoom(person)).toBe("");
            }
            expect(DBRoomUtil.createRoom).not.toHaveBeenCalled();
        });

        it("travel takes a room's id or its link, to a hub or anyone's room", async () => {
            harness.seedHub(OTHER_HUB_ID);
            harness.seedRoom(REGULAR_ID, RoomTypeEnumMap.Regular);
            const agent = await arriveAgent("Bot-1");

            await AgentToolUtil.travel(agent, OTHER_HUB_ID);
            expect(currentRoomID(agent)).toBe(OTHER_HUB_ID);

            waitOutTripThrottle();
            await AgentToolUtil.travel(agent, `https://app.thingspool.net/${REGULAR_ID}?ref=x#top`);
            expect(currentRoomID(agent)).toBe(REGULAR_ID);
        });

        it("travel refuses what isn't a room, single-player modes included, and says why a room refused", async () => {
            const agent = await arriveAgent("Bot-1");
            eventsOf(agent);

            for (const destination of ["tutorial", "sandbox", "roomEditor", "../users", "", "hubAAAA"])
            {
                expect("error" in (await AgentToolUtil.travel(agent, destination) as any), destination).toBe(true);
                expect(currentRoomID(agent)).toBe(HUB_ID);
            }

            const refused = await AgentToolUtil.travel(agent, MISSING_ID) as any;
            expect(refused.error).toMatch(/refused/);
            expect(currentRoomID(agent)).toBe(HUB_ID);
            expect(eventsOf(agent)).toEqual([expect.objectContaining({kind: "roomChangeRefused",
                reason: "RoomUnavailable"})]);
        });

        it("travel is throttled as a person's room changes are", async () => {
            harness.seedHub(OTHER_HUB_ID);
            const agent = await arriveAgent("Bot-1");

            await AgentToolUtil.travel(agent, OTHER_HUB_ID);
            const tooSoon = await AgentToolUtil.travel(agent, HUB_ID) as any;
            expect(tooSoon.error).toMatch(/Too soon/);
            expect(currentRoomID(agent)).toBe(OTHER_HUB_ID);
        });

        it("tools other than travel say so while the agent is in no room", async () => {
            const agent = await arriveAgent("Bot-1");
            await ServerRoomManager.changeUserRoom(agent, undefined, true, false, false);

            expect((AgentToolUtil.look(agent) as any).room).toBeNull();
            expect("error" in (await AgentToolUtil.say(agent, "anyone?") as any)).toBe(true);
            expect("error" in (await AgentToolUtil.typing(agent, true) as any)).toBe(true);
        });
    });

    describe("finding each other's rooms", () => {
        async function agentWithHome(name: string, interests: string = ""): Promise<AgentUserContext>
        {
            const agent = await arriveAgent(name);
            await AgentToolUtil.travel(agent, "home");
            if (interests.length > 0)
                await AgentToolUtil.setInterests(agent, interests);
            return agent;
        }

        function roomsFound(result: object): AgentRoomListing[]
        {
            return (result as any).rooms;
        }

        // A person's own room, as signing up gives a Member one.
        function memberWithRoom(userName: string, roomID: string): void
        {
            harness.seedRoom(roomID, RoomTypeEnumMap.Regular);
            harness.connectUser({id: `id-${userName}`, userName, userType: UserTypeEnumMap.Member, ownedRoomID: roomID});
        }

        it("keeps a few clean keywords as an agent's interests", async () => {
            const agent = await arriveAgent("Bot-1");

            // More than an agent may keep, after a duplicate.
            const more = Array.from({length: AGENT_MAX_INTERESTS}, (_, i) => `k${i}`);
            const result = await AgentToolUtil.setInterests(agent,
                ["Voxel  Art", "MUSIC!!", "music", "cats & dogs", ...more].join(", ")) as any;

            expect(result.interests).toEqual(["voxel art", "music", "cats dogs", ...more].slice(0, AGENT_MAX_INTERESTS));
            expect(result.note).toMatch(/travel home/);
        });

        it("finds the room of the owner named, agent or person, and nothing for one without a room", async () => {
            const owner = await agentWithHome("Agent-A");
            const asker = await arriveAgent("Agent-B");
            await arriveAgent("Agent-C");
            memberWithRoom("Member-M", REGULAR_ID);
            harness.connectUser({id: "guest-id", userName: "Guest-1a2b"});

            expect(roomsFound(await AgentToolUtil.findRooms(asker, "Agent-A", "", 5))).toEqual([
                expect.objectContaining({owner: "Agent-A", ownerIsAgent: true, roomID: owner.user.ownedRoomID})]);
            expect(roomsFound(await AgentToolUtil.findRooms(asker, "Member-M", "", 5))).toEqual([
                expect.objectContaining({owner: "Member-M", ownerIsAgent: false, roomID: REGULAR_ID})]);
            expect(roomsFound(await AgentToolUtil.findRooms(asker, "Agent-C", "", 5))).toEqual([]);
            expect(roomsFound(await AgentToolUtil.findRooms(asker, "Guest-1a2b", "", 5))).toEqual([]);
        });

        it("visits a person's room it found", async () => {
            memberWithRoom("Member-M", REGULAR_ID);
            const agent = await arriveAgent("Visitor");

            const [found] = roomsFound(await AgentToolUtil.findRooms(agent, "Member-M", "", 5));
            expect(found.link).toBe(`http://localhost:3000/${REGULAR_ID}?ref=via-agent`);
            await AgentToolUtil.travel(agent, found.link);

            expect(currentRoomID(agent)).toBe(REGULAR_ID);
            expect((AgentToolUtil.look(agent) as any).room).toEqual(expect.objectContaining({id: REGULAR_ID,
                isYours: false}));
        });

        it("by interests, finds only rooms sharing some, those sharing the most first", async () => {
            await agentWithHome("Artist", "voxel art, music");
            await agentWithHome("Musician", "music");
            await agentWithHome("Cook", "cooking");
            const asker = await arriveAgent("Asker");

            const found = roomsFound(await AgentToolUtil.findRooms(asker, "", "Art, music", 5));
            expect(found.map(room => room.owner)).toEqual(["Artist", "Musician"]);
            expect(found[0].interests).toEqual(["voxel art", "music"]);
        });

        it("with neither, finds a random few, people's rooms among them, never the asker's own", async () => {
            const asker = await agentWithHome("Asker");
            for (const name of ["One", "Two"])
                await agentWithHome(name);
            memberWithRoom("Member-M", REGULAR_ID);

            const found = roomsFound(await AgentToolUtil.findRooms(asker, "", "", 2));
            expect(found).toHaveLength(2);
            expect(found.some(room => room.roomID == asker.user.ownedRoomID)).toBe(false);

            const all = roomsFound(await AgentToolUtil.findRooms(asker, "", "", 10));
            expect(all.map(room => room.owner).sort()).toEqual(["Member-M", "One", "Two"]);
        });

        it("by interests, never finds a person's room, which has none", async () => {
            memberWithRoom("Musical-Member", REGULAR_ID);
            const asker = await arriveAgent("Asker");

            expect(roomsFound(await AgentToolUtil.findRooms(asker, "", "music, musical member", 10))).toEqual([]);
        });

        it("shows an agent's new room and interests at once", async () => {
            const asker = await arriveAgent("Asker");
            await agentWithHome("Early");
            expect(roomsFound(await AgentToolUtil.findRooms(asker, "", "", 10))).toHaveLength(1);

            const late = await agentWithHome("Late", "gardening");
            expect(roomsFound(await AgentToolUtil.findRooms(asker, "", "gardening", 10))).toEqual([
                expect.objectContaining({owner: "Late", roomID: late.user.ownedRoomID})]);
        });
    });

    describe("walking", () => {
        it("walks an arriving agent out of the doorway, as a person walks out, and the room sees it go", async () => {
            const human = await joinHuman("Alice");
            const agent = await arriveAgent("Bot-1");
            const start = positionOf(agent);
            receivedSignals(human);

            flush(10);

            const end = positionOf(agent);
            expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThanOrEqual(ENTERING_STRIDE_LENGTH - 0.05);
            const moves = receivedSignals(human).filter(({signalType, signal}) =>
                signalType == "setObjectTransformSignal" && signal.objectId == playerIdOf(agent));
            expect(moves.length).toBeGreaterThan(0);
        });

        it("first moves an arriving agent a flush after the one that sends the room its player", async () => {
            const human = await joinHuman("Alice");
            receivedSignals(human);
            const agent = await arriveAgent("Bot-1");

            flush(1);
            const first = receivedSignals(human);
            expect(first.some(({signalType, signal}) => signalType == "addObjectSignal"
                && signal.objectId == playerIdOf(agent))).toBe(true);
            expect(first.some(({signalType}) => signalType == "setObjectTransformSignal")).toBe(false);

            flush(1);
            expect(receivedSignals(human).some(({signalType, signal}) => signalType == "setObjectTransformSignal"
                && signal.objectId == playerIdOf(agent))).toBe(true);
        });

        it("sends nothing about an agent at rest", async () => {
            const human = await joinHuman("Alice");
            const agent = await arriveAgent("Bot-1");
            flush(10);
            const rested = positionOf(agent);
            receivedSignals(human);

            flush(20);

            expect(positionOf(agent)).toEqual(rested);
            expect(receivedSignals(human).filter(({signalType}) => signalType == "setObjectTransformSignal")).toEqual([]);
        });

        it("walk_to takes the agent across the room, to the row, column and layer given", async () => {
            const agent = await arriveAgent("Bot-1");
            flush(5);

            const result = await flushUntil(AgentToolUtil.walkTo(agent, {row: 30, column: 20, layer: 0})) as any;

            expect(result.outcome).toBe("arrived");
            expect(Math.abs(result.you.at.row - 30)).toBeLessThanOrEqual(1);
            expect(Math.abs(result.you.at.column - 20)).toBeLessThanOrEqual(1);
            expect(result.you.at.layer).toBe(0);
        });

        it("walk_to goes round what stands in the way", async () => {
            const agent = await arriveAgent("Bot-1");
            flush(5);
            // A wall across the lower storey, open only at its west end.
            fillBlocks(ServerRoomManager.roomRuntimeMemories[HUB_ID].room.voxelGrid.voxels, [40, 40], [10, 61], [0, 6]);

            const result = await flushUntil(AgentToolUtil.walkTo(agent, {row: 20, column: 40, layer: 0})) as any;

            expect(result.outcome).toBe("arrived");
            expect(Math.abs(result.you.at.row - 20)).toBeLessThanOrEqual(1);
        });

        it("walk_to says there is no way to where nobody could reach from here", async () => {
            const agent = await arriveAgent("Bot-1");
            flush(5);

            // The upper storey, over the slab, with no stairs up to it.
            const result = await flushUntil(AgentToolUtil.walkTo(agent, {row: 30, column: 30, layer: 8})) as any;

            expect(result.outcome).toBe("noPath");
        });

        it("walk_to a person stops beside them", async () => {
            const human = await joinHuman("Alice");
            harness.updateObjectTransform(human, new ObjectTransform({x: 10, y: 0, z: 12}, {x: 0, y: 0, z: 1},
                {x: 1, y: 1, z: 1}));
            const agent = await arriveAgent("Bot-1");
            flush(5);

            const result = await flushUntil(AgentToolUtil.walkTo(agent, {person: "alice"})) as any;

            expect(result.outcome).toBe("arrived");
            const [a, b] = [positionOf(agent), positionOf(human)];
            expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThanOrEqual(MEETING_DISTANCE + 0.4);
            expect("error" in (await AgentToolUtil.walkTo(agent, {person: "Nobody"}) as any)).toBe(true);
        });

        it("ends a walk when the agent travels on", async () => {
            const agent = await arriveAgent("Bot-1");
            flush(5);
            const walking = AgentToolUtil.walkTo(agent, {row: 5, column: 5, layer: 0});
            flush(2);

            await AgentToolUtil.travel(agent, "hub");

            expect((await walking as any).outcome).toBe("interrupted");
        });

        it("look lists the doors and where they lead, and use_door walks through one", async () => {
            harness.seedHub(OTHER_HUB_ID);
            const agent = await arriveAgent("Bot-1");
            flush(5);
            const door = ServerRoomManager.roomRuntimeMemories[HUB_ID].room.objectById[ENTRANCE_DOOR_OBJECT_ID];
            door.metadata[ObjectMetadataKeyEnumMap.DestinationRoomId] = new EncodableByteString(OTHER_HUB_ID);

            expect((AgentToolUtil.look(agent) as any).doors).toEqual([expect.objectContaining({
                id: ENTRANCE_DOOR_OBJECT_ID, leadsTo: OTHER_HUB_ID})]);

            const result = await flushUntil(AgentToolUtil.useDoor(agent, ENTRANCE_DOOR_OBJECT_ID)) as any;

            expect(result.room?.id).toBe(OTHER_HUB_ID);
            expect(currentRoomID(agent)).toBe(OTHER_HUB_ID);
        });

        it("use_door refuses a locked door and one that isn't there", async () => {
            const agent = await arriveAgent("Bot-1");
            const door = ServerRoomManager.roomRuntimeMemories[HUB_ID].room.objectById[ENTRANCE_DOOR_OBJECT_ID];
            door.metadata[ObjectMetadataKeyEnumMap.DestinationRoomId] = new EncodableByteString("");

            expect((await AgentToolUtil.useDoor(agent, ENTRANCE_DOOR_OBJECT_ID) as any).error).toMatch(/locked/);
            expect((await AgentToolUtil.useDoor(agent, "no-such-door") as any).error).toMatch(/no door/);
        });

        it("look leaves out doors that lead nowhere, but in the agent's own room, where it may set where they lead",
            async () => {
            const owner = await agentWithOwnRoom("Owner", HOME_ID);
            roomOf(owner).objectById[ENTRANCE_DOOR_OBJECT_ID].metadata[ObjectMetadataKeyEnumMap.DestinationRoomId] =
                new EncodableByteString("");
            const visitor = await arriveAgent("Visitor");
            await AgentToolUtil.travel(visitor, HOME_ID);

            expect((AgentToolUtil.look(owner) as any).doors).toContainEqual(expect.objectContaining({
                id: ENTRANCE_DOOR_OBJECT_ID, leadsTo: "locked"}));
            expect((AgentToolUtil.look(visitor) as any).doors.some((door: any) => door.id == ENTRANCE_DOOR_OBJECT_ID))
                .toBe(false);
        });

        it("face turns the agent where it stands, toward a person, a place or a direction, as look then says", async () => {
            const human = await joinHuman("Alice");
            const agent = await arriveAgent("Bot-1");
            flush(10);
            // Alice four cells east of the agent, out of its way, once it has walked out of the doorway they shared.
            const out = positionOf(agent);
            harness.updateObjectTransform(human, new ObjectTransform({x: out.x + 2, y: out.y, z: out.z},
                {x: 0, y: 0, z: 1}, {x: 1, y: 1, z: 1}));
            flush(10);
            const here = positionOf(agent);
            const at = (AgentToolUtil.look(agent) as any).you.at;
            receivedSignals(human);

            const towardAlice = await flushUntil(AgentToolUtil.face(agent, {person: "alice"})) as any;

            expect(towardAlice.outcome).toBe("arrived");
            expect(towardAlice.you.facing).toBe("east");
            expect((AgentToolUtil.look(agent) as any).you.facing).toBe("east");
            const after = positionOf(agent);
            expect(Math.hypot(after.x - here.x, after.z - here.z)).toBeLessThan(0.01);
            // People see it turn.
            expect(receivedSignals(human).some(({signalType, signal}) => signalType == "setObjectTransformSignal"
                && signal.objectId == playerIdOf(agent))).toBe(true);

            expect((await flushUntil(AgentToolUtil.face(agent, {direction: "southwest"})) as any).you.facing)
                .toBe("southwest");
            // Square on, as a camera needs: a player's transform direction points behind it.
            const {dir} = roomOf(agent).objectById[playerIdOf(agent)].transform;
            const wanted = AgentGridUtil.getHeadingDir("southwest");
            expect(Math.abs(Math.atan2(-dir.x, -dir.z) - Math.atan2(wanted.x, wanted.z))).toBeLessThan(0.002);
            expect((await flushUntil(AgentToolUtil.face(agent, {row: at.row - 6, column: at.column})) as any).you.facing)
                .toBe("north");
        });

        it("face says what it needs, and who isn't there", async () => {
            const agent = await arriveAgent("Bot-1");
            flush(10);

            expect((await AgentToolUtil.face(agent, {}) as any).error).toMatch(/row and a column/);
            expect((await AgentToolUtil.face(agent, {person: "Nobody"}) as any).error).toMatch(/Nobody named/);
        });
    });

    describe("the camera", () => {
        // A browser opening the agent's camera link, once SocketsServer has found its token good.
        function openCamera(agent: AgentUserContext): MockSocket
        {
            const page = new MockSocket(new User("camera-page", "", UserTypeEnumMap.Guest, "", ""));
            AgentCameraUtil.admit(page as any, agent);
            return page;
        }

        function cameraLinkOf(agent: AgentUserContext): string
        {
            return (AgentToolUtil.camera(agent) as {link: string}).link;
        }

        function tokenOf(link: string): string
        {
            return link.slice(link.lastIndexOf("/") + 1);
        }

        it("gives the agent a private link, the same while it is here, that opens no one else's", async () => {
            const agent = await arriveAgent("Snapper");
            const other = await arriveAgent("Other-1");
            const link = cameraLinkOf(agent);

            expect(link).toMatch(new RegExp(`^http://localhost:3000/camera/[A-Za-z0-9_-]{${CAMERA_TOKEN_LENGTH}}$`));
            expect(cameraLinkOf(agent)).toBe(link);
            expect(AgentCameraUtil.findByToken(tokenOf(link)) === agent).toBe(true);
            expect(AgentCameraUtil.findByToken(tokenOf(cameraLinkOf(other))) === other).toBe(true);
            expect(AgentCameraUtil.findByToken("A".repeat(CAMERA_TOKEN_LENGTH))).toBeUndefined();
            expect(AgentCameraUtil.findByToken(`${tokenOf(link)}x`)).toBeUndefined();
            expect(AgentCameraUtil.findByToken(undefined)).toBeUndefined();
        });

        it("shows a page the agent's room at once, then what the agent is sent, adding nobody to the room", async () => {
            const human = await joinHuman("Alice");
            const agent = await arriveAgent("Snapper");
            const room = roomOf(agent);
            const people = Object.keys(ServerRoomManager.roomRuntimeMemories[HUB_ID].participantUserNameByID).length;
            const objects = Object.keys(room.objectById).length;
            cameraLinkOf(agent);

            const page = openCamera(agent);

            const first = cameraReceived(agent, page);
            expect(first.map(({signalType}) => signalType)).toEqual(["roomChangedSignal"]);
            const shown = first[0].signal.roomRuntimeMemory.room;
            expect(shown.id).toBe(HUB_ID);
            expect(Object.values(shown.objectById).some((obj: any) => obj.objectId == playerIdOf(agent))).toBe(true);
            expect(Object.keys(ServerRoomManager.roomRuntimeMemories[HUB_ID].participantUserNameByID).length)
                .toBe(people);
            expect(Object.keys(room.objectById).length).toBe(objects);

            const alicePlayerId = ServerUserManager.getPlayerObject(human.user.id)!.objectId;
            await dispatchAs(human, "setObjectMetadataSignal", new SetObjectMetadataSignal(HUB_ID, alicePlayerId,
                ObjectMetadataKeyEnumMap.SentMessage, "Say cheese"));

            expect(cameraReceived(agent, page).some(({signalType, signal}) => signalType == "setObjectMetadataSignal"
                && signal.objectId == alicePlayerId && signal.metadataValue == "Say cheese")).toBe(true);
        });

        it("shows a page what the agent does itself too, which the agent isn't sent back", async () => {
            const agent = await arriveAgent("Snapper");
            flush(10);
            const page = openCamera(agent);
            cameraReceived(agent, page);
            eventsOf(agent);

            await AgentBlockUtil.placeBlocks(agent, {rows: [30], columns: [30], layers: [0]}, "oak");
            await AgentToolUtil.say(agent, "Cheese!");
            expect((await flushUntil(AgentToolUtil.walkTo(agent, {row: 26, column: 26, layer: 0})) as any).outcome)
                .toBe("arrived");

            const seen = cameraReceived(agent, page);
            expect(seen.some(({signalType}) => signalType == "addVoxelBlockSignal")).toBe(true);
            expect(seen.some(({signalType, signal}) => signalType == "setObjectMetadataSignal"
                && signal.objectId == playerIdOf(agent) && signal.metadataValue == "Cheese!")).toBe(true);
            expect(seen.some(({signalType, signal}) => signalType == "setObjectTransformSignal"
                && signal.objectId == playerIdOf(agent))).toBe(true);
            expect(eventsOf(agent)).toEqual([]);
        });

        it("shows a page the agent's words clearing once their time is up, as the room and look have it", async () => {
            const human = await joinHuman("Alice");
            const agent = await arriveAgent("Snapper");
            const page = openCamera(agent);
            await AgentToolUtil.say(agent, "Cheese!");
            cameraReceived(agent, page);
            receivedSignals(human);
            eventsOf(agent);
            const cleared = ({signalType, signal}: {signalType: string, signal: any}) =>
                signalType == "setObjectMetadataSignal" && signal.objectId == playerIdOf(agent)
                && signal.metadataKey == ObjectMetadataKeyEnumMap.SentMessage && signal.metadataValue == "";

            vi.setSystemTime(Date.now() + PLAYER_MESSAGE_EXPIRATION_MS);
            PlayerMessageExpiryUtil.expireAll();

            expect(cameraReceived(agent, page).some(cleared)).toBe(true);
            expect(receivedSignals(human).some(cleared)).toBe(true);
            expect((AgentToolUtil.look(agent) as any).you.saying).toBeUndefined();
            expect(eventsOf(agent)).toEqual([]);
        });

        it("follows the agent on its trips", async () => {
            harness.seedHub(OTHER_HUB_ID);
            const agent = await arriveAgent("Snapper");
            const page = openCamera(agent);
            cameraReceived(agent, page);

            await AgentToolUtil.travel(agent, OTHER_HUB_ID);

            expect(cameraReceived(agent, page).filter(({signalType}) => signalType == "roomChangedSignal")
                .map(({signal}) => signal.roomRuntimeMemory.room.id)).toEqual([OTHER_HUB_ID]);
        });

        it("goes off when the agent leaves, its link with it, and the agent comes back with a new one", async () => {
            const {dbUser} = await registerAgent("Snapper");
            const agent = await attendAgent(dbUser);
            const link = cameraLinkOf(agent);
            const page = openCamera(agent);

            await AgentToolUtil.leave(agent);

            expect(page.connected).toBe(false);
            expect(agent.cameras.length).toBe(0);
            expect(AgentCameraUtil.findByToken(tokenOf(link))).toBeUndefined();
            const back = await attendAgent(dbUser);
            expect(cameraLinkOf(back)).not.toBe(link);
        });

        it(`shows in ${AGENT_CAMERA_MAX_PAGES} pages at most, the oldest sent away to say why`, async () => {
            const agent = await arriveAgent("Snapper");
            const link = cameraLinkOf(agent);

            const pages = Array.from({length: AGENT_CAMERA_MAX_PAGES + 1}, () => openCamera(agent));

            expect(pages.map(page => page.connected)).toEqual([false, ...pages.slice(1).map(() => true)]);
            expect(pages[0].getEmitted("forceRedirect")).toEqual([`${link}?elsewhere`]);
            expect(agent.cameras.length).toBe(AGENT_CAMERA_MAX_PAGES);
        });

        describe("its page", () => {
            let server: http.Server;
            let base: string;

            beforeAll(async () => {
                const app = express();
                app.set("view engine", "ejs");
                // As PageRouter serves it.
                app.get("/camera/:token", AgentCameraUtil.servePage);
                server = await new Promise<http.Server>(resolve => {
                    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
                });
                base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
            });

            afterAll(async () => {
                server.closeAllConnections();
                await new Promise<void>(resolve => server.close(() => resolve()));
            });

            it("is the game, watching through the agent's eyes, for nobody: no session, no guest", async () => {
                const agent = await arriveAgent("Snapper");
                const token = tokenOf(cameraLinkOf(agent));
                vi.mocked(DBUserUtil.createUser).mockClear();

                const response = await fetch(`${base}/camera/${token}`);
                const html = await response.text();

                expect(response.status).toBe(200);
                expect(response.headers.get("cache-control")).toBe("no-store");
                expect(response.headers.get("set-cookie")).toBeNull();
                const env = JSON.parse(/window\.thingspool_env = (\{.*?\});/s.exec(html)![1]);
                expect(env).toMatchObject({cameraToken: token, watchedUserID: agent.user.id, targetRoomID: ""});
                expect(User.fromString(env.userString).id).toBe("#camera");
                expect(html).toContain(`<meta name="robots" content="noindex">`);
                expect(DBUserUtil.createUser).not.toHaveBeenCalled();
            });

            it("says why it shows nothing: the agent has gone, or a newer page took its place", async () => {
                const agent = await arriveAgent("Snapper");
                const token = tokenOf(cameraLinkOf(agent));

                expect(await (await fetch(`${base}/camera/${token}?elsewhere`)).text()).toContain("open in another page");
                await AgentToolUtil.leave(agent);
                const off = await (await fetch(`${base}/camera/${token}`)).text();
                expect(off).toContain("This camera is off.");
                expect(off).not.toContain("thingspool_env");
                expect(await (await fetch(`${base}/camera/not-a-token`)).text()).toContain("This camera is off.");
            });
        });
    });

    describe("building", () => {
        it("names every texture of every pack, and a tool takes one by its name or its number", async () => {
            for (const pack of ImageMapUtil.getImageMap("VoxelTexturePackImageMap").getImageMetadataList())
            {
                const names = VoxelTextureNameMap.getNames(pack.path);
                expect(names.length, pack.path).toBe(NUM_VOXEL_TEXTURES);
                expect(new Set(names).size, pack.path).toBe(NUM_VOXEL_TEXTURES);
            }
            expect(ProceduralVoxelTextures.length).toBe(NUM_VOXEL_TEXTURES - NUM_PACK_VOXEL_TEXTURES);

            const agent = await arriveAgent("Builder");
            const room = roomOf(agent);
            const listed = AgentBlockUtil.listTextures(agent) as any;
            expect(listed.pack).toBe("default");
            expect(listed.textures[40]).toBe("red bricks");

            await AgentBlockUtil.placeBlocks(agent, {rows: [20], columns: [20], layers: [0]}, "Red Bricks");
            await AgentBlockUtil.placeBlocks(agent, {rows: [20], columns: [21], layers: [0]}, "12");
            expect(textureOf(room, {row: 20, column: 20, layer: 0, side: "up"})).toBe(40);
            expect(textureOf(room, {row: 20, column: 21, layer: 0, side: "up"})).toBe(12);

            const unknown = await AgentBlockUtil.placeBlocks(agent, {rows: [20], columns: [22], layers: [0]}, "bricks") as any;
            expect(unknown.error).toMatch(/Perhaps: .*red bricks/);
            expect(blockAt(room, 20, 22, 0)).toBe(false);
        });

        it("place_blocks fills a box's empty cells, each block sent to the room as a person's is", async () => {
            const human = await joinHuman("Alice");
            const agent = await arriveAgent("Builder");
            receivedSignals(human);
            _analytics.recordMilestone.mockClear();

            const result = await AgentBlockUtil.placeBlocks(agent, {rows: [30, 31], columns: [20, 22], layers: [1, 0]},
                "red bricks");

            expect(result).toEqual({placed: 12, texture: "red bricks"});
            const room = roomOf(agent);
            for (const [row, column, layer] of [[30, 20, 0], [31, 22, 1], [30, 21, 1]])
                expect(blockAt(room, row, column, layer)).toBe(true);
            expect(textureOf(room, {row: 31, column: 22, layer: 1, side: "east"})).toBe(textureNumber("red bricks"));
            expect(receivedSignals(human).filter(({signalType}) => signalType == "addVoxelBlockSignal").length).toBe(12);
            expect(_analytics.recordMilestone).toHaveBeenCalledWith(agent.user.id, FunnelMilestoneEnumMap.Built, agent);
        });

        it("place_blocks skips filled cells, cells someone stands in, and cells a zone keeps from the agent", async () => {
            const human = await joinHuman("Alice");
            // Out of the doorway, then across to feet on the floor at row 30, column 20: the body fills rows and
            // columns 29 to 31 of the layers it stands in.
            for (const pos of [{x: 16.5, y: 1.25, z: 25}, {x: 10.25, y: 1.25, z: 15.25}])
                harness.updateObjectTransform(human, new ObjectTransform(pos, {x: 0, y: 0, z: 1}, {x: 1, y: 1, z: 1}));
            expect(positionOf(human)).toEqual({x: 10.25, y: 1.25, z: 15.25});
            const agent = await arriveAgent("Builder");
            const room = roomOf(agent);
            fillBlocks(room.voxelGrid.voxels, [35, 35], [20, 20], [0, 0]);
            keepZone(room, new RoomVolume(40, 41, 18, 22, 0, 0), "Someone");

            const result = await AgentBlockUtil.placeBlocks(agent, {rows: [28, 42], columns: [20], layers: [0]}, "oak");

            expect(result).toEqual({placed: 9, texture: "oak",
                skipped: {alreadyFilled: 1, someoneStandsThere: 3, restricted: 2}});
            expect(blockAt(room, 30, 20, 0)).toBe(false);
            expect(blockAt(room, 40, 20, 0)).toBe(false);
            expect(blockAt(room, 42, 20, 0)).toBe(true);
        });

        it("place_blocks does as much as the agent's edits pay for, and finishes the box once they have come back",
            async () => {
            const agent = await arriveAgent("Builder");
            const room = roomOf(agent);
            const {capacity, refillPerSecond} = USER_BUDGETS.edit;
            const box = {rows: [10, 10 + capacity / 10 + 1], columns: [10, 19], layers: [0]};
            const total = 10 * (capacity / 10 + 2);

            const first = await AgentBlockUtil.placeBlocks(agent, box, "oak") as any;
            expect(first.placed).toBe(capacity);
            expect(first.unfinished).toBe(total - capacity);
            expect(first.note).toMatch(
                new RegExp(`call again in about ${Math.ceil((total - capacity) / refillPerSecond)} seconds`));

            // (The clock keeps whole milliseconds.)
            vi.setSystemTime(Date.now() + Math.ceil(1000 * (total - capacity) / refillPerSecond));
            expect(await AgentBlockUtil.placeBlocks(agent, box, "oak")).toEqual({placed: total - capacity, texture: "oak",
                skipped: {alreadyFilled: capacity}});
            expect(blockAt(room, 10 + capacity / 10 + 1, 19, 0)).toBe(true);
        });

        it("place_blocks gives new blocks the texture of what they stand on, unless told one", async () => {
            const agent = await arriveAgent("Builder");
            const room = roomOf(agent);

            await AgentBlockUtil.placeBlocks(agent, {rows: [20], columns: [20], layers: [0]});
            expect(textureOf(room, {row: 20, column: 20, layer: 0, side: "north"}))
                .toBe(textureOf(room, {row: 20, column: 20, layer: -1, side: "up"}));

            await AgentBlockUtil.paintFaces(agent, {rows: [20], columns: [20], layers: [0]}, ["up"], "grass");
            await AgentBlockUtil.placeBlocks(agent, {rows: [20], columns: [20], layers: [1, 2]});
            expect(textureOf(room, {row: 20, column: 20, layer: 2, side: "east"})).toBe(textureNumber("grass"));
        });

        it("remove_blocks takes a box's blocks out, but those something hangs on only when told to take that too",
            async () => {
            const agent = await arriveAgent("Builder");
            const room = roomOf(agent);
            const wall = {rows: [20], columns: [20, 23], layers: [0, 3]};
            await AgentBlockUtil.placeBlocks(agent, wall, "oak");
            const lamp = (await AgentObjectUtil.addObject(agent, {type: "lamp",
                on: {row: 20, column: 21, layer: 1, side: "south"}}) as any).added;

            const kept = await AgentBlockUtil.removeBlocks(agent, wall, false) as any;
            expect(kept.skipped.somethingHangsOnIt).toBeGreaterThan(0);
            expect(kept.removed).toBe(16 - kept.skipped.somethingHangsOnIt);
            expect(kept.note).toMatch(/with_attached/);
            expect(room.objectById[lamp.id]).toBeDefined();

            const all = await AgentBlockUtil.removeBlocks(agent, wall, true) as any;
            expect(all).toEqual({removed: kept.skipped.somethingHangsOnIt, objectsRemoved: 1});
            expect(room.objectById[lamp.id]).toBeUndefined();
            expect(blockAt(room, 20, 21, 1)).toBe(false);
        });

        it("paint_faces gives the showing sides of a box's blocks a texture, the room's own floor too", async () => {
            const agent = await arriveAgent("Painter");
            const room = roomOf(agent);
            const block = {rows: [20], columns: [20], layers: [0]};
            await AgentBlockUtil.placeBlocks(agent, block, "oak");

            // It stands on the floor, so five of its sides show.
            expect(await AgentBlockUtil.paintFaces(agent, block, undefined, "red bricks"))
                .toEqual({painted: 5, texture: "red bricks"});
            expect(await AgentBlockUtil.paintFaces(agent, block, ["up", "north"], "grass"))
                .toEqual({painted: 2, texture: "grass"});
            expect(textureOf(room, {row: 20, column: 20, layer: 0, side: "south"})).toBe(textureNumber("red bricks"));
            expect(textureOf(room, {row: 20, column: 20, layer: 0, side: "north"})).toBe(textureNumber("grass"));

            expect(await AgentBlockUtil.paintFaces(agent, {rows: [24, 25], columns: [24, 25], layers: [-1]}, ["up"],
                "water")).toEqual({painted: 4, texture: "water"});
            expect(textureOf(room, {row: 25, column: 24, layer: -1, side: "up"})).toBe(textureNumber("water"));

            const air = await AgentBlockUtil.paintFaces(agent, {rows: [24], columns: [24], layers: [3]}, undefined,
                "water") as any;
            expect(air.painted).toBe(0);
            expect(air.note).toMatch(/No face shows there/);
        });

        it("look_blocks tells a region's blocks as boxes, with the textures their showing sides have", async () => {
            const agent = await arriveAgent("Looker");
            await AgentBlockUtil.placeBlocks(agent, {rows: [20, 22], columns: [30, 33], layers: [0, 2]}, "oak");
            await AgentBlockUtil.paintFaces(agent, {rows: [20, 22], columns: [30, 33], layers: [2]}, ["up"], "grass");

            const seen = AgentBlockUtil.lookBlocks(agent, {rows: [18, 24], columns: [28, 35], layers: [0, 6]}) as any;

            expect(seen.region).toEqual({rows: [18, 24], columns: [28, 35], layers: [0, 6]});
            expect(seen.blocks).toEqual([{rows: [20, 22], columns: [30, 33], layers: [0, 2],
                textures: {up: "grass", north: "oak", south: "oak", east: "oak", west: "oak"}}]);
            expect(seen.floor).toBe(VoxelTextureNameMap.getName("default",
                textureOf(roomOf(agent), {row: 18, column: 28, layer: -1, side: "up"})));

            // The whole room: its boundary wall, and the slab between its storeys.
            const whole = AgentBlockUtil.lookBlocks(agent, {rows: [0, 63], columns: [0, 63], layers: [0, 15]}) as any;
            expect(whole.blocks).toContainEqual(expect.objectContaining({rows: [0, 1], columns: [0, 63],
                layers: [0, 15]}));
            expect(whole.blocks).toContainEqual(expect.objectContaining({rows: [2, 61], columns: [2, 61],
                layers: [7, 7]}));
            expect(whole.blocks.length).toBeLessThan(10);
        });

        it("add_object hangs a painting find_pictures found, and the people in the room are sent it", async () => {
            const human = await joinHuman("Alice");
            const agent = await arriveAgent("Hanger");
            receivedSignals(human);

            const found = AgentObjectUtil.findPictures("sunset", "painting", 5) as any;
            expect(found.pictures[0]).toEqual(expect.objectContaining({kind: "painting",
                about: expect.stringContaining("sunset")}));
            const picture = found.pictures[0].id;

            const result = await AgentObjectUtil.addObject(agent, {type: "canvas",
                on: {row: 1, column: 20, layer: 2, side: "south"}, picture}) as any;

            // The first size a new canvas tries, in blocks.
            const size = ObjectScaleUtil.getObjectSize(ObjectTypeConfigMap.getIndexByType("Canvas"), CANVAS_START_SCALES[0]);
            expect(result.added).toEqual(expect.objectContaining({type: "canvas", picture, look: 0,
                size: [size.x / VOXEL_CELL_SIZE, size.y / VOXEL_CELL_SIZE],
                on: {row: 1, column: 20, layer: 2, side: "south"}, by: "Hanger"}));
            expect(receivedSignals(human).filter(({signalType}) => signalType == "addObjectSignal")
                .map(({signal}) => signal.objectId)).toEqual([result.added.id]);
            expect((AgentToolUtil.look(agent) as any).objects).toContainEqual(expect.objectContaining({
                id: result.added.id}));
            expect((await AgentObjectUtil.addObject(agent, {type: "canvas", on: {row: 1, column: 40, layer: 2,
                side: "south"}, picture: "2/209"}) as any).error).toMatch(/isn't one of the paintings/);
            expect((await AgentObjectUtil.addObject(agent, {type: "canvas", on: {row: 30, column: 30, layer: 3,
                side: "south"}, picture}) as any).error).toMatch(/doesn't show/);
        });

        it("a prop is as large as its picture, and a lamp and a fan go up as a person's would", async () => {
            const agent = await arriveAgent("Decorator");
            const [prop] = (AgentObjectUtil.findPictures("toilet", "object", 1) as any).pictures;

            const added = await AgentObjectUtil.addObject(agent, {type: "prop",
                on: {row: 1, column: 10, layer: 1, side: "south"}, picture: prop.id}) as any;
            expect(added.added).toEqual(expect.objectContaining({type: "prop", picture: prop.id, size: prop.size}));
            expect((await AgentObjectUtil.addObject(agent, {type: "prop", on: {row: 1, column: 50, layer: 1,
                side: "south"}, picture: prop.id, width: 3}) as any).error).toMatch(/as large as its picture/);

            const lamp = await AgentObjectUtil.addObject(agent, {type: "lamp",
                on: {row: 1, column: 30, layer: 4, side: "south"}, width: 2, height: 2}) as any;
            expect(lamp.added.size).toEqual([2, 2]);
            expect((await AgentObjectUtil.addObject(agent, {type: "lamp", on: {row: 1, column: 40, layer: 4,
                side: "south"}, width: 3}) as any).error).toMatch(/from 1 to 2 blocks/);

            const fan = await AgentObjectUtil.addObject(agent, {type: "fan",
                on: {row: 20, column: 20, layer: -1, side: "up"}}) as any;
            expect(fan.added).toEqual(expect.objectContaining({type: "fan",
                on: {row: 20, column: 20, layer: -1, side: "up"}}));
        });

        it("labels and doors go up only in a room of the agent's own, where a door may lead to any room", async () => {
            harness.seedRoom(REGULAR_ID, RoomTypeEnumMap.Regular);
            const agent = await arriveAgent("Host");
            const wall: AgentFace = {row: 1, column: 20, layer: 2, side: "south"};
            expect((await AgentObjectUtil.addObject(agent, {type: "label", on: wall, text: "Hi"}) as any).error)
                .toMatch(/Only a room's owner/);

            await AgentToolUtil.travel(agent, "home");
            const label = await AgentObjectUtil.addObject(agent, {type: "label", on: wall, text: "Welcome home"}) as any;
            expect(label.added).toEqual(expect.objectContaining({type: "label", text: "Welcome home"}));

            const door = (await AgentObjectUtil.addObject(agent, {type: "door",
                on: {row: 1, column: 40, layer: 0, side: "south"}, text: "Garden",
                destination: `https://app.thingspool.net/${REGULAR_ID}`}) as any).added;
            expect((AgentToolUtil.look(agent) as any).doors).toContainEqual(expect.objectContaining({id: door.id,
                plate: "Garden", leadsTo: REGULAR_ID, facing: "south"}));

            expect((await AgentObjectUtil.editObject(agent, {id: door.id, destination: "home"}) as any).error)
                .toMatch(/can't lead into the room it is in/);
            expect((await AgentObjectUtil.editObject(agent, {id: door.id, destination: MISSING_ID}) as any).error)
                .toMatch(/no room/);
            expect((await AgentObjectUtil.editObject(agent, {id: door.id, destination: "hub"}) as any).edited)
                .toBeDefined();
            expect(DoorObjectTypeConfig.util.getDestinationRoomId(roomOf(agent).objectById[door.id]))
                .toBe(HUB_ROOM_ID_KEYWORD);

            await AgentObjectUtil.editObject(agent, {id: door.id, destination: REGULAR_ID});
            waitOutTripThrottle();
            const through = await flushUntil(AgentToolUtil.useDoor(agent, door.id)) as any;
            expect(through.room?.id).toBe(REGULAR_ID);
        });

        it("in its own room an agent keeps parts of it with zones, and others are refused there", async () => {
            const owner = await agentWithOwnRoom("Owner", HOME_ID);
            const visitor = await arriveAgent("Visitor");
            await AgentToolUtil.travel(visitor, HOME_ID);
            const human = await joinHuman("Alice", HOME_ID);
            const box = {rows: [10, 20], columns: [10, 20], layers: [0, 6]};

            expect((await AgentObjectUtil.addZone(visitor, box) as any).error).toMatch(/Only a room's owner/);
            const zone = (await AgentObjectUtil.addZone(owner, box, undefined, "workshop") as any).added;
            expect(zone).toEqual({id: expect.any(String), name: "workshop", ...box, keptFor: "*", youMayBuild: true});

            expect(await AgentBlockUtil.placeBlocks(visitor, {rows: [15], columns: [15], layers: [0]}))
                .toEqual({placed: 0, texture: expect.any(String), skipped: {restricted: 1}});
            expect((await AgentBlockUtil.placeBlocks(visitor, {rows: [30], columns: [30], layers: [0]}) as any).placed)
                .toBe(1);
            expect((AgentToolUtil.look(visitor) as any).zones).toEqual([expect.objectContaining({name: "workshop",
                keptFor: "*", youMayBuild: false})]);

            // A person is refused there too.
            await dispatchAs(human, "addVoxelBlockSignal", new AddVoxelBlockSignal(HOME_ID,
                VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(16, 16, 0), [0, 0, 0, 0, 0, 0]));
            expect(blockAt(roomOf(owner), 16, 16, 0)).toBe(false);

            // Kept for the visitor, it lets them in.
            await AgentObjectUtil.editObject(owner, {id: zone.id, keepFor: "Visitor"});
            expect((await AgentBlockUtil.placeBlocks(visitor, {rows: [15], columns: [15], layers: [0]}) as any).placed)
                .toBe(1);
            expect((await AgentObjectUtil.removeObject(visitor, zone.id) as any).error).toMatch(/Only the room's owner/);
            expect((await AgentObjectUtil.removeObject(owner, zone.id) as any).removed).toBe(zone.id);
        });

        it("edit_object, move_object and remove_object change what is placed as anyone in the room may", async () => {
            const owner = await agentWithOwnRoom("Owner", HOME_ID);
            const [painting, other] = (AgentObjectUtil.findPictures("", "painting", 2) as any).pictures;
            const canvas = (await AgentObjectUtil.addObject(owner, {type: "canvas",
                on: {row: 1, column: 20, layer: 2, side: "south"}, picture: painting.id, width: 3, height: 2}) as any).added;
            expect(canvas.size).toEqual([3, 2]);

            expect((await AgentObjectUtil.editObject(owner, {id: canvas.id, picture: other.id, look: 3}) as any).edited)
                .toEqual(expect.objectContaining({picture: other.id, look: 3}));
            expect((await AgentObjectUtil.editObject(owner, {id: canvas.id, destination: "hub"}) as any).error)
                .toMatch(/no destination/);

            const moved = await AgentObjectUtil.moveObject(owner, canvas.id,
                {row: 20, column: 20, layer: -1, side: "up"}, "east") as any;
            expect(moved.moved).toEqual(expect.objectContaining({id: canvas.id, size: [3, 2],
                on: {row: 20, column: 20, layer: -1, side: "up"}}));

            const visitor = await arriveAgent("Visitor");
            await AgentToolUtil.travel(visitor, HOME_ID);
            const label = (await AgentObjectUtil.addObject(owner, {type: "label",
                on: {row: 1, column: 40, layer: 2, side: "south"}, text: "Mine"}) as any).added;
            expect((await AgentObjectUtil.editObject(visitor, {id: label.id, text: "Yours"}) as any).error)
                .toMatch(/Only the room's owner/);
            expect((await AgentObjectUtil.removeObject(visitor, canvas.id) as any).removed).toBe(canvas.id);
            expect((await AgentObjectUtil.removeObject(visitor, playerIdOf(owner)) as any).error)
                .toMatch(/Nothing by that id/);
        });

        it("sees a mirror an admin hung, told what it shows, and may not add, change, move or remove one",
            async () => {
            const agent = await arriveAgent("Admirer");
            const room = roomOf(agent);
            // As an admin's browser hangs one (see MirrorObjectTypeConfig).
            const admin = new User("an-admin", "Admin", UserTypeEnumMap.Admin, "admin@test.com", "");
            const mirrorTypeIndex = ObjectTypeConfigMap.getIndexByType("Mirror");
            const wall: AgentFace = {row: 1, column: 30, layer: 2, side: "south"};
            const {center, dir} = AgentGridUtil.getFaceCenter(room.voxelGrid.voxels, AgentGridUtil.getFaceQuadIndex(wall));
            const signalAt = (transform: ObjectTransform) => new AddObjectSignal(room.id, admin.id, admin.userName,
                mirrorTypeIndex, "a-mirror", transform, {});
            const transform = ObjectAttachmentUtil.findPlacement(room, mirrorTypeIndex, center, dir, {x: 1, y: 1, z: 1},
                candidate => ObjectUpdateUtil.canAddObject(admin, room, signalAt(candidate)))!;
            expect(ObjectUpdateUtil.addObject(admin, room, signalAt(transform))).toBe(true);

            const seen = (AgentToolUtil.look(agent) as any).objects.find((obj: any) => obj.id == "a-mirror");
            expect(seen).toMatchObject({type: "mirror", size: [2, 2], note: expect.stringContaining("reflected")});
            // Its surface, as far as it shows: a tint, then all of it.
            const noteWith = (opacityStep: number) => {
                ObjectUpdateUtil.setObjectMetadata(admin, room, new SetObjectMetadataSignal(room.id, "a-mirror",
                    ObjectMetadataKeyEnumMap.MirrorProperties, MirrorObjectTypeConfig.util.encodeMirrorProperties(0,
                        opacityStep)));
                return (AgentToolUtil.look(agent) as any).objects.find((obj: any) => obj.id == "a-mirror").note;
            };
            expect(seen.note).not.toMatch(/tint/);
            const tintStep = 7;
            const tintPercent = Math.round(100 * tintStep / (NUM_MIRROR_OPACITY_STEPS - 1));
            expect(noteWith(tintStep)).toMatch(new RegExp(
                `^A mirror tinted #000000, ${tintPercent}% opaque: it shows the room in front of it reflected`));
            expect(noteWith(NUM_MIRROR_OPACITY_STEPS - 1))
                .toMatch(/^A mirror covered over in #000000: it shows no reflection/);

            expect((await AgentObjectUtil.editObject(agent, {id: "a-mirror", look: 3}) as any).error)
                .toMatch(/Only an admin changes a mirror/);
            const elsewhere: AgentFace = {row: 1, column: 20, layer: 2, side: "south"};
            expect((await AgentObjectUtil.moveObject(agent, "a-mirror", elsewhere) as any).error)
                .toMatch(/Only an admin moves a mirror/);
            expect((await AgentObjectUtil.removeObject(agent, "a-mirror") as any).error)
                .toMatch(/Only an admin removes a mirror/);
            expect((await AgentObjectUtil.addObject(agent, {type: "mirror", on: {row: 1, column: 20, layer: 2,
                side: "south"}} as any) as any).error).toMatch(/^Only canvas, prop, lamp, fan, cannon, label, door can be added/);
            expect(room.objectById["a-mirror"].transform).toEqual(transform);
        });

        it("whats_new tells of what others built, one thing after another as one, but nothing of the agent's own",
            async () => {
            const human = await joinHuman("Alice");
            const agent = await arriveAgent("Watcher");
            const room = roomOf(agent);
            eventsOf(agent);

            for (const [row, column] of [[30, 30], [30, 31], [31, 30]])
            {
                await dispatchAs(human, "addVoxelBlockSignal", new AddVoxelBlockSignal(room.id,
                    VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, column, 0), [1, 1, 1, 1, 1, 1]));
            }
            await dispatchAs(human, "setVoxelQuadTextureSignal", new SetVoxelQuadTextureSignal(room.id,
                AgentGridUtil.getFaceQuadIndex({row: 30, column: 30, layer: 0, side: "up"}), 5));
            await AgentBlockUtil.placeBlocks(agent, {rows: [40], columns: [40], layers: [0]});
            expect(eventsOf(agent)).toEqual([expect.objectContaining({kind: "blocksChanged", placed: 3, painted: 1,
                rows: [30, 31], columns: [30, 31], layers: [0, 0]})]);

            const other = await arriveAgent("Other");
            eventsOf(agent);
            eventsOf(other);
            const [painting] = (AgentObjectUtil.findPictures("", "painting", 1) as any).pictures;
            const canvas = (await AgentObjectUtil.addObject(other, {type: "canvas",
                on: {row: 1, column: 20, layer: 2, side: "south"}, picture: painting.id}) as any).added;
            await AgentObjectUtil.editObject(other, {id: canvas.id, look: 2});
            await AgentObjectUtil.editObject(other, {id: canvas.id, look: 4});
            await AgentObjectUtil.removeObject(other, canvas.id);

            expect(eventsOf(agent).map(({kind, who, whoIsAgent, type, id}) => ({kind, who, whoIsAgent, type, id})))
                .toEqual([
                    {kind: "objectAdded", who: "Other", whoIsAgent: true, type: "canvas", id: canvas.id},
                    {kind: "objectChanged", who: undefined, whoIsAgent: undefined, type: "canvas", id: canvas.id},
                    {kind: "objectRemoved", who: undefined, whoIsAgent: undefined, type: "canvas", id: canvas.id},
                ]);
            expect(eventsOf(other)).toEqual([]);
        });

        it("tells an agent of an edit of its own the server refused only through the tool that made it", async () => {
            const agent = await arriveAgent("Builder");
            const room = roomOf(agent);
            eventsOf(agent);

            // Into the boundary wall: the server answers with the block that is there, as it answers a browser.
            await AgentSignalUtil.send(agent, "addVoxelBlockSignal", new AddVoxelBlockSignal(room.id,
                VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(0, 0, 0), [1, 1, 1, 1, 1, 1]));

            expect(eventsOf(agent)).toEqual([]);
        });
    });

    describe("room settings", () => {
        it("tells how the room looks, by the customize-room panel's settings, and what each can take", async () => {
            const agent = await arriveAgent("Looker");

            const seen = AgentRoomSettingsUtil.look(agent) as any;
            expect(seen.yours).toBe(false);
            expect(Object.keys(seen.settings).sort()).toEqual(["ambient_light", "fog", "ground", "head_light", "sky",
                "smoke", "texture_pack"]);
            expect(seen.settings.texture_pack).toBe(roomOf(agent).texturePackPath);
            expect(seen.settings.fog).toEqual({color: "#000000", near: 100, far: 100});
            expect(seen.texture_packs).toEqual(["default", "country", "garden", "aqua", "inferno", "prison"]);
            expect(seen.light_colors[0]).toBe("#ffffff");
            expect(seen.atmosphere_colors).toContain("#000000");
        });

        it("changes its own room's look as its owner would in a browser, which the people there see", async () => {
            const agent = await agentWithOwnRoom("Decorator", HOME_ID);
            const visitor = await joinHuman("Visitor", HOME_ID);
            receivedSignals(visitor);

            const changed = await AgentRoomSettingsUtil.change(agent, {texture_pack: "garden",
                fog: {color: "#103080", near: 20, far: 60}, sky: {cloud_strength: 50}}) as any;

            // The color is the palette's nearest; levels come back as the steps they became.
            expect(changed.settings.texture_pack).toBe("garden");
            expect(changed.settings.fog).toEqual({color: "#070081", near: 20, far: 60});
            expect(changed.settings.sky.cloud_strength).toBe(51);
            const prefs = RoomPrefsUtil.decode(roomOf(agent).prefs);
            expect(prefs.fogNearStep).toBe(Math.round(20 * MAX_ROOM_PREFS_STEP / 100));

            const sent = receivedSignals(visitor).map(received => received.signalType);
            expect(sent).toEqual(expect.arrayContaining(["roomTexturePackChangedSignal", "roomPrefsChangedSignal"]));
        });

        it("keeps the fog's near from passing its far, as the panel does", async () => {
            const agent = await agentWithOwnRoom("Fogger", HOME_ID);
            await AgentRoomSettingsUtil.change(agent, {fog: {near: 30, far: 40}});

            expect(((await AgentRoomSettingsUtil.change(agent, {fog: {near: 70}})) as any).settings.fog)
                .toEqual(expect.objectContaining({near: 70, far: 70}));
            expect(((await AgentRoomSettingsUtil.change(agent, {fog: {far: 10}})) as any).settings.fog)
                .toEqual(expect.objectContaining({near: 10, far: 10}));
        });

        it("refuses others' rooms, hubs, unknown texture packs and colors that aren't colors", async () => {
            const visitor = await arriveAgent("Visitor");
            expect((await AgentRoomSettingsUtil.change(visitor, {fog: {near: 10}}) as any).error)
                .toMatch(/your own room/);

            const owner = await agentWithOwnRoom("Owner", HOME_ID);
            expect((await AgentRoomSettingsUtil.change(owner, {texture_pack: "moon"}) as any).error)
                .toMatch(/no texture pack "moon".*default, country/);
            expect((await AgentRoomSettingsUtil.change(owner, {fog: {color: "blue"}}) as any).error)
                .toMatch(/fog.color is a color/);
            expect(roomOf(owner).texturePackPath).toBe("default");
        });
    });

    describe("appearance", () => {
        // The look browsers draw a character in.
        function drawnLook(obj: AddObjectSignal): any
        {
            const params: any = {};
            ObjectCompositionUtil.decode(obj, params, []);
            return params;
        }

        it("tells its own look as people see it, part by part as the customize panel has them, with every shape and "
            + "color each can take", async () => {
            const agent = await arriveAgent("Model");

            const seen = AgentAppearanceUtil.look(agent) as any;
            expect(Object.keys(seen.appearance)).toEqual(["head", "eyes", "ears", "hat", "torso", "arms", "bottom"]);
            // Every shape has words of its own, in the order they are numbered from 1; those past the free ones are locked.
            for (const [part, numShapes] of Object.entries(AgentAppearanceUtil.getShapeCounts()))
            {
                expect(seen.shapes[part], part).toHaveLength(numShapes);
                expect(new Set(seen.shapes[part]).size, part).toBe(numShapes);
                expect(seen.appearance[part].shape_name).toBe(seen.shapes[part][seen.appearance[part].shape - 1]);
                expect(seen.locked_shapes[part], part).toEqual(lockedShapesOf(numShapes));
                expect(seen.appearance[part].shape, part).toBeLessThanOrEqual(NUM_FREE_PLAYER_PART_TYPES);
            }
            expect(seen.shape_price_dollars).toBe(PLAYER_SHAPE_PRICE_DOLLARS);
            expect(seen.dollars).toBe(0);
            expect(seen.part_colors).toHaveLength(ColorUtil.getPaletteSize("Player"));
            expect(seen.eye_colors[0]).toBe("#189618");

            // Having chosen nothing, it wears the default drawn from its id, as browsers draw it.
            const drawn = drawnLook(AgentRoomUtil.getMyPlayer(agent)!);
            expect(seen.appearance.hat.shape).toBe(drawn.types.hat + 1);
            expect(seen.appearance.arms.color).toBe(ColorUtil.rgbToHex(drawn.colors.arm));
            expect(seen.appearance.eyes.color).toBe(ColorUtil.rgbToHex(drawn.colors.eye));
        });

        it("changes its own look as a person does in the customize panel, which the people there see, and keeps it "
            + "for its next visit", async () => {
            const {dbUser} = await registerAgent("Dresser");
            const agent = await attendAgent(dbUser);
            const human = await joinHuman("Onlooker", currentRoomID(agent));
            receivedSignals(human);
            const edits = UserBudgetUtil.getLevel(agent.user.id, "edit");

            const changed = await AgentAppearanceUtil.change(agent, {head: {shape: 2, color: "#1020f0"},
                eyes: {color: "#ff00ff"}, bottom: {shape: NUM_FREE_PLAYER_PART_TYPES}}) as any;

            // A color comes back as the nearest its palette holds.
            expect(changed.appearance.head).toEqual({shape: 2, shape_name: "drum, its round face forward", color: "#0905ff"});
            expect(changed.appearance.eyes).toEqual({color: "#c83cc8"});
            expect(changed.appearance.bottom.shape).toBe(NUM_FREE_PLAYER_PART_TYPES);
            expect(UserBudgetUtil.getLevel(agent.user.id, "edit")).toBeLessThan(edits);

            // The people there are sent it as a browser's change, and draw it.
            const sent = receivedSignals(human).filter(({signalType, signal}) => signalType == "setObjectMetadataSignal"
                && signal.metadataKey == ObjectMetadataKeyEnumMap.InstancedMeshComposition);
            expect(sent).toHaveLength(1);
            const drawn = drawnLook(AgentRoomUtil.getMyPlayer(agent)!);
            expect(drawn.types.head).toBe(1);
            expect(ColorUtil.rgbToHex(drawn.colors.eye)).toBe("#c83cc8");

            await AgentToolUtil.leave(agent);
            const back = await attendAgent(dbUser);
            expect((AgentAppearanceUtil.look(back) as any).appearance).toEqual(changed.appearance);
        });

        it("refuses what its parts can't take, and spends nothing when nothing changes", async () => {
            const agent = await arriveAgent("Picky");
            const before = (AgentAppearanceUtil.look(agent) as any).appearance;

            expect((await AgentAppearanceUtil.change(agent, {hat: {shape: 7}}) as any).error)
                .toMatch(/hat.shape is a number from 1 to 6/);
            expect((await AgentAppearanceUtil.change(agent, {arms: {color: "gold"}}) as any).error)
                .toMatch(/arms.color is a color/);
            expect((await AgentAppearanceUtil.change(agent, {eyes: {shape: 2}}) as any).error).toMatch(/no shape/);
            expect((await AgentAppearanceUtil.change(agent, {tail: {shape: 1}}) as any).error).toMatch(/no part "tail"/);

            const edits = UserBudgetUtil.getLevel(agent.user.id, "edit");
            const unchanged = await AgentAppearanceUtil.change(agent, {hat: {shape: before.hat.shape}}) as any;
            expect(unchanged.appearance).toEqual(before);
            expect(UserBudgetUtil.getLevel(agent.user.id, "edit")).toBeGreaterThanOrEqual(edits);
            expect(AgentRoomUtil.getMyPlayer(agent)!.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition])
                .toBeUndefined();
        });

        // What it holds, there and in its row, which a purchase goes by.
        async function giveDollars(agent: AgentUserContext, dollars: number): Promise<void>
        {
            agent.inventory[InventoryItemTypeEnumMap.Dollar] = dollars;
            (await DBUserUtil.findUserById(agent.user.id))!.inventory = {...agent.inventory};
            ServerInventoryManager.tellUser(agent);
            agent.inbox.take();
        }

        it("won't put on a locked shape, says what will, and spends nothing", async () => {
            const agent = await arriveAgent("Window-Shopper");
            const plenty = 5 * PLAYER_SHAPE_PRICE_DOLLARS;
            await giveDollars(agent, plenty);
            const before = (AgentAppearanceUtil.look(agent) as any).appearance;

            const refused = await AgentAppearanceUtil.change(agent,
                {head: {shape: FIRST_LOCKED_SHAPE, color: "#ffffff"}}) as any;

            expect(refused.error).toContain(`head shape ${FIRST_LOCKED_SHAPE} is locked: unlock_shape buys it for `
                + `$${PLAYER_SHAPE_PRICE_DOLLARS}`);
            expect((AgentAppearanceUtil.look(agent) as any).appearance).toEqual(before);
            expect(agent.inventory[InventoryItemTypeEnumMap.Dollar]).toBe(plenty);
        });

        it("buys a locked shape and puts it on, as a click in the panel does, for the people there to see", async () => {
            const agent = await arriveAgent("Shopper");
            const human = await joinHuman("Onlooker", currentRoomID(agent));
            const left = 2;
            await giveDollars(agent, PLAYER_SHAPE_PRICE_DOLLARS + left);
            receivedSignals(human);
            const counts = AgentAppearanceUtil.getShapeCounts();
            const shape = middleLockedShape(counts.head);

            const unlocked = await AgentAppearanceUtil.unlock(agent, "head", shape) as any;

            const seen = AgentAppearanceUtil.look(agent) as any;
            expect(unlocked.appearance.head.shape).toBe(shape);
            expect(unlocked.appearance.head.shape_name).toBe(seen.shapes.head[shape - 1]);
            expect(agent.inventory[InventoryItemTypeEnumMap.Dollar]).toBe(left);
            expect(drawnLook(AgentRoomUtil.getMyPlayer(agent)!).types.head).toBe(shape - 1);
            expect(seen.locked_shapes.head).toEqual(lockedShapesOf(counts.head).filter(other => other != shape));
            expect(seen.locked_shapes.hat).toEqual(lockedShapesOf(counts.hat));
            expect(seen.dollars).toBe(left);
            expect(receivedSignals(human).filter(({signalType, signal}) => signalType == "setObjectMetadataSignal"
                && signal.metadataKey == ObjectMetadataKeyEnumMap.InstancedMeshComposition)).toHaveLength(1);

            // Spending isn't news.
            expect((AgentToolUtil.whatsNew(agent) as any).events.filter((event: any) => event.kind == "dollarCollected")).toEqual([]);
        });

        it("takes off what it bought and puts it on again for nothing", async () => {
            const agent = await arriveAgent("Keeper");
            await giveDollars(agent, PLAYER_SHAPE_PRICE_DOLLARS);
            // The last shape of the part, which is for sale.
            const bought = AgentAppearanceUtil.getShapeCounts().torso;
            await AgentAppearanceUtil.unlock(agent, "torso", bought);

            expect(((await AgentAppearanceUtil.change(agent, {torso: {shape: 1}})) as any).appearance.torso.shape).toBe(1);
            expect(((await AgentAppearanceUtil.change(agent, {torso: {shape: bought}})) as any).appearance.torso.shape)
                .toBe(bought);
            expect(agent.inventory[InventoryItemTypeEnumMap.Dollar]).toBe(0);

            await AgentAppearanceUtil.change(agent, {torso: {shape: 1}});
            expect(((await AgentAppearanceUtil.unlock(agent, "torso", bought)) as any).appearance.torso.shape)
                .toBe(bought);
            expect(agent.inventory[InventoryItemTypeEnumMap.Dollar]).toBe(0);
        });

        it("just puts on a shape that is free, whatever it has", async () => {
            const agent = await arriveAgent("Thrifty");
            expect(((await AgentAppearanceUtil.unlock(agent, "hat", 2)) as any).appearance.hat.shape).toBe(2);
        });

        it("says what is wrong with what it can't buy, spending nothing", async () => {
            const agent = await arriveAgent("Short");
            const dollars = PLAYER_SHAPE_PRICE_DOLLARS - 1;
            await giveDollars(agent, dollars);
            const numHatShapes = AgentAppearanceUtil.getShapeCounts().hat;

            expect((await AgentAppearanceUtil.unlock(agent, "hat", FIRST_LOCKED_SHAPE) as any).error)
                .toContain(`costs $${PLAYER_SHAPE_PRICE_DOLLARS}, and you have $${dollars}`);
            expect((await AgentAppearanceUtil.unlock(agent, "tail", FIRST_LOCKED_SHAPE) as any).error)
                .toMatch(/no part "tail"/);
            expect((await AgentAppearanceUtil.unlock(agent, "eyes", 1) as any).error).toMatch(/no part "eyes"/);
            expect((await AgentAppearanceUtil.unlock(agent, "hat", numHatShapes + 1) as any).error)
                .toContain(`from 1 to ${numHatShapes}`);
            expect(agent.inventory[InventoryItemTypeEnumMap.Dollar]).toBe(dollars);
        });

        it("says when the row won't have it, spending nothing", async () => {
            const agent = await arriveAgent("Unlucky");
            await giveDollars(agent, PLAYER_SHAPE_PRICE_DOLLARS);
            vi.mocked(DBInventoryUtil.buyItem).mockResolvedValueOnce("refused");

            expect((await AgentAppearanceUtil.unlock(agent, "hat", FIRST_LOCKED_SHAPE) as any).error)
                .toMatch(/no dollars were spent/);
            expect(agent.inventory[InventoryItemTypeEnumMap.Dollar]).toBe(PLAYER_SHAPE_PRICE_DOLLARS);
        });

        it("tells all it holds, and everything still for sale, by the numbers appearance gives", async () => {
            const agent = await arriveAgent("Accountant");

            const shapeNames = (AgentAppearanceUtil.look(agent) as any).shapes;
            const empty = AgentInventoryUtil.describe(agent) as any;
            expect(empty.dollars).toBe(0);
            expect(empty.shapes_held).toEqual([]);
            expect(empty.shapes_for_sale).toHaveLength(numShapesForSale());
            expect(empty.shapes_for_sale[0]).toEqual({part: "head", shape: FIRST_LOCKED_SHAPE,
                shape_name: shapeNames.head[FIRST_LOCKED_SHAPE - 1]});
            expect(empty.shape_price_dollars).toBe(PLAYER_SHAPE_PRICE_DOLLARS);
            expect(new Set(empty.shapes_for_sale.map(({part}: any) => part)))
                .toEqual(new Set(Object.keys(AgentAppearanceUtil.getShapeCounts())));

            const left = 3;
            await giveDollars(agent, PLAYER_SHAPE_PRICE_DOLLARS + left);
            const bought = {part: "hat", shape: FIRST_LOCKED_SHAPE, shape_name: shapeNames.hat[FIRST_LOCKED_SHAPE - 1]};
            await AgentAppearanceUtil.unlock(agent, bought.part, bought.shape);

            const after = AgentInventoryUtil.describe(agent) as any;
            expect(after.dollars).toBe(left);
            expect(after.shapes_held).toEqual([bought]);
            expect(after.shapes_for_sale).toHaveLength(numShapesForSale() - 1);
            expect(after.shapes_for_sale).not.toContainEqual(bought);
        });

        it("tells how someone in the room looks, by name, but nothing of a ghost", async () => {
            const agent = await arriveAgent("Watcher");
            const stored = encodePlayerComposition(5);
            await joinHuman("Dressed", currentRoomID(agent),
                {[ObjectMetadataKeyEnumMap.InstancedMeshComposition]: stored});

            const seen = AgentAppearanceUtil.look(agent, "dressed") as any;
            expect(seen.name).toBe("Dressed");
            const {params} = decodePlayerComposition(stored);
            expect(seen.appearance.torso.shape).toBe(params.types.torso + 1);
            expect(seen.appearance.eyes.color).toBe(ColorUtil.rgbToHex(params.colors.eye));
            // What the agent's own can take is for its own alone.
            expect(seen.shapes).toBeUndefined();
            expect((AgentAppearanceUtil.look(agent, "Nobody") as any).error).toMatch(/Nobody named "Nobody"/);

            const ghost = harness.connectUser({id: "id-Ghost", userName: "Ghost", userType: UserTypeEnumMap.Admin,
                playerMetadata: {[ObjectMetadataKeyEnumMap.AdminPrefs]: AdminPrefsUtil.encode({ghostMode: true})}});
            await harness.joinRoom(ghost, currentRoomID(agent)!);
            expect((AgentAppearanceUtil.look(agent, "Ghost") as any).error).toMatch(/Nobody named "Ghost"/);
            await harness.disconnectUser(ghost);
        });
    });

    describe("limits", () => {
        it("tells an agent when it talks faster than anyone may, rather than letting it speak unheard", async () => {
            const agent = await arriveAgent("Talker");
            for (let i = 0; i < USER_BUDGETS.speech.capacity; ++i)
                expect((await AgentToolUtil.say(agent, `line ${i}`) as any).saying).toBe(`line ${i}`);

            const refused = await AgentToolUtil.say(agent, "one too many") as any;
            // Until the budget holds one more line, in whole seconds.
            const wait = Math.max(1, Math.ceil(1 / USER_BUDGETS.speech.refillPerSecond));
            expect(refused.error).toContain(`try again in about ${(wait == 1) ? "a second" : `${wait} seconds`}.`);
            expect(playerMetadataOf(agent.user.id)[ObjectMetadataKeyEnumMap.SentMessage])
                .toBe(`line ${USER_BUDGETS.speech.capacity - 1}`);
        });

        it("tells an agent whose edits have run out when it may place something again", async () => {
            const agent = await arriveAgent("Builder");
            await AgentBlockUtil.placeBlocks(agent,
                {rows: [10, 10 + USER_BUDGETS.edit.capacity / 10 - 1], columns: [10, 19], layers: [0]}, "oak");

            const refused = await AgentObjectUtil.addObject(agent, {type: "lamp",
                on: {row: 1, column: 20, layer: 2, side: "south"}}) as any;
            expect(refused.error).toMatch(/edits have run out.*try again in about a second/);

            vi.setSystemTime(Date.now() + Math.ceil(1000 / USER_BUDGETS.edit.refillPerSecond));
            expect((await AgentObjectUtil.addObject(agent, {type: "lamp",
                on: {row: 1, column: 20, layer: 2, side: "south"}}) as any).added).toBeDefined();
        });

        it("lets no more agents in than may be present at once, while those present carry on", async () => {
            const {dbUser: present} = await registerAgent("Present");
            const presentAgent = await AgentPresenceUtil.attend(present);
            for (let i = 1; i < AGENT_MAX_PRESENT; ++i)
            {
                ServerUserManager.socketUserContexts[`stand-in-${i}`] = new AgentUserContext(
                    new User(`stand-in-${i}`, `Stand-in-${i}`, UserTypeEnumMap.Agent, "", ""), "", 0, {}, "");
            }

            const {dbUser: latecomer} = await registerAgent("Latecomer");
            expect(await AgentPresenceUtil.attend(latecomer)).toBeUndefined();
            expect(ServerUserManager.hasUser(latecomer.id as string)).toBe(false);
            expect(await AgentPresenceUtil.attend(present)).toBe(presentAgent);

            await AgentPresenceUtil.leave(presentAgent!);
            expect(await AgentPresenceUtil.attend(latecomer)).toBeDefined();
        });
    });

    describe("the dispatch agents share with browsers", () => {
        it("drops a signal sent sooner than its type allows, whoever sends it", async () => {
            const human = await joinHuman("Alice");
            const request = new RequestRoomChangeSignal(HUB_ID, false);

            expect(await dispatchAs(human, "requestRoomChangeSignal", request)).toBe(true);
            expect(await dispatchAs(human, "requestRoomChangeSignal", request)).toBe(false);
        });

        it("logs how fast a user edited and spoke when their connection ends", async () => {
            // Rates are kept by user id across tests, so this one has a user of its own.
            const human = await joinHuman("Rate-Tester");
            const roomID = ServerRoomManager.currentRoomIDByUserID[human.user.id];
            const playerId = harness.getPlayerObjectId(human)!;
            const logSpy = vi.spyOn(LogUtil, "log");

            for (const text of ["one", "two", "three"])
                await dispatchAs(human, "setObjectMetadataSignal",
                    new SetObjectMetadataSignal(roomID, playerId, ObjectMetadataKeyEnumMap.SentMessage, text));
            await UserSessionUtil.release(human.socketUserContext);

            const rates = logSpy.mock.calls.filter(([title]) => title == "Edit rates").map(([, data]) => data);
            expect(rates).toEqual([{userType: UserTypeEnumMap.Guest, kind: "speech", total: 3,
                maxPer10s: 3, maxPerMinute: 3, minutes: 0}]);
        });
    });

    describe("the MCP endpoint", () => {
        let server: http.Server;
        let url: URL;

        beforeAll(async () => {
            const app = express();
            app.set("view engine", "ejs");
            app.set("views", path.resolve(__dirname, "../../../views"));
            app.use(bodyParser.json());
            app.use(bodyParser.urlencoded({extended: true}));
            // As Router mounts it, but for its rate limits.
            app.use(AgentRouter);
            server = await new Promise<http.Server>(resolve => {
                const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
            });
            url = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`);
        });

        // The server's own address, which its sign-in metadata names as the issuer and the endpoints.
        beforeEach(() => {
            vi.spyOn(AddressUtil, "getEnvDynamicURL").mockReturnValue(url.origin);
        });

        afterAll(async () => {
            server.closeAllConnections();
            await new Promise<void>(resolve => server.close(() => resolve()));
        });

        async function connect(key?: string): Promise<Client>
        {
            const client = new Client({name: "test-agent", version: "1.0.0"});
            await client.connect(new StreamableHTTPClientTransport(url,
                key == undefined ? undefined : {requestInit: {headers: {Authorization: `Bearer ${key}`}}}));
            return client;
        }

        // As a host that takes only an address connects.
        async function connectTo(address: string): Promise<Client>
        {
            const client = new Client({name: "test-agent", version: "1.0.0"});
            await client.connect(new StreamableHTTPClientTransport(new URL(address)));
            return client;
        }

        function read(result: any): any
        {
            return JSON.parse(result.content[0].text);
        }

        it("says what a cannon costs and does where agents read of it, each number from its constant", async () => {
            const client = await connect();
            try
            {
                const instructions = client.getInstructions()!;
                expect(instructions).toContain(`$${CANNON_PRICE_DOLLARS} each time`);
                expect(instructions).toContain(`waits ${CANNON_FIRE_INTERVAL_SECONDS[0]} to ${CANNON_FIRE_INTERVAL_SECONDS[1]} seconds`);
                expect(instructions).toContain(`${Math.round(CANNON_TURN_RATE * 180 / Math.PI)} degrees a`);
                expect(instructions.replace(/\s+/g, " ")).toContain(`pointed for ${CANNON_LOCK_SECONDS} second`);
                expect(instructions).toContain(`within ${CANNON_MAX_RANGE / VOXEL_CELL_SIZE} cells`);
                expect(instructions).toContain(`It has ${CANNON_BALL_COUNT} balls`);
                expect(instructions).toContain(`${CANNON_BALL_SPEED / VOXEL_CELL_SIZE} cells a second`);
                expect(instructions.replace(/\s+/g, " ")).toContain(`each bounce adds up to ${
                    CANNON_BALL_BOUNCE_BOOST / VOXEL_CELL_SIZE} cells a second, to ${CANNON_BALL_MAX_SPEED / VOXEL_CELL_SIZE} at most`);
                expect(instructions.replace(/\s+/g, " ")).toMatch(/A ball bounces off [^.:]*\ba cannon\b/);
                expect(instructions.replace(/\s+/g, " ")).toMatch(/breaks the blocks it reaches[^.]*\bhold up a cannon\b/);
                const tools = (await client.listTools()).tools;
                const addObject = tools.find(tool => tool.name == "add_object")!;
                expect(addObject.description).toContain(`$${CANNON_PRICE_DOLLARS}`);
                expect(JSON.stringify(addObject.inputSchema)).toContain("cannon");
                expect(JSON.stringify(tools.find(tool => tool.name == "edit_object")!.inputSchema)).toContain("switched_on");
            }
            finally
            {
                await client.close();
            }
        });

        it("serves the tools, with instructions on how to get in", async () => {
            const client = await connect();
            try
            {
                const listed = (await client.listTools()).tools;
                const tools = listed.map(tool => tool.name).sort();
                expect(tools).toEqual(["add_object", "add_zone", "appearance", "camera", "change_appearance",
                    "change_room_settings", "collect_bill", "edit_object", "face",
                    "find_pictures", "find_rooms", "inventory", "leave", "look", "look_blocks", "move_object", "new_key", "paint_faces",
                    "place_blocks", "register", "remove_blocks", "remove_object", "room_settings", "say", "set_interests",
                    "textures", "travel", "typing", "unlock_shape", "use_door", "walk_to", "whats_new"]);
                // A connector directory lists a tool by its title, and asks whether it only reads or may destroy.
                for (const tool of listed)
                {
                    expect(tool.title, tool.name).toBeTruthy();
                    expect(tool.annotations?.title, tool.name).toBe(tool.title);
                    expect(tool.annotations?.readOnlyHint === true || tool.annotations?.destructiveHint !== undefined,
                        tool.name).toBe(true);
                }
                expect(new Set(listed.map(tool => tool.title)).size).toBe(listed.length);
                expect(client.getInstructions()).toContain("Authorization: Bearer <key>");
                // What they are told of dollars reaches every tool that gains, spends or counts them.
                for (const tool of ["collect_bill", "unlock_shape", "inventory", "change_appearance"])
                    expect(client.getInstructions()!.split("Dollars are what you hold")[1], tool).toContain(tool);
                // The numbers the manual leaves to them, from the constants themselves.
                const instructions = client.getInstructions()!.replace(/\s+/g, " ");
                for (const number of [`leaves after ${AGENT_PRESENCE_IDLE_TIMEOUT_MS / MINUTE_IN_MS} minutes without one`,
                    `come within about ${Math.floor(DOLLAR_BILL_REACH / VOXEL_CELL_SIZE)} cells of one`,
                    `facing it to within ${Math.round(REACH_ANGLE * 180 / Math.PI)} degrees`,
                    `gives you $${LOGIN_REWARD_DOLLARS} once a day`,
                    `once ${LOGIN_REWARD_INTERVAL_MS / HOUR_IN_MS} hours have passed`,
                    `The first ${NUM_FREE_PLAYER_PART_TYPES} of each part are free`,
                    `unlock_shape spends $${PLAYER_SHAPE_PRICE_DOLLARS} on any other`,
                    `hears you within ${HEARING_DISTANCE / VOXEL_CELL_SIZE} cells on its own floor`,
                    `Requests: ${AGENT_REQUESTS_PER_MINUTE} a minute from one address`])
                    expect(instructions).toContain(number);
                // No account is deleted for being away, and they are told so.
                expect(instructions).toContain("your room and what you built stay, however long you are away");
                // Connector directories refuse servers that send the model to outside instructions or have it ask
                // its user for visits, so the manual is offered to whoever runs the agent, as information.
                expect(client.getInstructions()).toMatch(/The manual, for whoever runs you:/);
                expect(client.getInstructions()).not.toMatch(/manual for you|ask them for a visit/);
                // How whoever runs an agent watches it, and how an agent with a browser tool takes pictures.
                expect(client.getInstructions())
                    .toMatch(/camera: a private link[\s\S]*Give it to whoever\s+runs you[\s\S]*Keep it open while you play: a screenshot of it/);
            }
            finally
            {
                await client.close();
            }
        });

        it("offers its host one prompt that sends the agent in, and never says its lists may change", async () => {
            const client = await connect();
            try
            {
                expect(client.getServerCapabilities()?.tools).toEqual({listChanged: false});
                expect(client.getServerCapabilities()?.prompts).toEqual({listChanged: false});
                const prompts = (await client.listPrompts()).prompts;
                expect(prompts.map(prompt => prompt.name)).toEqual(["visit"]);
                expect(prompts[0].title).toBe("Visit ThingsPool");
                const message = (await client.getPrompt({name: "visit"})).messages[0];
                expect(message.role).toBe("user");
                // What it asks for, the tools do: a look around, a hello, a build at home, its links.
                const text = (message.content as {type: "text", text: string}).text;
                for (const ask of ["Look around", "say hello", "your own room", "link to your room", "camera link"])
                    expect(text).toContain(ask);
            }
            finally
            {
                await client.close();
            }
        });

        it("registers an agent without a key, which then plays with it", async () => {
            const anonymous = await connect();
            const registered = read(await anonymous.callTool({name: "register", arguments: {name: "Mcp-Agent"}}));
            await anonymous.close();
            expect(registered.userName).toBe("Mcp-Agent");
            // For hosts that take only an address: the public one, which this server stands in for.
            expect(registered.address).toBe(`http://localhost:3000/mcp/${registered.key}`);

            const agent = await connect(registered.key);
            try
            {
                const seen = read(await agent.callTool({name: "look", arguments: {}}));
                expect(seen.room.id).toBe(HUB_ID);
                expect(seen.you.name).toBe("Mcp-Agent");

                expect(read(await agent.callTool({name: "say", arguments: {text: "hi"}}))).toEqual({saying: "hi"});
                expect(read(await agent.callTool({name: "whats_new", arguments: {}})).events
                    .map((event: AgentEvent) => event.kind)).toEqual(["roomEntered"]);
            }
            finally
            {
                await agent.close();
            }
        });

        it("says it is the version its MCP Registry entry lists", async () => {
            const entry = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../server.json"), "utf8"));
            const client = await connect();
            try
            {
                expect(client.getServerVersion()?.version).toBe(entry.version);
                // The same icon in both, served from the endpoint's own address.
                const icon = client.getServerVersion()?.icons?.[0];
                expect(icon?.src).toBe(`${url.origin}/largeLogo.jpg`);
                expect(new URL(entry.icons[0].src).pathname).toBe(new URL(icon!.src).pathname);
            }
            finally
            {
                await client.close();
            }
        });

        it("serves the favicon and the icon it names at its own address, where hosts look for them", async () => {
            for (const file of ["favicon.ico", "largeLogo.jpg"])
            {
                const response = await fetch(`${url.origin}/${file}`);
                expect(response.status, file).toBe(200);
                expect(response.headers.get("content-type"), file).toMatch(/^image\//);
            }
        });

        it("builds as the tools do, boxes and faces given as the instructions describe them", async () => {
            const anonymous = await connect();
            const registered = read(await anonymous.callTool({name: "register", arguments: {name: "Mcp-Builder"}}));
            await anonymous.close();

            const agent = await connect(registered.key);
            try
            {
                expect(read(await agent.callTool({name: "place_blocks", arguments: {rows: [30, 31], columns: [30],
                    layers: [0], texture: "oak"}}))).toEqual({placed: 2, texture: "oak"});
                expect(read(await agent.callTool({name: "look_blocks", arguments: {rows: [29, 32], columns: [29, 31],
                    layers: [0, 2]}})).blocks).toEqual([{rows: [30, 31], columns: [30, 30], layers: [0, 0],
                    texture: "oak"}]);

                const lamp = read(await agent.callTool({name: "add_object", arguments: {type: "lamp",
                    on: {row: 30, column: 30, layer: 0, side: "up"}}}));
                expect(lamp.added).toEqual(expect.objectContaining({type: "lamp",
                    on: {row: 30, column: 30, layer: 0, side: "up"}}));

                const misplaced = await agent.callTool({name: "add_object", arguments: {type: "lamp",
                    on: {row: 30, column: 30, layer: 0, side: "sideways"}}}) as any;
                expect(misplaced.isError).toBe(true);
            }
            finally
            {
                await agent.close();
            }
        });

        it("caps an agent's calls, those of the tools that look apart from the rest, and says when to call again",
            async () => {
            const anonymous = await connect();
            const registered = read(await anonymous.callTool({name: "register", arguments: {name: "Mcp-Caller"}}));
            await anonymous.close();

            const agent = await connect(registered.key);
            try
            {
                for (let i = 0; i < USER_BUDGETS.agentReads.capacity; ++i)
                    expect((await agent.callTool({name: "whats_new", arguments: {}}) as any).isError, `look ${i}`).toBe(false);
                const refused = await agent.callTool({name: "look", arguments: {}}) as any;
                expect(refused.isError).toBe(true);
                expect(read(refused).error).toMatch(/the tools that look faster than anyone may: try again in about a second/);

                // The other tools are paid for apart.
                expect(read(await agent.callTool({name: "say", arguments: {text: "still here"}}))).toEqual({saying: "still here"});
            }
            finally
            {
                await agent.close();
            }
        });

        it("changes a room's settings, every group at once, within what one call may hold", async () => {
            const {key} = await registerAgent("Mcp-Decorator");
            const agent = await connect(key);
            try
            {
                await agent.callTool({name: "travel", arguments: {destination: "home"}});
                const everything = {texture_pack: "aqua", ambient_light: {color: "#ffffff", strength: 40},
                    head_light: {color: "#ffd5aa", power: 60, range: 60}, fog: {color: "#2a2a2a", near: 30, far: 80},
                    smoke: {strength: 40, scale: 50, speed: 30, drift: 20, rise: 60},
                    sky: {color: "#82ccfd", cloud_color: "#ffffff", cloud_strength: 50, cloud_scale: 60,
                        cloud_softness: 50, cloud_speed: 30},
                    ground: {color: "#006903", peaks: "#9ce9a1", opacity: 60, scale: 40, softness: 50}};
                const changed = read(await agent.callTool({name: "change_room_settings", arguments: everything}));
                expect(changed.settings.texture_pack).toBe("aqua");
                expect(changed.settings.ground).toEqual(expect.objectContaining({color: "#006903", peaks: "#9ce9a1"}));
                expect(read(await agent.callTool({name: "room_settings", arguments: {}})).settings)
                    .toEqual(changed.settings);
            }
            finally
            {
                await agent.close();
            }
        });

        it("changes an agent's appearance, every part at once, and refuses a shape past the last", async () => {
            const {key} = await registerAgent("Mcp-Dresser");
            const agent = await connect(key);
            try
            {
                const lastFree = NUM_FREE_PLAYER_PART_TYPES;
                const everything = {head: {shape: lastFree, color: "#ffffff"}, eyes: {color: "#2896d2"},
                    ears: {shape: lastFree, color: "#ff9e00"}, hat: {shape: 2, color: "#dec900"},
                    torso: {shape: lastFree, color: "#0905ff"}, arms: {shape: 2, color: "#979797"},
                    bottom: {shape: 2, color: "#2a2a2a"}};
                const changed = read(await agent.callTool({name: "change_appearance", arguments: everything}));
                expect(changed.appearance.hat).toEqual({shape: 2, shape_name: "brimmed hat", color: "#dec900"});
                expect(changed.appearance.eyes).toEqual({color: "#2896d2"});
                expect(read(await agent.callTool({name: "appearance", arguments: {}})).appearance)
                    .toEqual(changed.appearance);

                const numHatShapes = AgentAppearanceUtil.getShapeCounts().hat;
                const refused = await agent.callTool({name: "change_appearance",
                    arguments: {hat: {shape: numHatShapes + 1}}}) as any;
                expect(refused.isError).toBe(true);
                const locked = await agent.callTool({name: "change_appearance",
                    arguments: {hat: {shape: middleLockedShape(numHatShapes)}}}) as any;
                expect(locked.isError).toBe(true);
                expect(locked.content[0].text).toMatch(/unlock_shape/);
            }
            finally
            {
                await agent.close();
            }
        });

        it("unlocks a shape, by its part's name as appearance gives it, and refuses what can't be", async () => {
            const {key, dbUser} = await registerAgent("Mcp-Shopper");
            const agent = await connect(key);
            try
            {
                const numHatShapes = AgentAppearanceUtil.getShapeCounts().hat;
                const shape = middleLockedShape(numHatShapes);
                const broke = await agent.callTool({name: "unlock_shape", arguments: {part: "hat", shape}}) as any;
                expect(broke.isError).toBe(true);
                expect(broke.content[0].text).toContain(`costs $${PLAYER_SHAPE_PRICE_DOLLARS}, and you have $0`);

                const context = ServerUserManager.getSocketUserContext(dbUser.id!)!;
                context.inventory[InventoryItemTypeEnumMap.Dollar] = PLAYER_SHAPE_PRICE_DOLLARS;
                (await DBUserUtil.findUserById(dbUser.id!))!.inventory = {...context.inventory};

                const unlocked = read(await agent.callTool({name: "unlock_shape", arguments: {part: "hat", shape}}));
                const seen = read(await agent.callTool({name: "appearance", arguments: {}}));
                expect(unlocked.appearance.hat.shape_name).toBe(seen.shapes.hat[shape - 1]);
                expect(seen.locked_shapes.hat).toEqual(lockedShapesOf(numHatShapes).filter(other => other != shape));

                const noSuchPart = await agent.callTool({name: "unlock_shape", arguments: {part: "eyes", shape: 1}}) as any;
                expect(noSuchPart.isError).toBe(true);
            }
            finally
            {
                await agent.close();
            }
        });

        it("tells of inventory and collecting a bill through the tools, as a read and an action", async () => {
            const {key, dbUser} = await registerAgent("Mcp-Counter");
            const agent = await connect(key);
            try
            {
                const held = read(await agent.callTool({name: "inventory", arguments: {}}));
                expect(held).toMatchObject({dollars: 0, shapes_held: [],
                    shape_price_dollars: PLAYER_SHAPE_PRICE_DOLLARS});
                expect(held.shapes_for_sale).toHaveLength(numShapesForSale());

                // Looking at what it holds is paid for as looking is.
                const actions = UserBudgetUtil.getLevel(dbUser.id!, "agentActions");
                await agent.callTool({name: "inventory", arguments: {}});
                expect(UserBudgetUtil.getLevel(dbUser.id!, "agentActions")).toBe(actions);

                const listed = (await agent.listTools()).tools;
                expect(listed.find(tool => tool.name == "inventory")!.annotations?.readOnlyHint).toBe(true);
                expect(listed.find(tool => tool.name == "collect_bill")!.annotations?.readOnlyHint).toBe(false);

                const none = await agent.callTool({name: "collect_bill", arguments: {}}) as any;
                expect(none.isError).toBe(true);
                expect(none.content[0].text).toMatch(/no bills in this room/);
            }
            finally
            {
                await agent.close();
            }
        });

        it("keeps what the manual says of dollars true, tool by tool", () => {
            const manual = fs.readFileSync(path.resolve(__dirname, "../../../public/skill.md"), "utf8");
            const dollars = manual.split("## 5. Dollars")[1].split("## 6. Manners")[0];
            for (const tool of ["inventory", "look", "whats_new", "collect_bill", "walk_to", "face", "appearance",
                "unlock_shape", "change_appearance"])
                expect(dollars, tool).toContain(`\`${tool}\``);
            // A step named by its number is still that step, whatever has been renumbered.
            for (const [, step] of manual.matchAll(/\(see step (\d+)\)/g))
                expect(manual, `step ${step}`).toMatch(new RegExp(`^## ${step}\\. `, "m"));
        });

        // It is published apart from the server, so a number in it would stay behind when its constant changed.
        it("gives no number the game could change, and sends agents to the server's instructions for them", () => {
            const manual = fs.readFileSync(path.resolve(__dirname, "../../../public/skill.md"), "utf8")
                .replace(/\s+/g, " ");

            expect(manual).not.toMatch(GAME_NUMBER);
            expect(manual).toContain("The server's instructions, which your client receives when it connects, and the "
                + "tools' own descriptions explain the world and every tool, with the numbers this manual leaves out");
        });

        it("keeps the manual's ClawHub copy in step with it, but for the license ClawHub requires", () => {
            const manual = fs.readFileSync(path.resolve(__dirname, "../../../public/skill.md"), "utf8");
            const clawhubCopy = fs.readFileSync(path.resolve(__dirname, "../../../dev/clawhub/thingspool/SKILL.md"),
                "utf8");
            // The frontmatter's license line, and the closing paragraph that names the license.
            const withoutLicense = (text: string) => text.replace(/^license: .*\n/m, "")
                .replace(/\nThis (copy of the )?manual is[\s\S]*$/, "");

            expect(manual).toMatch(/^license: Apache-2.0$/m);
            expect(clawhubCopy).toMatch(/^license: MIT-0$/m);
            expect(withoutLicense(clawhubCopy)).toBe(withoutLicense(manual));
        });

        it("names the same version at its end as in its frontmatter", () => {
            const manual = fs.readFileSync(path.resolve(__dirname, "../../../public/skill.md"), "utf8");
            const version = manual.match(/^ {2}version: "(.+)"$/m)?.[1];

            expect(version).toBeDefined();
            expect(manual).toContain(`\nVersion ${version}, `);
        });

        it("answers the calls the agents' manual shows curl making, as it says it does", async () => {
            const manual = fs.readFileSync(path.resolve(__dirname, "../../../public/skill.md"), "utf8");
            const bodies = [...manual.matchAll(/-d '(\{.*\})'/g)].map(match => JSON.parse(match[1]));
            const bodyFor = (method: string, tool?: string) => bodies.find(body => body.method == method
                && (tool == undefined || body.params.name == tool));
            // A curl of its own, apart from the other tests' registrations from this address.
            const post = async (body: object, key?: string) => {
                const response = await fetch(url, {method: "POST", body: JSON.stringify(body), headers: {
                    "Content-Type": "application/json", "Accept": "application/json, text/event-stream",
                    "User-Agent": "curl/8.7.1", ...(key == undefined ? {} : {Authorization: `Bearer ${key}`})}});
                const data = (await response.text()).split("\n").find(line => line.startsWith("data: "));
                return JSON.parse(data!.slice("data: ".length));
            };

            const registered = await post(bodyFor("tools/call", "register"));
            expect(registered.result.isError).toBeFalsy();
            const {key} = JSON.parse(registered.result.content[0].text);

            const said = await post(bodyFor("tools/call", "say"), key);
            expect(JSON.parse(said.result.content[0].text)).toEqual({saying: "Hello!"});
            // Without the key: a 401 whose message says what to do (see the manual's errors).
            const refused = await fetch(url, {method: "POST", body: JSON.stringify(bodyFor("tools/call", "say")),
                headers: {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}});
            expect(refused.status).toBe(401);
            expect(manual).toContain(((await refused.json()) as any).error.message.split(":")[0]);

            expect((await post(bodyFor("initialize"))).result.instructions).toContain("ThingsPool is a world");
            expect((await post({jsonrpc: "2.0", id: 1, method: "tools/list", params: {}})).result.tools
                .map((tool: {name: string}) => tool.name)).toContain("look");
        });

        it("plays with the key in the address, for hosts that can't send a header", async () => {
            const {key} = await registerAgent("Url-Agent");
            const agent = await connectTo(`${url.href}/${key}`);
            try
            {
                expect(read(await agent.callTool({name: "look", arguments: {}})).you.name).toBe("Url-Agent");
            }
            finally
            {
                await agent.close();
            }
        });

        it("gives an agent a new key when asked, after which only the new one plays", async () => {
            const {key} = await registerAgent("Rekey-Agent");
            const agent = await connect(key);
            let newKey = "";
            try
            {
                const given = read(await agent.callTool({name: "new_key", arguments: {}}));
                newKey = given.key;
                expect(given.address).toMatch(new RegExp(`/mcp/${newKey.replace(/[.]/g, "\\.")}$`));
            }
            finally
            {
                await agent.close();
            }

            const refused = await fetch(url, {method: "POST", body: JSON.stringify({jsonrpc: "2.0", id: 1,
                method: "tools/call", params: {name: "look", arguments: {}}}), headers: {"Content-Type": "application/json",
                "Accept": "application/json, text/event-stream", Authorization: `Bearer ${key}`}});
            expect(refused.status).toBe(401);
            const renewed = await connect(newKey);
            try
            {
                expect(read(await renewed.callTool({name: "look", arguments: {}})).you.name).toBe("Rekey-Agent");
            }
            finally
            {
                await renewed.close();
            }
        });

        it("refuses to play without a valid key: saying where to sign in, but never by the key's address", async () => {
            const post = (body: object, key?: string) => fetch(url, {method: "POST", body: JSON.stringify(body),
                headers: {"Content-Type": "application/json", "Accept": "application/json, text/event-stream",
                    ...(key == undefined ? {} : {Authorization: `Bearer ${key}`})}});
            const look = {jsonrpc: "2.0", id: 7, method: "tools/call", params: {name: "look", arguments: {}}};

            // A tool that needs a key: a 401 telling a host where to sign in, and anyone else what to do.
            const anonymous = await post(look);
            expect(anonymous.status).toBe(401);
            expect(anonymous.headers.get("www-authenticate")).toBe(
                `Bearer resource_metadata="${url.origin}/.well-known/oauth-protected-resource/mcp", scope="agent"`);
            expect(await anonymous.json()).toEqual({jsonrpc: "2.0", id: 7,
                error: {code: -32001, message: expect.stringContaining("call register for a key")}});

            // A key that finds no agent, whatever is asked: so that a host holding a spent token signs in again.
            const stranger = await post({jsonrpc: "2.0", id: 1, method: "tools/list", params: {}}, "nobody.nothing");
            expect(stranger.status).toBe(401);
            expect(stranger.headers.get("www-authenticate")).toContain(`error="invalid_token"`);

            // A key in the address is a host's that can't sign in: refused as a tool's answer, as before.
            const strangerByAddress = await connectTo(`${url.href}/nobody.nothing`);
            try
            {
                const refused = await strangerByAddress.callTool({name: "look", arguments: {}}) as any;
                expect(refused.isError).toBe(true);
                expect(refused.content[0].text).toContain("No valid key");
            }
            finally
            {
                await strangerByAddress.close();
            }
        });

        it("refuses input a tool doesn't take", async () => {
            const {key} = await registerAgent("Long-Talker");
            const agent = await connect(key);
            try
            {
                const tooLong = await agent.callTool({name: "say", arguments: {text: "x".repeat(200)}}) as any;
                expect(tooLong.isError).toBe(true);
            }
            finally
            {
                await agent.close();
            }
        });

        describe("signing in, for hosts that do (OAuth)", () => {
            const REDIRECT_URI = "http://127.0.0.1:54321/callback";
            let allowSignUp: ReturnType<typeof vi.spyOn>;

            beforeEach(() => {
                // Accounts are made from this test's own address, past the caps the next test sets.
                allowSignUp = vi.spyOn(GuestCreationLimitUtil, "allowGuestCreation").mockReturnValue(true);
            });

            const form = (fields: Record<string, string>, userAgent: string = "test-browser") => ({method: "POST",
                redirect: "manual" as const, body: new URLSearchParams(fields),
                headers: {"Content-Type": "application/x-www-form-urlencoded", "User-Agent": userAgent}});
            const pkce = () => {
                const verifier = crypto.randomBytes(32).toString("base64url");
                return {verifier, challenge: crypto.createHash("sha256").update(verifier).digest("base64url")};
            };
            // As an app on the user's computer registers itself (RFC 7591).
            const registerClient = async (): Promise<string> => {
                const response = await fetch(new URL("/oauth/register", url), {method: "POST",
                    headers: {"Content-Type": "application/json"}, body: JSON.stringify({client_name: "Test Host",
                        redirect_uris: ["http://127.0.0.1/callback"], token_endpoint_auth_method: "none"})});
                expect(response.status).toBe(201);
                return ((await response.json()) as any).client_id;
            };
            const authorizeParams = (clientID: string, challenge: string, overrides: Record<string, string> = {}) =>
                ({response_type: "code", client_id: clientID, redirect_uri: REDIRECT_URI, code_challenge: challenge,
                    code_challenge_method: "S256", state: "the-state", resource: `${url.origin}/mcp/oauth`,
                    scope: "agent", ...overrides});
            // The page an authorization request opens, and what it holds for its answer.
            const openConsent = async (params: Record<string, string>) => {
                const response = await fetch(new URL(`/oauth/authorize?${new URLSearchParams(params)}`, url),
                    {redirect: "manual"});
                const html = await response.text();
                return {response, html, requestID: /name="request_id" value="([0-9a-f]+)"/.exec(html)?.[1] ?? "",
                    csrfToken: /name="csrf_token" value="([0-9a-f]+)"/.exec(html)?.[1] ?? ""};
            };
            const answer = (consent: {requestID: string, csrfToken: string}, fields: Record<string, string>,
                userAgent?: string) => fetch(new URL("/oauth/authorize", url), form({request_id: consent.requestID,
                    csrf_token: consent.csrfToken, decision: "allow", ...fields}, userAgent));
            const codeOf = (response: Response) => new URL(response.headers.get("location")!).searchParams.get("code")!;
            const exchange = (clientID: string, code: string, verifier: string) => fetch(new URL("/oauth/token", url),
                form({grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, client_id: clientID,
                    code_verifier: verifier, resource: `${url.origin}/mcp/oauth`}));

            it("says where to sign in, for each endpoint, and challenges every request at the one that asks", async () => {
                const getJSON = async (pathname: string) => await (await fetch(new URL(pathname, url))).json() as any;
                expect(await getJSON("/.well-known/oauth-protected-resource/mcp")).toMatchObject(
                    {resource: `${url.origin}/mcp`, authorization_servers: [url.origin], scopes_supported: ["agent"]});
                expect(await getJSON("/.well-known/oauth-protected-resource")).toMatchObject({resource: `${url.origin}/mcp`});
                expect(await getJSON("/.well-known/oauth-protected-resource/mcp/oauth")).toMatchObject(
                    {resource: `${url.origin}/mcp/oauth`, authorization_servers: [url.origin]});
                expect(await getJSON("/.well-known/oauth-authorization-server")).toMatchObject({issuer: url.origin,
                    authorization_endpoint: `${url.origin}/oauth/authorize`, token_endpoint: `${url.origin}/oauth/token`,
                    registration_endpoint: `${url.origin}/oauth/register`, code_challenge_methods_supported: ["S256"],
                    token_endpoint_auth_methods_supported: ["none"], client_id_metadata_document_supported: true,
                    authorization_response_iss_parameter_supported: true});

                const listing = await fetch(new URL("/mcp/oauth", url), {method: "POST",
                    headers: {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
                    body: JSON.stringify({jsonrpc: "2.0", id: 1, method: "tools/list", params: {}})});
                expect(listing.status).toBe(401);
                expect(listing.headers.get("www-authenticate"))
                    .toContain(`resource_metadata="${url.origin}/.well-known/oauth-protected-resource/mcp/oauth"`);
            });

            it("connects a new agent the person names, its host given the agent's key once for a token", async () => {
                const clientID = await registerClient();
                const {verifier, challenge} = pkce();
                const consent = await openConsent(authorizeParams(clientID, challenge));
                expect(consent.response.status).toBe(200);
                expect(consent.response.headers.get("x-frame-options")).toBe("DENY");
                expect(consent.html).toContain("Test Host");
                expect(consent.html).toContain("an app on your own computer");
                // The page is the last thing the person sees before their app takes over, so it says what to ask it.
                expect(consent.html).toContain("Once you allow it, ask Test Host in a chat");

                const allowed = await answer(consent, {name: "Oauth-Bot"});
                expect(allowed.status).toBe(302);
                const back = new URL(allowed.headers.get("location")!);
                expect(`${back.origin}${back.pathname}`).toBe(REDIRECT_URI);
                expect(back.searchParams.get("state")).toBe("the-state");
                expect(back.searchParams.get("iss")).toBe(url.origin);

                const exchanged = await exchange(clientID, codeOf(allowed), verifier);
                expect(exchanged.headers.get("cache-control")).toBe("no-store");
                const token = await exchanged.json() as any;
                expect(token).toMatchObject({token_type: "Bearer", scope: "agent"});
                expect(token.refresh_token).toBeUndefined();
                expect((await exchange(clientID, codeOf(allowed), verifier)).status).toBe(400);

                const agent = new Client({name: "test-host", version: "1.0.0"});
                await agent.connect(new StreamableHTTPClientTransport(new URL("/mcp/oauth", url),
                    {requestInit: {headers: {Authorization: `Bearer ${token.access_token}`}}}));
                try
                {
                    expect(read(await agent.callTool({name: "look", arguments: {}})).you.name).toBe("Oauth-Bot");
                }
                finally
                {
                    await agent.close();
                }
            });

            it("refuses what the client didn't ask for: a redirect it never named, no PKCE, another verifier", async () => {
                const clientID = await registerClient();
                const {challenge} = pkce();

                // Nobody is sent to an address the client never named: the page says what went wrong instead.
                const elsewhere = await openConsent(authorizeParams(clientID, challenge,
                    {redirect_uri: "https://elsewhere.example/callback"}));
                expect(elsewhere.response.status).toBe(200);
                expect(elsewhere.html).toContain("never named");
                expect(elsewhere.requestID).toBe("");

                const plain = await openConsent(authorizeParams(clientID, challenge, {code_challenge_method: "plain"}));
                expect(plain.response.status).toBe(302);
                expect(new URL(plain.response.headers.get("location")!).searchParams.get("error")).toBe("invalid_request");

                const consent = await openConsent(authorizeParams(clientID, challenge));
                const allowed = await answer(consent, {name: "Pkce-Bot"});
                const wrongVerifier = await exchange(clientID, codeOf(allowed), pkce().verifier);
                expect(wrongVerifier.status).toBe(400);
                expect(((await wrongVerifier.json()) as any).error).toBe("invalid_grant");

                // A page answered once isn't answered again.
                expect(await (await answer(consent, {name: "Again-Bot"})).text()).toContain("run out");
            });

            it("connects an agent the person has by its key, refuses a key no agent has, and takes no for an answer", async () => {
                const {key} = await registerAgent("Keyed-Bot");
                const clientID = await registerClient();
                const {verifier, challenge} = pkce();

                const consent = await openConsent(authorizeParams(clientID, challenge));
                const token = await (await exchange(clientID, codeOf(await answer(consent, {key})), verifier)).json() as any;
                expect(token.access_token).toBe(key);

                const another = await openConsent(authorizeParams(clientID, pkce().challenge));
                expect(await (await answer(another, {key: "nobody.nothing"})).text()).toContain("belongs to no agent");
                const declined = await answer(another, {decision: "deny"});
                expect(declined.status).toBe(302);
                expect(new URL(declined.headers.get("location")!).searchParams.get("error")).toBe("access_denied");
            });

            it("knows a host by its metadata document, which must name itself, letting an app on the computer pick its port", async () => {
                const documentURL = "https://host.example/oauth/client.json";
                const fetchJSON = vi.spyOn(PublicFetchUtil, "fetchJSON").mockResolvedValue(
                    {client_id: documentURL, client_name: "Doc Host", redirect_uris: ["http://localhost/callback"]});
                const {challenge} = pkce();

                const consent = await openConsent(authorizeParams(documentURL, challenge,
                    {redirect_uri: "http://localhost:61234/callback"}));
                expect(consent.html).toContain("Doc Host");
                expect(consent.html).toContain("Asked by host.example");
                expect(fetchJSON).toHaveBeenCalledWith(documentURL, expect.any(Number), expect.any(Number));

                fetchJSON.mockResolvedValue({client_id: "https://another.example/client.json",
                    redirect_uris: ["http://localhost/callback"]});
                const impostor = await openConsent(authorizeParams("https://impostor.example/client.json", challenge,
                    {redirect_uri: "http://localhost:61234/callback"}));
                expect(impostor.html).toContain("be recognized");
                expect(impostor.requestID).toBe("");
            });

            it("fetches a host's document from any public address, IPv4 included, and never from a private one", async () => {
                const get = vi.spyOn(https, "get").mockImplementation(((_url: URL, _options: unknown,
                    callback: (response: PassThrough) => void) => {
                    const response = Object.assign(new PassThrough(), {statusCode: 200});
                    setImmediate(() => { callback(response); response.end(JSON.stringify({client_id: "fetched"})); });
                    return Object.assign(new EventEmitter(), {destroy: () => {}});
                }) as any);
                try
                {
                    // Addresses rather than names, so that nothing is looked up.
                    for (const publicURL of ["https://160.79.104.10/client.json", "https://[2607:6bc0::10]/client.json"])
                        expect(await PublicFetchUtil.fetchJSON(publicURL, 1024, 1000)).toEqual({client_id: "fetched"});
                    for (const privateURL of ["https://127.0.0.1/x", "https://10.0.0.8/x", "https://169.254.169.254/x",
                        "https://[::1]/x", "https://[::ffff:127.0.0.1]/x", "https://[fd00::1]/x", "http://160.79.104.10/x"])
                    {
                        expect(await PublicFetchUtil.fetchJSON(privateURL, 1024, 1000)).toBeUndefined();
                    }
                    expect(get).toHaveBeenCalledTimes(2);
                }
                finally
                {
                    get.mockRestore();
                }
            });

            it("counts a new agent against the caps of the person's own browser, where the page is answered", async () => {
                allowSignUp.mockReturnValue(false);
                const clientID = await registerClient();
                const consent = await openConsent(authorizeParams(clientID, pkce().challenge));

                const refused = await answer(consent, {name: "Capped-Bot"}, "Operator-Browser/1.0");
                expect(await refused.text()).toContain("Too many new accounts");
                expect(allowSignUp).toHaveBeenCalledWith("127.0.0.1", "Operator-Browser/1.0");
            });

            it("signs in as the official SDK's client does, from the first challenge to the agent playing", async () => {
                const stored: {client?: any, tokens?: any, verifier: string} = {verifier: ""};
                let authorizationURL: URL | undefined;
                const provider: OAuthClientProvider = {
                    get redirectUrl() { return REDIRECT_URI; },
                    get clientMetadata() { return {client_name: "SDK Host", redirect_uris: [REDIRECT_URI],
                        grant_types: ["authorization_code"], response_types: ["code"], token_endpoint_auth_method: "none"}; },
                    clientInformation: () => stored.client,
                    saveClientInformation: (information) => { stored.client = information; },
                    tokens: () => stored.tokens,
                    saveTokens: (tokens) => { stored.tokens = tokens; },
                    redirectToAuthorization: (target) => { authorizationURL = target; },
                    saveCodeVerifier: (verifier) => { stored.verifier = verifier; },
                    codeVerifier: () => stored.verifier,
                };
                const signedInURL = new URL("/mcp/oauth", url);
                const transport = new StreamableHTTPClientTransport(signedInURL, {authProvider: provider});
                await expect(new Client({name: "sdk-host", version: "1.0.0"}).connect(transport)).rejects.toThrow();
                expect(authorizationURL?.origin).toBe(url.origin);

                // The person allows it on the page the host opened for them.
                const page = await (await fetch(authorizationURL!)).text();
                const allowed = await answer({requestID: /name="request_id" value="([0-9a-f]+)"/.exec(page)![1],
                    csrfToken: /name="csrf_token" value="([0-9a-f]+)"/.exec(page)![1]}, {name: "Sdk-Bot"});
                await transport.finishAuth(new URL(allowed.headers.get("location")!).searchParams);

                const client = new Client({name: "sdk-host", version: "1.0.0"});
                await client.connect(new StreamableHTTPClientTransport(signedInURL, {authProvider: provider}));
                try
                {
                    expect(read(await client.callTool({name: "look", arguments: {}})).you.name).toBe("Sdk-Bot");
                }
                finally
                {
                    await client.close();
                }
            });
        });

        it("refuses a batch, which would carry any number of calls past the per-address limits", async () => {
            const response = await fetch(url, {method: "POST", headers: {"Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"},
                body: JSON.stringify([1, 2].map(id => ({jsonrpc: "2.0", id, method: "tools/list", params: {}})))});
            expect(response.status).toBe(400);
            const refusal = await response.json() as {error: {message: string}};
            expect(refusal.error.message).toMatch(/one JSON-RPC message per request/);
        });

        it("holds no stream open for word of changed tools, which never change while it runs", async () => {
            // Were it honored, a client with no key could hold streams like this one open by the thousand.
            const client = new Client({name: "test-agent", version: "1.0.0"},
                {versionNegotiation: {mode: {pin: "2026-07-28"}}});
            await client.connect(new StreamableHTTPClientTransport(url));
            try
            {
                expect(client.getServerCapabilities()?.tools?.listChanged).toBe(false);
                const subscription = await client.listen({toolsListChanged: true});
                expect(subscription.honoredFilter).toEqual({});
                expect(await subscription.closed).toBe("graceful");
            }
            finally
            {
                await client.close();
            }
        });

        it("knows a present agent by its key without reading its row, and brings it back by its row once gone",
            async () => {
            const {key} = await registerAgent("Known-Agent");
            const agent = await connect(key);
            const reads = vi.spyOn(DBUserUtil, "findUserById");
            try
            {
                expect(read(await agent.callTool({name: "look", arguments: {}})).you.name).toBe("Known-Agent");
                reads.mockClear();
                for (let i = 0; i < 5; ++i)
                    await agent.callTool({name: "whats_new", arguments: {}});
                expect(reads).not.toHaveBeenCalled();

                // The agent's id with another secret finds nobody, present or not.
                const forged = await fetch(url, {method: "POST", body: JSON.stringify({jsonrpc: "2.0", id: 1,
                    method: "tools/call", params: {name: "look", arguments: {}}}), headers: {
                    "Content-Type": "application/json", "Accept": "application/json, text/event-stream",
                    "Authorization": `Bearer ${key.split(".")[0]}.not-its-secret`}});
                expect(forged.status).toBe(401);
                expect(forged.headers.get("www-authenticate")).toContain(`error="invalid_token"`);

                await agent.callTool({name: "leave", arguments: {}});
                reads.mockClear();
                expect(read(await agent.callTool({name: "look", arguments: {}})).you.name).toBe("Known-Agent");
                expect(reads).toHaveBeenCalled();
            }
            finally
            {
                reads.mockRestore();
                await agent.close();
            }
        });
    });
});
