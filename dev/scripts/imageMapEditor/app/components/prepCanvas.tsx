import { Fragment, useRef, useState } from "react";
import SourceEntry from "../../core/sourceEntry";
import SourcePrep from "../../core/sourcePrep";
import PrepCutOut from "../../../imagePrep/core/prepCutOut";
import PlaneGeometryUtil from "../../../imagePrep/core/planeGeometryUtil";
import EditorApi from "../util/editorApi";
import PrepTool from "../types/prepTool";

// A box dragged out smaller than this (as a fraction of the source) is taken for a stray click.
const MIN_BOX_SIZE = 0.004;
// How far past a point on the thing its box reaches, as a fraction of the source: less than the slack a box is
// allowed past the source's edge (see PrepRenderUtil.validate).
const POINT_ROOM = 0.001;
// How many points of the ellipse through a round thing's outline are drawn.
const ELLIPSE_STEPS = 72;

type Point = [number, number];
type Rect = [number, number, number, number];
type Drag = {kind: "corner", index: number, id: number} | {kind: "box", start: Point};

let nextDragId = 0;

// The source being preprocessed (see PreprocessDialog) at a given size, with what is marked on it, all in fractions
// of it: each part of the cut-out (the box around it, the points on it and off it), the corners of the face squared
// up, and the points around something round with the ellipse through them. The tool chosen draws the picked part's
// box or clicks points (Alt-click takes the nearest one away); the corners are dragged whatever the tool. Presses it
// doesn't take (another button, no tool, or with Space held) are left to the stage around it.
export default function PrepCanvas(props: Props)
{
    const { source, own, prep, tool, focusedPart, width, height, spaceHeld, onChange } = props;
    const dragRef = useRef<Drag | null>(null);
    const [drawnBox, setDrawnBox] = useState<Rect | null>(null);
    const parts = prep.cutOut ?? [];

    const toFraction = (ev: React.PointerEvent): Point => {
        const rect = ev.currentTarget.getBoundingClientRect();
        return [clamp01((ev.clientX - rect.left) / rect.width), clamp01((ev.clientY - rect.top) / rect.height)];
    };
    // The part picked, which is made here if it isn't there yet.
    const setPart = (update: (part: PrepCutOut) => PrepCutOut) => onChange(p => {
        const cutOut = [...(p.cutOut ?? [])];
        const index = Math.min(focusedPart, cutOut.length);
        cutOut[index] = update(cutOut[index] ?? {});
        return {...p, cutOut};
    });

    const onPointerDown = (ev: React.PointerEvent) => {
        if (ev.button != 0 || spaceHeld)
            return;
        const point = toFraction(ev);
        const remove = ev.altKey;
        const corner = (ev.target as HTMLElement).dataset.corner;
        if (corner != undefined)
        {
            dragRef.current = {kind: "corner", index: Number(corner), id: nextDragId++};
        }
        else if (tool == "box")
        {
            dragRef.current = {kind: "box", start: point};
        }
        else if (tool == "on" || tool == "off")
        {
            if (!remove)
                setPart(part => withPoint(part, tool, point));
            else if (parts[focusedPart] != undefined)
                setPart(part => ({...part, [tool]: withoutNearest(part[tool] ?? [], point)}));
        }
        else if (tool == "circle")
        {
            onChange(p => (p.square == undefined) ? p
                : {...p, square: {...p.square, circle: editPoints(p.square.circle ?? [], point, remove)}});
        }
        else if (tool == "outline")
        {
            onChange(p => (p.round == undefined) ? p
                : {...p, round: {...p.round, outline: editPoints(p.round.outline, point, remove)}});
        }
        else
        {
            return;
        }
        ev.stopPropagation();
        if (dragRef.current != null)
            ev.currentTarget.setPointerCapture(ev.pointerId);
    };

    const onPointerMove = (ev: React.PointerEvent) => {
        const drag = dragRef.current;
        if (drag == null)
            return;
        const [x, y] = toFraction(ev);
        if (drag.kind == "corner")
        {
            onChange(p => (p.square?.corners == undefined) ? p : {...p, square: {...p.square,
                corners: p.square.corners.map((corner, i) => (i == drag.index) ? [x, y] : corner)}}, `corner-${drag.id}`);
        }
        else
        {
            setDrawnBox([Math.min(x, drag.start[0]), Math.min(y, drag.start[1]),
                Math.abs(x - drag.start[0]), Math.abs(y - drag.start[1])]);
        }
    };

    const onPointerUp = () => {
        if (dragRef.current?.kind == "box" && drawnBox != null && drawnBox[2] > MIN_BOX_SIZE && drawnBox[3] > MIN_BOX_SIZE)
        {
            const box = drawnBox;
            setPart(part => ({...part, rect: includePoints(box, part.on ?? [])}));
        }
        dragRef.current = null;
        setDrawnBox(null);
    };

    const roundPoints = prep.square?.circle ?? prep.round?.outline ?? [];
    const ellipse = getEllipse(roundPoints, own);
    return <div className={`prep-frame checkerboard tool-${spaceHeld ? "pan" : tool}${props.pixelated ? " pixelated" : ""}`}
        style={{width, height}} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}>
        <img src={EditorApi.getSourceURL(source.sha1)} alt="" draggable={false}/>
        {props.cutAway != undefined && <img src={props.cutAway} alt="" draggable={false}/>}
        <svg viewBox="0 0 1 1" preserveAspectRatio="none">
            {prep.square?.corners != undefined && <polygon className="quad" points={toSvgPoints(prep.square.corners)}/>}
            {ellipse != undefined && <polygon className="prep-ellipse" points={toSvgPoints(ellipse)}/>}
        </svg>
        {parts.map((part, i) => {
            const state = `${part.drop ? " dropped" : ""}${i == focusedPart ? " focused" : ""}`;
            return <Fragment key={i}>
                {part.rect != undefined && <div className={`prep-box${state}`} style={toStyle(part.rect)}>
                    <span className="prep-box-label">{i + 1}</span>
                </div>}
                {(part.on ?? []).map(([x, y], j) => <div key={`on-${j}`} className={`prep-point on${state}`}
                    style={toPlace(x, y)}/>)}
                {(part.off ?? []).map(([x, y], j) => <div key={`off-${j}`} className={`prep-point off${state}`}
                    style={toPlace(x, y)}>×</div>)}
            </Fragment>;
        })}
        {drawnBox != null && <div className="prep-box focused" style={toStyle(drawnBox)}/>}
        {roundPoints.map(([x, y], i) => <div key={i} className="prep-point round focused" style={toPlace(x, y)}/>)}
        {(prep.square?.corners ?? []).map(([x, y], i) => <div key={i} data-corner={i} className="corner-handle"
            style={toPlace(x, y)}/>)}
    </div>;
}

// A point on the thing lies within the box around it (see PrepRenderUtil.validate), so the box grows to take it in.
function withPoint(part: PrepCutOut, kind: "on" | "off", point: Point): PrepCutOut
{
    const added = {...part, [kind]: [...(part[kind] ?? []), point]};
    return (kind == "on" && part.rect != undefined) ? {...added, rect: includePoints(part.rect, [point])} : added;
}

// With a point added, or the one nearest to it taken away.
function editPoints(points: Point[], point: Point, remove: boolean): Point[]
{
    return remove ? (withoutNearest(points, point) ?? []) : [...points, point];
}

// Undefined when none is left.
function withoutNearest(points: Point[], [x, y]: Point): Point[] | undefined
{
    const distances = points.map(([px, py]) => Math.hypot(px - x, py - y));
    const nearest = distances.indexOf(Math.min(...distances));
    const rest = points.filter((_, i) => i != nearest);
    return (rest.length > 0) ? rest : undefined;
}

// The rect grown to hold the points, each with a hair of room, so that none lies on its very edge.
function includePoints([x, y, width, height]: Rect, points: Point[]): Rect
{
    const left = Math.min(x, ...points.map(point => point[0] - POINT_ROOM));
    const top = Math.min(y, ...points.map(point => point[1] - POINT_ROOM));
    const right = Math.max(x + width, ...points.map(point => point[0] + POINT_ROOM));
    const bottom = Math.max(y + height, ...points.map(point => point[1] + POINT_ROOM));
    return [left, top, right - left, bottom - top];
}

// The ellipse through the points marked around something round, as points along it; undefined until there are enough
// of them, or where they lie on none. Fitted in the source's pixels, since fractions of it are not square.
function getEllipse(points: Point[], own: {width: number, height: number}): Point[] | undefined
{
    if (points.length < 5)
        return undefined;
    try
    {
        const {center, major, minor, angle} = PlaneGeometryUtil.fitEllipse(
            points.map(([x, y]): Point => [x * own.width, y * own.height]));
        const cos = Math.cos(angle), sin = Math.sin(angle);
        return Array.from({length: ELLIPSE_STEPS}, (_, i): Point => {
            const turn = i * 2 * Math.PI / ELLIPSE_STEPS;
            const along = major * Math.cos(turn), across = minor * Math.sin(turn);
            return [(center[0] + along * cos - across * sin) / own.width, (center[1] + along * sin + across * cos) / own.height];
        });
    }
    catch
    {
        return undefined;
    }
}

function toSvgPoints(points: Point[]): string
{
    return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function toPlace(x: number, y: number): React.CSSProperties
{
    return {left: `${x * 100}%`, top: `${y * 100}%`};
}

function toStyle([x, y, width, height]: Rect): React.CSSProperties
{
    return {left: `${x * 100}%`, top: `${y * 100}%`, width: `${width * 100}%`, height: `${height * 100}%`};
}

function clamp01(value: number): number
{
    return Math.min(1, Math.max(0, value));
}

interface Props
{
    source: SourceEntry;
    // The source's size as it is worked at, in pixels.
    own: {width: number, height: number};
    prep: SourcePrep;
    tool: PrepTool;
    // The part of the cut-out that the box and the points go to.
    focusedPart: number;
    // In CSS pixels.
    width: number;
    height: number;
    // The stage around it is being dragged instead (see useZoomStage).
    spaceHeld: boolean;
    // Shown larger than its pixels, so each is seen square.
    pixelated: boolean;
    // A tint over what the last preview's cut-out takes away (see PrepPreview.cutAway).
    cutAway: string | undefined;
    onChange: (update: (prep: SourcePrep) => SourcePrep, coalesceKey?: string) => void;
}
