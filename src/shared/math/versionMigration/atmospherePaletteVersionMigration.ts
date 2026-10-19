import Vec3 from "../types/vec3";
import ColorUtil from "../util/colorUtil";
import NumUtil from "../util/numUtil";
import { ATMOSPHERE_COLOR_PALETTE_NAME } from "../../system/sharedConstants";

// The palettes a room's atmosphere was painted from before the "Atmosphere" palette: its fog and sky from "Fog", its
// clouds and ground from "Scenery". Kept here as they were, whatever becomes of the live ones.
const LEGACY_FOG_COLORS: string[] = [
    "#000000",
    "#0d0d0d", "#1a1a1a", "#292929", "#3b3b3b", "#4f4f4f", "#666666",
    "#808080", "#9e9e9e", "#c2c2c2",
    "#160808", "#160f08", "#161608", "#0f1608", "#081608", "#08160f",
    "#081616", "#080f16", "#080816", "#0f0816", "#160816", "#16080f",
    "#321515", "#322415", "#323215", "#243215", "#153215", "#153224",
    "#153232", "#152432", "#151532", "#241532", "#321532", "#321524",
    "#502626", "#503b26", "#505026", "#3b5026", "#265026", "#26503b",
    "#265050", "#263b50", "#262650", "#3b2650", "#502650", "#50263b",
    "#6f3939", "#6f5439", "#6f6f39", "#546f39", "#396f39", "#396f54",
    "#396f6f", "#39546f", "#39396f", "#54396f", "#6f396f", "#6f3954",
    "#925454", "#927354", "#929254", "#739254", "#549254", "#549273",
    "#549292", "#547392", "#545492", "#735492", "#925492", "#925473",
    "#b38989", "#b39e89", "#b3b389", "#9eb389", "#89b389", "#89b39e",
    "#89b3b3", "#899eb3", "#8989b3", "#9e89b3", "#b389b3", "#b3899e",
];
const LEGACY_SCENERY_COLORS: string[] = [
    "#000000", "#1a1a1a", "#333333", "#4d4d4d", "#666666", "#808080",
    "#999999", "#b3b3b3", "#cccccc", "#e6e6e6", "#ffffff",
    "#5f1c1c", "#5f3d1c", "#5f5f1c", "#3d5f1c", "#1c5f1c", "#1c5f3d",
    "#1c5f5f", "#1c3d5f", "#1c1c5f", "#3d1c5f", "#5f1c5f", "#5f1c3d",
    "#a52727", "#a56627", "#a5a527", "#66a527", "#27a527", "#27a566",
    "#27a5a5", "#2766a5", "#2727a5", "#6627a5", "#a527a5", "#a52766",
    "#d84141", "#d88c41", "#d8d841", "#8cd841", "#41d841", "#41d88c",
    "#41d8d8", "#418cd8", "#4141d8", "#8c41d8", "#d841d8", "#d8418c",
    "#e08585", "#e0b285", "#e0e085", "#b3e085", "#85e085", "#85e0b3",
    "#85e0e0", "#85b2e0", "#8585e0", "#b285e0", "#e085e0", "#e085b3",
    "#eac3c3", "#ead6c3", "#eaeac3", "#d6eac3", "#c3eac3", "#c3ead6",
    "#c3eaea", "#c3d6ea", "#c3c3ea", "#d6c3ea", "#eac3ea", "#eac3d6",
];

// How many colors the "Atmosphere" palette held when these were carried over to it. Only those are chosen from, so
// a color appended to it later never changes where a room still to be converted ends up.
const ATMOSPHERE_COLORS_CARRIED_OVER_TO = 63;

// CIELAB's reference white (D65) and the knee of its curve.
const WHITE_X = 0.95047;
const WHITE_Z = 1.08883;
const LAB_KNEE = 6 / 29;

const POW_25_7 = Math.pow(25, 7);

// Carries positions in the legacy "Fog" and "Scenery" palettes over to the "Atmosphere" one, each color to the one
// that looks nearest it by CIEDE2000, the standard measure of how different two colors look (plain RGB distance
// would give a grey a hue, and lift a near-black cast to a lighter grey).
const AtmospherePaletteVersionMigration =
{
    convertFogColorIndex: (legacyIndex: number): number =>
    {
        return getNearestIndex(getDifferences(getLegacyColor(LEGACY_FOG_COLORS, legacyIndex)));
    },
    convertSceneryColorIndex: (legacyIndex: number): number =>
    {
        return getNearestIndex(getDifferences(getLegacyColor(LEGACY_SCENERY_COLORS, legacyIndex)));
    },
    // Two "Scenery" colors set apart stay apart, as a ground's low and its peaks, whose difference is all the relief
    // it shows: where both would land on one color, they go to the two different ones nearest them in total.
    convertSceneryColorPair: (legacyIndexA: number, legacyIndexB: number): [number, number] =>
    {
        const differencesA = getDifferences(getLegacyColor(LEGACY_SCENERY_COLORS, legacyIndexA));
        const differencesB = getDifferences(getLegacyColor(LEGACY_SCENERY_COLORS, legacyIndexB));
        const nearest: [number, number] = [getNearestIndex(differencesA), getNearestIndex(differencesB)];
        if (nearest[0] != nearest[1] || clampToLegacy(LEGACY_SCENERY_COLORS, legacyIndexA)
            == clampToLegacy(LEGACY_SCENERY_COLORS, legacyIndexB))
        {
            return nearest;
        }
        let best = nearest;
        let bestTotal = Infinity;
        for (let a = 0; a < differencesA.length; ++a)
        {
            for (let b = 0; b < differencesB.length; ++b)
            {
                if (a != b && differencesA[a] + differencesB[b] < bestTotal)
                {
                    best = [a, b];
                    bestTotal = differencesA[a] + differencesB[b];
                }
            }
        }
        return best;
    },
}

// Read as the legacy decode read it: a position past the palette is its last color.
function clampToLegacy(legacyColors: string[], legacyIndex: number): number
{
    return NumUtil.clampInRange(Math.round(legacyIndex), 0, legacyColors.length - 1);
}

function getLegacyColor(legacyColors: string[], legacyIndex: number): Vec3
{
    return ColorUtil.hexToRGB(legacyColors[clampToLegacy(legacyColors, legacyIndex)]);
}

// How different the color looks from each "Atmosphere" color it may be carried over to.
function getDifferences(rgb: Vec3): number[]
{
    const lab = toLab(rgb);
    const differences: number[] = [];
    for (let i = 0; i < ATMOSPHERE_COLORS_CARRIED_OVER_TO; ++i)
        differences.push(getColorDifference(lab, toLab(ColorUtil.paletteIndexToRGB(ATMOSPHERE_COLOR_PALETTE_NAME, i))));
    return differences;
}

// The first of the nearest, should two be as near.
function getNearestIndex(differences: number[]): number
{
    let nearestIndex = 0;
    for (let i = 1; i < differences.length; ++i)
    {
        if (differences[i] < differences[nearestIndex])
            nearestIndex = i;
    }
    return nearestIndex;
}

// CIELAB (L, a, b as x, y, z) of an sRGB color in [0,255].
function toLab(rgb: Vec3): Vec3
{
    const r = toLinear(rgb.x);
    const g = toLinear(rgb.y);
    const b = toLinear(rgb.z);
    const fx = labCurve((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE_X);
    const fy = labCurve(0.2126729 * r + 0.7151522 * g + 0.0721750 * b);
    const fz = labCurve((0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / WHITE_Z);
    return {x: 116 * fy - 16, y: 500 * (fx - fy), z: 200 * (fy - fz)};
}

function toLinear(channel: number): number
{
    const c = channel / 255;
    return (c <= 0.04045) ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function labCurve(t: number): number
{
    return (t > LAB_KNEE * LAB_KNEE * LAB_KNEE) ? Math.cbrt(t) : t / (3 * LAB_KNEE * LAB_KNEE) + 4 / 29;
}

// CIEDE2000 (Sharma, Wu & Dalal, 2005), with the reference weights: lightness, chroma and hue differences, each
// scaled by how much it shows where the two colors sit, plus a term that rotates blue hues.
function getColorDifference(lab1: Vec3, lab2: Vec3): number
{
    const chromaMean7 = Math.pow((Math.hypot(lab1.y, lab1.z) + Math.hypot(lab2.y, lab2.z)) / 2, 7);
    const g = 0.5 * (1 - Math.sqrt(chromaMean7 / (chromaMean7 + POW_25_7)));
    const a1 = (1 + g) * lab1.y;
    const a2 = (1 + g) * lab2.y;
    const c1 = Math.hypot(a1, lab1.z);
    const c2 = Math.hypot(a2, lab2.z);
    const h1 = getHueDegrees(a1, lab1.z);
    const h2 = getHueDegrees(a2, lab2.z);
    const chromatic = c1 * c2 != 0;

    let hueStep = 0;
    if (chromatic)
    {
        hueStep = h2 - h1;
        if (hueStep > 180)
            hueStep -= 360;
        else if (hueStep < -180)
            hueStep += 360;
    }
    const lightnessDifference = lab2.x - lab1.x;
    const chromaDifference = c2 - c1;
    const hueDifference = 2 * Math.sqrt(c1 * c2) * Math.sin(toRadians(hueStep) / 2);

    const lightnessMean = (lab1.x + lab2.x) / 2;
    const chromaMean = (c1 + c2) / 2;
    let hueMean = h1 + h2;
    if (chromatic)
    {
        if (Math.abs(h1 - h2) <= 180)
            hueMean = (h1 + h2) / 2;
        else
            hueMean = (h1 + h2 + ((h1 + h2 < 360) ? 360 : -360)) / 2;
    }
    const t = 1 - 0.17 * Math.cos(toRadians(hueMean - 30)) + 0.24 * Math.cos(toRadians(2 * hueMean))
        + 0.32 * Math.cos(toRadians(3 * hueMean + 6)) - 0.20 * Math.cos(toRadians(4 * hueMean - 63));
    const lightnessOffset = (lightnessMean - 50) * (lightnessMean - 50);
    const lightnessScale = 1 + 0.015 * lightnessOffset / Math.sqrt(20 + lightnessOffset);
    const chromaScale = 1 + 0.045 * chromaMean;
    const hueScale = 1 + 0.015 * chromaMean * t;
    const chromaMean7Prime = Math.pow(chromaMean, 7);
    const rotation = -Math.sin(toRadians(60 * Math.exp(-Math.pow((hueMean - 275) / 25, 2))))
        * 2 * Math.sqrt(chromaMean7Prime / (chromaMean7Prime + POW_25_7));

    const l = lightnessDifference / lightnessScale;
    const c = chromaDifference / chromaScale;
    const h = hueDifference / hueScale;
    return Math.sqrt(l * l + c * c + h * h + rotation * c * h);
}

function getHueDegrees(a: number, b: number): number
{
    return (a == 0 && b == 0) ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
}

function toRadians(degrees: number): number
{
    return degrees * Math.PI / 180;
}

export default AtmospherePaletteVersionMigration;
