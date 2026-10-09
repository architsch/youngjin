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

    private numFingers: number = 0;

    // The first two fingers' separation as last measured (client CSS px), or 0 with fewer down.
    private pinchDistancePx: number = 0;

    update(): void
    {
        this.viewScale = this.pendingViewScale;
        this.pendingViewScale = 1;
    }

    isPinching(): boolean
    {
        return this.numFingers >= 2;
    }

    // Reads the fingers now down that count toward a pinch (see PlayerPointerInput), on each landing, lift
    // or move of one. Uses the first two; extra fingers are ignored.
    onFingers(fingers: ArrayLike<{clientX: number, clientY: number}>): void
    {
        const distancePx = (fingers.length >= 2)
            ? Math.hypot(fingers[1].clientX - fingers[0].clientX, fingers[1].clientY - fingers[0].clientY)
            : 0;

        // A finger landing or lifting changes the separation without movement, so it only re-baselines.
        if (fingers.length === this.numFingers
            && this.pinchDistancePx >= minPinchDistancePx && distancePx >= minPinchDistancePx)
        {
            this.pendingViewScale *= distancePx / this.pinchDistancePx;
        }
        this.numFingers = fingers.length;
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
        this.numFingers = 0;
        this.pinchDistancePx = 0;
        this.pendingViewScale = 1;
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
