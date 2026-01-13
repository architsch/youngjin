import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import VoxelGrid from "../../voxel/types/voxelGrid";
import PersistentObjectGroup from "../../object/types/persistentObjectGroup";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableRaw4ByteNumber from "../../networking/types/encodableRaw4ByteNumber";

export default class Room extends EncodableData
{
    roomID: number;
    roomName: string;
    ownerUserName: string;
    texturePackURL: string;
    voxelGrid: VoxelGrid;
    persistentObjectGroup: PersistentObjectGroup;

    constructor(roomID: number, roomName: string, ownerUserName: string, texturePackURL: string,
        voxelGrid: VoxelGrid, persistentObjectGroup: PersistentObjectGroup)
    {
        super();
        this.roomID = roomID;
        this.roomName = roomName;
        this.ownerUserName = ownerUserName;
        this.texturePackURL = texturePackURL;
        this.voxelGrid = voxelGrid;
        this.persistentObjectGroup = persistentObjectGroup;
    }

    get voxelQuads(): Uint8Array
    {
        return this.voxelGrid.quadsMem.quads;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw4ByteNumber(this.roomID).encode(bufferState);
        new EncodableByteString(this.roomName).encode(bufferState);
        new EncodableByteString(this.ownerUserName).encode(bufferState);
        new EncodableByteString(this.texturePackURL).encode(bufferState);
        this.voxelGrid.encode(bufferState);
        this.persistentObjectGroup.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const roomID = (EncodableRaw4ByteNumber.decode(bufferState) as EncodableRaw4ByteNumber).n;
        const roomName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const ownerUserName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const texturePackURL = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const voxelGrid = VoxelGrid.decode(bufferState) as VoxelGrid;
        const persistentObjectGroup = PersistentObjectGroup.decode(bufferState) as PersistentObjectGroup;
        return new Room(roomID, roomName, ownerUserName, texturePackURL, voxelGrid, persistentObjectGroup);
    }
}