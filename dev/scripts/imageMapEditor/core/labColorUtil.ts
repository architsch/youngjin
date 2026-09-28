import RgbaImage from "./rgbaImage";

// sRGB channel value to linear light, tabled once.
const LINEAR = new Float32Array(256).map((_, value) => {
    const c = value / 255;
    return (c <= 0.04045) ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
});
// CIELAB's companding function over 0..1, tabled finely enough to interpolate (its inputs never leave that range
// by more than rounding, since they are white-normalized).
const F_STEPS = 4096;
const F_TABLE = new Float32Array(F_STEPS + 2).map((_, i) => companding(i / F_STEPS));

// CIELAB colors, so how far apart two colors look is a plain distance (delta E, CIE76) and a threshold works
// alike on dark and light colors.
const LabColorUtil =
{
    // L, a, b per pixel, packed three to a pixel.
    toLab: (image: RgbaImage): Float32Array =>
    {
        const {width, height, data} = image;
        const lab = new Float32Array(width * height * 3);
        for (let i = 0, j = 0; i < data.length; i += 4, j += 3)
        {
            const r = LINEAR[data[i]], g = LINEAR[data[i + 1]], b = LINEAR[data[i + 2]];
            // D65 white.
            const fx = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
            const fy = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
            const fz = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
            lab[j] = 116 * fy - 16;
            lab[j + 1] = 500 * (fx - fy);
            lab[j + 2] = 200 * (fy - fz);
        }
        return lab;
    },

    fromRgb: (r: number, g: number, b: number): [number, number, number] =>
    {
        const lab = LabColorUtil.toLab({width: 1, height: 1, data: new Uint8ClampedArray([r, g, b, 255])});
        return [lab[0], lab[1], lab[2]];
    },

    // Between the colors of two pixels of the same image.
    distance: (lab: Float32Array, a: number, b: number): number =>
    {
        const dl = lab[a * 3] - lab[b * 3];
        const da = lab[a * 3 + 1] - lab[b * 3 + 1];
        const db = lab[a * 3 + 2] - lab[b * 3 + 2];
        return Math.sqrt(dl * dl + da * da + db * db);
    },

    // Between a pixel's color and a color (L, a, b at offset in colors).
    distanceTo: (lab: Float32Array, pixel: number, colors: ArrayLike<number>, offset: number): number =>
    {
        const dl = lab[pixel * 3] - colors[offset];
        const da = lab[pixel * 3 + 1] - colors[offset + 1];
        const db = lab[pixel * 3 + 2] - colors[offset + 2];
        return Math.sqrt(dl * dl + da * da + db * db);
    },
}

function f(t: number): number
{
    const position = (t <= 0) ? 0 : (t >= 1) ? F_STEPS : t * F_STEPS;
    const i = position | 0;
    return F_TABLE[i] + (F_TABLE[i + 1] - F_TABLE[i]) * (position - i);
}

function companding(t: number): number
{
    return (t > 0.008856) ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

export default LabColorUtil;
