// A room's stored settings: its atmosphere (lamps themselves are contents), plus the hub balancer's
// ordering. All fields are small integer steps or palette indices, so the whole thing encodes to a
// short string on the room (see RoomPrefsUtil and @docs/graphics/lighting.md).
export default interface RoomPrefs
{
    // Ambient color ("Light" palette) and strength step.
    ambientColorIndex: number;
    ambientIntensityStep: number;

    // Head light color ("Light" palette), power, and range (reach and falloff together; see HeadLightUtil).
    headLightColorIndex: number;
    headLightPowerStep: number;
    headLightRangeStep: number;

    // Fog color ("Fog" palette) and near/far distance steps. Also layered over the sky (see the sky shader).
    fogColorIndex: number;
    fogNearStep: number;
    fogFarStep: number;

    // Smoke (uneven fog density in 3D): strength (0 = plain fog), scale, speed (world units, independent
    // of scale), drift bearing and rise.
    fogSmokeAmplitudeStep: number;
    fogSmokeScaleStep: number;
    fogSmokeSpeedStep: number;
    fogSmokeDriftStep: number;
    fogSmokeRiseStep: number;

    // Sky color ("Fog" palette), separate from the fog color. Missing values fall back to the fog color
    // (see RoomPrefsUtil).
    skyColorIndex: number;

    // Clouds: color ("Scenery" palette), opacity (0 = clear), scale, edge softness, and angular speed
    // (independent of scale).
    cloudColorIndex: number;
    cloudOpacityStep: number;
    cloudScaleStep: number;
    cloudSoftnessStep: number;
    cloudSpeedStep: number;

    // Ground below the horizon (sky only): low and peak colors ("Scenery" palette), scale, solidity (how
    // slowly it fades into the air; never opaque at the horizon), and slope softness.
    groundColorIndex: number;
    groundPeakColorIndex: number;
    groundScaleStep: number;
    groundSolidityStep: number;
    groundSoftnessStep: number;

    // Hubs only: where this one stands in the order the balancer fills hubs, smallest first (see
    // RoomPickerUtil). Other room types carry it and never have it read.
    initialJoinPriority: number;
}
