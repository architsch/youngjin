import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import ImageMapUtil from "../../../../../shared/graphics/image/util/imageMapUtil";
import Text from "../../basic/text";

export default function CanvasDesc(props: {selection: ObjectSelection})
{
    const go = props.selection.gameObject;
    const metadata = go.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];

    if (!metadata)
        return null;

    const imagePath = metadata ? metadata.str : "";
    const imageMetadata = ImageMapUtil.getImageMap("CanvasImageMap").getImageMetadataByPath(imagePath);
    const author = imageMetadata.author;
    const title = imageMetadata.title;

    return <div className="flex flex-row gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-gray-800 rounded-md">
        <Text content={`Title: ${title}`} size="sm" color="gray"/>
        <Text content={`Author: ${author}`} size="sm" color="gray"/>
    </div>;
}