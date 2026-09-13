import * as THREE from "three";
import NumUtil from "../../../../../../shared/math/util/numUtil";

// How much of the view one wheel notch adds or takes away.
const viewScalePerWheelNotch = 1.15;

// Wheel pixels per notch. Trackpads send small continuous deltas (and pinch as ctrl+wheel), which the
// continuous reading handles.
const wheelPixelsPerNotch = 100;
const wheelLinesPerNotch = 3;
const wheelPagesPerNotch = 1;

// Caps huge deltas (free-spinning wheels, fast scrolling).
const maxWheelNotchesPerEvent = 3;

// Below this separation, pinch ratios are noise; hold zoom still.
const minPinchDistancePx = 24;

// Pinch and wheel, reported as one view-scale multiplier (not a distance), so a pinch follows the
// fingers and a notch means the same at any distance.

export default class PointerZoomInput
{
    // Requested view scale over the last frame (>1 = closer).
    viewScale: number = 1;

    // What the gestures have asked for since the last frame was read.
    private pendingViewScale: number = 1;

    // Touch/pen points by pointer id, in client CSS px (mice can't pinch).
    private touchPositions: Map<number, THREE.Vector2> = new Map();

    // Last measured separation, or 0 when there's nothing to compare against.
    private pinchDistancePx: number = 0;

    update(): void
    {
        this.viewScale = this.pendingViewScale;
        this.pendingViewScale = 1;
    }

    isPinching(): boolean
    {
        return this.touchPositions.size >= 2;
    }

    onPointerPress(ev: PointerEvent): void
    {
        if (ev.pointerType === "mouse")
            return;

        this.touchPositions.set(ev.pointerId, new THREE.Vector2(ev.clientX, ev.clientY));

        // A new finger changes the separation without movement, so re-baseline.
        this.pinchDistancePx = 0;
    }

    onPointerRelease(ev: PointerEvent): void
    {
        if (this.touchPositions.delete(ev.pointerId))
            this.pinchDistancePx = 0; // As above: a finger leaving is not a pinch either.
    }

    onPointerMove(ev: PointerEvent): void
    {
        const touchPos = this.touchPositions.get(ev.pointerId);
        if (touchPos == undefined)
            return;

        touchPos.set(ev.clientX, ev.clientY);
        if (!this.isPinching())
            return;

        const distancePx = this.getPinchDistancePx();
        if (this.pinchDistancePx >= minPinchDistancePx && distancePx >= minPinchDistancePx)
            this.pendingViewScale *= distancePx / this.pinchDistancePx;
        this.pinchDistancePx = distancePx;
    }

    onWheel(ev: WheelEvent): void
    {
        // Block the browser's page zoom/scroll.
        ev.preventDefault();

        const notches = NumUtil.clampInRange(this.getWheelNotches(ev),
            -maxWheelNotchesPerEvent, maxWheelNotchesPerEvent);

        // Pushing the wheel away gives a negative delta and should zoom in.
        this.pendingViewScale *= Math.pow(viewScalePerWheelNotch, -notches);
    }

    // For gestures whose end will never arrive (lost focus, player removed).
    reset(): void
    {
        this.touchPositions.clear();
        this.pinchDistancePx = 0;
        this.pendingViewScale = 1;
    }

    // Uses the first two fingers; extra fingers are ignored.
    private getPinchDistancePx(): number
    {
        const touchPositions = this.touchPositions.values();
        const firstPos = touchPositions.next().value!;
        const secondPos = touchPositions.next().value!;
        return firstPos.distanceTo(secondPos);
    }

    private getWheelNotches(ev: WheelEvent): number
    {
        switch (ev.deltaMode)
        {
            case WheelEvent.DOM_DELTA_LINE:
                return ev.deltaY / wheelLinesPerNotch;
            case WheelEvent.DOM_DELTA_PAGE:
                return ev.deltaY / wheelPagesPerNotch;
            default: // DOM_DELTA_PIXEL
                return ev.deltaY / wheelPixelsPerNotch;
        }
    }
}
