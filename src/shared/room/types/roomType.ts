import { EnumMap } from "../../networking/types/encodableEnum"

export type RoomType = number;

export const RoomTypeEnumMap: EnumMap =
{
    Hub: 0,
    Regular: 1,
}