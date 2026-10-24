import * as THREE from "three";
import ImageMetadata from "../../../../shared/graphics/image/types/imageMetadata";
import ImageMapUtil from "../../../../shared/graphics/image/util/imageMapUtil";
import MaterialParamsMap from "../../../../shared/graphics/material/maps/materialParamsMap";
import FramedPanelCompositionConstants, { FRAMED_PANEL_BOARD_RELIEF, FRAMED_PANEL_CONTENT_LIFT }
    from "../../../../shared/graphics/mesh/composition/types/compositionConstants/framedPanelCompositionConstants";
import FramedPanelCompositionParams from "../../../../shared/graphics/mesh/composition/types/compositionParams/framedPanelCompositionParams";
import { InstancedMeshCompositionParams } from "../../../../shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import InstancedMeshIdMap from "../../../../shared/graphics/mesh/maps/instancedMeshIdMap";
import Vec3 from "../../../../shared/math/types/vec3";
import Geometry3DUtil from "../../../../shared/math/util/geometry3DUtil";
import Vector3DUtil from "../../../../shared/math/util/vector3DUtil";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import { ObjectCategoryEnumMap } from "../../../../shared/object/types/objectCategory";
import ObjectGroup from "../../../../shared/object/types/objectGroup";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import NpcObjectTypeConfig from "../../../../shared/object/types/objectTypeConfig/npcObjectTypeConfig";
import MirrorObjectTypeConfig, { MIRROR_COLOR_PALETTE_NAME } from "../../../../shared/object/types/objectTypeConfig/mirrorObjectTypeConfig";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import ObjectCompositionUtil from "../../../../shared/object/util/objectCompositionUtil";
import ObjectScaleUtil from "../../../../shared/object/util/objectScaleUtil";
import QuarterTurnsUtil from "../../../../shared/object/util/quarterTurnsUtil";
import { BACKWARD_DIR, COLLISION_LAYER_HEIGHT, INSTANCE_COLORED_MATERIAL_IDS,
    INSTANCED_WOOD_MATERIAL_ID } from "../../../../shared/system/sharedConstants";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import ObjectPoseUtil from "../../../object/util/objectPoseUtil";
import { ROOM_PREVIEW_VIEW_DIR } from "../../../system/clientConstants";
import MeshFactory from "../../factories/meshFactory";
import { getTurnedUV } from "../../shaders/instancedTexturePackShader";
import InstancedPartUtil from "../../util/instancedPartUtil";
import PictureLayoutUtil from "../../util/pictureLayoutUtil";
import RoomPreviewLevel from "../types/roomPreviewLevel";

// A picture's corners in its own UV, in the order a quad mesh takes them (see MeshFactory.createDetachedQuadMesh).
const QUAD_CORNER_UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];

// What an object without an image shows, as the game's placeholder texels are read (see TextureUtil).
const PLACEHOLDER_COLOR = new THREE.Color().setHex(0x282828, THREE.LinearSRGBColorSpace);

// What a mirror's glass shows in the picture, which reflects nothing (see MirrorReflectionUtil).
const GLASS_COLOR = new THREE.Color().setHex(0xaebcc6);

const matrixTemp = new THREE.Matrix4();
const vec3Temp = new THREE.Vector3();
const uvTemp = new THREE.Vector2();
const turnedUVTemp = new THREE.Vector2();

// What a room preview draws of a room's objects (see RoomPreviewUtil).
const RoomPreviewObjectUtil =
{
    // Adds the objects to the levels they are on: their composed parts, in the materials the game draws them in,
    // their pictures and mirrors' glass, but no lettering, which would be too small to read. Only what is on a face
    // turned toward the camera, as anything else would hang in the air with its back to it. loadImage gives an image's texture,
    // the same one each time, or nothing for one that can't be had. Returns the materials made here, which are the
    // caller's to dispose of.
    addObjects: async (objectGroup: ObjectGroup, levels: RoomPreviewLevel[],
        loadImage: (image: ImageMetadata) => Promise<THREE.Texture | undefined>): Promise<THREE.Material[]> =>
    {
        // Each level's parts, by the instanced mesh that draws them, with the node each is placed under.
        const placedPartsByMeshId: {[instancedMeshId: string]: {part: InstancedMeshCompositionPart, parent: THREE.Object3D}[]}[]
            = levels.map(() => ({}));
        // Each level's pictures, by the image they show ("" for the placeholder): the corners of their quads.
        const pictureQuadsByImagePath: {[imagePath: string]: {texture: THREE.Texture | undefined, positions: number[],
            normals: number[], uvs: number[]}}[] = levels.map(() => ({}));
        const pictures: Promise<void>[] = [];
        // Each level's mirrors' glass: the corners of its quads, and the color the room's one mirror gives it.
        const glassQuads: {positions: number[], normals: number[]}[] = levels.map(() => ({positions: [], normals: []}));
        let glassColor = GLASS_COLOR;

        for (const obj of Object.values(objectGroup.objectById))
        {
            const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
            if (!config.attachment) // (A volume, which draws nothing.)
                continue;
            const {normal} = Geometry3DUtil.getAxisFacingBasis(obj.transform.dir);
            if (Vector3DUtil.dot(normal, ROOM_PREVIEW_VIEW_DIR) <= 0)
                continue;
            const levelIndex = getLevelIndex(obj, normal, levels);
            const level = levels[levelIndex];

            // Posed as the game poses it (see GameObject), within its level.
            const node = new THREE.Object3D();
            ObjectPoseUtil.pose(node, true, obj.transform.pos, obj.transform.dir);
            let partParent = node;
            if (config == NpcObjectTypeConfig)
            {
                partParent = new THREE.Object3D();
                node.add(partParent);
                ObjectPoseUtil.poseNpcBody(partParent, node, obj, ObjectPoseUtil.getNpcFacing(obj));
            }
            node.updateMatrixWorld(true);

            // Its footprint on the face, and how far it stands out of it.
            const objectSize = ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, obj.transform.scale);
            for (let corner = 0; corner < 8; ++corner)
            {
                level.bounds.expandByPoint(vec3Temp.set(((corner & 1) ? 0.5 : -0.5) * objectSize.x,
                    ((corner & 2) ? 0.5 : -0.5) * objectSize.y, (corner & 4) ? objectSize.z : 0)
                    .applyMatrix4(node.matrixWorld));
            }

            const params: InstancedMeshCompositionParams = {};
            const parts: InstancedMeshCompositionPart[] = [];
            ObjectCompositionUtil.decode(obj, params, parts);
            for (const part of parts)
            {
                const instancedMeshId = InstancedMeshIdMap.getInstancedMeshId(part.geometryId, part.materialId);
                (placedPartsByMeshId[levelIndex][instancedMeshId] ??= []).push({part, parent: partParent});
            }

            if (config.category == ObjectCategoryEnumMap.Picture)
                pictures.push(addPictureQuad(obj, node, objectSize, params, pictureQuadsByImagePath[levelIndex], loadImage));
            else if (config.category == ObjectCategoryEnumMap.Mirror)
            {
                addGlassQuad(node, objectSize, params, glassQuads[levelIndex]);
                glassColor = getGlassColor(obj);
            }
        }

        for (let levelIndex = 0; levelIndex < levels.length; ++levelIndex)
        {
            for (const placedParts of Object.values(placedPartsByMeshId[levelIndex]))
                levels[levelIndex].group.add(await createPartsMesh(placedParts));
        }
        await Promise.all(pictures);

        // One material an image, however many pictures show it, and one mesh for those a level has of it.
        const materialByImagePath: {[imagePath: string]: THREE.Material} = {};
        levels.forEach((level, levelIndex) => {
            for (const [imagePath, {texture, positions, normals, uvs}] of Object.entries(pictureQuadsByImagePath[levelIndex]))
            {
                const material = (materialByImagePath[imagePath] ??= createPictureMaterial(texture));
                level.group.add(MeshFactory.createDetachedQuadMesh(new Float32Array(positions), new Float32Array(normals),
                    new Float32Array(uvs), material));
            }
        });
        const materials = Object.values(materialByImagePath);

        if (glassQuads.some(({positions}) => positions.length > 0))
        {
            const glassMaterial = createPictureMaterial(undefined, glassColor);
            levels.forEach((level, levelIndex) => {
                const {positions, normals} = glassQuads[levelIndex];
                if (positions.length > 0)
                {
                    level.group.add(MeshFactory.createDetachedQuadMesh(new Float32Array(positions),
                        new Float32Array(normals), undefined, glassMaterial));
                }
            });
            materials.push(glassMaterial);
        }
        return materials;
    },
}

// The level holding the block an object is on.
function getLevelIndex(obj: AddObjectSignal, normal: Vec3, levels: RoomPreviewLevel[]): number
{
    const supportLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(
        obj.transform.pos.y - 0.5 * COLLISION_LAYER_HEIGHT * normal.y);
    const levelIndex = levels.findIndex(level => supportLayer >= level.layerMin && supportLayer <= level.layerMax);
    return (levelIndex >= 0) ? levelIndex : levels.length - 1;
}

// One instanced mesh of the parts sharing a geometry and a material, as the composer would rent them (see
// InstancedMeshComposer). Each part is baked under the node its object is posed as.
async function createPartsMesh(placedParts: {part: InstancedMeshCompositionPart, parent: THREE.Object3D}[])
    : Promise<THREE.InstancedMesh>
{
    const {geometryId, materialId} = placedParts[0].part;
    const mesh = await MeshFactory.createDetachedInstancedMesh(geometryId,
        MaterialParamsMap.getParamsById(materialId), placedParts.length);

    // Wood parts carry their moulding as well (see InstancedMeshBinding.updateInstanceMouldingParams).
    const mouldingAttribs = (materialId != INSTANCED_WOOD_MATERIAL_ID) ? undefined : {
        color: new THREE.InstancedBufferAttribute(new Float32Array(placedParts.length * 3), 3),
        params: new THREE.InstancedBufferAttribute(new Float32Array(placedParts.length * 2), 2),
    };
    if (mouldingAttribs)
    {
        mesh.geometry.setAttribute("mouldingColor", mouldingAttribs.color);
        mesh.geometry.setAttribute("mouldingParams", mouldingAttribs.params);
    }

    placedParts.forEach(({part, parent}, instanceId) => {
        InstancedPartUtil.bakePartMatrix(parent, part.offset.x, part.offset.y, part.offset.z,
            part.dir.x, part.dir.y, part.dir.z, part.scale.x, part.scale.y, part.scale.z, matrixTemp);
        mesh.setMatrixAt(instanceId, matrixTemp);
        if (INSTANCE_COLORED_MATERIAL_IDS.includes(materialId))
            InstancedPartUtil.setInstanceColor(mesh, instanceId, part.color.x, part.color.y, part.color.z);
        if (mouldingAttribs)
        {
            InstancedPartUtil.setInstanceMoulding(mouldingAttribs.color, mouldingAttribs.params, instanceId,
                part.mouldingColor.x, part.mouldingColor.y, part.mouldingColor.z,
                part.mouldingThickness, part.mouldingIsConvex);
        }
    });
    return mesh;
}

// The picture of a canvas or a prop, laid out over its face as the game lays it out (see PictureGameObject):
// inside its frame, or over its whole footprint where it has none. Added to the quads of the image it shows.
async function addPictureQuad(obj: AddObjectSignal, node: THREE.Object3D, objectSize: Vec3,
    params: InstancedMeshCompositionParams,
    quadsByImagePath: {[imagePath: string]: {texture: THREE.Texture | undefined, positions: number[], normals: number[], uvs: number[]}},
    loadImage: (image: ImageMetadata) => Promise<THREE.Texture | undefined>): Promise<void>
{
    const imageMap = ImageMapUtil.getImageMap("PictureImageMap");
    const path = obj.metadata[ObjectMetadataKeyEnumMap.ImagePath]?.str ?? "";
    const storedImage = (path.length > 0 && imageMap.hasImagePath(path)) ? imageMap.getImageMetadataByPath(path) : undefined;
    const texture = storedImage ? await loadImage(storedImage) : undefined;
    // One whose image can't be had shows the placeholder, as one without an image does.
    const image = texture ? storedImage : undefined;

    const pictureSize = FramedPanelCompositionConstants.getInnerSize(params as FramedPanelCompositionParams, objectSize);
    const quarterTurns = QuarterTurnsUtil.getQuarterTurns(obj);
    const imageWidth = image?.width || 1;
    const imageHeight = image?.height || 1;
    const {quadSize, texelRect} = PictureLayoutUtil.getLayout(image, {x: 0, y: 0, width: imageWidth, height: imageHeight},
        pictureSize, quarterTurns);

    InstancedPartUtil.bakePartMatrix(node, 0, 0, FRAMED_PANEL_BOARD_RELIEF + FRAMED_PANEL_CONTENT_LIFT,
        BACKWARD_DIR.x, BACKWARD_DIR.y, BACKWARD_DIR.z, quadSize.x, quadSize.y, pictureSize.z, matrixTemp);
    const normal = vec3Temp.setFromMatrixColumn(node.matrixWorld, 2);
    const quads = (quadsByImagePath[image?.path ?? ""] ??= {texture, positions: [], normals: [], uvs: []});
    for (const [u, v] of QUAD_CORNER_UVS)
    {
        quads.normals.push(normal.x, normal.y, normal.z);
        quads.positions.push(...new THREE.Vector3(u - 0.5, v - 0.5, 0).applyMatrix4(matrixTemp).toArray());
        getTurnedUV(image ? quarterTurns : 0, uvTemp.set(u, v), turnedUVTemp);
        quads.uvs.push((texelRect.x + turnedUVTemp.x * texelRect.width) / imageWidth,
            (texelRect.y + turnedUVTemp.y * texelRect.height) / imageHeight);
    }
}

// A mirror's glass, where the game lays it (see MirrorGameObject): inside its frame, or over its whole footprint where
// it has none. Added to its level's glass quads.
function addGlassQuad(node: THREE.Object3D, objectSize: Vec3, params: InstancedMeshCompositionParams,
    quads: {positions: number[], normals: number[]}): void
{
    const glassSize = FramedPanelCompositionConstants.getInnerSize(params as FramedPanelCompositionParams, objectSize);
    InstancedPartUtil.bakePartMatrix(node, 0, 0, FRAMED_PANEL_BOARD_RELIEF + FRAMED_PANEL_CONTENT_LIFT,
        BACKWARD_DIR.x, BACKWARD_DIR.y, BACKWARD_DIR.z, glassSize.x, glassSize.y, glassSize.z, matrixTemp);
    const normal = vec3Temp.setFromMatrixColumn(node.matrixWorld, 2);
    for (const [u, v] of QUAD_CORNER_UVS)
    {
        quads.normals.push(normal.x, normal.y, normal.z);
        quads.positions.push(...new THREE.Vector3(u - 0.5, v - 0.5, 0).applyMatrix4(matrixTemp).toArray());
    }
}

// The glass as the picture shows it: plain, under as much of its surface's color as the mirror lays over it.
function getGlassColor(obj: AddObjectSignal): THREE.Color
{
    const rgb = ColorUtil.paletteIndexToRGB(MIRROR_COLOR_PALETTE_NAME, MirrorObjectTypeConfig.util.getColorIndex(obj));
    return GLASS_COLOR.clone().lerp(new THREE.Color().setRGB(rgb.x / 255, rgb.y / 255, rgb.z / 255, THREE.SRGBColorSpace),
        MirrorObjectTypeConfig.util.getOpacity(obj));
}

// What a picture is drawn in: over its board as the game draws it (see PictureGameObject), an image's own
// see-through texels left out; without one, the color given (the placeholder's unless told).
function createPictureMaterial(texture: THREE.Texture | undefined, color: THREE.Color = PLACEHOLDER_COLOR): THREE.Material
{
    const material = new THREE.MeshPhongMaterial(texture ? {map: texture, alphaTest: 0.5} : {color});
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
    return material;
}

export default RoomPreviewObjectUtil;
