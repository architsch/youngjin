import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import RequestRoomChangeSignal from "../../../shared/room/types/requestRoomChangeSignal";
import Room from "../../../shared/room/types/room";
import RoomFile from "../../../shared/room/types/roomFile";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import { ROOM_EDITOR_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";
import { notificationMessageObservable } from "../../system/clientObservables";
import { tryStartClientProcess } from "../../system/types/clientProcess";
import ClientRoomFileUtil from "../../system/util/clientRoomFileUtil";
import LocalFileUtil from "../../system/util/localFileUtil";

const NEW_ROOM_FILE_NAME = `room${RoomFile.FILE_EXTENSION}`;

// The file the room editor was asked to open, which the room it is about to load is read from.
let fileToOpen: {bytes: Uint8Array, name: string} | null = null;

// What the room being edited is saved as, unless told otherwise: the file it was opened from.
let editedFileName = NEW_ROOM_FILE_NAME;

// The room editor: a single-player room an admin edits as they would a room of their own, opened empty or from
// a room file and saved as one (see @docs/networking/single_player_mode.md). Nothing of it reaches the server.
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
        enter(null);
    },
    // Enters it on a room file of the user's choosing. Has to come straight from a click (see LocalFileUtil).
    openRoomFile: async (): Promise<void> =>
    {
        const file = await LocalFileUtil.pick(RoomFile.FILE_EXTENSION);
        if (!file)
            return;

        // Read before leaving the room the user is in, so a file that isn't a room leaves them there.
        const bytes = new Uint8Array(await file.arrayBuffer());
        try
        {
            ClientRoomFileUtil.decode(bytes, ROOM_EDITOR_SINGLE_PLAYER_MODE);
        }
        catch (err)
        {
            console.error("Failed to read the file as a room.", err);
            notificationMessageObservable.set("This file can't be read as a room.");
            return;
        }
        enter({bytes, name: file.name});
    },
    // Saves the room being edited as a room file. Has to come straight from a click, likewise.
    saveRoomFile: async (): Promise<void> =>
    {
        const room = App.getCurrentRoom();
        if (!room || !RoomEditorUtil.isEditing(room))
        {
            notificationMessageObservable.set("There is no room being edited.");
            return;
        }

        try
        {
            if (await LocalFileUtil.save(await ClientRoomFileUtil.encode(room), editedFileName,
                RoomFile.FILE_EXTENSION, "Room file"))
            {
                notificationMessageObservable.set("Room saved!");
            }
        }
        catch (err)
        {
            console.error("Failed to save the room to a file.", err);
            notificationMessageObservable.set("Failed to save the room.");
        }
    },
    // Leaves the editor for whichever room the server puts the user in, and the room being edited behind.
    leave: (): void =>
    {
        if (RoomEditorUtil.isEditing() && tryStartClientProcess("roomChange", 1, 1))
            SocketsClient.emitRequestRoomChangeSignal(new RequestRoomChangeSignal("", true));
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
    if (!tryStartClientProcess("roomChange", 1, 1))
        return;
    fileToOpen = file;
    SocketsClient.emitRequestRoomChangeSignal(new RequestRoomChangeSignal(ROOM_EDITOR_SINGLE_PLAYER_MODE, false));
}

export default RoomEditorUtil;
