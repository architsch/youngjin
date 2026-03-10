import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData";
import EncodableByteString from "../../networking/types/encodableByteString";
import { ObjectMetadata } from "./objectMetadata";
import EncodableMap from "../../networking/types/encodableMap";
import { Dir4 } from "../../math/types/dir4";
import DirUtil from "../../math/util/dirUtil";
import PhysicsCollisionUtil from "../../physics/util/physicsCollisionUtil";
import { ColliderInfo } from "../../physics/types/colliderInfo";

export default class PersistentObject extends EncodableData
{
    objectId: string;
    objectTypeIndex: number;
    dir: Dir4;
    x: number;
    y: number;
    z: number;
    metadata: ObjectMetadata;

    constructor(objectId: string, objectTypeIndex: number, dir: Dir4,
        x: number, y: number, z: number, metadata: ObjectMetadata = {})
    {
        super();
        this.objectId = objectId;
        this.objectTypeIndex = objectTypeIndex;
        this.dir = dir;
        this.x = x;
        this.y = y;
        this.z = z;
        this.metadata = metadata;
    }

    getColliderInfo(): ColliderInfo | undefined
    {
        return PhysicsCollisionUtil.getColliderInfo(this.objectTypeIndex,
            DirUtil.dir4ToVec3(this.dir),
            {x: this.x, y: this.y, z: this.z});
    }

    encode(bufferState: BufferState)
    {
        if (this.objectId.length == 0)
            throw new Error(`ObjectId is empty (objectId = ${this.objectId})`);
        if (this.objectTypeIndex < 0 || this.objectTypeIndex > 63)
            throw new Error(`Object type index out of range (objectTypeIndex = ${this.objectTypeIndex})`);
        if (this.x < 0 || this.x > 32)
            throw new Error(`Object x out of range (x = ${this.x})`);
        if (this.z < 0 || this.z > 32)
            throw new Error(`Object z out of range (z = ${this.z})`);
        if (this.y < 0 || this.y > 4)
            throw new Error(`Object y out of range (y = ${this.y})`);

        new EncodableByteString(this.objectId).encode(bufferState);

        bufferState.view[bufferState.byteIndex++] =
            (this.objectTypeIndex << 2) | DirUtil.dir4ToNumber(this.dir);
        const yRaw = Math.floor(4 * this.y);
        const yRawFirstHalf = (yRaw & 0b1100) >> 2;
        const yRawSecondHalf = (yRaw & 0b0011);
        bufferState.view[bufferState.byteIndex++] = (Math.floor(2 * this.x) << 2 | yRawFirstHalf);
        bufferState.view[bufferState.byteIndex++] = (Math.floor(2 * this.z) << 2 | yRawSecondHalf);

        new EncodableMap(this.metadata).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;

        const mainByte1 = bufferState.view[bufferState.byteIndex++];
        const objectTypeIndex = (mainByte1 >> 2) & 0b111111;
        const dirNumber = (mainByte1 & 0b11);
        const dir = DirUtil.numberToDir4(dirNumber);

        const mainByte2 = bufferState.view[bufferState.byteIndex++];
        const xRaw = (mainByte2 >> 2) & 0b111111;
        const x = 0.5 * xRaw;
        const yRawFirstHalf = (mainByte2 & 0b11);

        const mainByte3 = bufferState.view[bufferState.byteIndex++];
        const zRaw = (mainByte3 >> 2) & 0b111111;
        const z = 0.5 * zRaw;
        const yRawSecondHalf = (mainByte3 & 0b11);
        const yRaw = (yRawFirstHalf << 2) | yRawSecondHalf;
        const y = 0.25 * yRaw;

        const metadata = (EncodableMap.decodeWithParams(bufferState, EncodableByteString.decode) as EncodableMap).map as ObjectMetadata;

        return new PersistentObject(objectId, objectTypeIndex, dir, x, y, z, metadata);
    }
}

//------------------------------------------------------------------------------
// Each PersistentObject's Binary-Encoded Format:
//------------------------------------------------------------------------------
//
// Layout: [ObjectId Byte String][Main Byte 1][Main Byte 2][Main Byte 3][Metadata]...
//
// [Main Byte 1]
//     6 bits for the object's type index
//     2 bits for the object's direction
//         (00 => +z, 01 => +x, 10 => -z, 11 => -x)
//
// [Main Byte 2]
//     6 bits for the x-coordinate of the object's center position
//         (binary value = floor(2 * x))
//     first 2 bits of the y-coordinate of the object's bottom position
//         (4-bit binary value = floor(4 * y))
//
// [Main Byte 3]
//     6 bits for the z-coordinate of the object's center position
//         (binary value = floor(2 * z))
//     second 2 bits of the y-coordinate of the object's bottom position
//         (4-bit binary value = floor(4 * y))
//
//------------------------------------------------------------------------------