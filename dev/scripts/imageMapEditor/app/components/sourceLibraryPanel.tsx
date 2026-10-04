import { useState } from "react";
import ImageEntry from "../../core/imageEntry";
import SourceEntry from "../../core/sourceEntry";
import SourcePrep from "../../core/sourcePrep";
import SourceSort from "../types/sourceSort";
import EditorApi from "../util/editorApi";
import SourceUsageDialog from "./sourceUsageDialog";
import PreprocessDialog from "./preprocessDialog";
import PictureSearchUtil from "../../../../../src/shared/graphics/image/util/pictureSearchUtil";

// How long a copied address's button says so.
const COPIED_NOTE_MS = 1500;

// The source library: photos added from this machine (picked, or dropped anywhere on the panel) or by their address
// (shown, to open or copy), each started as a new entry, taken as the source of the open one, or preprocessed into
// another source (see PreprocessDialog). While picking, it is open for the second. Each shows how many entries are
// sampled from it; the count opens a list of them. A search narrows them by their names, addresses and authors, and
// by what the entries sampled from them are found by (see PictureSearchUtil).
export default function SourceLibraryPanel(props: Props)
{
    const [url, setUrl] = useState("");
    const [adding, setAdding] = useState(false);
    const [missing, setMissing] = useState<Set<string>>(new Set());
    const [copiedSha1, setCopiedSha1] = useState<string>();
    // The source whose entries are listed.
    const [listedSha1, setListedSha1] = useState<string>();
    // The source being preprocessed, and what its dialog starts from.
    const [preprocessed, setPreprocessed] = useState<{sha1: string, startPrep?: SourcePrep}>();

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
    const find = (sha1: string | undefined) => props.sources.find(source => source.sha1 == sha1);
    const found = PictureSearchUtil.filter(props.sources, props.search, source =>
        [source.fileName, source.url, source.author, find(source.preparedFrom?.sha1)?.fileName,
            ...usedBy(source).flatMap(entry => [entry.path, entry.title, entry.keywords])].join(","));
    const sources = found.filter(source => !props.unusedOnly || usedBy(source).length == 0)
        .sort((a, b) => compareSources(props.sort, a, b, source => usedBy(source).length));
    const listedSource = find(listedSha1);
    const preprocessedSource = find(preprocessed?.sha1);
    // One made from another in the library is preprocessed by changing how that was done.
    const preprocess = (source: SourceEntry) => {
        const origin = find(source.preparedFrom?.sha1);
        setPreprocessed((origin != undefined && !missing.has(origin.sha1))
            ? {sha1: origin.sha1, startPrep: source.preparedFrom!.prep} : {sha1: source.sha1});
    };
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
        <input type="search" className="list-search" value={props.search}
            placeholder="Search by name, author or entry" onChange={ev => props.onSearchChange(ev.target.value)}
            title="Finds sources by their names, addresses and authors, and by the titles and keywords of the entries sampled from them"/>
        <div className="source-grid">
            {sources.length == 0 && <div className="panel-note">
                {props.sources.length == 0 ? "No sources yet."
                    : found.length == 0 ? "No source matches the search." : "Every source found is used by an entry."}</div>}
            {sources.map(source => {
                const entries = usedBy(source);
                const isCurrent = source.sha1 == props.currentSha1;
                const addedAt = new Date(source.addedAt);
                const origin = find(source.preparedFrom?.sha1);
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
                    {source.preparedFrom != undefined && <div className="source-caption muted"
                        title={origin?.fileName}>Preprocessed from {origin?.fileName ?? "a source no longer in the library"}</div>}
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
                                <button type="button" className="button small" onClick={() => preprocess(source)}
                                    title={(origin != undefined)
                                        ? `Change how it was made from ${origin.fileName}, as another source`
                                        : "Cut a thing out of its background, or square up or make round what is seen at "
                                            + "an angle, as another source"}>Preprocess…</button>
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
        {preprocessedSource != undefined && <PreprocessDialog source={preprocessedSource}
            startPrep={preprocessed!.startPrep} onAdded={props.onPreprocessed}
            onClose={() => setPreprocessed(undefined)}/>}
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
    search: string;
    onSortChange: (sort: SourceSort) => void;
    onUnusedOnlyChange: (unusedOnly: boolean) => void;
    onSearchChange: (search: string) => void;
    onCancelPicking: () => void;
    onAddFiles: (files: File[]) => void;
    onAddUrl: (url: string) => Promise<void>;
    onNewEntry: (source: SourceEntry) => void;
    onUseForEntry: (source: SourceEntry) => void;
    // A source was made from another and added to the library.
    onPreprocessed: (added: SourceEntry) => void;
    onDelete: (source: SourceEntry) => void;
    onOpenEntry: (path: string) => void;
}
