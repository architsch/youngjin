import * as THREE from "three";
import MeshFactory from "../../../../graphics/factories/meshFactory";

const vecTemp = new THREE.Vector3();

// A world-space rectangular outline rendered as line segments (the edges of a unit square).
// Used to highlight a flat region in 3D space (e.g. a voxel-quad boundary). It owns its own
// material so its brightness can be animated independently of any other outline, and it uses
// depthTest:false so it always renders on top of scene geometry.
export default class WorldSpaceOutlineRect
{
    private lineSegments: THREE.LineSegments;
    private material: THREE.LineBasicMaterial;
    private baseColor: THREE.Color = new THREE.Color();

    private constructor(lineSegments: THREE.LineSegments, color: string)
    {
        this.baseColor.set(color);
        this.material = new THREE.LineBasicMaterial({ color: color, depthTest: false, transparent: true });
        lineSegments.material = this.material;
        lineSegments.renderOrder = 9999;
        lineSegments.visible = false;
        this.lineSegments = lineSegments;
    }

    static async create(color: string = "#00ff00"): Promise<WorldSpaceOutlineRect>
    {
        // The shared "Square" line segments are cached by MeshFactory; clone so this instance
        // gets its own object (and its own material, assigned in the constructor).
        const shared = await MeshFactory.loadLineSegments("Square", color);
        return new WorldSpaceOutlineRect(shared.clone(), color);
    }

    addToParent(parent: THREE.Object3D): void
    {
        parent.add(this.lineSegments);
    }

    setVisible(visible: boolean): void
    {
        this.lineSegments.visible = visible;
    }

    isVisible(): boolean
    {
        return this.lineSegments.visible;
    }

    // Positions, orients, and scales the outline. `lookDir` is the outward normal that the
    // square's face should point along.
    setTransform(position: THREE.Vector3, lookDir: THREE.Vector3, scale: THREE.Vector3): void
    {
        this.lineSegments.scale.copy(scale);
        this.lineSegments.position.copy(position);
        vecTemp.copy(position).add(lookDir);
        this.lineSegments.lookAt(vecTemp);
    }

    // A 0..1 multiplier applied to the base color, used to animate the outline's brightness.
    setBrightness(brightness: number): void
    {
        this.material.color.copy(this.baseColor).multiplyScalar(brightness);
    }

    dispose(): void
    {
        this.lineSegments.removeFromParent();
        this.material.dispose();
    }
}
