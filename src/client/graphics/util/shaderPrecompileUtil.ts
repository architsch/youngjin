import * as THREE from "three";
import GeometryFactory from "../factories/geometryFactory";
import MaterialFactory from "../factories/materialFactory";
import MaterialParamsMap from "../../../shared/graphics/material/maps/materialParamsMap";

// Pays every material's one-time shader cost while the loading screen is still up, so that nothing
// stalls the frame it is first needed in.
//
// **A shader program cannot be shipped ready-made**, and it is worth being precise about why, because
// putting one in the bundle is the obvious thing to reach for. Two quite different stages hide behind
// the word "compile":
//
//   1. **Building the source.** Our own splices, three.js's `#include` resolution, and the block of
//      `#define`s in front of it. This is string work in JS, and it costs microseconds.
//   2. **Turning that source into something the GPU runs** — `compileShader` and `linkProgram`, done
//      by the graphics driver. This is essentially all of the cost.
//
// The second cannot leave the browser at all. WebGL exposes no way to hand a driver a program binary:
// the `glProgramBinary` of native OpenGL ES was deliberately left out, since such a binary is specific
// to one GPU model *and* one driver revision — there is no portable thing a build step could compile
// *to*. (WebGPU is no different: it takes shader text.) So there is no file to put in the bundle and
// no call that would accept one.
//
// Moving the first to build time is possible and pointless: what the driver is finally handed depends
// on state that only exists at runtime — how many lights the scene holds, whether it is fogged, and
// whether the object drawing it is instanced and carries an instance color — so only the half in
// front of those could be baked, and that half is the microseconds.
//
// So "precompiled" here can only mean *compiled early*, never *compiled elsewhere*. What is genuinely
// bought back beyond that is the second visit: browsers keep their own on-disk cache of compiled
// programs keyed by the source they came from, and the source this repo produces is assembled once
// when its modules are evaluated, out of constants — byte-identical from one load to the next — so a
// returning player compiles nothing.
//
// Compiling early is worth a great deal even on a first visit, because the alternative is not "a
// little slower" but a frozen frame in the middle of play — the moment a door is first opened, the
// moment another player first walks in.
//
// The remaining lever, if this ever stops being enough, is to compile *fewer programs* rather than to
// compile them sooner: the instanced materials each carry a full lit shader of their own, and could
// be merged into one that branches per instance. That trades a real cost per fragment against a
// one-time cost per session, so it is a change to make against a measurement rather than on principle.
//
// Three.js already compiles whatever is standing in the scene (GraphicsManager.precompileSceneShaders),
// and that covers a room's voxels and everything spawned in it. What it cannot cover is a material no
// object in *this* room happens to use yet — a wooden door in a room that has none, the unlit finish
// a player's face is painted in when nobody else has arrived. Those are what this module warms.

// The material types composed objects are drawn with. Every one of them is parameterless, so the
// whole set is known before any room exists — which is what makes warming them possible at all.
const WARMED_UP_MATERIAL_IDS = [
    "InstancedColor",
    "InstancedTin",
    "InstancedWood",
    "InstancedEmissive",
];

// The geometry the warm-up meshes are cut from. Which one it is does not matter to the compiler —
// what decides the shader program is the material and the kind of object drawing it, not the
// vertices — so this is simply the shape most of the game is built out of.
const WARMED_UP_GEOMETRY_ID = "Square";

// Held rather than rebuilt, so that a second room change costs nothing: the programs are already
// compiled by then, and re-running this would only ask three.js to confirm it.
let warmupScene: THREE.Scene | undefined;

const ShaderPrecompileUtil =
{
    // A scene holding one stand-in mesh per material that would otherwise wait for its first use.
    // Handed to the renderer alongside the real scene, never drawn.
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

// One instance of one quad, standing in for every mesh that will ever be drawn with this material.
//
// It has to be an *instanced* mesh carrying an instance color, because three.js keys a compiled
// program partly on how the object is drawn: a plain mesh and an instanced one are two programs, and
// warming the wrong one would leave the real stall exactly where it was.
async function createWarmupMesh(materialId: string): Promise<THREE.InstancedMesh>
{
    const geometry = (await GeometryFactory.load(WARMED_UP_GEOMETRY_ID)).clone();
    const material = await MaterialFactory.load(MaterialParamsMap.getParamsById(materialId));

    // The per-instance attributes the real meshes carry (see MeshFactory and InstancedMeshBinding).
    // The shaders declare them regardless, so their absence would compile just as well — they are
    // here so that a warm-up mesh is the same object a real one is, and stays so as attributes are
    // added.
    geometry.setAttribute("uvStart", new THREE.InstancedBufferAttribute(new Float32Array(2), 2));
    geometry.setAttribute("uvSampleSize", new THREE.InstancedBufferAttribute(new Float32Array(2), 2));
    geometry.setAttribute("mouldingColor", new THREE.InstancedBufferAttribute(new Float32Array(3), 3));
    geometry.setAttribute("mouldingParams", new THREE.InstancedBufferAttribute(new Float32Array(2), 2));

    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    mesh.name = `ShaderWarmup-${materialId}`;
    // What actually defines USE_INSTANCING_COLOR: three.js looks at whether the instance color buffer
    // exists, not at what is in it.
    mesh.setColorAt(0, warmupColor);
    return mesh;
}

const warmupColor = new THREE.Color(0xffffff);

export default ShaderPrecompileUtil;
