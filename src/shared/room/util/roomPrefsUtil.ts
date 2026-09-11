import RoomPrefs from "../types/roomPrefs";
import StringUtil from "../../math/util/stringUtil";
import NumUtil from "../../math/util/numUtil";
import ColorUtil from "../../math/util/colorUtil";
import Vec3 from "../../math/types/vec3";
import { FOG_COLOR_PALETTE_NAME, LIGHT_COLOR_PALETTE_NAME,
    SCENERY_COLOR_PALETTE_NAME } from "../../system/sharedConstants";

// The largest value one stored character can carry. Everything quantized here is a step in
// [0, this], which is the base-94 range StringUtil encodes in (see its own notes).
export const MAX_ROOM_PREFS_STEP = 93;

// How far the fog's two distances may be pushed out, in world units. Deliberately past the camera's
// own far plane: the top of the range has to mean "no fog at all", and it can only mean that if
// nothing the camera can still draw is inside it.
export const MAX_FOG_DISTANCE = 48;

// The strongest the ambient light may be made — far past what lights a room, and deliberately so.
//
// Ambient light reaches every surface from every direction at once, so pushing it does not light a
// room: it erases the shading that makes the room's shapes readable, and past a point it takes each
// surface to white in turn until the room is a white-out. **That is the effect this end of the range
// is for**, and it is a real thing to want; what it is not is a brighter version of an ordinary room,
// and a room looking for one should be reaching for its lamps.
//
// The number itself is not chosen, it is derived: it is what the curve below has to reach at the top
// of the range for the default step to keep landing on the ambient every room has always had.
export const MAX_AMBIENT_INTENSITY = 4.05;

// The least distance the fog is ever allowed to take to close in. Fog whose two distances meet is
// not thin fog but undefined fog — the shader divides by the span between them — so the span is
// held open here rather than being left to whoever set the two steps.
//
// Deliberately far below anything a room would be built around: this is a guard against a division,
// not a judgement about how thick fog may be. Held at a comfortable distance instead, it becomes the
// latter by accident — the near distance can already be set to nothing, so the span is the *only*
// thing standing between a room and air thick enough to lose a wall in, which is a real thing to
// want and was not the guard's to refuse.
const MIN_FOG_SPAN = 0.25;

// How fine the clouds may be set, as the number of cloud masses spanning the sky. At the bottom, a
// couple of great banks filling most of it; at the top, a fine mottled fleece.
export const MIN_CLOUD_SCALE = 0.6;
export const MAX_CLOUD_SCALE = 24;

// How the clouds' and the smoke's speeds are spread along their steps (see stepToSpeedFraction): the
// larger this is, the more of each dial is given to its slow end and the further past it the top
// reaches. Both tops are derived from it rather than chosen, which is why they stand further down,
// after the defaults they are derived from (see MAX_CLOUD_SPEED).
const SPEED_CURVATURE = 8;

// How wide the boundary between cloud and clear air may be made, as a distance either side of the
// point the field is cut at. The bottom is a cut edge — the field crosses it within a pixel, and only
// the per-pixel fade below keeps it from crawling. The top is wide enough to swallow the field
// whole, which is the even haze it is before any of this is done to it: not a cloud with a very soft
// edge but no cloud at all, which is the far end this dial should reach.
export const MIN_CLOUD_SOFTNESS = 0.01;
export const MAX_CLOUD_SOFTNESS = 0.5;

// How coarse the land below the horizon may be set, as the number of hills spanning the drop from
// the eye to the ground plane. At the bottom, a couple of continents filling the whole view from the
// room's edge to the horizon; at the top, a crumpled country of small hills. Narrower than the
// clouds' range at both ends, because ground is seen edge-on from a fixed distance rather than
// overhead: land coarse enough to be one flank fills the view with a gradient, and land fine enough
// to be fleece is a texture the haze has flattened before any of it can be made out.
export const MIN_GROUND_SCALE = 0.25;
export const MAX_GROUND_SCALE = 8;

// How fine the smoke in the room's air may be set, in cycles per world unit — the reciprocal of how
// wide one body of it is. At the bottom a single swell far wider than the room, so the air is simply
// thicker at one end of it than the other; at the top, wisps a pace or two across. Measured in the
// room's own units rather than as a count, unlike the clouds, because this field stands in the room
// and a room is a known size.
export const MIN_FOG_SMOKE_SCALE = 0.015;
export const MAX_FOG_SMOKE_SCALE = 0.6;

// How far the land holds its own color against the air in front of it, as a multiple of the reach
// the haze would otherwise allow. At the bottom the country is a suggestion behind the air; at the
// top it keeps its color almost to the horizon.
//
// It divides the haze rather than lifting the land's coverage off zero, and that distinction is the
// whole of why the horizon survives it. Land that stayed even slightly opaque at the horizon would
// meet the sky in a color the sky is not, and draw the seam this whole arrangement exists to avoid.
// Dividing the rate leaves the land still fading to nothing exactly at the horizon — it simply takes
// longer to get there.
export const MIN_GROUND_SOLIDITY = 0.35;
export const MAX_GROUND_SOLIDITY = 6;

// How wide the slope from the low color to the high one runs, either side of the level the land is
// split at. The bottom is a coastline or a snowline — a drawn edge; the top is a country whose two
// colors never quite separate.
export const MIN_GROUND_SOFTNESS = 0.006;
export const MAX_GROUND_SOFTNESS = 0.30;

// Which step each field falls back to when the room does not carry it. **These are what "a room
// nobody has configured" means**, and they are chosen so that such a room looks exactly as rooms
// looked before they could be configured at all: white ambient, the head lamp at the full strength
// it has always had, and the fog pushed past everything the camera draws.
//
// This is also why a room needs no backfilling. StringUtil hands back the fallback for any
// character past the end of the string, so the empty string every existing room holds decodes
// straight to this — and so does a string from a future version that happens to be shorter.
const DEFAULT_AMBIENT_COLOR_INDEX = 0; // white, the first entry in the "Light" palette
// A third of the way up, which is exactly the strength the ambient light has always had.
const DEFAULT_AMBIENT_INTENSITY_STEP = 31;
const DEFAULT_HEAD_LIGHT_COLOR_INDEX = 0; // white, likewise
// Two thirds of the way up rather than at the top, which is where it used to be. The lamp it names
// is the same lamp it has always named — what changed is that there is now range above it, and a
// default sitting at the top is the same thing as saying there is none (see HeadLightUtil).
const DEFAULT_HEAD_LIGHT_POWER_STEP = 62;
// Likewise two thirds up, and for the same reason: it is the reach and falloff the head lamp has
// always had, with room left above for a lamp that carries further and falls off more gently.
const DEFAULT_HEAD_LIGHT_RANGE_STEP = 62;
const DEFAULT_FOG_COLOR_INDEX = 0; // black, the first entry in the "Fog" palette
const DEFAULT_FOG_NEAR_STEP = MAX_ROOM_PREFS_STEP;
const DEFAULT_FOG_FAR_STEP = MAX_ROOM_PREFS_STEP;

// (The sky has no default of its own: a room that does not carry one takes its air's color — see
// decode — which for a room that has said nothing is the same black.)

// No weather, said with the strength rather than with the color.
//
// It used to be said by picking the air's own palette entry twice, which stopped being expressible
// when the clouds moved to a set of their own — an entry in one palette is not an entry in another.
// That is no loss: a strength of nothing is the plainer way to say it, it is the way somebody looking
// at the sliders would expect to say it, and it leaves the color free to be a real cloud color
// waiting behind it. White, so that turning the strength up gives a cloud rather than a stain.
const DEFAULT_CLOUD_COLOR_INDEX = 10; // white, the last of the "Scenery" neutrals
const DEFAULT_CLOUD_OPACITY_STEP = 0;
// Fine enough that several masses stand within one view, which is what it takes to read them as
// clouds at all: a sky set so coarse that the camera is inside a single mass shows a gradient, and a
// gradient is what this whole field exists not to be.
const DEFAULT_CLOUD_SCALE_STEP = 55;
const DEFAULT_CLOUD_SOFTNESS_STEP = 55;
const DEFAULT_CLOUD_SPEED_STEP = 34;
// Land, unlike weather, is on by default — quietly. Two near-blacks, a couple of steps up from the
// bottom of the same palette and a couple of steps apart from each other.
//
// It is the one setting here whose default is not "as things were", and the reason is that its
// absence is not neutral. A sky with no clouds is a clear sky; a sky with no ground is a room hanging
// in a void, which is a stronger statement than any weather and not one an unconfigured room should
// be making. Near-black also happens to be the one choice that reads correctly against *every* air a
// room might pick, since ground darker than the sky above it is what a horizon is.
//
// A room that does want the void picks the air's own color for both, exactly as a room wanting no
// weather does.
const DEFAULT_GROUND_COLOR_INDEX = 1; // "#1a1a1a", the first neutral above black
const DEFAULT_GROUND_PEAK_COLOR_INDEX = 3; // "#4d4d4d"
const DEFAULT_GROUND_SCALE_STEP = 42;
// Solid enough to be a country rather than a suggestion of one, which is what the haze alone leaves.
// Not the top of the range: at the top the land keeps its color almost to the horizon, which is a
// clear day rather than the ordinary one.
const DEFAULT_GROUND_SOLIDITY_STEP = 62;
// A hillside rather than a coastline — the two colors meeting over a slope wide enough to read as
// ground rising, which is the reading that suits a pair of quiet neutrals.
const DEFAULT_GROUND_SOFTNESS_STEP = 57;
// Air that is noticeably uneven but not dramatic, moving slowly, drifting off a bearing that is not
// one of the world's own axes, and rising gently as smoke does.
//
// On by default rather than off, and it costs nothing to have it so: an unconfigured room's fog is
// pushed past everything the camera draws, so there is no haze for this to be uneven *in*. What it
// means is that the first room to pull its fog in finds air that already moves, instead of a flat
// wash and five more sliders to go and find — which is the same reason the clouds' shape and movement
// default to the values the sky was tuned at while their color defaults to silence.
const DEFAULT_FOG_SMOKE_AMPLITUDE_STEP = 33;
const DEFAULT_FOG_SMOKE_SCALE_STEP = 56;
const DEFAULT_FOG_SMOKE_SPEED_STEP = 26;
const DEFAULT_FOG_SMOKE_DRIFT_STEP = 12;
const DEFAULT_FOG_SMOKE_RISE_STEP = 58;

// How fast the clouds and the smoke move at the steps a room is generated with.
//
// **These are the one point on either speed's curve that may never move.** Generation writes a
// room's settings out in full (see getDefaultPrefsString), so every room generated so far holds these
// steps explicitly, and whatever speed they name is the speed all of those rooms move at. They are
// the speeds the sky and the smoke were tuned at: each default step squared, over the ranges the two
// speeds ran across before their tops were opened up.
const TUNED_CLOUD_SPEED = 0.06 * Math.pow(DEFAULT_CLOUD_SPEED_STEP / MAX_ROOM_PREFS_STEP, 2);
const TUNED_FOG_SMOKE_SPEED = 1.5 * Math.pow(DEFAULT_FOG_SMOKE_SPEED_STEP / MAX_ROOM_PREFS_STEP, 2);

// How fast the clouds may cross the sky, as an angular rate, and how fast the smoke may travel
// through the room, in world units a second. Both tops are far past anything restful — a sky racing
// overhead, and smoke tearing through the room faster than the eye can follow any one wisp of it —
// which is what a room asking for a storm rather than an atmosphere reaches for.
//
// **Neither number is chosen; both are derived**, as the ambient's ceiling is: each is what its curve
// has to reach at the top of the range for the default step to keep landing on the tuned speed above.
// How far above the tuned speeds that puts them is decided by the curve's shape (see
// SPEED_CURVATURE).
export const MAX_CLOUD_SPEED = TUNED_CLOUD_SPEED / stepToSpeedFraction(DEFAULT_CLOUD_SPEED_STEP);
export const MAX_FOG_SMOKE_SPEED =
    TUNED_FOG_SMOKE_SPEED / stepToSpeedFraction(DEFAULT_FOG_SMOKE_SPEED_STEP);

// Where each field sits in the stored string. Positions are fixed and are never reordered: a
// character's position is its entire meaning, so moving one re-lights every room already stored.
// A field appended after these keeps the same guarantee, since anything past the end of a shorter
// string reads back as that field's default.
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

// The room's atmosphere, to and from the handful of characters the room is stored with.
//
// Everything a caller is allowed to believe about a RoomPrefs is established here: every index is
// inside its palette, every step is inside its range, and the fog's two distances are far enough
// apart to mean something. That holds for a string typed by hand, a string from an older version of
// the game, and a string somebody made up — decoding is total, and the server keeps nothing it did
// not decode (see the room API), so an invalid value is not something the rest of the game has to
// carry a check for.
const RoomPrefsUtil =
{
    decode: (prefs: string): RoomPrefs =>
    {
        // Read first, because it is what the sky falls back to when the room has not said. A room
        // stored before its sky could be chosen had that sky painted in its own air, so reading it
        // back that way is what leaves it looking exactly as it was stored — and it is the plainest
        // answer for a room that has said nothing at all, whose air and sky are then one black void.
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
        return chars.join("");
    },
    // What a room comes out of generation with. Written out rather than left empty, because a
    // parameter no generator sets is one no room has ever actually chosen — see
    // @.claude/rules/room-generation.md .
    getDefaultPrefsString: (): string =>
    {
        return RoomPrefsUtil.encode(RoomPrefsUtil.decode(""));
    },
    // How strong the light filling the room is. Nothing is held back at the bottom of the range:
    // an ambient of nothing is a room lit only by what is actually in it, which is the whole point
    // of a room somebody has lit for themselves.
    //
    // Cubed rather than run straight, because the range now covers two quite different things. The
    // ordinary business of lighting a room happens in the first sliver of it — the difference between
    // a room lit for atmosphere and one lit for reading is a few hundredths — while the top of it is
    // an overexposure that runs to a white-out. A straight ramp would spend nine steps in ten on the
    // second and leave the first with almost no travel at all. Cubing gives the ordinary range about
    // half the slider and the effect the other half, and it still reaches zero, which a geometric
    // ramp could not.
    //
    // **The cube is also what lets the ceiling rise without re-lighting every room already stored.**
    // The default step sits a third of the way up, and a third cubed is a twenty-seventh — so the
    // ambient an unconfigured room arrives at is exactly the one it has always had, and the ceiling
    // above it is free to be anything.
    getAmbientIntensity: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.ambientIntensityStep, 0, MAX_ROOM_PREFS_STEP);
        return MAX_AMBIENT_INTENSITY * t * t * t;
    },
    // Where things begin to fade into the air, and where they have faded into it completely.
    //
    // The two are stored as independent steps, so that each slider means one plain thing, and the
    // span between them is held open here instead — at the one place both are known, and after the
    // steps have been round-tripped, so that a room is never quietly re-stored with a step it was
    // not given.
    getFogNearDistance: (prefs: RoomPrefs): number =>
    {
        return stepToFogDistance(prefs.fogNearStep);
    },
    getFogFarDistance: (prefs: RoomPrefs): number =>
    {
        return Math.max(stepToFogDistance(prefs.fogFarStep),
            stepToFogDistance(prefs.fogNearStep) + MIN_FOG_SPAN);
    },
    // How far toward its own color a cloud actually gets. Linear, and running to nothing at the
    // bottom: a cloud that reaches none of the way to its color is no cloud, which is the same thing
    // picking the air's own color says and is worth being able to say either way.
    getCloudOpacity: (prefs: RoomPrefs): number =>
    {
        return NumUtil.normalizeInRange(prefs.cloudOpacityStep, 0, MAX_ROOM_PREFS_STEP);
    },
    // How wide the boundary between cloud and clear air runs, either side of where the field is cut.
    // Geometric, because this is judged in ratios like the scale is and for the same reason: the edge
    // that reads as cut and the edge that reads as merely soft are a couple of hundredths apart,
    // while the difference between wide and wider is barely a difference at all.
    getCloudSoftness: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.cloudSoftnessStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_CLOUD_SOFTNESS * Math.pow(MAX_CLOUD_SOFTNESS / MIN_CLOUD_SOFTNESS, t);
    },
    // How fine the clouds are. Geometric, for the reason a lamp's brightness is (see LampLightUtil):
    // this is judged in ratios, and a linear slider would spend most of its travel between degrees
    // of fleece nobody can tell apart while cramming every broad, banked sky into its first steps.
    // It never reaches zero, and should not — a field of no frequency at all is a flat sky, which is
    // what picking the cloud color the air already is says, and says better.
    getCloudScale: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.cloudScaleStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_CLOUD_SCALE * Math.pow(MAX_CLOUD_SCALE / MIN_CLOUD_SCALE, t);
    },
    // How fast the clouds cross the sky, as an angular rate — deliberately not a rate through the
    // noise field, so that setting the clouds finer does not also appear to slow them down. That is
    // the whole of what makes this dial and the one above independent rather than two ways of asking
    // the same question.
    //
    // The curve above does not suit it, and neither would a plain square: the range runs from still
    // air to a racing sky, and a curve over that has to arrive at nothing at one end while being
    // judged in ratios at the other (see stepToSpeedFraction).
    getCloudSpeed: (prefs: RoomPrefs): number =>
    {
        return MAX_CLOUD_SPEED * stepToSpeedFraction(prefs.cloudSpeedStep);
    },
    // How coarse the land below the horizon is. Geometric, for the reason the clouds' scale is, and
    // it never reaches zero for that reason too: land of no frequency at all is a flat plain, which
    // is what picking one color for both the low ground and the high says, and says better.
    getGroundScale: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.groundScaleStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_GROUND_SCALE * Math.pow(MAX_GROUND_SCALE / MIN_GROUND_SCALE, t);
    },
    // How far the land holds its own color against the air in front of it. Geometric, because it is
    // judged in ratios — it multiplies the reach the haze allows — and it never reaches zero, since
    // land of no solidity at all is land the air has swallowed, which is what picking the two ground
    // colors to match says and says better.
    getGroundSolidity: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.groundSolidityStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_GROUND_SOLIDITY * Math.pow(MAX_GROUND_SOLIDITY / MIN_GROUND_SOLIDITY, t);
    },
    // How wide the slope from the low color to the high one runs. Geometric, for the reason the
    // clouds' own softness is: the width that reads as a drawn line and the width that reads as a
    // hillside are a few thousandths apart, while the difference between broad and broader is barely
    // a difference at all.
    getGroundSoftness: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.groundSoftnessStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_GROUND_SOFTNESS * Math.pow(MAX_GROUND_SOFTNESS / MIN_GROUND_SOFTNESS, t);
    },
    // How far the room's air thins where the smoke lies thickest, as a fraction of the fog it would
    // otherwise have there. Linear, and running to nothing at the bottom: evenly thick air is a real
    // request and is what a room asking for plain fog means, so the bottom of this dial is the one
    // place the smoke can be turned off outright.
    getFogSmokeAmplitude: (prefs: RoomPrefs): number =>
    {
        return NumUtil.normalizeInRange(prefs.fogSmokeAmplitudeStep, 0, MAX_ROOM_PREFS_STEP);
    },
    // How fine the smoke runs. Geometric, for the reason every other scale here is: it is judged in
    // ratios, and it never reaches zero because a field of no frequency is evenly thick air, which is
    // what the dial above says and says better.
    getFogSmokeScale: (prefs: RoomPrefs): number =>
    {
        const t = NumUtil.normalizeInRange(prefs.fogSmokeScaleStep, 0, MAX_ROOM_PREFS_STEP);
        return MIN_FOG_SMOKE_SCALE * Math.pow(MAX_FOG_SMOKE_SCALE / MIN_FOG_SMOKE_SCALE, t);
    },
    // How fast the smoke travels through the room, in world units a second — a rate through the room
    // rather than through the field, so that setting the smoke finer does not also appear to speed it
    // up. On the clouds' curve, for the reason theirs is on it: it has to reach zero, since air that
    // hangs still is a real request, and above that it runs to a gale (see stepToSpeedFraction).
    getFogSmokeSpeed: (prefs: RoomPrefs): number =>
    {
        return MAX_FOG_SMOKE_SPEED * stepToSpeedFraction(prefs.fogSmokeSpeedStep);
    },
    // Which way the smoke travels, as a unit vector in the world's own axes.
    //
    // Assembled here rather than left as two angles for the renderer to combine, because the two
    // steps are only meaningful together: a bearing on its own says nothing until it is known how
    // much of the movement is horizontal at all. Built as a unit vector so that the direction and the
    // speed stay independent — a steeply rising smoke travels neither faster nor slower than a level
    // one, which is what lets each dial mean one thing.
    getFogSmokeDrift: (prefs: RoomPrefs): Vec3 =>
    {
        const bearing = NumUtil.normalizeInRange(prefs.fogSmokeDriftStep, 0, MAX_ROOM_PREFS_STEP) *
            2 * Math.PI;
        // The rise runs from pouring downward through level to climbing, so its middle step is air
        // that travels flat — which is why this one is centred rather than starting at nothing.
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

// Where a speed step falls between still air and the top of its range, as a fraction of the way.
//
// Geometric over most of its travel, because once a range runs from a drift nobody can see to a gale,
// fast and faster are told apart by ratio, just as a scale is. But pulled down by its own starting
// value so that it arrives at nothing at the bottom, which a geometric ramp alone never can — and
// still air is a real request. That leaves the curve running almost straight near the bottom, which
// keeps the slow end — where the difference between imperceptible and gentle lives — finely divided.
function stepToSpeedFraction(step: number): number
{
    const t = NumUtil.normalizeInRange(step, 0, MAX_ROOM_PREFS_STEP);
    return Math.expm1(SPEED_CURVATURE * t) / Math.expm1(SPEED_CURVATURE);
}

// A palette position is clamped to the palette it is a position in, rather than to the encoding's
// own range: the palettes are shorter than 94 entries, and a room that named an entry past the end
// of one would be asking for a color that does not exist.
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

// Clamping alone is not enough to make a number safe to encode: a clamp leaves NaN as NaN, and the
// character that comes of that is not one this encoding can read back. Anything that is not a number
// at all is treated as the bottom of the range, which is the one value every field is defined at.
function clampToWholeStep(n: number, max: number): number
{
    if (!Number.isFinite(n))
        return 0;
    return Math.round(NumUtil.clampInRange(n, 0, max));
}

export default RoomPrefsUtil;
