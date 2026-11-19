import BufferState from "./bufferState";
import EncodableByteString from "./encodableByteString";
import EncodableData from "./encodableData";
import EncodableRawByteNumber from "./encodableRawByteNumber";
import EncodableRaw2ByteNumber from "./encodableRaw2ByteNumber";

type MapKeyType = "number" | "string";

let temp_elementDecodeMethod: (bufferState: BufferState) => EncodableData;
let temp_keyType: MapKeyType = "number";
let temp_lengthLimit = 255;

export default class EncodableMap extends EncodableData
{
    map: Record<string | number, EncodableData>;
    keyType: MapKeyType;
    lengthLimit: number;

    constructor(map: Record<string | number, EncodableData>,
        keyType: MapKeyType = "number", lengthLimit: number = 255)
    {
        super();
        this.map = map;
        this.keyType = keyType;
        this.lengthLimit = lengthLimit;
    }

    encode(bufferState: BufferState)
    {
        const keys = Object.keys(this.map);
        if (keys.length > this.lengthLimit)
            throw new Error(`Too many keys in the EncodableMap :: ${JSON.stringify(keys)}`);
        const length = Math.min(keys.length, this.lengthLimit);

        if (this.lengthLimit <= 255)
            new EncodableRawByteNumber(length).encode(bufferState);
        else if (this.lengthLimit <= 65535)
            new EncodableRaw2ByteNumber(length).encode(bufferState);
        else
            throw new Error(`Length limit of ${this.lengthLimit} is not supported.`);

        for (const key of keys)
        {
            if (this.keyType === "number")
                new EncodableRawByteNumber(Number(key)).encode(bufferState);
            else
                new EncodableByteString(key).encode(bufferState);
            this.map[key].encode(bufferState);
        }
    }

    static decodeWithParams(bufferState: BufferState,
        elementDecodeMethod: (bufferState: BufferState) => EncodableData,
        keyType: MapKeyType = "number", lengthLimit: number = 255): EncodableData
    {
        temp_elementDecodeMethod = elementDecodeMethod;
        temp_keyType = keyType;
        temp_lengthLimit = lengthLimit;
        return EncodableMap.decode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        let length = 0;
        if (temp_lengthLimit <= 255)
            length = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        else if (temp_lengthLimit <= 65535)
            length = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;
        else
            throw new Error(`Length limit of ${temp_lengthLimit} is not supported.`);

        const map: Record<string | number, EncodableData> = {};
        for (let i = 0; i < length; ++i)
        {
            let key: string | number;
            if (temp_keyType === "number")
                key = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
            else
                key = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
            map[key] = temp_elementDecodeMethod(bufferState);
        }
        return new EncodableMap(map, temp_keyType, temp_lengthLimit);
    }
}
