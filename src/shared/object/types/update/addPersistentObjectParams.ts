import BufferState from "../../../networking/types/bufferState";
import EncodableData from "../../../networking/types/encodableData";
import EncodableRawByteNumber from "../../../networking/types/encodableRawByteNumber";
import EncodableMap from "../../../networking/types/encodableMap";
import EncodableByteString from "../../../networking/types/encodableByteString";
import { PERSISTENT_OBJ_TASK_TYPE_ADD } from "../../../system/sharedConstants";
import { ObjectMetadata } from "../objectMetadata";
import UpdatePersistentObjectGroupTaskParams from "./updatePersistentObjectGroupTaskParams";
import { Dir4 } from "../../../math/types/dir4";
import DirUtil from "../../../math/util/dirUtil";

export default class AddPersistentObjectParams extends UpdatePersistentObjectGroupTaskParams
{
    objectTypeIndex: number;
    dir: Dir4;
    x: number;
    y: number;
    z: number;
    metadata: ObjectMetadata;
    objectId: string; // Assigned by server, empty when sent from client

    constructor(objectTypeIndex: number, dir: Dir4, x: number, y: number, z: number, metadata: ObjectMetadata = {}, objectId: string = "")
    {
        super(PERSISTENT_OBJ_TASK_TYPE_ADD);
        this.objectTypeIndex = objectTypeIndex;
        this.dir = dir;
        this.x = x;
        this.y = y;
        this.z = z;
        this.metadata = metadata;
        this.objectId = objectId;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.objectId).encode(bufferState);
        new EncodableRawByteNumber((this.objectTypeIndex << 2) | DirUtil.dir4ToNumber(this.dir)).encode(bufferState);
        const yRaw = Math.floor(4 * this.y);
        const yRawFirstHalf = (yRaw & 0b1100) >> 2;
        const yRawSecondHalf = (yRaw & 0b0011);
        new EncodableRawByteNumber((Math.floor(2 * this.x) << 2) | yRawFirstHalf).encode(bufferState);
        new EncodableRawByteNumber((Math.floor(2 * this.z) << 2) | yRawSecondHalf).encode(bufferState);
        new EncodableMap(this.metadata).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;

        const mainByte1 = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const objectTypeIndex = (mainByte1 >> 2) & 0b111111;
        const dir = DirUtil.numberToDir4(mainByte1 & 0b11);

        const mainByte2 = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const x = 0.5 * ((mainByte2 >> 2) & 0b111111);
        const yRawFirstHalf = mainByte2 & 0b11;

        const mainByte3 = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const z = 0.5 * ((mainByte3 >> 2) & 0b111111);
        const yRawSecondHalf = mainByte3 & 0b11;
        const y = 0.25 * ((yRawFirstHalf << 2) | yRawSecondHalf);

        const metadata = (EncodableMap.decodeWithParams(bufferState, EncodableByteString.decode) as EncodableMap).map as ObjectMetadata;

        return new AddPersistentObjectParams(objectTypeIndex, dir, x, y, z, metadata, objectId);
    }
}
