import BufferState from "./bufferState";
import EncodableData from "./encodableData";

export default class EncodableByteString extends EncodableData
{
    str: string;

    constructor(str: string)
    {
        super();
        this.str = str;
    }

    encode(bufferState: BufferState)
    {
        for (let i = 0; i < this.str.length; ++i)
        {
            let code = this.str.charCodeAt(i);
            if (code < 0 || code > 255)
            {
                console.error(`Char code is out of the 8-bit range (code = ${code}, string = ${this.str}, index = ${i})`);
                code = "?".charCodeAt(0);
            }
            bufferState.view[bufferState.index++] = code;
        }
        bufferState.view[bufferState.index++] = 0; // null character (to mark the end of the string)
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const decodedChars: string[] = [];
        let code: number;
        while (bufferState.index < bufferState.view.length &&
            (code = bufferState.view[bufferState.index++]) != 0) // scan until you hit the null character (which marks the end of the string)
        {
            decodedChars.push(String.fromCharCode(code));
        }
        return new EncodableByteString(decodedChars.join(""));
    }
}