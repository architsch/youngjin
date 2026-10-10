import App from "../../../app";
import RoomFile from "../../../../shared/room/types/roomFile";
import RoomAPIClient from "../../../networking/client/roomAPIClient";
import ClientRoomFileUtil from "../../../system/util/clientRoomFileUtil";
import LocalFileUtil from "../../../system/util/localFileUtil";
import { notificationMessageObservable } from "../../../system/clientObservables";
import { tryStartClientProcess, endClientProcess } from "../../../system/types/clientProcess";
import PopupUtil from "../../util/popupUtil";
import Text from "../basic/text";
import IconButton from "../input/iconButton";
import FloppyDiskIcon from "../../svg/icons/floppyDiskIcon";
import OpenFolderIcon from "../../svg/icons/openFolderIcon";
import ScrollPanel from "./scrollPanel";
import RoomEditorUtil from "../../../singlePlayer/util/roomEditorUtil";

// Room file panel (see CustomizeRoomPanel): one button saves the room to a file, the other loads a file
// over the room (see RoomFile).
export default function RoomFilePanel({ anchorElementId, onClose }: Props)
{
    return <ScrollPanel id="roomFileOptions" anchorElementId={anchorElementId} onClose={onClose}>
        <div className={COLUMN_CLASS_NAMES}>
            <div className="flex flex-row items-center gap-1.5">
                <Text content="Save Room as a File" size="sm" additionalClassNames="px-0 whitespace-nowrap"/>
                <IconButton id="saveRoomFileButton" icon={<FloppyDiskIcon/>} size="sm" onClick={saveRoomFile}/>
            </div>
            <div className="flex flex-row items-center gap-1.5">
                <Text content="Load Room from a File" size="sm" additionalClassNames="px-0 whitespace-nowrap"/>
                <IconButton id="loadRoomFileButton" icon={<OpenFolderIcon/>} size="sm" onClick={confirmLoadingRoomFile}/>
            </div>
        </div>
    </ScrollPanel>;
}

// One action per line, right-aligned so the buttons line up.
const COLUMN_CLASS_NAMES = "flex flex-col items-end gap-1 shrink-0";

const ROOM_FILE_EXTENSION = RoomFile.FILE_EXTENSION;

// Written from the room as this client holds it, with no trip to the server.
async function saveRoomFile()
{
    const room = App.getCurrentRoom();
    if (!room)
        return;
    // (The room editor names its file after the one it opened.)
    if (RoomEditorUtil.isEditing(room))
    {
        await RoomEditorUtil.saveRoomFile();
        return;
    }

    try
    {
        const bytes = await ClientRoomFileUtil.encode(room);
        if (await LocalFileUtil.save(bytes, `${room.id}${ROOM_FILE_EXTENSION}`, ROOM_FILE_EXTENSION, "Room file"))
            notificationMessageObservable.set("Room saved!");
    }
    catch (err)
    {
        console.error("Failed to save the room to a file.", err);
        notificationMessageObservable.set("Failed to save the room.");
    }
}

function confirmLoadingRoomFile()
{
    PopupUtil.openPopup({
        popupType: "confirm",
        params: {
            message: "This room's data will be overwritten. Do you really want to proceed?",
            onConfirm: () => {
                PopupUtil.closePopup();
                loadRoomFile();
            },
            onCancel: PopupUtil.closePopup,
        },
    });
}

// The server does the overwriting, and sends the room again to everyone in it (see
// ServerRoomManager.loadRoomFile). The room editor's room is no server's, and is opened afresh on the file instead.
async function loadRoomFile()
{
    if (RoomEditorUtil.isEditing())
    {
        await RoomEditorUtil.openRoomFile();
        return;
    }

    const roomID = App.getCurrentRoom()?.id;
    const file = await LocalFileUtil.pick(ROOM_FILE_EXTENSION);
    if (!file || roomID == undefined)
        return;

    if (!tryStartClientProcess("roomFileLoad", 1, 0))
        return;
    try
    {
        const response = await RoomAPIClient.loadRoomFile(file, roomID);
        if (response.status >= 200 && response.status < 300)
            notificationMessageObservable.set("Room loaded!");
        else if (response.status == 400 || response.status == 413)
            notificationMessageObservable.set("This file can't be read as a room.");
        else
            notificationMessageObservable.set("Failed to load the room.");
    }
    finally
    {
        endClientProcess("roomFileLoad");
    }
}

interface Props
{
    anchorElementId: string; // DOM element id of the toggle the panel hangs from (see ScrollPanel)
    onClose: () => void;
}
