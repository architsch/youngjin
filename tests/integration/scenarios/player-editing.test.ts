/**
 * Integration tests: a player showing the room that its user is in edit mode, by its Editing metadata (see
 * @docs/gameplay/game_mode.md). Covers: the user's own browser setting it as the mode changes (and telling the server
 * in a multiplayer room alone), who may set it and how it is tidied, relay, its never being kept past the stay, and its
 * budget in the dispatch browsers and agents share, apart from edits and speech and never counted as building.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../../../src/client/app", () => ({ default: { getCurrentRoom: vi.fn() } }));
vi.mock("../../../src/client/object/clientObjectManager", () => ({
    default: { getMyPlayer: vi.fn(), setObjectMetadata: vi.fn() },
}));
vi.mock("../../../src/client/networking/client/socketsClient", () => ({
    default: { emitSetObjectMetadataSignal: vi.fn() },
}));

import { harness, ConnectedUser } from "../helpers/serverHarness";
import { getPendingSignals } from "../helpers/invariants";
import App from "../../../src/client/app";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import SocketsClient from "../../../src/client/networking/client/socketsClient";
import { gameModeObservable } from "../../../src/client/system/clientObservables";
import "../../../src/client/object/util/playerEditingUtil";
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
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import Room from "../../../src/shared/room/types/room";
import { UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";

const HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const EDITING = ObjectMetadataKeyEnumMap.Editing;

async function joinHuman(userName: string): Promise<ConnectedUser>
{
    const human = harness.connectUser({id: `id-${userName}`, userName});
    await harness.joinRoom(human, HUB_ID);
    return human;
}

// The signal a browser sends as its user's mode changes, through the dispatch, onto a player (the sender's own by
// default).
async function sendEditing(user: ConnectedUser, value: string, onPlayerOf: ConnectedUser = user): Promise<boolean>
{
    const bufferState = EncodingUtil.startEncoding();
    new SetObjectMetadataSignal(HUB_ID, harness.getPlayerObjectId(onPlayerOf)!, EDITING, value).encode(bufferState);
    return await UserSignalDispatchUtil.dispatch(user.socketUserContext, "setObjectMetadataSignal",
        EncodingUtil.endEncoding(bufferState));
}

function editingOf(user: ConnectedUser): string | undefined
{
    return harness.getPlayerObject(user.user.id)?.metadata[EDITING]?.str;
}

// The values the room has been sent for a user's player, in order.
function editingSentTo(watcher: ConnectedUser, about: ConnectedUser): string[]
{
    const objectId = harness.getPlayerObjectId(about);
    return getPendingSignals(watcher, "setObjectMetadataSignal")
        .filter((signal: SetObjectMetadataSignal) => signal.objectId == objectId && signal.metadataKey == EDITING)
        .map((signal: SetObjectMetadataSignal) => signal.metadataValue);
}

describe("a player shown editing", () => {
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

        expect(await sendEditing(editor, "1")).toBe(true);
        expect(editingOf(editor)).toBe("1");
        expect(await sendEditing(editor, "")).toBe(true);
        expect(editingOf(editor)).toBe("");

        expect(editingSentTo(watcher, editor)).toEqual(["1", ""]);
        // The sender's browser has it already.
        expect(editingSentTo(editor, editor)).toEqual([]);
    });

    it("is stored tidied, whatever is sent", async () => {
        const editor = await joinHuman("Editor");

        for (const [sent, stored] of [[" 1 ", "1"], ["yes", ""], ["11", ""], ["true", ""], ["1", "1"], ["0", ""]])
        {
            await sendEditing(editor, sent);
            expect(editingOf(editor), `sent "${sent}"`).toBe(stored);
        }
    });

    it("can't be set on someone else's player, whose sender is put right", async () => {
        const editor = await joinHuman("Editor");
        const other = await joinHuman("Other");

        await sendEditing(other, "1", editor);
        expect(editingOf(editor)).toBeUndefined();
        expect(editingSentTo(other, editor)).toEqual([""]);
    });

    // ─── Never kept ────────────────────────────────────────────────────

    it("isn't saved with the user's player metadata on leaving, unlike what they said", async () => {
        const editor = await joinHuman("Editor");
        harness.sendObjectMessage(editor, "brb");
        await sendEditing(editor, "1");

        await harness.disconnectUser(editor, true);
        const stored = harness.getStoredPlayerMetadata(editor.user.id);
        expect(stored?.[String(ObjectMetadataKeyEnumMap.SentMessage)]).toBe("brb");
        expect(stored?.[String(EDITING)]).toBeUndefined();
    });

    it("doesn't come back with a player that reconnects, which arrives in play mode", async () => {
        const editor = await joinHuman("Editor");
        harness.sendObjectMessage(editor, "brb");
        await sendEditing(editor, "1");

        const reconnected = await harness.reconnectCaseA(editor);
        await harness.joinRoom(reconnected, HUB_ID);
        const player = harness.getPlayerObject(reconnected.user.id);
        expect(player?.metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str).toBe("brb");
        expect(player?.metadata[EDITING]).toBeUndefined();
    });

    // ─── Budget ────────────────────────────────────────────────────────

    it("is paid for from a budget of its own, past which a switch is dropped unheard, and is never an edit",
        async () => {
        const editor = await joinHuman("Editor");
        const watcher = await joinHuman("Watcher");
        const milestones = vi.spyOn(ServerAnalyticsManager, "recordMilestone");
        const {capacity, refillPerSecond} = USER_BUDGETS.modeSwitches;

        for (let i = 0; i < capacity; ++i)
            expect(await sendEditing(editor, (i % 2 == 0) ? "1" : ""), `switch ${i}`).toBe(true);
        expect(await sendEditing(editor, "1")).toBe(false);
        expect(editingOf(editor)).toBe("");
        expect(editingSentTo(watcher, editor)).toHaveLength(capacity);

        expect(UserBudgetUtil.getLevel(editor.user.id, "edit")).toBe(USER_BUDGETS.edit.capacity);
        expect(UserBudgetUtil.getLevel(editor.user.id, "speech")).toBe(USER_BUDGETS.speech.capacity);
        expect(milestones.mock.calls.some(call => call[1] == FunnelMilestoneEnumMap.Built)).toBe(false);

        vi.setSystemTime(Date.now() + 1000 / refillPerSecond);
        expect(await sendEditing(editor, "1")).toBe(true);
        expect(editingOf(editor)).toBe("1");
    });

    // ─── The user's own browser ────────────────────────────────────────

    describe("in the user's browser (see PlayerEditingUtil)", () => {
        let player: {params: AddObjectSignal};

        function enterRoom(roomType: number): void
        {
            vi.mocked(App.getCurrentRoom).mockReturnValue({id: HUB_ID, roomType} as Room);
            player = {params: new AddObjectSignal(HUB_ID, "id-Me", "Me", ObjectTypeConfigMap.getIndexByType("Player"),
                "player-1", new ObjectTransform({x: 8, y: 1.25, z: 8}, {x: 0, y: 0, z: 1}, {...UNIT_VEC3}), {})};
        }

        beforeEach(() => {
            gameModeObservable.set("play");
            vi.mocked(ClientObjectManager.getMyPlayer).mockImplementation(() => player as any);
            vi.mocked(ClientObjectManager.setObjectMetadata).mockImplementation((objectId, key, value) => {
                player.params.metadata[key] = new EncodableByteString(value);
                return true;
            });
            vi.mocked(ClientObjectManager.setObjectMetadata).mockClear();
            vi.mocked(SocketsClient.emitSetObjectMetadataSignal).mockClear();
        });

        it("sets it on the user's player as edit mode starts and clears it as the mode ends, telling the server",
            () => {
            enterRoom(RoomTypeEnumMap.Hub);

            gameModeObservable.set("edit");
            expect(player.params.metadata[EDITING]?.str).toBe("1");
            gameModeObservable.set("play");
            expect(player.params.metadata[EDITING]?.str).toBe("");

            expect(vi.mocked(SocketsClient.emitSetObjectMetadataSignal).mock.calls.map(([signal]) =>
                [signal.roomID, signal.objectId, signal.metadataKey, signal.metadataValue])).toEqual([
                [HUB_ID, "player-1", EDITING, "1"],
                [HUB_ID, "player-1", EDITING, ""],
            ]);
        });

        it("tells nothing when the mode is set as it already was, as on a room arrival", () => {
            enterRoom(RoomTypeEnumMap.Hub);

            gameModeObservable.set("play");
            expect(ClientObjectManager.setObjectMetadata).not.toHaveBeenCalled();
            expect(SocketsClient.emitSetObjectMetadataSignal).not.toHaveBeenCalled();
        });

        it("tells no server in a single-player room, though the user's player still shows it", () => {
            enterRoom(RoomTypeEnumMap.SinglePlayer);

            gameModeObservable.set("edit");
            expect(player.params.metadata[EDITING]?.str).toBe("1");
            expect(SocketsClient.emitSetObjectMetadataSignal).not.toHaveBeenCalled();
        });
    });
});
