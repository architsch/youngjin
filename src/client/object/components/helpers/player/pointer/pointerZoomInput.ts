import * as THREE from "three";
import NumUtil from "../../../../../../shared/math/util/numUtil";

// How much of the view one wheel notch adds or takes away.
const viewScalePerWheelNotch = 1.15;

// What counts as one notch, per unit the browser reports the wheel delta in. Pixels are the common
// case, and are also what a trackpad reports — as a stream of small values rather than as notches,
// which the reading below handles for free by being continuous. (A pinch on a trackpad arrives the
// same way, as a wheel held with the ctrl key.)
const wheelPixelsPerNotch = 100;
const wheelLinesPerNotch = 3;
const wheelPagesPerNotch = 1;

// A single wheel event can carry an enormous delta — a device with a free-spinning wheel, or a
// "fast scrolling" setting, produces them — and one of those would otherwise cross the whole zoom
// range in one step.
const maxWheelNotchesPerEvent = 3;

// Two fingers closer together than this are mostly reporting noise about their separation, and the
// ratio between two such readings swings wildly. Better to hold the zoom still until they part.
const minPinchDistancePx = 24;

//------------------------------------------------------------------------
// Reads the gestures that ask for a closer or wider view: two fingers pinching, and the mouse
// wheel. Both are reported as one reading, since they mean the same thing and only one of them can
// plausibly be under way at a time.
//
// The reading is a scale of what the user sees rather than a change of camera distance: a pinch
// grabs the view, and a view that is grabbed is expected to follow the fingers. Being a multiple
// also keeps a wheel notch meaning the same thing at every distance, whereas a fixed length added
// or subtracted would be a leap up close and imperceptible from far away.
//------------------------------------------------------------------------

export default class PointerZoomInput
{
    // How much the user asked the view to grow over the previous frame, as a multiple of its
    // current apparent size (1 = unchanged, above 1 = closer and larger, below 1 = further and
    // smaller).
    viewScale: number = 1;

    // What the gestures have asked for since the last frame was read.
    private pendingViewScale: number = 1;

    // The touch points currently on the canvas, in client CSS pixels, by pointer id. Only fingers
    // (or pens) can pinch, so a mouse is kept out of this altogether: it is here to tell a
    // two-finger gesture from a one-finger one.
    private touchPositions: Map<number, THREE.Vector2> = new Map();

    // The separation the ongoing pinch was last measured at, or zero while there is nothing to
    // compare against.
    private pinchDistancePx: number = 0;

    update(): void
    {
        this.viewScale = this.pendingViewScale;
        this.pendingViewScale = 1;
    }

    // Whether two or more fingers are down, i.e. whether the ongoing gesture is a pinch rather than
    // a drag (see PlayerPointerInput).
    isPinching(): boolean
    {
        return this.touchPositions.size >= 2;
    }

    onPointerPress(ev: PointerEvent): void
    {
        if (ev.pointerType === "mouse")
            return;

        this.touchPositions.set(ev.pointerId, new THREE.Vector2(ev.clientX, ev.clientY));

        // A finger arriving changes the separation without either of the fingers having moved, so
        // the pinch is measured afresh from here rather than against what it stood at before.
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
        // Nothing else may act on the wheel meanwhile: on a trackpad this gesture is the browser's
        // own page zoom, and on a mouse it is a page scroll.
        ev.preventDefault();

        const notches = NumUtil.clampInRange(this.getWheelNotches(ev),
            -maxWheelNotchesPerEvent, maxWheelNotchesPerEvent);

        // A wheel is pushed away from the user to bring the view closer, and the delta grows the
        // other way, hence the sign.
        this.pendingViewScale *= Math.pow(viewScalePerWheelNotch, -notches);
    }

    // Forgets every gesture in progress, for when the input is no longer being watched (the canvas
    // losing the user's attention, the player going away) and the ends of those gestures will
    // therefore never be seen.
    reset(): void
    {
        this.touchPositions.clear();
        this.pinchDistancePx = 0;
        this.pendingViewScale = 1;
    }

    // Two fingers make a pinch. A third resting on the screen is ignored rather than allowed to
    // change what the first two are saying, so the reading follows whichever fingers started it.
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
