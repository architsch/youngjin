import InstancedTexturePackMaterialParams from "../../../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import PetCompositionConstants from "../../../../../shared/graphics/mesh/composition/types/compositionConstants/petCompositionConstants";
import PetCompositionUtil from "../../../../../shared/graphics/mesh/composition/util/petCompositionUtil";
import MeshDataUtil from "../../../../../shared/graphics/mesh/util/meshDataUtil";
import Vec3 from "../../../../../shared/math/types/vec3";
import ObjectCategoryConfigMap from "../../../../../shared/object/maps/objectCategoryConfigMap";
import { ObjectCategoryEnumMap } from "../../../../../shared/object/types/objectCategory";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import PetIdentityUtil from "../../../../../shared/object/util/petIdentityUtil";
import TexelRect from "../../../../graphics/types/texture/texelRect";
import TextureAtlas from "../../../../graphics/types/texture/textureAtlas";
import TextureAtlasRegion from "../../../../graphics/types/texture/textureAtlasRegion";
import { graphicsContextRestoredObservable } from "../../../../system/clientObservables";
import GameObject from "../../../types/gameObject/gameObject";
import PetPlateDrawUtil, { PET_PLATE_HEIGHT, PET_PLATE_SPLIT_ROW, PET_PLATE_WIDTH, PET_POWER_LABEL_HEIGHT,
    PET_POWER_LABEL_WIDTH } from "../../../util/petPlateDrawUtil";
import InstancedMeshGraphics from "../../instancedMeshGraphics";

const GEOMETRY_ID = "Square";
// One texture for every pet's printing: a cell each, a plate large.
const ATLAS_SIZE = 2048;
const NUM_ATLAS_COLS = Math.floor(ATLAS_SIZE / PET_PLATE_WIDTH);
const NUM_ATLAS_ROWS = Math.floor(ATLAS_SIZE / PET_PLATE_HEIGHT);
// Every pet's word over a battery indicator is one drawing.
const LABEL_KEY = "label";
// A plate's share of its height above where it is parted: its model and barcode print in the body's ink (see
// PetCompositionUtil.getPrintInk), the name in its box below in the label's.
const SPLIT_SHARE = PET_PLATE_SPLIT_ROW / PET_PLATE_HEIGHT;

const materialParams = new InstancedTexturePackMaterialParams("pet_plate", ATLAS_SIZE, ATLAS_SIZE,
    PET_PLATE_WIDTH, PET_PLATE_HEIGHT, "dynamicEmpty", -1, -1,
    true /* see-through around the printing */, "linear" /* lettering (see TextureFilterType) */);
// Each print is one ink, so the atlas holds only its coverage.
materialParams.coverageOnly = true;
const instancedMeshId = MeshDataUtil.getInstancedMeshId(GEOMETRY_ID, materialParams.getMaterialId());
const atlas = new TextureAtlas("the pet plate atlas", NUM_ATLAS_COLS, NUM_ATLAS_ROWS);

// What is printed on a pet's body, or on what is left of one: its model, a barcode and its name on a plate under its
// face and another on its back, and a word over each battery indicator (see PetPlateDrawUtil), drawn on the body in
// the scene, so that every pet's printing in a room is one mesh and one texture. A pet's game object owns one, and
// tells it when the pet has moved.
export default class PetNamePlate
{
    private readonly gameObject: GameObject;
    private readonly graphics: InstancedMeshGraphics;
    private readonly scrap: boolean;
    private readonly plateKey: string;
    private plateRegion: TextureAtlasRegion | undefined;
    private labelRegion: TextureAtlasRegion | undefined;
    // The plates', then the labels'; none while the pool has none to give.
    private instanceIds: number[] = [];
    private loaded: boolean = false;

    // The atlas tells each holder of one entry (see TextureAtlasHolder), so the plate and the label have one each.
    private readonly plateHolder = {onAtlasRegionChanged: (region: TextureAtlasRegion | undefined) => {
        this.plateRegion = region;
        this.place();
    }};
    private readonly labelHolder = {onAtlasRegionChanged: (region: TextureAtlasRegion | undefined) => {
        this.labelRegion = region;
        this.place();
    }};

    // scrap: whether it prints on what is left of a pet, in ink as dark as that.
    constructor(gameObject: GameObject, graphics: InstancedMeshGraphics, scrap: boolean)
    {
        this.gameObject = gameObject;
        this.graphics = graphics;
        this.scrap = scrap;
        // By who the pet is, barcode and all: what is left of it prints what it did.
        this.plateKey = `plate:${gameObject.params.metadata[ObjectMetadataKeyEnumMap.PetIdentity]?.str ?? ""}`;
    }

    async load(): Promise<void>
    {
        await this.graphics.loadInstancedMesh(GEOMETRY_ID, materialParams, getMaxPrintsPerRoom(), true);
        this.loaded = true;
        spawnedPlates.add(this);
        atlas.acquire(this.plateKey, this.plateHolder, 1, 1, this.drawPlate);
        atlas.acquire(LABEL_KEY, this.labelHolder, 1, 1, this.drawLabel);
        this.place();
    }

    dispose(): void
    {
        if (!this.loaded)
            return;
        this.loaded = false;
        spawnedPlates.delete(this);
        atlas.release(this.plateKey, this.plateHolder);
        atlas.release(LABEL_KEY, this.labelHolder);
        for (const instanceId of this.instanceIds)
            this.graphics.returnInstanceToPool(instancedMeshId, instanceId);
        this.instanceIds = [];
    }

    // Puts the printing where the body now is: after every move of it.
    place(): void
    {
        if (!this.loaded || this.plateRegion == undefined || this.labelRegion == undefined)
            return;
        const C = PetCompositionConstants;
        const plateTexels = getTexels(this.plateRegion, PET_PLATE_WIDTH, PET_PLATE_HEIGHT);
        const labelTexels = getTexels(this.labelRegion, PET_POWER_LABEL_WIDTH, PET_POWER_LABEL_HEIGHT);
        const modelInk = this.scrap ? C.scrapInkColor
            : PetCompositionUtil.getPrintInk(PetIdentityUtil.getBodyColor(PetIdentityUtil.getObjectIdentity(
                this.gameObject.params)));
        // Texels count up from the bottom of a drawing, which is drawn top down.
        const prints = [
            ...PetCompositionUtil.getPlates().flatMap(plate => [
                {print: getBand(plate, 0, SPLIT_SHARE), ink: modelInk, texels: {...plateTexels,
                    y: plateTexels.y + PET_PLATE_HEIGHT - PET_PLATE_SPLIT_ROW, height: PET_PLATE_SPLIT_ROW}},
                {print: getBand(plate, SPLIT_SHARE, 1), ink: this.scrap ? C.scrapInkColor : C.inkColor,
                    texels: {...plateTexels, height: PET_PLATE_HEIGHT - PET_PLATE_SPLIT_ROW}},
            ]),
            ...PetCompositionUtil.getBatteryLabels().map(label => ({print: label, texels: labelTexels,
                ink: this.scrap ? C.scrapInkColor : C.batteryLabelColor})),
        ];
        if (!this.rentInstances(prints.length))
            return;
        prints.forEach(({print, texels, ink}, i) => this.placePrint(this.instanceIds[i], print, texels, ink));
    }

    // So whole-object actions (e.g. occlusion hiding) also reach the printing (see OrbitOcclusionHider).
    forEachInstance(visit: (instancedMeshId: string, instanceId: number) => void): void
    {
        for (const instanceId of this.instanceIds)
            visit(instancedMeshId, instanceId);
    }

    private placePrint(instanceId: number, print: {offset: Vec3, dir: Vec3, size: Vec3}, texels: TexelRect, ink: Vec3): void
    {
        this.graphics.updateInstanceTransform(instancedMeshId, instanceId, print.offset.x, print.offset.y, print.offset.z,
            print.dir.x, print.dir.y, print.dir.z, print.size.x, print.size.y, 1);
        this.graphics.updateInstanceTextureRect(instancedMeshId, instanceId, texels.x, texels.y, texels.width,
            texels.height);
        this.graphics.updateInstanceColor(instancedMeshId, instanceId, ink.x, ink.y, ink.z);
    }

    // All of them or none: whether it has them.
    private rentInstances(count: number): boolean
    {
        while (this.instanceIds.length < count)
        {
            const instanceId = this.graphics.rentInstanceFromPool(instancedMeshId);
            if (instanceId == undefined)
                return false;
            this.instanceIds.push(instanceId);
        }
        return true;
    }

    private readonly drawPlate = (region: TextureAtlasRegion): void =>
    {
        const {name} = PetIdentityUtil.getObjectIdentity(this.gameObject.params);
        this.graphics.drawCanvasAtTexel(instancedMeshId, region.col * PET_PLATE_WIDTH, region.row * PET_PLATE_HEIGHT,
            PetPlateDrawUtil.drawPlate(name, this.plateKey));
    }

    private readonly drawLabel = (region: TextureAtlasRegion): void =>
    {
        this.graphics.drawCanvasAtTexel(instancedMeshId, region.col * PET_PLATE_WIDTH, region.row * PET_PLATE_HEIGHT,
            PetPlateDrawUtil.drawPowerLabel());
    }
}

// The texels a drawing of that size takes of its cell, from the cell's bottom left.
function getTexels(region: TextureAtlasRegion, width: number, height: number): TexelRect
{
    return {x: region.col * PET_PLATE_WIDTH, y: region.row * PET_PLATE_HEIGHT, width, height};
}

// The band of an upright print between two shares of its height, counted from its top.
function getBand(print: {offset: Vec3, dir: Vec3, size: Vec3}, fromTop: number, toTop: number):
    {offset: Vec3, dir: Vec3, size: Vec3}
{
    const {offset, dir, size} = print;
    return {offset: {...offset, y: offset.y + (0.5 - 0.5 * (fromTop + toTop)) * size.y}, dir,
        size: {...size, y: (toTop - fromTop) * size.y}};
}

// Every pet a room can hold at once, living or scrap, prints its own: each plate in two parts.
function getMaxPrintsPerRoom(): number
{
    const printsPerPet = 2 * PetCompositionUtil.getPlates().length + PetCompositionUtil.getBatteryLabels().length;
    return printsPerPet * [ObjectCategoryEnumMap.Pet, ObjectCategoryEnumMap.ServerPet, ObjectCategoryEnumMap.PetScrap]
        .reduce((count, category) => count + ObjectCategoryConfigMap.getMaxCountPerRoom(category), 0);
}

const spawnedPlates: Set<PetNamePlate> = new Set();

// The printing lives only in a render target (GPU), so all of it is drawn again after a context restore (as labels
// are).
graphicsContextRestoredObservable.addListener("petNamePlate", () => {
    if (spawnedPlates.size > 0)
        atlas.redrawAll();
});
