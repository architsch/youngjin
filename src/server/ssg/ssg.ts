import FileUtil from "./util/fileUtil";
import EJSUtil from "./util/ejsUtil";
import SitemapBuilder from "./builder/sitemapBuilder";
import AtomFeedBuilder from "./builder/atomFeedBuilder";
import ArcadePageBuilder from "./builder/page/arcadePageBuilder";
import LibraryPageBuilder from "./builder/page/libraryPageBuilder";
import TextFileBuilder from "./builder/textFileBuilder";
import styleDictionary from "./style/styleDictionary";
import ErrorPageBuilder from "./builder/page/errorPageBuilder";
import PreEncodedCompositionBuilder from "./builder/preEncodedCompositionBuilder";
import InstancedMeshCapacityBuilder from "./builder/instancedMeshCapacityBuilder";
import ImageMapBuilder from "./builder/imageMapBuilder";
import CompositionThumbnailBuilder from "./builder/compositionThumbnailBuilder";
import { ArcadeData } from "./data/arcadeData";
import { LibraryData } from "./data/libraryData";
import { CANVAS_TEXTURE_CELL_SIZE } from "../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
// Capacities decode compositions, which needs the part builders registered.
import "../../shared/graphics/mesh/composition/instancedMeshCompositionBuilderMapDependencies";

// Loaded lazily by server.ts, so nothing here (sharp included, which the prod VPS CPU can't run) is part
// of the production server's startup.
export default async function SSG(): Promise<void>
{
    console.log("SSG START");

    // Generate pages

    const sitemapB = new SitemapBuilder();
    const atomFeedB = new AtomFeedBuilder();

    let tb = new TextFileBuilder();
    // The landing page links to the newest dev-log year, from the Library's list.
    const devlogEntries = LibraryData.entriesByCategory["Development History"];
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/index.ejs", {
        gameEntries: ArcadeData.gameEntries,
        latestDevlogEntry: devlogEntries[devlogEntries.length - 1],
    }));
    await tb.build("index.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/portfolio.ejs", {}));
    await tb.build("portfolio.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/portfolio_minimal.ejs", {}));
    await tb.build("portfolio_minimal.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/privacyPolicy.ejs", {}));
    await tb.build("privacy-policy.html");

    tb = new TextFileBuilder();
    tb.addLine(await EJSUtil.createStaticHTMLFromEJS("page/static/termsOfService.ejs", {}));
    await tb.build("terms-of-service.html");

    await new ArcadePageBuilder(sitemapB, atomFeedB).build();
    await new LibraryPageBuilder(sitemapB, atomFeedB).build();
    await new ErrorPageBuilder().build();

    await sitemapB.build();
    await atomFeedB.build();

    // Generate CSS

    await FileUtil.write("style.css", styleDictionary);

    // Generate Image Maps

    await new ImageMapBuilder({
        rootDirName: "voxel_texture_packs", mapName: "VoxelTexturePackImageMap",
        hasGrid: true, gridCellSize: 256, maxCols: 2,
    }).build();
    await new ImageMapBuilder({
        rootDirName: "canvas_images", mapName: "CanvasImageMap",
        hasGrid: false, thumbnailSize: CANVAS_TEXTURE_CELL_SIZE,
    }).build();

    // Generate Pre-Encoded Compositions, the mesh capacities they need, and their thumbnails

    const preEncodedCompositions = await new PreEncodedCompositionBuilder().build();
    await new InstancedMeshCapacityBuilder(preEncodedCompositions).build();
    await new CompositionThumbnailBuilder(preEncodedCompositions, process.env.MODE == "ssg").build();

    console.log("SSG END");
}