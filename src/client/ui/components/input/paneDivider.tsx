import { useRef } from "react";

// A bar between two panes, dragged to resize them: it says how far it has been dragged along its axis since it was
// taken hold of, and its owner sizes the panes by that.
export default function PaneDivider({ id, axis, onDragStart, onDrag }: Props)
{
    const startRef = useRef(0);
    const getPlace = (event: {clientX: number, clientY: number}) => (axis == "x") ? event.clientX : event.clientY;

    // Captured, so the drag goes on wherever the pointer wanders. No touch gesture is the browser's on it.
    return <div id={id}
        onPointerDown={event => {
            if (event.button != 0)
                return;
            event.currentTarget.setPointerCapture(event.pointerId);
            startRef.current = getPlace(event);
            onDragStart();
        }}
        onPointerMove={event => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
                onDrag(getPlace(event) - startRef.current);
        }}
        className={`flex items-center justify-center shrink-0 touch-none select-none ${(axis == "x") ? "w-2 cursor-ew-resize" : "h-2 cursor-ns-resize"}`}>
        <div className={`rounded-full bg-gray-500 ${(axis == "x") ? "w-1 h-10" : "w-10 h-1"}`}/>
    </div>;
}

interface Props
{
    // Lets automation address the bar.
    id?: string;
    // The axis it is dragged along: "x" between panes side by side, "y" between one above the other.
    axis: "x" | "y";
    onDragStart: () => void;
    // How far along the axis since onDragStart, in CSS px.
    onDrag: (distance: number) => void;
}
