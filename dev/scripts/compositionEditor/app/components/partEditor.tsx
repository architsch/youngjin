import PreEncodingSourcePart from "../../../../../src/shared/graphics/mesh/composition/types/preEncodingSourcePart";
import { GEOMETRY_ID_BY_CODE, MATERIAL_CODE_BY_ID } from "../../../../../src/shared/system/sharedConstants";
import FieldDomainUtil from "../util/fieldDomainUtil";
import FieldValueUtil from "../util/fieldValueUtil";
import PathUtil from "../util/pathUtil";
import FieldControl from "./fieldControl";
import FieldRow from "./fieldRow";

const MATERIAL_IDS = Object.keys(MATERIAL_CODE_BY_ID);

// One spelled-out part. Its material decides which fields it has.
export default function PartEditor({ part, partIndex, partCount, onChange, onPreview, onMove, onDuplicate, onRemove }: Props)
{
    const fields = MATERIAL_IDS.includes(part.materialId) ? FieldDomainUtil.getPartFields(part.materialId) : [];

    return <div className="part-card">
        <div className="part-header">
            <span className="part-title">Part {partIndex + 1}</span>
            <div className="part-actions">
                <button type="button" className="icon-button" disabled={partIndex == 0} onClick={() => onMove(-1)}
                    title="Move earlier (a later square overlapping it is lifted above it)" aria-label="Move earlier">↑</button>
                <button type="button" className="icon-button" disabled={partIndex == partCount - 1} onClick={() => onMove(1)}
                    title="Move later" aria-label="Move later">↓</button>
                <button type="button" className="icon-button" onClick={onDuplicate} title="Duplicate this part"
                    aria-label="Duplicate">⧉</button>
                <button type="button" className="icon-button danger" onClick={onRemove} title="Remove this part"
                    aria-label="Remove">×</button>
            </div>
        </div>
        <div className="field-list">
            <FieldRow label="geometryId">
                <select className="select" value={part.geometryId}
                    onChange={(event) => onChange(p => ({...p, geometryId: event.target.value}))}>
                    {!GEOMETRY_ID_BY_CODE.includes(part.geometryId) && <option value={part.geometryId}>{part.geometryId} (unknown)</option>}
                    {GEOMETRY_ID_BY_CODE.map(geometryId => <option key={geometryId} value={geometryId}>{geometryId}</option>)}
                </select>
            </FieldRow>
            <FieldRow label="materialId">
                <select className="select" value={part.materialId}
                    onChange={(event) => onChange(p => FieldValueUtil.conformPartToMaterial(p, event.target.value))}>
                    {!MATERIAL_IDS.includes(part.materialId) && <option value={part.materialId}>{part.materialId} (unknown)</option>}
                    {MATERIAL_IDS.map(materialId => <option key={materialId} value={materialId}>{materialId}</option>)}
                </select>
            </FieldRow>
            {fields.map(field => {
                const path = PathUtil.split(field.path);
                return <FieldRow key={field.path} label={field.path}>
                    <FieldControl domain={field.domain} value={PathUtil.get(part, path)} allowIndeterminate={true}
                        onChange={(value) => onChange(p => PathUtil.set(p, path, value), field.path)}
                        onPreview={(value) => onPreview(value === undefined ? null : PathUtil.set(part, path, value))} />
                </FieldRow>;
            })}
        </div>
    </div>;
}

interface Props
{
    part: PreEncodingSourcePart;
    partIndex: number;
    partCount: number;
    onChange: (update: (part: PreEncodingSourcePart) => PreEncodingSourcePart, coalesceKey?: string) => void;
    onPreview: (part: PreEncodingSourcePart | null) => void;
    onMove: (direction: -1 | 1) => void;
    onDuplicate: () => void;
    onRemove: () => void;
}
