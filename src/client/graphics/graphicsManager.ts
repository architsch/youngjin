import * as THREE from "three";
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { graphicsContextRestoredObservable } from "../system/clientObservables";
import { endClientProcess, ongoingClientProcessExists, tryStartClientProcess } from "../system/types/clientProcess";
import { FOG_COLOR_PALETTE_NAME, LIGHT_COLOR_PALETTE_NAME, MINUTE_IN_MS,
    SCENERY_COLOR_PALETTE_NAME } from "../../shared/system/sharedConstants";
import LightBlockMap from "./light/maps/lightBlockMap";
import { getLightLuminance } from "./light/util/lightBlockPropagationUtil";
import RoomPrefs from "../../shared/room/types/roomPrefs";
import RoomPrefsUtil, { MAX_FOG_DISTANCE, MAX_ROOM_PREFS_STEP } from "../../shared/room/util/roomPrefsUtil";
import HeadLightUtil from "../../shared/graphics/light/util/headLightUtil";
import ColorUtil from "../../shared/math/util/colorUtil";
import NumUtil from "../../shared/math/util/numUtil";
import ShaderPrecompileUtil from "./util/shaderPrecompileUtil";
import AtmosphereMaterialUtil from "./util/atmosphereMaterialUtil";

const minAspectRatio = 0.6;
const maxAspectRatio = 2;

// Capped below the device's reported ratio: extra density is invisible on phones but costs a full
// fragment evaluation per pixel.
const maxPixelRatio = Math.min(2, window.devicePixelRatio);
const minPixelRatio = Math.max(0.5, maxPixelRatio * 0.5);
let currPixelRatio = maxPixelRatio;

// Adaptive resolution is steered by frame time within a band (not toward a target) so the controller
// settles instead of oscillating. The band sits low: a 30fps device must fall below the low-water
// mark and climb back to full density rather than sit at the floor.
const frameTimeHighWater = 1 / 22;
const frameTimeLowWater = 1 / 27;
const frameTimeSmoothingHalfLife = 0.25;

// Longer frames (backgrounded page, room load, context restore) say nothing about draw cost.
const maxMeasurableFrameTime = 0.5;

// Asymmetric: back off fast, recover slowly. Each change reallocates the drawing buffer.
const pixelRatioFallStep = 0.8;
const pixelRatioRiseStep = 1.06;
const pixelRatioFallInterval = 0.4;
const pixelRatioRiseInterval = 2;
// Must stay below the smallest step either rate can produce.
const pixelRatioMinChange = 0.02;

let smoothedFrameTime = frameTimeLowWater;
let lastFrameTime = 0;
let timeSincePixelRatioChange = 0;

let gameCanvasRoot: HTMLElement;
let overlayCanvasRoot: HTMLElement;
let gameRenderer: THREE.WebGLRenderer;
let overlayRenderer: CSS2DRenderer;
let scene: THREE.Scene;
let ambLight: THREE.AmbientLight;
let pointLight: THREE.PointLight;
let camera: THREE.PerspectiveCamera;

// Scene, camera, lights, renderers and assets are created once and reused across rooms; obsolete
// assets are disposed explicitly where they become obsolete (e.g. a replaced texture pack).
let graphicsInitialized = false;

const contextRecoveryProcessName = "graphicsContextRecovery";
const contextRestoreGracePeriod = 5000;
const contextRecoveryReloadTimeKey = "graphicsContextRecoveryReloadTime";
const contextRecoveryReloadCooldown = 5 * MINUTE_IN_MS;

let contextLost = false;
let contextRestoreCheckScheduled = false;

// The camera-mounted head light (see HeadLightUtil). Starts at the unconfigured room's settings.
const unconfiguredPrefs = RoomPrefsUtil.decode("");
let basePointLightIntensity = HeadLightUtil.getIntensity(unconfiguredPrefs.headLightPowerStep);
let basePointLightDistance = HeadLightUtil.getDistance(unconfiguredPrefs.headLightRangeStep);
let pointLightDecay = HeadLightUtil.getDecay(unconfiguredPrefs.headLightRangeStep);

// The light must reach past the view target so the target is lit among its surroundings.
const pointLightRangePerViewDistance = 2;

// Room light (in block map units) at which the room takes half the say over the head light. A
// saturating curve, because a linear ramp over this dynamic range behaves like a switch.
const pointLightRoomHalfBrightness = 0.15;

// The view distance fog distances were tuned for; farther cameras push the fog out proportionally.
const referenceFogViewDistance = 8;

// Far plane for the player's own eye: roughly the room's diagonal. Farther cameras push it out by their
// view distance, so the room behind what they look at is still drawn.
const baseCameraFar = 45;

let currViewDistance = 0;
const currRoomLightNearCamera = new THREE.Color(0, 0, 0);

let currRoomPrefs: RoomPrefs = RoomPrefsUtil.decode("");

const pointLightBaseColor = new THREE.Color(0xffffff);
const pointLightColorTemp = new THREE.Color();

// Never removed: toggling scene.fog recompiles every material, so "no fog" is fog beyond the far plane.
const sceneFog = new THREE.Fog(0x000000, MAX_FOG_DISTANCE, MAX_FOG_DISTANCE * 2);

// Lamps as data rather than THREE lights (see LightBlockMap). Lives as long as the scene.
const lightBlockMap = new LightBlockMap();

const GraphicsManager =
{
    getLightBlockMap: (): LightBlockMap =>
    {
        return lightBlockMap;
    },
    getGameCanvas: (): HTMLCanvasElement =>
    {
        return gameRenderer.domElement;
    },
    getGameRenderer: (): THREE.WebGLRenderer =>
    {
        return gameRenderer;
    },
    addObjectToScene: (obj: THREE.Object3D) =>
    {
        scene.add(obj);
    },
    addObjectToSceneIfNotAlreadyAdded: (obj: THREE.Object3D) =>
    {
        if (obj.parent != scene)
            scene.add(obj);
    },
    getScene: (): THREE.Scene =>
    {
        return scene;
    },
    getCamera: (): THREE.PerspectiveCamera =>
    {
        return camera;
    },
    // Distance to what the camera is looking at (0 = player's own eye). Sizes the head light, the fog
    // and the far plane, so a pulled-back camera can still see the room.
    setViewDistance: (viewDistance: number) =>
    {
        if (viewDistance === currViewDistance)
            return;
        currViewDistance = viewDistance;
        refreshPointLight();
        refreshFog();
        camera.far = baseCameraFar + currViewDistance;
        camera.updateProjectionMatrix();
    },
    // Room lamp light around the camera, which the head light yields to (see refreshPointLight).
    setPointLightSurroundings: (roomLightNearCamera: THREE.Color) =>
    {
        if (currRoomLightNearCamera.equals(roomLightNearCamera))
            return;
        currRoomLightNearCamera.copy(roomLightNearCamera);
        refreshPointLight();
    },
    setRoomLightingPrefs: (prefs: RoomPrefs) =>
    {
        currRoomPrefs = prefs;

        ambLight.color.set(getPaletteColor(LIGHT_COLOR_PALETTE_NAME, prefs.ambientColorIndex));
        ambLight.intensity = RoomPrefsUtil.getAmbientIntensity(prefs);

        pointLightBaseColor.set(getPaletteColor(LIGHT_COLOR_PALETTE_NAME, prefs.headLightColorIndex));
        basePointLightIntensity = HeadLightUtil.getIntensity(prefs.headLightPowerStep);
        basePointLightDistance = HeadLightUtil.getDistance(prefs.headLightRangeStep);
        pointLightDecay = HeadLightUtil.getDecay(prefs.headLightRangeStep);
        refreshPointLight();

        sceneFog.color.set(getPaletteColor(FOG_COLOR_PALETTE_NAME, prefs.fogColorIndex));
        skyColorTemp.set(getPaletteColor(FOG_COLOR_PALETTE_NAME, prefs.skyColorIndex));
        AtmosphereMaterialUtil.setSkyColor(skyColorTemp);
        AtmosphereMaterialUtil.setSmoke(RoomPrefsUtil.getFogSmokeAmplitude(prefs),
            RoomPrefsUtil.getFogSmokeScale(prefs), RoomPrefsUtil.getFogSmokeSpeed(prefs),
            RoomPrefsUtil.getFogSmokeDrift(prefs));
        cloudColorTemp.set(getPaletteColor(SCENERY_COLOR_PALETTE_NAME, prefs.cloudColorIndex));
        AtmosphereMaterialUtil.setClouds(cloudColorTemp,
            RoomPrefsUtil.getCloudOpacity(prefs), RoomPrefsUtil.getCloudScale(prefs),
            RoomPrefsUtil.getCloudSoftness(prefs), RoomPrefsUtil.getCloudSpeed(prefs));
        groundColorTemp.set(getPaletteColor(SCENERY_COLOR_PALETTE_NAME, prefs.groundColorIndex));
        peakColorTemp.set(getPaletteColor(SCENERY_COLOR_PALETTE_NAME, prefs.groundPeakColorIndex));
        AtmosphereMaterialUtil.setGround(groundColorTemp, peakColorTemp,
            RoomPrefsUtil.getGroundScale(prefs), RoomPrefsUtil.getGroundSolidity(prefs),
            RoomPrefsUtil.getGroundSoftness(prefs));
        // The sky covers every pixel; the clear color only matches it for safety.
        gameRenderer.setClearColor(skyColorTemp);
        refreshFog();
    },
    update: () =>
    {
        updatePixelRatio();
        // Once per frame, so dragging a lamp costs one propagation per frame.
        lightBlockMap.update();
        AtmosphereMaterialUtil.update(camera);
        gameRenderer.render(scene, camera);
        overlayRenderer.render(scene, camera);
    },
    // Compiles shaders during the loading screen instead of stalling the first frame that needs them.
    // Pass 1: the loaded scene. Pass 2: stand-ins for materials that may appear later (see
    // ShaderPrecompileUtil), compiled against the real scene so the programs match.
    precompileSceneShaders: async () =>
    {
        await gameRenderer.compileAsync(scene, camera);
        await gameRenderer.compileAsync(await ShaderPrecompileUtil.getWarmupScene(), camera, scene);
    },
    load: async (updateCallback: XRFrameRequestCallback | null) =>
    {
        if (!graphicsInitialized)
        {
            gameCanvasRoot = document.getElementById("gameCanvasRoot") as HTMLElement;
            overlayCanvasRoot = document.getElementById("overlayCanvasRoot") as HTMLElement;

            scene = new THREE.Scene();
            scene.fog = sceneFog;

            scene.add(AtmosphereMaterialUtil.createSkyMesh());

            ambLight = new THREE.AmbientLight(0xffffff,
                RoomPrefsUtil.getAmbientIntensity(currRoomPrefs));
            scene.add(ambLight);

            camera = new THREE.PerspectiveCamera(60, 1, 0.1, baseCameraFar);

            // Parented to the camera so it follows the view.
            pointLight = new THREE.PointLight(0xffffff, basePointLightIntensity,
                basePointLightDistance, pointLightDecay);
            pointLight.position.set(0, 1, 0);
            camera.add(pointLight);

            gameRenderer = new THREE.WebGLRenderer({ antialias: true });
            gameRenderer.shadowMap.enabled = true;
            gameRenderer.setClearColor("#000000");
            gameRenderer.domElement.style.position = "absolute";
            gameRenderer.domElement.style.margin = "auto auto";
            gameRenderer.domElement.style.top = "0";
            gameRenderer.domElement.style.bottom = "0";
            gameRenderer.domElement.style.left = "0";
            gameRenderer.domElement.style.right = "0";
            gameRenderer.domElement.style.touchAction = "none";
            gameCanvasRoot.appendChild(gameRenderer.domElement);

            overlayRenderer = new CSS2DRenderer();
            overlayRenderer.domElement.style.position = "absolute";
            overlayRenderer.domElement.style.margin = "auto auto";
            overlayRenderer.domElement.style.top = "0";
            overlayRenderer.domElement.style.bottom = "0";
            overlayRenderer.domElement.style.left = "0";
            overlayRenderer.domElement.style.right = "0";
            overlayRenderer.domElement.style.touchAction = "none";
            overlayCanvasRoot.appendChild(overlayRenderer.domElement);

            gameRenderer.domElement.addEventListener("webglcontextlost", onContextLost);
            gameRenderer.domElement.addEventListener("webglcontextrestored", onContextRestore);
            // A context lost in the background is only waited on once the page is visible again.
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible")
                    scheduleContextRestoreCheck();
            });

            logPageLifecycleEvents();

            graphicsInitialized = true;
        }

        window.addEventListener("resize", onResize);
        updateRenderSizes();

        // The arrival frame carries the whole load, so start the resolution controller with no
        // history. The resolution itself is kept from the previous room.
        lastFrameTime = 0;
        smoothedFrameTime = frameTimeLowWater;
        timeSincePixelRatioChange = 0;

        // Update Loop

        gameRenderer.setAnimationLoop(updateCallback);
    },
    unload: async () =>
    {
        // Only per-room hooks are torn down; the scene and assets persist (see graphicsInitialized).
        window.removeEventListener("resize", onResize);
        gameRenderer.setAnimationLoop(null);
    },
}

// Adaptive resolution. Timed here rather than from the app loop's delta, because the loop may tick
// without drawing on high-refresh displays. It only saves fragment cost, so a stutter that persists
// at the floor points at the CPU.
function updatePixelRatio()
{
    const now = performance.now() * 0.001;
    const frameTime = (lastFrameTime > 0) ? now - lastFrameTime : frameTimeLowWater;
    lastFrameTime = now;

    if (frameTime > maxMeasurableFrameTime)
        return;

    // Weighted by frame duration so smoothing spans time, not a frame count.
    smoothedFrameTime += (frameTime - smoothedFrameTime) *
        (1 - Math.pow(0.5, frameTime / frameTimeSmoothingHalfLife));
    timeSincePixelRatioChange += frameTime;

    let desiredPixelRatio = currPixelRatio;
    if (smoothedFrameTime > frameTimeHighWater &&
        timeSincePixelRatioChange >= pixelRatioFallInterval)
        desiredPixelRatio = currPixelRatio * pixelRatioFallStep;
    else if (smoothedFrameTime < frameTimeLowWater &&
        timeSincePixelRatioChange >= pixelRatioRiseInterval)
        desiredPixelRatio = currPixelRatio * pixelRatioRiseStep;

    desiredPixelRatio = NumUtil.clampInRange(desiredPixelRatio, minPixelRatio, maxPixelRatio);
    if (Math.abs(desiredPixelRatio - currPixelRatio) < pixelRatioMinChange)
        return;

    currPixelRatio = desiredPixelRatio;
    gameRenderer.setPixelRatio(currPixelRatio);
    timeSincePixelRatioChange = 0;
}

// Range grows with view distance and intensity compensates for the decay, so the target stays as
// bright as up close. The room's own light then takes over its share.
function refreshPointLight()
{
    const range = Math.max(basePointLightDistance,
        pointLightRangePerViewDistance * currViewDistance);

    // Measured like the block map measures light, from light near (not only at) the camera, so a
    // lamp's pool isn't flattened when viewed from outside it (see LightBlockDilationUtil).
    const roomLuminance = getLightLuminance(currRoomLightNearCamera.r, currRoomLightNearCamera.g,
        currRoomLightNearCamera.b);
    const roomShare = roomLuminance / (roomLuminance + pointLightRoomHalfBrightness);

    // No floor: any white head light washes out a lit room's saturated colors up close.
    pointLight.distance = range;
    pointLight.intensity = basePointLightIntensity *
        Math.pow(range / basePointLightDistance, pointLightDecay) * (1 - roomShare);

    // Tinted toward the room light's color, which deepens rather than dilutes the surfaces it adds to.
    pointLightColorTemp.copy(pointLightBaseColor);
    const peak = Math.max(currRoomLightNearCamera.r,
        Math.max(currRoomLightNearCamera.g, currRoomLightNearCamera.b));
    if (peak > 0)
    {
        // Normalized: only the room light's hue matters here.
        pointLightColorTemp.lerpColors(pointLightBaseColor,
            colorTemp.setRGB(currRoomLightNearCamera.r / peak, currRoomLightNearCamera.g / peak,
                currRoomLightNearCamera.b / peak, THREE.LinearSRGBColorSpace),
            roomShare);
    }
    pointLight.color.copy(pointLightColorTemp);
}

// Fog distances describe a standing player's view; a farther camera pushes them out proportionally
// (never in).
function refreshFog()
{
    const scale = Math.max(1, currViewDistance / referenceFogViewDistance);
    sceneFog.near = RoomPrefsUtil.getFogNearDistance(currRoomPrefs) * scale;
    sceneFog.far = RoomPrefsUtil.getFogFarDistance(currRoomPrefs) * scale;
}

function getPaletteColor(paletteName: string, index: number): string
{
    return ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(paletteName, index));
}

const colorTemp = new THREE.Color();
const skyColorTemp = new THREE.Color();
const cloudColorTemp = new THREE.Color();
const groundColorTemp = new THREE.Color();
const peakColorTemp = new THREE.Color();

function onResize(ev: UIEvent)
{
    updateRenderSizes();
}

// Mobile browsers drop the WebGL context of backgrounded tabs. Recover in place when the browser
// restores it (keeping socket, room and position); reload only if it never comes back.
function onContextLost()
{
    contextLost = true;
    console.warn("WebGL context lost. Waiting for the browser to restore it.");
    // three.js already requested restoration; show the loading indicator while waiting.
    tryStartClientProcess(contextRecoveryProcessName, 1, 0);
    scheduleContextRestoreCheck();
}

function onContextRestore()
{
    contextLost = false;
    console.warn("WebGL context restored.");
    if (ongoingClientProcessExists(contextRecoveryProcessName))
        endClientProcess(contextRecoveryProcessName);

    // The block map's textures are rewritten by the next propagation.
    lightBlockMap.requestRecomputation();

    // Render targets exist only on the GPU, so whoever drew into one must redraw it.
    graphicsContextRestoredObservable.change(numRestorations => numRestorations + 1);
}

// Reloads if the context isn't restored within a grace period of the page being visible. Hidden
// pages don't count down, since the browser won't restore a context for them.
function scheduleContextRestoreCheck()
{
    if (!contextLost || contextRestoreCheckScheduled)
        return;
    if (document.visibilityState !== "visible")
        return;

    contextRestoreCheckScheduled = true;
    setTimeout(() => {
        contextRestoreCheckScheduled = false;
        if (!contextLost || document.visibilityState !== "visible")
            return;

        // Avoid a reload loop on a device that is genuinely out of GPU memory.
        if (reloadedRecently())
        {
            console.warn("WebGL context was not restored, and reloading has already been tried " +
                "recently. Staying on this page rather than reloading again.");
            return;
        }

        recordReloadTime();
        console.warn("WebGL context was not restored. Reloading the page...");
        window.location.reload();
    }, contextRestoreGracePeriod);
}

function reloadedRecently(): boolean
{
    try
    {
        const lastReloadTime = Number(window.sessionStorage.getItem(contextRecoveryReloadTimeKey));
        return lastReloadTime > 0 && Date.now() - lastReloadTime < contextRecoveryReloadCooldown;
    }
    catch (err)
    {
        // Storage unavailable: an occasional extra reload is the lesser mistake.
        return false;
    }
}

function recordReloadTime(): void
{
    try
    {
        window.sessionStorage.setItem(contextRecoveryReloadTimeKey, String(Date.now()));
    }
    catch (err)
    {
    }
}

// Logs page lifecycle events so a blank 3D view can be diagnosed from the console log (lost context
// vs. freeze, bfcache restore, or reload).
function logPageLifecycleEvents()
{
    for (const eventName of ["visibilitychange", "freeze", "resume"])
        document.addEventListener(eventName, () => logPageLifecycleEvent(eventName));
    for (const eventName of ["pageshow", "pagehide"])
        window.addEventListener(eventName, () => logPageLifecycleEvent(eventName));
}

function logPageLifecycleEvent(eventName: string)
{
    const contextIsLost = gameRenderer.getContext().isContextLost();
    console.log(`Page lifecycle event "${eventName}" ` +
        `(visibility: ${document.visibilityState}, WebGL context lost: ${contextIsLost}, ` +
        `window size: ${window.innerWidth}x${window.innerHeight})`);
}

function updateRenderSizes()
{
    const windowWidth = Math.max(1, window.innerWidth);
    const windowHeight = Math.max(1, window.innerHeight);
    const windowAspectRatio = windowWidth / windowHeight;

    let desiredWidth = windowWidth;
    let desiredHeight = windowHeight;
    let desiredAspectRatio = windowAspectRatio;

    if (desiredAspectRatio < minAspectRatio)
    {
        desiredAspectRatio = minAspectRatio;
        desiredHeight = windowWidth / desiredAspectRatio;
    }
    else if (desiredAspectRatio > maxAspectRatio)
    {
        desiredAspectRatio = maxAspectRatio;
        desiredWidth = windowHeight * desiredAspectRatio;
    }

    gameRenderer.setSize(desiredWidth, desiredHeight);
    gameRenderer.setPixelRatio(currPixelRatio);
    overlayRenderer.setSize(desiredWidth, desiredHeight);

    camera.aspect = desiredAspectRatio;
    camera.updateProjectionMatrix();
}

export default GraphicsManager;