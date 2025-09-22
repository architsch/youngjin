import * as THREE from "three";

export default class GraphicsContext
{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    ambLight: THREE.AmbientLight;
    dirLight: THREE.DirectionalLight;
    camera: THREE.PerspectiveCamera;

    constructor()
    {
        const canvasRoot = document.getElementById("canvasRoot");
        if (!canvasRoot)
        {
            const err = "canvasRoot not found."
            alert(err);
            throw new Error(err);
        }

        const logicalWidth = 800;
        const logicalHeight = 400;

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
        this.renderer.setSize(logicalWidth, logicalHeight);
        canvasRoot.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        const domElement = this.renderer.domElement;
        domElement.addEventListener("resize", (ev: UIEvent) => {
            this.camera.aspect = domElement.clientWidth / domElement.clientHeight;
        });
    }
}