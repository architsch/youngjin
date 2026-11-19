import { ScrollEdge } from "../types/scrollEdge";

// How far an element's contents must reach past its box for it to scroll: layout rounding can leave a pixel
// of overflow that scrolls nothing.
export const MIN_OVERFLOW_PX = 1;

// What a wheel that reports lines scrolls by per line, so that its notch of three matches a notch in pixels.
const WHEEL_LINE_PX = 100 / 3;

// The 2D UI's scrollable areas: the one a wheel rolled over finds, and the edges an area's contents run past.
const ScrollAreaUtil =
{
    // The nearest element around a target, itself included, that scrolls (along the axis given, or either): its
    // style lets it, and its contents overflow it. Null where the target is in none.
    find: (target: EventTarget | null, axis?: "x" | "y"): Element | null =>
    {
        for (let element = (target instanceof Element) ? target : null; element != null;
            element = element.parentElement)
        {
            const style = getComputedStyle(element);
            if ((axis != "y" && scrolls(style.overflowX, element.scrollWidth - element.clientWidth))
                || (axis != "x" && scrolls(style.overflowY, element.scrollHeight - element.clientHeight)))
            {
                return element;
            }
        }
        return null;
    },

    // The nearest element around a target, itself included, whose style lets it scroll, whether or not its contents
    // overflow it yet. Null where the target is in none.
    findContainer: (target: Element): Element | null =>
    {
        for (let element: Element | null = target; element != null; element = element.parentElement)
        {
            const style = getComputedStyle(element);
            if (letsScroll(style.overflowX) || letsScroll(style.overflowY))
                return element;
        }
        return null;
    },

    // The edges of an area that its contents run past, which scrolling toward would show more of.
    getCutOffEdges: (element: Element): ScrollEdge[] =>
    {
        const style = getComputedStyle(element);
        const maxLeft = element.scrollWidth - element.clientWidth;
        const maxTop = element.scrollHeight - element.clientHeight;
        const edges: ScrollEdge[] = [];
        if (scrolls(style.overflowX, maxLeft))
        {
            if (element.scrollLeft > MIN_OVERFLOW_PX)
                edges.push("left");
            if (element.scrollLeft < maxLeft - MIN_OVERFLOW_PX)
                edges.push("right");
        }
        if (scrolls(style.overflowY, maxTop))
        {
            if (element.scrollTop > MIN_OVERFLOW_PX)
                edges.push("top");
            if (element.scrollTop < maxTop - MIN_OVERFLOW_PX)
                edges.push("bottom");
        }
        return edges;
    },

    // Scrolls an area about a page toward one of its edges, smoothly: what lay within hintPx of that edge (under its
    // hint; see ScrollHints) comes to lie just past the hint the opposite edge then shows.
    scrollPage: (element: Element, edge: ScrollEdge, hintPx: number): void =>
    {
        const sideways = (edge == "left" || edge == "right");
        const pagePx = sideways ? element.clientWidth : element.clientHeight;
        const stepPx = Math.max(pagePx - 2 * hintPx, pagePx / 2) * ((edge == "left" || edge == "top") ? -1 : 1);
        element.scrollBy(sideways ? {left: stepPx, behavior: "smooth"} : {top: stepPx, behavior: "smooth"});
    },

    // Scrolls sideways the strip a wheel was rolled up or down over, which a browser leaves still: an area that
    // only scrolls sideways, with none around it for the roll to scroll up or down. Returns whether there was one.
    tryScrollSideways: (ev: WheelEvent): boolean =>
    {
        // With ctrl held the roll is a trackpad's pinch, which scrolls nothing.
        if (ev.ctrlKey || Math.abs(ev.deltaY) <= Math.abs(ev.deltaX))
            return false;
        if (ScrollAreaUtil.find(ev.target, "y") != null)
            return false;
        const strip = ScrollAreaUtil.find(ev.target, "x");
        if (strip == null)
            return false;

        strip.scrollLeft += getWheelPx(ev, strip.clientWidth);
        return true;
    },
}

function letsScroll(overflow: string): boolean
{
    return overflow == "auto" || overflow == "scroll";
}

function scrolls(overflow: string, overflowPx: number): boolean
{
    return letsScroll(overflow) && overflowPx > MIN_OVERFLOW_PX;
}

function getWheelPx(ev: WheelEvent, pagePx: number): number
{
    switch (ev.deltaMode)
    {
        case WheelEvent.DOM_DELTA_LINE:
            return ev.deltaY * WHEEL_LINE_PX;
        case WheelEvent.DOM_DELTA_PAGE:
            return ev.deltaY * pagePx;
        default: // DOM_DELTA_PIXEL
            return ev.deltaY;
    }
}

export default ScrollAreaUtil;
