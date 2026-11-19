/**
 * Everyday objects at each size an image can pin a prop to, and a painting, added to the picture map for as long as
 * a suite runs, each in the subfolder of the type that shows it. Which of the shipped images are enabled is the
 * author's call (a whole tab may be disabled for review), so a test that needs an image of either kind uses these
 * rather than whatever the map holds.
 */
import { afterAll, beforeAll } from "vitest";
import ImageMap from "../../../src/shared/graphics/image/types/imageMap";
import ImageMetadata from "../../../src/shared/graphics/image/types/imageMetadata";
import ImageMapSubfolderTab from "../../../src/shared/graphics/image/types/imageMapSubfolderTab";
import ImageMapUtil from "../../../src/shared/graphics/image/util/imageMapUtil";
import "../../../src/shared/graphics/image/maps/pictureImageMap";
import { PICTURE_ATLAS_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import { CANVAS_IMAGE_SUBFOLDER } from "../../../src/shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import { PROP_IMAGE_SUBFOLDER } from "../../../src/shared/object/types/objectTypeConfig/propObjectTypeConfig";

const MAP_NAME = "PictureImageMap";

// Objects 1x1, 1x0.5 and 0.5x1 in world units, and a painting fitted to any canvas. Named apart from the numbered
// paths the map gives its own images.
export const FIXTURE_PICTURES = {
    square: `${PROP_IMAGE_SUBFOLDER}/fixture-square`,
    wide: `${PROP_IMAGE_SUBFOLDER}/fixture-wide`,
    tall: `${PROP_IMAGE_SUBFOLDER}/fixture-tall`,
    painting: `${CANVAS_IMAGE_SUBFOLDER}/fixture-painting`,
};

export function useFixturePictures(): void
{
    let shipped: ImageMap;
    beforeAll(() => {
        shipped = ImageMapUtil.getImageMap(MAP_NAME);
        const cells = (cols: number, rows: number, path: string, keywords: string): ImageMetadata => ({path, keywords,
            width: cols * PICTURE_ATLAS_CELL_SIZE, height: rows * PICTURE_ATLAS_CELL_SIZE, preserveScale: true});
        const fixtures = [
            cells(2, 2, FIXTURE_PICTURES.square, "square object"),
            cells(2, 1, FIXTURE_PICTURES.wide, "wide object"),
            cells(1, 2, FIXTURE_PICTURES.tall, "tall object"),
            {path: FIXTURE_PICTURES.painting, keywords: "painting,fixture", width: 800, height: 600},
        ];
        // Both subfolders, even one whose shipped images are all disabled (and so left out of the map).
        const names = [...new Set([...shipped.getSubfolderNames(), PROP_IMAGE_SUBFOLDER, CANVAS_IMAGE_SUBFOLDER])];
        const tabs: ImageMapSubfolderTab[] = names.map(name => ({name, title: shipped.getSubfolderTitle(name)}));
        const gridSizes = Object.fromEntries(names.map(name => [name, {numCols: 0, numRows: 0}]));
        ImageMapUtil.setImageMap(MAP_NAME, new ImageMap("pictures", shipped.getGridCellSize(), gridSizes,
            [...shipped.getImageMetadataList(), ...fixtures], undefined, shipped.getThumbnailSize(), tabs));
    });
    afterAll(() => {
        ImageMapUtil.setImageMap(MAP_NAME, shipped);
    });
}
