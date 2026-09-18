import * as THREE from "three";
import RoomPrefsUtil from "../../../shared/room/util/roomPrefsUtil";
import Vec3 from "../../../shared/math/types/vec3";
import installSkyShader from "../shaders/skyShader";
import ValueNoiseTextureUtil from "./valueNoiseTextureUtil";
import { VALUE_NOISE_FBM_PERIOD } from "../shaders/valueNoiseGLSL";
import { ATMOSPHERE_CLOUD_DRIFT, ATMOSPHERE_FOG_FRAGMENT_GLSL, ATMOSPHERE_FOG_FRAGMENT_PARS_GLSL,
    ATMOSPHERE_FOG_LAMP_TINT, ATMOSPHERE_FOG_VERTEX_GLSL, ATMOSPHERE_FOG_VERTEX_PARS_GLSL,
    ATMOSPHERE_SMOKE_CHURN } from "../shaders/atmosphereGLSL";
import LightBlockMapMaterialUtil from "../light/util/lightBlockMapMaterialUtil";

// Room air: the sky mesh, shared atmosphere uniforms, and cloud/smoke drift. Shader logic is in
// atmosphereGLSL. Uniforms live here (not GraphicsManager) to avoid an import cycle.

// Uniform holders are never replaced (three.js re-reads "value" each frame). Initialized to the
// unconfigured room's values, because a zero scale is degenerate.
const atmosphereCloudsUniform = { value: defaultCloudsVector() };
const atmosphereCloudColorUniform = { value: new THREE.Color(0, 0, 0) };
// Ground (sky only). Nonzero default scale for the same reason.
const atmosphereGroundColorUniform = { value: new THREE.Color(0, 0, 0) };
const atmospherePeakColorUniform = { value: new THREE.Color(0, 0, 0) };
const atmosphereGroundUniform = { value: defaultGroundVector() };
// Smoke (every fogged material and the sky).
const atmosphereSmokeUniform = { value: defaultSmokeVector() };
// How much lamps tint the fog, zero until the room has a lamp at all (see setRoomHasLamps).
const atmosphereFogLampTintUniform = { value: 0 };
// Running drift totals in noise units, wrapped (see update).
const atmosphereCloudDriftUniform = { value: new THREE.Vector3() };
const atmosphereSmokeTravelUniform = { value: new THREE.Vector3() };
const atmosphereSmokeChurnUniform = { value: new THREE.Vector3() };
const skyColorUniform = { value: new THREE.Color(0, 0, 0) };
const skyInverseProjectionUniform = { value: new THREE.Matrix4() };
// Far plane depth: the sky is never fogged beyond it (see the sky shader).
const skyFarDepthUniform = { value: 0 };

// Speeds advance the drifts each frame; shaders never read speeds.
let cloudSpeed = 0;
let cloudScale = 0;
let smokeSpeed = 0;
let smokeScale = 0;
const smokeDirection = new THREE.Vector3();

// When the drifts were last advanced, in seconds, or nothing before the first frame has been drawn.
let lastUpdateTime = 0;

// The sky draws last among opaque objects: it is the most expensive per-pixel surface, and with
// depth testing at the far plane, pixels already covered by walls are discarded before shading. It
// writes no depth.
const SKY_RENDER_ORDER = 1000;

const AtmosphereMaterialUtil =
{
    // Created once and kept for the app's lifetime.
    createSkyMesh: (): THREE.Mesh =>
    {
        // Unlit; fogged only to receive the scene's fog uniforms (the sky shader computes its own
        // coverage). Depth-tested but not depth-writing (see SKY_RENDER_ORDER).
        const material = new THREE.MeshBasicMaterial({
            depthWrite: false,
            fog: true,
            // Vertices are written in clip space, so facing is meaningless.
            side: THREE.DoubleSide,
        });
        material.onBeforeCompile = (shader) =>
        {
            shader.uniforms.atmosphereClouds = atmosphereCloudsUniform;
            shader.uniforms.atmosphereCloudDrift = atmosphereCloudDriftUniform;
            shader.uniforms.atmosphereCloudColor = atmosphereCloudColorUniform;
            shader.uniforms.atmosphereGroundColor = atmosphereGroundColorUniform;
            shader.uniforms.atmospherePeakColor = atmospherePeakColorUniform;
            shader.uniforms.atmosphereGroundShape = atmosphereGroundUniform;
            bindSmokeUniforms(shader);
            bindFogTintUniforms(shader);
            shader.uniforms.skyColor = skyColorUniform;
            shader.uniforms.skyInverseProjection = skyInverseProjectionUniform;
            shader.uniforms.skyFarDepth = skyFarDepthUniform;
            installSkyShader(shader);
        };
        // onBeforeCompile changes don't affect three.js's cache key (see MaterialFactory).
        material.customProgramCacheKey = () => "Sky";

        // Spans clip space, so the vertex stage uses positions as-is.
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        mesh.name = "Sky";
        mesh.renderOrder = SKY_RENDER_ORDER;
        // Vertices bypass the projection, so frustum culling doesn't apply.
        mesh.frustumCulled = false;
        return mesh;
    },

    // Adds smoke to a material's fog (chained onto onBeforeCompile). Inert on unfogged materials
    // (USE_FOG guards). Clouds and land are sky-only and never bound here.
    addFogNoise<T extends THREE.Material>(material: T): T
    {
        const existingOnBeforeCompile = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) =>
        {
            existingOnBeforeCompile.call(material, shader, renderer);

            ValueNoiseTextureUtil.bindUniform(shader);
            bindSmokeUniforms(shader);
            bindFogTintUniforms(shader);

            shader.vertexShader = ATMOSPHERE_FOG_VERTEX_PARS_GLSL + shader.vertexShader;
            // Where three.js computes fog depth, after the position is resolved.
            shader.vertexShader = shader.vertexShader.replace(
                "#include <fog_vertex>",
                `
                #include <fog_vertex>
                ${ATMOSPHERE_FOG_VERTEX_GLSL}
                `
            );

            shader.fragmentShader = ATMOSPHERE_FOG_FRAGMENT_PARS_GLSL + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <fog_fragment>",
                ATMOSPHERE_FOG_FRAGMENT_GLSL
            );
        };
        return material;
    },

    // Sky color where nothing covers it. Fog is layered over it separately by the sky shader.
    setSkyColor: (color: THREE.Color) =>
    {
        skyColorUniform.value.copy(color);
    },

    // Whether lamps brighten the fog around them (see atmosphereGLSL). A room with no lamps has
    // nothing to tint it with, so the whole sample is skipped on a uniform, whole-frame branch.
    setRoomHasLamps: (roomHasLamps: boolean) =>
    {
        atmosphereFogLampTintUniform.value = roomHasLamps ? ATMOSPHERE_FOG_LAMP_TINT : 0;
    },

    // Set together: one description of the room's air.
    setSmoke: (amplitude: number, scale: number, speed: number, drift: Vec3) =>
    {
        atmosphereSmokeUniform.value.set(scale, amplitude);
        smokeSpeed = speed;
        smokeScale = scale;
        smokeDirection.set(drift.x, drift.y, drift.z);
    },

    // Set together (see RoomPrefsUtil).
    setClouds: (color: THREE.Color, opacity: number, scale: number, softness: number,
        speed: number) =>
    {
        atmosphereCloudColorUniform.value.copy(color);
        atmosphereCloudsUniform.value.set(scale, opacity, softness);
        cloudSpeed = speed;
        cloudScale = scale;
    },

    // Picking the air's color for both land colors (or zero solidity) yields no visible land.
    setGround: (color: THREE.Color, peakColor: THREE.Color, scale: number, solidity: number,
        softness: number) =>
    {
        atmosphereGroundColorUniform.value.copy(color);
        atmospherePeakColorUniform.value.copy(peakColor);
        atmosphereGroundUniform.value.set(scale, solidity, softness);
    },

    // Per frame: advances drifts and uploads the inverse projection and far depth (view matrix and
    // camera position come from three.js at draw time, so they're never a frame stale).
    // Drift is a running total, not clock × speed, so speed changes don't jump the field; it is
    // wrapped at VALUE_NOISE_FBM_PERIOD (seamless) to keep float precision.
    update: (camera: THREE.PerspectiveCamera) =>
    {
        const now = performance.now() * 0.001;
        const elapsed = (lastUpdateTime > 0) ? now - lastUpdateTime : 0;
        lastUpdateTime = now;

        advanceDrift(atmosphereCloudDriftUniform.value, ATMOSPHERE_CLOUD_DRIFT,
            cloudSpeed * cloudScale * elapsed);
        const smokeDistance = smokeSpeed * smokeScale * elapsed;
        advanceDrift(atmosphereSmokeTravelUniform.value, smokeDirection, smokeDistance);
        advanceDrift(atmosphereSmokeChurnUniform.value, smokeDirection,
            smokeDistance * (1 - ATMOSPHERE_SMOKE_CHURN));

        skyInverseProjectionUniform.value.copy(camera.projectionMatrixInverse);
        skyFarDepthUniform.value = camera.far;
    },
}

// Shared by fogged materials and the sky.
function bindSmokeUniforms(shader: THREE.WebGLProgramParametersWithUniforms)
{
    shader.uniforms.atmosphereSmoke = atmosphereSmokeUniform;
    shader.uniforms.atmosphereSmokeTravel = atmosphereSmokeTravelUniform;
    shader.uniforms.atmosphereSmokeChurn = atmosphereSmokeChurnUniform;
}

// Also shared with the sky: its fog is the same air, so it has to be tinted the same way or a
// doorway shows a different fog from the wall around it.
function bindFogTintUniforms(shader: THREE.WebGLProgramParametersWithUniforms)
{
    shader.uniforms.atmosphereFogLampTint = atmosphereFogLampTintUniform;
    LightBlockMapMaterialUtil.bindColorUniform(shader);
}

// Advances a drift, wrapped to one field period.
function advanceDrift(drift: THREE.Vector3, direction: Vec3, distance: number)
{
    if (distance == 0)
        return;
    drift.set(wrapToFieldPeriod(drift.x + direction.x * distance),
        wrapToFieldPeriod(drift.y + direction.y * distance),
        wrapToFieldPeriod(drift.z + direction.z * distance));
}

function wrapToFieldPeriod(value: number): number
{
    return ((value % VALUE_NOISE_FBM_PERIOD) + VALUE_NOISE_FBM_PERIOD) % VALUE_NOISE_FBM_PERIOD;
}

function defaultCloudsVector(): THREE.Vector3
{
    const prefs = RoomPrefsUtil.decode("");
    return new THREE.Vector3(RoomPrefsUtil.getCloudScale(prefs),
        RoomPrefsUtil.getCloudOpacity(prefs), RoomPrefsUtil.getCloudSoftness(prefs));
}

function defaultGroundVector(): THREE.Vector3
{
    const prefs = RoomPrefsUtil.decode("");
    return new THREE.Vector3(RoomPrefsUtil.getGroundScale(prefs),
        RoomPrefsUtil.getGroundSolidity(prefs), RoomPrefsUtil.getGroundSoftness(prefs));
}

function defaultSmokeVector(): THREE.Vector2
{
    const prefs = RoomPrefsUtil.decode("");
    return new THREE.Vector2(RoomPrefsUtil.getFogSmokeScale(prefs),
        RoomPrefsUtil.getFogSmokeAmplitude(prefs));
}

export default AtmosphereMaterialUtil;
