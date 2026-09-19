import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial, LineMaterialParameters } from "three/examples/jsm/lines/LineMaterial.js";
import GeometryFactory from "../../../../graphics/factories/geometryFactory";

const vecTemp = new THREE.Vector3();

// Widths in world units. A crisp core plus a wider additive halo that fades to its edge (a cheap glow).
// Fat lines (LineSegments2) because WebGL ignores LineBasicMaterial.linewidth.
const CORE_WIDTH = 0.03;
const HALO_WIDTH = 0.16;
const HALO_OPACITY = 0.5; // peak (centre) alpha of the glow, before the edge-ward fade

// Edges sit this far outside the outlined area, so no part of the line covers the area's edge pixels.
const OUTSET = 0.5 * HALO_WIDTH;

// A glowing, always-on-top rectangle outline drawn just outside an area (e.g. a selected quad or
// object footprint). Owns its materials so its brightness animates independently.
export default class WorldSpaceOutlineRect
{
    private group: THREE.Group = new THREE.Group();
    private coreLine: LineSegments2;
    private haloLine: LineSegments2;
    private coreMaterial: LineMaterial;
    private haloMaterial: LineMaterial;
    private baseColor: THREE.Color = new THREE.Color();
    private outset: number;

    private constructor(geometry: LineSegmentsGeometry, color: string, padded: boolean)
    {
        this.baseColor.set(color);
        this.outset = padded ? OUTSET : 0;

        this.haloMaterial = WorldSpaceOutlineRect.makeMaterial(color, HALO_WIDTH, HALO_OPACITY, THREE.AdditiveBlending, true);
        this.coreMaterial = WorldSpaceOutlineRect.makeMaterial(color, CORE_WIDTH, 1, THREE.NormalBlending, false);

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

    // padded: the line sits just outside the area, clear of its edge pixels (the default). Unpadded, it
    // runs along the area's own edges, for an outline whose job is to show how far the area reaches.
    static async create(color: string = "#00ff00", padded: boolean = true): Promise<WorldSpaceOutlineRect>
    {
        // setPositions copies the cached geometry's data.
        const edges = await GeometryFactory.load("Square", "edges");
        const geometry = new LineSegmentsGeometry();
        geometry.setPositions((edges.attributes.position as THREE.BufferAttribute).array as Float32Array);
        return new WorldSpaceOutlineRect(geometry, color, padded);
    }

    private static makeMaterial(color: string, linewidth: number, opacity: number, blending: THREE.Blending, fade: boolean): LineMaterial
    {
        // @types/three omits LineMaterial's `linewidth`, so widen the params type to include it.
        const params: LineMaterialParameters & { linewidth: number } = {
            color: color,
            worldUnits: true,
            linewidth: linewidth,
            opacity: opacity,
            blending: blending,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        };
        const material = new LineMaterial(params);

        if (fade)
        {
            // `norm` is distance from the centreline / width (0 centre, 0.5 edge); fade alpha to 0 at the edge.
            material.onBeforeCompile = (shader) => {
                shader.fragmentShader = shader.fragmentShader.replace(
                    "float norm = len / linewidth;",
                    "float norm = len / linewidth;\n\t\t\t\t\talpha *= 1.0 - smoothstep( 0.0, 0.5, norm );"
                );
            };
            // Distinguish this patched program from the unpatched LineMaterial in the shader cache.
            material.customProgramCacheKey = () => "WorldSpaceOutlineRect-fadeHalo";
        }

        return material;
    }

    addToParent(parent: THREE.Object3D): void
    {
        parent.add(this.group);
    }

    setVisible(visible: boolean): void
    {
        this.group.visible = visible;
    }

    isVisible(): boolean
    {
        return this.group.visible;
    }

    // Positions, orients, and scales the outline around an area of size `scale` (x, y). `lookDir` is
    // the outward normal that the square's face should point along.
    setTransform(position: THREE.Vector3, lookDir: THREE.Vector3, scale: THREE.Vector3): void
    {
        this.setAreaScale(scale);
        this.group.position.copy(position);
        vecTemp.copy(position).add(lookDir);
        this.group.lookAt(vecTemp);
    }

    // Positions, orients, and scales the outline using an explicit orientation (e.g. to match a
    // selected object's transform), rather than deriving the orientation from a look direction.
    setTransformRaw(position: THREE.Vector3, quaternion: THREE.Quaternion, scale: THREE.Vector3): void
    {
        this.group.position.copy(position);
        this.group.quaternion.copy(quaternion);
        this.setAreaScale(scale);
    }

    // Distance from a padded outline's centre to its edge, along an axis where the area is `size` long.
    static getEdgeOffset(size: number): number
    {
        return 0.5 * size + OUTSET;
    }

    // Line widths are in world units, so the group's scale is the area's world size plus the outset.
    private setAreaScale(scale: THREE.Vector3): void
    {
        this.group.scale.set(scale.x + 2 * this.outset, scale.y + 2 * this.outset, scale.z);
    }

    // A 0..1 multiplier applied to the base color, used to animate the outline's brightness.
    setBrightness(brightness: number): void
    {
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
