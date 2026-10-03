import { useState } from "react";
import ImageEntry from "../../core/imageEntry";
import SourceEntry from "../../core/sourceEntry";
import SourceSort from "../types/sourceSort";
import EditorApi from "../util/editorApi";
import SourceUsageDialog from "./sourceUsageDialog";

// How long a copied address's button says so.
const COPIED_NOTE_MS = 1500;

// The source library: photos added from this machine (picked, or dropped anywhere on the panel) or by their address
// (shown, to open or copy), each started as a new entry, or taken as the source of the open one. While picking, it
// is open for the latter. Each shows how many entries are sampled from it; the count opens a list of them.
export default function SourceLibraryPanel(props: Props)
{
    const [url, setUrl] = useState("");
    const [adding, setAdding] = useState(false);
    const [missing, setMissing] = useState<Set<string>>(new Set());
    const [copiedSha1, setCopiedSha1] = useState<string>();
    // The source whose entries are listed.
    const [listedSha1, setListedSha1] = useState<string>();

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

    const usedBy = (source: SourceEntry) => props.usage[source.sha1] ?? [];
    const sources = props.sources.filter(source => !props.unusedOnly || usedBy(source).length == 0)
        .sort((a, b) => compareSources(props.sort, a, b, source => usedBy(source).length));
    const listedSource = props.sources.find(source => source.sha1 == listedSha1);
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
        <div className="source-options">
            <select value={props.sort} title="The order sources are listed in"
                onChange={ev => props.onSortChange(ev.target.value as SourceSort)}>
                <option value="added">Newest first</option>
                <option value="name">Name (A–Z)</option>
                <option value="usage">Most used first</option>
            </select>
            <label className="checkbox" title="Only the sources no entry is sampled from">
                <input type="checkbox" checked={props.unusedOnly}
                    onChange={ev => props.onUnusedOnlyChange(ev.target.checked)}/>
                Unused only
            </label>
        </div>
        <div className="source-grid">
            {sources.length == 0 && <div className="panel-note">
                {props.sources.length == 0 ? "No sources yet." : "Every source is used by an entry."}</div>}
            {sources.map(source => {
                const entries = usedBy(source);
                const isCurrent = source.sha1 == props.currentSha1;
                const addedAt = new Date(source.addedAt);
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
                    <div className="source-usage">
                        <button type="button" className="button small" disabled={entries.length == 0}
                            title="List the entries sampled from it" onClick={() => setListedSha1(source.sha1)}>
                            {entries.length} {entries.length == 1 ? "entry" : "entries"}</button>
                        <span className="source-caption muted" title={addedAt.toLocaleString()}>
                            Added {addedAt.toLocaleDateString(undefined, {dateStyle: "medium"})}</span>
                    </div>
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
                        <button type="button" className="button small danger" disabled={entries.length > 0 || isCurrent}
                            title={entries.length > 0 ? "An entry is sampled from it"
                                : isCurrent ? "The open entry is sampled from it" : "Remove it from the library"}
                            onClick={() => props.onDelete(source)}>Delete</button>
                    </div>
                </div>;
            })}
        </div>
        {listedSource != undefined && <SourceUsageDialog source={listedSource} entries={usedBy(listedSource)}
            imageVersion={props.imageVersion} openPath={props.openPath}
            onOpenEntry={path => {
                props.onOpenEntry(path);
                setListedSha1(undefined);
            }}
            onClose={() => setListedSha1(undefined)}/>}
    </div>;
}

// Ties go to the newest first, and then by name.
function compareSources(sort: SourceSort, a: SourceEntry, b: SourceEntry, countOf: (source: SourceEntry) => number):
    number
{
    const byName = a.fileName.localeCompare(b.fileName) || a.sha1.localeCompare(b.sha1);
    if (sort == "name")
        return byName;
    const newestFirst = (Date.parse(b.addedAt) - Date.parse(a.addedAt)) || byName;
    return (sort == "usage") ? ((countOf(b) - countOf(a)) || newestFirst) : newestFirst;
}

interface Props
{
    sources: SourceEntry[];
    // Which entries are sampled from each source.
    usage: {[sha1: string]: ImageEntry[]};
    // See EditorApi.getGameImageURL.
    imageVersion: string;
    currentSha1: string | undefined;
    openPath: string | undefined;
    canUseForEntry: boolean;
    picking: boolean;
    openEntryLabel: string;
    // Kept by the app, so they last while the Entries tab is shown.
    sort: SourceSort;
    unusedOnly: boolean;
    onSortChange: (sort: SourceSort) => void;
    onUnusedOnlyChange: (unusedOnly: boolean) => void;
    onCancelPicking: () => void;
    onAddFiles: (files: File[]) => void;
    onAddUrl: (url: string) => Promise<void>;
    onNewEntry: (source: SourceEntry) => void;
    onUseForEntry: (source: SourceEntry) => void;
    onDelete: (source: SourceEntry) => void;
    onOpenEntry: (path: string) => void;
}
