import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import VoxelGrid from "../../voxel/types/voxelGrid";
import PersistentObjectGroup from "../../object/types/persistentObjectGroup";
import EncodableByteString from "../../networking/types/encodableByteString";
import { RoomType, RoomTypeEnumMap } from "./roomType";
import EncodableEnum from "../../networking/types/encodableEnum";
import { UNDEFINED_DOCUMENT_ID_CHAR } from "../../system/sharedConstants";

export default class Room extends EncodableData
{
    id: string;
    roomName: string;
    roomType: RoomType;
    ownerUserName: string;
    texturePackPath: string;
    voxelGrid: VoxelGrid;
    persistentObjectGroup: PersistentObjectGroup;
    dirty: boolean;

    constructor(id: string | undefined, roomName: string, roomType: RoomType, ownerUserName: string,
        texturePackPath: string,
        voxelGrid: VoxelGrid, persistentObjectGroup: PersistentObjectGroup)
    {
        super();
        this.id = (id != undefined) ? id : "";
        this.roomName = roomName;
        this.roomType = roomType;
        this.ownerUserName = ownerUserName;
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
        new EncodableByteString(this.roomName).encode(bufferState);
        new EncodableEnum(this.roomType, RoomTypeEnumMap).encode(bufferState);
        new EncodableByteString(this.ownerUserName).encode(bufferState);
        new EncodableByteString(this.texturePackPath).encode(bufferState);
        this.voxelGrid.encode(bufferState);
        this.persistentObjectGroup.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        let id: string | undefined = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        if (id == UNDEFINED_DOCUMENT_ID_CHAR)
            id = undefined;
        const roomName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const roomType = (EncodableEnum.decodeWithParams(bufferState, RoomTypeEnumMap) as EncodableEnum).enumValue;
        const ownerUserName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const texturePackPath = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;
        const persistentObjectGroup = PersistentObjectGroup.decode(bufferState) as PersistentObjectGroup;
        return new Room(id, roomName, roomType, ownerUserName, texturePackPath, voxelGrid, persistentObjectGroup);
    }
}