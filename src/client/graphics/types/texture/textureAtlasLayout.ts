import Vec2 from "../../../../shared/math/types/vec2";
import TexelRect from "./texelRect";

// Where atlas content goes on the quad showing it (see TextureAtlasLayoutUtil.getLayout).
export default interface TextureAtlasLayout
{
    // Centred on the area, and never beyond it.
    quadSize: Vec2;
    // What the quad samples, before it is turned.
    texelRect: TexelRect;
}
