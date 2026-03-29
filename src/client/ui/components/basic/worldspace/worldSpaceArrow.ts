import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import GeometryFactory from "../../../../graphics/factories/geometryFactory";
import { DIRECTION_VECTORS } from "../../../../../client/system/clientConstants";

const tempQuat = new THREE.Quaternion();

// A world-space arrow rendered as a 3D mesh (cone head + cylinder shaft).
// Uses depthTest:false to always render on top of scene geometry.
// A small invisible CSS2DObject is used as a click target overlay.
export default class WorldSpaceArrow
{
    private group: THREE.Group = new THREE.Group();
    private arrowAssembly: THREE.Group;
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
        scale: number = 1,
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
        
        const up = DIRECTION_VECTORS["+y"];

        // Rotate arrowAssembly from default +Y to the desired direction
        const dir = DIRECTION_VECTORS[arrowDirection] || up;
        if (dir.y < -0.99)
        {
            // Special case: pointing straight down — rotate 180° around X
            arrowAssembly.quaternion.setFromAxisAngle(DIRECTION_VECTORS["+x"], Math.PI);
        }
        else if (dir.y < 0.99)
        {
            tempQuat.setFromUnitVectors(up, dir);
            arrowAssembly.quaternion.copy(tempQuat);
        }
        // If dir is +Y, no rotation needed.

        arrowAssembly.scale.setScalar(scale);
        this.arrowAssembly = arrowAssembly;
        this.group.add(arrowAssembly);

        // Invisible CSS2D click target (DOM element overlay for pointer events)
        const clickSize = 2 * scale;
        this.clickElement = document.createElement("div");
        this.clickElement.style.cssText =
            "cursor:pointer; pointer-events:auto; width:" + clickSize + "rem; height:" + clickSize + "rem;" +
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

    static async create(arrowDirection: string, color: string = "#00ff00", scale: number = 1): Promise<WorldSpaceArrow>
    {
        const [coneGeometry, cylinderGeometry] = await Promise.all([
            GeometryFactory.load("ArrowCone"),
            GeometryFactory.load("ArrowCylinder"),
        ]);
        return new WorldSpaceArrow(arrowDirection, color, coneGeometry, cylinderGeometry, scale);
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

    setDirection(dir: THREE.Vector3): void
    {
        const up = DIRECTION_VECTORS["+y"];
        if (dir.y < -0.99)
        {
            this.arrowAssembly.quaternion.setFromAxisAngle(DIRECTION_VECTORS["+x"], Math.PI);
        }
        else if (dir.y < 0.99)
        {
            tempQuat.setFromUnitVectors(up, dir);
            this.arrowAssembly.quaternion.copy(tempQuat);
        }
        else
        {
            this.arrowAssembly.quaternion.identity();
        }
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
