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

const defaultTextAlign = "left";
const fullscreenBarTextAlign = "center";

const fullscreenLeftBarWidthPercent = 14;
const fullscreenTopBarHeightPercent = 12;
const fullscreenLeftBarLogoAreaHeightPercent = 14;
const fullscreenTopBarLogoAreaHeightPercent = 65;

const logoWidthToHeightRatio = 3;

const gameLinkWidthPercent_landscape = 20;
const gameLinkWidthPercent_portrait = 80;
const featureLinkWidthPercent_landscape = 15;
const featureLinkWidthPercent_portrait = 40;
const playButtonWidthPercent_landscape = 20;
const playButtonWidthPercent_portrait = 40;

//------------------------------------------------------------------------
// Functions
//------------------------------------------------------------------------

// Areas

const absoluteArea = (withRespectToWholeScreen, leftPercent, rightPercent, topPercent, bottomPercent, widthPercent, heightPercent) =>
`position: ${withRespectToWholeScreen ? "fixed" : "absolute"};
\tdisplay: block;
\tmax-width: 100%;
\tmax-height: 100%;
\tleft: ${leftPercent}%;
\tright: ${rightPercent}%;
\ttop: ${topPercent}%;
\tbottom: ${bottomPercent}%;
\twidth: ${(widthPercent == 0) ? "max-content" : `${widthPercent}%`};
\theight: ${(heightPercent == 0) ? "max-content" : `${heightPercent}%`};`;

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

// Spacing

const spacing = (verticalSize, horizontalSize, suppressMargin = false, suppressPadding = false) =>
`padding: ${suppressPadding ? "0" : verticalSize} ${suppressPadding ? "0" : horizontalSize};
\tmargin: ${suppressMargin ? "0" : verticalSize} ${suppressMargin ? "0" : horizontalSize};`;

// Font

const font = (fontSize, isItalic, fontWeight) =>
`font-size: ${fontSize};
\tfont-family: "Lucida Console", "Lucida Sans Typewriter", "Monaco", Consolas, monospace;
\tfont-style: ${isItalic ? "italic" : "normal"};
\tfont-weight: ${fontWeight};`;

// Frames

const simpleFrame = (backgroundColor, foregroundColor) =>
`background-color: ${backgroundColor};
\tcolor: ${foregroundColor};`;

const roundedFrame = (backgroundColor, foregroundColor) =>
simpleFrame(backgroundColor, foregroundColor) + "\n" +
`\tborder-radius: 4.5vmin;`;

const borderedFrame = (backgroundColor, foregroundColor, borderColor, borderThickness = "1.25") =>
roundedFrame(backgroundColor, foregroundColor) + "\n" +
`\tborder-bottom: ${borderThickness}vmin ${borderColor} solid;` + "\n" +
`\tborder-right: ${borderThickness}vmin ${borderColor} solid;`;

//------------------------------------------------------------------------
// Elementary Styles
//------------------------------------------------------------------------

const fullscreen_whole_area = absoluteArea(true, 0, 0, 0, 0, 100, 100);
const fullscreen_left_bar_area = absoluteArea(true, 0, 100 - fullscreenLeftBarWidthPercent, 0, 0, fullscreenLeftBarWidthPercent, 100);
const fullscreen_top_bar_area = absoluteArea(true, 0, 0, 0, 100 - fullscreenTopBarHeightPercent, 100, fullscreenTopBarHeightPercent);
const fullscreen_right_panel_area = absoluteArea(true, fullscreenLeftBarWidthPercent, 0, 0, 0, 100 - fullscreenLeftBarWidthPercent, 100);
const fullscreen_bottom_panel_area = absoluteArea(true, 0, 0, fullscreenTopBarHeightPercent, 0, 100, 100 - fullscreenTopBarHeightPercent);
const fullscreen_left_bar_logo_area = absoluteArea(false, 0, 0, 0, 100 - fullscreenLeftBarLogoAreaHeightPercent, 100, fullscreenLeftBarLogoAreaHeightPercent);
const fullscreen_left_bar_menu_area = absoluteArea(false, 0, 0, fullscreenLeftBarLogoAreaHeightPercent, 0, 100, 80);
const fullscreen_top_bar_logo_area = absoluteArea(false, 0, 0, 0, 100 - fullscreenTopBarLogoAreaHeightPercent, 100, fullscreenTopBarLogoAreaHeightPercent);
const fullscreen_top_bar_menu_area = absoluteArea(false, 0, 0, fullscreenTopBarLogoAreaHeightPercent, 0, 100, 100 - fullscreenTopBarLogoAreaHeightPercent);

const full_row_area = relativeArea(true, "95%");
const near_full_row_area = relativeArea(true, "85%");
const twoThirds_row_area = relativeArea(true, "66.66%");
const half_row_area = relativeArea(true, "50%");
const third_row_area = relativeArea(true, "33.33%");
const quarter_row_area = relativeArea(true, "25%");
const fifth_row_area = relativeArea(true, "20%");
const tiny_row_area = relativeArea(true, "1%");
const flexible_row_area = relativeAndFlexibleArea(true);

const zero_spacing = spacing("0", "0");
const s_spacing = spacing("0.5vmin", "0.5vmin");
const m_spacing = spacing("1.0vmin", "1.0vmin");
const l_spacing = spacing("1.5vmin", "1.5vmin");
const xl_spacing = spacing("2.0vmin", "2.0vmin");
const s_spacing_paddingOnly = spacing("0.5vmin", "0.5vmin", true, false);
const m_spacing_paddingOnly = spacing("1.0vmin", "1.0vmin", true, false);
const l_spacing_paddingOnly = spacing("1.5vmin", "1.5vmin", true, false);
const xl_spacing_paddingOnly = spacing("2.0vmin", "2.0vmin", true, false);
const m_spacing_horizontallyWider = spacing("1.0vmin", "3.0vmin");

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

const transparent_frame = `opacity: 0;`;
const light_color_frame = simpleFrame(darkColor, lightColor);
const medium_color_frame = simpleFrame(darkColor, mediumColor);
const inverted_medium_color_frame = simpleFrame(mediumColor, darkColor);
const dim_color_frame = simpleFrame(darkColor, dimColor);
const lightYellow_color_frame = simpleFrame(darkColor, lightYellowColor);
const banner_frame = roundedFrame(mediumColor, darkColor);
const gameLinkImage_frame = borderedFrame(darkColor, mediumColor, mediumColor);
const featureLinkImage_frame = borderedFrame(darkColor, mediumColor, mediumColor);
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
.fullscreenBar {
	${landscape ? fullscreen_left_bar_area : fullscreen_top_bar_area}
	${zero_spacing}
	${m_font}
	${inverted_medium_color_frame}
	text-align: ${fullscreenBarTextAlign};
	z-index: 1;
}
.fullscreenPanel {
	${landscape ? fullscreen_right_panel_area : fullscreen_bottom_panel_area}
	${xl_spacing_paddingOnly}
	${l_font}
	${medium_color_frame}
	overflow-y: scroll;
}
.fullscreenBarLogo {
	${landscape ? fullscreen_left_bar_logo_area : fullscreen_top_bar_logo_area}
}
.fullscreenBarLogoImage {
	position: relative;
	display: block;
	max-width: 80%;
	max-height: 70%;
	margin: auto;
  top: 50%;
  -ms-transform: translateY(-50%);
  transform: translateY(-50%);
}
.fullscreenBarMenu {
	${landscape ? fullscreen_left_bar_menu_area : fullscreen_top_bar_menu_area}
}
.fullscreenBarMenuButton {
	position: relative;
	display: ${landscape ? "block" : "inline-block"};
	${landscape ? "width: 100%;" : "top: 100%; -ms-transform: translateY(-100%); transform: translateY(-100%);"}
	max-height: 100%;
	${m_spacing_paddingOnly}
	box-sizing: border-box;
}
.fullscreenBarMenuButton.idle {
	${inverted_medium_color_frame}
}
.fullscreenBarMenuButton.selected {
	${medium_color_frame}
}
.fullscreenBarMenuButton.idle:hover {
	color: ${lightYellowColor};
}
.fullscreenBarMenuButton.selected:hover {
	color: ${lightYellowColor};
}
.logoImage {
	${landscape ? half_row_area : near_full_row_area}
	${m_spacing}
	${xl_font}
	${medium_color_frame}
}
.logoImageSmall {
	${landscape ? third_row_area : twoThirds_row_area}
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
	display: inline-block;
	width: ${landscape ? `${gameLinkWidthPercent_landscape}vw` : `${gameLinkWidthPercent_portrait}vw`};
	height: ${landscape ? `${(gameLinkWidthPercent_landscape * 0.305715).toFixed(4)}vw` : `${(gameLinkWidthPercent_portrait * 0.305715).toFixed(4)}vw`};
	${m_spacing}
	${xl_font}
	${gameLinkImage_frame}
}
.gameLink:hover {
	border-color: ${lightYellowColor};
}
.featureLink {
	position: relative;
	display: inline-block;
	width: ${landscape ? `${featureLinkWidthPercent_landscape}vw` : `${featureLinkWidthPercent_portrait}vw`};
	height: ${landscape ? `${(featureLinkWidthPercent_landscape * 0.5714).toFixed(4)}vw` : `${(featureLinkWidthPercent_portrait * 0.5714).toFixed(4)}vw`};
	${m_spacing}
	${xl_font}
	${featureLinkImage_frame}
}
.featureLink:hover {
	border-color: ${lightYellowColor};
}
.playButton {
	position: relative;
	display: ${landscape ? "inline-block" : "block"};
	width: ${landscape ? `${playButtonWidthPercent_landscape}vw` : `${playButtonWidthPercent_portrait}vw`};
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
	${fullscreen_whole_area}
	${zero_spacing}
	${s_font}
	${light_color_frame}
	text-align: ${defaultTextAlign};
	z-index: 0;
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
	${full_row_area}
	${l_spacing}
	${m_font}
	${dim_color_frame}
}

.snippet {
	position: relative;
	display: inline-block;
	width: 90vw;
	width: auto;
	${xl_spacing}
	${s_bold_font}
	${snippet_frame}
	overflow: auto;
	white-space: nowrap;
}
.excerpt {
	position: relative;
	display: inline-block;
	width: 90vw;
	${l_spacing}
	${s_italic_font}
	${excerpt_frame}
	white-space: pre-wrap;
	white-space: -moz-pre-wrap;
	white-space: -pre-wrap;
	white-space: -o-pre-wrap;
	word-wrap: break-word;
}
.banner {
	${full_row_area}
	${xl_spacing}
	${l_font}
	${banner_frame}
}
.s_spacer {
	${tiny_row_area}
	${s_spacing}
	${transparent_frame}
}
.m_spacer {
	${tiny_row_area}
	${m_spacing}
	${transparent_frame}
}
.l_spacer {
	${tiny_row_area}
	${l_spacing}
	${transparent_frame}
}
.xl_spacer {
	${tiny_row_area}
	${xl_spacing}
	${transparent_frame}
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