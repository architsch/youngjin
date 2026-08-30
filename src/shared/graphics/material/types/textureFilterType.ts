// How a texture is sampled when it is drawn at anything other than its own pixel size.
//
// "nearest" is what a texture pack of pictures wants: a cell of it is an image drawn to be seen as
// itself, and smoothing only bleeds one cell into the next. "linear" is for lettering and anything
// else whose edges are its whole legibility — nearest sampling turns a glyph's edge into a staircase
// the moment the viewer is not standing at exactly the distance the text was rasterized for.
type TextureFilterType = "nearest" | "linear";

export default TextureFilterType;
