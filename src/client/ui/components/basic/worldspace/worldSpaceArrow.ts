import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import GeometryFactory from "../../../../graphics/factories/geometryFactory";

// Direction vectors for each arrow direction label
const DIRECTION_VECTORS: {[key: string]: THREE.Vector3} = {
    "+x": new THREE.Vector3(1, 0, 0),
    "-x": new THREE.Vector3(-1, 0, 0),
    "+y": new THREE.Vector3(0, 1, 0),
    "-y": new THREE.Vector3(0, -1, 0),
    "+z": new THREE.Vector3(0, 0, 1),
    "-z": new THREE.Vector3(0, 0, -1),
};

const UP = new THREE.Vector3(0, 1, 0);
const tempQuat = new THREE.Quaternion();

// A world-space arrow rendered as a 3D mesh (cone head + cylinder shaft).
// Uses depthTest:false to always render on top of scene geometry.
// A small invisible CSS2DObject is used as a click target overlay.
export default class WorldSpaceArrow
{
    private group: THREE.Group = new THREE.Group();
    private coneMesh: THREE.Mesh;
    private cylinderMesh: THREE.Mesh;
    private clickElement: HTMLElement;
    private css2dObject: CSS2DObject;
    private onClickCallback: (() => void) | null = null;

    private constructor(
        arrowDirection: string,
        color: string,
        coneGeometry: THREE.BufferGeometry,
        cylinderGeometry: THREE.BufferGeometry,
    )
    {
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.85,
        });

        // Cone (arrow head) — default orientation is along +Y.
        // We'll offset it so the tip sits at the end of the shaft.
        this.coneMesh = new THREE.Mesh(coneGeometry, mat);
        this.coneMesh.renderOrder = 9999;
        this.coneMesh.position.set(0, 0.095, 0); // tip of shaft

        // Cylinder (shaft)
        this.cylinderMesh = new THREE.Mesh(cylinderGeometry, mat);
        this.cylinderMesh.renderOrder = 9999;
        this.cylinderMesh.position.set(0, 0, 0); // centered at group origin

        // Build a sub-group so we can rotate the whole arrow to face the desired direction.
        const arrowAssembly = new THREE.Group();
        arrowAssembly.add(this.cylinderMesh);
        arrowAssembly.add(this.coneMesh);

        // Rotate arrowAssembly from default +Y to the desired direction
        const dir = DIRECTION_VECTORS[arrowDirection] || UP;
        if (dir.y < -0.99)
        {
            // Special case: pointing straight down — rotate 180° around X
            arrowAssembly.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        }
        else if (dir.y < 0.99)
        {
            tempQuat.setFromUnitVectors(UP, dir);
            arrowAssembly.quaternion.copy(tempQuat);
        }
        // If dir is +Y, no rotation needed.

        this.group.add(arrowAssembly);

        // Invisible CSS2D click target (DOM element overlay for pointer events)
        this.clickElement = document.createElement("div");
        this.clickElement.style.cssText =
            "cursor:pointer; pointer-events:auto; width:1.4rem; height:1.4rem;" +
            "border-radius:50%; background:transparent;";

        this.clickElement.addEventListener("pointerenter", () => {
            mat.opacity = 1.0;
        });
        this.clickElement.addEventListener("pointerleave", () => {
            mat.opacity = 0.85;
        });
        this.clickElement.addEventListener("click", (ev) => {
            ev.stopPropagation();
            if (this.onClickCallback)
                this.onClickCallback();
        });

        this.css2dObject = new CSS2DObject(this.clickElement);
        this.css2dObject.center.set(0.5, 0.5);
        this.group.add(this.css2dObject);
    }

    static async create(arrowDirection: string, color: string = "#00ff00"): Promise<WorldSpaceArrow>
    {
        const [coneGeometry, cylinderGeometry] = await Promise.all([
            GeometryFactory.load("ArrowCone"),
            GeometryFactory.load("ArrowCylinder"),
        ]);
        return new WorldSpaceArrow(arrowDirection, color, coneGeometry, cylinderGeometry);
    }

    addToParent(parent: THREE.Object3D): void
    {
        parent.add(this.group);
    }

    removeFromParent(): void
    {
        this.group.removeFromParent();
    }

    setPosition(x: number, y: number, z: number): void
    {
        this.group.position.set(x, y, z);
    }

    setVisible(visible: boolean): void
    {
        this.group.visible = visible;
        this.clickElement.style.display = visible ? "block" : "none";
    }

    setOnClick(callback: (() => void) | null): void
    {
        this.onClickCallback = callback;
    }

    dispose(): void
    {
        this.clickElement.remove();
        this.css2dObject.removeFromParent();
        (this.coneMesh.material as THREE.Material).dispose();
        this.group.removeFromParent();
    }
}
