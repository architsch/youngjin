// Pixels as RGBA bytes, row by row from the top.
export default interface RgbaImage
{
    width: number;
    height: number;
    data: Uint8ClampedArray;
}
