import App from "../../../app";
import PreEncodedCompositionIndexMap from "../../../../shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import CompositionThumbnailUtil from "../../../../shared/graphics/mesh/composition/util/compositionThumbnailUtil";
import AtlasCellSprite from "../basic/image/atlasCellSprite";
import ThumbnailPanel from "./thumbnailPanel";

// Picks one of an object type's pre-encoded appearances from their thumbnails (see ThumbnailPanel,
// CompositionThumbnailBuilder).
export default function CompositionThumbnailPanel({ id, objectType, currentCompositionIndex, canChoose, onChoose,
    onClose }: Props)
{
    const compositionIndices = PreEncodedCompositionIndexMap[objectType] ?? [];
    const cellSize = CompositionThumbnailUtil.getCellSize();
    const atlasURL = `${App.getEnv().assets_url}/${CompositionThumbnailUtil.getAtlasPath(objectType)}`;

    return <ThumbnailPanel
        id={id}
        choices={compositionIndices}
        current={currentCompositionIndex}
        canChoose={canChoose}
        onChoose={onChoose}
        renderThumbnail={(_, position) => {
            const cell = CompositionThumbnailUtil.getCell(position);
            return <>
                <AtlasCellSprite
                    atlasImageURL={atlasURL}
                    atlasWidth={cellSize * CompositionThumbnailUtil.getNumCols(compositionIndices.length)}
                    atlasHeight={cellSize * CompositionThumbnailUtil.getNumRows(compositionIndices.length)}
                    atlasCellWidth={cellSize}
                    atlasCellHeight={cellSize}
                    atlasCellCol={cell.col}
                    atlasCellRow={cell.row}
                    flipRow={false}
                    highlight={false}
                    autoScrollToHighlight={false}
                    additionalClassNames="w-full rounded-md"
                />
                {/* Straddles the panel's top edge, clear of the highlight outline and within ScrollPanel's overhang. */}
                <span className="absolute -top-4 right-0 size-5 flex items-center justify-center rounded-full bg-gray-900 text-[12px] leading-none text-gray-300 pointer-events-none select-none">
                    {position + 1}
                </span>
            </>;
        }}
        thumbnailClassNames="relative w-16"
        overhang={true}
        onClose={onClose}
    />;
}

interface Props
{
    // Lets automation address the panel, and each thumbnail by its position (e.g. "lampSizeOptions.0"). Panels
    // choosing the same thing share one.
    id: string;
    objectType: string;
    // Absent when nothing is chosen yet (e.g. for an object about to be added).
    currentCompositionIndex?: number;
    // Absent means every one may be picked.
    canChoose?: (compositionIndex: number) => boolean;
    onChoose: (compositionIndex: number) => void;
    onClose: () => void;
}
