# Image Map System

Reference: @src/shared/graphics/image/types/imageMap.ts , @src/shared/graphics/image/types/imageMapSeed.ts , @src/server/ssg/builder/imageMapBuilder.ts , @src/client/ui/components/panel/imageMapThumbnailPanel.tsx , @src/client/ui/components/form/imageGridChooserForm.tsx , @dev/scripts/imageMapEditor

An `ImageMap` catalogs a set of related images (pictures, voxel texture packs) so the app can refer to each one by a short, stable `imagePath` instead of a URL.

- Each map has a root directory under `public/app/assets/` with a `manifest.json` that lists every image with its author and title (and, for a third party's image, its source and license), which serve the notices and never ship, and optionally its keywords. The manifest is the source of truth.
- **Keywords** are what a search finds an image by, and all the built map carries of its description, as one comma-separated string (smaller to ship than a list). An image that names none is found by its title and author instead: so is every painting, while an everyday object names its own, as single words with none inside another (which a search would find anyway) and no grammatical words (which a search passes over); the editor tidies them so on saving.
- The picture map holds what canvases and props show, a subfolder each: paintings (Arts), which a canvas fits to its size, and everyday objects (Objects), which a prop shows at their own size. Each type accepts only its own subfolder's paths (`CANVAS_IMAGE_SUBFOLDER`, `PROP_IMAGE_SUBFOLDER`), as does its chooser.
- The picture map is edited with `npm run imageMapEditor` (see [local_dev.md](../devOps/local_dev.md)): samples of photos in its source library, straightened, tilted, retouched, cut out (background fill, hand edits, and selections, each turnable, outside which everything is taken out or filled with a color) and color-adjusted, become entries. It writes each entry's image (the sample fitted whole into its cells and placed as aligned, smaller for a margin if asked, the rest its edge color or see-through; or, for a painting, the sample at a long side), a full-resolution sample (`dev/assets/`, never shipped, to make the entry again at another size), the manifest, its recipes, the notices' table of third-party images, and rebuilds the map.
- Every entry, in any tab, is edited the same way, from its recipe. One without a recipe (added to the manifest by hand) is taken in when the editor starts, as the whole of its own image, which becomes its source and its sample unchanged.
- Photos can also be sampled in batches from the command line (sources added by address, surveyed with a grid, and a plan of samples saved), which the `image-map-sampling` skill drives. A batch's entries are always saved disabled, to be reviewed.
- The source library keeps each photo by its content hash, which recipes name; the photos are gitignored, and a committed index records where each came from so it can be downloaded again.
- **Paths are permanent**: a stored canvas or prop names its image by path, so an entry is never renumbered, and a deleted entry's number is never reused.
- A **disabled** entry keeps its path and recipe but is left out of the built map, so nothing can choose it and whatever shows it shows nothing. Its game image is parked under `dev/assets/`, so nothing of it ships, and it leaves the notices until it is enabled again. A tab whose images are all disabled is left out of the built map, which must keep at least one enabled image.
- During SSG, `ImageMapBuilder` processes each `ImageMapSeed`. It writes auxiliary images (grid images, thumbnails), records each file image's pixel size (so the client lays an image out before it loads), and generates a TypeScript module that registers the map in `ImageMapUtil`. The client and the server both import the generated modules. **Never edit generated files**; edit the manifest and rerun the generator instead.
- Benefits: stored data holds only paths, which the server validates against the same map; the catalog ships in the bundle, so no runtime fetch is needed; browsing uses one grid image; and thumbnails avoid downloading and uploading full-size images that are drawn small.

## Terms
- `imagePath` (`ImageMetadata.path`): the image's path under the root, without extension.
- `coords`: `{subfolder},{col},{row}` within a grid (only in gridded maps).
- `subfolder`: an optional first path segment. Each subfolder is its own grid and chooser tab.
- `thumbnail`: a downscaled copy for the chooser, which a picture also draws from when its atlas region is no larger.
- `preserveScale`: the image keeps its own size in the world instead of being fitted to what shows it (see [texture.md](../geometry/texture.md)), and a prop showing it is pinned to that size. Its pixel size must be whole cells of the seed's `preservedScaleCellSize`, each a fixed patch of the world; the builder fails otherwise.

## Modes
The seed determines the mode.

![Image Map Types](figures/image_map_2.jpg)

- **List**: separate files, browsed as searchable thumbnails (pictures).
- **Grid**: separate files that the builder composes into a uniform grid image (texture packs).
- **Atlas**: a pre-composed atlas. Manifest paths are cell coordinates, and the builder validates that they fall inside the atlas. Atlas maps get no thumbnails.

![Image Map Builder's Flow Chart](figures/image_map_1.jpg)

## Chooser UI
A chooser returns the chosen `imagePath`. A manifest may list its subfolders with a title each (`ImageMapSubfolderTab`), which sets their order and labels; the builder fails on a listed subfolder holding no images or an image outside the list.
- `ImageMapThumbnailPanel`: a canvas's or prop's image, from one row of thumbnails of its type's subfolder, shuffled with the current image first and grown a page at a time as it is scrolled (`ImageChoiceUtil`). Beneath it, in the place of the object's tools, a search bar narrows the row to the images whose keywords hold every word typed (as typed, or singular), passing over grammatical words such as "and".
- `ImageGridChooserForm` (opened by `ImageChooser`): the subfolder's grid image as selectable cells, a tab per subfolder.
