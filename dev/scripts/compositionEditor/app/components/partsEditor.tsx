import PreEncodingSourceEntry from "../../../../../src/shared/graphics/mesh/composition/types/preEncodingSourceEntry";
import PreEncodingSourcePart from "../../../../../src/shared/graphics/mesh/composition/types/preEncodingSourcePart";
import FieldDomainUtil from "../util/fieldDomainUtil";
import PartEditor from "./partEditor";

const NEW_PART_GEOMETRY_ID = "Square";
const NEW_PART_MATERIAL_ID = "InstancedColor";

// The Default codec's spelled-out parts, in draw order.
export default function PartsEditor({ entry, onEdit, onPreview }: Props)
{
    const parts = entry.parts ?? [];
    const editParts = (update: (parts: PreEncodingSourcePart[]) => PreEncodingSourcePart[], coalesceKey?: string) =>
        onEdit(e => ({...e, parts: update(e.parts ?? [])}), coalesceKey);

    return <div className="parts">
        {parts.map((part, partIndex) => <PartEditor key={partIndex} part={part} partIndex={partIndex}
            partCount={parts.length}
            onChange={(update, fieldPath) => editParts(ps => replaceAt(ps, partIndex, update(ps[partIndex])),
                fieldPath && `parts.${partIndex}.${fieldPath}`)}
            onPreview={(previewPart) => onPreview(previewPart == null
                ? null : {...entry, parts: replaceAt(parts, partIndex, previewPart)})}
            onMove={(direction) => editParts(ps => swap(ps, partIndex, partIndex + direction))}
            onDuplicate={() => editParts(ps => [...ps.slice(0, partIndex + 1), structuredClone(ps[partIndex]),
                ...ps.slice(partIndex + 1)])}
            onRemove={() => editParts(ps => ps.filter((_, i) => i != partIndex))} />)}
        {parts.length == 0 && <p className="muted">No parts: this entry draws nothing.</p>}
        <button type="button" className="button small"
            onClick={() => editParts(ps => [...ps, ps.length > 0 ? structuredClone(ps[ps.length - 1])
                : FieldDomainUtil.getDefaultPart(NEW_PART_MATERIAL_ID, NEW_PART_GEOMETRY_ID)])}>
            Add part
        </button>
    </div>;
}

function replaceAt<T>(items: T[], index: number, item: T): T[]
{
    const copy = [...items];
    copy[index] = item;
    return copy;
}

function swap<T>(items: T[], i: number, j: number): T[]
{
    if (j < 0 || j >= items.length)
        return items;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
}

interface Props
{
    entry: PreEncodingSourceEntry;
    onEdit: (update: (entry: PreEncodingSourceEntry) => PreEncodingSourceEntry, coalesceKey?: string) => void;
    onPreview: (entry: PreEncodingSourceEntry | null) => void;
}
