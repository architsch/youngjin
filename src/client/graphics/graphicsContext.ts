import * as THREE from "three";

const minAspectRatio = 0.6;
const maxAspectRatio = 2;

export default class GraphicsContext
{
    canvasRoot: HTMLElement;
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    ambLight: THREE.AmbientLight;
    dirLight: THREE.DirectionalLight;
    camera: THREE.PerspectiveCamera;

    constructor()
    {
        this.canvasRoot = document.body;

        this.scene = new THREE.Scene();

        this.ambLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(this.ambLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.dirLight.position.set(3, 3, 0);
        this.dirLight.target.position.set(0, 0, 0);
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setClearColor("#000000");
        this.renderer.domElement.style.position = "absolute";
        this.renderer.domElement.style.margin = "auto auto";
        this.renderer.domElement.style.top = "0";
        this.renderer.domElement.style.bottom = "0";
        this.renderer.domElement.style.left = "0";
        this.renderer.domElement.style.right = "0";
        this.renderer.domElement.style.touchAction = "none";
        this.canvasRoot.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

        window.addEventListener("resize", (ev: UIEvent) => {
            this.updateRenderSizes();
        });
        this.updateRenderSizes();

        const wipIndicator = document.createElement("p");
        wipIndicator.id = "wipIndicator";
        wipIndicator.style = "position: absolute; top: 0; left: 0; right: 0; margin: 0 auto; text-align: center; background-color: black; color: white;";
        wipIndicator.innerHTML = "<b>This page is under construction.</b>";
        this.canvasRoot.appendChild(wipIndicator);

        const pointerInputInstruction = document.createElement("h1");
        pointerInputInstruction.id = "pointerInputInstruction";
        pointerInputInstruction.style = "position: absolute; top: 0; bottom: 0; left: 0; right: 0; margin: auto auto; padding: 5vmin 5vmin; width: fit-content; height: fit-content; text-align: center; background-color: rgba(0, 0, 0, 0.5); pointer-events: none; border-radius: 6vmin;";
        pointerInputInstruction.innerHTML = "<b>Drag to Move</b>";
        this.canvasRoot.appendChild(pointerInputInstruction);
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

        this.renderer.setSize(desiredWidth, desiredHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.camera.aspect = desiredAspectRatio;
        this.camera.updateProjectionMatrix();
    }
}