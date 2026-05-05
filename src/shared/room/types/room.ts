import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import VoxelGrid from "../../voxel/types/voxelGrid";
import AddObjectSignal from "../../object/types/addObjectSignal";
import EncodableByteString from "../../networking/types/encodableByteString";
import { RoomType } from "./roomType";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import { UNDEFINED_DOCUMENT_ID_CHAR } from "../../system/sharedConstants";
import ObjectGroup from "../../object/types/objectGroup";

let temp_participantUserNameByID: { [userID: string]: string } = {};

export default class Room extends EncodableData
{
    id: string;
    roomType: RoomType;
    ownerUserID: string;
    ownerUserName: string;
    texturePackPath: string;
    voxelGrid: VoxelGrid;
    objectGroup: ObjectGroup;
    dirty: boolean;

    constructor(id: string | undefined, roomType: RoomType, ownerUserID: string,
        ownerUserName: string,
        texturePackPath: string,
        voxelGrid: VoxelGrid,
        objectGroup: ObjectGroup)
    {
        super();
        this.id = (id != undefined) ? id : "";
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
        new EncodableRawByteNumber(this.roomType).encode(bufferState);
        new EncodableByteString(this.ownerUserID).encode(bufferState);
        new EncodableByteString(this.ownerUserName).encode(bufferState);
        new EncodableByteString(this.texturePackPath).encode(bufferState);
        this.voxelGrid.encode(bufferState);
        this.objectGroup.encodeWithParams(bufferState, temp_participantUserNameByID);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        let id: string = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        if (id == UNDEFINED_DOCUMENT_ID_CHAR)
            throw new Error("ID of the room being decoded is undefined.");
        const roomType = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const ownerUserID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const ownerUserName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const texturePackPath = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;
        const objectGroup = ObjectGroup.decodeWithParams(bufferState, id) as ObjectGroup;

        return new Room(id, roomType, ownerUserID, ownerUserName, texturePackPath, voxelGrid, objectGroup);
    }
}
