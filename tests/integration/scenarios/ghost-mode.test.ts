/**
 * Scenario tests: ghost mode, kept in a player's AdminPrefs metadata (see @docs/gameplay/admin.md).
 * Covers: the AdminPrefs codec, admin-only permission on one's own player, relay, and persistence across
 * sessions (including a stored value outliving a demotion).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { runScenario } from "../helpers/scenarioRunner";
import { getPendingSignals } from "../helpers/invariants";
import { regularRoom, namedUser, disconnectWithSave } from "../helpers/scenarioPresets";
import AdminPrefsUtil from "../../../src/shared/object/util/adminPrefsUtil";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";

const ADMIN_PREFS_KEY = ObjectMetadataKeyEnumMap.AdminPrefs;
const GHOST_ON = AdminPrefsUtil.encode({ghostMode: true});
const GHOST_OFF = AdminPrefsUtil.encode({ghostMode: false});

describe("ghost mode", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    // ─── Codec ─────────────────────────────────────────────────────────

    it("an object without admin prefs is not a ghost", () => {
        expect(AdminPrefsUtil.decode("").ghostMode).toBe(false);
    });

    it("ghost mode round-trips through a single base-94 character", () => {
        expect(GHOST_ON.length).toBe(1);
        expect(GHOST_OFF.length).toBe(1);
        expect(GHOST_ON).not.toBe(GHOST_OFF);
        expect(AdminPrefsUtil.decode(GHOST_ON).ghostMode).toBe(true);
        expect(AdminPrefsUtil.decode(GHOST_OFF).ghostMode).toBe(false);
    });

    it("untrusted input canonicalizes to a valid value", () => {
        for (const raw of ["", " ", "~~~~", "\u0000", "😀", "!extra"])
            expect([GHOST_ON, GHOST_OFF]).toContain(AdminPrefsUtil.canonicalize(raw));
    });

    // ─── Permissions ───────────────────────────────────────────────────

    it("an admin can turn ghost mode on for their own player", async () => {
        await runScenario({
            name: "admin ghost on",
            rooms: [regularRoom("ghost-admin")],
            users: [namedUser("ghost-admin-user", "ghost-admin", {userType: UserTypeEnumMap.Admin})],
            actions: [
                { type: "setObjectMetadata", userIndex: 0, metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_ON },
            ],
            assertions: ({ harness }) => {
                const obj = harness.getPlayerObject("ghost-admin-user");
                expect(obj!.metadata[ADMIN_PREFS_KEY]?.str).toBe(GHOST_ON);
                expect(AdminPrefsUtil.getObjectPrefs(obj!).ghostMode).toBe(true);
            },
        });
    });

    it("an admin can turn ghost mode off again", async () => {
        await runScenario({
            name: "admin ghost off",
            rooms: [regularRoom("ghost-admin-off")],
            users: [namedUser("ghost-admin-off-user", "ghost-admin-off", {
                userType: UserTypeEnumMap.Admin,
                playerMetadata: { [String(ADMIN_PREFS_KEY)]: GHOST_ON },
            })],
            actions: [
                { type: "setObjectMetadata", userIndex: 0, metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_OFF },
            ],
            assertions: ({ harness }) => {
                const obj = harness.getPlayerObject("ghost-admin-off-user");
                expect(AdminPrefsUtil.getObjectPrefs(obj!).ghostMode).toBe(false);
            },
        });
    });

    for (const [roleName, userType] of [["member", UserTypeEnumMap.Member], ["guest", UserTypeEnumMap.Guest]] as const)
    {
        it(`a ${roleName} cannot put their own player in ghost mode`, async () => {
            await runScenario({
                name: `${roleName} ghost rejected`,
                rooms: [regularRoom(`ghost-${roleName}`)],
                users: [namedUser(`ghost-${roleName}-user`, `ghost-${roleName}`, {userType})],
                actions: [
                    { type: "setObjectMetadata", userIndex: 0, metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_ON },
                ],
                assertions: ({ users, harness }) => {
                    const obj = harness.getPlayerObject(`ghost-${roleName}-user`);
                    expect(obj!.metadata[ADMIN_PREFS_KEY]).toBeUndefined();
                    // The rejection is corrected back to the sender.
                    expect(getPendingSignals(users[0], "setObjectMetadataSignal").length).toBeGreaterThan(0);
                },
            });
        });
    }

    it("an admin cannot put another player in ghost mode", async () => {
        await runScenario({
            name: "foreign ghost rejected",
            rooms: [regularRoom("ghost-foreign")],
            users: [
                namedUser("ghost-foreign-admin", "ghost-foreign", {userType: UserTypeEnumMap.Admin}),
                namedUser("ghost-foreign-victim", "ghost-foreign"),
            ],
            actions: [
                { type: "setObjectMetadata", userIndex: 0, targetUserIndex: 1,
                    metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_ON },
            ],
            assertions: ({ harness }) => {
                const victim = harness.getPlayerObject("ghost-foreign-victim");
                expect(victim!.metadata[ADMIN_PREFS_KEY]).toBeUndefined();
            },
        });
    });

    // ─── Relay ─────────────────────────────────────────────────────────

    it("entering ghost mode is relayed to the other participants", async () => {
        await runScenario({
            name: "ghost relay",
            rooms: [regularRoom("ghost-relay")],
            users: [
                namedUser("ghost-relay-admin", "ghost-relay", {userType: UserTypeEnumMap.Admin}),
                namedUser("ghost-relay-watcher", "ghost-relay"),
            ],
            actions: [
                { type: "setObjectMetadata", userIndex: 0, metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_ON },
            ],
            assertions: ({ users }) => {
                const relayed = getPendingSignals(users[1], "setObjectMetadataSignal");
                expect(relayed.some((s: any) => s.metadataKey == ADMIN_PREFS_KEY)).toBe(true);
            },
        });
    });

    // ─── Persistence ───────────────────────────────────────────────────

    it("ghost mode survives reconnection", async () => {
        await runScenario({
            name: "ghost survives reconnect",
            rooms: [regularRoom("ghost-recon")],
            users: [namedUser("ghost-recon-user", "ghost-recon", {userType: UserTypeEnumMap.Admin})],
            actions: [
                { type: "setObjectMetadata", userIndex: 0, metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_ON },
                { type: "reconnectCaseA", userIndex: 0 },
            ],
            assertions: ({ harness }) => {
                const obj = harness.getPlayerObject("ghost-recon-user");
                expect(obj!.metadata[ADMIN_PREFS_KEY]?.str).toBe(GHOST_ON);
            },
        });
    });

    it("ghost mode is saved to the user's stored player metadata on leaving", async () => {
        await runScenario({
            name: "ghost saved",
            rooms: [regularRoom("ghost-save")],
            users: [namedUser("ghost-save-user", "ghost-save", {userType: UserTypeEnumMap.Admin})],
            actions: [
                { type: "setObjectMetadata", userIndex: 0, metadataKey: ADMIN_PREFS_KEY, metadataValue: GHOST_ON },
                disconnectWithSave(0),
            ],
            skipInvariants: true,
            assertions: ({ harness }) => {
                expect(harness.getStoredPlayerMetadata("ghost-save-user")?.[String(ADMIN_PREFS_KEY)])
                    .toBe(GHOST_ON);
            },
        });
    });

    it("a stored ghost mode is restored for an admin", async () => {
        await runScenario({
            name: "ghost restored",
            rooms: [regularRoom("ghost-restore")],
            users: [namedUser("ghost-restore-user", "ghost-restore", {
                userType: UserTypeEnumMap.Admin,
                playerMetadata: { [String(ADMIN_PREFS_KEY)]: GHOST_ON },
            })],
            actions: [],
            assertions: ({ harness }) => {
                const obj = harness.getPlayerObject("ghost-restore-user");
                expect(AdminPrefsUtil.getObjectPrefs(obj!).ghostMode).toBe(true);
            },
        });
    });

    it("a stored ghost mode is dropped for a user who is no longer an admin", async () => {
        await runScenario({
            name: "ghost dropped after demotion",
            rooms: [regularRoom("ghost-demoted")],
            users: [namedUser("ghost-demoted-user", "ghost-demoted", {
                userType: UserTypeEnumMap.Member,
                playerMetadata: { [String(ADMIN_PREFS_KEY)]: GHOST_ON, "0": "still here" },
            })],
            actions: [],
            assertions: ({ harness }) => {
                const obj = harness.getPlayerObject("ghost-demoted-user");
                expect(obj!.metadata[ADMIN_PREFS_KEY]).toBeUndefined();
                // The rest of the stored metadata is restored as usual.
                expect(obj!.metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str).toBe("still here");
            },
        });
    });
});
