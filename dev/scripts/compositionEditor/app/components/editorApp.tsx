import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import PreEncodingSourceEntry from "../../../../../src/shared/graphics/mesh/composition/types/preEncodingSourceEntry";
import CompositionThumbnailUtil from "../../../../../src/shared/graphics/mesh/composition/util/compositionThumbnailUtil";
import ObjectTypeConfigMap from "../../../../../src/shared/object/maps/objectTypeConfigMap";
import useHistory from "../hooks/useHistory";
import DiskState from "../types/diskState";
import EditorBanner from "../types/editorBanner";
import PreEncodingSource from "../types/preEncodingSource";
import TypeThumbnails from "../types/typeThumbnails";
import EntryEncodingUtil from "../util/entryEncodingUtil";
import EntryUtil from "../util/entryUtil";
import SourceApi from "../util/sourceApi";
import SourceFormatUtil from "../util/sourceFormatUtil";
import ThumbnailRenderQueue from "../util/thumbnailRenderQueue";
import BannerBar from "./bannerBar";
import EntryInspector from "./entryInspector";
import HeaderBar from "./headerBar";
import TypeSection from "./typeSection";

// Twice the atlas cell, so the inspector's large preview stays sharp; the grid shows it scaled down.
const RENDER_CELL_SIZE = 2 * CompositionThumbnailUtil.getCellSize();
const THUMBNAIL_SIZES = [64, 96, 128];
const DEFAULT_THUMBNAIL_SIZE = 96;
// Carries unsaved edits across the reload that follows a rebuild of the editor.
const STASH_KEY = "compositionEditor.stash";

const INDEXED_OBJECT_TYPES = ObjectTypeConfigMap.getAllConfigs()
    .filter(config => config.components.spawnedByAny?.instancedMeshComposer?.codecType
        == InstancedMeshCompositionCodecTypeEnumMap.Indexed)
    .map(config => config.objectType);

export default function EditorApp()
{
    const history = useHistory<PreEncodingSource | null>(null);
    const {commit, reset, undo, redo} = history;
    const source = history.present;

    const [sourcePath, setSourcePath] = useState("");
    const [disk, setDisk] = useState<DiskState | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [banner, setBanner] = useState<EditorBanner | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [thumbnailSize, setThumbnailSize] = useState(DEFAULT_THUMBNAIL_SIZE);
    const [preview, setPreview] = useState<{compositionIndex: number, entry: PreEncodingSourceEntry} | null>(null);
    const [thumbnailsByType, setThumbnailsByType] = useState<{[objectType: string]: TypeThumbnails}>({});
    const [saving, setSaving] = useState(false);
    const reloadingForBundle = useRef(false);

    const queue = useMemo(() => new ThumbnailRenderQueue(RENDER_CELL_SIZE,
        (objectType, thumbnails) => setThumbnailsByType(previous => ({...previous, [objectType]: thumbnails}))), []);

    // What is drawn: the source, with a hovered value tried on the selected entry.
    const shown = useMemo(() => {
        if (source == null || preview == null || preview.compositionIndex >= source.compositions.length)
            return source;
        const compositions = [...source.compositions];
        compositions[preview.compositionIndex] = preview.entry;
        return {...source, compositions};
    }, [source, preview]);
    useEffect(() => setPreview(null), [source, selectedIndex]);

    const compositions = shown?.compositions ?? [];
    const encodings = useMemo(() => compositions.map((entry, i) => EntryEncodingUtil.encode(entry, i)), [shown]);
    const errorIndices = useMemo(() => (source?.compositions ?? [])
        .map((entry, i) => EntryEncodingUtil.encode(entry, i).error != undefined ? i : -1)
        .filter(i => i >= 0), [source]);
    const formatted = useMemo(() => source != null ? SourceFormatUtil.format(source) : "", [source]);
    const dirty = source != null && disk != null && formatted != disk.normalized;
    const selected = Math.max(0, Math.min(selectedIndex, compositions.length - 1));

    const latest = useRef({source, disk, dirty, formatted, selected, thumbnailSize, errorCount: 0, saving});
    latest.current = {source, disk, dirty, formatted, selected, thumbnailSize, errorCount: errorIndices.length, saving};

    // A type's entries share one framing, so any change to one redraws the type.
    useEffect(() => {
        const encodedListByType = new Map<string, string[]>();
        compositions.forEach((entry, i) => {
            const encoded = encodings[i].encoded;
            if (encoded != undefined)
                encodedListByType.set(entry.objectType, [...(encodedListByType.get(entry.objectType) ?? []), encoded]);
        });
        for (const [objectType, encodedList] of encodedListByType)
        {
            const config = ObjectTypeConfigMap.getConfigByIndex(ObjectTypeConfigMap.getIndexByType(objectType));
            queue.request(objectType, encodedList, CompositionThumbnailUtil.getView(config));
        }
    }, [encodings]);

    const followDisk = useCallback((loaded: {text: string, hash: string}, current: {source: PreEncodingSource | null,
        disk: DiskState | null}, force: boolean): void =>
    {
        if (!force && current.disk != null && loaded.hash == current.disk.hash)
            return;
        let parsed: PreEncodingSource;
        try
        {
            parsed = parseSource(loaded.text);
        }
        catch (err)
        {
            setBanner({kind: "error", message: `The file on disk can't be read: ${getMessage(err)}`});
            return;
        }
        const normalized = SourceFormatUtil.format(parsed);
        const currentFormatted = current.source != null ? SourceFormatUtil.format(current.source) : null;
        const hasUnsaved = current.disk != null && currentFormatted != current.disk.normalized;
        if (!force && hasUnsaved && normalized != currentFormatted)
        {
            setBanner({kind: "external", text: loaded.text, hash: loaded.hash});
            return;
        }
        setDisk({text: loaded.text, hash: loaded.hash, normalized});
        setBanner(null);
        if (current.source == null)
            reset(parsed);
        else if (normalized != currentFormatted)
            commit(() => parsed);
    }, [commit, reset]);

    useEffect(() => {
        (async () => {
            let loaded: {text: string, hash: string, path: string};
            try
            {
                loaded = await SourceApi.load();
            }
            catch (err)
            {
                setLoadError(getMessage(err));
                return;
            }
            setSourcePath(loaded.path);
            const stash = takeStash();
            if (stash != null)
            {
                reset(stash.source);
                setDisk(stash.disk);
                setSelectedIndex(stash.selected);
                setThumbnailSize(stash.thumbnailSize);
                followDisk(loaded, {source: stash.source, disk: stash.disk}, false);
                return;
            }
            try
            {
                parseSource(loaded.text);
            }
            catch (err)
            {
                setLoadError(`The file on disk can't be read: ${getMessage(err)}`);
                return;
            }
            followDisk(loaded, {source: null, disk: null}, true);
        })();
    }, []);

    useEffect(() => SourceApi.subscribe(
        async (hash) => {
            if (hash == latest.current.disk?.hash)
                return; // this editor's own save
            try
            {
                const loaded = await SourceApi.load();
                setLoadError(null);
                followDisk(loaded, latest.current, latest.current.source == null);
            }
            catch (err)
            {
                setBanner({kind: "error", message: getMessage(err)});
            }
        },
        () => {
            const {source, disk, selected, thumbnailSize} = latest.current;
            if (source != null && disk != null)
                putStash({source, disk, selected, thumbnailSize});
            reloadingForBundle.current = true;
            location.reload();
        }), [followDisk]);

    const save = useCallback(async (baseHash?: string) => {
        const {source, disk, dirty, formatted, errorCount, saving} = latest.current;
        if (source == null || disk == null || saving || (!dirty && baseHash == undefined))
            return;
        if (errorCount > 0 && !window.confirm(`${errorCount} ${errorCount == 1 ? "entry fails" : "entries fail"} to `
            + "encode, and SSG will fail on the file until they are fixed. Save anyway?"))
            return;
        setSaving(true);
        try
        {
            const result = await SourceApi.save(formatted, baseHash ?? disk.hash);
            if (result.conflict != undefined)
                setBanner({kind: "conflict", ...result.conflict});
            else
            {
                setDisk({text: formatted, hash: result.hash, normalized: formatted});
                setBanner(null);
            }
        }
        catch (err)
        {
            setBanner({kind: "error", message: getMessage(err)});
        }
        finally
        {
            setSaving(false);
        }
    }, []);

    const edit = useCallback((compositionIndex: number,
        update: (entry: PreEncodingSourceEntry) => PreEncodingSourceEntry, coalesceKey?: string) =>
    {
        commit(s => {
            if (s == null || s.compositions[compositionIndex] == undefined)
                return s;
            const entry = update(s.compositions[compositionIndex]);
            if (entry === s.compositions[compositionIndex])
                return s;
            const compositions = [...s.compositions];
            compositions[compositionIndex] = entry;
            return {...s, compositions};
        }, coalesceKey && `${compositionIndex}.${coalesceKey}`);
    }, [commit]);

    // Appended, since objects store their index: an entry added anywhere else would repaint every later one.
    const append = useCallback((makeEntry: (s: PreEncodingSource, compositionIndex: number) => PreEncodingSourceEntry) => {
        const current = latest.current.source;
        if (current == null)
            return;
        commit(s => s == null ? s : {...s, compositions: [...s.compositions, makeEntry(s, s.compositions.length)]});
        setSelectedIndex(current.compositions.length);
    }, [commit]);

    const addToType = useCallback((objectType: string) => append((s, compositionIndex) => {
        const last = [...s.compositions].reverse().find(entry => entry.objectType == objectType);
        return last != undefined ? EntryUtil.duplicate(last, compositionIndex) : EntryUtil.create(objectType, compositionIndex);
    }), [append]);

    const duplicate = useCallback((compositionIndex: number) => append((s, newIndex) =>
        EntryUtil.duplicate(s.compositions[compositionIndex], newIndex)), [append]);

    const remove = useCallback((compositionIndex: number) => {
        const count = latest.current.source?.compositions.length ?? 0;
        const consequence = (compositionIndex < count - 1)
            ? `Entries #${compositionIndex + 1}–#${count - 1} would each move down one index.`
            : "Nothing else moves.";
        if (!window.confirm(`Delete entry #${compositionIndex}?\n\n${consequence} Placed objects store their `
            + "index, so any already using an entry that moves or goes would show a different look (or another "
            + "type's, which they refuse). Entries are append-only once they have shipped."))
            return;
        commit(s => s == null ? s : {...s, compositions: EntryUtil.renumberIndexTags(
            s.compositions.filter((_, i) => i != compositionIndex))});
        setSelectedIndex(Math.max(0, Math.min(compositionIndex, count - 2)));
    }, [commit]);

    const move = useCallback((compositionIndex: number, direction: -1 | 1) => {
        const target = findNeighbourOfType(latest.current.source?.compositions ?? [], compositionIndex, direction);
        if (target < 0 || !window.confirm(`Swap entries #${compositionIndex} and #${target}?\n\nBoth change `
            + "index. Placed objects store their index, so any already using either would show the other's look."))
            return;
        commit(s => {
            if (s == null)
                return s;
            const swapped = [...s.compositions];
            [swapped[compositionIndex], swapped[target]] = [swapped[target], swapped[compositionIndex]];
            return {...s, compositions: EntryUtil.renumberIndexTags(swapped)};
        });
        setSelectedIndex(target);
    }, [commit]);

    const revert = useCallback(() => {
        const {disk} = latest.current;
        if (disk != null)
            followDisk(disk, latest.current, true);
    }, [followDisk]);

    const sectionTypes = useMemo(() =>
        [...new Set([...compositions.map(entry => entry.objectType), ...INDEXED_OBJECT_TYPES])], [compositions]);
    const indicesByType = useMemo(() => {
        const result: {[objectType: string]: number[]} = {};
        compositions.forEach((entry, i) => (result[entry.objectType] ??= []).push(i));
        return result;
    }, [compositions]);
    const displayOrder = useMemo(() => sectionTypes.flatMap(objectType => indicesByType[objectType] ?? []),
        [sectionTypes, indicesByType]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const modifier = event.metaKey || event.ctrlKey;
            const key = event.key.toLowerCase();
            if (modifier && key == "s")
            {
                event.preventDefault();
                save();
                return;
            }
            // Text boxes that keep their own undo.
            if (target?.closest("[data-native-undo]"))
                return;
            if (modifier && (key == "z" || key == "y"))
            {
                event.preventDefault();
                (key == "y" || event.shiftKey) ? redo() : undo();
                return;
            }
            const inControl = target != null && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
            if (!modifier && !inControl && (event.key == "ArrowLeft" || event.key == "ArrowRight"))
            {
                const position = displayOrder.indexOf(latest.current.selected);
                const next = displayOrder[position + (event.key == "ArrowRight" ? 1 : -1)];
                if (next != undefined)
                {
                    event.preventDefault();
                    setSelectedIndex(next);
                    document.querySelector(`[data-composition-index="${next}"]`)?.scrollIntoView({block: "nearest"});
                }
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [save, undo, redo, displayOrder]);

    useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (latest.current.dirty && !reloadingForBundle.current)
                event.preventDefault();
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    const onEditSelected = useCallback((update: (entry: PreEncodingSourceEntry) => PreEncodingSourceEntry,
        coalesceKey?: string) => edit(latest.current.selected, update, coalesceKey), [edit]);
    const onPreviewSelected = useCallback((entry: PreEncodingSourceEntry | null) =>
        setPreview(entry == null ? null : {compositionIndex: latest.current.selected, entry}), []);

    if (loadError != null)
    {
        return <div className="full-page-message">
            <h1>Can't open the source</h1>
            <p>{loadError}</p>
            <p className="muted">This page retries when the file changes.</p>
        </div>;
    }
    if (source == null)
        return <div className="full-page-message"><p className="muted">Loading…</p></div>;

    const selectedEntry = source.compositions[selected];
    const selectedEncoding = encodings[selected];
    const selectedTypeIndices = selectedEntry != undefined ? (indicesByType[selectedEntry.objectType] ?? []) : [];

    return <div className="app" style={{"--thumb": `${thumbnailSize}px`} as CSSProperties}>
        <HeaderBar sourcePath={sourcePath} dirty={dirty} saving={saving} errorCount={errorIndices.length}
            canUndo={history.canUndo} canRedo={history.canRedo}
            thumbnailSize={thumbnailSize} thumbnailSizes={THUMBNAIL_SIZES} onThumbnailSize={setThumbnailSize}
            onUndo={undo} onRedo={redo} onRevert={revert} onSave={() => save()}
            onShowFirstError={() => setSelectedIndex(errorIndices[0])} />
        {banner != null && <BannerBar banner={banner}
            onLoadDiskVersion={() => banner.kind != "error" && followDisk(banner, latest.current, true)}
            onKeepMine={() => {
                if (banner.kind == "external")
                    setDisk({text: banner.text, hash: banner.hash, normalized: SourceFormatUtil.format(parseSource(banner.text))});
                setBanner(null);
            }}
            onOverwrite={() => banner.kind == "conflict" && save(banner.hash)}
            onDismiss={() => setBanner(null)} />}
        <main className="workspace">
            <div className="catalog">
                {sectionTypes.map(objectType => <TypeSection key={objectType}
                    objectType={objectType}
                    compositionIndices={indicesByType[objectType] ?? []}
                    compositions={compositions}
                    encodings={encodings}
                    thumbnails={thumbnailsByType[objectType]}
                    isIndexedType={INDEXED_OBJECT_TYPES.includes(objectType)}
                    thumbnailSize={thumbnailSize}
                    selectedIndex={selected}
                    onSelect={setSelectedIndex}
                    onAdd={addToType} />)}
                <p className="catalog-note">
                    Saving writes the source file only. SSG turns it into the game's tables and thumbnail atlases
                    (<code>npm run dev</code>, or <code>npm run beforeCommit</code>).
                </p>
            </div>
            <aside className="inspector">
                {selectedEntry != undefined && selectedEncoding != undefined
                    ? <EntryInspector key={selected}
                        compositionIndex={selected}
                        entry={selectedEntry}
                        encoding={selectedEncoding}
                        bitmap={selectedEncoding.encoded != undefined
                            ? thumbnailsByType[selectedEntry.objectType]?.bitmapByEncoded.get(selectedEncoding.encoded)
                            : undefined}
                        positionInType={selectedTypeIndices.indexOf(selected)}
                        countInType={selectedTypeIndices.length}
                        objectTypes={INDEXED_OBJECT_TYPES}
                        canMoveEarlier={findNeighbourOfType(source.compositions, selected, -1) >= 0}
                        canMoveLater={findNeighbourOfType(source.compositions, selected, 1) >= 0}
                        onEdit={onEditSelected}
                        onPreview={onPreviewSelected}
                        onDuplicate={() => duplicate(selected)}
                        onDelete={() => remove(selected)}
                        onMove={(direction) => move(selected, direction)} />
                    : <div className="full-page-message"><p className="muted">No entries yet.</p></div>}
            </aside>
        </main>
    </div>;
}

function parseSource(text: string): PreEncodingSource
{
    const parsed = JSON.parse(text);
    if (parsed == null || !Array.isArray(parsed.compositions))
        throw new Error("It has no \"compositions\" list.");
    return parsed;
}

function findNeighbourOfType(compositions: PreEncodingSourceEntry[], compositionIndex: number, direction: -1 | 1): number
{
    const objectType = compositions[compositionIndex]?.objectType;
    for (let i = compositionIndex + direction; i >= 0 && i < compositions.length; i += direction)
    {
        if (compositions[i].objectType == objectType)
            return i;
    }
    return -1;
}

function getMessage(err: unknown): string
{
    return err instanceof Error ? err.message : String(err);
}

// sessionStorage can be unavailable (private windows, blocked site data); the editor then just starts fresh.
function putStash(stash: {source: PreEncodingSource, disk: DiskState, selected: number, thumbnailSize: number}): void
{
    try
    {
        sessionStorage.setItem(STASH_KEY, JSON.stringify(stash));
    }
    catch
    {
    }
}

function takeStash(): {source: PreEncodingSource, disk: DiskState, selected: number, thumbnailSize: number} | null
{
    try
    {
        const text = sessionStorage.getItem(STASH_KEY);
        sessionStorage.removeItem(STASH_KEY);
        return text != null ? JSON.parse(text) : null;
    }
    catch
    {
        return null;
    }
}
