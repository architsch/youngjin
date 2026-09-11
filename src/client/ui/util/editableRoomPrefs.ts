import { useCallback, useEffect, useId, useState } from "react";
import App from "../../app";
import RoomLightingUtil from "../../graphics/light/util/roomLightingUtil";
import RoomPrefs from "../../../shared/room/types/roomPrefs";
import { roomPrefsChangedObservable } from "../../../shared/system/sharedObservables";

// The current room's lighting and weather, held for a panel that edits some part of it (see
// AmbientLightPanel and its neighbours): the prefs as they stand, and the way to change them. What
// each setting means is in @docs/graphics/lighting.md .
//
// Every edit is applied to the scene as it is made and written down a couple of seconds later, so
// that a slider is dragged against the room itself rather than against a preview of it. There is no
// "apply" step and nothing to undo: what the user is looking at *is* the setting. Which of two
// simultaneous edits wins is not this hook's business — see RoomLightingUtil.
//
// However few of the settings a panel shows, an edit to any of them writes the whole set: they are
// one set of prefs, read and written together.
export default function useEditableRoomPrefs(): [RoomPrefs, (edit: (next: RoomPrefs) => void) => void]
{
    const [prefs, setPrefs] = useState<RoomPrefs>(() => RoomLightingUtil.getPrefs());

    // Lighting another superuser changed shows up without a reload. The observable only fires for a
    // change that was actually taken, so an edit of this client's own that is still on its way to the
    // server never gets dragged back to an older one. Each panel listens under a key of its own, so
    // that nothing here depends on which of them can be up together.
    const listenerId = useId();
    useEffect(() => {
        const listenerKey = `editableRoomPrefs${listenerId}`;
        roomPrefsChangedObservable.addListener(listenerKey,
            () => setPrefs(RoomLightingUtil.getPrefs()));
        return () => roomPrefsChangedObservable.removeListener(listenerKey);
    }, [listenerId]);

    // Which room is being lit is always named, whether it is the caller's own or a hub they
    // administer — whether they may light it is the server's to decide from the room (see the room
    // API).
    const roomID = App.getCurrentRoom()?.id ?? "";

    const apply = useCallback((edit: (next: RoomPrefs) => void) => {
        const nextPrefs = {...prefs};
        edit(nextPrefs);
        RoomLightingUtil.applyLocalEdit(nextPrefs, roomID);
        setPrefs(nextPrefs);
    }, [prefs, roomID]);

    return [prefs, apply];
}
