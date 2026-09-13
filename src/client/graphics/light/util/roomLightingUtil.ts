import App from "../../../app";
import GraphicsManager from "../../graphicsManager";
import RoomAPIClient from "../../../networking/client/roomAPIClient";
import RoomPrefs from "../../../../shared/room/types/roomPrefs";
import RoomPrefsUtil from "../../../../shared/room/util/roomPrefsUtil";
import createDeferredSave from "../../../ui/util/deferredSave";
import { notificationMessageObservable } from "../../../system/clientObservables";

// The single entry point for changing room atmosphere. Saves are deferred, so the server can echo an
// older setting while a newer local edit is pending. Rule: while a local edit is outstanding, ignore
// incoming lighting until the server echoes that exact string back (encoding is a fixed point).
// Concurrent editors resolve as last-writer-wins.
const RoomLightingUtil =
{
    // A freshly loaded room; any outstanding edit no longer applies (its save still goes).
    applyRoomLighting: (prefs: string) =>
    {
        outstandingPrefs = undefined;
        applyToScene(prefs);
    },
    applyLocalEdit: (prefs: RoomPrefs, roomID: string) =>
    {
        const encodedPrefs = RoomPrefsUtil.encode(prefs);
        outstandingPrefs = encodedPrefs;
        applyToScene(encodedPrefs);
        trySave(encodedPrefs, roomID);
    },
    // Returns whether the relayed lighting was applied.
    applyIncoming: (prefs: string): boolean =>
    {
        if (outstandingPrefs != undefined)
        {
            if (prefs !== outstandingPrefs)
                return false;
            // Our own edit echoed back.
            outstandingPrefs = undefined;
        }
        applyToScene(prefs);
        return true;
    },
    getPrefs: (): RoomPrefs =>
    {
        return RoomPrefsUtil.decode(App.getCurrentRoom()?.prefs ?? "");
    },
}

// Sent but not yet echoed by the server.
let outstandingPrefs: string | undefined;

function applyToScene(prefs: string)
{
    const room = App.getCurrentRoom();
    if (room)
        room.prefs = prefs;
    GraphicsManager.setRoomLightingPrefs(RoomPrefsUtil.decode(prefs));
}

// Takes the setting as an argument (not read from the room) so a room change can't redirect a
// pending save.
const trySave = createDeferredSave((prefs: string, roomID: string) => {
    RoomAPIClient.changeRoomPrefs(prefs, roomID).then(response => {
        if (response.status >= 200 && response.status < 300)
            return;
        notificationMessageObservable.set("Failed to update the room's lighting.");
        // Stop blocking incoming changes, unless a newer local edit is still outstanding.
        if (outstandingPrefs === prefs)
            outstandingPrefs = undefined;
    });
});

export default RoomLightingUtil;
