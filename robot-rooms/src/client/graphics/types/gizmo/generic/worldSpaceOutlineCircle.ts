import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import GeometryFactory from "../../../../graphics/factories/geometryFactory";
import Vec3 from "../../../../../shared/math/types/vec3";
import WorldSpaceOutlineRect from "./worldSpaceOutlineRect";

// Rotates the upright circle to lie flat on the ground.
const flatOnGroundQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.5 * Math.PI);

// A thin, always-on-top circle lying flat in the room, e.g. how far something reaches round where it stands: the crisp
// line of WorldSpaceOutlineRect, without its glow.
export default class WorldSpaceOutlineCircle
{
    private line: LineSegments2;
    private material: LineMaterial;

    private constructor(geometry: LineSegmentsGeometry, color: string)
    {
        this.material = WorldSpaceOutlineRect.makeCoreMaterial(color);
        this.line = new LineSegments2(geometry, this.material);
        this.line.renderOrder = 9999;
        this.line.frustumCulled = false;
        this.line.quaternion.copy(flatOnGroundQuat);
        this.line.visible = false;
    }

    static async create(color: string): Promise<WorldSpaceOutlineCircle>
    {
        // setPositions copies the cached geometry's data.
        const edges = await GeometryFactory.load("Circle", "edges");
        const geometry = new LineSegmentsGeometry();
        geometry.setPositions((edges.attributes.position as THREE.BufferAttribute).array as Float32Array);
        return new WorldSpaceOutlineCircle(geometry, color);
    }

    addToParent(parent: THREE.Object3D): void
    {
        parent.add(this.line);
    }

    setVisible(visible: boolean): void
    {
        this.line.visible = visible;
    }

    // Line widths are in world units, so the line's scale is the circle's own size.
    setCircle(center: Vec3, radius: number): void
    {
        this.line.position.set(center.x, center.y, center.z);
        this.line.scale.set(2 * radius, 2 * radius, 1);
    }

    dispose(): void
    {
        this.line.removeFromParent();
        this.material.dispose();
        this.line.geometry.dispose();
    }
}
