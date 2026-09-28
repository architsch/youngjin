import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import PlayModeClickCallbackEntry from "../../graphics/types/playModeClickCallbackEntry";

// What clicking an object does in play mode, by object type, when the click doesn't select it (see
// GameObject.onClick). A variant that stops existing (e.g. a deleted prop image) is caught by the tests.
const PlayModeClickCallbackMap: {[objectType: string]: PlayModeClickCallbackEntry} =
{
    Prop: {
        variantKey: ObjectMetadataKeyEnumMap.ImagePath,
        callbacks: {
        },
    },
};

export default PlayModeClickCallbackMap;
