/**
 * Scenario tests: Room population
 *
 * Covers:
 * - A room turning users away once its population reaches the admission cap
 * - A refused room change leaving the user where they were, and reaching the client as a signal
 * - Falling back to an available hub when the destination is full
 * - Hub picking across the under- / medium- / over-populated bands
 * - Opening a new hub (exactly one) when every existing hub is over-populated
 * - Every route a user takes into a room: app start-up (single-player mode / URL target / last
 *   room / first visit), leaving single-player mode, a page refresh, and a server restart
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { harness } from "../helpers/serverHarness";
import { getPendingSignals } from "../helpers/invariants";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import RoomPickerUtil from "../../../src/server/room/util/roomPickerUtil";
import DBRoomUtil from "../../../src/server/db/util/dbRoomUtil";
import RequestRoomChangeSignal from "../../../src/shared/room/types/requestRoomChangeSignal";
import { RoomChangeRejectionReasonEnumMap } from "../../../src/shared/room/types/roomChangeRejectionReason";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import {
    MAX_PLAYERS_PER_ROOM,
    ROOM_ALMOST_FULL_MARGIN,
    ROOM_OVER_POPULATION_THRESHOLD,
    ROOM_UNDER_POPULATION_THRESHOLD,
} from "../../../src/shared/system/sharedConstants";

/**
 * The population at which a room stops admitting anyone new. It sits below the hard cap by the
 * reserve margin, so that joins already in flight cannot push the room past the hard cap.
 */
const ADMISSION_CAP = MAX_PLAYERS_PER_ROOM - ROOM_ALMOST_FULL_MARGIN;

/**
 * Seeds the given hubs and preloads them the way HubRoomUtil does at server start-up
 * (the room picker only ever looks at hubs that are resident in memory), then gives each
 * one the requested population.
 */
async function setUpHubs(populationByHubID: {[hubID: string]: number}): Promise<void>
{
    for (const hubID of Object.keys(populationByHubID))
    {
        harness.seedRoom(hubID, RoomTypeEnumMap.Hub);
        await harness.loadRoom(hubID);
        harness.setSyntheticRoomPopulation(hubID, populationByHubID[hubID]);
    }
}

/** Seeds, preloads, and fills a non-hub room to the given population. */
async function setUpRoom(roomID: string, population: number): Promise<void>
{
    harness.seedRoom(roomID, RoomTypeEnumMap.Regular);
    await harness.loadRoom(roomID);
    harness.setSyntheticRoomPopulation(roomID, population);
}

function loadedHubIDs(): string[]
{
    return Object.entries(ServerRoomManager.roomRuntimeMemories)
        .filter(([, mem]) => mem.room.roomType === RoomTypeEnumMap.Hub)
        .map(([roomID]) => roomID);
}

describe("room population scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        harness.reset();
    });

    // ─── Per-room player cap ────────────────────────────────────────────────

    it("a room fills up to its admission cap and turns further users away", async () => {
        harness.seedRoom("capped", RoomTypeEnumMap.Regular);
        await harness.fillRoomWithUsers("capped", ADMISSION_CAP);
        expect(harness.getRoomParticipantCount("capped")).toBe(ADMISSION_CAP);

        const latecomer = harness.connectUser();
        const result = await harness.joinRoom(latecomer, "capped");

        expect(result).toEqual({type: "rejected", reason: RoomChangeRejectionReasonEnumMap.RoomIsAlmostFull});
        expect(harness.getRoomParticipantCount("capped")).toBe(ADMISSION_CAP);
        expect(ServerRoomManager.currentRoomIDByUserID[latecomer.user.id]).toBeUndefined();
    });

    it("a room change refused for capacity leaves the user in the room they were already in", async () => {
        harness.seedRoom("home", RoomTypeEnumMap.Regular);
        await setUpRoom("packed", MAX_PLAYERS_PER_ROOM);

        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, "home");
        const result = await harness.joinRoom(ctx, "packed");

        expect(result).toEqual({type: "rejected", reason: RoomChangeRejectionReasonEnumMap.RoomIsAlmostFull});
        expect(ServerRoomManager.currentRoomIDByUserID[ctx.user.id]).toBe("home");
        expect(harness.getRoomParticipantCount("home")).toBe(1);
    });

    it("a user re-entering the room they already occupy is not blocked by their own slot", async () => {
        await setUpRoom("packed", ADMISSION_CAP - 1);

        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, "packed"); // the room now sits at the admission cap, with this user inside
        expect(harness.getRoomParticipantCount("packed")).toBe(ADMISSION_CAP);

        const result = await harness.joinRoom(ctx, "packed");

        expect(result).toEqual({type: "success", newRoomID: "packed"});
        expect(harness.getRoomParticipantCount("packed")).toBe(ADMISSION_CAP);
    });

    it("a full destination re-routes the user to an available hub when fallback is allowed", async () => {
        await setUpHubs({"hub-a": 3});
        await setUpRoom("packed", MAX_PLAYERS_PER_ROOM);

        const ctx = harness.connectUser();
        const result = await harness.joinRoom(ctx, "packed", /*allowFallback*/ true);

        expect(result).toEqual({type: "success", newRoomID: "hub-a"});
        expect(ServerRoomManager.currentRoomIDByUserID[ctx.user.id]).toBe("hub-a");
        expect(harness.getRoomParticipantCount("packed")).toBe(MAX_PLAYERS_PER_ROOM);
    });

    it("a destination that no longer exists re-routes the user to a hub when fallback is allowed", async () => {
        await setUpHubs({"hub-a": 0});

        const ctx = harness.connectUser();
        const result = await harness.joinRoom(ctx, "deleted-room", /*allowFallback*/ true);

        expect(result).toEqual({type: "success", newRoomID: "hub-a"});
        expect(ServerRoomManager.currentRoomIDByUserID[ctx.user.id]).toBe("hub-a");
    });

    it("a destination that could not be resolved at all is refused rather than left roomless", async () => {
        // An empty destination is what the picker yields when no room can take the user. It must
        // not be mistaken for the "put this user in no room" request that a disconnect makes.
        const ctx = harness.connectUser();
        const result = await ServerRoomManager.changeUserRoom(ctx.socketUserContext, "",
            /*prevRoomShouldExist*/ false, /*savePlayerMetadata*/ false, /*allowFallback*/ false);

        expect(result).toEqual({type: "rejected", reason: RoomChangeRejectionReasonEnumMap.RoomUnavailable});
        expect(ServerRoomManager.currentRoomIDByUserID[ctx.user.id]).toBeUndefined();
    });

    // ─── Telling the client about a refusal ─────────────────────────────────

    it("the client is told why its room change request was refused", async () => {
        harness.seedRoom("home", RoomTypeEnumMap.Regular);
        await setUpRoom("packed", MAX_PLAYERS_PER_ROOM);

        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, "home");
        const roomChangedCountBefore = getPendingSignals(ctx, "roomChangedSignal").length;

        await ServerRoomManager.onRequestRoomChangeSignalReceived(ctx.socketUserContext,
            new RequestRoomChangeSignal("packed", /*allowFallback*/ false));

        const rejections = getPendingSignals(ctx, "roomChangeRejectedSignal");
        expect(rejections).toHaveLength(1);
        expect(rejections[0].reason).toBe(RoomChangeRejectionReasonEnumMap.RoomIsAlmostFull);
        // No room load was announced, and the user never left the room they were in.
        expect(getPendingSignals(ctx, "roomChangedSignal")).toHaveLength(roomChangedCountBefore);
        expect(ServerRoomManager.currentRoomIDByUserID[ctx.user.id]).toBe("home");
    });

    it("a room change request for a room that does not exist is refused as unavailable", async () => {
        harness.seedRoom("home", RoomTypeEnumMap.Regular);

        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, "home");

        await ServerRoomManager.onRequestRoomChangeSignalReceived(ctx.socketUserContext,
            new RequestRoomChangeSignal("no-such-room", /*allowFallback*/ false));

        const rejections = getPendingSignals(ctx, "roomChangeRejectedSignal");
        expect(rejections).toHaveLength(1);
        expect(rejections[0].reason).toBe(RoomChangeRejectionReasonEnumMap.RoomUnavailable);
    });

    it("a successful room change sends no rejection signal", async () => {
        harness.seedRoom("home", RoomTypeEnumMap.Regular);
        harness.seedRoom("elsewhere", RoomTypeEnumMap.Regular);

        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, "home");

        await ServerRoomManager.onRequestRoomChangeSignalReceived(ctx.socketUserContext,
            new RequestRoomChangeSignal("elsewhere", /*allowFallback*/ false));

        expect(getPendingSignals(ctx, "roomChangeRejectedSignal")).toHaveLength(0);
        expect(ServerRoomManager.currentRoomIDByUserID[ctx.user.id]).toBe("elsewhere");
    });

    // ─── Hub picking ────────────────────────────────────────────────────────

    it("keeps filling one under-populated hub instead of spreading users across all of them", async () => {
        await setUpHubs({
            "hub-a": ROOM_UNDER_POPULATION_THRESHOLD - 1,
            "hub-b": 0,
            "hub-c": 0,
        });

        // hub-a is the busiest of the three, and it is still the one that gets filled:
        // spreading users evenly this early would leave every hub with a lonely visitor.
        expect(await RoomPickerUtil.pickBestHubRoomID()).toBe("hub-a");
    });

    it("moves on to the next hub once the current one is no longer under-populated", async () => {
        await setUpHubs({"hub-a": ROOM_UNDER_POPULATION_THRESHOLD, "hub-b": 0});

        // Sitting exactly at the threshold still counts as under-populated.
        expect(await RoomPickerUtil.pickBestHubRoomID()).toBe("hub-a");

        harness.setSyntheticRoomPopulation("hub-a", ROOM_UNDER_POPULATION_THRESHOLD + 1);
        expect(await RoomPickerUtil.pickBestHubRoomID()).toBe("hub-b");
    });

    it("distributes users evenly once every hub is medium-populated", async () => {
        await setUpHubs({
            "hub-a": ROOM_OVER_POPULATION_THRESHOLD - 1,
            "hub-b": ROOM_UNDER_POPULATION_THRESHOLD + 6,
            "hub-c": ROOM_UNDER_POPULATION_THRESHOLD + 1,
        });

        // No hub is under-populated any more, so the emptiest one wins regardless of its ID.
        expect(await RoomPickerUtil.pickBestHubRoomID()).toBe("hub-c");
    });

    it("never routes a user into a hub that is already almost full", async () => {
        await setUpHubs({
            "hub-a": MAX_PLAYERS_PER_ROOM,
            "hub-b": ROOM_UNDER_POPULATION_THRESHOLD + 1,
        });

        expect(await RoomPickerUtil.pickBestHubRoomID()).toBe("hub-b");
    });

    it("opens a new hub once every existing hub is over-populated", async () => {
        await setUpHubs({
            "hub-a": ROOM_OVER_POPULATION_THRESHOLD,
            "hub-b": ROOM_OVER_POPULATION_THRESHOLD + 5,
        });

        const pickedRoomID = await RoomPickerUtil.pickBestHubRoomID();

        expect(pickedRoomID).not.toBe("hub-a");
        expect(pickedRoomID).not.toBe("hub-b");
        expect(harness.isRoomLoaded(pickedRoomID)).toBe(true);
        expect(harness.getRoomParticipantCount(pickedRoomID)).toBe(0);
        expect(loadedHubIDs()).toHaveLength(3);
    });

    it("opens only one new hub when several users arrive at the same moment", async () => {
        await setUpHubs({"hub-a": ROOM_OVER_POPULATION_THRESHOLD});

        const pickedRoomIDs = await Promise.all(
            Array.from({length: 5}, () => RoomPickerUtil.pickBestHubRoomID()));

        expect(new Set(pickedRoomIDs).size).toBe(1);
        expect(loadedHubIDs()).toHaveLength(2);
    });

    it("falls back to an over-populated hub when a new one cannot be opened", async () => {
        await setUpHubs({
            "hub-a": ROOM_OVER_POPULATION_THRESHOLD,
            "hub-b": ROOM_OVER_POPULATION_THRESHOLD + 2,
        });
        vi.mocked(DBRoomUtil.createRoom).mockResolvedValueOnce({success: false, data: []});

        // Being crowded beats having nowhere to go, so the emptier of the two still takes them.
        expect(await RoomPickerUtil.pickBestHubRoomID()).toBe("hub-a");
    });

    it("picks nothing when every hub is capped and no new one can be opened", async () => {
        await setUpHubs({"hub-a": MAX_PLAYERS_PER_ROOM});
        vi.mocked(DBRoomUtil.createRoom).mockResolvedValueOnce({success: false, data: []});

        expect(await RoomPickerUtil.pickBestHubRoomID()).toBe("");
    });

    it("routes the reserved \"hub\" target through the hub balancer", async () => {
        await setUpHubs({
            "hub-a": ROOM_UNDER_POPULATION_THRESHOLD + 1,
            "hub-b": 0,
        });

        const ctx = harness.connectUser();
        ctx.socket.handshake.auth.targetRoomID = "hub";

        expect(await RoomPickerUtil.pickBestRoomID(ctx.socketUserContext, "appStart")).toBe("hub-b");
    });

    // ─── Where a user lands when the app starts ─────────────────────────────

    it("sends a returning user back to the room they were last in", async () => {
        harness.seedRoom("previous", RoomTypeEnumMap.Regular);
        await setUpHubs({"hub-a": 0});

        const ctx = harness.connectUser({lastRoomID: "previous"});
        const result = await harness.appStartJoin(ctx);

        expect(result).toEqual({type: "success", newRoomID: "previous"});
        expect(ServerRoomManager.currentRoomIDByUserID[ctx.user.id]).toBe("previous");
    });

    it("re-routes a returning user to a hub when their last room has filled up", async () => {
        await setUpRoom("previous", ADMISSION_CAP);
        await setUpHubs({"hub-a": 0});

        const ctx = harness.connectUser({lastRoomID: "previous"});
        const result = await harness.appStartJoin(ctx);

        // The user never asked for this room by name, so being re-routed beats being turned
        // away — and there is nothing to tell them about.
        expect(result).toEqual({type: "success", newRoomID: "hub-a"});
        expect(getPendingSignals(ctx, "roomChangeRejectedSignal")).toHaveLength(0);
    });

    it("re-routes a returning user to a hub when their last room no longer exists", async () => {
        await setUpHubs({"hub-a": 0});

        const ctx = harness.connectUser({lastRoomID: "deleted-room"});
        const result = await harness.appStartJoin(ctx);

        expect(result).toEqual({type: "success", newRoomID: "hub-a"});
    });

    it("sends a first-time user to the hub the balancer picks", async () => {
        await setUpHubs({
            "hub-a": ROOM_UNDER_POPULATION_THRESHOLD - 1,
            "hub-b": 0,
        });

        const ctx = harness.connectUser();
        const result = await harness.appStartJoin(ctx);

        expect(result).toEqual({type: "success", newRoomID: "hub-a"});
    });

    it("honours a room named in the connection URL over the user's last room", async () => {
        harness.seedRoom("from-url", RoomTypeEnumMap.Regular);
        harness.seedRoom("previous", RoomTypeEnumMap.Regular);
        await setUpHubs({"hub-a": 0});

        const ctx = harness.connectUser({lastRoomID: "previous"});
        ctx.socket.handshake.auth.targetRoomID = "from-url";
        const result = await harness.appStartJoin(ctx);

        expect(result).toEqual({type: "success", newRoomID: "from-url"});
    });

    it("sends a user who owes a single-player mode there first, whatever else they have", async () => {
        harness.seedRoom("previous", RoomTypeEnumMap.Regular);
        await setUpHubs({"hub-a": 0});

        const ctx = harness.connectUser({singlePlayerMode: "tutorial", lastRoomID: "previous"});
        ctx.socket.handshake.auth.targetRoomID = "from-url";
        const result = await harness.appStartJoin(ctx);

        // A single-player room is not a real room: nobody is registered in it, and it is not
        // subject to any population rule.
        expect(result).toEqual({type: "success", newRoomID: "tutorial"});
        expect(ServerRoomManager.currentRoomIDByUserID[ctx.user.id]).toBeUndefined();
        expect(harness.isRoomLoaded("tutorial")).toBe(false);
    });

    it("tells a connecting user when no room at all can take them", async () => {
        // No hub exists and none can be opened, so the picker comes back empty-handed. The user
        // must hear about it: their client is sitting behind a loading indicator.
        vi.mocked(DBRoomUtil.createRoom).mockResolvedValueOnce({success: false, data: []});

        const ctx = harness.connectUser();
        const result = await harness.appStartJoin(ctx);

        expect(result).toEqual({type: "rejected", reason: RoomChangeRejectionReasonEnumMap.RoomUnavailable});
        expect(getPendingSignals(ctx, "roomChangeRejectedSignal")).toHaveLength(1);
    });

    // ─── Leaving single-player mode (tutorial door / skip) ──────────────────

    it("routes a user leaving single-player mode through the picker", async () => {
        await setUpHubs({"hub-a": 0});

        const ctx = harness.connectUser({singlePlayerMode: "tutorial"});
        await harness.appStartJoin(ctx);

        // An unnamed destination is the client asking the server to choose — not a refusal.
        await ServerRoomManager.onRequestRoomChangeSignalReceived(ctx.socketUserContext,
            new RequestRoomChangeSignal("", /*allowFallback*/ true));

        expect(ServerRoomManager.currentRoomIDByUserID[ctx.user.id]).toBe("hub-a");
        expect(getPendingSignals(ctx, "roomChangeRejectedSignal")).toHaveLength(0);
    });

    it("re-routes a user leaving single-player mode when the room they came for is full", async () => {
        await setUpRoom("previous", ADMISSION_CAP);
        await setUpHubs({"hub-a": 0});

        const ctx = harness.connectUser({singlePlayerMode: "tutorial", lastRoomID: "previous"});
        await harness.appStartJoin(ctx);

        await ServerRoomManager.onRequestRoomChangeSignalReceived(ctx.socketUserContext,
            new RequestRoomChangeSignal("", /*allowFallback*/ true));

        expect(ServerRoomManager.currentRoomIDByUserID[ctx.user.id]).toBe("hub-a");
    });

    // ─── Page refresh and server restart ────────────────────────────────────

    it("gives a refreshing user their slot back in a room that is otherwise full", async () => {
        await setUpRoom("packed", ADMISSION_CAP - 1);
        await setUpHubs({"hub-a": 0});

        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, "packed");
        expect(harness.getRoomParticipantCount("packed")).toBe(ADMISSION_CAP);

        // A refresh evicts the old socket before the new one picks a destination, so the slot
        // the user is giving up is free again by the time they ask for it back.
        const newCtx = await harness.reconnectCaseA(ctx);
        const result = await harness.appStartJoin(newCtx);

        expect(result).toEqual({type: "success", newRoomID: "packed"});
        expect(harness.getRoomParticipantCount("packed")).toBe(ADMISSION_CAP);
    });

    it("re-routes a refreshing user whose slot was taken while they were away", async () => {
        await setUpRoom("packed", ADMISSION_CAP - 1);
        await setUpHubs({"hub-a": 0});

        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, "packed");

        const newCtx = await harness.reconnectCaseB(ctx);
        harness.setSyntheticRoomPopulation("packed", ADMISSION_CAP); // somebody else took the free slot
        const result = await harness.appStartJoin(newCtx);

        expect(result).toEqual({type: "success", newRoomID: "hub-a"});
    });

    it("lets everyone back into their room after a server restart", async () => {
        harness.seedRoom("shared", RoomTypeEnumMap.Regular);
        await setUpHubs({"hub-a": 0});
        const contexts = await harness.fillRoomWithUsers("shared", 5);

        await harness.gracefulShutdown();
        expect(harness.isRoomLoaded("shared")).toBe(false);

        // Everyone comes back at once, the way a redeploy makes every client reload together.
        const newContexts = contexts.map(ctx => harness.reconnectUser(ctx));
        await Promise.all(newContexts.map(ctx => harness.appStartJoin(ctx)));

        expect(harness.getRoomParticipantCount("shared")).toBe(5);
        for (const ctx of newContexts)
            expect(ServerRoomManager.currentRoomIDByUserID[ctx.user.id]).toBe("shared");
    });

    it("records where every user was before the shutdown finishes", async () => {
        harness.seedRoom("shared", RoomTypeEnumMap.Regular);
        const contexts = await harness.fillRoomWithUsers("shared", 3);

        await harness.gracefulShutdown();

        // Returning users are found by what the previous session persisted, so a shutdown that
        // lost this would scatter everyone on the way back.
        for (const ctx of contexts)
            expect(harness.getStoredLastRoomID(ctx.user.id)).toBe("shared");
    });

    it("returns each user to their own room after a restart, not to a common one", async () => {
        harness.seedRoom("room-x", RoomTypeEnumMap.Regular);
        harness.seedRoom("room-y", RoomTypeEnumMap.Regular);
        await setUpHubs({"hub-a": 0});

        const inX = harness.connectUser();
        const inY = harness.connectUser();
        const inHub = harness.connectUser();
        await harness.joinRoom(inX, "room-x");
        await harness.joinRoom(inY, "room-y");
        await harness.joinRoom(inHub, "hub-a");

        await harness.gracefulShutdown();

        const backInX = harness.reconnectUser(inX);
        const backInY = harness.reconnectUser(inY);
        const backInHub = harness.reconnectUser(inHub);
        await Promise.all([backInX, backInY, backInHub].map(ctx => harness.appStartJoin(ctx)));

        expect(ServerRoomManager.currentRoomIDByUserID[backInX.user.id]).toBe("room-x");
        expect(ServerRoomManager.currentRoomIDByUserID[backInY.user.id]).toBe("room-y");
        expect(ServerRoomManager.currentRoomIDByUserID[backInHub.user.id]).toBe("hub-a");
    });

    it("returns a hub visitor to the same hub rather than re-balancing them", async () => {
        // Both hubs are empty once everyone has been disconnected, so the balancer would send
        // this user to hub-a. Being remembered has to outrank being balanced.
        await setUpHubs({"hub-a": 0, "hub-b": 0});

        const ctx = harness.connectUser();
        await harness.joinRoom(ctx, "hub-b");

        await harness.gracefulShutdown();
        expect(await RoomPickerUtil.pickBestHubRoomID()).toBe("hub-a");

        const newCtx = harness.reconnectUser(ctx);
        const result = await harness.appStartJoin(newCtx);

        expect(result).toEqual({type: "success", newRoomID: "hub-b"});
    });

    it("takes a user who was mid-tutorial at shutdown back into the tutorial", async () => {
        await setUpHubs({"hub-a": 0});

        const ctx = harness.connectUser({singlePlayerMode: "tutorial"});
        await harness.appStartJoin(ctx);
        expect(ServerRoomManager.currentRoomIDByUserID[ctx.user.id]).toBeUndefined();

        // A single-player user holds no room, so the shutdown has nothing to take from them.
        await harness.gracefulShutdown();

        const newCtx = harness.reconnectUser(ctx);
        const result = await harness.appStartJoin(newCtx);

        expect(result).toEqual({type: "success", newRoomID: "tutorial"});
    });
});
