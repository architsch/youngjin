import { useState } from "react";
import SourceEntry from "../../core/sourceEntry";
import EditorApi from "../util/editorApi";

// How long a copied address's button says so.
const COPIED_NOTE_MS = 1500;

// The source library: photos added from this machine (picked, or dropped anywhere on the panel) or by their address
// (shown, to open or copy), each started as a new entry, or taken as the source of the open one. While picking, it
// is open for the latter.
export default function SourceLibraryPanel(props: Props)
{
    const [url, setUrl] = useState("");
    const [adding, setAdding] = useState(false);
    const [missing, setMissing] = useState<Set<string>>(new Set());
    const [copiedSha1, setCopiedSha1] = useState<string>();

    const copyUrl = async (source: SourceEntry) => {
        await navigator.clipboard.writeText(source.url!);
        setCopiedSha1(source.sha1);
        setTimeout(() => setCopiedSha1(current => (current == source.sha1) ? undefined : current), COPIED_NOTE_MS);
    };

    const addFromUrl = async () => {
        if (!url.trim() || adding)
            return;
        setAdding(true);
        try
        {
            await props.onAddUrl(url.trim());
            setUrl("");
        }
        finally
        {
            setAdding(false);
        }
    };

    const sources = [...props.sources].reverse();
    return <div className="source-library"
        onDragOver={ev => ev.preventDefault()}
        onDrop={ev => {
            ev.preventDefault();
            props.onAddFiles(Array.from(ev.dataTransfer.files));
        }}>
        {props.picking && <div className="picking-note">
            <span>Pick the source for {props.openEntryLabel}.</span>
            <button type="button" className="button small" onClick={props.onCancelPicking}>Cancel</button>
        </div>}
        <form className="add-by-url" onSubmit={ev => {
            ev.preventDefault();
            void addFromUrl();
        }}>
            <input value={url} placeholder="A photo's page (Unsplash) or an image's address"
                onChange={ev => setUrl(ev.target.value)}/>
            <button type="submit" className="button" disabled={!url.trim() || adding}>{adding ? "Adding…" : "Add"}</button>
        </form>
        <label className="button add-files" title="Or drop images here">
            Add images from this machine…
            <input type="file" accept="image/*" multiple hidden onChange={ev => {
                const files = Array.from(ev.target.files ?? []);
                ev.target.value = "";
                props.onAddFiles(files);
            }}/>
        </label>
        <div className="source-grid">
            {sources.length == 0 && <div className="panel-note">No sources yet.</div>}
            {sources.map(source => {
                const usedBy = props.usage[source.sha1] ?? [];
                const isCurrent = source.sha1 == props.currentSha1;
                return <div key={source.sha1} className={`source-card${isCurrent ? " selected" : ""}`}>
                    <div className="source-thumbnail">
                        {missing.has(source.sha1)
                            ? <span className="panel-note">Not on this machine</span>
                            : <img src={EditorApi.getSourceThumbnailURL(source.sha1)} alt="" loading="lazy"
                                onError={() => setMissing(previous => new Set(previous).add(source.sha1))}/>}
                    </div>
                    <div className="source-caption" title={source.fileName}>
                        {source.fileName} · {source.width}×{source.height}
                    </div>
                    {source.url && <div className="source-url">
                        <a href={source.url} target="_blank" rel="noreferrer" title={source.url}>{source.url}</a>
                        <button type="button" className="button small" title="Copy the address"
                            onClick={() => void copyUrl(source)}>{copiedSha1 == source.sha1 ? "Copied" : "Copy"}</button>
                    </div>}
                    {source.author && <div className="source-caption muted">{source.author}{source.license ? `, ${source.license}` : ""}</div>}
                    <div className="source-caption muted">{usedBy.length > 0 ? `Used by ${usedBy.join(", ")}` : "Unused"}</div>
                    <div className="source-actions">
                        {missing.has(source.sha1)
                            ? <button type="button" className="button small" disabled={!source.url}
                                title={source.url ? `From ${source.url}` : "It doesn't say where it came from"}
                                onClick={async () => {
                                    await props.onAddUrl(source.url!);
                                    setMissing(previous => { const next = new Set(previous); next.delete(source.sha1); return next; });
                                }}>Download again</button>
                            : <>
                                {props.canUseForEntry && <button type="button"
                                    className={`button small${props.picking ? " primary" : ""}`} disabled={isCurrent}
                                    onClick={() => props.onUseForEntry(source)}>Use for this entry</button>}
                                <button type="button" className="button small" onClick={() => props.onNewEntry(source)}>
                                    New entry</button>
                            </>}
                        <button type="button" className="button small danger" disabled={usedBy.length > 0}
                            title={usedBy.length > 0 ? "An entry is sampled from it" : "Remove it from the library"}
                            onClick={() => props.onDelete(source)}>Delete</button>
                    </div>
                </div>;
            })}
        </div>
    </div>;
}

interface Props
{
    sources: SourceEntry[];
    // Which entries are sampled from each source.
    usage: {[sha1: string]: string[]};
    currentSha1: string | undefined;
    canUseForEntry: boolean;
    picking: boolean;
    openEntryLabel: string;
    onCancelPicking: () => void;
    onAddFiles: (files: File[]) => void;
    onAddUrl: (url: string) => Promise<void>;
    onNewEntry: (source: SourceEntry) => void;
    onUseForEntry: (source: SourceEntry) => void;
    onDelete: (source: SourceEntry) => void;
}
