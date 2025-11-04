import PersistentObject from "../types/persistentObject";

const metadataArray: string[] = [];

const PersistentObjectEncoding =
{
    encode: (persistentObjects: PersistentObject[]): ArrayBuffer =>
    {
        let numBytesRequired = 0;
        for (const object of persistentObjects)
            numBytesRequired += 4 + object.metadata.length; // 4 Main Bytes for each PersistentObject. + An arbitrary number of Metadata Bytes.

        const bufferState = { view: new Uint8Array(numBytesRequired), index: 0 };
        for (const object of persistentObjects)
            encodePersistentObject(object, bufferState);

        const buffer = bufferState.view.buffer;
        return buffer;
    },
    decode: (encodedPersistentObjects: ArrayBuffer): PersistentObject[] =>
    {
        const bufferState = { view: new Uint8Array(encodedPersistentObjects), index: 0};
        
        const objects = new Array<PersistentObject>();

        while (bufferState.index < bufferState.view.length)
            objects.push(decodePersistentObject(bufferState));
        return objects;
    },
}

function encodePersistentObject(object: PersistentObject, bufferState: { view: Uint8Array, index: number })
{
    if (object.objectTypeIndex < 0 || object.objectTypeIndex > 63)
        throw new Error(`Object type index out of range (objectTypeIndex = ${object.objectTypeIndex})`);
    if (object.x < 0 || object.x > 32)
        throw new Error(`Object x out of range (x = ${object.x})`);
    if (object.z < 0 || object.z > 32)
        throw new Error(`Object z out of range (z = ${object.z})`);
    if (object.y < 0 || object.y > 4)
        throw new Error(`Object y out of range (y = ${object.y})`);
    if (object.metadata.length > 255)
        throw new Error(`Object metadata length out of range (length = ${object.metadata.length})`);

    bufferState.view[bufferState.index++] = (object.objectTypeIndex << 2) | (
        (object.direction == "+z") ? 0b00 : (
            (object.direction == "+x") ? 0b01 : (
                (object.direction == "-z") ? 0b10 : 0b11
            )
        )
    );

    const yRaw = Math.floor(4 * object.y);
    const yRawFirstHalf = (yRaw & 0b1100) >> 2;
    const yRawSecondHalf = (yRaw & 0b0011);
    bufferState.view[bufferState.index++] = (Math.floor(2 * object.x) << 2 | yRawFirstHalf);
    bufferState.view[bufferState.index++] = (Math.floor(2 * object.z) << 2 | yRawSecondHalf);

    bufferState.view[bufferState.index++] = object.metadata.length;
}

function decodePersistentObject(bufferState: { view: Uint8Array, index: number }): PersistentObject
{
    const mainByte1 = bufferState.view[bufferState.index++];
    const objectTypeIndex = (mainByte1 >> 2) & 0b111111;
    const directionRaw = (mainByte1 & 0b11);
    const direction = (directionRaw <= 1)
        ? ((directionRaw == 0) ? "+z" : "+x")
        : ((directionRaw == 2) ? "-z" : "-x");

    const mainByte2 = bufferState.view[bufferState.index++];
    const xRaw = (mainByte2 >> 2) & 0b111111;
    const x = 0.5 * xRaw;
    const yRawFirstHalf = (mainByte2 & 0b11);

    const mainByte3 = bufferState.view[bufferState.index++];
    const zRaw = (mainByte3 >> 2) & 0b111111;
    const z = 0.5 * zRaw;
    const yRawSecondHalf = (mainByte3 & 0b11);

    const yRaw = (yRawFirstHalf << 2) | yRawSecondHalf;
    const y = 0.25 * yRaw;

    const mainByte4 = bufferState.view[bufferState.index++];
    const metadataLength = mainByte4;
    metadataArray.length;
    for (let i = 0; i < metadataLength; ++i)
        metadataArray.push(String.fromCharCode(bufferState.view[bufferState.index++]));
    
    const metadata = metadataArray.join("");
    const objectId = `p${x}-${y}-${z}`;

    return { objectId, objectTypeIndex, direction, x, y, z, metadata };
}

//------------------------------------------------------------------------------
// Each PersistentObject's Binary-Encoded Format:
//------------------------------------------------------------------------------
//
// Layout: [Main Byte 1][Main Byte 2][Main Byte 3][Main Byte 4][Metadata Byte][Metadata Byte][Metadata Byte]...
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
// [Main Byte 4]
//     8 bits for the number of metadata bytes (i.e. number of characters)
//
// [Metadata Byte]
//     8 bits for each metadata character's character code value
//------------------------------------------------------------------------------

export default PersistentObjectEncoding;