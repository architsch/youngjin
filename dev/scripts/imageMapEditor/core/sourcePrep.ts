import PrepCutOut from "../../imagePrep/core/prepCutOut";
import PrepSquare from "../../imagePrep/core/prepSquare";
import PrepRound from "../../imagePrep/core/prepRound";

// How a source is preprocessed into another (see SourcePreprocessor), by the picture preparation tool's own steps,
// taken in its order (see PrepOrder): the things kept of it cut out of their background, the specks that leaves
// dropped, and a face seen at an angle squared up or something round made round (one of the two). Every position is
// a fraction of the source, wherever a cut-out's trimming leaves it.
export default interface SourcePrep
{
    cutOut?: PrepCutOut[];
    tidy?: boolean;
    // By its corners, which the page places.
    square?: Omit<PrepSquare, "sides">;
    round?: PrepRound;
}
