//------------------------------------------------------------------------
// Global Parameters
//------------------------------------------------------------------------

const extraDarkColor = "#101010";
const darkColor = "#303030";
const dimColor = "#707070";
const mediumColor = "#a0a0a0";
const lightColor = "#c0c0c0";
const lightYellowColor = "#d0c090";
const lightGreenColor = "#70c060";
const mediumYellowColor = "#b0a070";

const defaultTextAlign = "left";
const fullscreenBarTextAlign = "center";

const fullscreenLeftBarWidthPercent = 14;
const fullscreenTopBarHeightPercent = 12;
const fullscreenLeftBarLogoAreaHeightPercent = 14;
const fullscreenTopBarLogoAreaHeightPercent = 65;

const gameLinkWidthPercent_landscape = 20;
const gameLinkWidthPercent_portrait = 80;
const featureLinkWidthPercent_landscape = 15;
const featureLinkWidthPercent_portrait = 40;
const playButtonWidthPercent_landscape = 20;
const playButtonWidthPercent_portrait = 40;

const scrollbar_size_percent = 1.5;

//------------------------------------------------------------------------
// Functions
//------------------------------------------------------------------------

// Areas

/*const fixedArea = (
	leftPercent, rightPercent,
	topPercent, bottomPercent,
	widthPercent, heightPercent,
	makeRoomForScrollbarY = false,
	makeRoomForScrollbarX = false) => {
const right = "";
const bottom = "";
const width = (makeRoomForScrollbarY ? `calc(${widthPercent}% - ${scrollbar_size_percent}${hu})` : `${widthPercent}${hu}`);
const height = (makeRoomForScrollbarX ? `calc(${heightPercent}% - ${scrollbar_size_percent}${vu})` : `${heightPercent}${vu}`);
return `position: ${withRespectToWholeScreen ? "fixed" : "absolute"};
\tdisplay: block;
\tmax-width: 100vw;
\tmax-height: 100vh;
\tleft: ${leftPercent}vw;
\tright: ${rightPercent}vw;
\ttop: ${topPercent}vh;
\tbottom: ${bottomPercent}vh;
\twidth: ${width};
\theight: ${height};`};*/

const absoluteArea = (withRespectToWholeScreen,
	leftPercent, rightPercent,
	topPercent, bottomPercent,
	widthPercent, heightPercent,
	makeRoomForScrollbarY = false,
	makeRoomForScrollbarX = false) => {
const hu = withRespectToWholeScreen ? "vw" : "%";
const vu = withRespectToWholeScreen ? "vh" : "%";
//const right = "";
//const bottom = "";
const width = (makeRoomForScrollbarY ? `calc(${widthPercent}% - ${scrollbar_size_percent}vw)` : `${widthPercent}${hu}`);
const height = (makeRoomForScrollbarX ? `calc(${heightPercent}% - ${scrollbar_size_percent}vh)` : `${heightPercent}${vu}`);
return `position: ${withRespectToWholeScreen ? "fixed" : "absolute"};
\tdisplay: block;
\tmax-width: 100${hu};
\tmax-height: 100${vu};
\tleft: ${leftPercent}${hu};
\tright: ${rightPercent}${hu};
\ttop: ${topPercent}${vu};
\tbottom: ${bottomPercent}${vu};
\twidth: ${width};
\theight: ${height};`};

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

const simpleFrame = (backgroundColor, foregroundColor, opacity = 1) =>
`background-color: ${backgroundColor};
\tcolor: ${foregroundColor};${(opacity < 1) ? `\n\topacity: ${opacity};` : ""}`;

const roundedFrame = (backgroundColor, foregroundColor, opacity = 1) =>
simpleFrame(backgroundColor, foregroundColor) + "\n" +
`\tborder-radius: 4.5vmin;${(opacity < 1) ? `\n\topacity: ${opacity};` : ""}`;

const borderedFrame = (backgroundColor, foregroundColor, borderColor, borderThickness = "1.25", opacity = 1) =>
roundedFrame(backgroundColor, foregroundColor) + "\n" +
`\tborder-bottom: ${borderThickness}vmin ${borderColor} solid;` + "\n" +
`\tborder-right: ${borderThickness}vmin ${borderColor} solid;${(opacity < 1) ? `\n\topacity: ${opacity};` : ""}`;

//------------------------------------------------------------------------
// Elementary Styles
//------------------------------------------------------------------------

const fullscreen_whole_area = absoluteArea(true, 0, 0, 0, 0, 100, 100);
const fullscreen_left_bar_area = absoluteArea(true, 0, 100 - fullscreenLeftBarWidthPercent, 0, 0, fullscreenLeftBarWidthPercent, 100);
const fullscreen_top_bar_area = absoluteArea(true, 0, 0, 0, 100 - fullscreenTopBarHeightPercent, 100, fullscreenTopBarHeightPercent);
const fullscreen_right_panel_area = absoluteArea(true,
	fullscreenLeftBarWidthPercent, scrollbar_size_percent,
	0, 0,
	100 - scrollbar_size_percent - fullscreenLeftBarWidthPercent, 100,
	true);
const fullscreen_bottom_panel_area = absoluteArea(true,
	0, scrollbar_size_percent,
	fullscreenTopBarHeightPercent, 0,
	100 - scrollbar_size_percent, 100 - fullscreenTopBarHeightPercent,
	true);
const fullscreen_left_bar_logo_area = absoluteArea(false, 0, 0, 0, 100 - fullscreenLeftBarLogoAreaHeightPercent, 100, fullscreenLeftBarLogoAreaHeightPercent);
const fullscreen_left_bar_menu_area = absoluteArea(false, 0, 0, fullscreenLeftBarLogoAreaHeightPercent, 0, 100, 80);
const fullscreen_top_bar_logo_area = absoluteArea(false, 0, 0, 0, 100 - fullscreenTopBarLogoAreaHeightPercent, 100, fullscreenTopBarLogoAreaHeightPercent);
const fullscreen_top_bar_menu_area = absoluteArea(false, 0, 0, fullscreenTopBarLogoAreaHeightPercent, 0, 100, 100 - fullscreenTopBarLogoAreaHeightPercent);

const full_row_area = relativeArea(true, "95%");
const near_full_row_area = relativeArea(true, "85%");
const twoThirds_row_area = relativeArea(true, "61%");
const half_row_area = relativeArea(true, "45%");
const third_row_area = relativeArea(true, "29%");
const quarter_row_area = relativeArea(true, "20%");
const fifth_row_area = relativeArea(true, "15%");
const tiny_row_area = relativeArea(true, "1%");
const flexible_row_area = relativeAndFlexibleArea(true);

const full_col_area = relativeArea(false, "95%");
const near_full_col_area = relativeArea(false, "85%");
const twoThirds_col_area = relativeArea(false, "61%");
const half_col_area = relativeArea(false, "45%");
const third_col_area = relativeArea(false, "29%");
const quarter_col_area = relativeArea(false, "20%");
const fifth_col_area = relativeArea(false, "15%");
const tiny_col_area = relativeArea(false, "1%");
const flexible_col_area = relativeAndFlexibleArea(false);

const unitVerticalSpace = 0.75;
const unitHorizontalSpace = 2.25;

const zero_spacing = spacing("0", "0");
const s_spacing = spacing(`${unitVerticalSpace}vmin`, `${unitHorizontalSpace}vmin`);
const m_spacing = spacing(`${2*unitVerticalSpace}vmin`, `${unitHorizontalSpace}vmin`);
const l_spacing = spacing(`${3*unitVerticalSpace}vmin`, `${unitHorizontalSpace}vmin`);
const xl_spacing = spacing(`${4*unitVerticalSpace}vmin`, `${unitHorizontalSpace}vmin`);

const s_spacing_paddingOnly = spacing(`${unitVerticalSpace}vmin`, `${unitHorizontalSpace}vmin`, true, false);
const s_spacing_marginOnly = spacing(`${unitVerticalSpace}vmin`, `${unitHorizontalSpace}vmin`, false, true);

const m_spacing_paddingOnly = spacing(`${2*unitVerticalSpace}vmin`, `${unitHorizontalSpace}vmin`, true, false);
const m_spacing_marginOnly = spacing(`${2*unitVerticalSpace}vmin`, `${unitHorizontalSpace}vmin`, false, true);

const l_spacing_paddingOnly = spacing(`${3*unitVerticalSpace}vmin`, `${unitHorizontalSpace}vmin`, true, false);
const l_spacing_marginOnly = spacing(`${3*unitVerticalSpace}vmin`, `${unitHorizontalSpace}vmin`, false, true);

const xl_spacing_paddingOnly = spacing(`${4*unitVerticalSpace}vmin`, `${unitHorizontalSpace}vmin`, true, false);
const xl_spacing_marginOnly = spacing(`${4*unitVerticalSpace}vmin`, `${unitHorizontalSpace}vmin`, false, true);

const fontScaleFactor_vmax = 0.7;
const fontScaleFactor_px = 1.0;
const vmax_minValue = 2.6//2.8;
const px_minValue = 16;
const fontScaleInc = 1.2;
const fontScaleInc2 = fontScaleInc*fontScaleInc;
const fontScaleInc3 = fontScaleInc*fontScaleInc*fontScaleInc;
const fontScaleInc4 = fontScaleInc*fontScaleInc*fontScaleInc*fontScaleInc;

const size_s_font = `min(${(vmax_minValue * fontScaleFactor_vmax).toFixed(2)}vmax, ${(px_minValue * fontScaleFactor_px).toFixed(2)}px)`;
const size_m_font = `min(${(vmax_minValue * fontScaleInc * fontScaleFactor_vmax).toFixed(2)}vmax, ${(px_minValue * fontScaleInc * fontScaleFactor_px).toFixed(2)}px)`;
const size_l_font = `min(${(vmax_minValue * fontScaleInc2 * fontScaleFactor_vmax).toFixed(2)}vmax, ${(px_minValue * fontScaleInc2 * fontScaleFactor_px).toFixed(2)}px)`;
const size_xl_font = `min(${(vmax_minValue * fontScaleInc3 * fontScaleFactor_vmax).toFixed(2)}vmax, ${(px_minValue * fontScaleInc3 * fontScaleFactor_px).toFixed(2)}px)`;
const size_xxl_font = `min(${(vmax_minValue * fontScaleInc4 * fontScaleFactor_vmax).toFixed(2)}vmax, ${(px_minValue * fontScaleInc4 * fontScaleFactor_px).toFixed(2)}px)`;

const regular_font_weight = 400;
const bold_font_weight = 800;

const s_font = font(size_s_font, false, regular_font_weight);
const s_italic_font = font(size_s_font, true, regular_font_weight);
const s_bold_font = font(size_s_font, false, bold_font_weight);
const m_font = font(size_m_font, true, regular_font_weight);
const m_bold_font = font(size_m_font, true, bold_font_weight);
const l_font = font(size_l_font, true, regular_font_weight);
const l_bold_font = font(size_l_font, true, bold_font_weight);
const xl_font = font(size_xl_font, true, regular_font_weight);
const xl_bold_font = font(size_xl_font, true, bold_font_weight);
const xxl_font = font(size_xxl_font, true, regular_font_weight);
const xxl_bold_font = font(size_xxl_font, true, bold_font_weight);

const transparent_frame = `opacity: 0;`;
const loading_screen_background_frame = simpleFrame("#000000", lightColor, 0.5);
const loading_screen_text_frame = borderedFrame(mediumColor, darkColor, dimColor, "1.25");
const light_color_frame = simpleFrame(darkColor, lightColor);
const medium_color_frame = simpleFrame(darkColor, mediumColor);
const inverted_medium_color_frame = simpleFrame(mediumColor, darkColor);
const dim_color_frame = simpleFrame(darkColor, dimColor);
const lightYellow_color_frame = simpleFrame(darkColor, lightYellowColor);
const mediumYellow_color_frame = simpleFrame(darkColor, mediumYellowColor);
const banner_frame = roundedFrame(mediumColor, darkColor);
const gameLinkImage_frame = borderedFrame(darkColor, mediumColor, mediumColor);
const featureLinkImage_frame = borderedFrame(darkColor, mediumColor, mediumColor);
const button_frame = borderedFrame(mediumColor, lightColor, lightYellowColor);
const img_frame = roundedFrame(darkColor, lightColor);
const snippet_frame = roundedFrame(extraDarkColor, lightGreenColor);
const excerpt_frame = roundedFrame(extraDarkColor, lightGreenColor);
const list_entry_frame = borderedFrame(extraDarkColor, mediumColor, dimColor, "0.5");
const text_input_frame = borderedFrame(dimColor, lightColor, mediumColor, "0.25");

//------------------------------------------------------------------------
// Orientation-Dependent Styles
//------------------------------------------------------------------------

const stylesForOrientation = (landscape) =>
`
iframe {
	${full_row_area}
	${m_spacing_marginOnly}
	${l_bold_font}
	${medium_color_frame}
}
.fullscreenBar {
	${landscape ? fullscreen_left_bar_area : fullscreen_top_bar_area}
	${zero_spacing}
	${m_bold_font}
	${inverted_medium_color_frame}
	text-align: ${fullscreenBarTextAlign};
	z-index: 1;
	overflow: hidden;
}
.fullscreenPanel {
	${landscape ? fullscreen_right_panel_area : fullscreen_bottom_panel_area}
	${xl_spacing_paddingOnly}
	${l_bold_font}
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
	${m_spacing_marginOnly}
	${xl_bold_font}
	${medium_color_frame}
}
.logoImageSmall {
	${landscape ? quarter_row_area : half_row_area}
	${m_spacing_marginOnly}
	${xl_bold_font}
	${medium_color_frame}
}
.profileImage {
	${landscape ? third_row_area : half_row_area}
	${m_spacing_marginOnly}
	${xl_bold_font}
	${img_frame}
}
.figureImage {
	${landscape ? half_row_area : near_full_row_area}
	${m_spacing_marginOnly}
	${xl_bold_font}
	${img_frame}
}
.gameImage {
	${landscape ? half_row_area : near_full_row_area}
	${m_spacing_marginOnly}
	${xl_bold_font}
	${img_frame}
}
.button {
	${landscape ? half_row_area : full_row_area}
	${m_spacing_marginOnly}
	${xl_bold_font}
	${button_frame}
}
.gameLink {
	position: relative;
	display: inline-block;
	width: ${landscape ? `${gameLinkWidthPercent_landscape}vw` : `${gameLinkWidthPercent_portrait}vw`};
	height: ${landscape ? `${(gameLinkWidthPercent_landscape * 0.305715).toFixed(4)}vw` : `${(gameLinkWidthPercent_portrait * 0.305715).toFixed(4)}vw`};
	${m_spacing_marginOnly}
	${xl_bold_font}
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
	${m_spacing_marginOnly}
	${xl_bold_font}
	${featureLinkImage_frame}
}
.featureLink:hover {
	border-color: ${lightYellowColor};
}
.playButton {
	position: relative;
	display: ${landscape ? "inline-block" : "block"};
	width: ${landscape ? `${playButtonWidthPercent_landscape}vw` : `${playButtonWidthPercent_portrait}vw`};
	${m_spacing_marginOnly}
	${xl_bold_font}
	${medium_color_frame}
}
.noTextDeco {
	text-decoration: none;
}
.pagePath {
	${s_spacing_marginOnly}
	${s_font}
}
.textInput {
	${landscape ? third_col_area : near_full_row_area}
	${landscape ? s_spacing : m_spacing}
	${landscape ? s_font : m_font}
	${text_input_frame}
}
.textInputLabel {
	${landscape ? flexible_col_area : flexible_row_area}
	${landscape ? s_spacing_marginOnly : m_spacing_marginOnly}
	${landscape ? s_font : m_font}
	${medium_color_frame}
}
.inlineButton {
	${flexible_col_area}
	${landscape ? s_spacing : m_spacing}
	${landscape ? s_font : m_font}
	${list_entry_frame}
	text-decoration: none;
}
.inlineButton:hover {
	color: ${lightYellowColor};
	cursor: pointer;
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
::-webkit-scrollbar {
	width: 1.4vw;
	height: 1.4vw;
}
::-webkit-scrollbar-track {
	background: ${extraDarkColor};
}
::-webkit-scrollbar-thumb {
	background: ${dimColor};
	border-radius: 0.7vw;
	border: 0.3vw solid ${extraDarkColor};
}
::-webkit-scrollbar-thumb:hover {
	background: ${mediumColor};
}
p {
	${full_row_area}
	${xl_spacing_marginOnly}
	${s_font}
	${light_color_frame}
}
h3 {
	${full_row_area}
	${xl_spacing_marginOnly}
	${m_bold_font}
	${mediumYellow_color_frame}
}
h2 {
	${full_row_area}
	${xl_spacing_marginOnly}
	${xl_bold_font}
	${dim_color_frame}
}
h1 {
	${full_row_area}
	${xl_spacing_marginOnly}
	${xxl_bold_font}
	${lightYellow_color_frame}
}
hr {
	${m_spacing_marginOnly}
	${light_color_frame}
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

.loadingScreen {
	${fullscreen_whole_area}
	${zero_spacing}
	z-index: 900;

	.background {
		${fullscreen_whole_area}
		${zero_spacing}
		${loading_screen_background_frame}
	}
	.text {
		position: absolute;
		min-width: 50%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		${xxl_bold_font}
		${xl_spacing}
		${loading_screen_text_frame}
		text-align: center;
		z-index: 901;
	}
}
.dim {
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
	overflow: auto;
	white-space: pre-wrap;
	white-space: -moz-pre-wrap;
	white-space: -pre-wrap;
	white-space: -o-pre-wrap;
	word-wrap: break-word;
}
.banner {
	${full_row_area}
	${xl_spacing}
	${l_bold_font}
	${banner_frame}
}
.zero_spacer {
	${tiny_row_area}
	${zero_spacing}
	${transparent_frame}
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
	${m_spacing}
	${s_bold_font}
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