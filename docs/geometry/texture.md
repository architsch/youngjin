# Geometry of Textures

![Texture Fitting](figures/texture_fitting_in_region.jpg)

When a texture is drawn into a rectangular region, the region is shrunk along one axis to match the texture's aspect ratio and then centered, which letterboxes or pillarboxes the image. Implemented in @src/client/graphics/util/textureUtil.ts .

The part of the region the image does not cover keeps what was there before. A canvas clears its cell to transparent first and its material discards transparent texels, so the board's inner color (or, without a frame, the wall) shows around a letterboxed picture.
