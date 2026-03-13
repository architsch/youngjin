import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import VoxelGrid from "../../voxel/types/voxelGrid";
import PersistentObjectGroup from "../../object/types/persistentObjectGroup";
import EncodableByteString from "../../networking/types/encodableByteString";
import { RoomType } from "./roomType";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import { UNDEFINED_DOCUMENT_ID_CHAR } from "../../system/sharedConstants";

export default class Room extends EncodableData
{
    id: string;
    roomType: RoomType;
    ownerUserID: string;
    texturePackPath: string;
    voxelGrid: VoxelGrid;
    persistentObjectGroup: PersistentObjectGroup;
    dirty: boolean;

    constructor(id: string | undefined, roomType: RoomType, ownerUserID: string,
        texturePackPath: string,
        voxelGrid: VoxelGrid, persistentObjectGroup: PersistentObjectGroup)
    {
        super();
        this.id = (id != undefined) ? id : "";
        this.roomType = roomType;
        this.ownerUserID = ownerUserID;
        this.texturePackPath = texturePackPath;
        this.voxelGrid = voxelGrid;
        this.persistentObjectGroup = persistentObjectGroup;
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
        this.persistentObjectGroup.encode(bufferState);
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
        const persistentObjectGroup = PersistentObjectGroup.decode(bufferState) as PersistentObjectGroup;
        return new Room(id, roomType, ownerUserID, texturePackPath, voxelGrid, persistentObjectGroup);
    }
}