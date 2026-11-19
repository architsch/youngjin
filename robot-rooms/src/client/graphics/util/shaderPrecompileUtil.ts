import * as THREE from "three";
import GeometryFactory from "../factories/geometryFactory";
import MaterialFactory from "../factories/materialFactory";
import MaterialParamsMap from "../../../shared/graphics/material/maps/materialParamsMap";

// Warms materials that the current room doesn't use yet (e.g. wood doors, the unlit face material),
// so their first appearance doesn't stall a frame. GraphicsManager already compiles what's in the
// scene. Shaders can't ship precompiled: WebGL has no program-binary API, and the final source
// depends on runtime state. Browsers cache programs by source, and ours is deterministic, so repeat
// visits compile nothing.

// Parameterless material types, known before any room exists.
const WARMED_UP_MATERIAL_IDS = [
    "InstancedColor",
    "InstancedTin",
    "InstancedWood",
    "InstancedEmissive",
];

// Geometry doesn't affect the compiled program.
const WARMED_UP_GEOMETRY_ID = "Square";

// Cached; later room changes find the programs already compiled.
let warmupScene: THREE.Scene | undefined;

const ShaderPrecompileUtil =
{
    // One stand-in mesh per material, compiled alongside the real scene but never drawn.
    getWarmupScene: async (): Promise<THREE.Scene> =>
    {
        if (warmupScene != undefined)
            return warmupScene;

        const scene = new THREE.Scene();
        for (const materialId of WARMED_UP_MATERIAL_IDS)
            scene.add(await createWarmupMesh(materialId));
        warmupScene = scene;
        return scene;
    },
}

// Must be an instanced mesh with an instance color, since three.js keys programs on how the object
// is drawn.
async function createWarmupMesh(materialId: string): Promise<THREE.InstancedMesh>
{
    const geometry = (await GeometryFactory.load(WARMED_UP_GEOMETRY_ID)).clone();
    const material = await MaterialFactory.load(MaterialParamsMap.getParamsById(materialId));

    // Same attributes as real meshes (see MeshFactory, InstancedMeshBinding), so it stays equivalent.
    geometry.setAttribute("uvStart", new THREE.InstancedBufferAttribute(new Float32Array(2), 2));
    geometry.setAttribute("uvSampleSize", new THREE.InstancedBufferAttribute(new Float32Array(2), 2));
    geometry.setAttribute("mouldingColor", new THREE.InstancedBufferAttribute(new Float32Array(3), 3));
    geometry.setAttribute("mouldingParams", new THREE.InstancedBufferAttribute(new Float32Array(2), 2));

    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    mesh.name = `ShaderWarmup-${materialId}`;
    // USE_INSTANCING_COLOR depends on the buffer existing.
    mesh.setColorAt(0, warmupColor);
    return mesh;
}

const warmupColor = new THREE.Color(0xffffff);

export default ShaderPrecompileUtil;
