import { useEffect, useRef, useState } from "react";
import ImageRecipe from "../../core/imageRecipe";
import SampleRenderUtil from "../../core/sampleRenderUtil";
import LoadedSource from "../types/loadedSource";
import EditorApi from "../util/editorApi";
import useZoomStage from "../hooks/useZoomStage";
import ZoomControls from "./zoomControls";

// A retouch smaller than this (as a fraction of the source) is taken for a stray click.
const MIN_RETOUCH_SIZE = 0.004;

type Drag =
    | {kind: "corner", index: number, id: number}
    | {kind: "move", start: [number, number], corners: [number, number][], id: number}
    | {kind: "retouch", start: [number, number]};

let nextDragId = 0;

// The source photo on a zoom stage (see useZoomStage), with the quad sampled from it (dragged by its corners, or
// moved whole from inside; outlined again where a tilt turns what it takes) and the rects painted over before
// sampling (drawn in "Retouch"). A drag from outside the quad pans. Zoomed in, the photo itself is drawn over its
// small copy, which has no more detail to show.
export default function SourceView({ source, recipe, keepRectangle, viewSwitch, onChange, onChangeSource }: Props)
{
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<Drag | null>(null);
    const [mode, setMode] = useState<"sample" | "retouch">("sample");
    const [drawnRect, setDrawnRect] = useState<[number, number, number, number] | null>(null);
    // The source whose photo was asked for, which then stays, so zooming back out doesn't fetch it again.
    const [detailSha1, setDetailSha1] = useState<string>();
    const own = SampleRenderUtil.getWorkedSourceSize(source.width, source.height);
    const stage = useZoomStage(own, true);
    const devicePixels = stage.width * (window.devicePixelRatio || 1);

    useEffect(() => {
        const canvas = canvasRef.current!;
        canvas.width = source.preview.width;
        canvas.height = source.preview.height;
        canvas.getContext("2d")!.drawImage(source.previewCanvas, 0, 0);
    }, [source]);

    useEffect(() => {
        if (!stage.fitted && devicePixels > source.preview.width)
            setDetailSha1(source.sha1);
    }, [stage.fitted, devicePixels, source]);

    const toFraction = (ev: React.PointerEvent): [number, number] => {
        const rect = overlayRef.current!.getBoundingClientRect();
        return [clamp01((ev.clientX - rect.left) / rect.width), clamp01((ev.clientY - rect.top) / rect.height)];
    };

    // A press it doesn't take (another button, with Space held, or outside the quad) is the stage's, which pans.
    const onPointerDown = (ev: React.PointerEvent) => {
        if (ev.button != 0 || stage.spaceHeld)
            return;
        const point = toFraction(ev);
        const cornerIndex = (ev.target as HTMLElement).dataset.corner;
        if (cornerIndex != undefined)
            dragRef.current = {kind: "corner", index: Number(cornerIndex), id: nextDragId++};
        else if (mode == "retouch")
            dragRef.current = {kind: "retouch", start: point};
        else if (isInsidePolygon(recipe.corners, point))
            dragRef.current = {kind: "move", start: point, corners: recipe.corners, id: nextDragId++};
        else
            return;
        ev.stopPropagation();
        overlayRef.current!.setPointerCapture(ev.pointerId);
    };

    const onPointerMove = (ev: React.PointerEvent) => {
        const drag = dragRef.current;
        if (drag == null)
            return;
        const [x, y] = toFraction(ev);
        if (drag.kind == "corner")
        {
            onChange(r => ({...r, corners: moveCorner(r.corners, drag.index, x, y, keepRectangle)}), `drag-${drag.id}`);
        }
        else if (drag.kind == "move")
        {
            // As far as keeps every corner on the source.
            const xs = drag.corners.map(c => c[0]);
            const ys = drag.corners.map(c => c[1]);
            const dx = Math.min(1 - Math.max(...xs), Math.max(-Math.min(...xs), x - drag.start[0]));
            const dy = Math.min(1 - Math.max(...ys), Math.max(-Math.min(...ys), y - drag.start[1]));
            onChange(r => ({...r, corners: drag.corners.map(([cx, cy]) => [cx + dx, cy + dy])}), `drag-${drag.id}`);
        }
        else
        {
            setDrawnRect([Math.min(x, drag.start[0]), Math.min(y, drag.start[1]),
                Math.abs(x - drag.start[0]), Math.abs(y - drag.start[1])]);
        }
    };

    const onPointerUp = () => {
        if (dragRef.current?.kind == "retouch" && drawnRect != null
            && drawnRect[2] > MIN_RETOUCH_SIZE && drawnRect[3] > MIN_RETOUCH_SIZE)
        {
            const rect = drawnRect;
            onChange(r => ({...r, retouches: [...r.retouches, rect]}));
        }
        dragRef.current = null;
        setDrawnRect(null);
    };

    const quadPoints = recipe.corners.map(([x, y]) => `${x},${y}`).join(" ");
    const sampledPoints = recipe.rotation ? SampleRenderUtil.getSampledOutline(source.width, source.height, recipe)
        .map(([x, y]) => `${x},${y}`).join(" ") : undefined;
    return <section className="source-view">
        <div className="panel-toolbar">
            {viewSwitch}
            <span className="panel-note source-name">{source.fileName} ({source.width}x{source.height})</span>
            <button type="button" className="button small" onClick={onChangeSource}
                title="Sample this entry from another photo in the library">Change source…</button>
            <ZoomControls stage={stage} fitTitle="Fit the whole source in view"
                fullSizeTitle="One pixel of the source, as it is sampled, to one pixel on screen"/>
            <div className="segmented">
                <button type="button" className={mode == "sample" ? "active" : ""} onClick={() => setMode("sample")}
                    title="Drag the corners to choose what to sample; drag inside to move it">Area</button>
                <button type="button" className={mode == "retouch" ? "active" : ""} onClick={() => setMode("retouch")}
                    title="Drag over something to paint it out (a logo, a label)">Retouch</button>
            </div>
        </div>
        <div {...stage.stageProps}>
            <div {...stage.contentProps}>
                <div className={`source-frame${devicePixels > 1.5 * own.width ? " pixelated" : ""}`}
                    style={{width: stage.width, height: stage.height}}>
                    <canvas ref={canvasRef} className="source-canvas"/>
                    {detailSha1 == source.sha1 && <img className="source-detail" alt="" draggable={false}
                        src={EditorApi.getSourceURL(source.sha1)}/>}
                    <div ref={overlayRef} className={`source-overlay mode-${stage.spaceHeld ? "pan" : mode}`}
                        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                        onPointerCancel={onPointerUp}>
                        <svg viewBox="0 0 1 1" preserveAspectRatio="none">
                            <polygon points={quadPoints} className="quad"/>
                            {sampledPoints != undefined && <polygon points={sampledPoints} className="sampled-outline"/>}
                        </svg>
                        {recipe.retouches.map((rect, i) => <div key={i} className="retouch-rect" style={toStyle(rect)}>
                            <button type="button" className="retouch-remove" title="Remove this retouch"
                                onPointerDown={ev => ev.stopPropagation()}
                                onClick={() => onChange(r => ({...r, retouches: r.retouches.filter((_, j) => j != i)}))}>×</button>
                        </div>)}
                        {drawnRect != null && <div className="retouch-rect drawing" style={toStyle(drawnRect)}/>}
                        {recipe.corners.map(([x, y], i) => <div key={i} data-corner={i} className="corner-handle"
                            style={{left: `${x * 100}%`, top: `${y * 100}%`}}/>)}
                    </div>
                </div>
            </div>
        </div>
        <div className="panel-hint">Wheel to zoom. Drag with the middle button, or hold Space, to pan
            (or just drag from outside the sampled area).</div>
    </section>;
}

// A rectangle stays one: the corners beside the moved one follow it.
function moveCorner(corners: [number, number][], index: number, x: number, y: number,
    keepRectangle: boolean): [number, number][]
{
    const moved = corners.map(corner => [...corner] as [number, number]);
    moved[index] = [x, y];
    if (keepRectangle)
    {
        // Corners go clockwise from the top-left, so the one after shares y on the top and bottom edges.
        const sharesY = (index % 2 == 0) ? (index + 1) % 4 : (index + 3) % 4;
        const sharesX = (index % 2 == 0) ? (index + 3) % 4 : (index + 1) % 4;
        moved[sharesY][1] = y;
        moved[sharesX][0] = x;
    }
    return moved;
}

function isInsidePolygon(points: [number, number][], [x, y]: [number, number]): boolean
{
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++)
    {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
}

function toStyle([x, y, width, height]: [number, number, number, number]): React.CSSProperties
{
    return {left: `${x * 100}%`, top: `${y * 100}%`, width: `${width * 100}%`, height: `${height * 100}%`};
}

function clamp01(value: number): number
{
    return Math.min(1, Math.max(0, value));
}

interface Props
{
    source: LoadedSource;
    recipe: ImageRecipe;
    keepRectangle: boolean;
    // The middle panel's Source | Sample switch.
    viewSwitch: React.ReactNode;
    onChange: (update: (recipe: ImageRecipe) => ImageRecipe, coalesceKey?: string) => void;
    onChangeSource: () => void;
}
