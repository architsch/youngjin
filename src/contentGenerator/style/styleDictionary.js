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
const fullscreenPanelWidthPaddingPercent = 2.5;

const scrollbar_thickness = "17px";
const scrollbar_border_radius = "8px";
const scrollbar_border_thickness = "4px";

const space = {
	unit: {
		landscape: {
			vertical: 0.6,
			horizontal: 1,
		},
		portrait: {
			vertical: 1,
			horizontal: 2.5,
		},
	},
};

const regular_font_weight = 400;
const bold_font_weight = 800;
const fontScaleFactor_vmax = 0.7;
const fontScaleFactor_px = 1.0;
const font_vmax_min = 2.6;
const font_px_min = 16;
const fontScaleInc = 1.2;
const fontScaleInc2 = fontScaleInc*fontScaleInc;
const fontScaleInc3 = fontScaleInc*fontScaleInc*fontScaleInc;
const fontScaleInc4 = fontScaleInc*fontScaleInc*fontScaleInc*fontScaleInc;

//------------------------------------------------------------------------
// Functions
//------------------------------------------------------------------------

// Areas

const absoluteArea = (leftPercent, rightPercent, topPercent, bottomPercent, widthPercent, heightPercent) =>
`position: absolute;
\tdisplay: block;
\tleft: ${leftPercent}%;
\tright: ${rightPercent}%;
\ttop: ${topPercent}%;
\tbottom: ${bottomPercent}%;
\twidth: ${widthPercent}%;
\theight: ${heightPercent}%;`;

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

const spacing = (landscape, verticalScale, horizontalScale, suppressMargin = false, suppressPadding = false) => {
	const unit = space.unit[landscape ? "landscape" : "portrait"];
	const verticalSize = (unit.vertical * verticalScale).toFixed(2);
	const horizontalSize = (unit.horizontal * horizontalScale).toFixed(2);
	const verticalPadding = suppressPadding ? "0" : `${verticalSize}%`;
	const horizontalPadding = suppressPadding ? "0" : `${horizontalSize}%`;
	const verticalMargin = suppressMargin ? "0" : `${verticalSize}%`;
	const horizontalMargin = suppressMargin ? "0" : `${horizontalSize}%`;
return `padding: ${verticalPadding} ${horizontalPadding} ${verticalPadding} ${horizontalPadding};
\tmargin: ${verticalMargin} ${horizontalMargin} ${verticalMargin} 0;`;
};

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

const fullscreen_whole_area = absoluteArea(
	0, 0, 0, 0,
	100, 100);

const fullscreen_left_bar_area = absoluteArea(
	0, 100 - fullscreenLeftBarWidthPercent, 0, 0,
	fullscreenLeftBarWidthPercent, 100);

const fullscreen_top_bar_area = absoluteArea(
	0, 0, 0, 100 - fullscreenTopBarHeightPercent,
	100, fullscreenTopBarHeightPercent);

const fullscreen_right_panel_area = absoluteArea(
	fullscreenLeftBarWidthPercent, 2*fullscreenPanelWidthPaddingPercent, 0, 0,
	100 - (fullscreenLeftBarWidthPercent + 2*fullscreenPanelWidthPaddingPercent), 100);

const fullscreen_bottom_panel_area = absoluteArea(
	0, fullscreenPanelWidthPaddingPercent, fullscreenTopBarHeightPercent, 0,
	100 - 2*fullscreenPanelWidthPaddingPercent, 100 - fullscreenTopBarHeightPercent);

const fullscreen_left_bar_logo_area = absoluteArea(
	0, 0, 0, 100 - fullscreenLeftBarLogoAreaHeightPercent,
	100, fullscreenLeftBarLogoAreaHeightPercent);

const fullscreen_left_bar_menu_area = absoluteArea(
	0, 0, fullscreenLeftBarLogoAreaHeightPercent, 0,
	100, 80);

const fullscreen_top_bar_logo_area = absoluteArea(
	0, 0, 0, 100 - fullscreenTopBarLogoAreaHeightPercent,
	100, fullscreenTopBarLogoAreaHeightPercent);

const fullscreen_top_bar_menu_area = absoluteArea(
	0, 0, fullscreenTopBarLogoAreaHeightPercent, 0,
	100, 100 - fullscreenTopBarLogoAreaHeightPercent);

const getGraceWidthPercent = (landscape) =>
	2 * space.unit[landscape ? "landscape" : "portrait"].horizontal;

const full_row_area = (landscape) => relativeArea(true, `${(100).toFixed(2)}%`);
const near_full_row_area = (landscape) => relativeArea(true, `${(98).toFixed(2)}%`);
const twoThirds_row_area = (landscape) => relativeArea(true, `${(66 - getGraceWidthPercent(landscape)).toFixed(2)}%`);
const half_row_area = (landscape) => relativeArea(true, `${(50 - getGraceWidthPercent(landscape)).toFixed(2)}%`);
const third_row_area = (landscape) => relativeArea(true, `${(33 - getGraceWidthPercent(landscape)).toFixed(2)}%`);
const quarter_row_area = (landscape) => relativeArea(true, `${(25 - getGraceWidthPercent(landscape)).toFixed(2)}%`);
const fifth_row_area = (landscape) => relativeArea(true, `${(20 - getGraceWidthPercent(landscape)).toFixed(2)}%`);
const tiny_row_area = _ => relativeArea(true, "1%");
const flexible_row_area = _ => relativeAndFlexibleArea(true);

const full_col_area = (landscape) => relativeArea(false, `${(100).toFixed(2)}%`);
const near_full_col_area = (landscape) => relativeArea(false, `${(98).toFixed(2)}%`);
const twoThirds_col_area = (landscape) => relativeArea(false, `${(66 - getGraceWidthPercent(landscape)).toFixed(2)}%`);
const half_col_area = (landscape) => relativeArea(false, `${(50 - getGraceWidthPercent(landscape)).toFixed(2)}%`);
const third_col_area = (landscape) => relativeArea(false, `${(33 - getGraceWidthPercent(landscape)).toFixed(2)}%`);
const quarter_col_area = (landscape) => relativeArea(false, `${(25 - getGraceWidthPercent(landscape)).toFixed(2)}%`);
const fifth_col_area = (landscape) => relativeArea(false, `${(20 - getGraceWidthPercent(landscape)).toFixed(2)}%`);
const tiny_col_area = _ => relativeArea(false, "1%");
const flexible_col_area = _ => relativeAndFlexibleArea(false);

const zero_spacing = _ => "padding: 0 0 0 0; margin: 0 0 0 0;";
const xs_spacing = (landscape) => spacing(landscape, 0.5, 1);
const s_spacing = (landscape) => spacing(landscape, 1, 1);
const m_spacing = (landscape) => spacing(landscape, 2, 1);
const l_spacing = (landscape) => spacing(landscape, 3, 1);
const xl_spacing = (landscape) => spacing(landscape, 4, 1);

const xs_spacing_paddingOnly = (landscape) => spacing(landscape, 0.5, 1, true, false);
const xs_spacing_marginOnly = (landscape) => spacing(landscape, 0.5, 1, false, true);

const s_spacing_paddingOnly = (landscape) => spacing(landscape, 1, 1, true, false);
const s_spacing_marginOnly = (landscape) => spacing(landscape, 1, 1, false, true);

const m_spacing_paddingOnly = (landscape) => spacing(landscape, 2, 1, true, false);
const m_spacing_marginOnly = (landscape) => spacing(landscape, 2, 1, false, true);

const l_spacing_paddingOnly = (landscape) => spacing(landscape, 3, 1, true, false);
const l_spacing_marginOnly = (landscape) => spacing(landscape, 3, 1, false, true);

const xl_spacing_paddingOnly = (landscape) => spacing(landscape, 4, 1, true, false);
const xl_spacing_marginOnly = (landscape) => spacing(landscape, 4, 1, false, true);

const size_s_font = `min(${(font_vmax_min * fontScaleFactor_vmax).toFixed(2)}vmax, ${(font_px_min * fontScaleFactor_px).toFixed(2)}px)`;
const size_m_font = `min(${(font_vmax_min * fontScaleInc * fontScaleFactor_vmax).toFixed(2)}vmax, ${(font_px_min * fontScaleInc * fontScaleFactor_px).toFixed(2)}px)`;
const size_l_font = `min(${(font_vmax_min * fontScaleInc2 * fontScaleFactor_vmax).toFixed(2)}vmax, ${(font_px_min * fontScaleInc2 * fontScaleFactor_px).toFixed(2)}px)`;
const size_xl_font = `min(${(font_vmax_min * fontScaleInc3 * fontScaleFactor_vmax).toFixed(2)}vmax, ${(font_px_min * fontScaleInc3 * fontScaleFactor_px).toFixed(2)}px)`;
const size_xxl_font = `min(${(font_vmax_min * fontScaleInc4 * fontScaleFactor_vmax).toFixed(2)}vmax, ${(font_px_min * fontScaleInc4 * fontScaleFactor_px).toFixed(2)}px)`;

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
const linkImage_frame = borderedFrame(darkColor, mediumColor, mediumColor);
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
@supports(-moz-appearance:none) {
	* {
		scrollbar-width: ${landscape ? "auto" : "none"};
		scrollbar-color: ${dimColor} ${extraDarkColor};
	}
}
::-webkit-scrollbar {
	width: ${landscape ? scrollbar_thickness : "0"};
	height: ${landscape ? scrollbar_thickness : "0"};
}
::-webkit-scrollbar-track {
	background: ${extraDarkColor};
}
::-webkit-scrollbar-thumb {
	background: ${dimColor};
	border-radius: ${scrollbar_border_radius};
	border: ${scrollbar_border_thickness} solid ${extraDarkColor};
}
::-webkit-scrollbar-thumb:hover {
	background: ${mediumColor};
}
iframe {
	${full_row_area(landscape)}
	${m_spacing_marginOnly(landscape)}
	${l_bold_font}
	${medium_color_frame}
}
p {
	${full_row_area(landscape)}
	${xl_spacing_marginOnly(landscape)}
	${s_font}
	${light_color_frame}
}
h3 {
	${full_row_area(landscape)}
	${xl_spacing_marginOnly(landscape)}
	${m_bold_font}
	${mediumYellow_color_frame}
}
h2 {
	${full_row_area(landscape)}
	${xl_spacing_marginOnly(landscape)}
	${xl_bold_font}
	${dim_color_frame}
}
h1 {
	${full_row_area(landscape)}
	${xl_spacing_marginOnly(landscape)}
	${xxl_bold_font}
	${lightYellow_color_frame}
}
hr {
	${full_row_area(landscape)}
	${m_spacing_marginOnly(landscape)}
	${light_color_frame}
}
.fullscreenBar {
	${landscape ? fullscreen_left_bar_area : fullscreen_top_bar_area}
	${zero_spacing(landscape)}
	${m_bold_font}
	${inverted_medium_color_frame}
	text-align: ${fullscreenBarTextAlign};
	z-index: 1;
	overflow: hidden;
}
.fullscreenPanel {
	${landscape ? fullscreen_right_panel_area : fullscreen_bottom_panel_area}
	margin: 0 0 0 0;
	padding: 0 ${fullscreenPanelWidthPaddingPercent}% 0 ${fullscreenPanelWidthPaddingPercent}%;
	${l_bold_font}
	${medium_color_frame}
	overflow-y: scroll;
	overflow-x: auto;
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
	${landscape ? xl_spacing_paddingOnly(landscape) : s_spacing_paddingOnly(landscape)}
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
.loadingScreen {
	${fullscreen_whole_area}
	${zero_spacing(landscape)}
	z-index: 900;

	.background {
		${fullscreen_whole_area}
		${zero_spacing(landscape)}
		${loading_screen_background_frame}
	}
	.text {
		position: absolute;
		min-width: 50%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		${xxl_bold_font}
		${xl_spacing(landscape)}
		${loading_screen_text_frame}
		text-align: center;
		z-index: 901;
	}
}
.xs_image {
	${landscape ? quarter_col_area(landscape) : half_col_area(landscape)}
	${m_spacing_marginOnly(landscape)}
	${l_bold_font}
	${medium_color_frame}
}
.s_image {
	${landscape ? third_col_area(landscape) : twoThirds_col_area(landscape)}
	${m_spacing_marginOnly(landscape)}
	${l_bold_font}
	${img_frame}
}
.m_image {
	${landscape ? twoThirds_col_area(landscape) : full_col_area(landscape)}
	${m_spacing_marginOnly(landscape)}
	${l_bold_font}
	${img_frame}
}
.m_linkImage {
	${landscape ? half_col_area(landscape) : near_full_col_area(landscape)}
	${m_spacing_marginOnly(landscape)}
	${l_bold_font}
	${linkImage_frame}
}
.m_linkImage:hover {
	border-color: ${lightYellowColor};
}
.listEntry {
	${flexible_row_area(landscape)}
	${s_spacing(landscape)}
	${s_bold_font}
	${list_entry_frame}
	text-decoration: none;
}
.pagePath {
	${s_spacing_marginOnly(landscape)}
	${s_font}
}
.textInput {
	${landscape ? flexible_col_area(landscape) : flexible_row_area(landscape)}
	${landscape ? s_spacing(landscape) : s_spacing(landscape)}
	${s_font}
	${text_input_frame}
}
.textInputLabel {
	${flexible_col_area(landscape)}
	${s_spacing(landscape)}
	${s_font}
	${medium_color_frame}
}
.inlineButton {
	${flexible_col_area(landscape)}
	${s_spacing(landscape)}
	${s_font}
	${list_entry_frame}
	text-decoration: none;
}
.inlineButton:hover {
	color: ${lightYellowColor};
	cursor: pointer;
}
.snippet {
	${flexible_row_area(landscape)}
	${m_spacing(landscape)}
	${s_bold_font}
	${snippet_frame}
	white-space: nowrap;
}
.excerpt {
	${full_row_area(landscape)}
	${m_spacing(landscape)}
	${s_italic_font}
	${excerpt_frame}
	white-space: pre-wrap;
	white-space: -moz-pre-wrap;
	white-space: -pre-wrap;
	white-space: -o-pre-wrap;
	word-wrap: break-word;
}
.zero_row {
	${tiny_row_area()}
	${zero_spacing()}
	${transparent_frame}
}
.xs_row {
	${tiny_row_area(landscape)}
	${xs_spacing(landscape)}
	${transparent_frame}
}
.s_row {
	${tiny_row_area(landscape)}
	${s_spacing(landscape)}
	${transparent_frame}
}
.m_row {
	${tiny_row_area(landscape)}
	${m_spacing(landscape)}
	${transparent_frame}
}
.l_row {
	${tiny_row_area(landscape)}
	${l_spacing(landscape)}
	${transparent_frame}
}
.xl_row {
	${tiny_row_area(landscape)}
	${xl_spacing(landscape)}
	${transparent_frame}
}
`;

//------------------------------------------------------------------------
// CSS
//------------------------------------------------------------------------

const css =
`* {
	overflow: hidden;
	vertical-align: middle;
}
body {
	${fullscreen_whole_area}
	${zero_spacing()}
	${s_font}
	${light_color_frame}
	text-align: ${defaultTextAlign};
	z-index: 0;
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
.dim {
	${dim_color_frame}
}
.noTextDeco {
	text-decoration: none;
}

@media (orientation: landscape) {
	${stylesForOrientation(true)}
}

@media (orientation: portrait) {
	${stylesForOrientation(false)}
}`;

module.exports = css;