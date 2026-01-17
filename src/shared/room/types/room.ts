import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import VoxelGrid from "../../voxel/types/voxelGrid";
import PersistentObjectGroup from "../../object/types/persistentObjectGroup";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableRaw4ByteNumber from "../../networking/types/encodableRaw4ByteNumber";
import SQLRoom from "../../db/types/sqlRoom";
import EncodingUtil from "../../networking/util/encodingUtil";
import { RoomType, RoomTypeEnumMap } from "./roomType";
import EncodableEnum from "../../networking/types/encodableEnum";

export default class Room extends EncodableData
{
    roomID: number;
    roomName: string;
    roomType: RoomType;
    ownerUserName: string;
    texturePackURL: string;
    voxelGrid: VoxelGrid;
    persistentObjectGroup: PersistentObjectGroup;

    constructor(roomID: number, roomName: string, roomType: RoomType, ownerUserName: string,
        texturePackURL: string,
        voxelGrid: VoxelGrid, persistentObjectGroup: PersistentObjectGroup)
    {
        super();
        this.roomID = roomID;
        this.roomName = roomName;
        this.roomType = roomType;
        this.ownerUserName = ownerUserName;
        this.texturePackURL = texturePackURL;
        this.voxelGrid = voxelGrid;
        this.persistentObjectGroup = persistentObjectGroup;
    }

    get voxelQuads(): Uint8Array
    {
        return this.voxelGrid.quadsMem.quads;
    }

    toSQL(): SQLRoom
    {
        let bufferState = EncodingUtil.startEncoding();
        this.voxelGrid.encode(bufferState);
        const voxelGridBuffer = EncodingUtil.endEncoding(bufferState);

        bufferState = EncodingUtil.startEncoding(bufferState.byteIndex);
        this.persistentObjectGroup.encode(bufferState);
        const persistentObjectGroupBuffer = EncodingUtil.endEncoding(bufferState);

        const sqlRoom: SQLRoom = {
            roomID: this.roomID,
            roomName: this.roomName,
            roomType: this.roomType,
            ownerUserName: this.ownerUserName,
            texturePackURL: this.texturePackURL,
            voxelGrid: voxelGridBuffer,
            persistentObjectGroup: persistentObjectGroupBuffer,
        };
        return sqlRoom;
    }

    static fromSQL(sqlRoom: SQLRoom): Room
    {
        const voxelGrid = VoxelGrid.decode(
            new BufferState(new Uint8Array(sqlRoom.voxelGrid))
        ) as VoxelGrid;

        const persistentObjectGroup = PersistentObjectGroup.decode(
            new BufferState(new Uint8Array(sqlRoom.persistentObjectGroup))
        ) as PersistentObjectGroup;

        return new Room(
            sqlRoom.roomID,
            sqlRoom.roomName,
            sqlRoom.roomType,
            sqlRoom.ownerUserName,
            sqlRoom.texturePackURL,
            voxelGrid,
            persistentObjectGroup
        );
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw4ByteNumber(this.roomID).encode(bufferState);
        new EncodableByteString(this.roomName).encode(bufferState);
        new EncodableEnum(this.roomType, RoomTypeEnumMap).encode(bufferState);
        new EncodableByteString(this.ownerUserName).encode(bufferState);
        new EncodableByteString(this.texturePackURL).encode(bufferState);
        this.voxelGrid.encode(bufferState);
        this.persistentObjectGroup.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableRaw4ByteNumber.decode(bufferState) as EncodableRaw4ByteNumber).n;
        const roomName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const roomType = (EncodableEnum.decodeWithParams(bufferState, RoomTypeEnumMap) as EncodableEnum).enumValue;
        const ownerUserName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const texturePackURL = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;
        const persistentObjectGroup = PersistentObjectGroup.decode(bufferState) as PersistentObjectGroup;
        return new Room(roomID, roomName, roomType, ownerUserName, texturePackURL, voxelGrid, persistentObjectGroup);
    }
}