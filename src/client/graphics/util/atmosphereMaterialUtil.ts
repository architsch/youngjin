import * as THREE from "three";
import RoomPrefsUtil from "../../../shared/room/util/roomPrefsUtil";
import Vec3 from "../../../shared/math/types/vec3";
import installSkyShader from "../shaders/skyShader";
import ValueNoiseTextureUtil from "./valueNoiseTextureUtil";
import { ATMOSPHERE_FOG_FRAGMENT_GLSL, ATMOSPHERE_FOG_FRAGMENT_PARS_GLSL,
    ATMOSPHERE_FOG_VERTEX_GLSL, ATMOSPHERE_FOG_VERTEX_PARS_GLSL } from "../shaders/atmosphereGLSL";

// Owns the room's air: the mesh that paints the sky, and the wiring that lets every material fading
// into fog paint the same air at the same moment. What the air actually looks like is in
// @src/client/graphics/shaders/atmosphereGLSL.ts , which also explains why the two must not be
// allowed to disagree.
//
// The uniforms live here rather than in GraphicsManager for the same reason the light block map's do:
// a material has to be able to reach them without importing anything that leads back to the manager,
// which would close an import cycle.

// Held as one object per value and never replaced, because three.js keeps whatever object is put into
// shader.uniforms and re-reads its "value" every frame. Writing the value therefore reaches every
// material already compiled, while replacing the holder would reach none of them.
const atmosphereTimeUniform = { value: 0 };
// (how fine the clouds are, how fast they cross the sky) and what color they are — the three the room
// chooses, kept as uniforms so that dragging a slider uploads a few floats rather than recompiling
// every material in the scene.
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
// The fog's own field, which nothing the sky draws reads (see the atmosphere shader). Started at what
// an unconfigured room asks for, like the rest — a scale of zero is degenerate rather than plain.
const atmosphereSmokeUniform = { value: defaultSmokeVector() };
const atmosphereSmokeDriftUniform = { value: defaultSmokeDrift() };
const skyColorUniform = { value: new THREE.Color(0, 0, 0) };
const skyInverseProjectionUniform = { value: new THREE.Matrix4() };

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
        // Unlit, since the sky is not a surface light falls on, and exempt from fog, since it *is*
        // the fog seen at its far end. Tested against the depth buffer so that the room throws it
        // away rather than paints over it (see SKY_RENDER_ORDER), and writing nothing back to it,
        // since it is behind everything by construction and has nothing to occlude.
        const material = new THREE.MeshBasicMaterial({
            depthWrite: false,
            fog: false,
            // The quad's own facing is meaningless once its vertices are written straight into clip
            // space, so neither side is turned away.
            side: THREE.DoubleSide,
        });
        material.onBeforeCompile = (shader) =>
        {
            shader.uniforms.atmosphereTime = atmosphereTimeUniform;
            shader.uniforms.atmosphereClouds = atmosphereCloudsUniform;
            shader.uniforms.atmosphereCloudColor = atmosphereCloudColorUniform;
            shader.uniforms.atmosphereGroundColor = atmosphereGroundColorUniform;
            shader.uniforms.atmospherePeakColor = atmospherePeakColorUniform;
            shader.uniforms.atmosphereGroundShape = atmosphereGroundUniform;
            shader.uniforms.skyColor = skyColorUniform;
            shader.uniforms.skyInverseProjection = skyInverseProjectionUniform;
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

            shader.uniforms.atmosphereTime = atmosphereTimeUniform;
            shader.uniforms.atmosphereSmoke = atmosphereSmokeUniform;
            shader.uniforms.atmosphereSmokeDrift = atmosphereSmokeDriftUniform;

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

    // What color the air is. The same value the scene's fog was given, so that the sky and the room's
    // own haze are at least the same color even though they no longer share a field — the fog's half
    // reads it from three.js's uniform directly.
    setColor: (color: THREE.Color) =>
    {
        skyColorUniform.value.copy(color);
    },

    // How unevenly thick the room's air is: how far it thins where the smoke lies heaviest, how fine
    // the smoke runs, how fast it moves through the room, and which way it goes. One call, because
    // they are one description of one body of air — and nothing the sky draws reads any of them.
    setSmoke: (amplitude: number, scale: number, speed: number, drift: Vec3) =>
    {
        atmosphereSmokeUniform.value.set(scale, speed, amplitude);
        atmosphereSmokeDriftUniform.value.set(drift.x, drift.y, drift.z);
    },

    // How the air is broken up: what color the clouds are, how far toward it they reach, how fine
    // they are, how wide their edge runs and how fast they cross the sky. One call rather than five,
    // because they are one description of one sky and are only ever set together (see RoomPrefsUtil,
    // which is where a room's stored settings become these).
    setClouds: (color: THREE.Color, opacity: number, scale: number, softness: number,
        speed: number) =>
    {
        atmosphereCloudColorUniform.value.copy(color);
        atmosphereCloudsUniform.value.set(scale, speed, opacity, softness);
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

    // Called once a frame. The clock is what moves the clouds, and the projection is half of what
    // turns a pixel back into the direction it is looking — the other half is three.js's own view
    // matrix, which the sky reads at the moment it is drawn rather than from here (see the sky
    // shader). Which is why nothing about where the camera *is* is copied in: it would be a frame
    // behind by the time it was used.
    //
    // Time is counted from the moment the page loaded and never wrapped: a session would have to run
    // for weeks before a float stopped resolving it finely enough for the drift to stay smooth, and a
    // wrap would jump the sky.
    update: (camera: THREE.PerspectiveCamera) =>
    {
        atmosphereTimeUniform.value = performance.now() * 0.001;
        skyInverseProjectionUniform.value.copy(camera.projectionMatrixInverse);
    },
}

function defaultCloudsVector(): THREE.Vector4
{
    const prefs = RoomPrefsUtil.decode("");
    return new THREE.Vector4(
        RoomPrefsUtil.getCloudScale(prefs), RoomPrefsUtil.getCloudSpeed(prefs),
        RoomPrefsUtil.getCloudOpacity(prefs), RoomPrefsUtil.getCloudSoftness(prefs));
}

function defaultGroundVector(): THREE.Vector3
{
    const prefs = RoomPrefsUtil.decode("");
    return new THREE.Vector3(RoomPrefsUtil.getGroundScale(prefs),
        RoomPrefsUtil.getGroundSolidity(prefs), RoomPrefsUtil.getGroundSoftness(prefs));
}

function defaultSmokeVector(): THREE.Vector3
{
    const prefs = RoomPrefsUtil.decode("");
    return new THREE.Vector3(RoomPrefsUtil.getFogSmokeScale(prefs),
        RoomPrefsUtil.getFogSmokeSpeed(prefs), RoomPrefsUtil.getFogSmokeAmplitude(prefs));
}

function defaultSmokeDrift(): THREE.Vector3
{
    const drift = RoomPrefsUtil.getFogSmokeDrift(RoomPrefsUtil.decode(""));
    return new THREE.Vector3(drift.x, drift.y, drift.z);
}

export default AtmosphereMaterialUtil;
