import { EnumMap } from "../../networking/types/encodableEnum"

export type ObjectMetadataKey = number;

export const ObjectMetadataKeyEnumMap: EnumMap =
{
    SentMessage: 0, // for objects that can send object-messages (e.g. players)
    DestinationRoomID: 1, // for doors that are connected to other rooms
    ImageURL: 2, // for objects that are meant to display an image from the web
}