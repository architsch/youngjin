import * as THREE from "three";
import "../../../shared/graphics/mesh/composition/instancedMeshCompositionBuilderMapDependencies.ts";
import { InstancedMeshCompositionCodecMap } from "../../../shared/graphics/mesh/composition/maps/instancedMeshCompositionCodecMap";
import { InstancedMeshCompositionParams } from "../../../shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import MaterialParamsMap from "../../../shared/graphics/material/maps/materialParamsMap";
import InstancedMeshIdMap from "../../../shared/graphics/mesh/maps/instancedMeshIdMap";
import StringUtil from "../../../shared/math/util/stringUtil";
import { INSTANCE_COLORED_MATERIAL_IDS, INSTANCED_WOOD_MATERIAL_ID } from "../../../shared/system/sharedConstants";
import GeometryFactory from "../factories/geometryFactory";
import MaterialFactory from "../factories/materialFactory";
import InstancedPartUtil from "../util/instancedPartUtil";

// Build-time only: CompositionThumbnailBuilder loads this into a headless browser to draw each
// pre-encoded composition with the game's own geometry and materials. The client app never imports it.

// Rendered larger than the cell, then downscaled, for smooth edges.
const SUPERSAMPLING = 2;

// Room left around a composition within its cell.
const FRAMING_MARGIN = 1.08;

// Roughly an unconfigured room's light, with a key light from behind the viewer in place of the head light.
const AMBIENT_INTENSITY = 1.3;
const KEY_LIGHT_INTENSITY = 1.5;

const matrixTemp = new THREE.Matrix4();
const boxTemp = new THREE.Box3();

let renderer: THREE.WebGLRenderer | undefined;

// Returns each composition's pixels (RGBA, bottom row first) as base64. The view is in degrees from
// straight in front of the compositions' +Z face (see ObjectTypeConfig's thumbnailView).
async function renderCompositionThumbnails(encodedCompositions: string[], cellSize: number,
    view: {yawDeg: number, pitchDeg: number}): Promise<string[]>
{
    const size = cellSize * SUPERSAMPLING;
    const activeRenderer = getRenderer(size);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY));
    const yaw = THREE.MathUtils.degToRad(view.yawDeg);
    const pitch = THREE.MathUtils.degToRad(view.pitchDeg);
    const viewDir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const keyLight = new THREE.DirectionalLight(0xffffff, KEY_LIGHT_INTENSITY);
    keyLight.position.copy(viewDir).add(new THREE.Vector3(-0.3, 0.4, 0));
    scene.add(keyLight);

    const root = new THREE.Object3D();
    scene.add(root);
    root.updateMatrixWorld();

    const camera = new THREE.OrthographicCamera();
    const results: string[] = [];
    for (const encoded of encodedCompositions)
    {
        const meshes = await buildMeshes(encoded, root);
        const bounds = new THREE.Box3();
        for (const mesh of meshes)
        {
            scene.add(mesh);
            expandByInstances(bounds, mesh);
        }
        frameBounds(camera, bounds, viewDir);

        activeRenderer.render(scene, camera);
        const pixels = new Uint8Array(size * size * 4);
        const gl = activeRenderer.getContext();
        gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        results.push(toBase64(pixels));

        for (const mesh of meshes)
        {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.dispose();
        }
    }
    return results;
}

function getRenderer(size: number): THREE.WebGLRenderer
{
    if (renderer == undefined)
    {
        const canvas = document.createElement("canvas");
        document.body.appendChild(canvas);
        renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: false, preserveDrawingBuffer: true});
        renderer.setPixelRatio(1);
        renderer.setClearColor(0x000000, 0);
    }
    renderer.setSize(size, size, false);
    return renderer;
}

// One instanced mesh per geometry + material, as the composer would rent them.
async function buildMeshes(encoded: string, root: THREE.Object3D): Promise<THREE.InstancedMesh[]>
{
    const codec = InstancedMeshCompositionCodecMap[StringUtil.convertVisibleASCIIToRawNumber(encoded, 0)];
    if (codec == undefined)
        throw new Error(`CompositionThumbnailRenderer :: Unknown codec (encoded = ${encoded})`);
    const params: InstancedMeshCompositionParams = {};
    const parts: InstancedMeshCompositionPart[] = [];
    codec.decode(encoded, params, parts);

    const partsByMeshId: {[instancedMeshId: string]: InstancedMeshCompositionPart[]} = {};
    for (const part of parts)
    {
        (partsByMeshId[InstancedMeshIdMap.getInstancedMeshId(part.geometryId, part.materialId)]
            ??= []).push(part);
    }

    const meshes: THREE.InstancedMesh[] = [];
    for (const instancedMeshId of Object.keys(partsByMeshId))
    {
        const group = partsByMeshId[instancedMeshId];
        const {geometryId, materialId} = group[0];
        const geometry = (await GeometryFactory.load(geometryId)).clone();
        const material = await MaterialFactory.load(MaterialParamsMap.getParamsById(materialId));

        // The per-instance attributes real meshes carry (see MeshFactory, InstancedMeshBinding).
        const mouldingColorAttrib = new THREE.InstancedBufferAttribute(new Float32Array(group.length * 3), 3);
        const mouldingParamsAttrib = new THREE.InstancedBufferAttribute(new Float32Array(group.length * 2), 2);
        geometry.setAttribute("uvStart", new THREE.InstancedBufferAttribute(new Float32Array(group.length * 2), 2));
        geometry.setAttribute("uvSampleSize", new THREE.InstancedBufferAttribute(new Float32Array(group.length * 2).fill(1), 2));
        geometry.setAttribute("mouldingColor", mouldingColorAttrib);
        geometry.setAttribute("mouldingParams", mouldingParamsAttrib);

        const mesh = new THREE.InstancedMesh(geometry, material, group.length);
        mesh.frustumCulled = false;
        group.forEach((part, instanceId) => {
            InstancedPartUtil.bakePartMatrix(root, part.offset.x, part.offset.y, part.offset.z,
                part.dir.x, part.dir.y, part.dir.z, part.scale.x, part.scale.y, part.scale.z, matrixTemp);
            mesh.setMatrixAt(instanceId, matrixTemp);
            if (INSTANCE_COLORED_MATERIAL_IDS.includes(materialId))
                InstancedPartUtil.setInstanceColor(mesh, instanceId, part.color.x, part.color.y, part.color.z);
            if (materialId == INSTANCED_WOOD_MATERIAL_ID)
            {
                InstancedPartUtil.setInstanceMoulding(mouldingColorAttrib, mouldingParamsAttrib, instanceId,
                    part.mouldingColor.x, part.mouldingColor.y, part.mouldingColor.z,
                    part.mouldingThickness, part.mouldingIsConvex);
            }
        });
        meshes.push(mesh);
    }
    return meshes;
}

function expandByInstances(bounds: THREE.Box3, mesh: THREE.InstancedMesh): void
{
    if (mesh.geometry.boundingBox == null)
        mesh.geometry.computeBoundingBox();
    for (let i = 0; i < mesh.count; ++i)
    {
        mesh.getMatrixAt(i, matrixTemp);
        bounds.union(boxTemp.copy(mesh.geometry.boundingBox!).applyMatrix4(matrixTemp));
    }
}

// Looks along -viewDir at the bounds' centre, with a square frustum just enclosing them.
function frameBounds(camera: THREE.OrthographicCamera, bounds: THREE.Box3, viewDir: THREE.Vector3): void
{
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() * 0.5, 0.001);
    camera.position.copy(center).addScaledVector(viewDir, radius * 4);
    camera.lookAt(center);
    camera.updateMatrixWorld();

    let halfExtent = 0;
    const corner = new THREE.Vector3();
    for (let i = 0; i < 8; ++i)
    {
        corner.set(
            (i & 1) ? bounds.max.x : bounds.min.x,
            (i & 2) ? bounds.max.y : bounds.min.y,
            (i & 4) ? bounds.max.z : bounds.min.z).applyMatrix4(camera.matrixWorldInverse);
        halfExtent = Math.max(halfExtent, Math.abs(corner.x), Math.abs(corner.y));
    }
    halfExtent *= FRAMING_MARGIN;

    camera.left = -halfExtent;
    camera.right = halfExtent;
    camera.top = halfExtent;
    camera.bottom = -halfExtent;
    camera.near = radius;
    camera.far = radius * 8;
    camera.updateProjectionMatrix();
}

function toBase64(bytes: Uint8Array): string
{
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize)
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    return btoa(binary);
}

(globalThis as any).renderCompositionThumbnails = renderCompositionThumbnails;
