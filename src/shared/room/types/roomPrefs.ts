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

    // The light the player carries. Its color is a position in the "Light" palette; the other two
    // are the same division a lamp somebody installed is given (see HeadLightUtil).
    //
    //   - **Power**, how much light there is at all — from none, which is what a room that lights
    //     itself wants, through the ordinary lamp and well past it.
    //   - **Range**, how far it carries and how sharply it falls off on the way, which are one
    //     question: a lamp given a long reach with a steep falloff is a lamp whose range does
    //     nothing. Kept apart from the power because fusing them makes a dim lamp always a small one
    //     and a bright lamp always a far-reaching one, so neither a soft wash filling the room nor a
    //     fierce pool a pace across can be asked for.
    headLightColorIndex: number;
    headLightPowerStep: number;
    headLightRangeStep: number;

    // The air. Its color is a position in the "Fog" palette, and is also what the void past the
    // room is painted in. The two distances are where things begin to fade into it and where they
    // have faded into it completely.
    fogColorIndex: number;
    fogNearStep: number;
    fogFarStep: number;

    // The smoke: the room's air being unevenly thick, rather than the even wash a single distance
    // gives. Its field is three-dimensional and stands in the room, so a thinning of the air is
    // somewhere — walked around, passed behind, and still there when the player turns their head.
    // Nothing here reaches the sky, which has a field of its own (see the atmosphere shader).
    //
    //   - **Strength**, how far the air thins where the smoke lies heaviest. Where the clouds blend
    //     between two colors, this changes how much fog there *is*: at nothing the air is evenly
    //     thick, and at the full of it the room shows clean through the thinnest patches. It is the
    //     only one of these that can turn the smoke off, and a room asking for plain fog says so
    //     here.
    //   - **Scale**, how fine the smoke runs — from one slow swell filling the room to drifting wisps.
    //   - **Speed**, how fast it moves through the room, in world distance rather than through the
    //     field, so that asking for finer smoke does not also appear to speed it up. Its bottom is
    //     air that hangs still.
    //   - **Drift** and **Rise**, which way it goes: a compass bearing and how steeply it climbs or
    //     settles. Two steps because a direction in three dimensions cannot be one, and worth having
    //     because they are the difference between smoke rising off something and dry ice pouring
    //     across a floor.
    fogSmokeAmplitudeStep: number;
    fogSmokeScaleStep: number;
    fogSmokeSpeedStep: number;
    fogSmokeDriftStep: number;
    fogSmokeRiseStep: number;

    // The drifting cloud masses of the sky past the room (a field of its own, read on the direction
    // the sky is looked at rather than on any place in the room; see the atmosphere shader).
    //
    //   - **Color**, a position in the "Scenery" palette — a set of masses seen against the air,
    //     rather than the set of airs the fog's color comes from. The clouds are that color and the
    //     sky between them is the fog's, so how strongly they read is how far apart the two were
    //     picked.
    //
    //     A color rather than a strength alone, because a strength could only ever have been a
    //     *degree of* the fog's own color, and a cloud that is a darker or lighter shade of the air
    //     it hangs in is barely a cloud. Against a dark sky it is invisible however far the dial is
    //     pushed, which is exactly the range a room lit for atmosphere lives in.
    //   - **Opacity**, how far toward that color a cloud actually gets. Where the color says *what*
    //     the clouds are, this says *how much of it* — which is the difference between weather and a
    //     tint, and the way two colors picked far apart are brought back within sight of each other
    //     without either being repicked. At nothing there is no weather at all, which is how an
    //     unconfigured room asks for a clear sky.
    //   - **Scale**, how fine they are. A sky of a few great banks and a sky of mottled fleece
    //     differ in this alone.
    //   - **Softness**, how wide the boundary between cloud and clear air runs. At its tightest a
    //     cloud has a cut edge; opened up, it stops being a shape at all and becomes the haze the
    //     underlying field is on its own.
    //   - **Speed**, how fast they cross the sky. Measured as an angular rate, so that setting the
    //     clouds finer does not also slow them down — which is what makes these two dials
    //     independent rather than two ways of asking the same thing. Its bottom is still air.
    cloudColorIndex: number;
    cloudOpacityStep: number;
    cloudScaleStep: number;
    cloudSoftnessStep: number;
    cloudSpeedStep: number;

    // The land the room stands over — everything below the horizon, which without it is the same
    // empty air as everything above it. Unlike the clouds this belongs to the sky alone: the fog is
    // the air in and around the room, and a far wall fading into a hillside would be wrong.
    //
    //   - **Color**, the low land, and **Peak color**, the high — two positions in the "Scenery"
    //     palette the clouds are drawn from, which is a set of masses seen *against* the air rather
    //     than of airs. How far apart they are picked is how mountainous the country reads: a step
    //     apart is moorland, a deep green against a pale grey is a snowline. Picking one entry twice
    //     is how a room says it wants no relief, and dropping the solidity to nothing is how it says
    //     it wants no land at all.
    //   - **Scale**, how coarse the country is.
    //   - **Solidity**, how far the land holds its own color against the air in front of it. The
    //     land fades with distance as land does, and this is how long it takes to go — the difference
    //     between a country and a suggestion of one. It cannot make the land opaque at the horizon,
    //     and must not: land that arrived at the horizon still colored would meet the sky in a color
    //     the sky is not.
    //   - **Softness**, how wide the slope from the low color to the high one runs — a drawn
    //     coastline at one end, two colors that never quite separate at the other.
    groundColorIndex: number;
    groundPeakColorIndex: number;
    groundScaleStep: number;
    groundSolidityStep: number;
    groundSoftnessStep: number;
}
