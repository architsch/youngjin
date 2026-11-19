import { HelperInterest } from "./helperInterest";
import { HelperRemarkKind } from "./helperRemarkKind";

// A thing a helper looks at, as its remark speaks of it (see HelperRemarkUtil): its sort, its name as said in the middle
// of a sentence ("the lemon meringue tart", "'Ground Swell' by Edward Hopper"), whether that is several things, what a
// helper may like or dislike in it, most telling first, and for a picture its title and who made it, for a lamp its
// light's color.
type HelperRemarkThing = {
    kind: HelperRemarkKind,
    name: string,
    plural: boolean,
    interests: HelperInterest[],
    title?: string,
    painter?: string,
    color?: string,
};

export default HelperRemarkThing;
