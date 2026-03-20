import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import VoxelGrid from "../../voxel/types/voxelGrid";
import AddObjectSignal from "../../object/types/addObjectSignal";
import EncodableByteString from "../../networking/types/encodableByteString";
import { RoomType } from "./roomType";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import EncodableRaw4ByteNumber from "../../networking/types/encodableRaw4ByteNumber";
import EncodableArray from "../../networking/types/encodableArray";
import { UNDEFINED_DOCUMENT_ID_CHAR } from "../../system/sharedConstants";

export default class Room extends EncodableData
{
    id: string;
    roomType: RoomType;
    ownerUserID: string;
    texturePackPath: string;
    voxelGrid: VoxelGrid;
    objectById: {[objectId: string]: AddObjectSignal};
    lastObjectId: number;
    dirty: boolean;

    constructor(id: string | undefined, roomType: RoomType, ownerUserID: string,
        texturePackPath: string,
        voxelGrid: VoxelGrid,
        objectById: {[objectId: string]: AddObjectSignal} = {},
        lastObjectId: number = 0)
    {
        super();
        this.id = (id != undefined) ? id : "";
        this.roomType = roomType;
        this.ownerUserID = ownerUserID;
        this.texturePackPath = texturePackPath;
        this.voxelGrid = voxelGrid;
        this.objectById = objectById;
        this.lastObjectId = lastObjectId;
        this.dirty = false;
    }

    get voxelQuads(): Uint8Array
    {
        return this.voxelGrid.quadsMem.quads;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.id.length > 0 ? this.id : UNDEFINED_DOCUMENT_ID_CHAR).encode(bufferState);
        new EncodableRawByteNumber(this.roomType).encode(bufferState);
        new EncodableByteString(this.ownerUserID).encode(bufferState);
        new EncodableByteString(this.texturePackPath).encode(bufferState);
        this.voxelGrid.encode(bufferState);

        // Encode all objects (DB persistence filters to persistent-only separately in saveRoomContent)
        const allObjects = Object.values(this.objectById);
        new EncodableRaw4ByteNumber(this.lastObjectId).encode(bufferState);
        new EncodableArray(allObjects, 65535).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        let id: string | undefined = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        if (id == UNDEFINED_DOCUMENT_ID_CHAR)
            id = undefined;
        const roomType = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const ownerUserID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const texturePackPath = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;

        const lastObjectId = (EncodableRaw4ByteNumber.decode(bufferState) as EncodableRaw4ByteNumber).n;
        const objectArray = EncodableArray.decodeWithParams(bufferState, AddObjectSignal.decode, 65535) as EncodableArray;
        const objectById: {[objectId: string]: AddObjectSignal} = {};
        for (const element of objectArray.arr)
        {
            const obj = element as AddObjectSignal;
            objectById[obj.objectId] = obj;
        }

        return new Room(id, roomType, ownerUserID, texturePackPath, voxelGrid, objectById, lastObjectId);
    }
}
