// A room's atmosphere: the light that fills it, the light the player carries while standing in it,
// and the air between the two. Everything here is a *setting* rather than a source — where the
// lamps are is part of the room's contents, and what one of them is like is that lamp's own affair.
//
// Every field is a small whole number, and that is the point: what is stored on the room is a
// handful of characters (see RoomPrefsUtil), which is what lets the whole atmosphere travel with
// the room rather than being fetched separately. A color is a position in a palette rather than a
// color, exactly as everything else in the game that is painted is; a distance or a strength is a
// step, which is the same quantization every stored appearance already uses.
export default interface RoomPrefs
{
    // The light that reaches every surface regardless of where it faces or what is in the way. What
    // keeps the unlit side of a thing from being black. Its color is a position in the "Light"
    // palette; its strength is a step of its own, because the two are genuinely separate questions
    // here — a room lit warm and a room barely lit at all are not the same wish, and a palette entry
    // dark enough to express the second would be too dark to express the first.
    ambientColorIndex: number;
    ambientIntensityStep: number;

    // The light the player carries. Its color is a position in the "Light" palette; its power is how
    // much of it the room wants at all, from none to the whole of it.
    headLightColorIndex: number;
    headLightPowerStep: number;

    // The air. Its color is a position in the "Fog" palette, and is also what the void past the
    // room is painted in. The two distances are where things begin to fade into it and where they
    // have faded into it completely.
    fogColorIndex: number;
    fogNearStep: number;
    fogFarStep: number;
}
