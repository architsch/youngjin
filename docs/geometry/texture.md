# Geometry of Textures

![Texture Fitting](figures/texture_fitting_in_region.jpg)

Pictures (canvases and props, one atlas between them) and labels draw what they show into a shared atlas (@src/client/graphics/types/texture/textureAtlas.ts): one region of whole cells per key, as large as the largest of its holders asks for, up to the atlas's own cap. The two differ only in parameters: the picture atlas caps a region at the size of the largest image that keeps its scale, and the label atlas has no cap.
- A region is drawn before its holders move onto it, so a resize never shows a blank; a draw that lands after its entry moved on is dropped.
- When the picture atlas is full, the largest regions are drawn smaller rather than anything being left out; the room's cap on pictures keeps that always possible.

Where content goes on the quad showing it is one layout (@src/client/graphics/util/textureAtlasLayoutUtil.ts), in three modes:
- **Fill** (labels): the quad covers its area.
- **Fit** (paintings): the quad is shrunk along one axis to the content's aspect ratio, as shown, and centered. The letterbox is the quad's shape, not transparent texels. Content within a small tolerance of the area's shape fills it.
- **Preserve** (everyday objects; see `ImageMetadata.preserveScale`): the content keeps its own world size. The quad is the smaller of the area and the content on each axis and samples the centred part, so whatever overflows is cut off. A prop showing such an image is exactly its size (see `ObjectScalingConfig.getFixedScale`).

A picture's image is one region per ImagePath, shared by every canvas or prop showing it (`PictureGameObject`): a fitted image's region follows the largest picture showing it (up to the cap), a preserved one is its own cells. QuarterTurns turns what the quad samples, in the shader, so a turn, a resize or a frame change moves texture coordinates and never redraws.

The picture material discards transparent texels, so a canvas's board, or the face behind a prop or a frameless canvas, shows through an image's own transparent pixels, e.g. an object cut out of its photo's background.
