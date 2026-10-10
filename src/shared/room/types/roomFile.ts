import BufferState from "../../networking/types/bufferState";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableData from "../../networking/types/encodableData";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import ObjectGroup from "../../object/types/objectGroup";
import VoxelGrid from "../../voxel/types/voxelGrid";
import Room from "./room";

let temp_roomID = "";

// Also dates the settings, which carry no version of their own (see DBRoomVersionMigration).
const latestVersion = 0;

// What every room file starts with, so a file of another kind is refused before it is read as a room.
const SIGNATURE = "ThingsPoolRoom";

// How a gzip stream starts, which a room file's bytes are told from a plain one's by.
const GZIP_MAGIC_BYTES = [0x1f, 0x8b];

// A room saved to a file, to be loaded over a room later (see ServerRoomManager.loadRoomFile) or played in
// (see RoomMap): its contents as they are stored (see DBRoomUtil), then its settings. It names no room, so any
// can take it. The file itself holds these bytes gzipped, or plain: each side unzips with what it has (see
// ClientRoomFileUtil, ServerRoomFileUtil).
export default class RoomFile extends EncodableData
{
    // What a room file's name ends in.
    static readonly FILE_EXTENSION = ".room";

    static isGzipped(fileBytes: Uint8Array): boolean
    {
        return GZIP_MAGIC_BYTES.every((byte, i) => fileBytes[i] == byte);
    }

    voxelGrid: VoxelGrid;
    objectGroup: ObjectGroup;
    texturePackPath: string;
    prefs: string;

    constructor(voxelGrid: VoxelGrid, objectGroup: ObjectGroup, texturePackPath: string, prefs: string)
    {
        super();
        this.voxelGrid = voxelGrid;
        this.objectGroup = objectGroup;
        this.texturePackPath = texturePackPath;
        this.prefs = prefs;
    }

    // Only the objects that persist are the room's to save, so its players are left out.
    static fromRoom(room: Room): RoomFile
    {
        const persistentObjects = Object.values(room.objectById)
            .filter(obj => ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).persistent);
        return new RoomFile(room.voxelGrid, new ObjectGroup(persistentObjects),
            room.texturePackPath, room.prefs);
    }

    encode(bufferState: BufferState)
    {
        for (let i = 0; i < SIGNATURE.length; ++i)
            bufferState.view[bufferState.byteIndex++] = SIGNATURE.charCodeAt(i);
        new EncodableRawByteNumber(latestVersion).encode(bufferState);

        this.voxelGrid.encode(bufferState);
        this.objectGroup.encode(bufferState);
        new EncodableByteString(this.texturePackPath).encode(bufferState);
        new EncodableByteString(this.prefs).encode(bufferState);
    }

    // roomID: the room the objects are read into.
    static decodeWithParams(bufferState: BufferState, roomID: string): EncodableData
    {
        temp_roomID = roomID;
        return RoomFile.decode(bufferState);
    }

    // Throws unless the bytes are one whole room file this build can read: what it returns overwrites a
    // room, and the decoders below read anything they are given.
    static decode(bufferState: BufferState): EncodableData
    {
        for (let i = 0; i < SIGNATURE.length; ++i)
        {
            if (bufferState.view[bufferState.byteIndex++] != SIGNATURE.charCodeAt(i))
                throw new Error("RoomFile :: The signature is missing.");
        }
        const versionFound = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        if (versionFound > latestVersion)
            throw new Error(`RoomFile :: Written in a newer format (version = ${versionFound}, latest = ${latestVersion})`);

        // Older contents are converted as they are read, by their own versions.
        const voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;
        if (voxelGrid.sourceFormatVersion > VoxelGrid.latestFormatVersion)
            throw new Error(`RoomFile :: Voxels written in a newer format (version = ${voxelGrid.sourceFormatVersion})`);
        const objectGroup = ObjectGroup.decodeWithParams(bufferState, temp_roomID, voxelGrid) as ObjectGroup;
        if (objectGroup.sourceFormatVersion > ObjectGroup.latestFormatVersion)
            throw new Error(`RoomFile :: Objects written in a newer format (version = ${objectGroup.sourceFormatVersion})`);

        const texturePackPath = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const prefs = (EncodableByteString.decode(bufferState) as EncodableByteString).str;

        if (bufferState.byteIndex != bufferState.view.length)
            throw new Error(`RoomFile :: Length doesn't match the content (read = ${bufferState.byteIndex}, length = ${bufferState.view.length})`);

        return new RoomFile(voxelGrid, objectGroup, texturePackPath, prefs);
    }
}
