import { useCallback } from "react";
import { ScrollType } from "../types/scrollType";
import { ScrollCursorTransitionType } from "../types/scrollCursorTransitionType";

const dragThreshold = 20;

export default function useMouseDragScroll(scrollType: ScrollType,
    scrollCursorTransitionType: ScrollCursorTransitionType)
{
    return useCallback((node: HTMLElement | null) => {
        if (!node)
            return;
        if (scrollType != "none")
            enableMouseDragScroll(node, scrollType, scrollCursorTransitionType);
    }, [scrollType, scrollCursorTransitionType]);
}

function enableMouseDragScroll(element: HTMLElement, scrollType: ScrollType,
    scrollCursorTransitionType: ScrollCursorTransitionType)
{
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
    });

    element.addEventListener("mousedown", (event: MouseEvent) => {
        mouseDown = true;
        xStart = event.pageX - element.offsetLeft;
        yStart = event.pageY - element.offsetTop;
        scrollLeft = element.scrollLeft;
        scrollTop = element.scrollTop;
        if (scrollCursorTransitionType != "neverGrab")
            element.style.cursor = "grabbing";
        stopDragging();
    });

    element.addEventListener("mouseleave", () => {
        mouseDown = false;
        switch (scrollCursorTransitionType)
        {
            case "alwaysGrab": element.style.cursor = "grab"; break;
            case "grabWhileDragging": element.style.cursor = ""; break;
            case "neverGrab": break;
            default: throw new Error(`Unhandled scrollCursorTransitionType :: ${scrollCursorTransitionType}`);
        }
    });

    element.addEventListener("mouseup", () => {
        mouseDown = false;
        switch (scrollCursorTransitionType)
        {
            case "alwaysGrab": element.style.cursor = "grab"; break;
            case "grabWhileDragging": element.style.cursor = ""; break;
            case "neverGrab": break;
            default: throw new Error(`Unhandled scrollCursorTransitionType :: ${scrollCursorTransitionType}`);
        }
    });

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
            element.addEventListener("click", preventClick);
            dragging = true;
        }
    });
}

function preventClick(event: MouseEvent)
{
    event.preventDefault();
    event.stopImmediatePropagation();
}