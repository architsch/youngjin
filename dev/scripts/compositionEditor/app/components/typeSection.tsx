import PreEncodingSourceEntry from "../../../../../src/shared/graphics/mesh/composition/types/preEncodingSourceEntry";
import EntryEncoding from "../types/entryEncoding";
import TypeThumbnails from "../types/typeThumbnails";
import EntryCard from "./entryCard";

// One object type's entries, in the order its chooser lists them.
export default function TypeSection({ objectType, compositionIndices, compositions, encodings, thumbnails, isIndexedType,
    thumbnailSize, selectedIndex, onSelect, onAdd }: Props)
{
    return <section className="type-section">
        <header className="type-section-header">
            <h2>{objectType}</h2>
            <span className="type-section-count">
                {compositionIndices.length} {compositionIndices.length == 1 ? "entry" : "entries"}
            </span>
            {!isIndexedType && <span className="type-section-problem">not an object type with indexed looks</span>}
            {thumbnails?.error != undefined && <span className="type-section-problem">Drawing failed: {thumbnails.error}</span>}
            {isIndexedType && <button type="button" className="button small" onClick={() => onAdd(objectType)}
                title={`Append a new ${objectType} entry at the end of the file (a copy of its last one)`}>
                Add
            </button>}
        </header>
        <div className="entry-grid">
            {compositionIndices.map(compositionIndex => {
                const encoding = encodings[compositionIndex];
                return <EntryCard key={compositionIndex}
                    compositionIndex={compositionIndex}
                    entry={compositions[compositionIndex]}
                    encoding={encoding}
                    bitmap={encoding.encoded != undefined ? thumbnails?.bitmapByEncoded.get(encoding.encoded) : undefined}
                    size={thumbnailSize}
                    selected={compositionIndex == selectedIndex}
                    onSelect={onSelect} />;
            })}
            {compositionIndices.length == 0 && <p className="type-section-empty">No entries yet.</p>}
        </div>
    </section>;
}

interface Props
{
    objectType: string;
    compositionIndices: number[];
    compositions: PreEncodingSourceEntry[];
    encodings: EntryEncoding[];
    thumbnails?: TypeThumbnails;
    isIndexedType: boolean;
    thumbnailSize: number;
    selectedIndex: number;
    onSelect: (compositionIndex: number) => void;
    onAdd: (objectType: string) => void;
}
