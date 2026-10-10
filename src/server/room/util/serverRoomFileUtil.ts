import zlib from "zlib";
import BufferState from "../../../shared/networking/types/bufferState";
import { MAX_ENCODED_OBJECTS_BYTES } from "../../../shared/networking/util/encodingUtil";
import RoomFile from "../../../shared/room/types/roomFile";
import { MAX_ENCODED_VOXEL_GRID_BYTES } from "../../../shared/system/sharedConstants";

// A room file is written through the encoding buffer (see EncodingUtil), so none is longer than it, zipped or not.
export const MAX_ROOM_FILE_BYTES = MAX_ENCODED_VOXEL_GRID_BYTES + MAX_ENCODED_OBJECTS_BYTES;

// A room file's bytes, as this side reads them (see RoomFile).
const ServerRoomFileUtil =
{
    // Throws unless the bytes are a room file this build can read. roomID: the room the objects are read into.
    decode: (fileBytes: Buffer, roomID: string): RoomFile =>
    {
        const bytes = RoomFile.isGzipped(fileBytes)
            ? zlib.gunzipSync(fileBytes, {maxOutputLength: MAX_ROOM_FILE_BYTES}) : fileBytes;
        return RoomFile.decodeWithParams(new BufferState(new Uint8Array(bytes)), roomID) as RoomFile;
    },
}

export default ServerRoomFileUtil;
