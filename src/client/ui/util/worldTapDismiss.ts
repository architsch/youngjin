import { useEffect, useRef } from "react";
import { MOUSE_DRAG_THRESHOLD_PX, TOUCH_DRAG_THRESHOLD_PX } from "../../system/clientConstants";

// Dismisses a selection-attached control when the room is tapped, consuming the tap so the selection
// isn't dropped. Only taps on the room (outside the UI layer) count, and only non-travelling taps
// (drags orbit the camera).
export default function useWorldTapDismiss(onDismiss: () => void): void
{
    // Ref, so a new closure each render doesn't rebuild listeners.
    const onDismissRef = useRef(onDismiss);
    onDismissRef.current = onDismiss;

    useEffect(() => {
        let pressPos: {x: number, y: number} | undefined;
        let pressThresholdPx = MOUSE_DRAG_THRESHOLD_PX;

        const onPointerDown = (ev: PointerEvent) => {
            pressPos = pressedTheRoom(ev.target) ? {x: ev.clientX, y: ev.clientY} : undefined;
            // Pointer-type-specific tap tolerance (see PointerDragInput).
            pressThresholdPx = (ev.pointerType == "mouse")
                ? MOUSE_DRAG_THRESHOLD_PX : TOUCH_DRAG_THRESHOLD_PX;
        };

        const onClick = (ev: MouseEvent) => {
            const pressStart = pressPos;
            pressPos = undefined;
            if (pressStart == undefined || !pressedTheRoom(ev.target))
                return;
            if (Math.hypot(ev.clientX - pressStart.x, ev.clientY - pressStart.y) > pressThresholdPx)
                return;

            // Consume the tap so the canvas keeps the selection.
            ev.stopPropagation();
            onDismissRef.current();
        };

        // Capture phase, to run before the canvas's own handlers.
        window.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("click", onClick, true);
        return () => {
            window.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("click", onClick, true);
        };
    }, []);
}

// Anything outside the UI layer (canvas, gizmos) is the room.
function pressedTheRoom(target: EventTarget | null): boolean
{
    const uiLayer = document.getElementById("uiRoot");
    return uiLayer != null && target instanceof Node && !uiLayer.contains(target);
}
