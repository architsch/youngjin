import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import PreEncodingSourceEntry from "../../../../../src/shared/graphics/mesh/composition/types/preEncodingSourceEntry";
import EntryEncoding from "../types/entryEncoding";
import EntryJsonEditor from "./entryJsonEditor";
import ParamsEditor from "./paramsEditor";
import PartsEditor from "./partsEditor";
import ThumbnailCanvas from "./thumbnailCanvas";

const LARGE_PREVIEW_SIZE = 256;
const IN_GAME_PREVIEW_SIZE = 64; // what CompositionThumbnailPanel shows
// An entry is never indexed itself (see PreEncodingSourceUtil).
const CODEC_TYPES = Object.keys(InstancedMeshCompositionCodecTypeEnumMap).filter(codecType => codecType != "Indexed");
const DEFAULT_CODEC_TYPE = "Default";

// The selected entry: how it draws, why it may fail to, and every field it authors.
export default function EntryInspector({ compositionIndex, entry, encoding, bitmap, positionInType, countInType,
    objectTypes, canMoveEarlier, canMoveLater, onEdit, onPreview, onDuplicate, onDelete, onMove }: Props)
{
    const takesParts = entry.codecType == DEFAULT_CODEC_TYPE;

    const changeCodecType = (codecType: string) => onEdit(e => {
        const {params, parts, ...rest} = e;
        return (codecType == DEFAULT_CODEC_TYPE)
            ? {...rest, codecType, parts: parts ?? []}
            : {...rest, codecType, params: (e.codecType == codecType) ? params : {}};
    });

    return <div className="inspector-body">
        <header className="inspector-header">
            <span className="inspector-index">#{compositionIndex}</span>
            <div className="inspector-heading">
                <span className="inspector-type">{entry.objectType}</span>
                {positionInType >= 0 && <span className="muted">
                    look {positionInType + 1} of {countInType} in its chooser
                </span>}
            </div>
        </header>

        <div className="preview-row">
            <div className="preview">
                <span className="thumb-well large" style={{width: LARGE_PREVIEW_SIZE, height: LARGE_PREVIEW_SIZE}}>
                    {encoding.error == undefined && <ThumbnailCanvas bitmap={bitmap} size={LARGE_PREVIEW_SIZE} />}
                    {encoding.error != undefined && <span className="thumb-error">Fails to encode</span>}
                </span>
            </div>
            <div className="preview">
                <span className="thumb-well" style={{width: IN_GAME_PREVIEW_SIZE, height: IN_GAME_PREVIEW_SIZE}}>
                    {encoding.error == undefined && <ThumbnailCanvas bitmap={bitmap} size={IN_GAME_PREVIEW_SIZE} />}
                </span>
                <span className="preview-label">in-game size</span>
            </div>
        </div>

        {encoding.error != undefined && <div className="notice error">
            <strong>The build will refuse this entry.</strong> {encoding.error}
        </div>}
        {encoding.warnings.length > 0 && <div className="notice warning">
            <strong>The build logs:</strong>
            <ul>{[...new Set(encoding.warnings)].map(warning => <li key={warning}>{warning}</li>)}</ul>
        </div>}

        <div className="inspector-section">
            <label className="stacked-label">
                <span className="field-label-text">comment</span>
                <textarea className="textarea" data-native-undo rows={3} value={entry.comment ?? ""}
                    onChange={(event) => {
                        const comment = event.target.value;
                        onEdit(e => {
                            const {comment: _, ...rest} = e;
                            return comment == "" ? rest : {comment, ...rest};
                        }, "comment");
                    }} />
            </label>
            <div className="inline-fields">
                <label className="stacked-label">
                    <span className="field-label-text">objectType</span>
                    <select className="select" value={entry.objectType}
                        onChange={(event) => onEdit(e => ({...e, objectType: event.target.value}))}>
                        {!objectTypes.includes(entry.objectType) && <option value={entry.objectType}>{entry.objectType} (unknown)</option>}
                        {objectTypes.map(objectType => <option key={objectType} value={objectType}>{objectType}</option>)}
                    </select>
                </label>
                <label className="stacked-label">
                    <span className="field-label-text">codecType</span>
                    <select className="select" value={entry.codecType} onChange={(event) => changeCodecType(event.target.value)}>
                        {!CODEC_TYPES.includes(entry.codecType) && <option value={entry.codecType}>{entry.codecType} (unknown)</option>}
                        {CODEC_TYPES.map(codecType => <option key={codecType} value={codecType}>{codecType}</option>)}
                    </select>
                </label>
                <label className="stacked-label narrow">
                    <span className="field-label-text">codecVersion</span>
                    <input type="number" className="text-input" min={0} step={1} placeholder="0"
                        value={entry.codecVersion ?? ""}
                        onChange={(event) => onEdit(e => withCodecVersion(e,
                            event.target.value == "" ? undefined : Number(event.target.value)), "codecVersion")} />
                </label>
            </div>
        </div>

        <div className="inspector-section">
            <h3>{takesParts ? "Parts" : "Params"}</h3>
            {takesParts
                ? <PartsEditor entry={entry} onEdit={onEdit} onPreview={onPreview} />
                : <ParamsEditor entry={entry} onEdit={onEdit} onPreview={onPreview} />}
        </div>

        <div className="inspector-section">
            <h3>Encoded</h3>
            {encoding.encoded != undefined
                ? <code className="encoded">{JSON.stringify(encoding.encoded)}</code>
                : <p className="muted">Nothing: the entry fails to encode.</p>}
            <EntryJsonEditor entry={entry} onEdit={onEdit} />
        </div>

        <div className="inspector-actions">
            <button type="button" className="button" onClick={onDuplicate}
                title="Append a copy at the end of the file">Duplicate</button>
            <button type="button" className="button" disabled={!canMoveEarlier} onClick={() => onMove(-1)}
                title="Swap with the previous entry of this type">Move earlier</button>
            <button type="button" className="button" disabled={!canMoveLater} onClick={() => onMove(1)}
                title="Swap with the next entry of this type">Move later</button>
            <button type="button" className="button danger" onClick={onDelete}>Delete</button>
        </div>
    </div>;
}

// Kept beside codecType, where the source spells it.
function withCodecVersion(entry: PreEncodingSourceEntry, codecVersion: number | undefined): PreEncodingSourceEntry
{
    const {comment, objectType, codecType, codecVersion: _, ...rest} = entry;
    return {
        ...(comment != undefined ? {comment} : {}),
        objectType,
        codecType,
        ...(codecVersion != undefined && Number.isFinite(codecVersion) ? {codecVersion} : {}),
        ...rest,
    };
}

interface Props
{
    compositionIndex: number;
    entry: PreEncodingSourceEntry;
    encoding: EntryEncoding;
    bitmap?: ImageBitmap;
    positionInType: number;
    countInType: number;
    objectTypes: string[];
    canMoveEarlier: boolean;
    canMoveLater: boolean;
    onEdit: (update: (entry: PreEncodingSourceEntry) => PreEncodingSourceEntry, coalesceKey?: string) => void;
    onPreview: (entry: PreEncodingSourceEntry | null) => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onMove: (direction: -1 | 1) => void;
}
