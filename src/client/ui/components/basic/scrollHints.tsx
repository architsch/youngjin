import { useLayoutEffect, useRef, useState } from "react";
import ScrollAreaUtil from "../../util/scrollAreaUtil";
import { ScrollEdge } from "../../types/scrollEdge";
import TriangleLeftIcon from "../../svg/icons/triangleLeftIcon";
import TriangleRightIcon from "../../svg/icons/triangleRightIcon";
import TriangleUpIcon from "../../svg/icons/triangleUpIcon";
import TriangleDownIcon from "../../svg/icons/triangleDownIcon";

// Where a scroller's contents run past its edge, a dark fade over that edge with a small arrow, which scrolls them about
// a page that way when clicked. Lying inside the scroller, a hint dragged by a finger or the mouse scrolls it as the
// rest of it does. Goes first in the flex row or column whose children scroll, taking no room there, and covers that
// element as far as the scroller shows it: the scroller itself, or an element filling it whose padding the hints are
// to cover rather than the scroller's (see ScrollPanel).
export default function ScrollHints()
{
    const anchorRef = useRef<HTMLDivElement>(null);
    const scrollerRef = useRef<Element | null>(null);
    const [placement, setPlacement] = useState<Placement | null>(null);
    const [edges, setEdges] = useState<ScrollEdge[]>([]);

    useLayoutEffect(() => {
        const anchor = anchorRef.current;
        const host = anchor?.parentElement;
        const scroller = (host != null) ? ScrollAreaUtil.findContainer(host) : null;
        if (anchor == null || host == null || scroller == null)
            return;
        scrollerRef.current = scroller;

        const updateEdges = () => {
            const next = ScrollAreaUtil.getCutOffEdges(scroller);
            setEdges(prev => (prev.join() == next.join()) ? prev : next);
        };
        const update = () => {
            const next = measurePlacement(host, scroller);
            setPlacement(prev => (prev != null && getKey(prev) == getKey(next)) ? prev : next);
            updateEdges();
        };
        // Whatever resizes the room the contents have, or the contents themselves.
        const resizeObserver = new ResizeObserver(update);
        const observe = () => {
            resizeObserver.disconnect();
            for (const element of [scroller, host, ...Array.from(host.children)])
            {
                if (element != anchor)
                    resizeObserver.observe(element);
            }
        };
        const mutationObserver = new MutationObserver(() => {
            observe();
            update();
        });
        observe();
        mutationObserver.observe(host, {childList: true});
        scroller.addEventListener("scroll", updateEdges, {passive: true});
        update();
        return () => {
            resizeObserver.disconnect();
            mutationObserver.disconnect();
            scroller.removeEventListener("scroll", updateEdges);
            scrollerRef.current = null;
        };
    }, []);

    const scrollPage = (edge: ScrollEdge) => {
        const scroller = scrollerRef.current;
        if (scroller != null)
            ScrollAreaUtil.scrollPage(scroller, edge, HINT_PX);
    };

    // Out of the flow until measured, so that it never takes room among the children. Layout containment keeps its
    // layer, sized to whole pixels, from adding to what the scroller can scroll.
    return <div ref={anchorRef} className="z-1 flex-none self-start size-0 contain-layout pointer-events-none"
        style={(placement == null) ? {position: "absolute"}
            : {position: "sticky", left: placement.left, top: placement.top, margin: placement.margin}}>
        {placement != null && <div className="absolute left-0 top-0"
            style={{width: placement.width, height: placement.height}}>
            {EDGES.map(edge => {
                const Icon = icons[edge];
                return <div key={edge}
                    className={`absolute flex ${hintClassNames[edge]} from-transparent to-black/60 cursor-pointer touch-manipulation transition-opacity duration-150 ${edges.includes(edge) ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                    style={(edge == "left" || edge == "right") ? {width: HINT_PX} : {height: HINT_PX}}
                    onClick={() => scrollPage(edge)}>
                    <div className="size-3 shrink-0 text-gray-100 drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]"><Icon/></div>
                </div>;
            })}
        </div>}
    </div>;
}

// How deep a hint reaches in from its edge.
const HINT_PX = 32;

// Each hint lies along its edge, darkest there, with its arrow beside it.
const hintClassNames: {[edge in ScrollEdge]: string} = {
    left: "inset-y-0 left-0 items-center justify-start pl-0.5 bg-linear-to-l",
    right: "inset-y-0 right-0 items-center justify-end pr-0.5 bg-linear-to-r",
    top: "inset-x-0 top-0 flex-col items-center justify-start pt-0.5 bg-linear-to-t",
    bottom: "inset-x-0 bottom-0 flex-col items-center justify-end pb-0.5 bg-linear-to-b",
};

const icons: {[edge in ScrollEdge]: typeof TriangleLeftIcon} = {
    left: TriangleLeftIcon,
    right: TriangleRightIcon,
    top: TriangleUpIcon,
    bottom: TriangleDownIcon,
};

const EDGES = Object.keys(hintClassNames) as ScrollEdge[];

// Where the anchor stands, and what its layer covers.
interface Placement
{
    // At its host's top left corner, the room it and the gap after it would take among the host's children given back.
    margin: string;
    // Sticky offsets, which count from inside the scroller's padding.
    left: number;
    top: number;
    // The host as far as the scroller shows it.
    width: number;
    height: number;
}

function measurePlacement(host: Element, scroller: Element): Placement
{
    const hostStyle = getComputedStyle(host);
    const scrollerStyle = getComputedStyle(scroller);
    const padLeft = toPx(hostStyle.paddingLeft);
    const padTop = toPx(hostStyle.paddingTop);
    return {
        margin: hostStyle.flexDirection.startsWith("column")
            ? `${-padTop}px 0px ${padTop - toPx(hostStyle.rowGap)}px ${-padLeft}px`
            : `${-padTop}px ${padLeft - toPx(hostStyle.columnGap)}px 0px ${-padLeft}px`,
        left: -toPx(scrollerStyle.paddingLeft),
        top: -toPx(scrollerStyle.paddingTop),
        width: Math.min(host.clientWidth, scroller.clientWidth),
        height: Math.min(host.clientHeight, scroller.clientHeight),
    };
}

function getKey(placement: Placement): string
{
    return `${placement.margin} ${placement.left} ${placement.top} ${placement.width} ${placement.height}`;
}

// A computed length in pixels; a gap left at "normal" is none.
function toPx(value: string): number
{
    return parseFloat(value) || 0;
}
