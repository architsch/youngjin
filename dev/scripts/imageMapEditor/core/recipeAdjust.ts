// Color changes to a sample (see ColorAdjustUtil), each 0 for none. Brightness, contrast, saturation and warmth run
// from -100 to 100, hue in degrees from -180 to 180, and sharpness from 0 to 100 (applied to the game image, after it
// is made smaller).
export default interface RecipeAdjust
{
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    warmth: number;
    sharpness: number;
}
