import * as THREE from "three";
import MeshFactory from "../../../factories/meshFactory";

// After everything else that is opaque, the sky included (see SKY_RENDER_ORDER): it tests no depth, so
// whatever was drawn after it would cover it.
const RENDER_ORDER = 9997;

// A box drawn by its twelve edges, each a pixel thick and always on top (e.g. the cell the selected block
// stands in).
export default class WorldSpaceWireBox
{
    private lines: THREE.LineSegments;

    private constructor(lines: THREE.LineSegments)
    {
        this.lines = lines;
        this.lines.renderOrder = RENDER_ORDER;
        this.lines.visible = false;
    }

    static async create(color: string): Promise<WorldSpaceWireBox>
    {
        // A copy to place and to color: the factory's own is shared, as its geometry still is.
        const lines = (await MeshFactory.loadLineSegments("Box", color)).clone();
        lines.material = (lines.material as THREE.LineBasicMaterial).clone();
        return new WorldSpaceWireBox(lines);
    }

    addToParent(parent: THREE.Object3D): void
    {
        parent.add(this.lines);
    }

    setVisible(visible: boolean): void
    {
        this.lines.visible = visible;
    }

    setBox(center: THREE.Vector3, size: THREE.Vector3): void
    {
        this.lines.position.copy(center);
        this.lines.scale.copy(size);
    }

    setColor(color: string): void
    {
        (this.lines.material as THREE.LineBasicMaterial).color.set(color);
    }
}
