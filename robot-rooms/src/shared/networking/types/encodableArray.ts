import BufferState from "./bufferState";
import EncodableData from "./encodableData";
import EncodableRawByteNumber from "./encodableRawByteNumber";
import EncodableRaw2ByteNumber from "./encodableRaw2ByteNumber";

let temp_elementDecodeMethod: (bufferState: BufferState) => EncodableData;
let temp_lengthLimit = 0;

export default class EncodableArray extends EncodableData
{
    arr: EncodableData[];
    lengthLimit: number;

    constructor(arr: EncodableData[], lengthLimit: number)
    {
        super();
        this.arr = arr;
        this.lengthLimit = lengthLimit;
    }

    encode(bufferState: BufferState)
    {
        if (this.arr.length > this.lengthLimit)
            console.error(`Encodable data array's length limit exceeded (length = ${this.arr.length}, lengthLimit = ${this.lengthLimit})`);
        const length = Math.min(this.arr.length, this.lengthLimit);

        if (this.lengthLimit <= 255)
            new EncodableRawByteNumber(length).encode(bufferState);
        else if (this.lengthLimit <= 65535)
            new EncodableRaw2ByteNumber(length).encode(bufferState);
        else
            throw new Error(`Length limit of ${this.lengthLimit} is not supported.`);

        for (let i = 0; i < length; ++i)
            this.arr[i].encode(bufferState);
    }

    static decodeWithParams(bufferState: BufferState,
        elementDecodeMethod: (bufferState: BufferState) => EncodableData, lengthLimit: number): EncodableData
    {
        temp_elementDecodeMethod = elementDecodeMethod;
        temp_lengthLimit = lengthLimit;
        return EncodableArray.decode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        let length = 0;
        if (temp_lengthLimit < 256)
            length = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        else if (temp_lengthLimit < 65536)
            length = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;
        else
            throw new Error(`Length limit of ${temp_lengthLimit} is not supported.`);

        const arr = new Array<EncodableData>(length);
        for (let i = 0; i < length; ++i)
            arr[i] = temp_elementDecodeMethod(bufferState);
        return new EncodableArray(arr, temp_lengthLimit);
    }
}