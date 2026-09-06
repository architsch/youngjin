/**
 * Scenario tests: who wins when a room's lighting is changed twice in quick succession
 *
 * A save is deliberately delayed, so a client spends a couple of seconds holding a setting the
 * server has not seen — and once the save does go, the server broadcasts it back, so an edit made
 * *after* that save is racing an echo of the one before it.
 *
 * Getting this wrong is not subtle in effect and is very subtle in cause: what the user sees is a
 * color picker showing one thing and a room lit in another, with the edit they actually made never
 * written down at all. These pin the rule that settles it (see RoomLightingUtil).
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
    "../../../src/client/system/util/roomLightingUtil");

// The setting the user is dragging through, as the room stores it.
function prefsWithFogColor(fogColorIndex: number)
{
    return {...RoomPrefsUtil.decode(""), fogColorIndex};
}
function encodedFogColor(fogColorIndex: number)
{
    return RoomPrefsUtil.encode(prefsWithFogColor(fogColorIndex));
}

// What the server does with an incoming setting, which is the whole of its validation — so this is
// exactly what comes back on the wire (see ServerRoomManager.changeRoomPrefs).
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
        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(3));
        await vi.advanceTimersByTimeAsync(500);
        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(7));
        await vi.advanceTimersByTimeAsync(5000);

        expect(sentPrefs).toEqual([encodedFogColor(7)]);
    });

    it("ignores the echo of its own save once the user has moved on", async () => {
        // The failure this is here for: edit, save, edit again, and *then* the first save's echo
        // arrives. Applying it would light the room in a color the user has already left, and — if
        // the pending save read the room rather than carrying its own setting — write that older
        // color down as the final answer too.
        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(3));
        await vi.advanceTimersByTimeAsync(2500);
        expect(sentPrefs).toEqual([encodedFogColor(3)]);

        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(7));
        const echoTaken = RoomLightingUtil.applyIncoming(
            asServerWouldStore(encodedFogColor(3)));

        expect(echoTaken).toBe(false);
        expect(currentRoom.prefs).toBe(encodedFogColor(7));
        expect(appliedPrefs[appliedPrefs.length - 1]).toBe(encodedFogColor(7));

        await vi.advanceTimersByTimeAsync(5000);
        expect(sentPrefs[sentPrefs.length - 1]).toBe(encodedFogColor(7));
    });

    it("takes its own setting back once it has come around", async () => {
        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(3));
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
        // Otherwise a single failed request would leave this client refusing every change anybody
        // else made, for as long as it stayed in the room.
        saveResponseStatus = 500;
        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(3));
        await vi.advanceTimersByTimeAsync(5000);

        expect(RoomLightingUtil.applyIncoming(encodedFogColor(9))).toBe(true);
        expect(currentRoom.prefs).toBe(encodedFogColor(9));
    });

    it("drops what it was holding when the user goes to another room", async () => {
        RoomLightingUtil.applyLocalEdit(prefsWithFogColor(3));
        RoomLightingUtil.applyRoomLighting(encodedFogColor(20));

        // The new room's own lighting stands, and the save still goes with the setting it carries
        // rather than with whatever the new room happens to hold.
        expect(currentRoom.prefs).toBe(encodedFogColor(20));
        await vi.advanceTimersByTimeAsync(5000);
        expect(sentPrefs).toEqual([encodedFogColor(3)]);
    });
});
