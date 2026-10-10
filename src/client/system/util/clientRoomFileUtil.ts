import { gunzipSync } from "fflate";
import BufferState from "../../../shared/networking/types/bufferState";
import EncodingUtil from "../../../shared/networking/util/encodingUtil";
import Room from "../../../shared/room/types/room";
import RoomFile from "../../../shared/room/types/roomFile";

// A room file's bytes, as this side writes and reads them (see RoomFile).
const ClientRoomFileUtil =
{
    // The room as a room file: gzipped, as a room's blocks repeat (see Voxel) and the file comes to a small
    // fraction of them, or plain where the browser can't.
    encode: async (room: Room): Promise<ArrayBuffer> =>
    {
        const bufferState = EncodingUtil.startEncoding();
        RoomFile.fromRoom(room).encode(bufferState);
        const bytes = EncodingUtil.endEncoding(bufferState);
        if (typeof CompressionStream == "undefined")
            return bytes;
        return await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
    },
    // Throws unless the bytes are a room file this build can read. roomID: the room the objects are read into.
    decode: (fileBytes: Uint8Array, roomID: string): RoomFile =>
    {
        const bytes = RoomFile.isGzipped(fileBytes) ? gunzipSync(fileBytes) : fileBytes;
        return RoomFile.decodeWithParams(new BufferState(bytes), roomID) as RoomFile;
    },
}

export default ClientRoomFileUtil;
