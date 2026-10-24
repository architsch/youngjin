/**
 * Writes an object group in the body layout of a version before the current one: the owner count in one
 * byte (two from FIRST_TWO_BYTE_SOURCE_USER_COUNT_VERSION on), and before FIRST_SCALED_TRANSFORM_VERSION a
 * transform that stops after its facing, carrying no scale. Migration tests need real older bytes, which
 * stamping a version byte onto a current body no longer produces (see
 * ObjectGroupVersionMigration.decodeTransform and decodeSourceUserCount).
 */
import BufferState from "../../../src/shared/networking/types/bufferState";
import Encodable2ByteVec3 from "../../../src/shared/networking/types/encodable2ByteVec3";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import EncodableMap from "../../../src/shared/networking/types/encodableMap";
import EncodableRaw2ByteNumber from "../../../src/shared/networking/types/encodableRaw2ByteNumber";
import EncodableRawByteNumber from "../../../src/shared/networking/types/encodableRawByteNumber";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectGroup from "../../../src/shared/object/types/objectGroup";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";

// The last version whose transforms carried no scale.
export const LAST_UNSCALED_OBJECT_GROUP_VERSION = 3;
// The first whose owner count took two bytes.
const FIRST_TWO_BYTE_SOURCE_USER_COUNT_VERSION = 8;

export function writeLegacyObjectGroup(writeState: BufferState, objects: AddObjectSignal[],
    version: number)
{
    if (version >= ObjectGroup.latestFormatVersion)
        throw new Error(`writeLegacyObjectGroup :: Not an older version (version = ${version})`);
    const sourceUserIDs = [...new Set(objects.map(object => object.sourceUserID))];

    new EncodableRawByteNumber(version).encode(writeState);
    if (version >= FIRST_TWO_BYTE_SOURCE_USER_COUNT_VERSION)
        new EncodableRaw2ByteNumber(sourceUserIDs.length).encode(writeState);
    else
        new EncodableRawByteNumber(sourceUserIDs.length).encode(writeState);
    for (const sourceUserID of sourceUserIDs)
    {
        new EncodableByteString(sourceUserID).encode(writeState);
        new EncodableByteString(
            objects.find(object => object.sourceUserID == sourceUserID)!.sourceUserName)
            .encode(writeState);
    }

    new EncodableRaw2ByteNumber(objects.length).encode(writeState);
    for (const object of objects)
    {
        new EncodableRaw2ByteNumber(sourceUserIDs.indexOf(object.sourceUserID)).encode(writeState);
        new EncodableRawByteNumber(object.objectTypeIndex).encode(writeState);
        new EncodableByteString(object.objectId).encode(writeState);
        if (version > LAST_UNSCALED_OBJECT_GROUP_VERSION)
            object.transform.encode(writeState);
        else
            writeLegacyTransform(writeState, object.transform);
        new EncodableMap(object.metadata).encode(writeState);
    }
}

function writeLegacyTransform(writeState: BufferState, transform: ObjectTransform)
{
    const bounds = ObjectTransform.encodableBounds;
    new Encodable2ByteVec3(transform.pos, 0, bounds.maxX, 0, bounds.maxY, 0, bounds.maxZ)
        .encode(writeState);
    new Encodable2ByteVec3(transform.dir, -1, 1, -1, 1, -1, 1).encode(writeState);
}
