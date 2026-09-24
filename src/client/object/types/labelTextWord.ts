import LabelTextSpan from "../../../shared/object/types/labelTextSpan";

// A word of a label's text as laid out (see LabelTextLayoutUtil): the styled pieces between whitespace (a
// word can change style partway), and the space before it, which is dropped where the word starts a line.
export default interface LabelTextWord
{
    space: LabelTextSpan | undefined;
    pieces: LabelTextSpan[];
}
