import { memo } from "react";
import PreEncodingSourceEntry from "../../../../../src/shared/graphics/mesh/composition/types/preEncodingSourceEntry";
import EntryEncoding from "../types/entryEncoding";
import EntryUtil from "../util/entryUtil";
import ThumbnailCanvas from "./thumbnailCanvas";

// Captions only fit under the larger thumbnails.
const MIN_CAPTIONED_SIZE = 96;

function EntryCard({ compositionIndex, entry, encoding, bitmap, size, selected, onSelect }: Props)
{
    const caption = EntryUtil.getCaption(entry);
    const problem = encoding.error ?? encoding.warnings[0];
    return <button type="button" className={`entry-card${selected ? " selected" : ""}`}
        onClick={() => onSelect(compositionIndex)} title={problem ?? entry.comment ?? ""}
        aria-pressed={selected} data-composition-index={compositionIndex}>
        <span className="thumb-well" style={{width: size, height: size}}>
            {encoding.error == undefined && <ThumbnailCanvas bitmap={bitmap} size={size} />}
            <span className="index-badge">#{compositionIndex}</span>
            {encoding.error != undefined && <span className="thumb-error">Fails to encode</span>}
            {encoding.error == undefined && encoding.warnings.length > 0 && <span className="warning-badge">!</span>}
        </span>
        {size >= MIN_CAPTIONED_SIZE && <span className="caption" style={{width: size}}>{caption || " "}</span>}
    </button>;
}

export default memo(EntryCard);

interface Props
{
    compositionIndex: number;
    entry: PreEncodingSourceEntry;
    encoding: EntryEncoding;
    bitmap?: ImageBitmap;
    size: number;
    selected: boolean;
    onSelect: (compositionIndex: number) => void;
}
