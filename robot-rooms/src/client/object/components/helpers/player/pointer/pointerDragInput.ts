import * as THREE from "three";
import PlayerController from "../../../playerController";
import PointerCoordUtil from "../../../../../graphics/util/pointerCoordUtil";
import { MOUSE_DRAG_THRESHOLD_PX, TOUCH_DRAG_THRESHOLD_PX } from "../../../../../system/clientConstants";

const dragOffsetTemp: THREE.Vector2 = new THREE.Vector2();

// Pointer travel (CSS px) for one unit of steering. A fixed length, not canvas-relative, so control
// feels the same in portrait and landscape.
const dragReferenceLengthPx = 120;

// Per-axis gains; PlayerController clamps turning and walking to different ranges.
const dragSensitivityX = 0.85;
const dragSensitivityY = 1.25;

// Mouse gain for steering only (the orbit reading is 1:1 for any pointer).
const mouseDragMultiplier = 0.6;

// One held pointer, read two ways: a joystick-style offset from the press point (steering) and a 1:1
// per-frame dragDelta (orbit). Also decides whether a gesture was a tap.

export default class PointerDragInput
{
    // The pointer's movement since the previous frame while a drag is ongoing (in CSS pixels).
    dragDelta: THREE.Vector2 = new THREE.Vector2();

    private pointerIsDown: boolean = false;

    // From the press event, not the device (hybrid devices exist).
    private pointerIsMouse: boolean = false;

    // False once the gesture is cancelled (e.g. taken over by a pinch).
    private gestureMayBeTap: boolean = false;

    private pointerDownPos: THREE.Vector2 = new THREE.Vector2();
    private pointerDragPos: THREE.Vector2 = new THREE.Vector2();
    private pointerLastDragPos: THREE.Vector2 = new THREE.Vector2();

    update(controller: PlayerController): void
    {
        if (this.pointerIsDown)
        {
            PointerCoordUtil.getPixelOffset(this.pointerLastDragPos, this.pointerDragPos, this.dragDelta);
            this.pointerLastDragPos.copy(this.pointerDragPos);

            PointerCoordUtil.getPixelOffset(this.pointerDownPos, this.pointerDragPos, dragOffsetTemp);

            const mouseInputX = dragOffsetTemp.x / dragReferenceLengthPx;
            const mouseInputY = dragOffsetTemp.y / dragReferenceLengthPx;
            const deviceMultiplier = this.pointerIsMouse ? mouseDragMultiplier : 1;

            controller.dx += mouseInputX * dragSensitivityX * deviceMultiplier;
            controller.dy += mouseInputY * dragSensitivityY * deviceMultiplier;
        }
        else
            this.dragDelta.set(0, 0);
    }

    onPointerPress(ev: PointerEvent): void
    {
        this.pointerIsDown = true;
        this.pointerIsMouse = (ev.pointerType === "mouse");
        this.gestureMayBeTap = true;

        PointerCoordUtil.getNDC(ev, this.pointerDownPos);
        PointerCoordUtil.getNDC(ev, this.pointerDragPos);
        this.pointerLastDragPos.copy(this.pointerDragPos);
    }

    onPointerRelease(): void
    {
        this.pointerIsDown = false;
    }

    onPointerMove(ev: PointerEvent): void
    {
        if (this.pointerIsDown)
            PointerCoordUtil.getNDC(ev, this.pointerDragPos);
    }

    // Abandons the drag and rules out a tap (see PlayerPointerInput).
    cancel(): void
    {
        this.pointerIsDown = false;
        this.gestureMayBeTap = false;
    }

    // Tap tolerance depends on the pointer type of the press.
    gestureIsTap(): boolean
    {
        if (!this.gestureMayBeTap)
            return false;

        const thresholdPx = this.pointerIsMouse ? MOUSE_DRAG_THRESHOLD_PX : TOUCH_DRAG_THRESHOLD_PX;
        return PointerCoordUtil.getPixelOffset(this.pointerDownPos, this.pointerDragPos, dragOffsetTemp)
            .lengthSq() <= thresholdPx * thresholdPx;
    }
}
