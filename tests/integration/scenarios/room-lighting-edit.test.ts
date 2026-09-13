/**
 * Scenario tests: rapid successive lighting edits (see RoomLightingUtil). Saves are delayed and echoed
 * back, so a later edit can race an earlier save's echo; getting it wrong shows one color in the picker,
 * another in the room, and never saves the edit.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import RoomPrefsUtil from "../../../src/shared/room/util/roomPrefsUtil";

const appliedPrefs: string[] = [];
const sentPrefs: string[] = [];
let saveResponseStatus = 200;

const currentRoom = { id: "room-1", prefs: "" };

vi.mock("../../../src/client/app", () => ({
    default: { getCurrentRoom: () => currentRoom },
}));

vi.mock("../../../src/client/graphics/graphicsManager", () => ({
    default: {
        setRoomLightingPrefs: (prefs: any) => appliedPrefs.push(RoomPrefsUtil.encode(prefs)),
    },
}));

vi.mock("../../../src/client/networking/client/roomAPIClient", () => ({
    default: {
        changeRoomPrefs: async (prefs: string) => {
            sentPrefs.push(prefs);
            return { status: saveResponseStatus, data: {} };
        },
    },
}));

vi.mock("../../../src/client/system/clientObservables", () => ({
    notificationMessageObservable: { set: () => {} },
}));

const { default: RoomLightingUtil } = await import(
    "../../../src/client/graphics/light/util/roomLightingUtil");

// The setting the user is dragging through, as the room stores it.
function prefsWithFogColor(fogColorIndex: number)
{
    return {...RoomPrefsUtil.decode(""), fogColorIndex};
}
function encodedFogColor(fogColorIndex: number)
{
    return RoomPrefsUtil.encode(prefsWithFogColor(fogColorIndex));
}

// The server's whole validation, i.e. what comes back on the wire (see ServerRoomManager.changeRoomPrefs).
function asServerWouldStore(prefs: string)
{
    return RoomPrefsUtil.encode(RoomPrefsUtil.decode(prefs));
}

describe("editing a room's lighting", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        appliedPrefs.length = 0;
        sentPrefs.length = 0;
        saveResponseStatus = 200;
        currentRoom.prefs = "";
        RoomLightingUtil.applyRoomLighting("");
        appliedPrefs.length = 0;
    });

    it("writes down the setting the user finished on, not the one that armed the timer", async () => {
        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(3), "room-1");
        await vi.advanceTimersByTimeAsync(500);
        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(7), "room-1");
        await vi.advanceTimersByTimeAsync(5000);

        expect(sentPrefs).toEqual([encodedFogColor(7)]);
    });

    it("ignores the echo of its own save once the user has moved on", async () => {
        // Edit, save, edit, then the first echo arrives: applying it would revert the color (and, if the
        // pending save read the room, persist the old one).
        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(3), "room-1");
        await vi.advanceTimersByTimeAsync(2500);
        expect(sentPrefs).toEqual([encodedFogColor(3)]);

        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(7), "room-1");
        const echoTaken = RoomLightingUtil.applyIncoming(
            asServerWouldStore(encodedFogColor(3)));

        expect(echoTaken).toBe(false);
        expect(currentRoom.prefs).toBe(encodedFogColor(7));
        expect(appliedPrefs[appliedPrefs.length - 1]).toBe(encodedFogColor(7));

        await vi.advanceTimersByTimeAsync(5000);
        expect(sentPrefs[sentPrefs.length - 1]).toBe(encodedFogColor(7));
    });

    it("takes its own setting back once it has come around", async () => {
        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(3), "room-1");
        await vi.advanceTimersByTimeAsync(2500);

        expect(RoomLightingUtil.applyIncoming(asServerWouldStore(encodedFogColor(3)))).toBe(true);
        // And with nothing of its own outstanding any more, somebody else's change lands.
        expect(RoomLightingUtil.applyIncoming(encodedFogColor(11))).toBe(true);
        expect(currentRoom.prefs).toBe(encodedFogColor(11));
    });

    it("takes somebody else's change when it has nothing of its own in flight", () => {
        expect(RoomLightingUtil.applyIncoming(encodedFogColor(5))).toBe(true);
        expect(currentRoom.prefs).toBe(encodedFogColor(5));
        expect(appliedPrefs[appliedPrefs.length - 1]).toBe(encodedFogColor(5));
    });

    it("stops holding other people off once its own save has failed", async () => {
        // A failed request must not leave the client ignoring others' changes.
        saveResponseStatus = 500;
        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(3), "room-1");
        await vi.advanceTimersByTimeAsync(5000);

        expect(RoomLightingUtil.applyIncoming(encodedFogColor(9))).toBe(true);
        expect(currentRoom.prefs).toBe(encodedFogColor(9));
    });

    it("drops what it was holding when the user goes to another room", async () => {
        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(3), "room-1");
        RoomLightingUtil.applyRoomLighting(encodedFogColor(20));

        // The new room's lighting stands; the save still carries its own setting.
        expect(currentRoom.prefs).toBe(encodedFogColor(20));
        await vi.advanceTimersByTimeAsync(5000);
        expect(sentPrefs).toEqual([encodedFogColor(3)]);
    });
});
