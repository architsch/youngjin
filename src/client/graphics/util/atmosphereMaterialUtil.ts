import * as THREE from "three";
import RoomPrefsUtil from "../../../shared/room/util/roomPrefsUtil";
import Vec3 from "../../../shared/math/types/vec3";
import installSkyShader from "../shaders/skyShader";
import ValueNoiseTextureUtil from "./valueNoiseTextureUtil";
import { VALUE_NOISE_FBM_PERIOD } from "../shaders/valueNoiseGLSL";
import { ATMOSPHERE_CLOUD_DRIFT, ATMOSPHERE_FOG_FRAGMENT_GLSL, ATMOSPHERE_FOG_FRAGMENT_PARS_GLSL,
    ATMOSPHERE_FOG_VERTEX_GLSL, ATMOSPHERE_FOG_VERTEX_PARS_GLSL, ATMOSPHERE_SMOKE_CHURN }
    from "../shaders/atmosphereGLSL";

// Owns the room's air: the mesh that paints the sky, the wiring that lets every material fading into
// fog paint the same air at the same moment, and how far the clouds and the smoke have drifted. What
// the air actually looks like is in @src/client/graphics/shaders/atmosphereGLSL.ts , which also
// explains why the sky and the fog are two fields and how they still meet without a seam.
//
// The uniforms live here rather than in GraphicsManager for the same reason the light block map's do:
// a material has to be able to reach them without importing anything that leads back to the manager,
// which would close an import cycle.

// Held as one object per value and never replaced, because three.js keeps whatever object is put into
// shader.uniforms and re-reads its "value" every frame. Writing the value therefore reaches every
// material already compiled, while replacing the holder would reach none of them.
//
// (How fine the clouds are, how far toward their own color they reach, how wide their edge runs) and
// what color they are — kept as uniforms so that dragging a slider uploads a few floats rather than
// recompiling every material in the scene.
//
// Started at what a room that has said nothing asks for, rather than at zeros. The room being stood
// in sets these before its first frame is drawn, so nothing should ever see the initial values; a
// scale of zero is a degenerate sky rather than a plain one, which is not a thing to leave lying
// around for an ordering change to find.
const atmosphereCloudsUniform = { value: defaultCloudsVector() };
const atmosphereCloudColorUniform = { value: new THREE.Color(0, 0, 0) };
// The land below the horizon, which only the sky draws. Its coarseness is started at what an
// unconfigured room asks for for the same reason the clouds' is: a scale of zero is a degenerate
// landscape rather than a flat one.
const atmosphereGroundColorUniform = { value: new THREE.Color(0, 0, 0) };
const atmospherePeakColorUniform = { value: new THREE.Color(0, 0, 0) };
const atmosphereGroundUniform = { value: defaultGroundVector() };
// The fog's own field (how fine the smoke is, how far it thins the air), which every material standing
// in the room's air reads — and the sky reads too, for the fog laid over it. Started at what an
// unconfigured room asks for, like the rest: a scale of zero is degenerate rather than plain.
const atmosphereSmokeUniform = { value: defaultSmokeVector() };
// How far the clouds have drifted, and how far the smoke and the field shearing it have travelled —
// in noise units, as running totals kept here and wrapped (see update).
const atmosphereCloudDriftUniform = { value: new THREE.Vector3() };
const atmosphereSmokeTravelUniform = { value: new THREE.Vector3() };
const atmosphereSmokeChurnUniform = { value: new THREE.Vector3() };
const skyColorUniform = { value: new THREE.Color(0, 0, 0) };
const skyInverseProjectionUniform = { value: new THREE.Matrix4() };
// How deep into the view the camera's far plane stands, which is as far as the sky is ever fogged
// over (see the sky shader). Taken from the camera each frame, as the projection above is.
const skyFarDepthUniform = { value: 0 };

// How fast the clouds and the smoke are moving, and through how fine a field — what the drifts above
// are advanced by each frame. Held here rather than handed to the shaders, which never read a speed,
// only how far things have got. Still until a room says otherwise.
let cloudSpeed = 0;
let cloudScale = 0;
let smokeSpeed = 0;
let smokeScale = 0;
const smokeDirection = new THREE.Vector3();

// When the drifts were last advanced, in seconds, or nothing before the first frame has been drawn.
let lastUpdateTime = 0;

// Drawn after everything else that is opaque. Nothing else in the scene sets a render order, so any
// large positive value puts the sky last; it is far from zero to leave room for anything that later
// wants to sit between the room and the sky.
//
// Last rather than first, which is the opposite of what a background wants to be and is worth the
// paragraph. The sky covers the screen and is the most expensive thing per pixel the frame draws — a
// fractal field sampled several times over, for the air and again for the land. Drawn first it is
// shaded in full and then painted over by every wall in the room, which is most of the screen thrown
// away. Drawn last, at the far plane and tested against the depth buffer, the hardware discards it
// before the shader runs anywhere a surface already stands, and it costs only the pixels that are
// actually sky. It still writes nothing to the depth buffer, having nothing to be in front of.
const SKY_RENDER_ORDER = 1000;

const AtmosphereMaterialUtil =
{
    // The mesh that paints the sky. Created once and kept for the app's lifetime alongside the scene,
    // like everything else in it.
    createSkyMesh: (): THREE.Mesh =>
    {
        // Unlit, since the sky is not a surface light falls on. Fogged — though not the way a surface
        // is, since a surface is somewhere and the sky is only ever a direction: the sky shader works
        // out for itself how much of the room's air stands in front of it, and takes the stock fog
        // chunk's place to lay that much over the sky (fogging the material is what hands it the
        // scene's own fog uniforms to do it with). Tested against the depth buffer so that the room
        // throws it away rather than paints over it (see SKY_RENDER_ORDER), and writing nothing back
        // to it, since it is behind everything by construction and has nothing to occlude.
        const material = new THREE.MeshBasicMaterial({
            depthWrite: false,
            fog: true,
            // The quad's own facing is meaningless once its vertices are written straight into clip
            // space, so neither side is turned away.
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
            shader.uniforms.skyColor = skyColorUniform;
            shader.uniforms.skyInverseProjection = skyInverseProjectionUniform;
            shader.uniforms.skyFarDepth = skyFarDepthUniform;
            installSkyShader(shader);
        };
        // Three.js keys compiled programs on a material's parameters, which say nothing about what
        // its onBeforeCompile did — so without a key of its own this material could be handed another
        // unlit material's shader (see MaterialFactory, which does the same for everything it caches).
        material.customProgramCacheKey = () => "Sky";

        // Spans the whole of clip space on both axes, which is what lets the vertex stage use the
        // positions as they are.
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        mesh.name = "Sky";
        mesh.renderOrder = SKY_RENDER_ORDER;
        // Its vertices never go through the projection, so the box three.js would test against the
        // camera's frustum describes nothing about where it ends up.
        mesh.frustumCulled = false;
        return mesh;
    },

    // Adds the smoke to a material's fog, keeping whatever that material already does on
    // compilation. Returns the material so this can be wrapped around a constructor call.
    //
    // Everything here is inert on a material three.js is not fogging: the injections are guarded on
    // the same USE_FOG the stock chunks are, so a material exempt from fog pays nothing.
    //
    // Note what is *not* bound here. The clouds and the land are the sky's alone, so no material in
    // the room carries a line of their code — the fog's field is its own, and the two only ever meet
    // in a room's settings.
    addFogNoise<T extends THREE.Material>(material: T): T
    {
        const existingOnBeforeCompile = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) =>
        {
            existingOnBeforeCompile.call(material, shader, renderer);

            // The smoke's own field is read out of the shared noise texture, so every material
            // standing in the room's air has to be handed it (see ValueNoiseTextureUtil).
            ValueNoiseTextureUtil.bindUniform(shader);
            bindSmokeUniforms(shader);

            shader.vertexShader = ATMOSPHERE_FOG_VERTEX_PARS_GLSL + shader.vertexShader;
            // Where three.js works out the fog's own depth, which is the point at which the position
            // this needs has been resolved.
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

    // What color the sky is wherever nothing stands in front of it. Its own color rather than the
    // fog's: the fog is laid over it separately, by the sky shader, from three.js's own fog uniforms —
    // the same ones every surface in the room is fogged from.
    setSkyColor: (color: THREE.Color) =>
    {
        skyColorUniform.value.copy(color);
    },

    // How unevenly thick the room's air is: how far it thins where the smoke lies heaviest, how fine
    // the smoke runs, how fast it moves through the room, and which way it goes. One call, because
    // they are one description of one body of air — read by every surface standing in it, and by the
    // fog the sky shader lays over the sky past it.
    setSmoke: (amplitude: number, scale: number, speed: number, drift: Vec3) =>
    {
        atmosphereSmokeUniform.value.set(scale, amplitude);
        smokeSpeed = speed;
        smokeScale = scale;
        smokeDirection.set(drift.x, drift.y, drift.z);
    },

    // How the sky is broken up: what color the clouds are, how far toward it they reach, how fine
    // they are, how wide their edge runs and how fast they cross the sky. One call rather than five,
    // because they are one description of one sky and are only ever set together (see RoomPrefsUtil,
    // which is where a room's stored settings become these).
    setClouds: (color: THREE.Color, opacity: number, scale: number, softness: number,
        speed: number) =>
    {
        atmosphereCloudColorUniform.value.copy(color);
        atmosphereCloudsUniform.value.set(scale, opacity, softness);
        cloudSpeed = speed;
        cloudScale = scale;
    },

    // What stands below the horizon: what color the low land is, what color the high land is, and
    // how coarse the country between them runs. Set together for the reason the clouds are — three
    // parts of one landscape, which is meaningless read a part at a time.
    //
    // A room wanting no land at all picks the air's own color twice, exactly as a room wanting no
    // weather does, and for the same reason: the haze between the viewer and the land is the air, so
    // land painted in the air's color is land that was never there.
    setGround: (color: THREE.Color, peakColor: THREE.Color, scale: number, solidity: number,
        softness: number) =>
    {
        atmosphereGroundColorUniform.value.copy(color);
        atmospherePeakColorUniform.value.copy(peakColor);
        atmosphereGroundUniform.value.set(scale, solidity, softness);
    },

    // Called once a frame. Carries the clouds and the smoke along, and hands the sky the part of
    // turning a pixel back into a line of sight that three.js does not: the projection's inverse, and
    // how deep the far plane stands. The rest is three.js's own view matrix and camera position, which
    // the sky reads at the moment it is drawn rather than from here (see the sky shader) — which is
    // why nothing about where the camera *is* is copied in: it would be a frame behind by the time it
    // was used.
    //
    // **How far the clouds and the smoke have gone is a running total, not the clock times their
    // speed.** Worked out from the clock, every change of speed would move them at once to wherever
    // the new speed would have had them by now — which, a few minutes into a session, is the whole
    // field lurching somewhere else on every step of a slider being dragged, and at the top of either
    // speed a different sky on every frame of the drag. As a total, a new speed only changes how fast
    // they go from here. The total accrues in noise units, with the scale folded in as it goes, so a
    // change of scale does not fling it either.
    //
    // **And the total is wrapped** at the distance the stacked noise field repeats over (see
    // VALUE_NOISE_FBM_PERIOD), where the field is exactly the field it left, so the wrap cannot be
    // seen. Left to grow, it would become a coordinate a float can no longer place finely, and at the
    // top of either speed that would take well under a session: the field would band, and then block.
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

// The smoke as the shaders read it: how it is shaped, and how far it and the field shearing it have
// got. Bound both to every material standing in the room's air and to the sky, which fogs itself.
function bindSmokeUniforms(shader: THREE.WebGLProgramParametersWithUniforms)
{
    shader.uniforms.atmosphereSmoke = atmosphereSmokeUniform;
    shader.uniforms.atmosphereSmokeTravel = atmosphereSmokeTravelUniform;
    shader.uniforms.atmosphereSmokeChurn = atmosphereSmokeChurnUniform;
}

// Moves a running drift a distance along a direction, keeping it inside one period of the field it
// is read in (see update).
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
