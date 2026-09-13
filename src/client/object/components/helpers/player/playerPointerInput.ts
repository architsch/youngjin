import * as THREE from "three";
import GraphicsManager from "../../../../graphics/graphicsManager";
import PlayerController from "../../playerController";
import CameraUtil from "../../../../graphics/util/cameraUtil";
import PointerDragInput from "./pointer/pointerDragInput";
import PointerZoomInput from "./pointer/pointerZoomInput";

// Arbitrates canvas pointer gestures regardless of camera mode: PointerDragInput (one held pointer),
// PointerZoomInput (pinch/wheel), and taps, read here as a raycast click (see CameraUtil). Gestures
// can't be told apart per event (a drag becomes a pinch when a second finger lands), so the
// arbitration lives in one place.

export default class PlayerPointerInput
{
    private dragInput: PointerDragInput = new PointerDragInput();
    private zoomInput: PointerZoomInput = new PointerZoomInput();

    // The pointer's movement since the previous frame while a drag is ongoing (in CSS pixels).
    get dragDelta(): THREE.Vector2
    {
        return this.dragInput.dragDelta;
    }

    // Requested view scale over the last frame (1 = unchanged).
    get viewScale(): number
    {
        return this.zoomInput.viewScale;
    }

    onSpawn(controller: PlayerController): void
    {
        const canvas = GraphicsManager.getGameCanvas();
        this.onPointerPress = this.onPointerPress.bind(this);
        this.onPointerRelease = this.onPointerRelease.bind(this);
        this.onFocusOut = this.onFocusOut.bind(this);
        this.onBlur = this.onBlur.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onClick = this.onClick.bind(this);

        canvas.addEventListener("pointerdown", this.onPointerPress);
        canvas.addEventListener("pointerup", this.onPointerRelease);
        canvas.addEventListener("pointercancel", this.onPointerRelease);
        canvas.addEventListener("pointerleave", this.onPointerRelease);
        canvas.addEventListener("pointerout", this.onPointerRelease);
        canvas.addEventListener("focusout", this.onFocusOut);
        canvas.addEventListener("blur", this.onBlur);
        canvas.addEventListener("pointermove", this.onPointerMove);

        // Non-passive so preventDefault can stop page scroll/zoom (see PointerZoomInput).
        canvas.addEventListener("wheel", this.onWheel, {passive: false});
        canvas.addEventListener("click", this.onClick);
    }

    onDespawn(controller: PlayerController): void
    {
        const canvas = GraphicsManager.getGameCanvas();
        canvas.removeEventListener("pointerdown", this.onPointerPress);
        canvas.removeEventListener("pointerup", this.onPointerRelease);
        canvas.removeEventListener("pointercancel", this.onPointerRelease);
        canvas.removeEventListener("pointerleave", this.onPointerRelease);
        canvas.removeEventListener("pointerout", this.onPointerRelease);
        canvas.removeEventListener("focusout", this.onFocusOut);
        canvas.removeEventListener("blur", this.onBlur);
        canvas.removeEventListener("pointermove", this.onPointerMove);
        canvas.removeEventListener("wheel", this.onWheel);
        canvas.removeEventListener("click", this.onClick);

        this.abortGestures();
    }

    update(deltaTime: number, controller: PlayerController): void
    {
        this.dragInput.update(controller);
        this.zoomInput.update();
    }

    private onPointerPress(ev: PointerEvent): void
    {
        // Capture so the gesture continues over CSS2D overlays (e.g. WorldSpaceArrow click targets).
        const canvas = GraphicsManager.getGameCanvas();
        canvas.setPointerCapture(ev.pointerId);

        this.zoomInput.onPointerPress(ev);

        // A second finger turns the drag into a pinch (never both).
        if (this.zoomInput.isPinching())
            this.dragInput.cancel();
        else
            this.dragInput.onPointerPress(ev);
    }

    private onPointerMove(ev: PointerEvent): void
    {
        this.zoomInput.onPointerMove(ev);
        if (!this.zoomInput.isPinching())
            this.dragInput.onPointerMove(ev);
    }

    private onPointerRelease(ev: PointerEvent): void
    {
        this.zoomInput.onPointerRelease(ev);

        // Any lifted finger ends the drag; continuing with the remaining finger would jump the view.
        this.dragInput.onPointerRelease();
    }

    private onFocusOut(ev: FocusEvent): void
    {
        this.abortGestures();
    }

    private onBlur(ev: FocusEvent): void
    {
        this.abortGestures();
    }

    private onWheel(ev: WheelEvent): void
    {
        this.zoomInput.onWheel(ev);
    }

    private onClick(ev: PointerEvent): void
    {
        ev.preventDefault();

        // Only a stationary gesture clicks.
        if (!this.dragInput.gestureIsTap())
            return;

        const intersection = CameraUtil.castFromPointer(ev);
        if (intersection == undefined)
            return; // The user pointed past everything drawn.

        // Gizmos belong to no object.
        const gameObject = CameraUtil.getObjectFromIntersection(intersection);
        if (gameObject != undefined)
            gameObject.onClick(intersection.instanceId ?? -1, intersection.point);
    }

    // For gestures whose end will never arrive (lost focus, player removed).
    private abortGestures(): void
    {
        this.dragInput.cancel();
        this.zoomInput.reset();
    }
}
