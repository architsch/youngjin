import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import GeometryFactory from "../../../../graphics/factories/geometryFactory";
import Vec3 from "../../../../../shared/math/types/vec3";
import WorldSpaceOutlineRect from "./worldSpaceOutlineRect";

// An always-on-top outline of a box in the room, along its own edges: WorldSpaceOutlineRect's counterpart for a
// thing with depth. Drawn in that outline's two lines, of which the glow can be left off for a plainer one.
export default class WorldSpaceOutlineBox
{
    private group: THREE.Group = new THREE.Group();
    private coreLine: LineSegments2;
    private haloLine: LineSegments2;
    private coreMaterial: LineMaterial;
    private haloMaterial: LineMaterial;
    private baseColor: THREE.Color = new THREE.Color();
    private brightness: number = 1;

    private constructor(geometry: LineSegmentsGeometry, color: string)
    {
        this.baseColor.set(color);
        this.haloMaterial = WorldSpaceOutlineRect.makeHaloMaterial(color);
        this.coreMaterial = WorldSpaceOutlineRect.makeCoreMaterial(color);

        // Halo draws first (lower render order) so the crisp core sits on top of its glow.
        this.haloLine = new LineSegments2(geometry, this.haloMaterial);
        this.haloLine.renderOrder = 9998;
        this.haloLine.frustumCulled = false;

        this.coreLine = new LineSegments2(geometry, this.coreMaterial);
        this.coreLine.renderOrder = 9999;
        this.coreLine.frustumCulled = false;

        this.group.add(this.haloLine);
        this.group.add(this.coreLine);
        this.group.visible = false;
    }

    static async create(color: string): Promise<WorldSpaceOutlineBox>
    {
        // setPositions copies the cached geometry's data.
        const edges = await GeometryFactory.load("Box", "edges");
        const geometry = new LineSegmentsGeometry();
        geometry.setPositions((edges.attributes.position as THREE.BufferAttribute).array as Float32Array);
        return new WorldSpaceOutlineBox(geometry, color);
    }

    addToParent(parent: THREE.Object3D): void
    {
        parent.add(this.group);
    }

    setVisible(visible: boolean): void
    {
        this.group.visible = visible;
    }

    // Line widths are in world units, so the group's scale is the box's own size.
    setBox(center: Vec3, size: Vec3): void
    {
        this.group.position.set(center.x, center.y, center.z);
        this.group.scale.set(size.x, size.y, size.z);
    }

    // color at a brightness (0..1), with or without the glow around the line.
    setLook(color: string, brightness: number, glowing: boolean): void
    {
        this.haloLine.visible = glowing;
        if (this.brightness == brightness && this.baseColor.getHexString() == new THREE.Color(color).getHexString())
            return;
        this.baseColor.set(color);
        this.brightness = brightness;
        this.coreMaterial.color.copy(this.baseColor).multiplyScalar(brightness);
        this.haloMaterial.color.copy(this.baseColor).multiplyScalar(brightness);
    }

    dispose(): void
    {
        this.group.removeFromParent();
        this.coreMaterial.dispose();
        this.haloMaterial.dispose();
        this.coreLine.geometry.dispose(); // shared with haloLine
    }
}
