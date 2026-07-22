import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial, LineMaterialParameters } from "three/examples/jsm/lines/LineMaterial.js";
import GeometryFactory from "../../../../graphics/factories/geometryFactory";

const vecTemp = new THREE.Vector3();

// Outline thickness, expressed in world units (voxels are 1 unit). Two overlapping fat lines
// are drawn: a crisp bright "core" and a wider, translucent, additively-blended "halo" that
// fakes a soft bloom/glow around the outline so it stands out from the 3D environment. Both use
// LineSegments2/LineMaterial because the WebGL implementation of THREE.LineBasicMaterial ignores
// `linewidth` (lines are always 1px). In world-units mode the width is added in view space, so a
// non-uniform object scale stretches the rectangle without distorting the border thickness.
// The halo's alpha is faded continuously from its centre to its edge in the fragment shader (see
// makeMaterial), so the glow tapers off smoothly instead of ending in a hard-edged stripe.
const CORE_WIDTH = 0.03;
const HALO_WIDTH = 0.16;  // wider than before since its outer reach now fades out to nothing
const HALO_OPACITY = 0.5; // peak (centre) alpha of the glow, before the edge-ward fade

// A world-space rectangular outline rendered as thick, glowing line segments (the edges of a unit
// square). Used to highlight a flat region in 3D space (e.g. a voxel-quad boundary, or the footprint
// of a selected object). It owns its own materials so its brightness can be animated independently
// of any other outline, and it skips the depth test so it always renders on top of scene geometry.
export default class WorldSpaceOutlineRect
{
    private group: THREE.Group = new THREE.Group();
    private coreLine: LineSegments2;
    private haloLine: LineSegments2;
    private coreMaterial: LineMaterial;
    private haloMaterial: LineMaterial;
    private baseColor: THREE.Color = new THREE.Color();

    private constructor(geometry: LineSegmentsGeometry, color: string)
    {
        this.baseColor.set(color);

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

    static async create(color: string = "#00ff00"): Promise<WorldSpaceOutlineRect>
    {
        // The shared "Square" edges geometry is cached by GeometryFactory; copy its segment
        // endpoints into a per-instance fat-line geometry (setPositions clones the data).
        const edges = await GeometryFactory.load("Square", "edges");
        const geometry = new LineSegmentsGeometry();
        geometry.setPositions((edges.attributes.position as THREE.BufferAttribute).array as Float32Array);
        return new WorldSpaceOutlineRect(geometry, color);
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
            // LineMaterial's world-units fragment shader already computes `norm` = the fragment's
            // distance from the line's centreline divided by the line width (0 at the centre, 0.5 at
            // the edge). Multiply the alpha by a smooth falloff of `norm` so the line's opacity fades
            // continuously to zero at its edge — turning the wide halo into a soft glow in a single
            // draw call, rather than the hard-edged stripe a uniform-opacity fat line produces.
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

    // Positions, orients, and scales the outline. `lookDir` is the outward normal that the
    // square's face should point along.
    setTransform(position: THREE.Vector3, lookDir: THREE.Vector3, scale: THREE.Vector3): void
    {
        this.group.scale.copy(scale);
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
        this.group.scale.copy(scale);
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
