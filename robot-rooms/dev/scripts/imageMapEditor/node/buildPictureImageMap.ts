import ImageMapBuilder from "../../../../src/server/ssg/builder/imageMapBuilder";
import { ImageMapSeeds } from "../../../../src/server/ssg/data/imageMapSeeds";

// The picture map's thumbnails and generated table, built as SSG builds them. Bundled and run by MapRebuilder,
// from the repository's root.
new ImageMapBuilder(ImageMapSeeds.PictureImageMap).build().catch((err) => {
    console.error(err);
    process.exit(1);
});
