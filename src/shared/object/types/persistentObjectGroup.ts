import PersistentObject from "./persistentObject";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import EncodableArray from "../../networking/types/encodableArray";

const latestVersion = 0;

export default class PersistentObjectGroup extends EncodableData
{
    persistentObjects: PersistentObject[];

    constructor(persistentObjects: PersistentObject[])
    {
        super();
        this.persistentObjects = persistentObjects;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRawByteNumber(latestVersion).encode(bufferState);
        new EncodableArray(this.persistentObjects, 65535).encode(bufferState);

        for (const persistentObject of this.persistentObjects)
            persistentObject.encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const versionFound = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        if (versionFound < latestVersion)
        {
            let data = olderVersionDecoders[versionFound](bufferState);
            for (let version = versionFound; version < latestVersion; ++version)
                data = versionConverters[version](data);
            return data;
        }

        const persistentObjects = (EncodableArray.decodeWithParams(bufferState, PersistentObject.decode, 65535) as EncodableArray).arr as PersistentObject[];
        return new PersistentObjectGroup(persistentObjects);
    }
}

const olderVersionDecoders: ((bufferState: BufferState) => EncodableData)[] = [
    (bufferState: BufferState) => { // version 0
        return new PersistentObjectGroup([]); // This is just a placeholder
    },
];

const versionConverters: ((olderVersionData: EncodableData) => EncodableData)[] = [
    (olderVersionData: EncodableData) => { // version 0 -> 1
        return new PersistentObjectGroup([]); // This is just a placeholder
    },
];