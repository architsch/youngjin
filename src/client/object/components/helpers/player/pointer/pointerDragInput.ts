import * as THREE from "three";
import PlayerController from "../../../playerController";
import PointerCoordUtil from "../../../../../graphics/util/pointerCoordUtil";
import { MOUSE_DRAG_THRESHOLD_PX, TOUCH_DRAG_THRESHOLD_PX } from "../../../../../system/clientConstants";

const dragOffsetTemp: THREE.Vector2 = new THREE.Vector2();

// How far the pointer travels, as a physical distance, for a drag to read as one full unit of
// steering input. CSS pixels stand in for physical distance here: the page is served at
// "width=device-width, initial-scale=1", which makes one CSS pixel a density-independent unit
// rather than a hardware pixel, so this length is roughly constant across handheld screens.
//
// Measuring the drag against a fixed length, rather than against the canvas, is what keeps the
// control feeling the same whichever way the device is held. A canvas-relative measure makes the
// longer edge of the canvas the least responsive axis, and in portrait that axis is the one the
// player walks along.
const dragReferenceLengthPx = 120;

// Steering produced per reference length of pointer travel, per axis. Independent knobs: turning
// and walking are clamped to different ranges by PlayerController, so matching gains here do not
// imply the two axes reach full deflection at the same drag distance.
const dragSensitivityX = 0.85;
const dragSensitivityY = 1.25;

// A mouse is dragged from the wrist across a desk rather than with a thumb across a screen being
// held, so the same physical travel can warrant a different gain than a touch drag gets. Left
// neutral because the fixed-length measure already leaves a mouse drag more responsive than a
// canvas-relative one did on a large window; this is the knob to turn if that proves wrong.
// Applies to the steering reading only: the orbit reading is grab-style, and a control that follows
// the pointer is expected to follow it identically whatever is doing the pointing.
const mouseDragMultiplier = 0.6;

//------------------------------------------------------------------------
// Reads a single pointer being moved while held down. The drag is exposed in
// two readings, because the two things it drives want different ones: a
// joystick-style offset from the press point, fed into the controller's
// steering, and a grab-style per-frame delta (dragDelta) for consumers that
// follow the pointer 1:1, such as the orbit camera.
//
// It also answers whether the gesture that has just ended stayed still enough
// to count as a tap, which is what decides whether a click reaches the scene.
//------------------------------------------------------------------------

export default class PointerDragInput
{
    // The pointer's movement since the previous frame while a drag is ongoing (in CSS pixels).
    dragDelta: THREE.Vector2 = new THREE.Vector2();

    private pointerIsDown: boolean = false;

    // Which kind of pointer started the ongoing drag, taken from the press rather than assumed from
    // the device: a touchscreen laptop and a tablet with a mouse attached both make the device a
    // poor proxy for how the drag is actually being performed.
    private pointerIsMouse: boolean = false;

    // Whether the ongoing gesture may still turn out to be a tap. A gesture given up on midway
    // (a pinch taking it over) is none, however little the pointer ended up travelling.
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

    // Gives up the ongoing drag altogether, for when the gesture turns out to be something else
    // (see PlayerPointerInput). Unlike a release, this also rules out the tap that a gesture ending
    // where it started would otherwise be taken for.
    cancel(): void
    {
        this.pointerIsDown = false;
        this.gestureMayBeTap = false;
    }

    // Whether the gesture stayed within the allowance for a click rather than a drag. Measured
    // against the press that produced it, not against the device: a touchscreen laptop and a tablet
    // with a mouse attached both make the device a poor proxy for how steadily the pointer can be
    // held.
    gestureIsTap(): boolean
    {
        if (!this.gestureMayBeTap)
            return false;

        const thresholdPx = this.pointerIsMouse ? MOUSE_DRAG_THRESHOLD_PX : TOUCH_DRAG_THRESHOLD_PX;
        return PointerCoordUtil.getPixelOffset(this.pointerDownPos, this.pointerDragPos, dragOffsetTemp)
            .lengthSq() <= thresholdPx * thresholdPx;
    }
}
