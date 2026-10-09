// How far an element's contents must reach past its box for it to scroll: layout rounding can leave a pixel
// of overflow that scrolls nothing.
const MIN_OVERFLOW_PX = 1;

// What a wheel that reports lines scrolls by per line, so that its notch of three matches a notch in pixels.
const WHEEL_LINE_PX = 100 / 3;

// The 2D UI's scrollable areas, as a wheel rolled over one finds them.
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

function scrolls(overflow: string, overflowPx: number): boolean
{
    return (overflow == "auto" || overflow == "scroll") && overflowPx > MIN_OVERFLOW_PX;
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
