# Geometry of Textures

![Texture Fitting](figures/texture_fitting_in_region.jpg)

When a texture is drawn into a rectangular region, the region is shrunk along one axis to match the texture's aspect ratio and then centered, which letterboxes or pillarboxes the image. Implemented in @src/client/graphics/util/textureUtil.ts .

The region's aspect ratio is the one it is **shown** at. A canvas's texture cell is stretched over a picture the shape of the frame's inside, so the image is fitted to that shape, and redrawn whenever a resize changes it.

The part of the region the image does not cover is cleared to transparent. A canvas's material discards transparent texels, so the board's inner color (or, without a frame, the wall) shows around a letterboxed picture.
