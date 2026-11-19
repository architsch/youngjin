import RgbaImage from "./rgbaImage";
import RecipeAdjust from "./recipeAdjust";

// How far each setting at its end moves a color.
const MAX_CONTRAST_EXPONENT = 1.5; // contrast scales about mid-gray by 2 to the power of this, either way
const MAX_BRIGHTNESS_EXPONENT = 1; // brightness curves each channel by 2 to the power of this, either way
const MAX_WARMTH = 0.15; // warmth scales red up and blue down (or the reverse) by this fraction
const MAX_SHARPEN = 1.5; // sharpness adds this much of each pixel's difference from its neighbors

export const NO_ADJUST: RecipeAdjust = {brightness: 0, contrast: 0, saturation: 0, hue: 0, warmth: 0, sharpness: 0};

// A sample's colors as a recipe changes them (see RecipeAdjust). Alpha is left alone.
const ColorAdjustUtil =
{
    // Everything but sharpness, which the game image gets once it is smaller (see sharpen).
    adjust: (image: RgbaImage, adjust: RecipeAdjust): void =>
    {
        if (adjust.brightness == 0 && adjust.contrast == 0 && adjust.saturation == 0 && adjust.hue == 0
            && adjust.warmth == 0)
            return;

        // Contrast about mid-gray, then brightness as a curve that keeps black and white where they are.
        const contrast = Math.pow(2, MAX_CONTRAST_EXPONENT * adjust.contrast / 100);
        const exponent = Math.pow(2, -MAX_BRIGHTNESS_EXPONENT * adjust.brightness / 100);
        const tone = new Float32Array(256).map((_, value) => {
            const contrasted = Math.min(1, Math.max(0, (value / 255 - 0.5) * contrast + 0.5));
            return 255 * Math.pow(contrasted, exponent);
        });
        const warmRed = 1 + MAX_WARMTH * adjust.warmth / 100;
        const warmBlue = 1 - MAX_WARMTH * adjust.warmth / 100;
        const saturation = 1 + adjust.saturation / 100;
        const cos = Math.cos(adjust.hue * Math.PI / 180);
        const sin = Math.sin(adjust.hue * Math.PI / 180);

        const data = image.data;
        for (let i = 0; i < data.length; i += 4)
        {
            const r = data[i] * warmRed, g = data[i + 1], b = data[i + 2] * warmBlue;
            // Hue turns the chroma plane of YIQ; saturation scales it.
            const y = 0.299 * r + 0.587 * g + 0.114 * b;
            const iq = 0.596 * r - 0.274 * g - 0.322 * b;
            const q = 0.211 * r - 0.523 * g + 0.312 * b;
            const i2 = (iq * cos - q * sin) * saturation;
            const q2 = (iq * sin + q * cos) * saturation;
            data[i] = tone[toByte(y + 0.956 * i2 + 0.621 * q2)];
            data[i + 1] = tone[toByte(y - 0.272 * i2 - 0.647 * q2)];
            data[i + 2] = tone[toByte(y - 1.106 * i2 + 1.703 * q2)];
        }
    },

    // An unsharp mask over each pixel's visible neighbors, so a cut-out's edge doesn't pick up what was taken out.
    sharpen: (image: RgbaImage, sharpness: number): void =>
    {
        if (sharpness <= 0)
            return;
        const {width, height} = image;
        const original = new Uint8ClampedArray(image.data);
        const amount = MAX_SHARPEN * sharpness / 100;
        for (let y = 0; y < height; ++y)
        {
            for (let x = 0; x < width; ++x)
            {
                const index = (y * width + x) * 4;
                if (original[index + 3] == 0)
                    continue;
                let r = 0, g = 0, b = 0, count = 0;
                for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ++ny)
                {
                    for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); ++nx)
                    {
                        const neighbor = (ny * width + nx) * 4;
                        if (original[neighbor + 3] == 0)
                            continue;
                        r += original[neighbor];
                        g += original[neighbor + 1];
                        b += original[neighbor + 2];
                        ++count;
                    }
                }
                image.data[index] = original[index] + amount * (original[index] - r / count);
                image.data[index + 1] = original[index + 1] + amount * (original[index + 1] - g / count);
                image.data[index + 2] = original[index + 2] + amount * (original[index + 2] - b / count);
            }
        }
    },
}

function toByte(value: number): number
{
    return (value <= 0) ? 0 : (value >= 255) ? 255 : Math.round(value);
}

export default ColorAdjustUtil;
