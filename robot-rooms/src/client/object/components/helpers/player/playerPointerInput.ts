import * as THREE from "three";
import GraphicsManager from "../../../../graphics/graphicsManager";
import PlayerController from "../../playerController";
import CameraUtil from "../../../../graphics/util/cameraUtil";
import PointerDragInput from "./pointer/pointerDragInput";
import PointerZoomInput from "./pointer/pointerZoomInput";
import GizmoDragUtil from "../../../../graphics/util/gizmoDragUtil";
import ScrollAreaUtil from "../../../../ui/util/scrollAreaUtil";
import { gameModeObservable, numOpenPopupsObservable } from "../../../../system/clientObservables";
import { ongoingClientProcessExists } from "../../../../system/types/clientProcess";

// Arbitrates pointer gestures regardless of camera mode: gizmo drags (GizmoDragUtil, offered every canvas
// press first), PointerDragInput (one held pointer), PointerZoomInput (pinch/wheel), and taps, read here as
// a raycast click (see CameraUtil). Gestures can't be told apart per event (a drag becomes a pinch when a
// second finger lands), so the arbitration lives in one place. Presses are the canvas's alone; the wheel
// and a pinch's fingers are heard page-wide, since edit mode gives them to the camera over the 2D UI too.

export default class PlayerPointerInput
{
    private dragInput: PointerDragInput = new PointerDragInput();
    private zoomInput: PointerZoomInput = new PointerZoomInput();

    // The fingers that count toward a pinch, refilled on each touch event.
    private pinchFingers: Touch[] = [];

    // Clicks arrive between frames, so the latest waits here for the next update to publish it.
    private pendingClickedPoint: THREE.Vector3 | undefined;
    private frameClickedPoint: THREE.Vector3 | undefined;

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

    // Where a play-mode click since the previous frame hit a voxel quad or object (world space), if one did.
    get clickedPoint(): THREE.Vector3 | undefined
    {
        return this.frameClickedPoint;
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
        this.onTouch = this.onTouch.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onClick = this.onClick.bind(this);

        canvas.addEventListener("pointerdown", this.onPointerPress);
        canvas.addEventListener("pointerup", this.onPointerRelease);
        canvas.addEventListener("pointercancel", this.onPointerRelease);
        canvas.addEventListener("pointerleave", this.onPointerRelease);
        canvas.addEventListener("pointerout", this.onPointerRelease);
        canvas.addEventListener("focusout", this.onFocusOut);
        canvas.addEventListener("blur", this.onBlur);
        canvas.addEventListener("pointermove", this.onPointerMove);
        canvas.addEventListener("click", this.onClick);

        // Non-passive so preventDefault can stop page scroll/zoom (see PointerZoomInput).
        window.addEventListener("wheel", this.onWheel, {passive: false});

        // Touch events, since a finger's pointer events end once the browser scrolls by it. Capturing, as
        // some controls keep their touchstart from bubbling (see RangeInput).
        window.addEventListener("touchstart", this.onTouch, {capture: true, passive: true});
        window.addEventListener("touchend", this.onTouch, {capture: true, passive: true});
        window.addEventListener("touchcancel", this.onTouch, {capture: true, passive: true});
        window.addEventListener("touchmove", this.onTouchMove, {capture: true, passive: false});
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
        canvas.removeEventListener("click", this.onClick);
        window.removeEventListener("wheel", this.onWheel);
        window.removeEventListener("touchstart", this.onTouch, true);
        window.removeEventListener("touchend", this.onTouch, true);
        window.removeEventListener("touchcancel", this.onTouch, true);
        window.removeEventListener("touchmove", this.onTouchMove, true);

        this.abortGestures();
    }

    update(deltaTime: number, controller: PlayerController): void
    {
        this.dragInput.update(controller);
        this.zoomInput.update();
        this.frameClickedPoint = this.pendingClickedPoint;
        this.pendingClickedPoint = undefined;
    }

    private onPointerPress(ev: PointerEvent): void
    {
        // Capture so the gesture continues over CSS2D overlays (e.g. WorldSpaceArrow click targets).
        const canvas = GraphicsManager.getGameCanvas();
        canvas.setPointerCapture(ev.pointerId);

        // A press a gizmo takes (e.g. on the selected object's outline) never reaches the camera. A second
        // finger's is taken back by the touch event that follows it (see onTouch).
        if (!GizmoDragUtil.tryBegin(ev))
            this.dragInput.onPointerPress(ev);
    }

    private onPointerMove(ev: PointerEvent): void
    {
        if (GizmoDragUtil.isActive())
            GizmoDragUtil.move(ev);
        else if (!this.zoomInput.isPinching())
        {
            this.dragInput.onPointerMove(ev);
            if (ev.buttons === 0)
                GizmoDragUtil.hover(ev);
        }
    }

    private onPointerRelease(ev: PointerEvent): void
    {
        // Any lifted finger ends the drag; continuing with the remaining finger would jump the view.
        this.dragInput.onPointerRelease();
        GizmoDragUtil.end();
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
        // Over the 2D UI, a scrollable area keeps the roll to scroll by (see ScrollAreaUtil), though not
        // the pinch a trackpad sends as a roll with ctrl held.
        if (ev.target !== GraphicsManager.getGameCanvas()
            && (!this.zoomReachesPastUI() || (!ev.ctrlKey && ScrollAreaUtil.find(ev.target) != null)))
        {
            return;
        }
        this.zoomInput.onWheel(ev);
    }

    // A finger has landed, lifted or (from onTouchMove) moved, anywhere on the page.
    private onTouch(ev: TouchEvent): void
    {
        // Every finger on the canvas counts toward a pinch, and one on the 2D UI where the zoom reaches
        // past it.
        const canvas = GraphicsManager.getGameCanvas();
        const zoomReachesPastUI = this.zoomReachesPastUI();
        this.pinchFingers.length = 0;
        for (let i = 0; i < ev.touches.length; ++i)
        {
            const touch = ev.touches[i];
            if (touch.target === canvas || zoomReachesPastUI)
                this.pinchFingers.push(touch);
        }
        this.zoomInput.onFingers(this.pinchFingers);

        // A second finger turns the drag into a pinch (never both), a gizmo's drag included.
        if (this.zoomInput.isPinching())
        {
            this.dragInput.cancel();
            GizmoDragUtil.cancel();
        }
    }

    private onTouchMove(ev: TouchEvent): void
    {
        this.onTouch(ev);

        // A pinch's moves are kept from the browser, which would scroll the UI under the fingers by them.
        // A scroll already under way can't be stopped, and its moves say so.
        if (this.zoomInput.isPinching() && ev.cancelable)
            ev.preventDefault();
    }

    // Whether a wheel roll or a pinch that lands on the 2D UI zooms the camera as it would on the canvas:
    // in edit mode, and never under a popup or the loading indicator.
    private zoomReachesPastUI(): boolean
    {
        return gameModeObservable.peek() == "edit" && numOpenPopupsObservable.peek() == 0
            && !ongoingClientProcessExists();
    }

    private onClick(ev: PointerEvent): void
    {
        ev.preventDefault();

        // Only a stationary gesture clicks, and never one a gizmo took (a tap on a handle would
        // otherwise select whatever is behind it).
        if (GizmoDragUtil.lastGestureWasClaimed() || !this.dragInput.gestureIsTap())
            return;

        const intersection = CameraUtil.castFromPointer(ev);
        if (intersection == undefined)
            return; // The user pointed past everything drawn.

        // Gizmos belong to no object.
        const gameObject = CameraUtil.getObjectFromIntersection(intersection);
        if (gameObject == undefined)
            return;

        // In play mode, the eye camera pitches toward the hit (see FirstPersonCameraPose).
        if (gameModeObservable.peek() == "play")
            this.pendingClickedPoint = intersection.point.clone();
        gameObject.onClick(intersection.instanceId ?? -1, intersection.point);
    }

    // For gestures whose end will never arrive (lost focus, player removed).
    private abortGestures(): void
    {
        this.dragInput.cancel();
        this.zoomInput.reset();
        GizmoDragUtil.cancel();
    }
}
