import NumUtil from "../../../../../math/util/numUtil";

// How far inside its footprint a canvas or a label is drawn, on every side and in world units, so it
// doesn't depend on the object's size. The footprint, and so what the object claims of its face, stays
// whole. Shared by the codecs that store one, as one stored step each.
const MAX_MARGIN = 0.2;
const MARGIN_STEP = 0.05;
const NUM_MARGIN_STEPS = Math.round(MAX_MARGIN / MARGIN_STEP) + 1;

// What the band surrounds (a picture, text) never shrinks below this; past it the margin gives way,
// never the band.
const MIN_INNER_SIZE = 0.1;

const MarginCompositionConstants = {
    maxMargin: MAX_MARGIN,
    marginStep: MARGIN_STEP,
    minInnerSize: MIN_INNER_SIZE,

    toMarginStep: (margin: number): number =>
    {
        const step = Math.round(margin / MARGIN_STEP);
        return Number.isFinite(step) ? NumUtil.clampInRange(step, 0, NUM_MARGIN_STEPS - 1) : 0;
    },

    // Clamped, so any char yields a margin; rounded so a decoded margin equals the authored one.
    fromMarginStep: (step: number): number =>
    {
        const clampedStep = NumUtil.clampInRange(step, 0, NUM_MARGIN_STEPS - 1);
        return Math.round(clampedStep * MARGIN_STEP * 1e6) / 1e6;
    },

    // The drawn extent along one footprint axis, band included (a band of 0 when there is no frame).
    getDrawnSize: (footprint: number, margin: number, band: number): number =>
        Math.min(footprint, Math.max(footprint - 2 * margin, 2 * band + MIN_INNER_SIZE)),
};

export default MarginCompositionConstants;
