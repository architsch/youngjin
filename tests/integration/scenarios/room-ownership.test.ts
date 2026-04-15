/**
 * Scenario tests: Room ownership and enter/exit flows
 *
 * Covers:
 * - User entering and exiting their own room (owner role assigned)
 * - User entering and exiting another user's room (visitor role assigned)
 * - User moving from one room to another (room switching)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import {
    regularRoom, hubRoom, userAt, namedUser, setOwner,
} from "../helpers/scenarioPresets";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import { UserRoleEnumMap } from "../../../src/shared/user/types/userRole";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

describe("room ownership scenarios", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // ─── Scenario 3: User entering/exiting their own room ────────────

    it("owner enters their own room and gets Owner role", async () => {
        await runScenario({
            name: "owner enters own room",
            rooms: [regularRoom("my-room")],
            users: [userAt(16, 16, "my-room", { id: "owner-1" })],
            actions: [
                setOwner(0, "my-room"),
            ],
            assertions: ({ users, harness }) => {
                // Owner should be in the room
                expect(ServerRoomManager.currentRoomIDByUserID["owner-1"]).toBe("my-room");
                expect(harness.getRoomParticipantCount("my-room")).toBe(1);
                // Owner should have the Owner role
                expect(ServerUserManager.getUserRole("owner-1")).toBe(UserRoleEnumMap.Owner);
            },
        });
    });

    it("owner exits their own room and room unloads", async () => {
        await runScenario({
            name: "owner exits own room",
            rooms: [regularRoom("my-room")],
            users: [userAt(16, 16, "my-room", { id: "owner-1" })],
            actions: [
                setOwner(0, "my-room"),
                { type: "disconnect", userIndex: 0, saveState: true },
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                // Room should be unloaded after owner leaves
                expect(harness.isRoomLoaded("my-room")).toBe(false);
                // Gameplay state should have been saved
                expect(harness.savedGameplayStates.length).toBeGreaterThanOrEqual(1);
                const savedState = harness.savedGameplayStates.find(s => s.userID === "owner-1");
                expect(savedState).toBeDefined();
                expect(savedState!.lastRoomID).toBe("my-room");
            },
            skipCleanup: true,
        });
    });

    // ─── Scenario 2: User entering/exiting another user's room ───────

    it("visitor enters another user's room and gets Visitor role", async () => {
        await runScenario({
            name: "visitor enters another's room",
            rooms: [regularRoom("other-room")],
            users: [
                userAt(16, 16, "other-room", { id: "room-owner" }),
                userAt(20, 20, "other-room", { id: "visitor-1" }),
            ],
            actions: [
                setOwner(0, "other-room"),
            ],
            assertions: ({ harness }) => {
                // Both users should be in the room
                expect(harness.getRoomParticipantCount("other-room")).toBe(2);
                // Owner should have Owner role
                expect(ServerUserManager.getUserRole("room-owner")).toBe(UserRoleEnumMap.Owner);
                // Visitor should have Visitor role
                expect(ServerUserManager.getUserRole("visitor-1")).toBe(UserRoleEnumMap.Visitor);
            },
        });
    });

    it("visitor exits another user's room while owner stays", async () => {
        await runScenario({
            name: "visitor exits another's room",
            rooms: [regularRoom("other-room")],
            users: [
                userAt(16, 16, "other-room", { id: "room-owner" }),
                userAt(20, 20, "other-room", { id: "visitor-1" }),
            ],
            actions: [
                setOwner(0, "other-room"),
                { type: "disconnect", userIndex: 1, saveState: true },
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                // Room should still be loaded (owner is still in it)
                expect(harness.isRoomLoaded("other-room")).toBe(true);
                expect(harness.getRoomParticipantCount("other-room")).toBe(1);
                // Owner should still have Owner role
                expect(ServerUserManager.getUserRole("room-owner")).toBe(UserRoleEnumMap.Owner);
                // Visitor's state should have been saved
                const savedState = harness.savedGameplayStates.find(s => s.userID === "visitor-1");
                expect(savedState).toBeDefined();
            },
        });
    });

    // ─── Scenario 12: User moving from one room to another ──────────

    it("user moves from default hub to their own regular room", async () => {
        await runScenario({
            name: "move from hub to own room",
            rooms: [hubRoom("hub-default"), regularRoom("my-room")],
            users: [userAt(16, 16, "hub-default", { id: "switching-user" })],
            actions: [
                // User starts in the hub, then navigates to their own room
                { type: "joinRoom", userIndex: 0, roomID: "my-room" },
                setOwner(0, "my-room"),
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                // User should now be in their own room
                expect(ServerRoomManager.currentRoomIDByUserID["switching-user"]).toBe("my-room");
                expect(ServerUserManager.getUserRole("switching-user")).toBe(UserRoleEnumMap.Owner);
                // Hub should be unloaded (last user left)
                expect(harness.isRoomLoaded("hub-default")).toBe(false);
            },
        });
    });

    it("user moves from one regular room to another regular room", async () => {
        await runScenario({
            name: "move between regular rooms",
            rooms: [regularRoom("room-A"), regularRoom("room-B")],
            users: [
                userAt(10, 10, "room-A", { id: "mover" }),
                userAt(20, 20, "room-B", { id: "stayer" }),
            ],
            actions: [
                // Mover starts in room-A, then switches to room-B
                { type: "moveObject", userIndex: 0, x: 15, y: 0, z: 15 },
                { type: "joinRoom", userIndex: 0, roomID: "room-B" },
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                // Mover should be in room-B
                expect(ServerRoomManager.currentRoomIDByUserID["mover"]).toBe("room-B");
                // room-A should be unloaded (no participants)
                expect(harness.isRoomLoaded("room-A")).toBe(false);
                // room-B should have both users
                expect(harness.getRoomParticipantCount("room-B")).toBe(2);
            },
        });
    });

    it("user moves between rooms via URL-style navigation (join by room ID)", async () => {
        await runScenario({
            name: "url-based room navigation",
            rooms: [hubRoom("hub"), regularRoom("target-room")],
            users: [userAt(16, 16, "hub", { id: "navigator" })],
            actions: [
                // Simulates entering /mypage/:roomID — the server resolves this to a joinRoom call
                { type: "joinRoom", userIndex: 0, roomID: "target-room" },
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                expect(ServerRoomManager.currentRoomIDByUserID["navigator"]).toBe("target-room");
                expect(harness.isRoomLoaded("hub")).toBe(false);
                expect(harness.isRoomLoaded("target-room")).toBe(true);
            },
        });
    });
});
