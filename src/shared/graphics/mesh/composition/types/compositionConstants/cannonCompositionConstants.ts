import Vec3 from "../../../../../math/types/vec3";

// A cannon's parts, in the frame of the face it stands on: x and y across the face, z out of it, in world units, all
// within the unit cube over its footprint. A rusty plate lies on the face, a pillar stands on the plate, and the barrel
// turns about a pivot over the pillar, whose top it hides. Each side of the pillar carries a gauge: a dark strip, and a
// green one over it as long as the balls left.
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
    // A gauge's strips, across the pillar's side and along it, from this far over the plate to as far under the
    // barrel lying level, and how far the green one stops short of the dark one's ends.
    gaugeWidth: 0.12,
    gaugeLength: 0.23,
    gaugeBottom: 0.03,
    gaugeFillWidth: 0.07,
    gaugeFillMargin: 0.02,

    // Colors, as [0,255] RGB (see InstancedMeshCompositionPart).
    plateColor: {x: 132, y: 78, z: 48} as Vec3,
    pillarColor: {x: 92, y: 96, z: 104} as Vec3,
    barrelColor: {x: 196, y: 200, z: 206} as Vec3,
    muzzleColor: {x: 16, y: 16, z: 18} as Vec3,
    gaugeColor: {x: 28, y: 32, z: 30} as Vec3,
    gaugeFillColor: {x: 140, y: 240, z: 130} as Vec3,
    // Its ball's (see CannonCompositionUtil.buildBallParts).
    ballColor: {x: 24, y: 24, z: 27} as Vec3,

    // Where each part is in the list a cannon is composed of (see CannonCompositionUtil.buildParts): the gauges'
    // strips follow the muzzle, the dark ones first, a side each.
    plateIndex: 0,
    pillarIndex: 1,
    barrelIndex: 2,
    muzzleIndex: 3,
    firstGaugeIndex: 4,
    numGauges: 4,
};

export default CannonCompositionConstants;
