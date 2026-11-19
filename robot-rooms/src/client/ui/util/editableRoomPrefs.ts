import { useCallback, useEffect, useId, useState } from "react";
import App from "../../app";
import RoomLightingUtil from "../../graphics/light/util/roomLightingUtil";
import RoomPrefs from "../../../shared/room/types/roomPrefs";
import { roomPrefsChangedObservable } from "../../../shared/system/sharedObservables";

// The current room's prefs for a lighting panel, plus an edit function (see
// @docs/graphics/lighting.md). Edits apply immediately and save after a delay; concurrency is handled
// by RoomLightingUtil. Every edit writes the whole prefs set.
export default function useEditableRoomPrefs(): [RoomPrefs, (edit: (next: RoomPrefs) => void) => void]
{
    const [prefs, setPrefs] = useState<RoomPrefs>(() => RoomLightingUtil.getPrefs());

    // Picks up other superusers' changes (the observable only fires for applied changes, so pending
    // local edits aren't reverted). Unique key per panel.
    const listenerId = useId();
    useEffect(() => {
        const listenerKey = `editableRoomPrefs${listenerId}`;
        roomPrefsChangedObservable.addListener(listenerKey,
            () => setPrefs(RoomLightingUtil.getPrefs()));
        return () => roomPrefsChangedObservable.removeListener(listenerKey);
    }, [listenerId]);

    // The room is always named; the server decides permission.
    const roomID = App.getCurrentRoom()?.id ?? "";

    const apply = useCallback((edit: (next: RoomPrefs) => void) => {
        const nextPrefs = {...prefs};
        edit(nextPrefs);
        RoomLightingUtil.applyLocalEdit(nextPrefs, roomID);
        setPrefs(nextPrefs);
    }, [prefs, roomID]);

    return [prefs, apply];
}
