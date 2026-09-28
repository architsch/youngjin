import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import RgbaImage from "../../core/rgbaImage";
import ImageRecipe from "../../core/imageRecipe";
import RecipeBackground from "../../core/recipeBackground";
import SampleRenderUtil, { MAX_SAMPLE_SIDE, MAX_SOURCE_SIDE } from "../../core/sampleRenderUtil";
import LoadedSource from "../types/loadedSource";
import SampleToolSettings from "../types/sampleToolSettings";
import usePreview from "../hooks/usePreview";
import SampleCanvas from "./sampleCanvas";

const MAX_ZOOM = 16; // one sample pixel shown this many CSS pixels wide
const ZOOM_STEP = 1.5;
const WHEEL_ZOOM_RATE = 0.0015; // per pixel of wheel travel
const STAGE_PADDING = 24; // in CSS pixels, around the sample
// Renders are asked for in steps of this many pixels, so zooming doesn't ask for a new one at every tick.
const DETAIL_SIDE_STEP = 256;

// The sample magnified in the middle panel, for work by hand: zoomed around the pointer by the wheel (or to fit, or
// to its own pixels), panned by dragging with the middle button, with Space held, or with no tool chosen. It is
// rendered from the full-size source at the resolution the zoom shows, never more than the saved sample has;
// until that lands, the side panel's render stands in.
export default function SampleView(props: Props)
{
    const { source, recipe, settings, fallback, cellSize, onChange } = props;
    const stageRef = useRef<HTMLDivElement>(null);
    const [stageSize, setStageSize] = useState({width: 0, height: 0});
    const [zoom, setZoom] = useState<number | "fit">("fit");
    const [spaceHeld, setSpaceHeld] = useState(false);
    const panRef = useRef<{x: number, y: number, left: number, top: number} | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    // Where the pointer was over the sample when a zoom was asked for, to keep it there.
    const anchorRef = useRef<{u: number, v: number, clientX: number, clientY: number} | null>(null);

    useEffect(() => {
        const stage = stageRef.current!;
        const update = () => setStageSize({width: stage.clientWidth, height: stage.clientHeight});
        update();
        const observer = new ResizeObserver(update);
        observer.observe(stage);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const isTyping = (ev: KeyboardEvent) => ev.target instanceof HTMLElement
            && ev.target.closest("input, textarea, select, [contenteditable]") != null;
        const onKeyDown = (ev: KeyboardEvent) => {
            if (ev.code == "Space" && !isTyping(ev))
            {
                ev.preventDefault();
                setSpaceHeld(true);
            }
        };
        const onKeyUp = (ev: KeyboardEvent) => {
            if (ev.code == "Space")
                setSpaceHeld(false);
        };
        const onBlur = () => setSpaceHeld(false);
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", onBlur);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", onBlur);
        };
    }, []);

    // The saved sample's size: sampled, as the server does, from the source no larger than MAX_SOURCE_SIDE.
    const sourceScale = Math.min(1, MAX_SOURCE_SIDE / Math.max(source.width, source.height));
    const sourceWidth = Math.max(1, Math.round(source.width * sourceScale));
    const sourceHeight = Math.max(1, Math.round(source.height * sourceScale));
    const own = SampleRenderUtil.getSampleSize(sourceWidth, sourceHeight, recipe);
    const fitZoom = Math.max(0.01, Math.min((stageSize.width - 2 * STAGE_PADDING) / own.width,
        (stageSize.height - 2 * STAGE_PADDING) / own.height));
    const minZoom = Math.min(fitZoom, 1) / 2;
    const scale = (zoom == "fit") ? fitZoom : zoom;
    const width = own.width * scale;
    const height = own.height * scale;
    const neededSide = Math.max(width, height) * (window.devicePixelRatio || 1);
    const detailSide = Math.min(MAX_SAMPLE_SIDE, Math.max(own.width, own.height),
        Math.ceil(neededSide / DETAIL_SIDE_STEP) * DETAIL_SIDE_STEP);
    const detail = usePreview(source, recipe, settings.showRemoved, cellSize, detailSide);
    const shown = detail?.shown ?? fallback;
    const rendering = detail == undefined
        || detail.shown.width != SampleRenderUtil.getSampleSize(sourceWidth, sourceHeight, recipe, detailSide).width;
    const panning = spaceHeld || settings.tool == "none";

    const zoomTo = (next: number, clientX?: number, clientY?: number) => {
        const stage = stageRef.current!;
        const frame = stage.querySelector(".sample-frame")!.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        const x = clientX ?? stageRect.left + stageRect.width / 2;
        const y = clientY ?? stageRect.top + stageRect.height / 2;
        anchorRef.current = {u: (x - frame.left) / frame.width, v: (y - frame.top) / frame.height, clientX: x, clientY: y};
        setZoom(Math.min(MAX_ZOOM, Math.max(minZoom, next)));
    };

    // Scrolled so the point asked to zoom around stays under the pointer.
    useLayoutEffect(() => {
        const anchor = anchorRef.current;
        if (anchor == null)
            return;
        anchorRef.current = null;
        const stage = stageRef.current!;
        const frame = stage.querySelector(".sample-frame")!.getBoundingClientRect();
        stage.scrollLeft += frame.left + anchor.u * frame.width - anchor.clientX;
        stage.scrollTop += frame.top + anchor.v * frame.height - anchor.clientY;
    }, [scale]);

    // Not passive, so the page doesn't scroll as well.
    useEffect(() => {
        const stage = stageRef.current!;
        const onWheel = (ev: WheelEvent) => {
            ev.preventDefault();
            zoomTo(scale * Math.exp(-ev.deltaY * WHEEL_ZOOM_RATE), ev.clientX, ev.clientY);
        };
        stage.addEventListener("wheel", onWheel, {passive: false});
        return () => stage.removeEventListener("wheel", onWheel);
    });

    const onPointerDown = (ev: React.PointerEvent) => {
        if (ev.button != 1 && !(ev.button == 0 && panning))
            return;
        ev.preventDefault();
        const stage = stageRef.current!;
        stage.setPointerCapture(ev.pointerId);
        panRef.current = {x: ev.clientX, y: ev.clientY, left: stage.scrollLeft, top: stage.scrollTop};
        setIsPanning(true);
    };
    const onPointerMove = (ev: React.PointerEvent) => {
        const pan = panRef.current;
        if (pan == null)
            return;
        const stage = stageRef.current!;
        stage.scrollLeft = pan.left - (ev.clientX - pan.x);
        stage.scrollTop = pan.top - (ev.clientY - pan.y);
    };
    const onPointerUp = () => {
        panRef.current = null;
        setIsPanning(false);
    };

    return <section className="sample-view">
        <div className="panel-toolbar">
            {props.viewSwitch}
            <span className="panel-note">{own.width}×{own.height} px{rendering ? " · rendering…" : ""}</span>
            <div className="zoom-controls">
                <button type="button" className="button small" onClick={() => zoomTo(scale / ZOOM_STEP)} title="Zoom out">−</button>
                <span className="zoom-level">{Math.round(scale * 100)}%</span>
                <button type="button" className="button small" onClick={() => zoomTo(scale * ZOOM_STEP)} title="Zoom in">+</button>
                <button type="button" className={`button small${zoom == "fit" ? " active" : ""}`}
                    onClick={() => setZoom("fit")} title="Fit the whole sample in view">Fit</button>
                <button type="button" className="button small" onClick={() => zoomTo(1)}
                    title="One pixel of the saved sample to one pixel on screen">100%</button>
            </div>
        </div>
        <div ref={stageRef} className={`sample-view-stage${isPanning ? " panning" : ""}`}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp} onMouseDown={ev => { if (ev.button == 1) ev.preventDefault(); }}>
            <div className="sample-view-content" style={{padding: STAGE_PADDING}}>
                <SampleCanvas shown={shown} recipe={recipe} settings={settings} width={width} height={height}
                    panning={panning} pixelated={width * (window.devicePixelRatio || 1) > 1.5 * shown.width}
                    startBackground={props.startBackground} focusedSelection={props.focusedSelection}
                    onFocusSelection={props.onFocusSelection} onChange={onChange}/>
            </div>
        </div>
        <div className="panel-hint">Wheel to zoom. Drag with the middle button, or hold Space, to pan
            (or just drag, with no tool chosen).</div>
    </section>;
}

interface Props
{
    source: LoadedSource;
    recipe: ImageRecipe;
    settings: SampleToolSettings;
    // The side panel's render, shown until this view's own lands.
    fallback: RgbaImage;
    cellSize: number;
    startBackground: RecipeBackground;
    focusedSelection: number | undefined;
    onFocusSelection: (index: number | undefined) => void;
    // The middle panel's Source | Sample switch.
    viewSwitch: ReactNode;
    onChange: (update: (recipe: ImageRecipe) => ImageRecipe) => void;
}
