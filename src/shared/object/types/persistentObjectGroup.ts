import PersistentObject from "./persistentObject";
import BufferState from "../../networking/types/bufferState";
import EncodableData from "../../networking/types/encodableData"
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import EncodableRaw4ByteNumber from "../../networking/types/encodableRaw4ByteNumber";
import EncodableMap from "../../networking/types/encodableMap";

const latestVersion = 0;

export default class PersistentObjectGroup extends EncodableData
{
    persistentObjectById: {[objectId: string]: PersistentObject};
    lastPersistentObjectId: number;

    constructor(persistentObjectById: {[objectId: string]: PersistentObject}, lastPersistentObjectId: number = 0)
    {
        super();
        this.persistentObjectById = persistentObjectById;
        this.lastPersistentObjectId = lastPersistentObjectId;
    }

    encode(bufferState: BufferState)
    {
        new EncodableRawByteNumber(latestVersion).encode(bufferState);
        new EncodableRaw4ByteNumber(this.lastPersistentObjectId).encode(bufferState);
        new EncodableMap(this.persistentObjectById, "string", 65535).encode(bufferState);
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

        const lastPersistentObjectId = (EncodableRaw4ByteNumber.decode(bufferState) as EncodableRaw4ByteNumber).n;
        const persistentObjectById = (EncodableMap.decodeWithParams(bufferState, PersistentObject.decode, "string", 65535) as EncodableMap).map as {[objectId: string]: PersistentObject};

        // Fix up objectIds from map keys (PersistentObject.decode uses a placeholder)
        for (const [key, po] of Object.entries(persistentObjectById))
            po.objectId = key;

        return new PersistentObjectGroup(persistentObjectById, lastPersistentObjectId);
    }
}

const olderVersionDecoders: ((bufferState: BufferState) => EncodableData)[] = [
    (bufferState: BufferState) => { // version 0
        return new PersistentObjectGroup({}); // This is just a placeholder
    },
];

const versionConverters: ((olderVersionData: EncodableData) => EncodableData)[] = [
    (olderVersionData: EncodableData) => { // version 0 -> 1
        return new PersistentObjectGroup({}); // This is just a placeholder
    },
];
