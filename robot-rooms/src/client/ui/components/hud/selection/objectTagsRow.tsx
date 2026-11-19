import Text from "../../basic/text";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import { OBJECT_TAGS_MAX_LENGTH } from "../../../../../shared/system/sharedConstants";
import ObjectMetadataTextInput from "./objectMetadataTextInput";

// The selected object's tags (see ObjectTagUtil), which a single-player room's maker gives it for the room's
// script to find it by. Shown over the object's own tools in the room editor (see ObjectSelectionMenu).
export default function ObjectTagsRow({ selection }: Props)
{
    return <div className="flex flex-row items-center gap-2 p-2 w-fit max-w-full pointer-events-auto bg-gray-800 rounded-md yj-surface-convex">
        <Text content="Tags" size="sm" additionalClassNames="px-0 whitespace-nowrap"/>
        <ObjectMetadataTextInput id="objectTagsInput" selection={selection}
            metadataKey={ObjectMetadataKeyEnumMap.Tags} maxLength={OBJECT_TAGS_MAX_LENGTH}
            filterText={text => text.replace(NON_TAGS_CHARACTERS, "")}
            placeholder="comma-separated" additionalClassNames="w-48"/>
    </div>;
}

// What the field leaves out as it is typed: anything but what tags are made of, the commas between them, and the
// spaces a list is typed with (which aren't kept).
const NON_TAGS_CHARACTERS = /[^A-Za-z0-9_\-, ]/g;

interface Props
{
    selection: ObjectSelection;
}
