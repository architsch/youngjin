// How content drawn in an atlas region is shown on the area it may cover (see TextureAtlasLayoutUtil.getLayout):
// "fill" stretches it over the area, "fit" shows all of it as large as the area allows, and "preserve" keeps
// its own world size, cutting off whatever overflows.
type TextureAtlasFitMode = "fill" | "fit" | "preserve";

export default TextureAtlasFitMode;
