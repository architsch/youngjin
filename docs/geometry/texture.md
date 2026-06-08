# Geometry of Textures

## Fitting a Texture inside a Rectangular Region

![Texture Fitting](figures/texture_fitting_in_region.jpg)

### Overview

When rendering a source texture onto a rectangular target region, we want to fill the region as much as possible while preserving the source's aspect ratio. This is achieved by comparing the two aspect ratios and shrinking the target along one axis to match the source's proportions — the same idea as letterboxing (bars on top and bottom) or pillarboxing (bars on the left and right).

### Algorithm

1. **Compare aspect ratios.** Compute the aspect ratio of the source texture and of the target region.

2. **Adjust the target along the limiting axis:**
   - **Source narrower than the target:** shrink the target's width to match the source's proportions and center it horizontally, leaving empty vertical bars on the sides (pillarboxing).
   - **Source wider than the target:** shrink the target's height to match and center it vertically, leaving empty horizontal bars above and below (letterboxing).
   - **Equal aspect ratios:** no adjustment — the texture fills the region exactly.

3. **Render the adjusted quad.** Draw the source texture onto the resized quad, preserving its original aspect ratio.

Implemented in @src/client/graphics/util/textureUtil.ts .
