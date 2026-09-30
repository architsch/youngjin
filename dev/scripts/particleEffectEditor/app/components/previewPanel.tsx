import { useEffect, useRef, useState } from "react";
import ParticleEffectConfig from "../../../../../src/client/graphics/particle/types/particleEffectConfig";
import { PreviewMode } from "../types/previewMode";
import { PreviewScene } from "../types/previewScene";
import PreviewSettings from "../types/previewSettings";
import PreviewStatus from "../types/previewStatus";
import PreviewStage from "../util/previewStage";
import ChoiceControl from "./choiceControl";
import NumberBox from "./numberBox";
import WaveformControl from "./waveformControl";

const SPEED_LABELS: {[speed: string]: string} = {"1": "1×", "0.5": "½×", "0.25": "¼×", "0.1": "⅒×"};
const SCENE_LABELS: {[scene in PreviewScene]: string} = {block: "Block", floor: "Floor", wall: "Wall", air: "Air"};
const SCENE_NOTES: {[scene in PreviewScene]: string} = {
    block: "At a block's middle with the block standing there.",
    floor: "At a block's middle over bare floor, as a block just removed plays its effect.",
    wall: "Just out of a wall and facing away from it, as an object on a wall plays its effect.",
    air: "Well above the floor, facing up.",
};
const MODE_LABELS: {[mode in PreviewMode]: string} = {auto: "Auto", oneShot: "Once", emitter: "Emitter"};

// The selected effect played live, as the game draws it (see PreviewStage).
export default function PreviewPanel({ effect, effects, settings, onSettings }: Props)
{
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stageRef = useRef<PreviewStage | null>(null);
    const [status, setStatus] = useState<PreviewStatus | null>(null);
    const [startError, setStartError] = useState<string | null>(null);

    useEffect(() => {
        const stage = new PreviewStage(canvasRef.current!, settings, setStatus);
        stageRef.current = stage;
        stage.setEffects(effects);
        stage.setEffect(effect);
        stage.start().catch(err => setStartError(`The preview failed to start: ${err instanceof Error ? err.message : err}`));
        return () => {
            stage.dispose();
            stageRef.current = null;
        };
    }, []);
    useEffect(() => {
        stageRef.current?.setEffects(effects);
    }, [effects]);
    useEffect(() => {
        stageRef.current?.setEffect(effect);
    }, [effect]);
    useEffect(() => {
        stageRef.current?.setSettings(settings);
    }, [settings]);

    // Space replays, unless it is typing or pressing a control.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (event.key != " " || event.metaKey || event.ctrlKey
                || target?.closest("input, select, textarea, button, summary") != null)
                return;
            event.preventDefault();
            stageRef.current?.replay();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const set = (change: Partial<PreviewSettings>) => onSettings({...settings, ...change});
    const time = status?.time ?? 0;
    const duration = status?.duration ?? 0;

    return <section className="preview-panel" aria-label="Preview">
        <div className="preview-viewport">
            <canvas ref={canvasRef} className="preview-canvas" />
            {status != null && <div className="preview-overlay">
                <span className="preview-badge">{(status.mode == "emitter") ? "emitter" : "one-shot"}</span>
                <span className="preview-stat">
                    {status.particles} particles · {status.drawCalls} draw {status.drawCalls == 1 ? "call" : "calls"}
                    {status.overwrites > 0 && ` · ${status.overwrites} overwritten`}
                </span>
            </div>}
            {status != null && !status.previewable && <div className="preview-message">
                Fix this effect's problems to play it.
            </div>}
            {startError != null && <div className="preview-message error">{startError}</div>}
            <button type="button" className="icon-button preview-camera-reset" title="Back to the starting view"
                aria-label="Reset the view" onClick={() => stageRef.current?.resetCamera()}>⟲</button>
        </div>
        <div className="preview-controls">
            <div className="preview-row">
                <button type="button" className="button primary" onClick={() => stageRef.current?.replay()}
                    title="Play it from the start (Space)">Replay</button>
                <label className="checkbox" title="Play it again once it ends">
                    <input type="checkbox" checked={settings.loop} onChange={(event) => set({loop: event.target.checked})} />
                    Loop
                </label>
                <span className="preview-label">Speed</span>
                <ChoiceControl options={Object.keys(SPEED_LABELS)} labels={SPEED_LABELS} value={String(settings.speed)}
                    onChange={(speed) => set({speed: Number(speed)})} />
                <button type="button" className="button small" onClick={() => set({seed: settings.seed + 1})}
                    title="Play it with other random particles (each replay repeats the same ones)">Reshuffle</button>
            </div>
            {status?.mode == "oneShot" && <div className="preview-row timeline">
                <input type="range" className="slider" min={0} max={Math.max(duration, 0.01)} step={0.005}
                    value={Math.min(time, duration)} aria-label="Moment"
                    title="Drag to hold the effect at a moment"
                    onChange={(event) => stageRef.current?.scrubTo(Number(event.target.value))} />
                <span className="preview-time">{time.toFixed(2)} / {duration.toFixed(2)} s</span>
                <button type="button" className="button small" disabled={!status.frozen}
                    onClick={() => stageRef.current?.resume()}>Resume</button>
            </div>}
            <div className="preview-row">
                <span className="preview-label">Scene</span>
                <ChoiceControl options={Object.keys(SCENE_LABELS)} labels={SCENE_LABELS} value={settings.scene}
                    onChange={(scene) => set({scene: scene as PreviewScene})} />
                <ChoiceControl options={["light", "dark"]} labels={{light: "Light floor", dark: "Dark floor"}}
                    value={settings.darkFloor ? "dark" : "light"} onChange={(floor) => set({darkFloor: floor == "dark"})} />
            </div>
            <div className="preview-row">
                <span className="preview-label" title="Auto plays from an emitter when a layer emits at a rate without end">
                    Play
                </span>
                <ChoiceControl options={Object.keys(MODE_LABELS)} labels={MODE_LABELS} value={settings.mode}
                    onChange={(mode) => set({mode: mode as PreviewMode})} />
                <span className="preview-label" title="Sizes the effect, its speeds and its spawn box together, as an object's footprint does">
                    Scale
                </span>
                <NumberBox value={settings.scale} step={0.25} label="Scale"
                    onChange={(scale) => set({scale: Math.max(0.05, scale)})} />
            </div>
            {status?.mode == "emitter" && <div className="preview-row">
                <span className="preview-label">Level</span>
                <WaveformControl value={settings.level} onChange={(level) => set({level})} />
            </div>}
            {status != null && status.warnings.length > 0 && <div className="notice warning"><ul>
                {status.warnings.map(warning => <li key={warning}>{warning}</li>)}
            </ul></div>}
            <p className="preview-note">
                {SCENE_NOTES[settings.scene]} Drag to orbit, scroll to zoom. There are no lamps, so lit layers show
                unlit.
            </p>
        </div>
    </section>;
}

interface Props
{
    effect: string;
    effects: {[effect: string]: ParticleEffectConfig};
    settings: PreviewSettings;
    onSettings: (settings: PreviewSettings) => void;
}
