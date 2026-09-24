// How a stretch of a label's text is drawn, as its markup styles it (see LabelTextUtil.parseText). There
// is no color: a label has one ink (see LabelText).
export default interface LabelTextStyle
{
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    scale: number; // Relative to the label's font size
    fontFace: "serif" | "sans-serif" | "monospace";
}
