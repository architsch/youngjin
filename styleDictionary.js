//------------------------------------------------------------------------
// Global Parameters
//------------------------------------------------------------------------

const extraDarkColor = "#000000";//"#202020";
const darkColor = "#202020";//"#404040";
const dimColor = "#707070";//"#707070";
const mediumColor = "#a0a0a0";//"#909090";
const lightColor = "#e0e0e0";//"#d0d0d0";
const lightYellowColor = "#e0d0a0";
const lightGreenColor = "#80d070";

//------------------------------------------------------------------------
// Functions
//------------------------------------------------------------------------

const relativeArea = (nextline, maxWidth) =>
`position: relative;
\tdisplay: ${nextline ? "block" : "inline-block"};
\tmax-width: ${maxWidth};`;

const relativeAndFlexibleArea = (nextline) =>
`position: relative;
\tdisplay: ${nextline ? "block" : "inline-block"};
\tmax-width: none;
\twidth: fit-content;
\tblock-size: fit-content;`;

const fullCoverChildArea = (display) =>
`position: absolute;
\tdisplay: ${display ? "block" : "none"};
\ttop: 0;
\tbottom: 0;
\tleft: 0;
\tright: 0;
\twidth: 100%;
\theight: 100%;`;

const spacing = (verticalSize, horizontalSize, includePadding, includeMargin, textAlign) =>
`text-align: ${textAlign};` +
(includePadding ? `\tpadding: ${verticalSize} ${horizontalSize};` : "") +
(includeMargin ? `\tmargin: ${verticalSize} auto;` : "");

const font = (fontSize, isItalic, fontWeight) =>
`font-size: ${fontSize};
\tfont-family: "Lucida Console", "Lucida Sans Typewriter", "Monaco", Consolas, monospace;
\tfont-style: ${isItalic ? "italic" : "normal"};
\tfont-weight: ${fontWeight};`;

const simpleFrame = (backgroundColor, foregroundColor) =>
`background-color: ${backgroundColor};
\tcolor: ${foregroundColor};`;

const roundedFrame = (backgroundColor, foregroundColor) =>
simpleFrame(backgroundColor, foregroundColor) + "\n" +
`\tborder-radius: 4.5vmin;`;

const borderedFrame = (backgroundColor, foregroundColor, borderColor, borderThickness = "1.5") =>
roundedFrame(backgroundColor, foregroundColor) + "\n" +
`\tborder-bottom: ${borderThickness}vmin ${borderColor} solid;` + "\n" +
`\tborder-right: ${borderThickness}vmin ${borderColor} solid;`;

//------------------------------------------------------------------------
// Elementary Styles
//------------------------------------------------------------------------

const full_row_area = relativeArea(true, "90vw");
const near_full_row_area = relativeArea(true, "80vw");
const twoThirds_row_area = relativeArea(true, "60vw");
const half_row_area = relativeArea(true, "40vw");
const third_row_area = relativeArea(true, "28vw");
const quarter_row_area = relativeArea(true, "23vw");
const flexible_row_area = relativeAndFlexibleArea(true);
const visible_full_cover_child_area = fullCoverChildArea(true);
const invisible_full_cover_child_area = fullCoverChildArea(false);

const zero_spacing = spacing("0", "0", true, true, "center");
const s_spacing = spacing("0.5vmin", "0.5vmin", true, true, "center");
const m_spacing = spacing("1.0vmin", "1.0vmin", true, true, "center");
const l_spacing = spacing("1.5vmin", "1.5vmin", true, true, "center");
const xl_spacing = spacing("2.0vmin", "2.0vmin", true, true, "center");

const m_spacing_horizontallyWider = spacing("1.0vmin", "3.0vmin", true, true, "center");

const s_spacing_paddingOnly = spacing("0.5vmin", "0.5vmin", true, false, "center");
const m_spacing_paddingOnly = spacing("1.0vmin", "1.0vmin", true, false, "center");
const l_spacing_paddingOnly = spacing("1.5vmin", "1.5vmin", true, false, "center");
const xl_spacing_paddingOnly = spacing("2.0vmin", "2.0vmin", true, false, "center");

const s_spacing_marginOnly = spacing("0.5vmin", "0.5vmin", false, true, "center");
const m_spacing_marginOnly = spacing("1.0vmin", "1.0vmin", false, true, "center");
const l_spacing_marginOnly = spacing("1.5vmin", "1.5vmin", false, true, "center");
const xl_spacing_marginOnly = spacing("2.0vmin", "2.0vmin", false, true, "center");

const zero_spacing_leftText = spacing("0", "0", true, true, "left");
const s_spacing_leftText = spacing("0.5vmin", "0.5vmin", true, true, "left");
const m_spacing_leftText = spacing("1.0vmin", "1.0vmin", true, true, "left");
const l_spacing_leftText = spacing("1.5vmin", "1.5vmin", true, true, "left");
const xl_spacing_leftText = spacing("2.0vmin", "2.0vmin", true, true, "left");

const fontScaleFactor_vmax = 0.7;
const fontScaleFactor_px = 1.0;
const vmax_minValue = 2.6//2.8;
const px_minValue = 16;
const fontScaleInc = 1.2;
const fontScaleInc2 = fontScaleInc*fontScaleInc;
const fontScaleInc3 = fontScaleInc*fontScaleInc*fontScaleInc;

const size_s_font = `min(${(vmax_minValue * fontScaleFactor_vmax).toFixed(2)}vmax, ${(px_minValue * fontScaleFactor_px).toFixed(2)}px)`;
const size_m_font = `min(${(vmax_minValue * fontScaleInc * fontScaleFactor_vmax).toFixed(2)}vmax, ${(px_minValue * fontScaleInc * fontScaleFactor_px).toFixed(2)}px)`;
const size_l_font = `min(${(vmax_minValue * fontScaleInc2 * fontScaleFactor_vmax).toFixed(2)}vmax, ${(px_minValue * fontScaleInc2 * fontScaleFactor_px).toFixed(2)}px)`;
const size_xl_font = `min(${(vmax_minValue * fontScaleInc3 * fontScaleFactor_vmax).toFixed(2)}vmax, ${(px_minValue * fontScaleInc3 * fontScaleFactor_px).toFixed(2)}px)`;

const s_font = font(size_s_font, false, 400);
const s_italic_font = font(size_s_font, true, 400);
const s_bold_font = font(size_s_font, false, 700);
const m_font = font(size_m_font, true, 700);
const l_font = font(size_l_font, true, 700);
const xl_font = font(size_xl_font, true, 700);

const light_color_frame = simpleFrame(darkColor, lightColor);
const medium_color_frame = simpleFrame(darkColor, mediumColor);
const dim_color_frame = simpleFrame(darkColor, dimColor);
const lightYellow_color_frame = simpleFrame(darkColor, lightYellowColor);
const banner_frame = roundedFrame(mediumColor, darkColor);
const gameLinkImage_frame = borderedFrame(darkColor, mediumColor, mediumColor);
const gameLinkImageHover_frame = borderedFrame(darkColor, mediumColor, lightYellowColor);
const button_frame = borderedFrame(mediumColor, lightColor, lightYellowColor);
const img_frame = roundedFrame(darkColor, lightColor);
const snippet_frame = roundedFrame(extraDarkColor, lightGreenColor);
const excerpt_frame = roundedFrame(extraDarkColor, lightGreenColor);
const list_entry_frame = borderedFrame(extraDarkColor, mediumColor, dimColor, "0.5");

//------------------------------------------------------------------------
// Orientation-Dependent Styles
//------------------------------------------------------------------------

const stylesForOrientation = (landscape) =>
`
iframe {
	${full_row_area}
	${m_spacing}
	${l_font}
	${medium_color_frame}
}
.logoImage {
	${landscape ? half_row_area : near_full_row_area}
	${m_spacing}
	${xl_font}
	${medium_color_frame}
}
.logoImageSmall {
	${landscape ? quarter_row_area : half_row_area}
	${m_spacing}
	${xl_font}
	${medium_color_frame}
}
.profileImage {
	${landscape ? third_row_area : half_row_area}
	${m_spacing}
	${xl_font}
	${img_frame}
}
.figureImage {
	${landscape ? half_row_area : full_row_area}
	${m_spacing}
	${xl_font}
	${img_frame}
}
.gameImage {
	${landscape ? half_row_area : full_row_area}
	${m_spacing}
	${xl_font}
	${img_frame}
}
.button {
	${landscape ? half_row_area : full_row_area}
	${m_spacing}
	${xl_font}
	${button_frame}
}
.gameLink {
	position: relative;
	display: ${landscape ? "inline-block" : "block"};
	width: ${landscape ? "30vw" : "80vw"};
	height: ${landscape ? "9.1714vw" : "24.4571vw"};
	${m_spacing}
	${xl_font}
	${gameLinkImage_frame}
}
.gameLink:hover {
	border-color: ${lightYellowColor}
}
.playButton {
	position: relative;
	display: ${landscape ? "inline-block" : "block"};
	width: ${landscape ? "30vw" : "60vw"};
	${m_spacing}
	${xl_font}
	${medium_color_frame}
}
.noTextDeco {
	text-decoration: none;
}
`;

//------------------------------------------------------------------------
// CSS
//------------------------------------------------------------------------

const css =
`body {
	${full_row_area}
	${s_spacing}
	${s_font}
	${light_color_frame}
}
p {
	${full_row_area}
	${l_spacing}
	${s_font}
	${light_color_frame}
}
h3 {
	${full_row_area}
	${m_spacing}
	${m_font}
	${light_color_frame}
}
h2 {
	${full_row_area}
	${l_spacing}
	${l_font}
	${medium_color_frame}
}
h1 {
	${full_row_area}
	${l_spacing}
	${xl_font}
	${lightYellow_color_frame}
}
a:link {
  color: ${mediumColor};
}
a:visited {
  color: ${mediumColor};
}
a:hover {
  color: ${lightYellowColor};
}
a:active {
  color: ${mediumColor};
}
footer {
	position: relative;
	display: block;
	margin-top: 5vh;
	margin-bottom: 5vh;
	margin-left: 5vw;
	margin-right: 5vw;
	padding: 3vmax 3vmax 3vmax 3vmax;
	${m_font}
	${dim_color_frame}
}

.snippet {
	position: relative;
	display: inline-block;
	width: auto;
	${xl_spacing_leftText}
	${s_bold_font}
	${snippet_frame}
	white-space: nowrap;
}
.excerpt {
	position: relative;
	display: inline-block;
	width: auto;
	${l_spacing}
	${s_italic_font}
	${excerpt_frame}
}
.banner {
	${full_row_area}
	${xl_spacing}
	${l_font}
	${banner_frame}
}
.s_spacer {
	${full_row_area}
	${s_spacing}
	${medium_color_frame}
}
.m_spacer {
	${full_row_area}
	${m_spacing}
	${medium_color_frame}
}
.l_spacer {
	${full_row_area}
	${l_spacing}
	${medium_color_frame}
}
.xl_spacer {
	${full_row_area}
	${xl_spacing}
	${medium_color_frame}
}
.listEntry {
	${flexible_row_area}
	${m_spacing_horizontallyWider}
	${s_bold_font}
	${list_entry_frame}
	text-decoration: none;
}
.homeButton {
	${flexible_row_area}
	${m_spacing_horizontallyWider}
	${m_font}
	${list_entry_frame}
	text-decoration: none;
}

@media (orientation: landscape) {
	${stylesForOrientation(true)}
}

@media (orientation: portrait) {
	${stylesForOrientation(false)}
}`;

module.exports = css;