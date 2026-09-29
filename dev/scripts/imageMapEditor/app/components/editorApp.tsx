import { CSSProperties, useEffect, useRef, useState } from "react";
import useHistory from "../../../compositionEditor/app/hooks/useHistory";
import EntryList from "./entryList";
import PaneDivider from "./paneDivider";
import SourceLibraryPanel from "./sourceLibraryPanel";
import SourceView from "./sourceView";
import SamplePreview, { DEFAULT_BACKGROUND, DEFAULT_STEP } from "./samplePreview";
import SampleView from "./sampleView";
import EntryForm, { DEFAULT_LONG_SIDE } from "./entryForm";
import usePreview from "../hooks/usePreview";
import EditorApi from "../util/editorApi";
import PixelUtil from "../util/pixelUtil";
import Draft from "../types/draft";
import LoadedSource from "../types/loadedSource";
import SampleToolSettings from "../types/sampleToolSettings";
import EditorState from "../../core/editorState";
import ImageRecipe from "../../core/imageRecipe";
import RecipeBackground from "../../core/recipeBackground";
import RecipeOutput from "../../core/recipeOutput";
import SourceEntry from "../../core/sourceEntry";
import { NO_ADJUST } from "../../core/colorAdjustUtil";
import { PICTURE_ATLAS_CELL_SIZE, PICTURE_ATLAS_CELL_WORLD_SIZE,
    PICTURE_ATLAS_MAX_REGION_CELLS } from "../../../../../src/shared/system/sharedConstants";

// The previews work from a copy of the source no larger than this (see usePreview).
const PREVIEW_SOURCE_SIDE = 1024;
// The largest image that keeps its scale, in cells: anything larger would be drawn from a smaller region.
const MAX_CELLS = PICTURE_ATLAS_MAX_REGION_CELLS;
const WHOLE_IMAGE: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
// The shapes a new sample starts at, in world units (see EntryForm's presets): whichever its image fills best.
const START_SIZES = [{width: 1, height: 1}, {width: 1, height: 0.5}, {width: 0.5, height: 1}];
// The side column's share for the sample at first, and the least share either of its panels is left with.
const START_SAMPLE_SHARE = 0.55;
const MIN_PANE_SHARE = 0.1;

export default function EditorApp()
{
    const [state, setState] = useState<EditorState>();
    const [subfolder, setSubfolder] = useState("");
    const history = useHistory<Draft | undefined>(undefined);
    const draft = history.present;
    // The draft as last opened or saved, to tell unsaved edits by (and to discard them back to).
    const [savedDraftJSON, setSavedDraftJSON] = useState("null");
    const [source, setSource] = useState<LoadedSource>();
    const [leftTab, setLeftTab] = useState<"entries" | "sources">("entries");
    const [pickingSource, setPickingSource] = useState(false);
    const [keepRectangle, setKeepRectangle] = useState(true);
    // What the middle panel shows: the source with its quad, or the sample magnified.
    const [middleView, setMiddleView] = useState<"source" | "sample">("source");
    // How much of the side column's height the sample takes, the entry's settings having the rest.
    const [sampleShare, setSampleShare] = useState(START_SAMPLE_SHARE);
    const [toolSettings, setToolSettings] = useState<SampleToolSettings>(
        {tool: "none", brushRadius: 4, colorTolerance: 10, showRemoved: false, selectShape: "rect"});
    // The selection picked in the sample, whose handles show and whose settings the side panel edits.
    const [focusedSelection, setFocusedSelection] = useState<number>();
    // The open entry's background fill, and its edge stop, as they were when last turned off, so turning one back
    // on brings them back rather than the defaults.
    const turnedOffRef = useRef<{background?: RecipeBackground, step?: number}>({});
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState("");
    const [mapStatus, setMapStatus] = useState("");
    const [error, setError] = useState<string>();
    const [staleBundle, setStaleBundle] = useState(false);

    const dirty = JSON.stringify(draft ?? null) != savedDraftJSON;
    const dirtyRef = useRef(dirty);
    dirtyRef.current = dirty;
    const draftRef = useRef(draft);
    draftRef.current = draft;
    const stateRef = useRef(state);
    stateRef.current = state;
    const showError = (err: unknown) => setError(err instanceof Error ? err.message : String(err));

    const recipe = draft?.recipe;
    // Only once the draft's own source has loaded; a stale one would preview the recipe on the wrong photo.
    const currentSource = (source != undefined && source.sha1 == recipe?.sourceSha1) ? source : undefined;
    const preview = usePreview(currentSource, recipe, toolSettings.showRemoved, PICTURE_ATLAS_CELL_SIZE);

    useEffect(() => {
        EditorApi.loadState().then(loaded => {
            setState(loaded);
            setSubfolder(loaded.subfolders[0]?.name ?? "");
        }).catch(showError);
        return EditorApi.subscribe(
            () => EditorApi.loadState().then(setState).catch(showError),
            (mapError) => setMapStatus(mapError ? `Rebuilding the map failed: ${mapError}`
                : `Map rebuilt at ${new Date().toLocaleTimeString()}`),
            () => dirtyRef.current ? setStaleBundle(true) : location.reload());
    }, []);

    useEffect(() => {
        const onBeforeUnload = (ev: BeforeUnloadEvent) => {
            if (dirtyRef.current)
                ev.preventDefault();
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    // The draft's source, whenever it names another: an entry opened, its source changed, an undo or a discard.
    useEffect(() => {
        if (recipe == undefined || source?.sha1 == recipe.sourceSha1)
            return;
        let cancelled = false;
        const {sourceSha1, sourceFileName} = recipe;
        setStatus("Loading the source…");
        (async () => {
            const blob = await EditorApi.fetchSource(sourceSha1);
            if (cancelled)
                return;
            if (blob == undefined)
                return await recoverSource(draftRef.current!);
            const loaded = await decodeSource(blob, sourceSha1, sourceFileName);
            if (!cancelled)
                setSource(loaded);
        })().catch(err => {
            if (!cancelled)
                showError(err);
        }).finally(() => {
            if (!cancelled)
                setStatus("");
        });
        return () => {
            cancelled = true;
        };
    }, [recipe?.sourceSha1]);

    // A source not on this machine: downloaded again from where the entry came from, or, failing that, the entry's
    // saved sample becomes its source (with the color changes it already carries taken off the recipe). An entry
    // taken in as its own image has that as its sample, so it gets its source back as it was.
    const recoverSource = async (lost: Draft) => {
        const lostRecipe = lost.recipe;
        const entry = stateRef.current?.entries.find(other => other.path == lost.path);
        if (entry?.source)
        {
            const downloaded = await EditorApi.downloadSource(entry.source).catch(() => undefined);
            if (downloaded != undefined && downloaded.sha1 == lostRecipe.sourceSha1)
            {
                const blob = await EditorApi.fetchSource(downloaded.sha1);
                if (blob != undefined)
                    return setSource(await decodeSource(blob, downloaded.sha1, lostRecipe.sourceFileName));
            }
            if (downloaded != undefined)
            {
                history.reset({...lost, recipe: {...lostRecipe, sourceSha1: downloaded.sha1, sourceFileName: downloaded.fileName}});
                setError(`${entry.source} is no longer the file ${lost.path} was sampled from, so it is sampled from the new one.`);
                return;
            }
        }
        const sampleBlob = (lost.path != undefined) ? await EditorApi.fetchSample(lost.path) : undefined;
        if (sampleBlob == undefined)
            throw new Error(`Neither the source nor the sample of ${lost.path ?? "this entry"} is at hand`);
        const uploaded = await EditorApi.uploadSource(sampleBlob, `${lost.path!.replace("/", "_")}.webp`);
        if (uploaded.sha1 == lostRecipe.sourceSha1)
            return setSource(await decodeSource(sampleBlob, uploaded.sha1, lostRecipe.sourceFileName));
        history.reset({...lost, recipe: {...lostRecipe, sourceSha1: uploaded.sha1, sourceFileName: uploaded.fileName,
            corners: WHOLE_IMAGE, rotation: undefined, retouches: [], background: undefined, selections: undefined,
            alphaEdits: undefined, adjust: lostRecipe.adjust && {...NO_ADJUST, sharpness: lostRecipe.adjust.sharpness}}});
        setError(`The source of ${lost.path} isn't at hand, so it is sampled again from its saved sample.`);
    };

    const confirmDiscard = () => !dirtyRef.current || confirm("Discard the unsaved changes to this entry?");

    const openEntry = (path: string) => {
        if (state == undefined || !confirmDiscard())
            return;
        const entry = state.entries.find(other => other.path == path)!;
        const recipe = state.recipeFile.recipes[path];
        if (recipe == undefined)
            return setError(`${path} has no recipe yet: restart the editor, which takes it in as its own image.`);
        const opened: Draft = {path, subfolder: path.substring(0, path.indexOf("/")), title: entry.title,
            author: entry.author, keywords: entry.keywords ?? "", source: entry.source ?? "", license: entry.license ?? "",
            disabled: entry.disabled === true, recipe};
        resetDraft(opened);
        setSavedDraftJSON(JSON.stringify(opened));
        setPickingSource(false);
        setError(undefined);
    };

    // Another entry opened (or started): what was picked or turned off in the last one doesn't carry over.
    const resetDraft = (opened: Draft) => {
        history.reset(opened);
        setFocusedSelection(undefined);
        turnedOffRef.current = {};
    };

    // A new entry in the open tab, sized as the tab's first entry is (at its own scale, or fitted to its canvas).
    const startEntryFromSource = (library: SourceEntry) => {
        if (state == undefined || !confirmDiscard())
            return;
        const tabEntry = state.entries.find(entry => entry.path.startsWith(`${subfolder}/`));
        const opened: Draft = {path: undefined, subfolder, title: "", author: library.author ?? "", keywords: "",
            source: library.url ?? "", license: library.license ?? "", disabled: false,
            recipe: newRecipe(library, tabEntry == undefined || tabEntry.preserveScale === true)};
        resetDraft(opened);
        setSavedDraftJSON("null");
        setPickingSource(false);
        setError(undefined);
    };

    // What was placed on the old photo can't carry over; the settings and the entry's size do. Undoable.
    const useSourceForEntry = (library: SourceEntry) => {
        history.commit(d => (d == undefined) ? d : {
            ...d,
            source: library.url ?? d.source,
            author: library.author || d.author,
            license: library.license || d.license,
            recipe: {...d.recipe, sourceSha1: library.sha1, sourceFileName: library.fileName, corners: WHOLE_IMAGE,
                rotation: undefined, retouches: [], alphaEdits: undefined,
                background: d.recipe.background && {...d.recipe.background, seeds: []}},
        });
        setPickingSource(false);
    };

    const addFiles = async (files: File[], startEntry: boolean) => {
        try
        {
            setStatus("Adding to the library…");
            let added: SourceEntry | undefined;
            for (const file of files)
                added = await EditorApi.uploadSource(file, file.name);
            if (startEntry && added != undefined)
                startEntryFromSource(added);
        }
        catch (err)
        {
            showError(err);
        }
        finally
        {
            setStatus("");
        }
    };

    const addFromUrl = async (url: string) => {
        try
        {
            setStatus(`Downloading ${url}…`);
            const added = await EditorApi.downloadSource(url);
            setStatus(added.author ? `Added ${added.fileName}; check its author ("${added.author}", as the site spells it)` : "");
        }
        catch (err)
        {
            showError(err);
            setStatus("");
        }
    };

    const deleteSource = async (library: SourceEntry) => {
        if (!confirm(`Delete ${library.fileName} from the library?`))
            return;
        try
        {
            setState((await EditorApi.deleteSource(library.sha1)).state);
        }
        catch (err)
        {
            showError(err);
        }
    };

    // Back to the entry as last opened or saved; a new one is closed.
    const discard = () => {
        if (!dirty || !confirm("Discard the unsaved changes to this entry? This can't be undone."))
            return;
        const saved = JSON.parse(savedDraftJSON) as Draft | null;
        history.reset(saved ?? undefined);
        if (saved == null)
            setSource(undefined);
        setPickingSource(false);
        setError(undefined);
    };

    // The server renders the sample from the recipe, sent only when it changed (or the entry is new).
    const save = async (asNew: boolean) => {
        if (state == undefined || draft == undefined || busy)
            return;
        const savedRecipe = (JSON.parse(savedDraftJSON) as Draft | null)?.recipe;
        const sendsRecipe = asNew || draft.path == undefined
            || JSON.stringify(draft.recipe) != JSON.stringify(savedRecipe ?? null);
        setBusy(true);
        setError(undefined);
        setStatus(sendsRecipe ? "Saving (rendering the sample)…" : "Saving…");
        try
        {
            const result = await EditorApi.saveEntry({
                path: asNew ? undefined : draft.path,
                subfolder: draft.subfolder,
                fields: {title: draft.title, author: draft.author, keywords: draft.keywords, source: draft.source,
                    license: draft.license, disabled: draft.disabled},
                recipe: sendsRecipe ? draft.recipe : undefined,
                baseHash: state.hash,
            });
            if ("conflict" in result)
            {
                setState(result.conflict);
                setError("The map changed on disk since it was read, so nothing was saved. It has been read again: save again to apply this edit.");
                setStatus("");
                return;
            }
            // With its keywords as the manifest now holds them (tidied into single words, lowercase, categories first).
            const saved = {...draft, path: result.path,
                keywords: result.state.entries.find(entry => entry.path == result.path)?.keywords ?? ""};
            setState(result.state);
            history.reset(saved);
            setSavedDraftJSON(JSON.stringify(saved));
            setSubfolder(saved.subfolder);
            setStatus(`Saved ${result.path}`);
            setMapStatus("Rebuilding the map…");
        }
        catch (err)
        {
            showError(err);
            setStatus("");
        }
        finally
        {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (state == undefined || draft?.path == undefined || busy)
            return;
        if (!confirm(`Delete ${draft.path}? A canvas or prop showing it will show nothing, and its number is never used again.`))
            return;
        try
        {
            const result = await EditorApi.deleteEntry(draft.path, state.hash);
            if ("conflict" in result)
            {
                setState(result.conflict);
                setError("The map changed on disk since it was read, so nothing was deleted. It has been read again.");
                return;
            }
            setState(result.state);
            setStatus(`Deleted ${draft.path}`);
            setMapStatus("Rebuilding the map…");
            history.reset(undefined);
            setSavedDraftJSON("null");
            setSource(undefined);
        }
        catch (err)
        {
            showError(err);
        }
    };

    useEffect(() => {
        const onKeyDown = (ev: KeyboardEvent) => {
            if (!(ev.metaKey || ev.ctrlKey) || (ev.target as HTMLElement).tagName == "INPUT")
                return;
            const key = ev.key.toLowerCase();
            if (key == "z")
            {
                ev.preventDefault();
                if (ev.shiftKey)
                    history.redo();
                else
                    history.undo();
            }
            else if (key == "s")
            {
                ev.preventDefault();
                void save(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    });

    if (state == undefined)
        return <div className="editor loading">{error ?? "Loading…"}</div>;

    // Every edit to the draft goes through here, which remembers a background fill or edge stop it turns off.
    const commitDraft = (update: (draft: Draft) => Draft, coalesceKey?: string) =>
        history.commit(d => {
            if (d == undefined)
                return d;
            const next = update(d);
            rememberTurnedOff(d.recipe, next.recipe, turnedOffRef.current);
            return next;
        }, coalesceKey);
    const updateRecipe = (update: (recipe: ImageRecipe) => ImageRecipe, coalesceKey?: string) =>
        commitDraft(d => ({...d, recipe: update(d.recipe)}), coalesceKey);
    const startBackground = turnedOffRef.current.background ?? DEFAULT_BACKGROUND;
    const startStep = turnedOffRef.current.step ?? DEFAULT_STEP;
    const usage: {[sha1: string]: string[]} = {};
    for (const [entryPath, entryRecipe] of Object.entries(state.recipeFile.recipes))
        (usage[entryRecipe.sourceSha1] ??= []).push(entryPath);
    const output = recipe?.output;
    const gameImage = preview?.gameImage;
    const magnified = middleView == "sample" && preview != undefined && recipe != undefined && currentSource != undefined;
    const viewSwitch = <div className="segmented view-tabs">
        <button type="button" className={magnified ? "" : "active"} onClick={() => setMiddleView("source")}
            title="The photo, and the area sampled from it">Source</button>
        <button type="button" className={magnified ? "active" : ""} disabled={preview == undefined}
            onClick={() => setMiddleView("sample")} title="The sample, large, to zoom in and work on it by hand">Sample</button>
    </div>;
    const gameImageLabel = (gameImage == undefined || output == undefined) ? ""
        : output.preserveScale
            ? `In the game: ${output.numCols} x ${output.numRows} cells, ${output.numCols * PICTURE_ATLAS_CELL_WORLD_SIZE} x ${output.numRows
                * PICTURE_ATLAS_CELL_WORLD_SIZE} units, ${gameImage.width} x ${gameImage.height} px`
            : `In the game: ${gameImage.width} x ${gameImage.height} px, fitted to its canvas`;

    return <div className="editor">
        <header className="header-bar">
            <span className="header-title">Image Map Editor</span>
            <span className="header-path">{state.manifestPath}</span>
            <span className="header-status">{[status, mapStatus].filter(text => text).join(" · ")}</span>
            <div className="header-actions">
                <button type="button" className="button" disabled={!history.canUndo} onClick={history.undo}
                    title="Undo (Ctrl+Z)">Undo</button>
                <button type="button" className="button" disabled={!history.canRedo} onClick={history.redo}
                    title="Redo (Ctrl+Shift+Z)">Redo</button>
                <button type="button" className="button" disabled={!dirty || busy} onClick={discard}
                    title="Put the entry back as it was last opened or saved">Discard</button>
                <button type="button" className="button primary" disabled={draft == undefined || busy || (!dirty && draft.path != undefined)}
                    onClick={() => save(false)} title="Save (Ctrl+S)">{draft?.path == undefined ? "Add entry" : "Save"}</button>
                <button type="button" className="button" disabled={draft?.path == undefined || busy}
                    onClick={() => save(true)} title="Save this sample as another entry">Save as new</button>
                <button type="button" className="button danger" disabled={draft?.path == undefined || busy}
                    onClick={remove}>Delete</button>
            </div>
        </header>
        {error != undefined && <div className="banner error" role="alert">
            <span className="banner-message">{error}</span>
            <button type="button" className="button small" onClick={() => setError(undefined)}>Dismiss</button>
        </div>}
        {staleBundle && <div className="banner warning" role="alert">
            <span className="banner-message">The editor's code changed. Save or discard this entry, then reload.</span>
            <button type="button" className="button small" onClick={() => location.reload()}>Reload now</button>
        </div>}
        <main className="workspace">
            <aside className="left-column">
                <div className="segmented tabs">
                    <button type="button" className={leftTab == "entries" ? "active" : ""}
                        onClick={() => { setLeftTab("entries"); setPickingSource(false); }}>Entries</button>
                    <button type="button" className={leftTab == "sources" ? "active" : ""}
                        onClick={() => setLeftTab("sources")}>Sources ({state.sources.length})</button>
                </div>
                {leftTab == "entries"
                    ? <EntryList state={state} subfolder={subfolder} selectedPath={draft?.path}
                        onSelectSubfolder={setSubfolder} onSelect={openEntry} onOpenFile={file => addFiles([file], true)}/>
                    : <SourceLibraryPanel sources={state.sources} usage={usage} currentSha1={recipe?.sourceSha1}
                        canUseForEntry={draft != undefined} picking={pickingSource}
                        openEntryLabel={draft?.path ?? "the new entry"}
                        onCancelPicking={() => setPickingSource(false)}
                        onAddFiles={files => addFiles(files, false)} onAddUrl={addFromUrl}
                        onNewEntry={startEntryFromSource} onUseForEntry={useSourceForEntry} onDelete={deleteSource}/>}
            </aside>
            {draft == undefined
                ? <div className="placeholder">Pick an entry, or start one from a photo in the Sources tab.</div>
                : <>
                    {magnified
                        ? <SampleView source={currentSource!} recipe={recipe!} settings={toolSettings} fallback={preview!.shown}
                            cellSize={PICTURE_ATLAS_CELL_SIZE} startBackground={startBackground} viewSwitch={viewSwitch}
                            focusedSelection={focusedSelection} onFocusSelection={setFocusedSelection}
                            onChange={updateRecipe}/>
                        : (recipe != undefined && currentSource != undefined)
                        ? <SourceView source={currentSource} recipe={recipe} keepRectangle={keepRectangle}
                            viewSwitch={viewSwitch}
                            onChange={updateRecipe} onChangeSource={() => { setLeftTab("sources"); setPickingSource(true); }}/>
                        : <section className="source-view placeholder">Loading the source…</section>}
                    <div className="side-column" style={{"--sample-share": `${sampleShare * 100}%`} as CSSProperties}>
                        {preview != undefined && recipe != undefined && <>
                            <SamplePreview shown={preview.shown} gameImage={preview.gameImage!} gameImageLabel={gameImageLabel}
                                recipe={recipe} settings={toolSettings} magnified={magnified}
                                startBackground={startBackground} startStep={startStep}
                                focusedSelection={focusedSelection} onFocusSelection={setFocusedSelection}
                                onToggleMagnified={() => setMiddleView(magnified ? "source" : "sample")}
                                onSettingsChange={update => setToolSettings(previous => ({...previous, ...update}))}
                                onChange={updateRecipe}/>
                            <PaneDivider share={sampleShare} min={MIN_PANE_SHARE} max={1 - MIN_PANE_SHARE}
                                title="Drag to share the height between the sample and the entry's settings"
                                onChange={setSampleShare}/>
                        </>}
                        <EntryForm draft={draft} subfolders={state.subfolders} onDraftChange={commitDraft}
                            startBackground={startBackground}
                            keepRectangle={keepRectangle} setKeepRectangle={setKeepRectangle}
                            maxCells={MAX_CELLS} cellSize={PICTURE_ATLAS_CELL_SIZE} cellWorldSize={PICTURE_ATLAS_CELL_WORLD_SIZE}/>
                    </div>
                </>}
        </main>
    </div>;
}

// What an edit turns off: the whole background fill, or just its edge stop's value.
function rememberTurnedOff(before: ImageRecipe, after: ImageRecipe,
    turnedOff: {background?: RecipeBackground, step?: number}): void
{
    if (before.background != undefined && after.background == undefined)
        turnedOff.background = before.background;
    else if (before.background?.step != undefined && after.background != undefined && after.background.step == undefined)
        turnedOff.step = before.background.step;
}

// Of the whole photo: kept at its own scale in whichever start size its shape fills best, or fitted to its canvas.
function newRecipe(library: SourceEntry, preserveScale: boolean): ImageRecipe
{
    return {sourceSha1: library.sha1, sourceFileName: library.fileName, corners: WHOLE_IMAGE, retouches: [],
        output: preserveScale ? getStartOutput(library.width / library.height)
            : {preserveScale: false, longSide: Math.min(DEFAULT_LONG_SIDE, Math.max(library.width, library.height))}};
}

function getStartOutput(aspect: number): RecipeOutput
{
    const coverage = (size: {width: number, height: number}) => {
        const ratio = aspect / (size.width / size.height);
        return Math.min(ratio, 1 / ratio);
    };
    const best = START_SIZES.reduce((a, b) => coverage(b) > coverage(a) ? b : a);
    return {preserveScale: true, numCols: Math.round(best.width / PICTURE_ATLAS_CELL_WORLD_SIZE),
        numRows: Math.round(best.height / PICTURE_ATLAS_CELL_WORLD_SIZE)};
}

async function decodeSource(blob: Blob, sha1: string, fileName: string): Promise<LoadedSource>
{
    const {image, width, height} = await PixelUtil.decode(blob, PREVIEW_SOURCE_SIDE);
    return {sha1, fileName, width, height, preview: image, previewCanvas: PixelUtil.toCanvas(image)};
}
