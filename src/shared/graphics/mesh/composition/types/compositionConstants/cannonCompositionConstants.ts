import Vec3 from "../../../../../math/types/vec3";

// A cannon's parts, in the frame of the face it stands on: x and y across the face, z out of it, in world units, all
// within the unit cube over its footprint. A rusty plate lies on the face, a pillar stands on the plate, and the barrel
// turns about a pivot over the pillar, whose top it hides. A counter is a black panel showing the balls left in lit
// segments, as a digital display does: on a floor each side of the pillar carries one, and on a wall its left and
// right sides do, and the plate a third, over the pillar.
const CannonCompositionConstants =
{
    plateSize: {x: 0.9, y: 0.9, z: 0.06} as Vec3,
    pillarSize: {x: 0.28, y: 0.28, z: 0.4} as Vec3,
    // How far out of the face the barrel's pivot is.
    pivotHeight: 0.6,
    barrelDiameter: 0.5,
    barrelLength: 0.78,
    // The dark disk at the barrel's mouth, which stands this far proud of its end.
    muzzleDiameter: 0.36,
    muzzleThickness: 0.02,
    muzzleProud: 0.006,
    // A counter's square panel: on the pillar, from this far over the plate to under the barrel lying level, and on the
    // plate, this far in from its upper edge. A digit's size on it, the gap between two digits, and a segment's
    // thickness.
    counterSize: 0.23,
    counterBottom: 0.03,
    plateCounterInset: 0.04,
    digitWidth: 0.085,
    digitHeight: 0.16,
    digitGap: 0.02,
    segmentThickness: 0.016,

    // Colors, as [0,255] RGB (see InstancedMeshCompositionPart).
    plateColor: {x: 132, y: 78, z: 48} as Vec3,
    pillarColor: {x: 92, y: 96, z: 104} as Vec3,
    barrelColor: {x: 196, y: 200, z: 206} as Vec3,
    muzzleColor: {x: 16, y: 16, z: 18} as Vec3,
    counterColor: {x: 6, y: 6, z: 8} as Vec3,
    digitColor: {x: 140, y: 240, z: 130} as Vec3,
    digitWarningColor: {x: 255, y: 40, z: 32} as Vec3,
    // Its ball's (see CannonCompositionUtil.buildBallParts).
    ballColor: {x: 72, y: 72, z: 78} as Vec3,

    // Where each part is in the list a cannon is composed of (see CannonCompositionUtil.buildParts): the counters' panels
    // follow the muzzle, a side each, then their digits' segments, a counter's after another's, the tens digit's first.
    // The plate's counter is made of the upper side's.
    plateIndex: 0,
    pillarIndex: 1,
    barrelIndex: 2,
    muzzleIndex: 3,
    firstCounterIndex: 4,
    numCounters: 4,
    firstSegmentIndex: 8,
    digitsPerCounter: 2,
    segmentsPerDigit: 7,
};

export default CannonCompositionConstants;
