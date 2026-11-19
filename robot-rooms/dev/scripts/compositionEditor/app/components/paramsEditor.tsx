import PreEncodingSourceEntry from "../../../../../src/shared/graphics/mesh/composition/types/preEncodingSourceEntry";
import CodecField from "../types/codecField";
import FieldDomainUtil from "../util/fieldDomainUtil";
import PathUtil from "../util/pathUtil";
import FieldControl from "./fieldControl";
import FieldRow from "./fieldRow";

// A params codec's fields. The entry spells out only the ones it sets; the rest are what the codec reads
// from nothing, and are shown as such until edited.
export default function ParamsEditor({ entry, onEdit, onPreview }: Props)
{
    const fields = FieldDomainUtil.getParamsFields(entry.codecType, entry.codecVersion ?? 0);
    const params = entry.params ?? {};
    const unknownPaths = getUnknownPaths(params, fields, "");

    if (fields.length == 0 && unknownPaths.length == 0)
        return <p className="muted">This codec's fields could not be read. Edit the entry's JSON instead.</p>;

    return <div className="field-list">
        {fields.map(field => {
            const path = PathUtil.split(field.path);
            const authored = PathUtil.get(params, path);
            const isSet = authored !== undefined;
            return <FieldRow key={field.path} label={field.path} isDefault={!isSet}
                onReset={isSet ? () => onEdit(e => ({...e, params: PathUtil.remove(e.params ?? {}, path)})) : undefined}>
                <FieldControl domain={field.domain} value={isSet ? authored : field.defaultValue}
                    onChange={(value) => onEdit(e => ({...e, params: PathUtil.set(e.params ?? {}, path, value)}),
                        `params.${field.path}`)}
                    onPreview={(value) => onPreview(value === undefined
                        ? null : {...entry, params: PathUtil.set(params, path, value)})} />
            </FieldRow>;
        })}
        {unknownPaths.map(dottedPath => <FieldRow key={dottedPath} label={dottedPath} isUnknown
            onReset={() => onEdit(e => ({...e, params: PathUtil.remove(e.params ?? {}, PathUtil.split(dottedPath))}))}>
            <code className="json-value">{JSON.stringify(PathUtil.get(params, PathUtil.split(dottedPath)))}</code>
        </FieldRow>)}
    </div>;
}

// Authored values no field accounts for (a misspelling, or a field the codec has dropped), each at the
// highest level that is unknown.
function getUnknownPaths(value: any, fields: CodecField[], prefix: string): string[]
{
    if (value == undefined || typeof value != "object" || Array.isArray(value))
        return [];
    const unknownPaths: string[] = [];
    for (const key of Object.keys(value))
    {
        const path = prefix ? `${prefix}.${key}` : key;
        if (fields.some(field => field.path == path || path.startsWith(`${field.path}.`)))
            continue;
        if (fields.some(field => field.path.startsWith(`${path}.`)) && typeof value[key] == "object")
            unknownPaths.push(...getUnknownPaths(value[key], fields, path));
        else
            unknownPaths.push(path);
    }
    return unknownPaths;
}

interface Props
{
    entry: PreEncodingSourceEntry;
    onEdit: (update: (entry: PreEncodingSourceEntry) => PreEncodingSourceEntry, coalesceKey?: string) => void;
    onPreview: (entry: PreEncodingSourceEntry | null) => void;
}
