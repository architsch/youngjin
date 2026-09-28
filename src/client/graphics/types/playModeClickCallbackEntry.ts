import { ObjectMetadataKey } from "../../../shared/object/types/objectMetadataKey";
import PlayModeClickCallback from "./playModeClickCallback";

// One object type's play-mode clicks (see PlayModeClickCallbackMap).
export default interface PlayModeClickCallbackEntry
{
    // The metadata whose value picks the callback (e.g. a prop's ImagePath); without one, the variant is "".
    variantKey?: ObjectMetadataKey;
    callbacks: {[variant: string]: PlayModeClickCallback};
}
