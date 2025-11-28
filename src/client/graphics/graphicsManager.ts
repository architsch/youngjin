import * as THREE from "three";
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import TextureFactory from "./factories/textureFactory";
import MaterialFactory from "./factories/materialFactory";
import ModelFactory from "./factories/modelFactory";
import GeometryFactory from "./factories/geometryFactory";
import MeshFactory from "./factories/meshFactory";

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
let camera: THREE.PerspectiveCamera;

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
    load: async (updateCallback: XRFrameRequestCallback | null) =>
    {
        gameCanvasRoot = document.getElementById("gameCanvasRoot") as HTMLElement;
        overlayCanvasRoot = document.getElementById("overlayCanvasRoot") as HTMLElement;

        scene = new THREE.Scene();

        ambLight = new THREE.AmbientLight(0xffffff, 0.15);
        scene.add(ambLight);

        camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

        if (!gameRenderer)
        {
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
        }

        if (!overlayRenderer)
        {
            overlayRenderer = new CSS2DRenderer();
            overlayRenderer.domElement.style.position = "absolute";
            overlayRenderer.domElement.style.margin = "auto auto";
            overlayRenderer.domElement.style.top = "0";
            overlayRenderer.domElement.style.bottom = "0";
            overlayRenderer.domElement.style.left = "0";
            overlayRenderer.domElement.style.right = "0";
            overlayRenderer.domElement.style.touchAction = "none";
            overlayCanvasRoot.appendChild(overlayRenderer.domElement);
        }

        window.addEventListener("resize", onResize);
        updateRenderSizes();

        // Update Loop
        gameRenderer.setAnimationLoop(updateCallback);
    },
    unload: async () =>
    {
        scene.remove();
        camera.remove();
        window.removeEventListener("resize", onResize);
        gameRenderer.setAnimationLoop(null);

        TextureFactory.unloadAll();
        MaterialFactory.unloadAll();
        GeometryFactory.unloadAll();
        MeshFactory.unloadAll();
        ModelFactory.unloadAll();
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