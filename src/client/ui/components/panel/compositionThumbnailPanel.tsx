import App from "../../../app";
import PreEncodedCompositionIndexMap from "../../../../shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import CompositionThumbnailUtil from "../../../../shared/graphics/mesh/composition/util/compositionThumbnailUtil";
import AtlasCellSprite from "../basic/image/atlasCellSprite";
import ScrollPanel from "./scrollPanel";

// Picks one of an object type's pre-encoded appearances from their thumbnails (see
// CompositionThumbnailBuilder).
export default function CompositionThumbnailPanel({ id, objectType, currentCompositionIndex, onChoose, onClose }: Props)
{
    const compositionIndices = PreEncodedCompositionIndexMap[objectType] ?? [];
    const cellSize = CompositionThumbnailUtil.getCellSize();
    const atlasURL = `${App.getEnv().assets_url}/${CompositionThumbnailUtil.getAtlasPath(objectType)}`;

    return <ScrollPanel id={id} onClose={onClose} additionalClassNames="m-2">
        {compositionIndices.map((compositionIndex, position) => {
            const cell = CompositionThumbnailUtil.getCell(position);
            return <AtlasCellSprite
                key={`compositionThumbnail.${compositionIndex}`}
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
                additionalClassNames="w-16 m-1.5 shrink-0 rounded-md cursor-pointer"
                onClick={() => onChoose(compositionIndex)}
            />;
        })}
    </ScrollPanel>;
}

interface Props
{
    id?: string;
    objectType: string;
    currentCompositionIndex: number;
    onChoose: (compositionIndex: number) => void;
    onClose: () => void;
}
