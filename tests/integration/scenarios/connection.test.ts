/**
 * Scenario tests: Connection lifecycle
 *
 * Covers:
 * - Basic connect/disconnect
 * - Reconnection Case A (new socket before old disconnect)
 * - Reconnection Case B (old disconnect before new socket)
 * - Page refresh / duplicate socket replacement
 * - Rapid connect-disconnect cycles
 * - Gameplay state extraction and persistence
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { EMPTY_REGULAR, userAt, userAtCenter, namedUser, disconnectWithSave } from "../helpers/scenarioPresets";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";

describe("connection scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("connecting a user registers them in ServerUserManager", async () => {
        await runScenario({
            name: "basic connect",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter()],
            assertions: ({ users }) => {
                expect(Object.keys(ServerUserManager.socketUserContexts)).toHaveLength(1);
                expect(ServerUserManager.socketUserContexts[users[0].user.id]).toBeDefined();
            },
        });
    });

    it("disconnect with saveState=true persists player metadata + lastRoomID", async () => {
        await runScenario({
            name: "disconnect saves metadata",
            rooms: [EMPTY_REGULAR],
            users: [namedUser("save-user", "regular")],
            actions: [
                { type: "sendMessage", userIndex: 0, message: "goodbye" },
                disconnectWithSave(0),
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                // lastRoomID was written by changeUserRoom at join time and lives on DBUser.
                expect(harness.getStoredLastRoomID("save-user")).toBe("regular");
                // Player metadata is flushed on disconnect via savePlayerMetadata.
                expect(harness.savedPlayerMetadataRecords).toHaveLength(1);
                const saved = harness.savedPlayerMetadataRecords[0];
                expect(saved.userID).toBe("save-user");
                expect(saved.playerMetadata["0"]).toBe("goodbye");
            },
            skipCleanup: true,
        });
    });

    it("disconnect with saveState=false does NOT call savePlayerMetadata", async () => {
        await runScenario({
            name: "disconnect without save",
            rooms: [EMPTY_REGULAR],
            users: [userAtCenter("regular")],
            actions: [{ type: "disconnect", userIndex: 0, saveState: false }],
            skipInvariants: true,
            assertions: ({ harness }) => {
                expect(harness.savedPlayerMetadataRecords).toHaveLength(0);
            },
            skipCleanup: true,
        });
    });

    it("lastRoomID is persisted on room join even without disconnect", async () => {
        await runScenario({
            name: "join writes lastRoomID",
            rooms: [EMPTY_REGULAR],
            users: [namedUser("eager-user", "regular")],
            assertions: ({ harness }) => {
                // changeUserRoom kicks off DBUserUtil.setLastRoomID synchronously
                // from the join path — no disconnect required.
                expect(harness.getStoredLastRoomID("eager-user")).toBe("regular");
            },
        });
    });

    it("Case A: new socket before old disconnect preserves metadata", async () => {
        await runScenario({
            name: "reconnect case A",
            rooms: [EMPTY_REGULAR],
            users: [namedUser("case-a-user", "regular", { playerMetadata: { "0": "case-a-hello" } })],
            actions: [
                { type: "reconnectCaseA", userIndex: 0 },
            ],
            assertions: ({ users, harness }) => {
                expect(users[0].user.id).toBe("case-a-user");
                expect(Object.keys(ServerUserManager.socketUserContexts)).toHaveLength(1);
                // Metadata captured from the still-live player object should land on the new player.
                const metadata = harness.getPlayerMetadata("case-a-user");
                expect(metadata).toBeDefined();
                expect(metadata!["0"]).toBe("case-a-hello");
            },
        });
    });

    it("Case B: old disconnect before new socket preserves metadata", async () => {
        await runScenario({
            name: "reconnect case B",
            rooms: [EMPTY_REGULAR],
            users: [namedUser("case-b-user", "regular", { playerMetadata: { "0": "case-b-hello" } })],
            actions: [
                { type: "reconnectCaseB", userIndex: 0 },
            ],
            assertions: ({ users, harness }) => {
                expect(users[0].user.id).toBe("case-b-user");
                expect(Object.keys(ServerUserManager.socketUserContexts)).toHaveLength(1);
                // Even though the disconnect fired first, the snapshot in
                // recentDisconnectMetadata is consumed by the reconnect path.
                const metadata = harness.getPlayerMetadata("case-b-user");
                expect(metadata).toBeDefined();
                expect(metadata!["0"]).toBe("case-b-hello");
            },
        });
    });

    it("handles rapid connect-disconnect-reconnect cycles", async () => {
        await runScenario({
            name: "rapid cycles",
            rooms: [EMPTY_REGULAR],
            users: [],
            actions: [
                // Cycle 1
                { type: "connect", overrides: { id: "rapid-user" } },
                { type: "joinRoom", userIndex: 0, roomID: "regular" },
                { type: "disconnect", userIndex: 0, saveState: false },
                // Re-seed for next cycle
                { type: "seedRoom", roomID: "regular" },
                // Cycle 2
                { type: "connect", overrides: { id: "rapid-user" } },
                { type: "joinRoom", userIndex: 0, roomID: "regular" },
                { type: "disconnect", userIndex: 0, saveState: false },
                // Re-seed for next cycle
                { type: "seedRoom", roomID: "regular" },
                // Cycle 3
                { type: "connect", overrides: { id: "rapid-user" } },
                { type: "joinRoom", userIndex: 0, roomID: "regular" },
                { type: "disconnect", userIndex: 0, saveState: false },
            ],
            skipInvariants: true,
            assertions: () => {
                expect(Object.keys(ServerUserManager.socketUserContexts)).toHaveLength(0);
            },
            skipCleanup: true,
        });
    });

    it("player object's metadata reflects what the user joined the room with", async () => {
        await runScenario({
            name: "metadata seeded on join",
            rooms: [EMPTY_REGULAR],
            users: [{
                overrides: {
                    playerMetadata: { "0": "hello" },
                },
                joinRoom: "regular",
            }],
            assertions: ({ users, harness }) => {
                const metadata = harness.getPlayerMetadata(users[0].user.id);
                expect(metadata).toBeDefined();
                expect(metadata!["0"]).toBe("hello");
            },
        });
    });

    it("player metadata is updated by chat and flushed on disconnect", async () => {
        await runScenario({
            name: "metadata flushed on disconnect",
            rooms: [EMPTY_REGULAR],
            users: [namedUser("persist-user", "regular", { playerMetadata: { "0": "before" } })],
            actions: [
                { type: "sendMessage", userIndex: 0, message: "after" },
                disconnectWithSave(0),
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                const saved = harness.savedPlayerMetadataRecords[0];
                expect(saved).toBeDefined();
                expect(saved.userID).toBe("persist-user");
                expect(saved.playerMetadata["0"]).toBe("after");
                // lastRoomID lives on DBUser and was written at join time.
                expect(harness.getStoredLastRoomID("persist-user")).toBe("regular");
            },
            skipCleanup: true,
        });
    });
});
