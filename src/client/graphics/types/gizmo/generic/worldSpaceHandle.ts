import * as THREE from "three";
import GeometryFactory from "../../../factories/geometryFactory";
import GraphicsManager from "../../../graphicsManager";

const cameraPosTemp = new THREE.Vector3();
const cameraQuatTemp = new THREE.Quaternion();

const HIGHLIGHT_GROWTH = 1.3;

// A round, always-on-top grip in world space (e.g. a resize handle on a selection outline), the same size
// on screen at any distance. It only shows; hit-testing belongs to whatever placed it (see GizmoDragUtil).
export default class WorldSpaceHandle
{
    private disc: THREE.Mesh;
    private material: THREE.MeshBasicMaterial;
    private diameterPx: number;
    private highlighted: boolean = false;

    private constructor(geometry: THREE.BufferGeometry, color: string, diameterPx: number)
    {
        this.material = new THREE.MeshBasicMaterial({
            color, depthTest: false, depthWrite: false, transparent: true});
        this.disc = new THREE.Mesh(geometry, this.material);
        // Above the selection outline's lines (see WorldSpaceOutlineRect), which it sits on.
        this.disc.renderOrder = 10000;
        this.disc.visible = false;
        this.diameterPx = diameterPx;
    }

    // diameterPx is in CSS px.
    static async create(color: string, diameterPx: number): Promise<WorldSpaceHandle>
    {
        return new WorldSpaceHandle(await GeometryFactory.load("Disc"), color, diameterPx);
    }

    addToParent(parent: THREE.Object3D): void
    {
        parent.add(this.disc);
    }

    setPosition(position: THREE.Vector3): void
    {
        this.disc.position.copy(position);
    }

    setVisible(visible: boolean): void
    {
        this.disc.visible = visible;
    }

    // Shown larger, e.g. while it is being dragged.
    setHighlighted(highlighted: boolean): void
    {
        this.highlighted = highlighted;
    }

    // Faces the camera and keeps its size on screen; call each frame while shown.
    update(): void
    {
        if (!this.disc.visible)
            return;

        const camera = GraphicsManager.getCamera();
        camera.getWorldPosition(cameraPosTemp);
        camera.getWorldQuaternion(cameraQuatTemp);
        this.disc.quaternion.copy(cameraQuatTemp);

        const canvasHeightPx = Math.max(1, GraphicsManager.getGameCanvas().clientHeight);
        const worldPerPx = 2 * this.disc.position.distanceTo(cameraPosTemp)
            * Math.tan(THREE.MathUtils.degToRad(0.5 * camera.fov)) / canvasHeightPx;
        this.disc.scale.setScalar(this.diameterPx * worldPerPx * (this.highlighted ? HIGHLIGHT_GROWTH : 1));
    }

    // The disc geometry is the factory's, shared with every other handle.
    dispose(): void
    {
        this.disc.removeFromParent();
        this.material.dispose();
    }
}
