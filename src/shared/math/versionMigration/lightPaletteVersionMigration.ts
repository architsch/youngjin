import Vec2 from "../types/vec2";
import Vec3 from "../types/vec3";
import ColorUtil from "../util/colorUtil";
import NumUtil from "../util/numUtil";
import StringUtil from "../util/stringUtil";
import Vector2DUtil from "../util/vector2DUtil";
import { LIGHT_COLOR_PALETTE_NAME } from "../../system/sharedConstants";

// The "Light" palette while its hues came at six tint strengths: white and the temperatures as they are
// now, then the faint, pale, soft, colored, strong and pure bands.
const LEGACY_LIGHT_COLORS: string[] = [
    "#ffffff",
    "#ff8220", "#ff8b2d", "#ff943a", "#ff9d46", "#ffa653", "#ffaf60",
    "#ffb46b", "#ffc78f", "#ffd5aa", "#ffe0c0", "#ffe9d3", "#fff2e5",
    "#fffaf5", "#f7f8ff", "#eaefff", "#dbe5ff", "#c8d8ff", "#b3caff",
    "#ffe6e6", "#fff2e6", "#ffffe6", "#f2ffe6", "#e6ffe6", "#e6fff2",
    "#e6ffff", "#e6f2ff", "#e6e6ff", "#f2e6ff", "#ffe6ff", "#ffe6f2",
    "#ffc2c2", "#ffe0c2", "#ffffc2", "#e0ffc2", "#c2ffc2", "#c2ffe0",
    "#c2ffff", "#c2e0ff", "#c2c2ff", "#e0c2ff", "#ffc2ff", "#ffc2e0",
    "#ff9999", "#ffcc99", "#ffff99", "#ccff99", "#99ff99", "#99ffcc",
    "#99ffff", "#99ccff", "#9999ff", "#cc99ff", "#ff99ff", "#ff99cc",
    "#ff6b6b", "#ffb56b", "#ffff6b", "#b5ff6b", "#6bff6b", "#6bffb5",
    "#6bffff", "#6bb5ff", "#6b6bff", "#b56bff", "#ff6bff", "#ff6bb5",
    "#ff3838", "#ff9c38", "#ffff38", "#9cff38", "#38ff38", "#38ff9c",
    "#38ffff", "#389cff", "#3838ff", "#9c38ff", "#ff38ff", "#ff389c",
    "#ff0000", "#ff8000", "#ffff00", "#80ff00", "#00ff00", "#00ff80",
    "#00ffff", "#0080ff", "#0000ff", "#8000ff", "#ff00ff", "#ff0080",
];

// How much more a change of hue counts than a like change of saturation: a yellow light turning orange
// reads as another color, one turning paler does not.
const HUE_WEIGHT = 3;

// Carries positions in the legacy "Light" palette over to the current one. Entries both share map to
// themselves; a dropped one goes to the nearest color left by hue and saturation alone (plain RGB
// distance would trade a hue away for its strength, turning a soft red orange).
const LightPaletteVersionMigration =
{
    convertColorIndex: (legacyIndex: number): number =>
    {
        const legacyColor = ColorUtil.hexToRGB(LEGACY_LIGHT_COLORS[
            NumUtil.clampInRange(legacyIndex, 0, LEGACY_LIGHT_COLORS.length - 1)]);
        const target = getChromaticity(legacyColor);
        let nearestIndex = 0;
        let nearestDistSqr = Infinity;
        for (let i = 0; i < ColorUtil.getPaletteSize(LIGHT_COLOR_PALETTE_NAME); ++i)
        {
            const distSqr = getChromaticDistSqr(target,
                getChromaticity(ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME, i)));
            if (distSqr < nearestDistSqr)
            {
                nearestIndex = i;
                nearestDistSqr = distSqr;
            }
        }
        return nearestIndex;
    },
    // The same, for a position stored as one character of a string (see StringUtil). A string too short
    // to hold it is returned as it is, since it reads back the default, white, in both palettes.
    convertColorChar: (str: string, charIndex: number): string =>
    {
        if (charIndex >= str.length)
            return str;
        const colorIndex = LightPaletteVersionMigration.convertColorIndex(
            StringUtil.convertVisibleASCIIToRawNumber(str, charIndex));
        return str.substring(0, charIndex) + StringUtil.convertRawNumberToVisibleASCII(colorIndex)
            + str.substring(charIndex + 1);
    },
}

// Where a color sits on the hue wheel, whatever its brightness: its offset from the grey axis, over its
// brightest channel.
function getChromaticity(rgb: Vec3): Vec2
{
    const max = Math.max(rgb.x, rgb.y, rgb.z, 1);
    return {x: (2 * rgb.x - rgb.y - rgb.z) / (2 * max), y: Math.sqrt(3) * (rgb.y - rgb.z) / (2 * max)};
}

// The squared distance between two chromaticities, split into its saturation part (the difference in
// distance from the grey axis) and the rest, which is hue, with the hue part weighted.
function getChromaticDistSqr(a: Vec2, b: Vec2): number
{
    const saturationDistSqr = (Vector2DUtil.length(a) - Vector2DUtil.length(b)) ** 2;
    return saturationDistSqr + HUE_WEIGHT * (Vector2DUtil.distSqr(a, b) - saturationDistSqr);
}

export default LightPaletteVersionMigration;
