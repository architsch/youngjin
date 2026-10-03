import { useEffect, useRef, useState } from "react";
import RgbaImage from "../../core/rgbaImage";
import ImageRecipe from "../../core/imageRecipe";
import RecipeBackground from "../../core/recipeBackground";
import RecipeSelection from "../../core/recipeSelection";
import SelectionGeometryUtil, { SelectionHandle } from "../../core/selectionGeometryUtil";
import PixelUtil from "../util/pixelUtil";
import SampleToolSettings from "../types/sampleToolSettings";

// A stroke's next point is kept once the pointer has moved this share of the brush's radius, so a fine brush
// follows the pointer as closely as a broad one.
const STROKE_STEP_PER_RADIUS = 0.3;
// A press let go within this many CSS pixels of where it went down was a click, which picks a selection (or, on a
// handle, does nothing); one that went further was a drag.
const CLICK_TRAVEL = 4;
// A selection dragged out narrower than this, in the sample's pixels, is too thin to keep.
const MIN_SELECTION_SIDE = 2;
// The focused selection's handles, in CSS pixels whatever the zoom: their radius, and how far above the top side
// the turning knob stands.
const HANDLE_RADIUS = 6;
const TURN_KNOB_OFFSET = 22;
// A resize handle's cursor, by the direction it faces (in steps of 45° from east, either way along the line).
const RESIZE_CURSORS = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"];

// A press with the selection tool: on the sample, where it draws a selection anew, or on one of the focused
// selection's handles, where it moves, resizes or turns that one. It is a click until it has travelled far enough to
// be a drag, and current is what the drag has made so far.
type SelectionDrag = {press: [number, number], dragged: boolean, current: RecipeSelection} & (
    | {kind: "draw", start: [number, number]}
    | {kind: "move", index: number, start: [number, number]}
    | {kind: "resize", index: number, handle: Exclude<SelectionHandle, "turn" | "move">}
    | {kind: "turn", index: number});

// The sample at a given size on a checkerboard, and the tools that point at it (see SampleTool): background marks,
// brush strokes, a patch of color taken out and the selections, all recorded in fractions of the sample, so they
// land alike at any size. With the selection tool, a drag from one of the focused selection's handles resizes, turns
// or moves it; a drag from anywhere else draws a new one, over the others too (they only count where they overlap,
// so a new one nearly always starts inside another); and a click focuses the selection under it, or none. Presses it
// doesn't take (another button, no tool, or while panning) are left to the view around it.
export default function SampleCanvas(props: Props)
{
    const { shown, recipe, settings, width, height, panning, onChange } = props;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stroke, setStroke] = useState<[number, number][] | null>(null);
    const [selectionDrag, setSelectionDrag] = useState<SelectionDrag | null>(null);
    const [hover, setHover] = useState<[number, number] | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current!;
        canvas.width = shown.width;
        canvas.height = shown.height;
        canvas.getContext("2d")!.drawImage(PixelUtil.toCanvas(shown), 0, 0);
    }, [shown]);

    const shorterSide = Math.min(shown.width, shown.height);
    const brushing = settings.tool == "erase" || settings.tool == "restore";
    const selecting = settings.tool == "select";
    // The sample's pixels per CSS pixel, so handles keep their size on screen.
    const pixelsPerCssPixel = shown.width / Math.max(1, width);
    const handleRadius = HANDLE_RADIUS * pixelsPerCssPixel;
    const selections = recipe.selections ?? [];
    const focused = (props.focusedSelection != undefined && props.focusedSelection < selections.length)
        ? props.focusedSelection : undefined;

    const toFraction = (ev: React.PointerEvent): [number, number] => {
        const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
        return [clamp01((ev.clientX - rect.left) / rect.width), clamp01((ev.clientY - rect.top) / rect.height)];
    };
    const toPixels = ([u, v]: [number, number]): [number, number] => [u * shown.width, v * shown.height];
    const setBackground = (update: (background: RecipeBackground) => RecipeBackground) =>
        onChange(r => ({...r, background: update(r.background ?? props.startBackground)}));
    const getHandleAt = (point: [number, number]): SelectionHandle | undefined => {
        if (focused == undefined)
            return undefined;
        const [x, y] = toPixels(point);
        return SelectionGeometryUtil.getHandles(selections[focused], shown.width, shown.height,
            TURN_KNOB_OFFSET * pixelsPerCssPixel).find(({point: [hx, hy]}) =>
                Math.hypot(hx - x, hy - y) <= 1.5 * handleRadius)?.handle;
    };

    const onPointerDown = (ev: React.PointerEvent) => {
        if (ev.button != 0 || settings.tool == "none" || panning)
            return;
        ev.stopPropagation();
        const point = toFraction(ev);
        if (settings.tool == "mark")
        {
            setBackground(background => {
                if (!ev.altKey)
                    return {...background, seeds: [...background.seeds, point]};
                const distances = background.seeds.map(([u, v]) => Math.hypot(u - point[0], v - point[1]));
                const nearest = distances.indexOf(Math.min(...distances));
                return {...background, seeds: background.seeds.filter((_, i) => i != nearest)};
            });
        }
        else if (settings.tool == "eraseColor")
        {
            onChange(r => ({...r, alphaEdits: [...(r.alphaEdits ?? []),
                {kind: "eraseColor", point, tolerance: settings.colorTolerance}]}));
        }
        else if (selecting)
        {
            (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
            const press = {press: [ev.clientX, ev.clientY] as [number, number], dragged: false};
            const handle = getHandleAt(point);
            if (focused != undefined && handle != undefined)
            {
                const held = {...press, index: focused, current: selections[focused]};
                setSelectionDrag((handle == "turn") ? {...held, kind: "turn"}
                    : (handle == "move") ? {...held, kind: "move", start: point}
                    : {...held, kind: "resize", handle});
                return;
            }
            setSelectionDrag({...press, kind: "draw", start: point,
                current: {shape: settings.selectShape, rect: [point[0], point[1], 0, 0], radius: 0}});
        }
        else
        {
            (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
            setStroke([point]);
        }
    };

    const onPointerMove = (ev: React.PointerEvent) => {
        const point = toFraction(ev);
        setHover(point);
        if (selectionDrag != null)
        {
            // Still a click: nothing moves under a hand that only wavers.
            if (!selectionDrag.dragged && Math.hypot(ev.clientX - selectionDrag.press[0],
                ev.clientY - selectionDrag.press[1]) < CLICK_TRAVEL)
                return;
            const original = (selectionDrag.kind == "draw") ? selectionDrag.current : selections[selectionDrag.index];
            if (original == undefined)
                return;
            const current = (selectionDrag.kind == "draw")
                ? {...original, rect: getDrawnRect(selectionDrag.start, point, ev.shiftKey, shown.width, shown.height)}
                : (selectionDrag.kind == "move")
                ? SelectionGeometryUtil.move(original, point[0] - selectionDrag.start[0], point[1] - selectionDrag.start[1])
                : (selectionDrag.kind == "resize")
                ? SelectionGeometryUtil.resize(original, selectionDrag.handle, toPixels(point), shown.width,
                    shown.height, ev.shiftKey)
                : SelectionGeometryUtil.turnToward(original, toPixels(point), shown.width, shown.height, ev.shiftKey);
            setSelectionDrag({...selectionDrag, dragged: true, current});
            return;
        }
        if (stroke == null)
            return;
        const last = stroke[stroke.length - 1];
        if (Math.hypot((point[0] - last[0]) * shown.width, (point[1] - last[1]) * shown.height)
            >= STROKE_STEP_PER_RADIUS * radiusPixels)
            setStroke([...stroke, point]);
    };

    // A whole stroke, or a whole drag of a selection, is one edit, so one undo.
    const onPointerUp = () => {
        if (stroke != null && brushing)
        {
            const points = stroke;
            const kind = settings.tool as "erase" | "restore";
            onChange(r => ({...r, alphaEdits: [...(r.alphaEdits ?? []),
                {kind, radius: settings.brushRadius / 100, points}]}));
        }
        if (selectionDrag != null)
        {
            const current = selectionDrag.current;
            if (!selectionDrag.dragged)
            {
                // A click: on the sample it picks, and on a handle it changes nothing.
                if (selectionDrag.kind == "draw")
                {
                    props.onFocusSelection(SelectionGeometryUtil.pickAt(selections, toPixels(selectionDrag.start),
                        shown.width, shown.height, focused));
                }
            }
            else if (selectionDrag.kind == "draw")
            {
                if (current.rect[2] * shown.width >= MIN_SELECTION_SIDE && current.rect[3] * shown.height >= MIN_SELECTION_SIDE)
                {
                    onChange(r => ({...r, selections: [...(r.selections ?? []), current]}));
                    props.onFocusSelection(selections.length);
                }
            }
            else if (JSON.stringify(current) != JSON.stringify(selections[selectionDrag.index]))
            {
                const index = selectionDrag.index;
                onChange(r => (r.selections?.[index] == undefined) ? r
                    : {...r, selections: r.selections.map((selection, i) => (i == index) ? current : selection)});
            }
        }
        setStroke(null);
        setSelectionDrag(null);
    };

    const radiusPixels = settings.brushRadius / 100 * shorterSide;
    // With the selection tool, every selection outlined (as it will be, while one is dragged), the focused one with
    // what lies outside it shaded, and its handles.
    const shownSelections = selections.map((selection, i) =>
        (selectionDrag != null && selectionDrag.kind != "draw" && selectionDrag.index == i) ? selectionDrag.current : selection);
    const drawing = (selectionDrag?.kind == "draw" && selectionDrag.dragged) ? selectionDrag.current : undefined;
    const highlighted = drawing ?? ((focused != undefined) ? shownSelections[focused] : undefined);
    const hoveredHandle = (selecting && selectionDrag == null && hover != null) ? getHandleAt(hover) : undefined;
    const cursor = (hoveredHandle == "turn" || selectionDrag?.kind == "turn") ? "grab"
        : (hoveredHandle == "move" || selectionDrag?.kind == "move") ? "move"
        : (hoveredHandle != undefined) ? getResizeCursor(selections[focused!], hoveredHandle)
        : (selectionDrag?.kind == "resize") ? getResizeCursor(selectionDrag.current, selectionDrag.handle)
        : undefined;
    const pathOf = (selection: RecipeSelection) => SelectionGeometryUtil.getPath(selection, shown.width, shown.height);
    return <div className={`sample-frame checkerboard tool-${panning ? "pan" : settings.tool}${props.pixelated ? " pixelated" : ""}`}
        style={{width, height, ...(cursor != undefined && !panning ? {cursor} : {})}}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp} onPointerLeave={() => setHover(null)}>
        <canvas ref={canvasRef}/>
        <svg viewBox={`0 0 ${shown.width} ${shown.height}`} preserveAspectRatio="none">
            {stroke != null && <polyline className={`stroke ${settings.tool}`} strokeWidth={2 * radiusPixels}
                points={stroke.map(([u, v]) => `${u * shown.width},${v * shown.height}`).join(" ")
                    + (stroke.length == 1 ? ` ${stroke[0][0] * shown.width + 0.01},${stroke[0][1] * shown.height}` : "")}/>}
            {brushing && !panning && hover != null && <circle className="brush-cursor" r={radiusPixels}
                cx={hover[0] * shown.width} cy={hover[1] * shown.height}/>}
            {selecting && <>
                {highlighted != undefined && <path className="selection-outside" fillRule="evenodd"
                    d={`M0 0H${shown.width}V${shown.height}H0Z ${pathOf(highlighted)}`}/>}
                {shownSelections.map((selection, i) => <path key={i}
                    className={`selection-outline${(i == focused && drawing == undefined) ? " focused" : ""}`} d={pathOf(selection)}/>)}
                {drawing != undefined && <path className="selection-outline focused" d={pathOf(drawing)}/>}
                {focused != undefined && drawing == undefined && <SelectionHandles selection={shownSelections[focused]}
                    width={shown.width} height={shown.height} radius={handleRadius}
                    turnOffset={TURN_KNOB_OFFSET * pixelsPerCssPixel}/>}
            </>}
        </svg>
        {settings.tool == "mark" && (recipe.background?.seeds ?? []).map(([u, v], i) =>
            <div key={i} className="seed-mark" style={{left: `${u * 100}%`, top: `${v * 100}%`}}/>)}
    </div>;
}

// The focused selection's resize handles, its turning knob on a stalk from the top side, and the handle at its
// middle it is moved by, marked with a cross.
function SelectionHandles(props: {selection: RecipeSelection, width: number, height: number, radius: number,
    turnOffset: number})
{
    const handles = SelectionGeometryUtil.getHandles(props.selection, props.width, props.height, props.turnOffset);
    const top = handles.find(({handle}) => handle == "n")!.point;
    const knob = handles.find(({handle}) => handle == "turn")!.point;
    const [mx, my] = handles.find(({handle}) => handle == "move")!.point;
    const arm = 0.55 * props.radius;
    return <>
        <line className="selection-stalk" x1={top[0]} y1={top[1]} x2={knob[0]} y2={knob[1]}/>
        {handles.map(({handle, point: [x, y]}) => <circle key={handle}
            className={`selection-handle${handle == "turn" ? " turn" : ""}`} cx={x} cy={y} r={props.radius}/>)}
        <path className="selection-move-mark" d={`M${mx - arm} ${my}H${mx + arm}M${mx} ${my - arm}V${my + arm}`}/>
    </>;
}

function getResizeCursor(selection: RecipeSelection, handle: Exclude<SelectionHandle, "turn" | "move">): string
{
    const direction = SelectionGeometryUtil.getHandleDirection(selection, handle);
    const step = ((Math.round(direction / 45) % 4) + 4) % 4;
    return RESIZE_CURSORS[step];
}

// From where the drag began to the pointer, within the sample; with square, as wide as it is tall in pixels.
function getDrawnRect(start: [number, number], point: [number, number], square: boolean, width: number,
    height: number): RecipeSelection["rect"]
{
    let du = point[0] - start[0];
    let dv = point[1] - start[1];
    if (square)
    {
        const room = Math.min((du < 0 ? start[0] : 1 - start[0]) * width, (dv < 0 ? start[1] : 1 - start[1]) * height);
        const side = Math.min(room, Math.max(Math.abs(du) * width, Math.abs(dv) * height));
        du = (du < 0 ? -side : side) / width;
        dv = (dv < 0 ? -side : side) / height;
    }
    return [Math.min(start[0], start[0] + du), Math.min(start[1], start[1] + dv), Math.abs(du), Math.abs(dv)];
}

function clamp01(value: number): number
{
    return Math.min(1, Math.max(0, value));
}

interface Props
{
    shown: RgbaImage;
    recipe: ImageRecipe;
    settings: SampleToolSettings;
    // In CSS pixels.
    width: number;
    height: number;
    // The view around it is being dragged instead (see SampleView).
    panning?: boolean;
    // Shown larger than its pixels, so each is seen square.
    pixelated?: boolean;
    // What the background fill is when a mark turns it on (see EditorApp's remembered settings).
    startBackground: RecipeBackground;
    // The selection whose handles are shown and whose settings the side panel edits (see SamplePreview).
    focusedSelection: number | undefined;
    onFocusSelection: (index: number | undefined) => void;
    onChange: (update: (recipe: ImageRecipe) => ImageRecipe) => void;
}
