import ProceduralTextureSurface from "./proceduralTextureSurface";

// A texture ProceduralTextureUtil draws.
export default interface ProceduralTextureSpec
{
    surface: ProceduralTextureSurface;
    colorHex: string; // "#rrggbb": what the texture's pixels average to
}
