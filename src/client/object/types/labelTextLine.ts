import LabelTextSpan from "../../../shared/object/types/labelTextSpan";

// One line of a label as laid out (see LabelTextLayoutUtil): its text in runs of one style each, left to
// right, and its height in units of the font size, spacing included.
export default interface LabelTextLine
{
    segments: LabelTextSpan[];
    height: number;
}
