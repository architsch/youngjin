import RoomPrefs from "../types/roomPrefs";
import StringUtil from "../../math/util/stringUtil";
import NumUtil from "../../math/util/numUtil";
import ColorUtil from "../../math/util/colorUtil";
import { FOG_COLOR_PALETTE_NAME, LIGHT_COLOR_PALETTE_NAME } from "../../system/sharedConstants";

// The largest value one stored character can carry. Everything quantized here is a step in
// [0, this], which is the base-94 range StringUtil encodes in (see its own notes).
export const MAX_ROOM_PREFS_STEP = 93;

// How far the fog's two distances may be pushed out, in world units. Deliberately past the camera's
// own far plane: the top of the range has to mean "no fog at all", and it can only mean that if
// nothing the camera can still draw is inside it.
export const MAX_FOG_DISTANCE = 48;

// The strongest the ambient light may be made. Well above the default, so a room can be a bright
// gallery rather than only a dark one — but nowhere near the strength of a lamp, because ambient
// light reaches every surface from every direction at once: pushed far enough it does not light a
// room, it erases the shading that makes the room's shapes readable at all.
export const MAX_AMBIENT_INTENSITY = 0.45;

// The least distance the fog is ever allowed to take to close in. Fog whose two distances meet is
// not thin fog but undefined fog — the shader divides by the span between them — so the span is
// held open here rather than being left to whoever set the two steps.
const MIN_FOG_SPAN = 4;

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
const DEFAULT_HEAD_LIGHT_POWER_STEP = MAX_ROOM_PREFS_STEP;
const DEFAULT_FOG_COLOR_INDEX = 0; // black, the first entry in the "Fog" palette
const DEFAULT_FOG_NEAR_STEP = MAX_ROOM_PREFS_STEP;
const DEFAULT_FOG_FAR_STEP = MAX_ROOM_PREFS_STEP;

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
        return {
            ambientColorIndex: readPaletteIndex(prefs, AMBIENT_COLOR_CHAR_INDEX,
                LIGHT_COLOR_PALETTE_NAME, DEFAULT_AMBIENT_COLOR_INDEX),
            ambientIntensityStep: readStep(prefs, AMBIENT_INTENSITY_CHAR_INDEX,
                DEFAULT_AMBIENT_INTENSITY_STEP),
            headLightColorIndex: readPaletteIndex(prefs, HEAD_LIGHT_COLOR_CHAR_INDEX,
                LIGHT_COLOR_PALETTE_NAME, DEFAULT_HEAD_LIGHT_COLOR_INDEX),
            headLightPowerStep: readStep(prefs, HEAD_LIGHT_POWER_CHAR_INDEX,
                DEFAULT_HEAD_LIGHT_POWER_STEP),
            fogColorIndex: readPaletteIndex(prefs, FOG_COLOR_CHAR_INDEX,
                FOG_COLOR_PALETTE_NAME, DEFAULT_FOG_COLOR_INDEX),
            fogNearStep: readStep(prefs, FOG_NEAR_CHAR_INDEX, DEFAULT_FOG_NEAR_STEP),
            fogFarStep: readStep(prefs, FOG_FAR_CHAR_INDEX, DEFAULT_FOG_FAR_STEP),
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
        chars[FOG_COLOR_CHAR_INDEX] = writePaletteIndex(prefs.fogColorIndex, FOG_COLOR_PALETTE_NAME);
        chars[FOG_NEAR_CHAR_INDEX] = writeStep(prefs.fogNearStep);
        chars[FOG_FAR_CHAR_INDEX] = writeStep(prefs.fogFarStep);
        chars[AMBIENT_INTENSITY_CHAR_INDEX] = writeStep(prefs.ambientIntensityStep);
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
    getAmbientIntensity: (prefs: RoomPrefs): number =>
    {
        return NumUtil.convertRange(prefs.ambientIntensityStep, 0, MAX_ROOM_PREFS_STEP,
            0, MAX_AMBIENT_INTENSITY, true);
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
}

function stepToFogDistance(step: number): number
{
    return NumUtil.convertRange(step, 0, MAX_ROOM_PREFS_STEP, 0, MAX_FOG_DISTANCE, true);
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
