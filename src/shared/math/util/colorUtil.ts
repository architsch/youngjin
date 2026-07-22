import NumUtil from "./numUtil";
import Vec3 from "../types/vec3";

const BASE_94_PALETTE_COLUMNS = 4;
const BASE_94_PALETTE_HEX = [
    // Neutrals and warm off-whites: only the few gray steps that read as distinct
    "#000000", "#2a2a2a", "#979797", "#ffffff", "#f5e69f", "#c6b492",
    // Earth tones
    "#877666", "#622001", "#754921", "#ac4e00", "#cc903e", "#879000",
    // Reds and pinks
    "#95002d", "#ce0048", "#ff0324", "#ff715b", "#fdc3c7", "#fc38ab",
    // Oranges and yellows
    "#d86100", "#ff9e00", "#dec900", "#f5ff05", "#9bfe00", "#86c53a",
    // Greens
    "#006903", "#00ac0b", "#0a8a49", "#00ec63", "#9ce9a1", "#00d5b9",
    // Teals and cyans
    "#165258", "#009d9f", "#00f9fd", "#00b8de", "#82ccfd", "#bfe6f4",
    // Blues
    "#070081", "#0905ff", "#008bfe", "#516e9b", "#96a3f1", "#dbaef2",
    // Purples and magentas
    "#5700a3", "#8600ff", "#b76bec", "#a1009c", "#ec00fc", "#fa75ff",
];

const palette: Vec3[] = BASE_94_PALETTE_HEX.map(hex =>
{
    const num = parseInt(hex.slice(1), 16);
    return {x: (num >> 16) & 255, y: (num >> 8) & 255, z: num & 255};
});

const ColorUtil =
{
    base94PaletteSize: palette.length,
    base94PaletteColumns: BASE_94_PALETTE_COLUMNS,
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
    // index = index in the color palette (see paletteSize)
    // Returns RGB values in range [0,255]
    base94IndexToRGB: (index: number): Vec3 =>
    {
        const color = palette[NumUtil.clampInRange(Math.round(index), 0, palette.length - 1, true)];
        return {x: color.x, y: color.y, z: color.z}; // Copied, so that the caller cannot mutate the palette.
    },
    // rgb = RGB values in range [0,255]
    // Returns an index in the color palette (see paletteSize)
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
