import BufferState from "./bufferState";
import EncodableData from "./encodableData";

let temp_enumMap: EnumMap = {};

export default class EncodableEnum extends EncodableData
{
    enumValue: number;
    enumMap: EnumMap;

    constructor(enumValue: number, enumMap: EnumMap)
    {
        super();
        this.enumValue = enumValue;
        this.enumMap = enumMap;
    }

    encode(bufferState: BufferState)
    {
        bufferState.view[bufferState.byteIndex++] = this.enumMap[this.enumValue];
    }

    static decodeWithParams(bufferState: BufferState, enumMap: EnumMap): EncodableData
    {
        temp_enumMap = enumMap;
        return EncodableEnum.decode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        return new EncodableEnum(
            temp_enumMap[bufferState.view[bufferState.byteIndex++]], temp_enumMap
        );
    }
}

export type EnumMap = {[key: string]: number};