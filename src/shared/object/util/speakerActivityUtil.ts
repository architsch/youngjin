import AddObjectSignal from "../types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../types/objectMetadataKey";
import { SpeakerActivity, SpeakerActivityEnumMap } from "../types/speakerActivity";

const activities = Object.values(SpeakerActivityEnumMap);

const SpeakerActivityUtil =
{
    get: (obj: AddObjectSignal): SpeakerActivity =>
    {
        return obj.metadata[ObjectMetadataKeyEnumMap.Activity]?.str ?? SpeakerActivityEnumMap.None;
    },
    // Whether it shows in place of the speaker's words, rather than beside them.
    replacesWords: (activity: SpeakerActivity): boolean =>
    {
        return activity == SpeakerActivityEnumMap.Editing || activity == SpeakerActivityEnumMap.Reading;
    },
    canonicalize: (rawValue: string): SpeakerActivity =>
    {
        const activity = rawValue.trim();
        return activities.includes(activity) ? activity : SpeakerActivityEnumMap.None;
    },
}

export default SpeakerActivityUtil;
