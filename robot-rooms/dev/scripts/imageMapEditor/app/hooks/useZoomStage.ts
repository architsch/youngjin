import { useEffect, useLayoutEffect, useRef, useState } from "react";

const MAX_ZOOM = 16; // one of the picture's pixels shown this many CSS pixels wide
const ZOOM_STEP = 1.5;
const WHEEL_ZOOM_RATE = 0.0015; // per pixel of wheel travel
const STAGE_PADDING = 24; // in CSS pixels, around the picture

// A picture shown at any zoom on a stage that scrolls: zoomed around the pointer by the wheel (or to fit, or to its
// own pixels, which own gives the size of), and panned by dragging with the middle button, with Space held, or,
// where primaryPans, with the main button. The stage's element takes stageProps and holds one element, which takes
// contentProps and holds the picture's frame alone, at the width and height given here. A press the frame takes
// stops there (stopPropagation); any other is the stage's.
export default function useZoomStage(own: {width: number, height: number}, primaryPans: boolean)
{
    const stageRef = useRef<HTMLDivElement>(null);
    const [stageSize, setStageSize] = useState({width: 0, height: 0});
    const [zoom, setZoom] = useState<number | "fit">("fit");
    const [spaceHeld, setSpaceHeld] = useState(false);
    const panRef = useRef<{x: number, y: number, left: number, top: number} | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    // Where the pointer was over the picture when a zoom was asked for, to keep it there.
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

    const fitZoom = Math.max(0.01, Math.min((stageSize.width - 2 * STAGE_PADDING) / own.width,
        (stageSize.height - 2 * STAGE_PADDING) / own.height));
    const minZoom = Math.min(fitZoom, 1) / 2;
    const scale = (zoom == "fit") ? fitZoom : zoom;
    const panning = spaceHeld || primaryPans;
    const getFrame = () => stageRef.current!.firstElementChild!.firstElementChild!;

    const zoomTo = (next: number, clientX?: number, clientY?: number) => {
        const frame = getFrame().getBoundingClientRect();
        const stageRect = stageRef.current!.getBoundingClientRect();
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
        const frame = getFrame().getBoundingClientRect();
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

    return {
        scale,
        // The frame's size, in CSS pixels.
        width: own.width * scale,
        height: own.height * scale,
        fitted: zoom == "fit",
        spaceHeld,
        // Whether a press of the main button is the stage's, to pan by, wherever it lands.
        panning,
        zoomTo,
        zoomIn: () => zoomTo(scale * ZOOM_STEP),
        zoomOut: () => zoomTo(scale / ZOOM_STEP),
        fit: () => setZoom("fit"),
        stageProps: {
            ref: stageRef,
            className: `zoom-stage${isPanning ? " panning" : ""}`,
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
            // Keeps the middle button from starting the browser's own scrolling.
            onMouseDown: (ev: React.MouseEvent) => {
                if (ev.button == 1)
                    ev.preventDefault();
            },
        },
        contentProps: {className: "zoom-content", style: {padding: STAGE_PADDING}},
    };
}
