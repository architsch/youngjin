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
    voxelGrid: VoxelGrid;
    objectGroup: ObjectGroup;
    dirty: boolean;

    constructor(id: string | undefined, roomName: string, roomType: RoomType,
        ownerUserID: string,
        ownerUserName: string,
        texturePackPath: string,
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

        // Single-player rooms carry no content on the wire: they are a shared template the client
        // regenerates locally from RoomGenerationUtil/SinglePlayerModeConfigMap. Their roomType
        // (already encoded above) is the discriminator the decoder uses to skip the content fields.
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

        // Single-player rooms omit their content on the wire (see encode); reconstruct empty
        // placeholders here and let the client generate the real voxels/objects locally.
        let voxelGrid: VoxelGrid;
        let objectGroup: ObjectGroup;
        if (roomType != RoomTypeEnumMap.SinglePlayer)
        {
            voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;
            objectGroup = ObjectGroup.decodeWithParams(bufferState, id) as ObjectGroup;
        }
        else
        {
            voxelGrid = new VoxelGrid([], new VoxelQuadsRuntimeMemory());
            objectGroup = new ObjectGroup([]);
        }

        return new Room(id, roomName, roomType, ownerUserID, ownerUserName, texturePackPath, voxelGrid, objectGroup);
    }
}
