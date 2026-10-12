/**
 * Scenario tests: the room editor keeping its room (see @docs/networking/single_player_mode.md).
 * The real client (App, SocketsClient, RoomEditorUtil, VersionSyncUtil, a door) over a socket the tests play
 * the server on, which sends rooms as the server encodes them. In the editor: a room nobody asked for is turned
 * away and the server told where the user is; nothing the connection does there waits, reloads or redirects; a
 * room is asked for only over a connection; and the editor is left, for a new room or through a door, only on
 * a Yes. In a multiplayer room every one of those stays as it was.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import fs from "fs";
import path from "path";

// ─── The socket, which the tests play the server on ─────────────────────────

const fake = vi.hoisted(() => {
    const handlers: {[event: string]: ((...args: any[]) => void)[]} = {};
    const managerHandlers: {[event: string]: ((...args: any[]) => void)[]} = {};
    const state = {
        options: undefined as any, // What the client opened the socket with.
        connected: false,
        sent: [] as {event: string, bytes: Uint8Array}[], // What the client sent, in order.
    };
    const socket = {
        get connected() { return state.connected; },
        on(event: string, handler: (...args: any[]) => void)
        {
            (handlers[event] ??= []).push(handler);
            return socket;
        },
        emit(event: string, data: ArrayBuffer)
        {
            state.sent.push({event, bytes: new Uint8Array(data).slice()});
            return true;
        },
        io: {
            on(event: string, handler: (...args: any[]) => void) { (managerHandlers[event] ??= []).push(handler); },
            engine: {transport: {name: "websocket"}},
        },
    };
    return {state, socket, handlers, managerHandlers};
});

vi.mock("socket.io-client", () => ({
    io: (_url: string, options: any) => {
        fake.state.options = options;
        return fake.socket;
    },
}));

// ─── What draws and simulates a room, which is no part of this ──────────────

vi.mock("../../../src/client/graphics/graphicsManager", () => ({
    default: { load: async () => {}, unload: async () => {}, update() {}, precompileSceneShaders: async () => {} },
}));

vi.mock("../../../src/client/object/clientObjectManager", () => ({
    default: { load: async () => {}, unload: async () => {}, update() {} },
}));

vi.mock("../../../src/client/voxel/clientVoxelManager", () => ({
    default: { load: async () => {}, unload() {} },
}));

vi.mock("../../../src/client/graphics/particle/particleSystem", () => ({
    default: { load: async () => {}, unload() {}, update() {} },
}));

vi.mock("../../../src/client/graphics/light/util/roomLightingUtil", () => ({
    default: { applyRoomLighting() {}, applyIncoming: () => true },
}));

vi.mock("../../../src/client/singlePlayer/singlePlayerManager", () => ({
    default: { update() {}, finishSinglePlayerMode() {} },
}));

// Modules the app imports for what they set up on their own.
vi.mock("../../../src/client/graphics/types/gizmo/colliderDebugGizmo", () => ({}));
vi.mock("../../../src/client/graphics/types/gizmo/objectAttachmentEditGizmos", () => ({}));
vi.mock("../../../src/client/graphics/types/gizmo/volumeEditGizmos", () => ({}));
vi.mock("../../../src/client/voxel/util/restrictedZoneOutlineUtil", () => ({}));
vi.mock("../../../src/client/graphics/particle/util/particleTriggerUtil", () => ({}));
vi.mock("../../../src/client/graphics/types/gizmo/genericWorldSpaceGizmos", () => ({
    preloadGenericWorldSpaceGizmos: async () => {},
}));

import "../../../src/shared/room/roomMapDependencies";
import App from "../../../src/client/app";
import SocketsClient from "../../../src/client/networking/client/socketsClient";
import DoorGameObject from "../../../src/client/object/types/gameObject/doorGameObject";
import RoomEditorUtil from "../../../src/client/singlePlayer/util/roomEditorUtil";
import { connectionStateObservable, notificationMessageObservable,
    popupStateObservable } from "../../../src/client/system/clientObservables";
import { endClientProcess, ongoingClientProcessExists,
    tryStartClientProcess } from "../../../src/client/system/types/clientProcess";
import VersionSyncUtil from "../../../src/client/system/util/versionSyncUtil";
import PopupState from "../../../src/client/ui/types/popupState";
import PopupUtil from "../../../src/client/ui/util/popupUtil";
import SocketUserContext from "../../../src/server/sockets/types/socketUserContext";
import BufferState from "../../../src/shared/networking/types/bufferState";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import EncodableData from "../../../src/shared/networking/types/encodableData";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import RequestRoomChangeSignal from "../../../src/shared/room/types/requestRoomChangeSignal";
import Room from "../../../src/shared/room/types/room";
import RoomChangedSignal from "../../../src/shared/room/types/roomChangedSignal";
import RoomFile from "../../../src/shared/room/types/roomFile";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import RoomPrefsUtil from "../../../src/shared/room/util/roomPrefsUtil";
import SinglePlayerModeConfigMap from "../../../src/shared/singlePlayer/maps/singlePlayerModeConfigMap";
import { HEALTH_ROUTE_PATH, ROOM_EDITOR_SINGLE_PLAYER_MODE, TUTORIAL_SINGLE_PLAYER_MODE,
    UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import VoxelGrid from "../../../src/shared/voxel/types/voxelGrid";
import VoxelQuadsRuntimeMemory from "../../../src/shared/voxel/types/voxelQuadsRuntimeMemory";
import { MockSocket } from "../helpers/mockSocket";
import { createTestRoom } from "../helpers/roomContent";

const ADMIN = new User("an-admin", "Admin", UserTypeEnumMap.Admin, "admin@test.com", "");
const PAGE_BUILD = "page-build";
const ENV = {mode: "dev", serverType: "Staging", userString: ADMIN.toString(), socket_server_url: "http://socket.test",
    rest_api_server_url: "http://api.test", static_server_url: "http://static.test", assets_url: "http://assets.test",
    gitCommit: PAGE_BUILD, targetRoomID: "from-url"};
const ASSETS_ROOT_PATH = path.join(process.cwd(), "public/app/assets");

const EDITOR = ROOM_EDITOR_SINGLE_PLAYER_MODE;
const ASKED_FOR_EDITOR = {roomID: EDITOR, allowFallback: false, destinationDoorLabel: ""};
const QUESTION = "The room being edited will be lost unless it has been saved. Do you really want to proceed?";
const UNREACHABLE = "The server can't be reached right now.";

// What the client showed and did, as it went.
const connectionStates: string[] = [];
const notifications: (string | null)[] = [];
const popups: PopupState[] = [];
const fetched: string[] = [];
// The build the server says it runs.
let serverBuild = PAGE_BUILD;

/** The server's health route, and the assets a room file is fetched from. */
async function fetchStub(input: unknown): Promise<any>
{
    const url = String(input);
    fetched.push(url);
    if (url.endsWith(`/${HEALTH_ROUTE_PATH}`))
        return {ok: true, status: 200, json: async () => ({gitCommit: serverBuild})};

    const filePath = path.join(ASSETS_ROOT_PATH, new URL(url).pathname);
    if (!fs.existsSync(filePath))
        return {ok: false, status: 404};
    const bytes = fs.readFileSync(filePath);
    return {ok: true, status: 200,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)};
}

function fire(event: string, ...args: any[]): void
{
    for (const handler of fake.handlers[event] ?? [])
        handler(...args);
}

function fireOfManager(event: string): void
{
    for (const handler of fake.managerHandlers[event] ?? [])
        handler();
}

// The server's side of the socket, for the bytes it would send.
const serverSocket = new MockSocket(ADMIN);
const serverContext = new SocketUserContext(serverSocket as any);

/** Sends the client a signal as the server batches and encodes one. */
function send(signalType: string, signal: EncodableData): void
{
    serverSocket.clearEmitted();
    serverContext.addPendingSignalToUser(signalType, signal);
    serverContext.processAllPendingSignalsToUser();
    for (const {event, data} of serverSocket.emitted)
        fire(event, data);
}

/** Lets the client finish whatever it has begun. */
async function settle(): Promise<void>
{
    for (let i = 0; i < 20; ++i)
        await vi.advanceTimersByTimeAsync(1);
}

const hubRoom = () => createTestRoom("hub", "Hub", RoomTypeEnumMap.Hub);

// A single-player room as the server sends one: who it is, with nothing in it (see ServerRoomManager).
const editorRoom = () => new Room(EDITOR, EDITOR, RoomTypeEnumMap.SinglePlayer, "", "", "",
    RoomPrefsUtil.getDefaultPrefsString(), new VoxelGrid([], new VoxelQuadsRuntimeMemory()), new ObjectGroup([]));

/** Has the server send the room, and the client do what it will with it. */
async function arrive(room: Room): Promise<void>
{
    send("roomChangedSignal", new RoomChangedSignal(new RoomRuntimeMemory(room, {})));
    await settle();
}

const isIn = (roomID: string) => App.getCurrentRoom()?.id == roomID;

/** Puts the client in the hub or the editor as a room it asked for, with nothing under way; hands the room back. */
async function putIn(roomID: string): Promise<Room>
{
    if (!isIn(roomID))
    {
        tryStartClientProcess("roomChange", 1, 0); // As whoever asks for a room does.
        await arrive((roomID == EDITOR) ? editorRoom() : hubRoom());
    }
    expect(App.getCurrentRoom()?.id).toBe(roomID);
    expect(ongoingClientProcessExists()).toBe(false);
    return App.getCurrentRoom()!;
}

/** The rooms the client asked the server for, in order. */
function sentRequests(): {roomID: string, allowFallback: boolean, destinationDoorLabel: string}[]
{
    return fake.state.sent.filter(sent => sent.event == "requestRoomChangeSignal")
        .map(sent => RequestRoomChangeSignal.decode(new BufferState(sent.bytes)) as RequestRoomChangeSignal)
        .map(({roomID, allowFallback, destinationDoorLabel}) => ({roomID, allowFallback, destinationDoorLabel}));
}

/** What the client says with a connection it makes (see RoomPickerUtil). */
function getHandshake(): unknown
{
    let handshake: unknown;
    fake.state.options.auth((data: unknown) => { handshake = data; });
    return handshake;
}

/** The question the popup on top asks, if it asks one. */
function getQuestion(): string | undefined
{
    const top = popups[popups.length - 1];
    return (top?.popupType == "confirm") ? top.params.message : undefined;
}

function answer(yes: boolean): void
{
    const top = popups[popups.length - 1];
    if (top?.popupType != "confirm")
        throw new Error("No question is being asked.");
    (yes ? top.params.onConfirm : top.params.onCancel)();
}

/** A door wired to another room, as far as travelling through one goes. */
function makeDoor(): DoorGameObject
{
    const params = new AddObjectSignal("a-room", ADMIN.id, ADMIN.userName, ObjectTypeConfigMap.getIndexByType("Door"),
        "a-door", new ObjectTransform({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}));
    params.metadata[ObjectMetadataKeyEnumMap.DestinationRoomId] = new EncodableByteString("elsewhere");
    params.metadata[ObjectMetadataKeyEnumMap.DestinationDoorLabel] = new EncodableByteString("Side Door");
    return Object.assign(Object.create(DoorGameObject.prototype), {params});
}

beforeAll(async () => {
    vi.useFakeTimers({toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"]});
    vi.stubGlobal("window", {location: {href: "", reload: vi.fn()}, history: {replaceState() {}}});
    vi.stubGlobal("fetch", fetchStub);

    connectionStateObservable.addListener("test", (state: string) => { connectionStates.push(state); });
    notificationMessageObservable.addListener("test", (message: string | null) => { notifications.push(message); });
    popupStateObservable.addListener("test", (state: PopupState) => {
        if (state.popupType != "none")
            popups.push(state);
        else
            popups.pop();
    });

    // The page as it comes up: the socket connects, and the server sends the room it picked.
    App.setEnv(ENV);
    SocketsClient.init(ENV);
    fake.state.connected = true;
    fire("connect");
    await arrive(hubRoom());
    expect(isIn("hub")).toBe(true);
});

afterAll(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Past every wait between two requests, with nothing left under way or on screen from the test before.
    await vi.advanceTimersByTimeAsync(10_000);
    for (const processName of ["roomChange", "reconnect"])
    {
        while (ongoingClientProcessExists(processName))
            endClientProcess(processName);
    }
    while (popups.length > 0)
        PopupUtil.closePopup();
    fake.state.connected = true;
    fake.state.sent.length = 0;
    connectionStates.length = 0;
    notifications.length = 0;
    fetched.length = 0;
    serverBuild = PAGE_BUILD;
    window.location.href = "";
    vi.mocked(window.location.reload).mockClear();
});

describe("the room editor keeping its room", () => {
    it("turns away a room the server sends unasked, and tells it where the user still is", async () => {
        const room = await putIn(EDITOR);

        await arrive(hubRoom());

        expect(App.getCurrentRoom() === room, "the room was replaced").toBe(true);
        expect(ongoingClientProcessExists()).toBe(false);
        expect(sentRequests()).toEqual([ASKED_FOR_EDITOR]);
    });

    it("turns away its own room sent again unasked, with nothing to tell", async () => {
        const room = await putIn(EDITOR);

        await arrive(editorRoom());

        expect(App.getCurrentRoom() === room, "the room was replaced").toBe(true);
        expect(sentRequests()).toEqual([]);
        expect(fetched).toEqual([]);
    });

    it("opens the file its user asked for, in place of the room being edited", async () => {
        const room = await putIn(EDITOR);
        const tutorialFile = new Uint8Array(fs.readFileSync(path.join(ASSETS_ROOT_PATH, "rooms",
            `${SinglePlayerModeConfigMap[TUTORIAL_SINGLE_PLAYER_MODE].roomPath}${RoomFile.FILE_EXTENSION}`)));
        const numObjects = Object.keys(room.objectById).length;

        RoomEditorUtil.openRoomFile(tutorialFile, "kept.room");
        expect(sentRequests()).toEqual([ASKED_FOR_EDITOR]);
        expect(ongoingClientProcessExists("roomChange")).toBe(true);
        await arrive(editorRoom());

        expect(App.getCurrentRoom() === room, "the room was kept").toBe(false);
        expect(isIn(EDITOR)).toBe(true);
        expect(Object.keys(App.getCurrentRoom()!.objectById).length).toBeGreaterThan(numObjects);
        expect(RoomEditorUtil.getEditedFileName()).toBe("kept.room");
        expect(ongoingClientProcessExists()).toBe(false);
    });

    it("puts up no wait when the connection drops, whoever dropped it", async () => {
        await putIn(EDITOR);

        for (const reason of ["transport close", "ping timeout", "io server disconnect"])
        {
            fake.state.connected = false;
            fire("disconnect", reason);
        }

        expect(connectionStates).not.toContain("reconnecting");
        expect(ongoingClientProcessExists()).toBe(false);
    });

    it("is not reloaded once the server that ended the connection is back", async () => {
        await putIn(EDITOR);

        fake.state.connected = false;
        fire("disconnect", "io server disconnect");
        await vi.advanceTimersByTimeAsync(120_000);

        expect(fetched).toEqual([]);
        expect(window.location.reload).not.toHaveBeenCalled();
    });

    it("is not reloaded once the server it couldn't reconnect to is back", async () => {
        await putIn(EDITOR);

        fake.state.connected = false;
        fire("disconnect", "transport close");
        fireOfManager("reconnect_failed");
        await vi.advanceTimersByTimeAsync(120_000);

        expect(fetched).toEqual([]);
        expect(window.location.reload).not.toHaveBeenCalled();
    });

    it("says where its user is as the connection comes back, and waits for no room", async () => {
        const room = await putIn(EDITOR);
        fake.state.connected = false;
        fire("disconnect", "transport close");

        expect(getHandshake()).toEqual({targetRoomID: "from-url", roomEditorOpen: true});
        fake.state.connected = true;
        fire("connect");
        expect(ongoingClientProcessExists()).toBe(false);

        // What the server then sends a client it leaves in the editor (see RoomPickerUtil).
        await arrive(editorRoom());
        expect(App.getCurrentRoom() === room, "the room was replaced").toBe(true);
        expect(sentRequests()).toEqual([]);
        expect(fetched).toEqual([]);
        expect(connectionStates).not.toContain("reconnecting");
    });

    it("is neither redirected, nor reloaded for a newer build", async () => {
        await putIn(EDITOR);
        serverBuild = "newer-build";

        fire("forceRedirect", "http://static.test/error/auth-duplication");
        fire("connect_error", new Error("http://static.test/error/auth-failure"));
        await VersionSyncUtil.reloadIfOutdated(PAGE_BUILD);

        expect(window.location.href).toBe("");
        expect(window.location.reload).not.toHaveBeenCalled();
    });

    it("asks the server for nothing without a connection, and says why", async () => {
        const room = await putIn(EDITOR);
        fake.state.connected = false;

        RoomEditorUtil.openRoomFile(new Uint8Array([1, 2, 3]), "unopened.room");
        makeDoor().enter();
        answer(true);
        await settle();

        expect(notifications).toEqual([UNREACHABLE, UNREACHABLE]);
        expect(sentRequests()).toEqual([]);
        expect(ongoingClientProcessExists()).toBe(false);
        // Nor is the file left for whichever room the editor loads next.
        expect(RoomEditorUtil.takeFileToOpen(room)).toBeNull();
        expect(App.getCurrentRoom() === room, "the room was replaced").toBe(true);
    });

    it("asks before a new room takes the place of the one being edited", async () => {
        await putIn(EDITOR);

        RoomEditorUtil.openNewRoom();
        expect(getQuestion()).toBe(QUESTION);
        answer(false);
        expect(popups).toHaveLength(0);
        expect(sentRequests()).toEqual([]);

        RoomEditorUtil.openNewRoom();
        answer(true);
        expect(popups).toHaveLength(0);
        expect(sentRequests()).toEqual([ASKED_FOR_EDITOR]);
    });

    it("asks before a door takes its user out of it", async () => {
        await putIn(EDITOR);
        const door = makeDoor();

        door.enter();
        expect(getQuestion()).toBe(QUESTION);
        answer(false);
        expect(popups).toHaveLength(0);
        expect(sentRequests()).toEqual([]);

        door.enter();
        answer(true);
        expect(sentRequests()).toEqual([{roomID: "elsewhere", allowFallback: false, destinationDoorLabel: "Side Door"}]);

        // The room the door leads to is then one the user asked for.
        await arrive(hubRoom());
        expect(isIn("hub")).toBe(true);
    });
});

describe("a multiplayer room, where the connection matters as it did", () => {
    it("is left for the editor without a question, by an admin alone", async () => {
        await putIn("hub");

        App.getUser().userType = UserTypeEnumMap.Member;
        RoomEditorUtil.openNewRoom();
        App.getUser().userType = UserTypeEnumMap.Admin;
        expect(notifications).toEqual(["Only an admin can edit single-player rooms."]);
        expect(sentRequests()).toEqual([]);

        RoomEditorUtil.openNewRoom();
        expect(popups).toHaveLength(0);
        expect(sentRequests()).toEqual([ASKED_FOR_EDITOR]);
    });

    it("is left through a door without a question", async () => {
        await putIn("hub");

        makeDoor().enter();

        expect(popups).toHaveLength(0);
        expect(sentRequests()).toEqual([{roomID: "elsewhere", allowFallback: false, destinationDoorLabel: "Side Door"}]);
        expect(ongoingClientProcessExists("roomChange")).toBe(true);
    });

    it("waits out a dropped connection, and then for the room the server sends", async () => {
        const room = await putIn("hub");

        fake.state.connected = false;
        fire("disconnect", "transport close");
        expect(connectionStates).toEqual(["reconnecting"]);
        expect(ongoingClientProcessExists("reconnect")).toBe(true);

        expect(getHandshake()).toEqual({targetRoomID: "from-url", roomEditorOpen: false});
        fake.state.connected = true;
        fire("connect");
        expect(connectionStates).toEqual(["reconnecting", "connected"]);
        expect(ongoingClientProcessExists("reconnect")).toBe(false);
        expect(ongoingClientProcessExists("roomChange")).toBe(true);

        await arrive(hubRoom());
        expect(App.getCurrentRoom() === room, "the room was kept").toBe(false);
        expect(isIn("hub")).toBe(true);
        expect(ongoingClientProcessExists()).toBe(false);
    });

    it("gives way to a room the server sends unasked", async () => {
        // (A room reloaded with its users in it: see ServerRoomManager.loadRoomFile.)
        const room = await putIn("hub");

        await arrive(hubRoom());

        expect(App.getCurrentRoom() === room, "the room was kept").toBe(false);
        expect(isIn("hub")).toBe(true);
        expect(sentRequests()).toEqual([]);
    });

    it("is left for wherever the server redirects to", async () => {
        await putIn("hub");

        fire("forceRedirect", "http://static.test/error/auth-duplication");
        expect(window.location.href).toBe("http://static.test/error/auth-duplication");

        fire("connect_error", new Error("http://static.test/error/auth-failure"));
        expect(window.location.href).toBe("http://static.test/error/auth-failure");
    });

    // The last two leave the client waiting to reload for good, so nothing may come after them.

    it("is reloaded for a newer build", async () => {
        await putIn("hub");
        serverBuild = "newer-build";

        await VersionSyncUtil.reloadIfOutdated(PAGE_BUILD);

        expect(window.location.reload).toHaveBeenCalledTimes(1);
    });

    it("is reloaded once the server that ended the connection is back", async () => {
        await putIn("hub");

        fake.state.connected = false;
        fire("disconnect", "io server disconnect");
        await vi.advanceTimersByTimeAsync(3000);

        expect(fetched).toContain(`/${HEALTH_ROUTE_PATH}`);
        expect(window.location.reload).toHaveBeenCalledTimes(1);
    });
});
