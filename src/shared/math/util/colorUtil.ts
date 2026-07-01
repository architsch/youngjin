const ColorUtil =
{
    // hex = Color expressed in a hexadecimal form (e.g. "#ffffff")
    // Returns RGB values in range [0,225]
    hexToRGB: (hex: string): [number, number, number] =>
    {
        const sanitizedHex = hex.replace(/^#/, "");
        const fullHex = (sanitizedHex.length == 3)
            ? sanitizedHex.split("").map(char => char + char).join("") 
            : sanitizedHex;
        if (fullHex.length !== 6)
        {
            console.error(`ColorUtil::hexToRGB :: Invalid hex length (${fullHex.length})`);
            return [1, 0, 1];
        }
        const num = parseInt(fullHex, 16);
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    },
    // r,g,b = RGB values in range [0,225]
    // Returns color expressed in a hexadecimal form (e.g. "#ffffff")
    rgbToHex: (r: number, g: number, b: number): string =>
    {
        return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
    },
}

export default ColorUtil;
