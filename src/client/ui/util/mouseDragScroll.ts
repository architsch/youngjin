import { useCallback, useRef } from "react";
import { ScrollType } from "../types/scrollType";
import { ScrollCursorTransitionType } from "../types/scrollCursorTransitionType";

const dragThreshold = 20;

export default function useMouseDragScroll(scrollType: ScrollType,
    scrollCursorTransitionType: ScrollCursorTransitionType)
{
    // What the element was given is taken back off it once React lets go of it (calling the ref
    // with null). One of the listeners is on the document rather than on the element, and left in
    // place it would outlive the element, keep it in memory, and be joined by another for every
    // scrolling panel opened after it.
    const disableRef = useRef<(() => void) | undefined>(undefined);

    return useCallback((node: HTMLElement | null) => {
        disableRef.current?.();
        disableRef.current = (node && scrollType != "none")
            ? enableMouseDragScroll(node, scrollType, scrollCursorTransitionType)
            : undefined;
    }, [scrollType, scrollCursorTransitionType]);
}

// Returns the teardown, which takes every listener added here back off.
function enableMouseDragScroll(element: HTMLElement, scrollType: ScrollType,
    scrollCursorTransitionType: ScrollCursorTransitionType): () => void
{
    const listeners = new AbortController();
    const signal = listeners.signal;

    let mouseDown = false;
    let xStart = 0, yStart = 0, scrollLeft = 0, scrollTop = 0;
    let dragging = false;

    const stopDragging = () => {
        if (dragging)
        {
            element.removeEventListener("click", preventClick);
            dragging = false;
        }
    };

    element.addEventListener("mouseenter", (event: MouseEvent) => {
        switch (scrollCursorTransitionType)
        {
            case "alwaysGrab": element.style.cursor = "grab"; break;
            case "grabWhileDragging": break;
            case "neverGrab": break;
            default: throw new Error(`Unhandled scrollCursorTransitionType :: ${scrollCursorTransitionType}`);
        }
    }, { signal });

    element.addEventListener("mousedown", (event: MouseEvent) => {
        mouseDown = true;
        xStart = event.pageX - element.offsetLeft;
        yStart = event.pageY - element.offsetTop;
        scrollLeft = element.scrollLeft;
        scrollTop = element.scrollTop;
        if (scrollCursorTransitionType != "neverGrab")
            element.style.cursor = "grabbing";
        stopDragging();
    }, { signal });

    element.addEventListener("mouseleave", () => {
        mouseDown = false;
        switch (scrollCursorTransitionType)
        {
            case "alwaysGrab": element.style.cursor = "grab"; break;
            case "grabWhileDragging": element.style.cursor = ""; break;
            case "neverGrab": break;
            default: throw new Error(`Unhandled scrollCursorTransitionType :: ${scrollCursorTransitionType}`);
        }
    }, { signal });

    element.addEventListener("mouseup", () => {
        mouseDown = false;
        switch (scrollCursorTransitionType)
        {
            case "alwaysGrab": element.style.cursor = "grab"; break;
            case "grabWhileDragging": element.style.cursor = ""; break;
            case "neverGrab": break;
            default: throw new Error(`Unhandled scrollCursorTransitionType :: ${scrollCursorTransitionType}`);
        }
    }, { signal });

    document.addEventListener("mousemove", (event: MouseEvent) => {
        if (!mouseDown)
            return;
        event.preventDefault();

        const x = event.pageX - element.offsetLeft;
        const xOffset = x - xStart;
        const y = event.pageY - element.offsetTop;
        const yOffset = y - yStart;

        let shouldBeDragging = false;
        switch (scrollType)
        {
            case "both":
                shouldBeDragging = false;
                element.scrollLeft = scrollLeft - xOffset;
                element.scrollTop = scrollTop - yOffset;
                break;
            case "horizontal":
                shouldBeDragging = Math.abs(xOffset) > dragThreshold;
                element.scrollLeft = scrollLeft - xOffset;
                break;
            case "vertical":
                shouldBeDragging = Math.abs(yOffset) > dragThreshold;
                element.scrollTop = scrollTop - yOffset;
                break;
            default:
                throw new Error(`Unhandled scrollType :: ${scrollType}`);
        }

        if (!dragging && shouldBeDragging)
        {
            element.addEventListener("click", preventClick, { signal });
            dragging = true;
        }
    }, { signal });

    return () => listeners.abort();
}

function preventClick(event: MouseEvent)
{
    event.preventDefault();
    event.stopImmediatePropagation();
}
