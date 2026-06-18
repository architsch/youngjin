import * as THREE from "three";
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

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