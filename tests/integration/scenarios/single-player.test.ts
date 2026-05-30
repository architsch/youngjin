/**
 * Scenario tests: Single-player mode
 *
 * Covers the server-side contract for single-player rooms (e.g. the tutorial room):
 * - The room loads, but the joining user is NOT registered as a participant
 *   (the player object is spawned and driven entirely client-side).
 * - The socket context is flagged as being in a single-player room.
 * - The user's lastRoomID is never persisted for a single-player room
 *   (single-player rooms are re-entered via `user.singlePlayerMode`, not lastRoomID).
 * - A multiplayer room (Hub/Regular) still registers the user as a participant.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { RoomConfig } from "../helpers/scenarioRunner";
import { EMPTY_HUB, userAtCenter } from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";

const TUTORIAL_ROOM: RoomConfig = { id: "tutorial", type: RoomTypeEnumMap.SinglePlayer };

describe("single-player scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("joining a single-player room loads it without registering a participant", async () => {
        await runScenario({
            name: "join single-player room",
            rooms: [TUTORIAL_ROOM],
            users: [userAtCenter("tutorial", { singlePlayerMode: "tutorial" })],
            assertions: ({ harness, users }) => {
                // The room is loaded server-side...
                expect(harness.isRoomLoaded("tutorial")).toBe(true);
                // ...but the user is not a participant (the player object is client-side only).
                expect(harness.getRoomParticipantCount("tutorial")).toBe(0);
                expect(ServerRoomManager.currentRoomIDByUserID[users[0].user.id]).toBeUndefined();
                // The socket context is flagged as single-player.
                expect(users[0].socketUserContext.isInSinglePlayerRoom).toBe(true);
            },
        });
    });

    it("does not persist lastRoomID when joining a single-player room", async () => {
        await runScenario({
            name: "single-player room does not set lastRoomID",
            rooms: [TUTORIAL_ROOM],
            users: [userAtCenter("tutorial", { singlePlayerMode: "tutorial" })],
            assertions: ({ harness, users }) => {
                // lastRoomID stays empty: single-player rooms are re-entered via
                // user.singlePlayerMode, not via lastRoomID.
                expect(harness.getStoredLastRoomID(users[0].user.id) ?? "").toBe("");
            },
        });
    });

    it("joining a multiplayer room still registers the user as a participant", async () => {
        await runScenario({
            name: "multiplayer room registers participant",
            rooms: [EMPTY_HUB],
            users: [userAtCenter("hub")],
            assertions: ({ harness, users }) => {
                expect(harness.getRoomParticipantCount("hub")).toBe(1);
                expect(users[0].socketUserContext.isInSinglePlayerRoom).toBe(false);
            },
        });
    });
});
