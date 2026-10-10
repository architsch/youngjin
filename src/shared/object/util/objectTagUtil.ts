import Room from "../../room/types/room";
import { OBJECT_TAGS_MAX_LENGTH } from "../../system/sharedConstants";
import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadata } from "../types/objectMetadata";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";

const SEPARATOR = ",";

// What a tag isn't made of: anything but letters, digits, "_" and "-".
const NON_TAG_CHARACTERS = /[^A-Za-z0-9_-]/g;

// An object's Tags: keywords a room's scripts find it by (see @docs/networking/single_player_mode.md), so that
// they name what a thing is for instead of where it stands. Stored as one comma-separated string.
const ObjectTagUtil =
{
    // Each tag stripped of what a tag isn't made of, in the order given, without empty ones or repeats, and as
    // many of them as fit the length a tags string may have.
    canonicalize: (rawTags: string): string =>
    {
        const tags: string[] = [];
        let length = 0;
        for (const rawTag of rawTags.split(SEPARATOR))
        {
            const tag = rawTag.replace(NON_TAG_CHARACTERS, "");
            if (tag.length == 0 || tags.includes(tag))
                continue;
            length += tag.length + ((tags.length > 0) ? SEPARATOR.length : 0);
            if (length > OBJECT_TAGS_MAX_LENGTH)
                break;
            tags.push(tag);
        }
        return tags.join(SEPARATOR);
    },
    // Of an object, or of metadata not yet applied to one ({metadata}).
    getTags: (obj: {metadata: ObjectMetadata}): string[] =>
    {
        const tags = obj.metadata[ObjectMetadataKeyEnumMap.Tags]?.str ?? "";
        return (tags.length > 0) ? tags.split(SEPARATOR) : [];
    },
    hasTag: (obj: {metadata: ObjectMetadata}, tag: string): boolean =>
    {
        return ObjectTagUtil.getTags(obj).includes(tag);
    },
    // The first of the room's objects carrying the tag, in the order the room holds them.
    findObject: (room: Room, tag: string): AddObjectSignal | undefined =>
    {
        return Object.values(room.objectById).find(obj => ObjectTagUtil.hasTag(obj, tag));
    },
}

export default ObjectTagUtil;
