import GraphicsManager from "../graphicsManager";
import { MOUSE_DRAG_THRESHOLD_PX, TOUCH_DRAG_THRESHOLD_PX } from "../../system/clientConstants";

// Something to click drawn over the game's view (a CSS2D element, e.g. a world-space arrow or a link in a speech
// bubble): a press on it that moves past the drag threshold is handed to the game canvas, so that a drag begun there
// still turns the camera; otherwise it stays, and clicks it.
const OverlayClickTargetUtil =
{
    makeClickable: (element: HTMLElement, onClick: () => void): void =>
    {
        let pressArmed = false;
        let pressStartX = 0;
        let pressStartY = 0;
        let pressPointerId: number | null = null;
        let pressIsMouse = false;

        function cleanupPress(): void {
            pressArmed = false;
            pressPointerId = null;
            document.removeEventListener("pointermove", onPressMove);
            document.removeEventListener("pointerup", cleanupPress);
            document.removeEventListener("pointercancel", cleanupPress);
        }

        function onPressMove(ev: PointerEvent): void {
            if (!pressArmed || ev.pointerId !== pressPointerId) return;
            const dx = ev.clientX - pressStartX;
            const dy = ev.clientY - pressStartY;
            const thresholdPx = pressIsMouse ? MOUSE_DRAG_THRESHOLD_PX : TOUCH_DRAG_THRESHOLD_PX;
            if (dx * dx + dy * dy < thresholdPx * thresholdPx) return;

            cleanupPress();

            const canvas = GraphicsManager.getGameCanvas();
            canvas.dispatchEvent(new PointerEvent("pointerdown", {
                pointerId: ev.pointerId,
                pointerType: ev.pointerType,
                clientX: pressStartX,
                clientY: pressStartY,
                bubbles: false,
            }));
            canvas.dispatchEvent(new PointerEvent("pointermove", ev));
        }

        element.addEventListener("pointerdown", (ev) => {
            pressArmed = true;
            pressStartX = ev.clientX;
            pressStartY = ev.clientY;
            pressPointerId = ev.pointerId;
            pressIsMouse = (ev.pointerType === "mouse");
            document.addEventListener("pointermove", onPressMove);
            document.addEventListener("pointerup", cleanupPress);
            document.addEventListener("pointercancel", cleanupPress);
        });
        element.addEventListener("click", (ev) => {
            ev.stopPropagation();
            onClick();
        });
    },
}

export default OverlayClickTargetUtil;
