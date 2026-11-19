import App from "../../app";
import RoomFile from "../../../shared/room/types/roomFile";
import RoomAPIClient from "../../networking/client/roomAPIClient";
import RoomPreviewUtil from "../../graphics/preview/util/roomPreviewUtil";
import ClientRoomFileUtil from "./clientRoomFileUtil";
import LocalFileUtil from "./localFileUtil";
import { notificationMessageObservable } from "../clientObservables";
import { tryStartClientProcess, endClientProcess } from "../types/clientProcess";
import PopupUtil from "../../ui/util/popupUtil";
import RoomEditorUtil from "../../singlePlayer/util/roomEditorUtil";

const ROOM_FILE_EXTENSION = RoomFile.FILE_EXTENSION;

// The most a file's picture may take of the window (the width as RoomFilePreviewForm caps it), and of the screen's
// pixels for each of its own: no more than a CSS pixel's, since an overview needs no finer and is cheaper for it.
const PREVIEW_MAX_WIDTH_PX = 1024;
const PREVIEW_MAX_WINDOW_WIDTH_SHARE = 0.8;
const PREVIEW_MAX_WINDOW_HEIGHT_SHARE = 0.55;
const PREVIEW_MAX_PIXEL_RATIO = 1;

// Asked in place of the picture, if that can't be drawn.
const OVERWRITE_MESSAGE = "This room's data will be overwritten. Do you really want to proceed?";

// The room as a file on the user's own machine (see RoomFile, RoomFilePanel): saved as one, or loaded from one over
// the room. Each comes straight from a click, as LocalFileUtil has to be called.
const LocalRoomFileUtil =
{
    // Written from the room as this client holds it, with no trip to the server.
    saveRoomFile: async (): Promise<void> =>
    {
        const room = App.getCurrentRoom();
        if (!room)
            return;
        // (The room editor names its file after the one it opened.)
        const fileName = RoomEditorUtil.isEditing(room)
            ? RoomEditorUtil.getEditedFileName() : `${room.id}${ROOM_FILE_EXTENSION}`;

        try
        {
            const bytes = await ClientRoomFileUtil.encode(room);
            if (await LocalFileUtil.save(bytes, fileName, ROOM_FILE_EXTENSION, "Room file"))
                notificationMessageObservable.set("Room saved!");
        }
        catch (err)
        {
            console.error("Failed to save the room to a file.", err);
            notificationMessageObservable.set("Failed to save the room.");
        }
    },
    // Straight from the click, as picking a file has to be (see LocalFileUtil). Nothing is overwritten yet: the file
    // is read here, and the user asked over a picture of the room it holds (see RoomFilePreviewForm).
    previewRoomFile: async (): Promise<void> =>
    {
        const room = App.getCurrentRoom();
        const file = await LocalFileUtil.pick(ROOM_FILE_EXTENSION);
        if (!file || !room)
            return;

        if (!tryStartClientProcess("roomFilePreview", 1, 0))
            return;
        let bytes: Uint8Array;
        let preview: {image: ImageData, width: number} | undefined;
        try
        {
            bytes = new Uint8Array(await file.arrayBuffer());
            let roomFile: RoomFile;
            try
            {
                // Read into the room it is to be loaded over, so that what its objects take from their room looks
                // as it will there (see ObjectTypeConfig's generateDefaultParts).
                roomFile = ClientRoomFileUtil.decode(bytes, room.id);
            }
            catch (err)
            {
                console.error("Failed to read the file as a room.", err);
                notificationMessageObservable.set("This file can't be read as a room.");
                return;
            }
            preview = await drawPreview(roomFile);
        }
        finally
        {
            endClientProcess("roomFilePreview");
        }

        const onConfirm = () => {
            PopupUtil.closePopup();
            loadRoomFile(room.id, file, bytes);
        };
        PopupUtil.openPopup(preview
            ? {popupType: "roomFilePreview", params: {...preview, onConfirm, onCancel: PopupUtil.closePopup}}
            : {popupType: "confirm", params: {message: OVERWRITE_MESSAGE, onConfirm, onCancel: PopupUtil.closePopup}});
    },
}

// The picture of a file's room, and how wide to show it. Nothing if it can't be drawn.
async function drawPreview(roomFile: RoomFile): Promise<{image: ImageData, width: number} | undefined>
{
    const pixelRatio = Math.min(window.devicePixelRatio, PREVIEW_MAX_PIXEL_RATIO);
    const maxWidth = Math.min(PREVIEW_MAX_WIDTH_PX, PREVIEW_MAX_WINDOW_WIDTH_SHARE * window.innerWidth);
    const maxHeight = PREVIEW_MAX_WINDOW_HEIGHT_SHARE * window.innerHeight;
    try
    {
        const image = await RoomPreviewUtil.render(roomFile, maxWidth, maxHeight, pixelRatio);
        return {image, width: image.width / pixelRatio};
    }
    catch (err)
    {
        console.error("Failed to draw the room file's preview.", err);
        return undefined;
    }
}

// The server does the overwriting, and sends the room again to everyone in it (see
// ServerRoomManager.loadRoomFile). The room editor's room is no server's, and is opened afresh on the file instead.
async function loadRoomFile(roomID: string, file: File, bytes: Uint8Array)
{
    if (RoomEditorUtil.isEditing())
    {
        RoomEditorUtil.openRoomFile(bytes, file.name);
        return;
    }

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

export default LocalRoomFileUtil;
