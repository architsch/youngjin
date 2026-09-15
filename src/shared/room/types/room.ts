import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import VoxelGrid from "../../voxel/types/voxelGrid";
import AddObjectSignal from "../../object/types/addObjectSignal";
import EncodableByteString from "../../networking/types/encodableByteString";
import { RoomType, RoomTypeEnumMap } from "./roomType";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import { UNDEFINED_DOCUMENT_ID_CHAR } from "../../system/sharedConstants";
import ObjectGroup from "../../object/types/objectGroup";
import VoxelQuadsRuntimeMemory from "../../voxel/types/voxelQuadsRuntimeMemory";

let temp_participantUserNameByID: { [userID: string]: string } = {};

export default class Room extends EncodableData
{
    id: string;
    roomName: string; // (roomName == singlePlayerMode) if the room is a singleplayer room.
    roomType: RoomType;
    ownerUserID: string;
    ownerUserName: string;
    texturePackPath: string;
    prefs: string; // The room's atmosphere, as a handful of characters (see RoomPrefsUtil).
    voxelGrid: VoxelGrid;
    objectGroup: ObjectGroup;
    dirty: boolean;

    constructor(id: string | undefined, roomName: string, roomType: RoomType,
        ownerUserID: string,
        ownerUserName: string,
        texturePackPath: string,
        prefs: string,
        voxelGrid: VoxelGrid,
        objectGroup: ObjectGroup)
    {
        super();
        this.id = (id != undefined) ? id : "";
        this.roomName = roomName;
        this.roomType = roomType;
        this.ownerUserID = ownerUserID;
        this.ownerUserName = ownerUserName;
        this.texturePackPath = texturePackPath;
        this.prefs = prefs;
        this.voxelGrid = voxelGrid;
        this.objectGroup = objectGroup;
        this.dirty = false;
    }

    get objectById(): {[objectId: string]: AddObjectSignal}
    {
        return this.objectGroup.objectById;
    }

    get voxelQuads(): Uint8Array
    {
        return this.voxelGrid.quadsMem.quads;
    }

    encodeWithParams(bufferState: BufferState, participantUserNameByID: { [userID: string]: string })
    {
        temp_participantUserNameByID = participantUserNameByID;
        this.encode(bufferState);
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.id.length > 0 ? this.id : UNDEFINED_DOCUMENT_ID_CHAR).encode(bufferState);
        new EncodableByteString(this.roomName).encode(bufferState);
        new EncodableRawByteNumber(this.roomType).encode(bufferState);
        new EncodableByteString(this.ownerUserID).encode(bufferState);
        new EncodableByteString(this.ownerUserName).encode(bufferState);
        new EncodableByteString(this.texturePackPath).encode(bufferState);
        // Encoded before the branch: single-player rooms have prefs too.
        new EncodableByteString(this.prefs).encode(bufferState);

        // Single-player rooms carry no content (the client regenerates it); roomType tells the decoder to
        // skip it.
        if (this.roomType != RoomTypeEnumMap.SinglePlayer)
        {
            this.voxelGrid.encode(bufferState);
            this.objectGroup.encodeWithParams(bufferState, temp_participantUserNameByID);
        }
    }

    static decode(bufferState: BufferState): EncodableData
    {
        let id: string = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        if (id == UNDEFINED_DOCUMENT_ID_CHAR)
            throw new Error("ID of the room being decoded is undefined.");
        const roomName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const roomType = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const ownerUserID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const ownerUserName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const texturePackPath = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const prefs = (EncodableByteString.decode(bufferState) as EncodableByteString).str;

        // Single-player: empty placeholders; the client generates the content.
        let voxelGrid: VoxelGrid;
        let objectGroup: ObjectGroup;
        if (roomType != RoomTypeEnumMap.SinglePlayer)
        {
            voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;
            // The grid version dates the objects (see ObjectGroupVersionMigration).
            objectGroup = ObjectGroup.decodeWithParams(bufferState, id,
                voxelGrid.sourceFormatVersion) as ObjectGroup;
        }
        else
        {
            voxelGrid = new VoxelGrid([], new VoxelQuadsRuntimeMemory());
            objectGroup = new ObjectGroup([]);
        }

        return new Room(id, roomName, roomType, ownerUserID, ownerUserName, texturePackPath, prefs,
            voxelGrid, objectGroup);
    }
}
