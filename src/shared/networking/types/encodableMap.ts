import BufferState from "./bufferState";
import EncodableData from "./encodableData";
import EncodableRawByteNumber from "./encodableRawByteNumber";

let temp_elementDecodeMethod: (bufferState: BufferState) => EncodableData;

export default class EncodableMap extends EncodableData
{
    map: {[key: number]: EncodableData};

    constructor(map: {[key: number]: EncodableData})
    {
        super();
        this.map = map;
    }

    encode(bufferState: BufferState)
    {
        const keys = Object.keys(this.map).map(Number);
        if (keys.length > 255)
            throw new Error(`Too many keys in the EncodableMap :: ${JSON.stringify(keys)}`);
        new EncodableRawByteNumber(keys.length).encode(bufferState);

        for (const key of keys)
        {
            new EncodableRawByteNumber(key).encode(bufferState);
            this.map[key].encode(bufferState);
        }
    }

    static decodeWithParams(bufferState: BufferState,
        elementDecodeMethod: (bufferState: BufferState) => EncodableData): EncodableData
    {
        temp_elementDecodeMethod = elementDecodeMethod;
        return EncodableMap.decode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const length = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;

        const map: {[key: number]: EncodableData} = {};
        for (let i = 0; i < length; ++i)
        {
            const key = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
            map[key] = temp_elementDecodeMethod(bufferState);
        }
        return new EncodableMap(map);
    }
}