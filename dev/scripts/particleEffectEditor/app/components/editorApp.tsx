import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveformUtil from "../../../../../src/shared/math/util/waveformUtil";
import ParticleEffectConfig from "../../../../../src/client/graphics/particle/types/particleEffectConfig";
import ParticleEffectConfigUtil from "../../../../../src/client/graphics/particle/util/particleEffectConfigUtil";
import useHistory from "../hooks/useHistory";
import DiskState from "../types/diskState";
import EditorBanner from "../types/editorBanner";
import ParticleEffectSource from "../types/particleEffectSource";
import PreviewSettings from "../types/previewSettings";
import EffectSourceUtil from "../util/effectSourceUtil";
import SourceApi from "../util/sourceApi";
import SourceFormatUtil from "../util/sourceFormatUtil";
import BannerBar from "./bannerBar";
import EffectInspector from "./effectInspector";
import EffectList from "./effectList";
import HeaderBar from "./headerBar";
import PreviewPanel from "./previewPanel";

// Carries unsaved edits across the reload that follows a rebuild of the editor.
const STASH_KEY = "particleEffectEditor.stash";
const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
    scene: "floor", mode: "auto", loop: true, speed: 1, scale: 1, darkFloor: false,
    level: WaveformUtil.constant(1), seed: 1,
};
// Where code names an effect, for the warning before a rename or delete.
const NAME_USERS = "ParticleTriggerUtil's gameplay events, emitter descriptors in object type configs, and "
    + "play_vfx steps";

export default function EditorApp()
{
    const history = useHistory<ParticleEffectSource | null>(null);
    const {commit, reset, undo, redo} = history;
    const source = history.present;

    const [sourcePath, setSourcePath] = useState("");
    const [disk, setDisk] = useState<DiskState | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [banner, setBanner] = useState<EditorBanner | null>(null);
    const [selectedName, setSelectedName] = useState("");
    const [previewSettings, setPreviewSettings] = useState(DEFAULT_PREVIEW_SETTINGS);
    const [saving, setSaving] = useState(false);
    const reloadingForBundle = useRef(false);
    const inspectorRef = useRef<HTMLDivElement>(null);

    const effects = useMemo(() => source?.effects ?? {}, [source]);
    const names = Object.keys(effects);
    const selected = (selectedName in effects) ? selectedName : (names[0] ?? "");
    // A block body: scrollTo returns a promise in newer browsers, which React would call as a clean-up.
    useEffect(() => {
        inspectorRef.current?.scrollTo({top: 0});
    }, [selected]);
    const problemsByEffect = useMemo(() => Object.fromEntries(Object.entries(effects)
        .map(([name, config]) => [name, ParticleEffectConfigUtil.getProblems(config)])), [effects]);
    const problemCounts = useMemo(() => Object.fromEntries(Object.entries(problemsByEffect)
        .map(([name, problems]) => [name, problems.length])), [problemsByEffect]);
    const namesWithProblems = names.filter(name => problemsByEffect[name].length > 0);
    const formatted = useMemo(() => (source != null) ? SourceFormatUtil.format(source) : "", [source]);
    const dirty = source != null && disk != null && formatted != disk.normalized;

    const latest = useRef({source, disk, dirty, formatted, selected, previewSettings, problemCount: 0, saving});
    latest.current = {source, disk, dirty, formatted, selected, previewSettings,
        problemCount: namesWithProblems.length, saving};

    const followDisk = useCallback((loaded: {text: string, hash: string},
        current: {source: ParticleEffectSource | null, disk: DiskState | null}, force: boolean): void =>
    {
        if (!force && current.disk != null && loaded.hash == current.disk.hash)
            return;
        let parsed: ParticleEffectSource;
        try
        {
            parsed = EffectSourceUtil.parse(loaded.text);
        }
        catch (err)
        {
            setBanner({kind: "error", message: `The file on disk can't be read: ${getMessage(err)}`});
            return;
        }
        const normalized = SourceFormatUtil.format(parsed);
        const currentFormatted = (current.source != null) ? SourceFormatUtil.format(current.source) : null;
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
                setSelectedName(stash.selected);
                setPreviewSettings(stash.previewSettings);
                followDisk(loaded, {source: stash.source, disk: stash.disk}, false);
                return;
            }
            try
            {
                EffectSourceUtil.parse(loaded.text);
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
            const {source, disk, selected, previewSettings} = latest.current;
            if (source != null && disk != null)
                putStash({source, disk, selected, previewSettings});
            reloadingForBundle.current = true;
            location.reload();
        }), [followDisk]);

    const save = useCallback(async (baseHash?: string) => {
        const {source, disk, dirty, formatted, problemCount, saving} = latest.current;
        if (source == null || disk == null || saving || (!dirty && baseHash == undefined))
            return;
        if (problemCount > 0 && !window.confirm(`${problemCount} ${problemCount == 1 ? "effect has" : "effects have"} `
            + "problems. particle.test.ts fails on the file until they are fixed, and the game may not load its "
            + "particles. Save anyway?"))
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

    const editEffect = useCallback((name: string, update: (config: ParticleEffectConfig) => ParticleEffectConfig,
        coalesceKey?: string) =>
    {
        commit(s => {
            if (s == null || s.effects[name] == undefined)
                return s;
            const config = update(s.effects[name]);
            return (config === s.effects[name]) ? s : {...s, effects: {...s.effects, [name]: config}};
        }, coalesceKey && `${name}.${coalesceKey}`);
    }, [commit]);

    const addEffect = useCallback(() => {
        const name = EffectSourceUtil.getFreeName(latest.current.source?.effects ?? {}, "newEffect");
        commit(s => (s == null) ? s : {...s, effects: EffectSourceUtil.withEffect(s.effects, name,
            EffectSourceUtil.createEffect())});
        setSelectedName(name);
    }, [commit]);

    const duplicateEffect = useCallback((name: string) => {
        const copyName = EffectSourceUtil.getFreeName(latest.current.source?.effects ?? {}, `${name}Copy`);
        commit(s => (s == null || s.effects[name] == undefined) ? s : {...s, effects: EffectSourceUtil.withEffect(
            s.effects, copyName, EffectSourceUtil.copy(s.effects[name]), name)});
        setSelectedName(copyName);
    }, [commit]);

    const renameEffect = useCallback((from: string, to: string): boolean => {
        if (!window.confirm(`Rename "${from}" to "${to}"?\n\nCode plays effects by name (${NAME_USERS}); anything `
            + `naming "${from}" plays nothing until it names "${to}".`))
            return false;
        commit(s => (s == null) ? s : {...s, effects: EffectSourceUtil.renamed(s.effects, from, to)});
        setSelectedName(to);
        return true;
    }, [commit]);

    const deleteEffect = useCallback((name: string) => {
        if (!window.confirm(`Delete "${name}"?\n\nCode plays effects by name (${NAME_USERS}); anything naming it `
            + "plays nothing."))
            return;
        const order = Object.keys(latest.current.source?.effects ?? {});
        const index = order.indexOf(name);
        commit(s => (s == null) ? s : {...s, effects: EffectSourceUtil.without(s.effects, name)});
        setSelectedName(order[index + 1] ?? order[index - 1] ?? "");
    }, [commit]);

    const revert = useCallback(() => {
        const {disk} = latest.current;
        if (disk != null)
            followDisk(disk, latest.current, true);
    }, [followDisk]);

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
            if (!modifier && !inControl && (event.key == "ArrowUp" || event.key == "ArrowDown"))
            {
                const order = Object.keys(latest.current.source?.effects ?? {});
                const next = order[order.indexOf(latest.current.selected) + ((event.key == "ArrowDown") ? 1 : -1)];
                if (next != undefined)
                {
                    event.preventDefault();
                    setSelectedName(next);
                    document.querySelector(`[data-effect="${next}"]`)?.scrollIntoView({block: "nearest"});
                }
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [save, undo, redo]);

    useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (latest.current.dirty && !reloadingForBundle.current)
                event.preventDefault();
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    const onEditSelected = useCallback((update: (config: ParticleEffectConfig) => ParticleEffectConfig,
        coalesceKey?: string) => editEffect(latest.current.selected, update, coalesceKey), [editEffect]);

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

    const selectedConfig = effects[selected];
    return <div className="app">
        <HeaderBar sourcePath={sourcePath} dirty={dirty} saving={saving} problemCount={namesWithProblems.length}
            canUndo={history.canUndo} canRedo={history.canRedo}
            onUndo={undo} onRedo={redo} onRevert={revert} onSave={() => save()}
            onShowFirstProblem={() => setSelectedName(namesWithProblems[0])} />
        {banner != null && <BannerBar banner={banner}
            onLoadDiskVersion={() => banner.kind != "error" && followDisk(banner, latest.current, true)}
            onKeepMine={() => {
                if (banner.kind == "external")
                    setDisk({text: banner.text, hash: banner.hash,
                        normalized: SourceFormatUtil.format(EffectSourceUtil.parse(banner.text))});
                setBanner(null);
            }}
            onOverwrite={() => banner.kind == "conflict" && save(banner.hash)}
            onDismiss={() => setBanner(null)} />}
        <main className="workspace">
            <EffectList effects={effects} selected={selected} problemCounts={problemCounts}
                onSelect={setSelectedName} onAdd={addEffect} />
            <div className="inspector" ref={inspectorRef}>
                {(selectedConfig != null && typeof selectedConfig == "object")
                    ? <EffectInspector key={selected}
                        name={selected}
                        config={selectedConfig}
                        effects={effects}
                        problems={problemsByEffect[selected] ?? []}
                        onRename={(to) => renameEffect(selected, to)}
                        onEdit={onEditSelected}
                        onDuplicate={() => duplicateEffect(selected)}
                        onDelete={() => deleteEffect(selected)} />
                    : <div className="full-page-message"><p className="muted">
                        {(names.length == 0) ? "No effects yet." : `"${selected}" isn't an object; fix it in the file.`}
                    </p></div>}
            </div>
            <PreviewPanel effect={selected} effects={effects} settings={previewSettings}
                onSettings={setPreviewSettings} />
        </main>
    </div>;
}

function getMessage(err: unknown): string
{
    return (err instanceof Error) ? err.message : String(err);
}

// sessionStorage can be unavailable (private windows, blocked site data); the editor then just starts fresh.
function putStash(stash: {source: ParticleEffectSource, disk: DiskState, selected: string,
    previewSettings: PreviewSettings}): void
{
    try
    {
        sessionStorage.setItem(STASH_KEY, JSON.stringify(stash));
    }
    catch
    {
    }
}

function takeStash(): {source: ParticleEffectSource, disk: DiskState, selected: string,
    previewSettings: PreviewSettings} | null
{
    try
    {
        const text = sessionStorage.getItem(STASH_KEY);
        sessionStorage.removeItem(STASH_KEY);
        return (text != null) ? JSON.parse(text) : null;
    }
    catch
    {
        return null;
    }
}
