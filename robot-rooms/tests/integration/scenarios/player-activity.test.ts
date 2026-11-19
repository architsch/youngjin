/**
 * Integration tests: a player showing the room what its user is busy with, by its Activity metadata (see
 * @docs/gameplay/chat.md). Covers: the user's own browser setting it as that changes (and telling the server in a
 * multiplayer room alone), who may set it and how it is tidied, relay, its never being kept past the stay, and its budget
 * in the dispatch browsers and agents share, apart from edits and speech and never counted as building.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";

vi.mock("../../../src/client/app", () => ({ default: { getCurrentRoom: vi.fn(), getWatchedUserID: vi.fn() } }));
vi.mock("../../../src/client/object/clientObjectManager", () => ({
    default: { getMyPlayer: vi.fn(), setObjectMetadata: vi.fn() },
}));
vi.mock("../../../src/client/networking/client/socketsClient", () => ({
    default: { emitSetObjectMetadataSignal: vi.fn(), isConnected: vi.fn() },
}));

import { harness, ConnectedUser } from "../helpers/serverHarness";
import { getPendingSignals } from "../helpers/invariants";
import App from "../../../src/client/app";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import SocketsClient from "../../../src/client/networking/client/socketsClient";
import { chatTypingObservable, gameModeObservable, roomChangedObservable,
    webPageOpenObservable } from "../../../src/client/system/clientObservables";
import PlayerActivityUtil from "../../../src/client/object/util/playerActivityUtil";
import UserSignalDispatchUtil from "../../../src/server/user/util/userSignalDispatchUtil";
import UserBudgetUtil from "../../../src/server/user/util/userBudgetUtil";
import ServerAnalyticsManager from "../../../src/server/analytics/serverAnalyticsManager";
import { FunnelMilestoneEnumMap } from "../../../src/server/analytics/types/funnelMilestone";
import { USER_BUDGETS } from "../../../src/server/system/serverConstants";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { SpeakerActivityEnumMap } from "../../../src/shared/object/types/speakerActivity";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import { UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

const HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const ACTIVITY = ObjectMetadataKeyEnumMap.Activity;
const {None, Typing, Editing, Reading} = SpeakerActivityEnumMap;

async function joinHuman(userName: string): Promise<ConnectedUser>
{
    const human = harness.connectUser({id: `id-${userName}`, userName});
    await harness.joinRoom(human, HUB_ID);
    return human;
}

// The signal a browser sends as what its user is busy with changes, through the dispatch, onto a player (the sender's own
// by default).
async function sendActivity(user: ConnectedUser, value: string, onPlayerOf: ConnectedUser = user): Promise<boolean>
{
    const bufferState = EncodingUtil.startEncoding();
    new SetObjectMetadataSignal(HUB_ID, harness.getPlayerObjectId(onPlayerOf)!, ACTIVITY, value).encode(bufferState);
    return await UserSignalDispatchUtil.dispatch(user.socketUserContext, "setObjectMetadataSignal",
        EncodingUtil.endEncoding(bufferState));
}

function activityOf(user: ConnectedUser): string | undefined
{
    return harness.getPlayerObject(user.user.id)?.metadata[ACTIVITY]?.str;
}

// The values the room has been sent for a user's player, in order.
function activitySentTo(watcher: ConnectedUser, about: ConnectedUser): string[]
{
    const objectId = harness.getPlayerObjectId(about);
    return getPendingSignals(watcher, "setObjectMetadataSignal")
        .filter((signal: SetObjectMetadataSignal) => signal.objectId == objectId && signal.metadataKey == ACTIVITY)
        .map((signal: SetObjectMetadataSignal) => signal.metadataValue);
}

describe("a player shown busy", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        // Only the clock: promises and the harness's own timers run as usual.
        vi.useFakeTimers({toFake: ["Date"]});
        harness.reset();
        harness.seedHub(HUB_ID);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ─── Who sets it ───────────────────────────────────────────────────

    it("is set by a user on their own player and passed on to the rest of the room", async () => {
        const editor = await joinHuman("Editor");
        const watcher = await joinHuman("Watcher");

        expect(await sendActivity(editor, Editing)).toBe(true);
        expect(activityOf(editor)).toBe(Editing);
        expect(await sendActivity(editor, Reading)).toBe(true);
        expect(activityOf(editor)).toBe(Reading);
        expect(await sendActivity(editor, None)).toBe(true);
        expect(activityOf(editor)).toBe(None);

        expect(activitySentTo(watcher, editor)).toEqual([Editing, Reading, None]);
        // The sender's browser has it already.
        expect(activitySentTo(editor, editor)).toEqual([]);
    });

    it("is stored tidied, whatever is sent", async () => {
        const editor = await joinHuman("Editor");

        for (const [sent, stored] of [[` ${Typing} `, Typing], ["yes", None], [Editing + Editing, None], ["1", None],
            [Reading, Reading], ["true", None], [Editing, Editing], ["0", None]])
        {
            await sendActivity(editor, sent);
            expect(activityOf(editor), `sent "${sent}"`).toBe(stored);
        }
    });

    it("can't be set on someone else's player, whose sender is put right", async () => {
        const editor = await joinHuman("Editor");
        const other = await joinHuman("Other");

        await sendActivity(other, Reading, editor);
        expect(activityOf(editor)).toBeUndefined();
        expect(activitySentTo(other, editor)).toEqual([None]);
    });

    // ─── Never kept ────────────────────────────────────────────────────

    it("isn't saved with the user's player metadata on leaving, unlike what they said", async () => {
        const editor = await joinHuman("Editor");
        harness.sendObjectMessage(editor, "brb");
        await sendActivity(editor, Reading);

        await harness.disconnectUser(editor, true);
        const stored = harness.getStoredPlayerMetadata(editor.user.id);
        expect(stored?.[String(ObjectMetadataKeyEnumMap.SentMessage)]).toBe("brb");
        expect(stored?.[String(ACTIVITY)]).toBeUndefined();
    });

    it("doesn't come back with a player that reconnects, whose browser tells it anew", async () => {
        const editor = await joinHuman("Editor");
        harness.sendObjectMessage(editor, "brb");
        await sendActivity(editor, Editing);

        const reconnected = await harness.reconnectCaseA(editor);
        await harness.joinRoom(reconnected, HUB_ID);
        const player = harness.getPlayerObject(reconnected.user.id);
        expect(player?.metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str).toBe("brb");
        expect(player?.metadata[ACTIVITY]).toBeUndefined();
    });

    // ─── Budget ────────────────────────────────────────────────────────

    it("is paid for from a budget of its own, past which a change is dropped unheard, and is never an edit",
        async () => {
        const editor = await joinHuman("Editor");
        const watcher = await joinHuman("Watcher");
        const milestones = vi.spyOn(ServerAnalyticsManager, "recordMilestone");
        const {capacity, refillPerSecond} = USER_BUDGETS.activityChanges;

        for (let i = 0; i < capacity; ++i)
            expect(await sendActivity(editor, (i % 2 == 0) ? Typing : None), `change ${i}`).toBe(true);
        expect(await sendActivity(editor, Typing)).toBe(false);
        expect(activityOf(editor)).toBe(None);
        expect(activitySentTo(watcher, editor)).toHaveLength(capacity);

        expect(UserBudgetUtil.getLevel(editor.user.id, "edit")).toBe(USER_BUDGETS.edit.capacity);
        expect(UserBudgetUtil.getLevel(editor.user.id, "speech")).toBe(USER_BUDGETS.speech.capacity);
        expect(milestones.mock.calls.some(call => call[1] == FunnelMilestoneEnumMap.Built)).toBe(false);

        vi.setSystemTime(Date.now() + 1000 / refillPerSecond);
        expect(await sendActivity(editor, Typing)).toBe(true);
        expect(activityOf(editor)).toBe(Typing);
    });

    // ─── The user's own browser ────────────────────────────────────────

    describe("in the user's browser (see PlayerActivityUtil)", () => {
        const page = {visibilityState: "visible", visibilityListeners: [] as (() => void)[],
            addEventListener: (_type: string, listener: () => void) => { page.visibilityListeners.push(listener); }};
        let player: {params: AddObjectSignal};

        function enterRoom(roomType: number): void
        {
            vi.mocked(App.getCurrentRoom).mockReturnValue({id: HUB_ID, roomType} as Room);
            player = {params: new AddObjectSignal(HUB_ID, "id-Me", "Me", ObjectTypeConfigMap.getIndexByType("Player"),
                "player-1", new ObjectTransform({x: 8, y: 1.25, z: 8}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}), {})};
        }

        function setPageHidden(hidden: boolean): void
        {
            page.visibilityState = hidden ? "hidden" : "visible";
            page.visibilityListeners.forEach(listener => listener());
        }

        function told(): string[]
        {
            return vi.mocked(SocketsClient.emitSetObjectMetadataSignal).mock.calls.map(([signal]) => signal.metadataValue);
        }

        // Installed once and for all, as a page does.
        beforeAll(() => {
            vi.stubGlobal("document", page);
            vi.mocked(App.getWatchedUserID).mockReturnValue("");
            PlayerActivityUtil.install();
        });

        afterAll(() => {
            vi.unstubAllGlobals();
        });

        beforeEach(() => {
            page.visibilityState = "visible";
            gameModeObservable.set("play");
            chatTypingObservable.set(false);
            webPageOpenObservable.set(false);
            vi.mocked(ClientObjectManager.getMyPlayer).mockImplementation(() => player as any);
            vi.mocked(ClientObjectManager.setObjectMetadata).mockImplementation((objectId, key, value) => {
                player.params.metadata[key] = new EncodableByteString(value);
                return true;
            });
            vi.mocked(ClientObjectManager.setObjectMetadata).mockClear();
            vi.mocked(SocketsClient.emitSetObjectMetadataSignal).mockClear();
            vi.mocked(SocketsClient.isConnected).mockReturnValue(true);
        });

        it("sets it on the user's player as edit mode starts and clears it as the mode ends, telling the server",
            () => {
            enterRoom(RoomTypeEnumMap.Hub);

            gameModeObservable.set("edit");
            expect(player.params.metadata[ACTIVITY]?.str).toBe(Editing);
            gameModeObservable.set("play");
            expect(player.params.metadata[ACTIVITY]?.str).toBe(None);

            expect(vi.mocked(SocketsClient.emitSetObjectMetadataSignal).mock.calls.map(([signal]) =>
                [signal.roomID, signal.objectId, signal.metadataKey, signal.metadataValue])).toEqual([
                [HUB_ID, "player-1", ACTIVITY, Editing],
                [HUB_ID, "player-1", ACTIVITY, None],
            ]);
        });

        it("shows the user typing a line for as long as the chat says they are", () => {
            enterRoom(RoomTypeEnumMap.Hub);

            chatTypingObservable.set(true);
            expect(player.params.metadata[ACTIVITY]?.str).toBe(Typing);
            chatTypingObservable.set(false);
            expect(player.params.metadata[ACTIVITY]?.str).toBe(None);
            expect(told()).toEqual([Typing, None]);
        });

        it("shows the user reading while a page of the website is over the game", () => {
            enterRoom(RoomTypeEnumMap.Hub);

            webPageOpenObservable.set(true);
            expect(player.params.metadata[ACTIVITY]?.str).toBe(Reading);
            webPageOpenObservable.set(false);
            expect(player.params.metadata[ACTIVITY]?.str).toBe(None);
            expect(told()).toEqual([Reading, None]);
        });

        it("shows the user reading while the page is hidden, as behind another tab", () => {
            enterRoom(RoomTypeEnumMap.Hub);

            setPageHidden(true);
            expect(player.params.metadata[ACTIVITY]?.str).toBe(Reading);
            setPageHidden(false);
            expect(player.params.metadata[ACTIVITY]?.str).toBe(None);
            expect(told()).toEqual([Reading, None]);
        });

        it("shows one thing at a time, and goes back to what is left as each ends", () => {
            enterRoom(RoomTypeEnumMap.Hub);

            chatTypingObservable.set(true);
            webPageOpenObservable.set(true);
            setPageHidden(true);
            webPageOpenObservable.set(false);
            setPageHidden(false);
            gameModeObservable.set("edit");
            setPageHidden(true);
            setPageHidden(false);
            gameModeObservable.set("play");
            chatTypingObservable.set(false);

            expect(told()).toEqual([Typing, Reading, Typing, Editing, Reading, Editing, Typing, None]);
        });

        it("tells nothing when nothing has changed, as on a room arrival", () => {
            enterRoom(RoomTypeEnumMap.Hub);

            gameModeObservable.set("play");
            chatTypingObservable.set(false);
            setPageHidden(false);
            expect(ClientObjectManager.setObjectMetadata).not.toHaveBeenCalled();
            expect(SocketsClient.emitSetObjectMetadataSignal).not.toHaveBeenCalled();
        });

        it("tells no server in a single-player room, though the user's player still shows it", () => {
            enterRoom(RoomTypeEnumMap.SinglePlayer);

            gameModeObservable.set("edit");
            expect(player.params.metadata[ACTIVITY]?.str).toBe(Editing);
            expect(SocketsClient.emitSetObjectMetadataSignal).not.toHaveBeenCalled();
        });

        it("sends nothing without a connection, which would go out on connecting about a player gone by then", () => {
            enterRoom(RoomTypeEnumMap.Hub);
            vi.mocked(SocketsClient.isConnected).mockReturnValue(false);

            setPageHidden(true);
            setPageHidden(false);
            expect(SocketsClient.emitSetObjectMetadataSignal).not.toHaveBeenCalled();
        });

        it("tells it again of the player each room arrival brings, which comes busy with nothing", async () => {
            enterRoom(RoomTypeEnumMap.Hub);
            chatTypingObservable.set(true);
            vi.mocked(SocketsClient.emitSetObjectMetadataSignal).mockClear();

            enterRoom(RoomTypeEnumMap.Hub);
            roomChangedObservable.set({} as RoomRuntimeMemory);
            await vi.waitFor(() => expect(told()).toEqual([Typing]));
            expect(player.params.metadata[ACTIVITY]?.str).toBe(Typing);
        });

        it("leaves a camera page alone, which has no player of its own", () => {
            vi.mocked(App.getWatchedUserID).mockReturnValue("an-agent");
            const numListeners = page.visibilityListeners.length;

            PlayerActivityUtil.install();
            expect(page.visibilityListeners).toHaveLength(numListeners);
        });
    });
});
