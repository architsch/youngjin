import { useEffect, useRef } from "react";
import { MOUSE_DRAG_THRESHOLD_PX, TOUCH_DRAG_THRESHOLD_PX } from "../../system/clientConstants";

// Puts something away when the user taps the room behind it, and spends the tap on that rather than
// letting it through to the room.
//
// A control hanging off a world-space selection has a problem no popup has: the room behind it is
// live, and a tap on the room is how a selection is given up. So the tap meant to put the control
// away takes the selection with it, and the user who only wanted to stop adjusting a thing finds he
// has stopped having it picked out as well — with the control vanishing either way, which is what
// makes the difference so easy to miss until the thing has to be found and selected again.
//
// Only the room counts as outside. A press landing anywhere in the UI layer is some control's own
// business, and no control drops a selection. And only a tap counts: a press that travels is the
// user swinging the camera round to see what he is adjusting from another side, which must not cost
// him the control he is adjusting it with — the same rule the color palette dismisses itself by, and
// for the same reason.
export default function useWorldTapDismiss(onDismiss: () => void): void
{
    // Held in a ref so that a caller passing a freshly built closure on every render does not cost a
    // teardown and rebuild of the listeners below.
    const onDismissRef = useRef(onDismiss);
    onDismissRef.current = onDismiss;

    useEffect(() => {
        let pressPos: {x: number, y: number} | undefined;
        let pressThresholdPx = MOUSE_DRAG_THRESHOLD_PX;

        const onPointerDown = (ev: PointerEvent) => {
            pressPos = pressedTheRoom(ev.target) ? {x: ev.clientX, y: ev.clientY} : undefined;
            // What counts as having stayed still depends on what is doing the pressing, exactly as
            // it does for the game's own reading of a tap (see PointerDragInput): a finger wanders
            // where a mouse does not.
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

            // The tap is spent here. It never reaches the canvas underneath, so the room keeps what
            // was picked out in it.
            ev.stopPropagation();
            onDismissRef.current();
        };

        // Capturing, so that both readings come before whatever the pressed element does with the
        // event — the game canvas's own click handler above all, which is the one being headed off.
        window.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("click", onClick, true);
        return () => {
            window.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("click", onClick, true);
        };
    }, []);
}

// Whether a press landed on the room rather than on the interface drawn over it. The UI is one
// element of the page, so everything outside it — the game canvas and the world-space gizmos drawn
// over it alike — is the room.
function pressedTheRoom(target: EventTarget | null): boolean
{
    const uiLayer = document.getElementById("uiRoot");
    return uiLayer != null && target instanceof Node && !uiLayer.contains(target);
}
