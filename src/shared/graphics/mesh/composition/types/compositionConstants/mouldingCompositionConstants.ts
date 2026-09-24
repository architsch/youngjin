import NumUtil from "../../../../../math/util/numUtil";

// Band widths a moulded part can take, as one stored step each. Shared by every codec that stores a
// moulding, so a width means the same thing wherever it is written (see DefaultCompositionCodec,
// FramedPanelCompositionCodec).
const MIN_MOULDING_THICKNESS = 0.04;
const MAX_MOULDING_THICKNESS = 0.16;
const MOULDING_THICKNESS_STEP = 0.02;

const MouldingCompositionConstants = {
    minMouldingThickness: MIN_MOULDING_THICKNESS,
    maxMouldingThickness: MAX_MOULDING_THICKNESS,
    mouldingThicknessStep: MOULDING_THICKNESS_STEP,
    numThicknessSteps: Math.round(
        (MAX_MOULDING_THICKNESS - MIN_MOULDING_THICKNESS) / MOULDING_THICKNESS_STEP) + 1,

    toThicknessStep: (mouldingThickness: number): number =>
    {
        const step = Math.round(
            (mouldingThickness - MIN_MOULDING_THICKNESS) / MOULDING_THICKNESS_STEP);
        return Number.isFinite(step)
            ? NumUtil.clampInRange(step, 0, MouldingCompositionConstants.numThicknessSteps - 1) : 0;
    },

    // Clamped, so any char yields a band; rounded so a decoded width equals the authored one.
    fromThicknessStep: (step: number): number =>
    {
        const clampedStep = NumUtil.clampInRange(
            step, 0, MouldingCompositionConstants.numThicknessSteps - 1);
        return Math.round((MIN_MOULDING_THICKNESS + clampedStep * MOULDING_THICKNESS_STEP) * 1e6) / 1e6;
    },
};

export default MouldingCompositionConstants;
