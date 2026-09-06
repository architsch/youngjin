import * as THREE from "three";
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { graphicsContextRestoredObservable } from "../system/clientObservables";
import { endClientProcess, ongoingClientProcessExists, tryStartClientProcess } from "../system/types/clientProcess";
import { FOG_COLOR_PALETTE_NAME, LIGHT_COLOR_PALETTE_NAME, MINUTE_IN_MS } from "../../shared/system/sharedConstants";
import LightBlockMap from "./light/lightBlockMap";
import RoomPrefs from "../../shared/room/types/roomPrefs";
import RoomPrefsUtil, { MAX_FOG_DISTANCE, MAX_ROOM_PREFS_STEP } from "../../shared/room/util/roomPrefsUtil";
import HeadLightPowerUtil from "../../shared/graphics/light/util/headLightPowerUtil";
import ColorUtil from "../../shared/math/util/colorUtil";

const minAspectRatio = 0.6;
const maxAspectRatio = 2;

const minPixelRatio = 0.5;
const maxPixelRatio = window.devicePixelRatio;
const minPixelRatioTargetFPS = 20;
const maxPixelRatioTargetFPS = 40;
let currPixelRatio = window.devicePixelRatio;

let gameCanvasRoot: HTMLElement;
let overlayCanvasRoot: HTMLElement;
let gameRenderer: THREE.WebGLRenderer;
let overlayRenderer: CSS2DRenderer;
let scene: THREE.Scene;
let ambLight: THREE.AmbientLight;
let pointLight: THREE.PointLight;
let camera: THREE.PerspectiveCamera;

// The scene, camera, lighting, renderers, and all graphical assets are created once and reused for
// the app's whole lifetime — they are NOT torn down between rooms. Most assets (meshes, materials,
// textures, geometries) are shared across rooms, so rebuilding them every room change would be pure
// waste; obsolete assets are instead disposed explicitly at the point they become obsolete (e.g. a
// replaced voxel texture pack). This flag guards that one-time initialization.
let graphicsInitialized = false;

// The name of the ClientProcess that holds the loading indicator up while a lost drawing context is
// being waited on, so that the wait reads as the app working rather than as the app having died.
const contextRecoveryProcessName = "graphicsContextRecovery";

// How long the browser is given to hand a lost drawing context back, counted from the moment the
// page is in front of the user again. A restore that is coming normally lands within a frame or two
// of that; one that has not arrived by the end of this is not coming, and the page reloads instead.
const contextRestoreGracePeriod = 5000;

// Where the time of the most recent reload this recovery path performed is kept, and how recently
// one must have happened for the next to count as a repetition rather than a fresh problem.
// sessionStorage because the thing being remembered happened before the current page existed, and
// because a tab is exactly the lifetime over which it is worth remembering.
const contextRecoveryReloadTimeKey = "graphicsContextRecoveryReloadTime";
const contextRecoveryReloadCooldown = 5 * MINUTE_IN_MS;

let contextLost = false;
let contextRestoreCheckScheduled = false;

// The point light rides with the camera and is what actually lights the room for the user — the
// ambient light only keeps the unlit side of things from being black. How strong it is, how far it
// carries and how quickly it falls off are one setting rather than three, and the room says which
// (see HeadLightPowerUtil); these are its settings for a view from the player's own eye, where
// whatever he is looking at is a few paces off.
let basePointLightIntensity = HeadLightPowerUtil.getIntensity(MAX_ROOM_PREFS_STEP);
let basePointLightDistance = HeadLightPowerUtil.getDistance(MAX_ROOM_PREFS_STEP);
let pointLightDecay = HeadLightPowerUtil.getDecay(MAX_ROOM_PREFS_STEP);

// How far past whatever the camera is looking at the light has to carry. Above 1 so that the target
// is lit among its surroundings rather than picked out of the dark, and fixed so that the target
// always sits at the same fraction of the light's range however far back the camera has been taken.
const pointLightRangePerViewDistance = 2;

// How much light there has to be around the player for the room to get half the say, in the same
// units the block map accumulates in.
//
// The head lamp is only ever the light the room is not providing for itself. Where a room has been
// lit it goes out and is not missed; where nothing has been put down it is the whole of the light,
// which is what stops a room nobody has furnished yet being a cave — and is why it cannot simply be
// deleted: a room comes out of generation with no lamps in it at all, and a player who cannot see
// cannot place the first one.
//
// The handover runs on a curve that saturates rather than on a ramp to some "fully lit" mark,
// because how much light stands in a place spans a couple of orders of magnitude between standing
// under a lamp and standing across the room from one. A ramp over that range is not a ramp at all:
// it is a switch, thrown within a step of every lamp and flat everywhere else, and what the player
// sees is his own lamp surging back on as he walks away from a light. A saturating curve has no such
// point to cross.
const pointLightRoomHalfBrightness = 0.15;

// How far the fog was tuned to close in over, in world units — the reach of a view from the
// player's own eye. A camera taken further back than this is looking at more room than the fog was
// written for, so the fog is pushed out in proportion (see refreshFog).
const referenceFogViewDistance = 8;

// What the settings above are applied to, kept here rather than passed together because they arrive
// from different places and all decide the same one thing.
let currViewDistance = 0;
const currRoomLightAtCamera = new THREE.Color(0, 0, 0);

// The atmosphere the room being stood in asked for. Held rather than applied and forgotten, because
// the fog has to be worked out again whenever the camera moves back, and what it is worked out from
// is this (see refreshFog).
let currRoomPrefs: RoomPrefs = RoomPrefsUtil.decode("");

// The color the lamp is in a room that lights itself none, and scratch for the blend toward the
// color of a room that does.
const pointLightBaseColor = new THREE.Color(0xffffff);
const pointLightColorTemp = new THREE.Color();

// The room's air, created once and never taken away. Toggling scene.fog between an object and null
// flips a compile-time flag in every material in the scene and recompiles the lot of them mid-frame,
// so "no fog" is a fog whose distances are past everything the camera draws rather than an absent
// one — which is exactly what an unconfigured room stores anyway (see RoomPrefsUtil).
const sceneFog = new THREE.Fog(0x000000, MAX_FOG_DISTANCE, MAX_FOG_DISTANCE * 2);

// Every other light in the room, held as data rather than as THREE.PointLights (see LightBlockMap).
// Built here, and kept for the app's whole lifetime alongside the scene and the camera, because the
// textures it owns are read by materials that are themselves never rebuilt between rooms.
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
    // Sets how far off whatever the camera is looking at is (zero for a view with nothing in
    // particular in front of it, which leaves everything as it is tuned for the player's own eye).
    //
    // Both the light the camera carries and the air it is looking through are sized from this, and
    // they are set together rather than by two callers, because they are answering the same
    // question: a camera pulled back to take in the whole room has to be able to *see* the whole
    // room. A light sized for the eye goes out past its own range, leaving the target to the
    // ambient light alone; fog sized for the eye closes over everything beyond a few paces, which
    // is a room pulled back from and then buried.
    setViewDistance: (viewDistance: number) =>
    {
        if (viewDistance === currViewDistance)
            return;
        currViewDistance = viewDistance;
        refreshPointLight();
        refreshFog();
    },
    // Sets what light the room's own lamps are already putting on the spot the camera is looking
    // from, so that the light it carries can stand out of their way (see refreshPointLight).
    setPointLightSurroundings: (roomLightAtCamera: THREE.Color) =>
    {
        if (currRoomLightAtCamera.equals(roomLightAtCamera))
            return;
        currRoomLightAtCamera.copy(roomLightAtCamera);
        refreshPointLight();
    },
    // Sets the atmosphere the room is seen in: what light fills it, what light the player carries
    // while standing in it, and what the air between the two is like. Everything here is the room's
    // own decision (see RoomPrefsUtil), which is why it arrives in one piece — the settings agree
    // with each other, and applying half of one room's and half of another's would look like
    // neither.
    setRoomLightingPrefs: (prefs: RoomPrefs) =>
    {
        currRoomPrefs = prefs;

        ambLight.color.set(getPaletteColor(LIGHT_COLOR_PALETTE_NAME, prefs.ambientColorIndex));
        ambLight.intensity = RoomPrefsUtil.getAmbientIntensity(prefs);

        pointLightBaseColor.set(getPaletteColor(LIGHT_COLOR_PALETTE_NAME, prefs.headLightColorIndex));
        basePointLightIntensity = HeadLightPowerUtil.getIntensity(prefs.headLightPowerStep);
        basePointLightDistance = HeadLightPowerUtil.getDistance(prefs.headLightPowerStep);
        pointLightDecay = HeadLightPowerUtil.getDecay(prefs.headLightPowerStep);
        refreshPointLight();

        sceneFog.color.set(getPaletteColor(FOG_COLOR_PALETTE_NAME, prefs.fogColorIndex));
        // The void beyond the far plane is painted in the fog's own color rather than in black.
        // They are the same surface as far as the eye is concerned: whatever has faded completely
        // into the air is standing directly in front of the emptiness past the room, and if the two
        // disagree the horizon is a visible seam rather than a distance.
        gameRenderer.setClearColor(sceneFog.color);
        refreshFog();
    },
    update: (currFPS: number) =>
    {
        const performanceScore = Math.max(
            0,
            Math.min(
                1,
                (currFPS - minPixelRatioTargetFPS) / (maxPixelRatioTargetFPS - minPixelRatioTargetFPS)
            )
        ); // 1 = best, 0 = worst

        let desiredPixelRatio = minPixelRatio + (maxPixelRatio - minAspectRatio) * performanceScore;
        desiredPixelRatio = Math.round(desiredPixelRatio * 10) * 0.1; // round up to 1 decimal digit.
        if (Math.abs(desiredPixelRatio - currPixelRatio) >= 0.2)
        {
            gameRenderer.setPixelRatio(desiredPixelRatio);
            currPixelRatio = desiredPixelRatio;
            //console.log(desiredPixelRatio);
        }
        // Consumed once a frame rather than the moment something changes, so that dragging a lamp
        // across the room costs one propagation per frame rather than one per transform update.
        lightBlockMap.update();
        gameRenderer.render(scene, camera);
        overlayRenderer.render(scene, camera);
    },
    // Compiles the shader programs for every material currently in the scene (using the
    // KHR_parallel_shader_compile extension when available). Called during the room-loading screen
    // so the one-time shader-compilation cost is paid up front, rather than stalling the first
    // frame a given material is drawn (e.g. the first time a world-space gizmo appears).
    precompileSceneShaders: async () =>
    {
        await gameRenderer.compileAsync(scene, camera);
    },
    load: async (updateCallback: XRFrameRequestCallback | null) =>
    {
        // Core elements — created once and reused for every subsequent room (see graphicsInitialized).
        if (!graphicsInitialized)
        {
            gameCanvasRoot = document.getElementById("gameCanvasRoot") as HTMLElement;
            overlayCanvasRoot = document.getElementById("overlayCanvasRoot") as HTMLElement;

            scene = new THREE.Scene();
            scene.fog = sceneFog;

            // Both its color and its strength are the room's to choose (see
            // setRoomLightingPrefs); what it is created with is what a room that has said nothing
            // asks for, which is what it has always been.
            ambLight = new THREE.AmbientLight(0xffffff,
                RoomPrefsUtil.getAmbientIntensity(currRoomPrefs));
            scene.add(ambLight);

            camera = new THREE.PerspectiveCamera(60, 1, 0.1, 45); // 45 = roughly the maximum diagonal distance from one corner of the room to the other (Room comprises a 32x32 voxel grid)

            // The point light is parented to the camera (so it follows the player's view) and, like the
            // camera, is created once and reused for the app's whole lifetime — never re-created per room.
            pointLight = new THREE.PointLight(0xffffff, basePointLightIntensity,
                basePointLightDistance, pointLightDecay);
            pointLight.position.set(0, 1, 0);
            camera.add(pointLight);

            gameRenderer = new THREE.WebGLRenderer({ antialias: true });
            gameRenderer.shadowMap.enabled = true;
            // Black only until a room says otherwise: the void past the far plane is painted in
            // whatever the room's fog is (see setRoomLightingPrefs).
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
            // A context lost while the page was away is only worth chasing once the page is back
            // (see scheduleContextRestoreCheck), so returning to the foreground starts the wait.
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible")
                    scheduleContextRestoreCheck();
            });

            logPageLifecycleEvents();

            graphicsInitialized = true;
        }

        window.addEventListener("resize", onResize);
        updateRenderSizes();

        // Update Loop

        gameRenderer.setAnimationLoop(updateCallback);
    },
    unload: async () =>
    {
        // The scene, camera, lighting, and graphical assets are intentionally preserved across rooms
        // and reused (see graphicsInitialized). Only the per-room rendering hooks are torn down here;
        // obsolete assets are disposed explicitly at the point of change (e.g. the voxel texture pack).
        window.removeEventListener("resize", onResize);
        gameRenderer.setAnimationLoop(null);
    },
}

// Works the head lamp out afresh from everything that has a say in it. Both of its callers set one
// of those things and leave the other alone, so neither can settle the light on its own.
//
// A light sized for the eye goes out the moment the camera is taken further back than its range:
// past that range a point light contributes nothing at all, and whatever is being looked at would be
// left to the ambient light alone. Widening the range on its own would only spread the same light
// more thinly, since what a point light delivers falls off over distance — so the intensity follows
// the range by exactly the falloff the light decays by, which leaves the target as bright as it was
// from up close. The room's own lamps then take back as much of what is left as they are lighting
// the player with already.
function refreshPointLight()
{
    const range = Math.max(basePointLightDistance,
        pointLightRangePerViewDistance * currViewDistance);

    // How much of what lights the player is the room's own doing, from none of it in the dark to
    // very nearly all of it under a lamp. Both of the things below follow from this one number.
    const roomLuminance = 0.2126 * currRoomLightAtCamera.r +
        0.7152 * currRoomLightAtCamera.g + 0.0722 * currRoomLightAtCamera.b;
    const roomShare = roomLuminance / (roomLuminance + pointLightRoomHalfBrightness);

    // Whatever share of the lighting the room is not doing itself, and nothing beyond it. There is
    // no floor held back for the near field: a lamp kept burning under a room that is already lit is
    // exactly what was washing that room's own colors out, and white light close up drags a
    // saturated surface toward grey however little of it there is.
    pointLight.distance = range;
    pointLight.intensity = basePointLightIntensity *
        Math.pow(range / basePointLightDistance, pointLightDecay) * (1 - roomShare);

    // And it takes on the color of whatever is already lighting the player, as far as the room is
    // doing the lighting. Turning it down is not enough on its own: what washes a warm wall out is
    // not how much the head lamp adds but that what it adds is white, and even a quarter of a white
    // lamp pulls a saturated color a long way toward grey up close. Light of the room's own color
    // deepens what is there instead of diluting it, which lets it keep enough strength to still be
    // the near-field depth cue it exists to be.
    pointLightColorTemp.copy(pointLightBaseColor);
    const peak = Math.max(currRoomLightAtCamera.r,
        Math.max(currRoomLightAtCamera.g, currRoomLightAtCamera.b));
    if (peak > 0)
    {
        // Normalized to its brightest channel, since what is wanted from the room is its color and
        // not its strength — the strength is already spoken for above.
        pointLightColorTemp.lerpColors(pointLightBaseColor,
            colorTemp.setRGB(currRoomLightAtCamera.r / peak, currRoomLightAtCamera.g / peak,
                currRoomLightAtCamera.b / peak, THREE.LinearSRGBColorSpace),
            roomShare);
    }
    pointLight.color.copy(pointLightColorTemp);
}

// Works the fog out afresh from what the room asked for and how far back the camera has been taken.
//
// The room's two distances are what the air is like seen from where a player stands. A camera taken
// further back than that is not in a different room, but it is looking across more of one, and fog
// held at the distances a standing player was given would close over everything between the camera
// and what it was pulled back to look at. So the whole of it is pushed out in proportion — never
// pulled in, since a camera closer than the reach the fog was written for is still a player standing
// in the room and should see it exactly as he does.
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

function onResize(ev: UIEvent)
{
    updateRenderSizes();
}

// A mobile browser reclaims the GPU memory behind a tab it has put in the background, and the
// drawing context goes with it. The renderer will not draw without one, while the DOM-based UI
// carries on regardless — which is precisely what a 3D view gone black underneath a perfectly live
// HUD looks like.
//
// Recovering in place is preferred to reloading. The browser normally hands the context back once
// the page is in the foreground again, and the renderer rebuilds itself from the scene when it
// does, so the socket, the room and the player's position all survive untouched — where a reload
// would spend several seconds re-authenticating, re-joining and re-fetching every asset. The
// context is also lost for reasons that have nothing to do with a long absence (a brief app switch,
// a moment of memory pressure), and those must not cost the user their session.
//
// Reloading is what happens only when recovering in place has demonstrably not worked.
function onContextLost()
{
    contextLost = true;
    console.warn("WebGL context lost. Waiting for the browser to restore it.");
    // three.js has already asked the browser for the context back, by taking the event's default
    // action away; there is nothing left to do but wait, visibly rather than behind a black screen.
    tryStartClientProcess(contextRecoveryProcessName, 1, 0);
    scheduleContextRestoreCheck();
}

function onContextRestore()
{
    contextLost = false;
    console.warn("WebGL context restored.");
    if (ongoingClientProcessExists(contextRecoveryProcessName))
        endClientProcess(contextRecoveryProcessName);

    // The block map's textures are backed by buffers held on this side, so they come back by being
    // written again — which the next propagation does anyway.
    lightBlockMap.requestRecomputation();

    // Geometries, materials and image-backed textures all come back from the copies the scene holds
    // of them. Render targets do not — they only ever existed on the GPU — so whatever was drawn
    // into one has to be drawn again by whoever drew it.
    graphicsContextRestoredObservable.change(numRestorations => numRestorations + 1);
}

// Gives the browser its grace period and, if the context still has not come back by the end of it,
// gives up and reloads the page.
//
// The countdown only means anything while the page is actually in front of the user: a hidden page
// is one the browser has no reason to give a context back to yet, and reloading one would spend a
// fresh page load on a tab nobody is looking at. So the wait does not start while the page is
// hidden, and a wait that finds the page hidden again simply steps aside — returning to the
// foreground starts a new one, which is also what gives the browser a full grace period counted
// from the moment it could first act, rather than from a moment that passed while the page slept.
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

        // On a device that has genuinely run out of GPU memory, a reload can fail exactly as the
        // page it replaced did: it arrives, loses the context again, and reloads again a grace
        // period later. So a reload that would follow too closely on the last one is not performed.
        // The page stays as it is instead — the loading indicator still up, waiting on a restore
        // that may yet arrive — which at least leaves the session and the UI intact, rather than
        // spending them on another few seconds of arriving back in the same place.
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
        // Storage can be refused outright (private browsing, a blocked storage context). Without it
        // there is no way to tell a repetition from a first attempt, and of the two mistakes an
        // occasional extra reload is the lesser one, so this answers as though nothing had happened.
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
        // See reloadedRecently — with no storage to write to, the reload simply goes unrecorded.
    }
}

// Records, rather than acts upon, the moments at which the browser puts the page away and brings it
// back. A 3D view that has gone blank while the rest of the app is plainly still alive is what a
// mobile browser reclaiming a backgrounded tab's drawing context looks like from the inside, and
// these entries are what tell that apart from the page having been frozen, restored from the
// browser's cache, or reloaded outright — none of which the app can otherwise see after the fact.
// The trail is left in the console, and so ends up in the record the "log" debug command reads back.
function logPageLifecycleEvents()
{
    for (const eventName of ["visibilitychange", "freeze", "resume"])
        document.addEventListener(eventName, () => logPageLifecycleEvent(eventName));
    for (const eventName of ["pageshow", "pagehide"])
        window.addEventListener(eventName, () => logPageLifecycleEvent(eventName));
}

function logPageLifecycleEvent(eventName: string)
{
    // Whether the drawing context is still there is the whole question, so it is asked of the
    // context itself at each of these moments rather than taken from what this module believes.
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