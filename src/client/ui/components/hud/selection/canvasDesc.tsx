import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import ImageMapUtil from "../../../../../shared/graphics/image/util/imageMapUtil";
import Text from "../../basic/text";
import useMouseDragScroll from "../../../util/mouseDragScroll";

export default function CanvasDesc(props: {selection: ObjectSelection})
{
    const onRefChange = useMouseDragScroll("horizontal", "alwaysGrab");

    const go = props.selection.gameObject;
    const metadata = go.params.metadata[ObjectMetadataKeyEnumMap.ImagePath];

    if (!metadata)
        return null;

    const imagePath = metadata ? metadata.str : "";
    const imageMetadata = ImageMapUtil.getImageMap("CanvasImageMap").getImageMetadataByPath(imagePath);
    const author = imageMetadata.author;
    const title = imageMetadata.title;

    // A long title or author name is not truncated: the panel stays within the screen and the text
    // runs past its edge, to be scrolled through sideways (by drag on a mouse, by swipe on touch).
    return <div ref={onRefChange} className="flex flex-row gap-2 p-2 w-fit max-w-full pointer-events-auto overflow-x-auto no-scrollbar bg-gray-800 rounded-md yj-surface-convex">
        <Text content={`Title: ${title}`} size="sm" color="gray" additionalClassNames="shrink-0 whitespace-nowrap"/>
        <Text content={`Author: ${author}`} size="sm" color="gray" additionalClassNames="shrink-0 whitespace-nowrap"/>
    </div>;
}