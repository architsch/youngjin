import * as THREE from "three";
import { MIRRORED_LAYER } from "../../system/clientConstants";
import { reflectionDrawingObservable } from "../../system/clientObservables";
import AtmosphereMaterialUtil from "./atmosphereMaterialUtil";
import MirrorMaterialUtil from "./mirrorMaterialUtil";
import MirrorProjectionUtil from "./mirrorProjectionUtil";
import ShaderPrecompileUtil from "./shaderPrecompileUtil";

// The reflection is drawn into one square target this many texels a side: at most a texel to each pixel the glass
// covers on screen (see render), and fewer where it covers more pixels than that.
const TEXTURE_SIZE = 1024;

// No reflection is drawn for a camera nearer the glass's plane than this, from which it is seen edge-on.
const MIN_CAMERA_DISTANCE = 0.01;

// The instance the glass is drawn as (see MirrorGameObject); undefined while the room has no mirror.
let glass: {mesh: THREE.InstancedMesh, instanceId: number} | undefined;
let renderTarget: THREE.WebGLRenderTarget | undefined;
// Whether what the reflection is drawn with has been compiled since the glass was set (see precompile).
let programsReady = false;
let compiling = false;
let drawnLastFrame = false;

// Placed by hand each frame (see MirrorProjectionUtil.reflectCamera), never by three.js.
const reflectionCamera = new THREE.PerspectiveCamera();
reflectionCamera.matrixAutoUpdate = false;
reflectionCamera.matrixWorldAutoUpdate = false;
reflectionCamera.layers.set(MIRRORED_LAYER);

const glassMatrix = new THREE.Matrix4();
const glassPlane = new THREE.Plane();
const glassCorners = [0, 1, 2, 3].map(() => new THREE.Vector3());
const extent = new THREE.Box2();
const cameraPosition = new THREE.Vector3();
const drawingBufferSize = new THREE.Vector2();
const textureMatrix = new THREE.Matrix4();
const uvBounds = new THREE.Vector4();
const headLightLocal = new THREE.Vector3();
const headLightWorld = new THREE.Vector3();

// What a room's one mirror shows (see MirrorObjectTypeConfig): the room drawn, before it is drawn for the screen, through
// the camera reflected in the glass, into a texture the glass reads (see mirrorShader). Only the part of the view the
// glass covers on screen is drawn. What the camera alone sees is left out (see MIRRORED_LAYER), and what is hidden
// from the camera alone is drawn (see reflectionDrawingObservable).
const MirrorReflectionUtil =
{
    // The instance the glass is drawn as, or nothing once the mirror is gone.
    setGlass: (mesh: THREE.InstancedMesh | undefined, instanceId: number = -1) =>
    {
        if (mesh == undefined)
        {
            glass = undefined;
            renderTarget?.dispose();
            renderTarget = undefined;
            MirrorMaterialUtil.clearReflection();
            return;
        }
        glass = {mesh, instanceId};
        programsReady = false;
        MirrorMaterialUtil.clearReflection();
        // Stored sRGB, so that the shadows don't band (decoded as the glass reads it).
        if (renderTarget == undefined)
        {
            renderTarget = new THREE.WebGLRenderTarget(TEXTURE_SIZE, TEXTURE_SIZE, {
                colorSpace: THREE.SRGBColorSpace,
                generateMipmaps: false,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
            });
            renderTarget.scissorTest = true;
        }
    },
    // Draws what the glass shows this frame, if any of it is on screen: before the room is drawn for the screen, with
    // the camera where it is for that, and the head light (a child of the camera's) nearer the glass for it alone. The
    // density is the texels drawn to each pixel the glass covers, each way.
    render: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera,
        headLight: THREE.PointLight, density: number) =>
    {
        drawnLastFrame = false;
        if (glass == undefined || renderTarget == undefined || MirrorMaterialUtil.isSurfaceOpaque())
            return;
        // A glass shows a plain color until it is ready, rather than stalling a frame on a compile.
        if (!programsReady)
        {
            if (!compiling)
            {
                MirrorReflectionUtil.precompile(renderer, scene, camera).catch(err =>
                    console.error("MirrorReflectionUtil :: Failed to compile the reflection's shaders:", err));
            }
            return;
        }

        // Read from the mesh, so that wherever the glass is drawn (parked out of the room while hidden; see
        // InstancedMeshBinding), that is what is reflected in.
        glass.mesh.getMatrixAt(glass.instanceId, glassMatrix);
        MirrorProjectionUtil.getGlassCorners(glassMatrix, glassCorners);
        MirrorProjectionUtil.getGlassPlane(glassMatrix, glassPlane);
        camera.updateWorldMatrix(true, false);
        if (glassPlane.distanceToPoint(cameraPosition.setFromMatrixPosition(camera.matrixWorld)) < MIN_CAMERA_DISTANCE)
            return;
        if (!MirrorProjectionUtil.getVisibleExtent(camera, glassCorners, extent))
            return;

        // The part of the target drawn: the glass's extent in pixels at the density, scaled down to fit.
        renderer.getDrawingBufferSize(drawingBufferSize);
        const widthPx = 0.5 * (extent.max.x - extent.min.x) * drawingBufferSize.x;
        const heightPx = 0.5 * (extent.max.y - extent.min.y) * drawingBufferSize.y;
        // Under a pixel, as a glass far off or parked out of the room is, there is nothing to show.
        if (widthPx < 1 || heightPx < 1)
            return;
        const scale = Math.min(density, TEXTURE_SIZE / widthPx, TEXTURE_SIZE / heightPx);
        const width = Math.max(1, Math.min(TEXTURE_SIZE, Math.ceil(widthPx * scale)));
        const height = Math.max(1, Math.min(TEXTURE_SIZE, Math.ceil(heightPx * scale)));

        MirrorProjectionUtil.reflectCamera(camera, glassPlane, reflectionCamera);
        MirrorProjectionUtil.setReflectionProjection(camera, extent, glassPlane, reflectionCamera);
        MirrorProjectionUtil.getTextureMatrix(reflectionCamera, width / TEXTURE_SIZE, height / TEXTURE_SIZE,
            textureMatrix);
        uvBounds.set(0.5 / TEXTURE_SIZE, 0.5 / TEXTURE_SIZE, (width - 0.5) / TEXTURE_SIZE, (height - 0.5) / TEXTURE_SIZE);
        // The scissor keeps the clear to the part drawn.
        renderTarget.viewport.set(0, 0, width, height);
        renderTarget.scissor.set(0, 0, width, height);

        draw(renderer, scene, camera, glass.mesh, headLight);
        MirrorMaterialUtil.setReflection(renderTarget.texture, textureMatrix, uvBounds);
        drawnLastFrame = true;
    },
    // Compiles what the reflection is drawn with, so that a mirror's first reflection doesn't stall a frame: what the
    // room holds, and what may appear in it later (see ShaderPrecompileUtil). They differ from what the screen is drawn
    // with, since a render target takes linear color. Nothing without a glass.
    precompile: async (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) =>
    {
        if (glass == undefined || renderTarget == undefined)
            return;
        const target = renderTarget;
        compiling = true;
        try
        {
            const warmupScene = await ShaderPrecompileUtil.getWarmupScene();
            // Any pose will do: only how it is drawn (the target, the layers it sees) decides the programs.
            reflectionCamera.matrixWorld.copy(camera.matrixWorld);
            reflectionCamera.matrixWorldInverse.copy(camera.matrixWorldInverse);
            reflectionCamera.projectionMatrix.copy(camera.projectionMatrix);
            reflectionCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

            // The programs are made at once, for the target bound then, and only finish compiling later.
            const previousTarget = renderer.getRenderTarget();
            renderer.setRenderTarget(target);
            const compiled = Promise.all([renderer.compileAsync(scene, reflectionCamera),
                renderer.compileAsync(warmupScene, reflectionCamera, scene)]);
            renderer.setRenderTarget(previousTarget);
            await compiled;
            if (renderTarget == target)
                programsReady = true;
        }
        finally
        {
            compiling = false;
        }
    },
    // The camera the reflection was drawn through in the last frame, if one was drawn (see ParticleSystem).
    getLastCamera: (): THREE.PerspectiveCamera | undefined =>
    {
        return drawnLastFrame ? reflectionCamera : undefined;
    },
}

// The room through the reflected camera, the glass left out of its own reflection and lit by the head light from nearer
// it (see MirrorProjectionUtil.getHeadLightPosition). The sky is drawn through it too, and the screen's drawing picks up
// where it was.
function draw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera,
    glassMesh: THREE.InstancedMesh, headLight: THREE.PointLight): void
{
    const previousTarget = renderer.getRenderTarget();
    const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    glassMesh.visible = false;
    headLightLocal.copy(headLight.position);
    if (headLight.parent != null)
    {
        MirrorProjectionUtil.getHeadLightPosition(headLight.getWorldPosition(headLightWorld), glassPlane,
            headLightWorld);
        headLight.position.copy(headLight.parent.worldToLocal(headLightWorld));
    }
    AtmosphereMaterialUtil.setView(reflectionCamera);
    reflectionDrawingObservable.set(true);

    renderer.setRenderTarget(renderTarget!);
    renderer.render(scene, reflectionCamera);
    renderer.setRenderTarget(previousTarget);

    reflectionDrawingObservable.set(false);
    AtmosphereMaterialUtil.setView(camera);
    headLight.position.copy(headLightLocal);
    glassMesh.visible = true;
    renderer.shadowMap.autoUpdate = shadowAutoUpdate;
}

export default MirrorReflectionUtil;
