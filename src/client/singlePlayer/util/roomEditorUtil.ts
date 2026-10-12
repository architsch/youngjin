import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import RequestRoomChangeSignal from "../../../shared/room/types/requestRoomChangeSignal";
import Room from "../../../shared/room/types/room";
import RoomFile from "../../../shared/room/types/roomFile";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import { ROOM_EDITOR_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";
import { notificationMessageObservable } from "../../system/clientObservables";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import PopupUtil from "../../ui/util/popupUtil";

const NEW_ROOM_FILE_NAME = `room${RoomFile.FILE_EXTENSION}`;

// The file the room editor was asked to open, which the room it is about to load is read from.
let fileToOpen: {bytes: Uint8Array, name: string} | null = null;

// What the room being edited is saved as, unless told otherwise: the file it was opened from.
let editedFileName = NEW_ROOM_FILE_NAME;

// The room editor: a single-player room an admin edits as they would a room of their own, opened empty or from
// a room file and saved as one (see @docs/networking/single_player_mode.md). Nothing of it reaches the server, so
// until it is saved it is kept nowhere else: it is given up only on its user's say-so, and goes on whatever
// becomes of the connection (see SocketsClient).
const RoomEditorUtil =
{
    isEditing: (room: Room | undefined = App.getCurrentRoom()): boolean =>
    {
        return room != undefined && room.roomType == RoomTypeEnumMap.SinglePlayer
            && room.roomName == ROOM_EDITOR_SINGLE_PLAYER_MODE;
    },
    // Enters the editor on a new empty room, leaving whichever room the user is in.
    openNewRoom: (): void =>
    {
        RoomEditorUtil.askBeforeLeaving(() => enter(null));
    },
    // Enters it on a room file, which its caller has read as a room already, and asked over (see LocalRoomFileUtil).
    openRoomFile: (bytes: Uint8Array, name: string): void =>
    {
        enter({bytes, name});
    },
    // Leaves the room the user is in, by the given way: at once, unless that room is the one being edited.
    askBeforeLeaving: (leave: () => void): void =>
    {
        if (!RoomEditorUtil.isEditing())
        {
            leave();
            return;
        }
        PopupUtil.openPopup({
            popupType: "confirm",
            params: {
                message: "The room being edited will be lost unless it has been saved. Do you really want to proceed?",
                onConfirm: () => {
                    PopupUtil.closePopup();
                    leave();
                },
                onCancel: PopupUtil.closePopup,
            },
        });
    },
    // Turns away a room the server sent unasked, and says whether it did. The room being edited is given up only
    // for one its user asked for, who then has the loading screen up (see App). The room a client is put in as
    // its connection comes back is none of that, and the server is told where the user still is.
    turnAwayUnasked: (roomSent: Room): boolean =>
    {
        if (!RoomEditorUtil.isEditing() || ongoingClientProcessExists("roomChange"))
            return false;
        if (!RoomEditorUtil.isEditing(roomSent))
            SocketsClient.emitRequestRoomChangeSignal(new RequestRoomChangeSignal(ROOM_EDITOR_SINGLE_PLAYER_MODE, false));
        return true;
    },
    // The name the room being edited is saved under (see LocalRoomFileUtil).
    getEditedFileName: (): string =>
    {
        return editedFileName;
    },
    // The bytes the editor's room is to be read from, once: none if it wasn't asked to open a file, which leaves
    // it its mode's own room (see SinglePlayerModeConfig.roomPath).
    takeFileToOpen: (room: Room): Uint8Array | null =>
    {
        if (!RoomEditorUtil.isEditing(room))
            return null;
        const file = fileToOpen;
        fileToOpen = null;
        editedFileName = file?.name ?? NEW_ROOM_FILE_NAME;
        return file?.bytes ?? null;
    },
}

// Only an admin gets in (the server refuses anyone else).
function enter(file: {bytes: Uint8Array, name: string} | null): void
{
    if (!RoomValidationUtil.userIsAdmin(App.getUser()))
    {
        notificationMessageObservable.set("Only an admin can edit single-player rooms.");
        return;
    }
    if (SocketsClient.requestRoomChange(new RequestRoomChangeSignal(ROOM_EDITOR_SINGLE_PLAYER_MODE, false)))
        fileToOpen = file;
}

export default RoomEditorUtil;
