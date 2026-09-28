import GameObject from "./gameObject";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import InstancedMeshGraphics from "../../components/instancedMeshGraphics";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import InstancedTexturePackMaterialParams from "../../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import ObjectCategoryConfigMap from "../../../../shared/object/maps/objectCategoryConfigMap";
import { FRAMED_PANEL_BOARD_RELIEF, FRAMED_PANEL_CONTENT_LIFT,
    FRAMED_PANEL_GEOMETRY_ID } from "../../../../shared/graphics/mesh/composition/types/compositionConstants/framedPanelCompositionConstants";
import { BACKWARD_DIR, PICTURE_ATLAS_CELL_SIZE, PICTURE_ATLAS_CELL_WORLD_SIZE, PICTURE_ATLAS_MAX_REGION_CELLS,
    PICTURE_ATLAS_SIZE } from "../../../../shared/system/sharedConstants";
import Vec3 from "../../../../shared/math/types/vec3";
import App from "../../../app";
import ImageMapUtil from "../../../../shared/graphics/image/util/imageMapUtil";
import ImageMetadata from "../../../../shared/graphics/image/types/imageMetadata";
import MeshDataUtil from "../../../../shared/graphics/mesh/util/meshDataUtil";
import { graphicsContextRestoredObservable } from "../../../system/clientObservables";
import QuarterTurnsUtil from "../../../../shared/object/util/quarterTurnsUtil";
import TextureAtlas from "../../../graphics/types/texture/textureAtlas";
import TextureAtlasHolder from "../../../graphics/types/texture/textureAtlasHolder";
import TextureAtlasRegion from "../../../graphics/types/texture/textureAtlasRegion";
import TextureAtlasLayout from "../../../graphics/types/texture/textureAtlasLayout";
import TexelRect from "../../../graphics/types/texture/texelRect";
import TextureAtlasLayoutUtil from "../../../graphics/util/textureAtlasLayoutUtil";

const NUM_ATLAS_CELLS_PER_SIDE = PICTURE_ATLAS_SIZE / PICTURE_ATLAS_CELL_SIZE;
const PIXELS_PER_WORLD_UNIT = PICTURE_ATLAS_CELL_SIZE / PICTURE_ATLAS_CELL_WORLD_SIZE;


// What an object without an image shows, keyed apart from any image path.
const PLACEHOLDER_KEY = "#placeholder";

// How far below its object a picture with nothing drawn for it yet waits, out of sight.
const PARKED_OFFSET = -9999;

// One region per image, shared by every picture showing it, and never larger than the largest image that keeps
// its scale. When the room's images outgrow it, the one that doesn't fit is drawn smaller rather than left out.
const atlas = new TextureAtlas("the picture atlas", NUM_ATLAS_CELLS_PER_SIDE, NUM_ATLAS_CELLS_PER_SIDE,
    {shrinkWhenFull: true, maxRegionSide: PICTURE_ATLAS_MAX_REGION_CELLS});

// An object showing an image of the picture map (see PictureImageMap), as a picture over its face: the image's
// region of the room's picture atlas, laid out in the picture's extent (see getPictureSize) and turned there by
// its QuarterTurns.
export default abstract class PictureGameObject extends GameObject implements TextureAtlasHolder
{
    instancedMeshGraphics: InstancedMeshGraphics;
    static materialParams: InstancedTexturePackMaterialParams | undefined; // Caching mechanism to minimize computational burden (by preventing repetitive initialization of params)
    static instancedMeshId: string; // Caching mechanism to minimize computational burden (by preventing repetitive initialization of the string)

    private instanceId: number = -1;

    // The atlas key it holds (its image's path, or the placeholder's), and where that is drawn.
    private imageKey: string | undefined;
    private region: TextureAtlasRegion | undefined;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error(`${this.config.objectType} requires InstancedMeshGraphics component`);

        if (PictureGameObject.materialParams == undefined)
        {
            // Polygon offset beyond a canvas board's (wood draws at -1; see the "InstancedWood" material), on
            // top of the picture's real gap in front of it (see FRAMED_PANEL_CONTENT_LIFT).
            PictureGameObject.materialParams = new InstancedTexturePackMaterialParams("picture_texture_pack",
                PICTURE_ATLAS_SIZE, PICTURE_ATLAS_SIZE, PICTURE_ATLAS_CELL_SIZE, PICTURE_ATLAS_CELL_SIZE,
                "dynamicEmpty", -2, -2, false, "linear");
            // An image's own transparent pixels show the board, or the face behind.
            PictureGameObject.materialParams.alphaCutout = true;
            PictureGameObject.materialParams.turnable = true;
            PictureGameObject.instancedMeshId = MeshDataUtil.getInstancedMeshId(
                FRAMED_PANEL_GEOMETRY_ID, PictureGameObject.materialParams.getMaterialId());
        }
    }

    async onSpawn(): Promise<void>
    {
        if (PictureGameObject.materialParams == undefined)
            throw new Error(`Picture material hasn't been defined yet.`);
        await super.onSpawn();

        // Canvases and props share the mesh, as they share their cap.
        await this.instancedMeshGraphics.loadInstancedMesh(FRAMED_PANEL_GEOMETRY_ID,
            PictureGameObject.materialParams, ObjectCategoryConfigMap.getMaxCountPerRoom(this.config.category), true);

        // An exhausted pool leaves this object's picture unrendered.
        const rentedInstanceId = this.instancedMeshGraphics.rentInstanceFromPool(PictureGameObject.instancedMeshId);
        if (rentedInstanceId == undefined)
            return;

        this.instanceId = rentedInstanceId;
        this.updatePicture();
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();
        if (this.imageKey != undefined)
            atlas.release(this.imageKey, this);
        this.imageKey = undefined;
        this.region = undefined;

        // -1 if it never got an instance.
        if (this.instanceId !== -1)
            this.instancedMeshGraphics.returnInstanceToPool(PictureGameObject.instancedMeshId, this.instanceId);
        this.instanceId = -1;
    }

    onTransformChanged(resized: boolean): void
    {
        super.onTransformChanged(resized);
        this.updatePicture();
    }

    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key === ObjectMetadataKeyEnumMap.ImagePath || key === ObjectMetadataKeyEnumMap.QuarterTurns)
            this.updatePicture();
    }

    forEachOwnedInstance(visit: (instancedMeshId: string, instanceId: number) => void)
    {
        if (this.instanceId !== -1)
            visit(PictureGameObject.instancedMeshId, this.instanceId);
    }

    onAtlasRegionChanged(region: TextureAtlasRegion | undefined): void
    {
        this.region = region;
        this.placePicture();
    }

    // The extent the picture is laid out in (see TextureAtlasLayoutUtil), in world units.
    protected abstract getPictureSize(): Vec3;

    // Holds its image's atlas entry at the size it now needs, and places the picture. A turn, resize or frame
    // change only moves texture coordinates here; the atlas redraws only for a region of another size.
    protected updatePicture(): void
    {
        if (this.instanceId === -1)
            return;
        const image = this.getImage();
        const key = image?.path ?? PLACEHOLDER_KEY;
        if (key !== this.imageKey)
        {
            if (this.imageKey != undefined)
                atlas.release(this.imageKey, this);
            this.imageKey = key;
            this.region = undefined;
        }
        const {numCols, numRows} = this.getNumCellsNeeded(image);
        atlas.acquire(key, this, numCols, numRows, (region, isCurrent) => drawImage(key, region, isCurrent));
        this.placePicture();
    }

    // Placed on its face, in front of whatever the object draws there (as a door's label sits in front of its
    // plate); out of sight while its image has nothing drawn yet.
    private placePicture(): void
    {
        if (this.instanceId === -1)
            return;
        if (this.region == undefined)
        {
            this.instancedMeshGraphics.updateInstanceTransform(PictureGameObject.instancedMeshId, this.instanceId,
                0, PARKED_OFFSET, 0, BACKWARD_DIR.x, BACKWARD_DIR.y, BACKWARD_DIR.z);
            return;
        }

        const pictureSize = this.getPictureSize();
        const quarterTurns = QuarterTurnsUtil.getQuarterTurns(this.params);
        const {quadSize, texelRect} = getPictureLayout(this.getImage(), this.region, pictureSize, quarterTurns);
        this.instancedMeshGraphics.updateInstanceTransform(
            PictureGameObject.instancedMeshId, this.instanceId,
            0, 0, FRAMED_PANEL_BOARD_RELIEF + FRAMED_PANEL_CONTENT_LIFT, BACKWARD_DIR.x, BACKWARD_DIR.y, BACKWARD_DIR.z,
            quadSize.x, quadSize.y, pictureSize.z);
        this.instancedMeshGraphics.updateInstanceTextureRect(PictureGameObject.instancedMeshId, this.instanceId,
            texelRect.x, texelRect.y, texelRect.width, texelRect.height);
        this.instancedMeshGraphics.updateInstanceTextureTurns(PictureGameObject.instancedMeshId, this.instanceId,
            quarterTurns);
    }

    // An image that keeps its scale needs its own cells; any other, the cells it covers once fitted into the
    // picture, in its own (unturned) axes, so its region grows with the picture (up to the atlas's cap).
    private getNumCellsNeeded(image: ImageMetadata | undefined): {numCols: number, numRows: number}
    {
        if (image == undefined)
            return {numCols: 1, numRows: 1};
        if (image.preserveScale && image.width && image.height)
            return {numCols: image.width / PICTURE_ATLAS_CELL_SIZE, numRows: image.height / PICTURE_ATLAS_CELL_SIZE};

        const pictureSize = this.getPictureSize();
        const quarterTurns = QuarterTurnsUtil.getQuarterTurns(this.params);
        const {quadSize} = TextureAtlasLayoutUtil.getLayout(pictureSize,
            {x: 0, y: 0, width: image.width ?? 1, height: image.height ?? 1}, "fit", quarterTurns);
        const turned = quarterTurns % 2 != 0;
        return {
            numCols: TextureAtlasLayoutUtil.getNumCells(turned ? quadSize.y : quadSize.x, PICTURE_ATLAS_CELL_WORLD_SIZE),
            numRows: TextureAtlasLayoutUtil.getNumCells(turned ? quadSize.x : quadSize.y, PICTURE_ATLAS_CELL_WORLD_SIZE),
        };
    }

    // Undefined for an object without an image, or with one no longer on offer.
    private getImage(): ImageMetadata | undefined
    {
        const path = this.params.metadata[ObjectMetadataKeyEnumMap.ImagePath]?.str ?? "";
        const imageMap = ImageMapUtil.getImageMap("PictureImageMap");
        return (path.length > 0 && imageMap.hasImagePath(path)) ? imageMap.getImageMetadataByPath(path) : undefined;
    }
}

// Where the picture of an image (or the placeholder, which fills it) goes, from the region it is drawn in.
function getPictureLayout(image: ImageMetadata | undefined, region: TextureAtlasRegion, pictureSize: Vec3,
    quarterTurns: number): TextureAtlasLayout
{
    const texels = getImageTexels(image, region);
    if (image == undefined)
        return TextureAtlasLayoutUtil.getLayout(pictureSize, texels, "fill", 0);
    if (image.preserveScale && image.width && image.height)
    {
        return TextureAtlasLayoutUtil.getLayout(pictureSize, texels, "preserve", quarterTurns,
            {x: image.width / PIXELS_PER_WORLD_UNIT, y: image.height / PIXELS_PER_WORLD_UNIT});
    }
    return TextureAtlasLayoutUtil.getLayout(pictureSize, texels, "fit", quarterTurns);
}

// The part of the region an image is drawn over, or all of it for the placeholder.
function getImageTexels(image: ImageMetadata | undefined, region: TextureAtlasRegion): TexelRect
{
    if (image == undefined)
    {
        return {x: region.col * PICTURE_ATLAS_CELL_SIZE, y: region.row * PICTURE_ATLAS_CELL_SIZE,
            width: region.numCols * PICTURE_ATLAS_CELL_SIZE, height: region.numRows * PICTURE_ATLAS_CELL_SIZE};
    }
    const aspect = (image.width && image.height) ? image.width / image.height : 1;
    return TextureAtlasLayoutUtil.getFittedTexels(aspect, region, PICTURE_ATLAS_CELL_SIZE);
}

// The atlas's draw for an image (see TextureAtlasDraw), from its thumbnail when that is large enough; the
// placeholder is drawn instead of an image that fails to load.
async function drawImage(key: string, region: TextureAtlasRegion, isCurrent: () => boolean): Promise<void>
{
    const imageMap = ImageMapUtil.getImageMap("PictureImageMap");
    const image = (key != PLACEHOLDER_KEY) ? imageMap.getImageMetadataByPath(key) : undefined;
    const texels = getImageTexels(image, region);
    const assetsURL = App.getEnv().assets_url;
    const thumbnailSize = imageMap.getThumbnailSize();
    const imageURL = (image == undefined) ? ""
        : (Math.max(texels.width, texels.height) <= thumbnailSize)
            ? imageMap.getThumbnailURLByPath(assetsURL, key)
            : imageMap.getImageURLByPath(assetsURL, key);
    try
    {
        await InstancedMeshGraphics.drawImageAtTexel(PictureGameObject.instancedMeshId,
            texels.x, texels.y, texels.width, texels.height, imageURL, isCurrent);
    }
    catch (error)
    {
        console.warn(`Failed to load a picture (path = ${key}):`, error);
        await InstancedMeshGraphics.drawImageAtTexel(PictureGameObject.instancedMeshId,
            texels.x, texels.y, texels.width, texels.height, "", isCurrent);
    }
}

// The picture atlas lives only in a render target (GPU), so every image is redrawn after a context restore.
graphicsContextRestoredObservable.addListener("pictureGameObject", () => atlas.redrawAll());
