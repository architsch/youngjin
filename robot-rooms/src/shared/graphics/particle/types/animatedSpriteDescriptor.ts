import Vec2 from "../../../math/types/vec2";
import Waveform from "../../../math/types/waveform";

// What an AnimatedSprite shows on its object's face (see ObjectTypeConfig.components.animatedSprite).
export default interface AnimatedSpriteDescriptor
{
    sprite: string; // SpriteConfigMap id
    // Share of the object's footprint the sprite covers, across and up its face.
    widthScale?: number;
    heightScale?: number;
    // Where on the face it is shown, once at each: its middle, as shares of the footprint across (x) and up (y)
    // from the face's middle (see Geometry3DUtil.getAxisFacingBasis). Once in the middle if absent.
    centers?: Vec2[];
    // How far in front of the object's face it sits, in world units.
    faceOffset?: number;
    // Clockwise, as seen from the front.
    quarterTurns?: number;
    // Phase units per second (see SpriteConfig). A steady 1 if absent.
    rate?: Waveform;
    tintHex?: string;
}
