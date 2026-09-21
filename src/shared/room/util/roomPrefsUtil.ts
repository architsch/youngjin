import RoomPrefs from "../types/roomPrefs";
import StringUtil from "../../math/util/stringUtil";
import NumUtil from "../../math/util/numUtil";
import ColorUtil from "../../math/util/colorUtil";
import Vec3 from "../../math/types/vec3";
import { FOG_COLOR_PALETTE_NAME, LIGHT_COLOR_PALETTE_NAME,
    SCENERY_COLOR_PALETTE_NAME } from "../../system/sharedConstants";

// Max value of one stored character; every step is in [0, this] (see StringUtil).
export const MAX_ROOM_PREFS_STEP = 93;

// Hub join priority range. Far shorter than a step range: it is an ordering an admin holds in mind
// across every hub, not a value to tune.
export const MAX_ROOM_INITIAL_JOIN_PRIORITY = 9;

// Beyond the camera's far plane, so the top step means "no fog".
export const MAX_FOG_DISTANCE = 48;

// Max ambient intensity: intentionally into white-out territory (an effect, not brighter lighting).
// Derived so the default step still yields the original ambient.
export const MAX_AMBIENT_INTENSITY = 4.05;

// Minimum fog span: a guard against division by zero in the shader, not a limit on fog thickness.
const MIN_FOG_SPAN = 0.25;

// Cloud scale range, in cloud masses across the sky.
export const MIN_CLOUD_SCALE = 0.6;
export const MAX_CLOUD_SCALE = 24;

// Speed curve shape (see stepToSpeedFraction). The speed maxima are derived from it (see MAX_CLOUD_SPEED).
const SPEED_CURVATURE = 8;

// Cloud edge width range: from a cut edge to wide enough to dissolve clouds into haze.
export const MIN_CLOUD_SOFTNESS = 0.01;
export const MAX_CLOUD_SOFTNESS = 0.5;

// Ground scale range, in hills across the eye-to-ground drop (narrower than clouds, since ground is
// seen edge-on).
export const MIN_GROUND_SCALE = 0.25;
export const MAX_GROUND_SCALE = 8;

// Smoke scale range, in cycles per world unit (from a room-wide swell to wisps).
export const MIN_FOG_SMOKE_SCALE = 0.015;
export const MAX_FOG_SMOKE_SCALE = 0.6;

// Ground solidity range: divides the haze rate (never lifts the floor), so land still fades to nothing
// at the horizon.
export const MIN_GROUND_SOLIDITY = 0.35;
export const MAX_GROUND_SOLIDITY = 6;

// Ground slope width range: from a sharp coastline to barely separated colors.
export const MIN_GROUND_SOFTNESS = 0.006;
export const MAX_GROUND_SOFTNESS = 0.30;

// Defaults for missing characters: an unconfigured room (empty string) looks as rooms did before prefs
// existed (white ambient, ordinary head light, no fog). Shorter strings also decode safely.
const DEFAULT_AMBIENT_COLOR_INDEX = 0; // white, the first entry in the "Light" palette
// A third of the way up, which is exactly the strength the ambient light has always had.
const DEFAULT_AMBIENT_INTENSITY_STEP = 31;
const DEFAULT_HEAD_LIGHT_COLOR_INDEX = 0; // white, likewise
// Two thirds up, reproducing the ordinary head light while leaving range above (see HeadLightUtil).
const DEFAULT_HEAD_LIGHT_POWER_STEP = 62;
// Likewise two thirds up.
const DEFAULT_HEAD_LIGHT_RANGE_STEP = 62;
const DEFAULT_FOG_COLOR_INDEX = 0; // black, the first entry in the "Fog" palette
const DEFAULT_FOG_NEAR_STEP = MAX_ROOM_PREFS_STEP;
const DEFAULT_FOG_FAR_STEP = MAX_ROOM_PREFS_STEP;

// (No sky default: a missing sky color falls back to the fog color; see decode.)

// No weather is expressed with zero opacity; the color defaults to white so raising opacity gives clouds.
const DEFAULT_CLOUD_COLOR_INDEX = 10; // white, the last of the "Scenery" neutrals
const DEFAULT_CLOUD_OPACITY_STEP = 0;
// Fine enough for several clouds per view (coarser just looks like a gradient).
const DEFAULT_CLOUD_SCALE_STEP = 55;
const DEFAULT_CLOUD_SOFTNESS_STEP = 55;
const DEFAULT_CLOUD_SPEED_STEP = 34;
// Ground is on by default (two near-black neutrals): a sky without ground reads as a void. Dark ground
// suits any air color.
const DEFAULT_GROUND_COLOR_INDEX = 1; // "#1a1a1a", the first neutral above black
const DEFAULT_GROUND_PEAK_COLOR_INDEX = 3; // "#4d4d4d"
const DEFAULT_GROUND_SCALE_STEP = 42;
// Solid enough to read as land, short of the top of the range.
const DEFAULT_GROUND_SOLIDITY_STEP = 62;
// A gentle hillside slope.
const DEFAULT_GROUND_SOFTNESS_STEP = 57;
// Smoke on by default (invisible until fog is pulled in): moderate, slow, off-axis, gently rising.
const DEFAULT_FOG_SMOKE_AMPLITUDE_STEP = 33;
const DEFAULT_FOG_SMOKE_SCALE_STEP = 56;
const DEFAULT_FOG_SMOKE_SPEED_STEP = 26;
const DEFAULT_FOG_SMOKE_DRIFT_STEP = 12;
const DEFAULT_FOG_SMOKE_RISE_STEP = 58;
// Mid-range, so a hub can be promoted as well as demoted relative to the ones generation opens.
const DEFAULT_INITIAL_JOIN_PRIORITY = 5;

// Speeds at the default steps. Generated rooms store these steps explicitly, so these speeds must never
// change (they are the originally tuned speeds).
const TUNED_CLOUD_SPEED = 0.06 * Math.pow(DEFAULT_CLOUD_SPEED_STEP / MAX_ROOM_PREFS_STEP, 2);
const TUNED_FOG_SMOKE_SPEED = 1.5 * Math.pow(DEFAULT_FOG_SMOKE_SPEED_STEP / MAX_ROOM_PREFS_STEP, 2);

// Speed maxima, derived so the default step still yields the tuned speed (see SPEED_CURVATURE).
export const MAX_CLOUD_SPEED = TUNED_CLOUD_SPEED / stepToSpeedFraction(DEFAULT_CLOUD_SPEED_STEP);
export const MAX_FOG_SMOKE_SPEED =
    TUNED_FOG_SMOKE_SPEED / stepToSpeedFraction(DEFAULT_FOG_SMOKE_SPEED_STEP);

// Character positions in the stored string. Never reorder; append only (missing characters default).
const AMBIENT_COLOR_CHAR_INDEX = 0;
const HEAD_LIGHT_COLOR_CHAR_INDEX = 1;
const HEAD_LIGHT_POWER_CHAR_INDEX = 2;
const FOG_COLOR_CHAR_INDEX = 3;
const FOG_NEAR_CHAR_INDEX = 4;
const FOG_FAR_CHAR_INDEX = 5;
const AMBIENT_INTENSITY_CHAR_INDEX = 6;
const CLOUD_COLOR_CHAR_INDEX = 7;
const CLOUD_SCALE_CHAR_INDEX = 8;
const CLOUD_SPEED_CHAR_INDEX = 9;
const CLOUD_OPACITY_CHAR_INDEX = 10;
const CLOUD_SOFTNESS_CHAR_INDEX = 11;
const GROUND_COLOR_CHAR_INDEX = 12;
const GROUND_PEAK_COLOR_CHAR_INDEX = 13;
const GROUND_SCALE_CHAR_INDEX = 14;
const FOG_SMOKE_AMPLITUDE_CHAR_INDEX = 15;
const FOG_SMOKE_SCALE_CHAR_INDEX = 16;
const FOG_SMOKE_SPEED_CHAR_INDEX = 17;
const FOG_SMOKE_DRIFT_CHAR_INDEX = 18;
const FOG_SMOKE_RISE_CHAR_INDEX = 19;
const GROUND_SOLIDITY_CHAR_INDEX = 20;
const GROUND_SOFTNESS_CHAR_INDEX = 21;
const HEAD_LIGHT_RANGE_CHAR_INDEX = 22;
const SKY_COLOR_CHAR_INDEX = 23;
const INITIAL_JOIN_PRIORITY_CHAR_INDEX = 24;

// Encodes and decodes RoomPrefs. Decoding is total and establishes all invariants (indices in palettes,
// steps in range, a valid fog span); the server stores only canonicalized strings.
const RoomPrefsUtil =
{
    decode: (prefs: string): RoomPrefs =>
    {
        // Read first, since the sky falls back to it.
        const fogColorIndex = readPaletteIndex(prefs, FOG_COLOR_CHAR_INDEX,
            FOG_COLOR_PALETTE_NAME, DEFAULT_FOG_COLOR_INDEX);
        return {
            ambientColorIndex: readPaletteIndex(prefs, AMBIENT_COLOR_CHAR_INDEX,
                LIGHT_COLOR_PALETTE_NAME, DEFAULT_AMBIENT_COLOR_INDEX),
            ambientIntensityStep: readStep(prefs, AMBIENT_INTENSITY_CHAR_INDEX,
                DEFAULT_AMBIENT_INTENSITY_STEP),
            headLightColorIndex: readPaletteIndex(prefs, HEAD_LIGHT_COLOR_CHAR_INDEX,
                LIGHT_COLOR_PALETTE_NAME, DEFAULT_HEAD_LIGHT_COLOR_INDEX),
            headLightPowerStep: readStep(prefs, HEAD_LIGHT_POWER_CHAR_INDEX,
                DEFAULT_HEAD_LIGHT_POWER_STEP),
            headLightRangeStep: readStep(prefs, HEAD_LIGHT_RANGE_CHAR_INDEX,
                DEFAULT_HEAD_LIGHT_RANGE_STEP),
            fogColorIndex,
            fogNearStep: readStep(prefs, FOG_NEAR_CHAR_INDEX, DEFAULT_FOG_NEAR_STEP),
            fogFarStep: readStep(prefs, FOG_FAR_CHAR_INDEX, DEFAULT_FOG_FAR_STEP),
            skyColorIndex: readPaletteIndex(prefs, SKY_COLOR_CHAR_INDEX, FOG_COLOR_PALETTE_NAME,
                fogColorIndex),
            cloudColorIndex: readPaletteIndex(prefs, CLOUD_COLOR_CHAR_INDEX,
                SCENERY_COLOR_PALETTE_NAME, DEFAULT_CLOUD_COLOR_INDEX),
            cloudOpacityStep: readStep(prefs, CLOUD_OPACITY_CHAR_INDEX,
                DEFAULT_CLOUD_OPACITY_STEP),
            cloudScaleStep: readStep(prefs, CLOUD_SCALE_CHAR_INDEX, DEFAULT_CLOUD_SCALE_STEP),
            cloudSoftnessStep: readStep(prefs, CLOUD_SOFTNESS_CHAR_INDEX,
                DEFAULT_CLOUD_SOFTNESS_STEP),
            cloudSpeedStep: readStep(prefs, CLOUD_SPEED_CHAR_INDEX, DEFAULT_CLOUD_SPEED_STEP),
            groundColorIndex: readPaletteIndex(prefs, GROUND_COLOR_CHAR_INDEX,
                SCENERY_COLOR_PALETTE_NAME, DEFAULT_GROUND_COLOR_INDEX),
            groundPeakColorIndex: readPaletteIndex(prefs, GROUND_PEAK_COLOR_CHAR_INDEX,
                SCENERY_COLOR_PALETTE_NAME, DEFAULT_GROUND_PEAK_COLOR_INDEX),
            groundScaleStep: readStep(prefs, GROUND_SCALE_CHAR_INDEX, DEFAULT_GROUND_SCALE_STEP),
            groundSolidityStep: readStep(prefs, GROUND_SOLIDITY_CHAR_INDEX,
                DEFAULT_GROUND_SOLIDITY_STEP),
            groundSoftnessStep: readStep(prefs, GROUND_SOFTNESS_CHAR_INDEX,
                DEFAULT_GROUND_SOFTNESS_STEP),
            fogSmokeAmplitudeStep: readStep(prefs, FOG_SMOKE_AMPLITUDE_CHAR_INDEX,
                DEFAULT_FOG_SMOKE_AMPLITUDE_STEP),
            fogSmokeScaleStep: readStep(prefs, FOG_SMOKE_SCALE_CHAR_INDEX,
                DEFAULT_FOG_SMOKE_SCALE_STEP),
            fogSmokeSpeedStep: readStep(prefs, FOG_SMOKE_SPEED_CHAR_INDEX,
                DEFAULT_FOG_SMOKE_SPEED_STEP),
            fogSmokeDriftStep: readStep(prefs, FOG_SMOKE_DRIFT_CHAR_INDEX,
                DEFAULT_FOG_SMOKE_DRIFT_STEP),
            fogSmokeRiseStep: readStep(prefs, FOG_SMOKE_RISE_CHAR_INDEX,
                DEFAULT_FOG_SMOKE_RISE_STEP),
            initialJoinPriority: NumUtil.clampInRange(
                readStep(prefs, INITIAL_JOIN_PRIORITY_CHAR_INDEX, DEFAULT_INITIAL_JOIN_PRIORITY),
                0, MAX_ROOM_INITIAL_JOIN_PRIORITY),
        };
    },
    encode: (prefs: RoomPrefs): string =>
    {
        const chars: string[] = [];
        chars[AMBIENT_COLOR_CHAR_INDEX] = writePaletteIndex(prefs.ambientColorIndex,
            LIGHT_COLOR_PALETTE_NAME);
        chars[HEAD_LIGHT_COLOR_CHAR_INDEX] = writePaletteIndex(prefs.headLightColorIndex,
            LIGHT_COLOR_PALETTE_NAME);
        chars[HEAD_LIGHT_POWER_CHAR_INDEX] = writeStep(prefs.headLightPowerStep);
        chars[HEAD_LIGHT_RANGE_CHAR_INDEX] = writeStep(prefs.headLightRangeStep);
        chars[FOG_COLOR_CHAR_INDEX] = writePaletteIndex(prefs.fogColorIndex, FOG_COLOR_PALETTE_NAME);
        chars[FOG_NEAR_CHAR_INDEX] = writeStep(prefs.fogNearStep);
        chars[FOG_FAR_CHAR_INDEX] = writeStep(prefs.fogFarStep);
        chars[SKY_COLOR_CHAR_INDEX] = writePaletteIndex(prefs.skyColorIndex, FOG_COLOR_PALETTE_NAME);
        chars[AMBIENT_INTENSITY_CHAR_INDEX] = writeStep(prefs.ambientIntensityStep);
        chars[CLOUD_COLOR_CHAR_INDEX] = writePaletteIndex(prefs.cloudColorIndex,
            SCENERY_COLOR_PALETTE_NAME);
        chars[CLOUD_SCALE_CHAR_INDEX] = writeStep(prefs.cloudScaleStep);
        chars[CLOUD_SPEED_CHAR_INDEX] = writeStep(prefs.cloudSpeedStep);
        chars[CLOUD_OPACITY_CHAR_INDEX] = writeStep(prefs.cloudOpacityStep);
        chars[CLOUD_SOFTNESS_CHAR_INDEX] = writeStep(prefs.cloudSoftnessStep);
        chars[GROUND_COLOR_CHAR_INDEX] = writePaletteIndex(prefs.groundColorIndex,
            SCENERY_COLOR_PALETTE_NAME);
        chars[GROUND_PEAK_COLOR_CHAR_INDEX] = writePaletteIndex(prefs.groundPeakColorIndex,
            SCENERY_COLOR_PALETTE_NAME);
        chars[GROUND_SCALE_CHAR_INDEX] = writeStep(prefs.groundScaleStep);
        chars[GROUND_SOLIDITY_CHAR_INDEX] = writeStep(prefs.groundSolidityStep);
        chars[GROUND_SOFTNESS_CHAR_INDEX] = writeStep(prefs.groundSoftnessStep);
        chars[FOG_SMOKE_AMPLITUDE_CHAR_INDEX] = writeStep(prefs.fogSmokeAmplitudeStep);
        chars[FOG_SMOKE_SCALE_CHAR_INDEX] = writeStep(prefs.fogSmokeScaleStep);
        chars[FOG_SMOKE_SPEED_CHAR_INDEX] = writeStep(prefs.fogSmokeSpeedStep);
        chars[FOG_SMOKE_DRIFT_CHAR_INDEX] = writeStep(prefs.fogSmokeDriftStep);
        chars[FOG_SMOKE_RISE_CHAR_INDEX] = writeStep(prefs.fogSmokeRiseStep);
        chars[INITIAL_JOIN_PRIORITY_CHAR_INDEX] = StringUtil.convertRawNumberToVisibleASCII(
            clampToWholeStep(prefs.initialJoinPriority, MAX_ROOM_INITIAL_JOIN_PRIORITY));
        return chars.join("");
    },
    // Generated rooms store explicit defaults (see @.claude/rules/room-generation.md).
    getDefaultPrefsString: (): string =>
    {
        return RoomPrefsUtil.encode(RoomPrefsUtil.decode(""));
    },
    // Cubed: fine control over normal lighting in the lower half, white-out effects in the upper half,
    // reaching zero at the bottom. The default step (one third) cubed reproduces the original ambient.
    getAmbientIntensity: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.ambientIntensityStep, 0, MAX_ROOM_PREFS_STEP);
        return MAX_AMBIENT_INTENSITY * t * t * t;
    },
    // Steps are stored independently; the minimum span is enforced here on the decoded values.
    getFogNearDistance: (prefs: RoomPrefs): number =>
    {
        return stepToFogDistance(prefs.fogNearStep);
    },
    getFogFarDistance: (prefs: RoomPrefs): number =>
    {
        return Math.max(stepToFogDistance(prefs.fogFarStep),
            stepToFogDistance(prefs.fogNearStep) + MIN_FOG_SPAN);
    },
    // Linear; 0 means no clouds.
    getCloudOpacity: (prefs: RoomPrefs): number =>
    {
        return NumUtil.normalizeInRange(prefs.cloudOpacityStep, 0, MAX_ROOM_PREFS_STEP);
    },
    // Geometric (judged in ratios).
    getCloudSoftness: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.cloudSoftnessStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_CLOUD_SOFTNESS * Math.pow(MAX_CLOUD_SOFTNESS / MIN_CLOUD_SOFTNESS, t);
    },
    // Geometric (judged in ratios); never zero.
    getCloudScale: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.cloudScaleStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_CLOUD_SCALE * Math.pow(MAX_CLOUD_SCALE / MIN_CLOUD_SCALE, t);
    },
    // Angular rate (independent of scale), on the speed curve (see stepToSpeedFraction).
    getCloudSpeed: (prefs: RoomPrefs): number =>
    {
        return MAX_CLOUD_SPEED * stepToSpeedFraction(prefs.cloudSpeedStep);
    },
    // Geometric; never zero.
    getGroundScale: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.groundScaleStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_GROUND_SCALE * Math.pow(MAX_GROUND_SCALE / MIN_GROUND_SCALE, t);
    },
    // Geometric (it multiplies the haze reach); never zero.
    getGroundSolidity: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.groundSolidityStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_GROUND_SOLIDITY * Math.pow(MAX_GROUND_SOLIDITY / MIN_GROUND_SOLIDITY, t);
    },
    // Geometric.
    getGroundSoftness: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.groundSoftnessStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_GROUND_SOFTNESS * Math.pow(MAX_GROUND_SOFTNESS / MIN_GROUND_SOFTNESS, t);
    },
    // Linear; 0 turns the smoke off (plain fog).
    getFogSmokeAmplitude: (prefs: RoomPrefs): number =>
    {
        return NumUtil.normalizeInRange(prefs.fogSmokeAmplitudeStep, 0, MAX_ROOM_PREFS_STEP);
    },
    // Geometric; never zero.
    getFogSmokeScale: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.fogSmokeScaleStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_FOG_SMOKE_SCALE * Math.pow(MAX_FOG_SMOKE_SCALE / MIN_FOG_SMOKE_SCALE, t);
    },
    // World units per second (independent of scale), on the speed curve.
    getFogSmokeSpeed: (prefs: RoomPrefs): number =>
    {
        return MAX_FOG_SMOKE_SPEED * stepToSpeedFraction(prefs.fogSmokeSpeedStep);
    },
    // Unit direction from bearing and rise, so direction and speed stay independent.
    getFogSmokeDrift: (prefs: RoomPrefs): Vec3 =>
    {
        const bearing = NumUtil.normalizeInRange(prefs.fogSmokeDriftStep, 0, MAX_ROOM_PREFS_STEP) *
            2 * Math.PI;
        // Centred: the middle step is level travel.
        const rise = NumUtil.convertRange(prefs.fogSmokeRiseStep, 0, MAX_ROOM_PREFS_STEP, -1, 1,
            true);
        const acrossTheGround = Math.sqrt(Math.max(0, 1 - rise * rise));
        return {
            x: Math.cos(bearing) * acrossTheGround,
            y: rise,
            z: Math.sin(bearing) * acrossTheGround,
        };
    },
}

function stepToFogDistance(step: number): number
{
    return NumUtil.convertRange(step, 0, MAX_ROOM_PREFS_STEP, 0, MAX_FOG_DISTANCE, true);
}

// Speed step to fraction of max: geometric over most of the range but offset so step 0 is zero, which
// keeps the slow end finely divided.
function stepToSpeedFraction(step: number): number
{
    const t = NumUtil.normalizeInRange(step, 0, MAX_ROOM_PREFS_STEP);
    return Math.expm1(SPEED_CURVATURE * t) / Math.expm1(SPEED_CURVATURE);
}

// Clamped to the palette's length, not the encoding's range.
function readPaletteIndex(prefs: string, charIndex: number, paletteName: string,
    fallbackIndex: number): number
{
    const raw = StringUtil.convertVisibleASCIIToRawNumber(prefs, charIndex, fallbackIndex);
    return NumUtil.clampInRange(raw, 0, ColorUtil.getPaletteSize(paletteName) - 1);
}

function writePaletteIndex(index: number, paletteName: string): string
{
    return StringUtil.convertRawNumberToVisibleASCII(
        clampToWholeStep(index, ColorUtil.getPaletteSize(paletteName) - 1));
}

function readStep(prefs: string, charIndex: number, fallbackStep: number): number
{
    return StringUtil.convertVisibleASCIIToRawNumber(prefs, charIndex, fallbackStep);
}

function writeStep(step: number): string
{
    return StringUtil.convertRawNumberToVisibleASCII(clampToWholeStep(step, MAX_ROOM_PREFS_STEP));
}

// NaN becomes 0 (clamping alone would keep NaN, which can't be encoded).
function clampToWholeStep(n: number, max: number): number
{
    if (!Number.isFinite(n))
        return 0;
    return Math.round(NumUtil.clampInRange(n, 0, max));
}

export default RoomPrefsUtil;
