import * as THREE from "three";
import GraphicsManager from "../../../../graphics/graphicsManager";
import PlayerController from "../../playerController";
import CameraUtil from "../../../../graphics/util/cameraUtil";
import PointerDragInput from "./pointer/pointerDragInput";
import PointerZoomInput from "./pointer/pointerZoomInput";

//------------------------------------------------------------------------
// Watches the game canvas for pointer activity, independently of the camera
// mode, and hands each event to the module that reads that kind of gesture:
// PointerDragInput (one pointer moving while held down), PointerZoomInput
// (two fingers pinching, or the mouse wheel). A press and release that stayed
// in one place is a click, which this class reads itself: there is no gesture
// to accumulate, only the one cast into the scene that answers what was
// clicked on (see CameraUtil).
//
// Listening in one place is what lets those gestures be told apart, since
// they are not distinguishable event by event: a drag and a pinch are the
// same events until a second finger arrives, and a click is only a click by
// virtue of the drag that did not happen. This class holds the arbitration
// between them, and exposes each reading for whoever acts on it.
//------------------------------------------------------------------------

export default class PlayerPointerInput
{
    private dragInput: PointerDragInput = new PointerDragInput();
    private zoomInput: PointerZoomInput = new PointerZoomInput();

    // The pointer's movement since the previous frame while a drag is ongoing (in CSS pixels).
    get dragDelta(): THREE.Vector2
    {
        return this.dragInput.dragDelta;
    }

    // How much the user asked the view to grow over the previous frame, as a multiple of its
    // current apparent size (1 = unchanged).
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

        // Not passive, since the wheel gesture is the browser's own to scroll or zoom the page with
        // unless it is told otherwise (see PointerZoomInput).
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
        // Capture the pointer so the gesture continues even when the cursor passes
        // over CSS2D overlays (e.g. WorldSpaceArrow click targets).
        const canvas = GraphicsManager.getGameCanvas();
        canvas.setPointerCapture(ev.pointerId);

        this.zoomInput.onPointerPress(ev);

        // A second finger settles what the gesture is: what would have been read as one finger
        // dragging the view around is the user pinching it, and taking it for both at once would
        // spin the view while it is being zoomed.
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

        // Any finger leaving ends the drag, rather than the drag carrying on with whichever finger
        // is left: the one left behind is nowhere near where the drag it would inherit began, and
        // the view would jump the difference on the next frame. Pressing again starts a new one.
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

        // Only a gesture that stayed in one place is a click on what lies under it. One that
        // travelled was the user steering, orbiting, or pinching the view, and clicking whatever
        // the pointer happened to come to rest on would be a surprise every time.
        if (!this.dragInput.gestureIsTap())
            return;

        const intersection = CameraUtil.castFromPointer(ev);
        if (intersection == undefined)
            return; // The user pointed past everything drawn.

        // Geometry belonging to no object is a gizmo drawn over the room, which has nothing of its
        // own to be told about the click.
        const gameObject = CameraUtil.getObjectFromIntersection(intersection);
        if (gameObject != undefined)
            gameObject.onClick(intersection.instanceId ?? -1, intersection.point);
    }

    // Whatever gestures were in progress are given up on, for when their ends will never be seen:
    // the canvas has lost the user's attention, or the player is going away.
    private abortGestures(): void
    {
        this.dragInput.cancel();
        this.zoomInput.reset();
    }
}
