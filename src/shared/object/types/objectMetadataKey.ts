export type ObjectMetadataKey = number;

export const ObjectMetadataKeyEnumMap: Record<string, number> =
{
    SentMessage: 0, // for objects that can send object-messages (e.g. players)
    ImageURL: 1, // for objects that are meant to display an image from the web
}