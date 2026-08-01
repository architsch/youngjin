import * as THREE from "three";
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { graphicsContextRestoredObservable } from "../system/clientObservables";
import { endClientProcess, ongoingClientProcessExists, tryStartClientProcess } from "../system/types/clientProcess";
import { MINUTE_IN_MS } from "../../shared/system/sharedConstants";

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

const GraphicsManager =
{
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

            ambLight = new THREE.AmbientLight(0xffffff, 0.15);
            scene.add(ambLight);

            camera = new THREE.PerspectiveCamera(60, 1, 0.1, 45); // 45 = roughly the maximum diagonal distance from one corner of the room to the other (Room comprises a 32x32 voxel grid)

            // The point light is parented to the camera (so it follows the player's view) and, like the
            // camera, is created once and reused for the app's whole lifetime — never re-created per room.
            pointLight = new THREE.PointLight(0xffffff, 4.0, 16, 0.5);
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