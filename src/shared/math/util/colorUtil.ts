import NumUtil from "./numUtil";
import Vec3 from "../types/vec3";
import { ColorPaletteMap, ColorPaletteName } from "../maps/colorPaletteMap";

// A palette position is encoded as one visible-ASCII character (see StringUtil), so a palette that
// held more than this could name colors nothing could write down.
const MAX_PALETTE_SIZE = 94;

const palettes: {[colorPaletteName: ColorPaletteName]: Vec3[]} = {};
for (const colorPaletteName in ColorPaletteMap)
{
    const hexEntries = ColorPaletteMap[colorPaletteName];
    if (hexEntries.length > MAX_PALETTE_SIZE)
    {
        throw new Error(`Color palette "${colorPaletteName}" holds more colors than a palette ` +
            `position can name (${hexEntries.length} > ${MAX_PALETTE_SIZE})`);
    }
    palettes[colorPaletteName] = hexEntries.map(hex =>
    {
        const num = parseInt(hex.slice(1), 16);
        return {x: (num >> 16) & 255, y: (num >> 8) & 255, z: num & 255};
    });
}

function getPalette(colorPaletteName: ColorPaletteName): Vec3[]
{
    const palette = palettes[colorPaletteName];
    if (palette == undefined)
        throw new Error(`Unknown color palette :: "${colorPaletteName}"`);
    return palette;
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
    // How many colors the named palette holds (see ColorPaletteMap).
    getPaletteSize: (colorPaletteName: ColorPaletteName): number =>
    {
        return getPalette(colorPaletteName).length;
    },
    // index = position in the named palette
    // Returns RGB values in range [0,255]
    paletteIndexToRGB: (colorPaletteName: ColorPaletteName, index: number): Vec3 =>
    {
        const palette = getPalette(colorPaletteName);
        const color = palette[NumUtil.clampInRange(Math.round(index), 0, palette.length - 1, true)];
        return {x: color.x, y: color.y, z: color.z}; // Copied, so that the caller cannot mutate the palette.
    },
    // rgb = RGB values in range [0,255]
    // Returns a position in the named palette
    rgbToPaletteIndex: (colorPaletteName: ColorPaletteName, rgb: Vec3): number =>
    {
        // Nearest palette entry, measured by squared distance in RGB space.
        const palette = getPalette(colorPaletteName);
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
