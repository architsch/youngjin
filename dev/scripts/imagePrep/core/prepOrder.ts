import PrepCutOut from "./prepCutOut";
import PrepSquare from "./prepSquare";
import PrepRound from "./prepRound";
import PrepCover from "./prepCover";
import PrepKeep from "./prepKeep";

// What is to be made of one picture (see PrepCommands.run), its steps taken in this order: cut out of its
// background, tidied, upscaled, re-mapped (squared or rounded, one of the two), parts of it painted over, cut to the
// part kept, and fitted within the largest size a result may have.
export default interface PrepOrder
{
    // The picture's path, from the repository's root.
    source: string;
    // The result's file name, without its extension. Absent: the source's.
    name?: string;
    // The things kept of the picture, each in turn (see MaskUtil); the rest goes see-through, and the picture is
    // trimmed to what is left, so the steps after this one are placed on that.
    cutOut?: PrepCutOut[];
    // Drops the specks a rough cut-out left around the object.
    tidy?: boolean;
    // Enlarges it first (see Upscaler).
    upscale?: boolean;
    square?: PrepSquare;
    round?: PrepRound;
    // Each in turn, so a later one may draw on what an earlier one painted.
    cover?: PrepCover[];
    keep?: PrepKeep;
    // The longest the result's sides may be, in pixels. Absent: MAX_RESULT_SIDE (see PrepRenderUtil), which it can't
    // exceed.
    maxSide?: number;
}
