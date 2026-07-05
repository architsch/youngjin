import NumUtil from "./numUtil";
import Vec3 from "../types/vec3";

//------------------------------------------------------------------------
// 94-color palette, mirroring the base-94 "Visible ASCII" encoding scheme
// (see StringUtil) so that any color choice can be stored as a single printable character.
// Composition: 10 grayscale levels + 12 hues x 7 saturation/lightness variants = 94 colors.
//------------------------------------------------------------------------

const NUM_GRAYSCALE_LEVELS = 10;
const NUM_HUES = 12;
const SATURATION_LIGHTNESS_VARIANTS: [number, number][] = [
    [1.0, 0.2], // dark & vivid
    [1.0, 0.35],
    [1.0, 0.5], // pure hue
    [1.0, 0.65],
    [1.0, 0.8], // light & vivid (pastel)
    [0.45, 0.35], // dark & muted
    [0.45, 0.65], // light & muted
];

const palette: Vec3[] = [];
for (let i = 0; i < NUM_GRAYSCALE_LEVELS; ++i)
{
    const value = Math.round(255 * i / (NUM_GRAYSCALE_LEVELS - 1));
    palette.push({x: value, y: value, z: value});
}
for (let hueIndex = 0; hueIndex < NUM_HUES; ++hueIndex)
{
    for (const [saturation, lightness] of SATURATION_LIGHTNESS_VARIANTS)
        palette.push(hslToRGB(hueIndex / NUM_HUES, saturation, lightness));
}

// h, s, l = Hue, saturation, and lightness, each as a normalized number in range [0,1]
// Returns RGB values in range [0,255]
function hslToRGB(h: number, s: number, l: number): Vec3
{
    const q = (l < 0.5) ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
        x: Math.round(255 * hueToChannel(p, q, h + 1/3)),
        y: Math.round(255 * hueToChannel(p, q, h)),
        z: Math.round(255 * hueToChannel(p, q, h - 1/3)),
    };
}

function hueToChannel(p: number, q: number, t: number): number
{
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
}

const ColorUtil =
{
    // hex = Color expressed in a hexadecimal form (e.g. "#ffffff")
    // Returns RGB values in range [0,255]
    hexToRGB: (hex: string): Vec3 =>
    {
        const sanitizedHex = hex.replace(/^#/, "");
        const fullHex = (sanitizedHex.length == 3)
            ? sanitizedHex.split("").map(char => char + char).join("")
            : sanitizedHex;
        if (fullHex.length !== 6)
        {
            console.error(`ColorUtil::hexToRGB :: Invalid hex length (${fullHex.length})`);
            return {x: 1, y: 0, z: 1};
        }
        const num = parseInt(fullHex, 16);
        return {x: (num >> 16) & 255, y: (num >> 8) & 255, z: num & 255};
    },
    // rgb = RGB values in range [0,255]
    // Returns color expressed in a hexadecimal form (e.g. "#ffffff")
    rgbToHex: (rgb: Vec3): string =>
    {
        return "#" + [rgb.x, rgb.y, rgb.z].map(x => x.toString(16).padStart(2, "0")).join("");
    },
    // index = index in a color palette which consists of 94 color choices.
    // Returns RGB values in range [0,255]
    base94IndexToRGB: (index: number): Vec3 =>
    {
        const color = palette[NumUtil.clampInRange(Math.round(index), 0, palette.length - 1, true)];
        return {x: color.x, y: color.y, z: color.z}; // Copied, so that the caller cannot mutate the palette.
    },
    // rgb = RGB values in range [0,255]
    // Returns an index in a color palette which consists of 94 color choices.
    rgbToBase94Index: (rgb: Vec3): number =>
    {
        // Nearest palette entry, measured by squared distance in RGB space.
        let nearestIndex = 0;
        let nearestDistSqr = Infinity;
        for (let i = 0; i < palette.length; ++i)
        {
            const dx = rgb.x - palette[i].x;
            const dy = rgb.y - palette[i].y;
            const dz = rgb.z - palette[i].z;
            const distSqr = dx*dx + dy*dy + dz*dz;
            if (distSqr < nearestDistSqr)
            {
                nearestIndex = i;
                nearestDistSqr = distSqr;
            }
        }
        return nearestIndex;
    },
}

export default ColorUtil;
