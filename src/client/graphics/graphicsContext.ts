import * as THREE from "three";
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const minAspectRatio = 0.6;
const maxAspectRatio = 2;

export default class GraphicsContext
{
    gameCanvasRoot: HTMLElement;
    overlayCanvasRoot: HTMLElement;

    gameRenderer: THREE.WebGLRenderer;
    overlayRenderer: CSS2DRenderer;

    scene: THREE.Scene;
    ambLight: THREE.AmbientLight;
    dirLight: THREE.DirectionalLight;
    camera: THREE.PerspectiveCamera;

    constructor()
    {
        this.gameCanvasRoot = document.getElementById("gameCanvasRoot") as HTMLElement;
        this.overlayCanvasRoot = document.getElementById("overlayCanvasRoot") as HTMLElement;

        this.scene = new THREE.Scene();

        this.ambLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(this.ambLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.dirLight.position.set(3, 3, 0);
        this.dirLight.target.position.set(0, 0, 0);
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);

        this.gameRenderer = new THREE.WebGLRenderer();
        this.gameRenderer.setClearColor("#000000");
        this.gameRenderer.domElement.style.position = "absolute";
        this.gameRenderer.domElement.style.margin = "auto auto";
        this.gameRenderer.domElement.style.top = "0";
        this.gameRenderer.domElement.style.bottom = "0";
        this.gameRenderer.domElement.style.left = "0";
        this.gameRenderer.domElement.style.right = "0";
        this.gameRenderer.domElement.style.touchAction = "none";
        this.gameCanvasRoot.appendChild(this.gameRenderer.domElement);

        this.overlayRenderer = new CSS2DRenderer();
        this.overlayRenderer.domElement.style.position = "absolute";
        this.overlayRenderer.domElement.style.margin = "auto auto";
        this.overlayRenderer.domElement.style.top = "0";
        this.overlayRenderer.domElement.style.bottom = "0";
        this.overlayRenderer.domElement.style.left = "0";
        this.overlayRenderer.domElement.style.right = "0";
        this.overlayRenderer.domElement.style.touchAction = "none";
        this.overlayCanvasRoot.appendChild(this.overlayRenderer.domElement);

        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

        window.addEventListener("resize", (ev: UIEvent) => {
            this.updateRenderSizes();
        });
        this.updateRenderSizes();

        // temp UI
        const wipIndicator = document.createElement("p");
        wipIndicator.id = "wipIndicator";
        wipIndicator.style = "position: absolute; top: 0; left: 0; right: 0; margin: 0 auto; text-align: center; background-color: black; color: white;";
        wipIndicator.innerHTML = "<b>This page is under construction.</b>";
        this.gameCanvasRoot.appendChild(wipIndicator);

        // temp UI
        const pointerInputInstruction = document.createElement("h1");
        pointerInputInstruction.id = "pointerInputInstruction";
        pointerInputInstruction.style = "position: absolute; top: 0; bottom: 0; left: 0; right: 0; margin: auto auto; padding: 5vmin 5vmin; width: fit-content; height: fit-content; text-align: center; background-color: rgba(0, 0, 0, 0.5); pointer-events: none; border-radius: 6vmin;";
        pointerInputInstruction.innerHTML = "<b>Drag to Move</b>";
        this.gameCanvasRoot.appendChild(pointerInputInstruction);
    }

    update()
    {
        this.gameRenderer.render(this.scene, this.camera);
        this.overlayRenderer.render(this.scene, this.camera);
    }

    updateRenderSizes()
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

        this.gameRenderer.setSize(desiredWidth, desiredHeight);
        this.gameRenderer.setPixelRatio(window.devicePixelRatio);
        this.overlayRenderer.setSize(desiredWidth, desiredHeight);

        this.camera.aspect = desiredAspectRatio;
        this.camera.updateProjectionMatrix();
    }
}