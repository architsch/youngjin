import App from "../../app";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import Room from "../../../shared/room/types/room";
import RoomEditorUtil from "../../singlePlayer/util/roomEditorUtil";
import { debugPanelOpenObservable } from "../clientObservables";

// The line of chat that opens the debug panel, whatever its case.
const OPEN_PANEL_LINE = ":debug";

// Where the debug panel (see DebugStats) can be had, and how: nothing on the screen offers it.
const DebugPanelUtil =
{
    // Multiplayer rooms, and the room editor, which needs its commands too: one starts a new room there, another shows
    // its volumes.
    isAvailable: (room: Room | undefined): boolean =>
    {
        return room != undefined && (room.roomType != RoomTypeEnumMap.SinglePlayer || RoomEditorUtil.isEditing(room));
    },
    // Whether what the user is about to say is the line that opens it, which is then not said. Words like any other
    // in a room without the panel.
    tryOpenByChat: (message: string): boolean =>
    {
        if (message.trim().toLowerCase() != OPEN_PANEL_LINE || !DebugPanelUtil.isAvailable(App.getCurrentRoom()))
            return false;
        debugPanelOpenObservable.set(true);
        return true;
    },
}

export default DebugPanelUtil;
