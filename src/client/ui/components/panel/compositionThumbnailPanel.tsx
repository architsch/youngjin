import App from "../../../app";
import PreEncodedCompositionIndexMap from "../../../../shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import CompositionThumbnailUtil from "../../../../shared/graphics/mesh/composition/util/compositionThumbnailUtil";
import AtlasCellSprite from "../basic/image/atlasCellSprite";
import ScrollPanel from "./scrollPanel";

// Picks one of an object type's pre-encoded appearances from their thumbnails (see
// CompositionThumbnailBuilder). An appearance canChoose refuses is shown dimmed and can't be picked.
export default function CompositionThumbnailPanel({ id, objectType, currentCompositionIndex, canChoose, onChoose,
    onClose }: Props)
{
    const compositionIndices = PreEncodedCompositionIndexMap[objectType] ?? [];
    const cellSize = CompositionThumbnailUtil.getCellSize();
    const atlasURL = `${App.getEnv().assets_url}/${CompositionThumbnailUtil.getAtlasPath(objectType)}`;

    return <ScrollPanel id={id} onClose={onClose} overhang={true} additionalClassNames="m-2">
        {compositionIndices.map((compositionIndex, position) => {
            const cell = CompositionThumbnailUtil.getCell(position);
            const choosable = canChoose?.(compositionIndex) ?? true;
            return <AtlasCellSprite
                key={`compositionThumbnail.${compositionIndex}`}
                id={id && `${id}.${position}`}
                atlasImageURL={atlasURL}
                atlasWidth={cellSize * CompositionThumbnailUtil.getNumCols(compositionIndices.length)}
                atlasHeight={cellSize * CompositionThumbnailUtil.getNumRows(compositionIndices.length)}
                atlasCellWidth={cellSize}
                atlasCellHeight={cellSize}
                atlasCellCol={cell.col}
                atlasCellRow={cell.row}
                flipRow={false}
                highlight={compositionIndex === currentCompositionIndex}
                autoScrollToHighlight={true}
                // The margin leaves room for the highlight outline inside the scrolling row.
                additionalClassNames={`relative w-16 m-1.5 shrink-0 rounded-md ${choosable ? "cursor-pointer" : ""}`}
                disabled={!choosable}
                onClick={() => onChoose(compositionIndex)}
            >
                {/* Straddles the panel's top edge, clear of the highlight outline and within ScrollPanel's overhang. */}
                <span className="absolute -top-4 right-0 size-5 flex items-center justify-center rounded-full bg-gray-900 text-[12px] leading-none text-gray-300 pointer-events-none select-none">
                    {position + 1}
                </span>
            </AtlasCellSprite>;
        })}
    </ScrollPanel>;
}

interface Props
{
    // Lets automation address the panel, and each thumbnail by its position (e.g. "lampSizeOptions.0").
    id?: string;
    objectType: string;
    currentCompositionIndex: number;
    // Absent means every one may be picked.
    canChoose?: (compositionIndex: number) => boolean;
    onChoose: (compositionIndex: number) => void;
    onClose: () => void;
}
