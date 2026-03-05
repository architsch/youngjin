import { EnumMap } from "../../networking/types/encodableEnum"

export type UserRole = number;

export const UserRoleEnumMap: EnumMap =
{
    Owner: 0,
    Editor: 1,
    Visitor: 2,
}
