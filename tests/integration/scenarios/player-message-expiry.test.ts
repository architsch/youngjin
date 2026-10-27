/**
 * Integration tests: a player's message clearing itself once it has been up for PLAYER_MESSAGE_EXPIRATION_MS (see
 * PlayerMessageExpiryUtil), through the dispatch browsers and agents share: cleared for the rest of the room at its time
 * and not before, its time started again by a newer line and by an arrival still saying it, nothing left to clear once
 * cleared by hand, a refused line leaving the last one's time as it was, and the clearing itself no line.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { getPendingSignals } from "../helpers/invariants";
import UserSignalDispatchUtil from "../../../src/server/user/util/userSignalDispatchUtil";
import UserBudgetUtil from "../../../src/server/user/util/userBudgetUtil";
import PlayerMessageExpiryUtil from "../../../src/server/user/util/playerMessageExpiryUtil";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerAnalyticsManager from "../../../src/server/analytics/serverAnalyticsManager";
import HelperAgentUtil from "../../../src/server/agent/util/helperAgentUtil";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import RequestRoomChangeSignal from "../../../src/shared/room/types/requestRoomChangeSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { OBJECT_MESSAGE_MAX_LENGTH, PLAYER_MESSAGE_EXPIRATION_MS } from "../../../src/shared/system/sharedConstants";

const HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const OTHER_HUB_ID = "hubBBBBBBBBBBBBBBBBB";
const SENT_MESSAGE = ObjectMetadataKeyEnumMap.SentMessage;

async function joinHuman(userName: string, playerMetadata: {[key: string]: string} = {}): Promise<ConnectedUser>
{
    const human = harness.connectUser({id: `id-${userName}`, userName, playerMetadata});
    await harness.joinRoom(human, HUB_ID);
    return human;
}

// A line as a browser sends it, through the dispatch ("" clears the bubble).
async function say(user: ConnectedUser, text: string): Promise<boolean>
{
    const bufferState = EncodingUtil.startEncoding();
    new SetObjectMetadataSignal(ServerRoomManager.currentRoomIDByUserID[user.user.id], harness.getPlayerObjectId(user)!,
        SENT_MESSAGE, text).encode(bufferState);
    return await UserSignalDispatchUtil.dispatch(user.socketUserContext, "setObjectMetadataSignal",
        EncodingUtil.endEncoding(bufferState));
}

function messageOf(user: ConnectedUser): string | undefined
{
    return harness.getPlayerObject(user.user.id)?.metadata[SENT_MESSAGE]?.str;
}

// What a browser has been sent of a player's message, in order.
function messagesSentTo(watcher: ConnectedUser, playerObjectId: string): string[]
{
    return getPendingSignals(watcher, "setObjectMetadataSignal")
        .filter((signal: SetObjectMetadataSignal) => signal.objectId == playerObjectId && signal.metadataKey == SENT_MESSAGE)
        .map((signal: SetObjectMetadataSignal) => signal.metadataValue);
}

// The clock moved on, then a flush, as SocketsServer's interval makes them.
function wait(ms: number): void
{
    vi.setSystemTime(Date.now() + ms);
    PlayerMessageExpiryUtil.expireAll();
}

describe("a player's message clearing itself", () => {
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

    it("is cleared for the rest of the room once its time is up, and not before", async () => {
        const speaker = await joinHuman("Speaker");
        const watcher = await joinHuman("Watcher");
        const speakerPlayerId = harness.getPlayerObjectId(speaker)!;
        expect(await say(speaker, "hello")).toBe(true);

        wait(PLAYER_MESSAGE_EXPIRATION_MS - 1);
        expect(messageOf(speaker)).toBe("hello");
        wait(1);
        expect(messageOf(speaker)).toBe("");

        expect(messagesSentTo(watcher, speakerPlayerId)).toEqual(["hello", ""]);
        // The speaker's browser clears it for itself (see Chat), so that a line said just then is never cleared with it.
        expect(messagesSentTo(speaker, speakerPlayerId)).toEqual([]);
    });

    it("starts its time again with each new line, the same words said again included", async () => {
        const speaker = await joinHuman("Speaker");
        await say(speaker, "one");
        wait(PLAYER_MESSAGE_EXPIRATION_MS / 2);
        await say(speaker, "two");
        wait(PLAYER_MESSAGE_EXPIRATION_MS / 2);
        expect(messageOf(speaker)).toBe("two");

        await say(speaker, "two");
        wait(PLAYER_MESSAGE_EXPIRATION_MS - 1);
        expect(messageOf(speaker)).toBe("two");
        wait(1);
        expect(messageOf(speaker)).toBe("");
    });

    it("leaves nothing to clear once cleared by hand, and a refused line leaves the last one's time as it was",
        async () => {
        const speaker = await joinHuman("Speaker");
        const watcher = await joinHuman("Watcher");
        const speakerPlayerId = harness.getPlayerObjectId(speaker)!;
        await say(speaker, "x");
        await say(speaker, "");
        wait(PLAYER_MESSAGE_EXPIRATION_MS);
        expect(messagesSentTo(watcher, speakerPlayerId)).toEqual(["x", ""]);

        await say(speaker, "ok");
        wait(PLAYER_MESSAGE_EXPIRATION_MS / 2);
        await say(speaker, "y".repeat(OBJECT_MESSAGE_MAX_LENGTH + 1));
        expect(messageOf(speaker)).toBe("ok");
        wait(PLAYER_MESSAGE_EXPIRATION_MS / 2);
        expect(messageOf(speaker)).toBe("");
    });

    it("is up for its full time again as its player arrives still saying it, from another room or an earlier visit",
        async () => {
        harness.seedHub(OTHER_HUB_ID);
        const traveller = await joinHuman("Traveller");
        await say(traveller, "on my way");
        wait(PLAYER_MESSAGE_EXPIRATION_MS / 2);
        await ServerRoomManager.onRequestRoomChangeSignalReceived(traveller.socketUserContext,
            new RequestRoomChangeSignal(OTHER_HUB_ID, false));
        expect(ServerRoomManager.currentRoomIDByUserID[traveller.user.id]).toBe(OTHER_HUB_ID);
        expect(messageOf(traveller)).toBe("on my way");
        wait(PLAYER_MESSAGE_EXPIRATION_MS - 1);
        expect(messageOf(traveller)).toBe("on my way");
        wait(1);
        expect(messageOf(traveller)).toBe("");

        const returning = await joinHuman("Returning", {[String(SENT_MESSAGE)]: "brb"});
        wait(PLAYER_MESSAGE_EXPIRATION_MS - 1);
        expect(messageOf(returning)).toBe("brb");
        wait(1);
        expect(messageOf(returning)).toBe("");
    });

    it("is cleared as no line: no speech spent, no milestone, nothing for a helper to hear", async () => {
        const speaker = await joinHuman("Speaker");
        await say(speaker, "hello");
        const milestones = vi.spyOn(ServerAnalyticsManager, "recordMilestone");
        const heard = vi.spyOn(HelperAgentUtil, "hear");
        vi.setSystemTime(Date.now() + PLAYER_MESSAGE_EXPIRATION_MS);
        const speech = UserBudgetUtil.getLevel(speaker.user.id, "speech");

        PlayerMessageExpiryUtil.expireAll();

        expect(messageOf(speaker)).toBe("");
        expect(UserBudgetUtil.getLevel(speaker.user.id, "speech")).toBe(speech);
        expect(milestones).not.toHaveBeenCalled();
        expect(heard).not.toHaveBeenCalled();
    });

    it("clears nothing for a player who has left, and forgets it", async () => {
        const speaker = await joinHuman("Speaker");
        const watcher = await joinHuman("Watcher");
        const speakerPlayerId = harness.getPlayerObjectId(speaker)!;
        await say(speaker, "bye");
        await harness.disconnectUser(speaker);

        wait(PLAYER_MESSAGE_EXPIRATION_MS);
        expect(messagesSentTo(watcher, speakerPlayerId)).toEqual(["bye"]);
        expect(PlayerMessageExpiryUtil.expiresAtByUserID.size).toBe(0);
    });
});
