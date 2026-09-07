import App from "../../../app";
import GraphicsManager from "../../graphicsManager";
import RoomAPIClient from "../../../networking/client/roomAPIClient";
import RoomPrefs from "../../../../shared/room/types/roomPrefs";
import RoomPrefsUtil from "../../../../shared/room/util/roomPrefsUtil";
import createDeferredSave from "../../../ui/util/deferredSave";
import { notificationMessageObservable } from "../../../system/clientObservables";

// The one place the room's atmosphere is changed, and the one place that decides what wins when two
// things want to change it at once.
//
// There are two writers. The person editing the room here, and the server relaying what somebody
// else changed — and they have to be reconciled, because **a save is deliberately delayed** so that
// dragging a slider is one write rather than fifty. For those couple of seconds this client holds a
// setting the server has not seen; and once the save does go, the server broadcasts it back, so an
// edit made *after* the save is racing an echo of the one before it.
//
// Applied naively that echo wins twice over: it takes the room back to the setting its owner has
// already moved past, and the save still pending then reads the room and writes that older setting
// down as well. What the user sees is a form showing one color and a room lit in another.
//
// The rule that settles it: **while an edit of this client's own is outstanding, lighting arriving
// from the server is ignored.** Ours is the newer of the two and is already on its way there, so it
// is going to win regardless; letting the older one land in the meantime only produces a flicker
// back to it. An edit is outstanding from the moment it is made until the server echoes that exact
// setting back — which it does verbatim, since what the server stores is a round trip through
// RoomPrefsUtil and that is a fixed point.
//
// Two people editing one room at the same time therefore settles as last-writer-wins, which is what
// the room-configuration form has always done with everything else it holds.
const RoomLightingUtil =
{
    // The lighting a freshly loaded room arrived with. Nothing this client was in the middle of
    // saying applies to it, so whatever was outstanding is dropped — the save it belongs to still
    // goes, since it carries its own setting and names its own room.
    applyRoomLighting: (prefs: string) =>
    {
        outstandingPrefs = undefined;
        applyToScene(prefs);
    },
    // An edit made here: applied to the room as it is made, and written down a couple of seconds
    // later. There is no "apply" step and nothing to undo — what the user is looking at *is* the
    // setting.
    applyLocalEdit: (prefs: RoomPrefs, roomID: string) =>
    {
        const encodedPrefs = RoomPrefsUtil.encode(prefs);
        outstandingPrefs = encodedPrefs;
        applyToScene(encodedPrefs);
        trySave(encodedPrefs, roomID);
    },
    // Lighting somebody else changed, as the server relayed it. Answers whether it was taken, which
    // is what tells the form on screen whether it has something new to show.
    applyIncoming: (prefs: string): boolean =>
    {
        if (outstandingPrefs != undefined)
        {
            // Not ours, and older than what we are about to send: see the note above.
            if (prefs !== outstandingPrefs)
                return false;
            // Ours, come back around. Nothing of this client's is outstanding any more.
            outstandingPrefs = undefined;
        }
        applyToScene(prefs);
        return true;
    },
    // What the room is currently lit by, for a form opening onto it.
    getPrefs: (): RoomPrefs =>
    {
        return RoomPrefsUtil.decode(App.getCurrentRoom()?.prefs ?? "");
    },
}

// What this client has said and the server has not yet said back. Undefined whenever the room's own
// lighting is the last word on the subject.
let outstandingPrefs: string | undefined;

// The room carries its own lighting, so there is nowhere else for this to be kept: whatever reads
// the room next — a form opening, the block map, this module a moment later — reads the edit rather
// than what the server last confirmed.
function applyToScene(prefs: string)
{
    const room = App.getCurrentRoom();
    if (room)
        room.prefs = prefs;
    GraphicsManager.setRoomLightingPrefs(RoomPrefsUtil.decode(prefs));
}

// Handed the setting to write rather than reading it back off the room, so that a room change in
// the meantime cannot turn a pending save into a write of somebody else's lighting — or of nothing.
const trySave = createDeferredSave((prefs: string, roomID: string) => {
    RoomAPIClient.changeRoomPrefs(prefs, roomID).then(response => {
        if (response.status >= 200 && response.status < 300)
            return;
        notificationMessageObservable.set("Failed to update the room's lighting.");
        // Nothing of this client's is on its way any more, so it stops holding other people's
        // changes off — unless it has since been overtaken by a newer edit of its own, which is
        // still outstanding and still has to win.
        if (outstandingPrefs === prefs)
            outstandingPrefs = undefined;
    });
});

export default RoomLightingUtil;
