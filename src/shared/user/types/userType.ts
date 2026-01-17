import { EnumMap } from "../../networking/types/encodableEnum"

export type UserType = number;

export const UserTypeEnumMap: EnumMap =
{
    Admin: 0,
    Member: 1,
    Guest: 2,
}