import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import VoxelGrid from "../../voxel/types/voxelGrid";
import PersistentObject from "../../object/types/persistentObject";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableArray from "../../networking/types/encodableArray";

export default class Room extends EncodableData
{
    roomID: string;
    roomName: string;
    ownerUserName: string;
    texturePackURL: string;
    voxelGrid: VoxelGrid;
    persistentObjects: PersistentObject[];

    constructor(roomID: string, roomName: string, ownerUserName: string, texturePackURL: string,
        voxelGrid: VoxelGrid, persistentObjects: PersistentObject[])
    {
        super();
        this.roomID = roomID;
        this.roomName = roomName;
        this.ownerUserName = ownerUserName;
        this.texturePackURL = texturePackURL;
        this.voxelGrid = voxelGrid;
        this.persistentObjects = persistentObjects;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.roomID).encode(bufferState);
        new EncodableByteString(this.roomName).encode(bufferState);
        new EncodableByteString(this.ownerUserName).encode(bufferState);
        new EncodableByteString(this.texturePackURL).encode(bufferState);
        this.voxelGrid.encode(bufferState);
        new EncodableArray(this.persistentObjects, 65535).encode(bufferState);

    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const roomName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const ownerUserName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const texturePackURL = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;
        const persistentObjects = (EncodableArray.decodeWithParams(bufferState, PersistentObject.decode, 65535) as EncodableArray).arr as PersistentObject[];
        return new Room(roomID, roomName, ownerUserName, texturePackURL, voxelGrid, persistentObjects);
    }
}