import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial, LineMaterialParameters } from "three/examples/jsm/lines/LineMaterial.js";

// Outline thickness in world units, and the glow around it, on the same terms as
// WorldSpaceOutlineRect — the two are shown for the same reason and have to read as one family.
const CORE_WIDTH = 0.03;
const HALO_WIDTH = 0.16;
const HALO_OPACITY = 0.5;

// The arrow's outline, as the corners of a downward-pointing arrow lying in the XY plane, with its
// tip at the origin so that placing the gizmo places the point of it. One unit wide and one tall
// before scaling.
const ARROW_CORNERS: [number, number][] = [
    [0, 0],          // tip
    [-0.5, 0.5],     // left barb
    [-0.2, 0.5],     // left shoulder
    [-0.2, 1],       // left tail
    [0.2, 1],        // right tail
    [0.2, 0.5],      // right shoulder
    [0.5, 0.5],      // right barb
];

// A world-space arrow drawn as a flat, glowing outline that points straight down at whatever it is
// placed above, and turns to keep its face toward the camera as the view moves around it. Used to
// mark something that has been selected but has no surface an outline could be laid against — the
// user's own character, which is a body rather than a face of the room.
export default class WorldSpaceOutlineArrow
{
    private group: THREE.Group = new THREE.Group();
    private coreLine: LineSegments2;
    private haloLine: LineSegments2;
    private coreMaterial: LineMaterial;
    private haloMaterial: LineMaterial;

    constructor(color: string = "#00ff00", scale: number = 1)
    {
        const geometry = new LineSegmentsGeometry();
        geometry.setPositions(buildOutlineSegmentPositions());

        this.haloMaterial = makeMaterial(color, HALO_WIDTH, HALO_OPACITY, THREE.AdditiveBlending, true);
        this.coreMaterial = makeMaterial(color, CORE_WIDTH, 1, THREE.NormalBlending, false);

        // Halo draws first (lower render order) so the crisp core sits on top of its glow.
        this.haloLine = new LineSegments2(geometry, this.haloMaterial);
        this.haloLine.renderOrder = 9998;
        this.haloLine.frustumCulled = false;

        this.coreLine = new LineSegments2(geometry, this.coreMaterial);
        this.coreLine.renderOrder = 9999;
        this.coreLine.frustumCulled = false;

        this.group.add(this.haloLine);
        this.group.add(this.coreLine);
        this.group.scale.setScalar(scale);
        this.group.visible = false;
    }

    addToParent(parent: THREE.Object3D): void
    {
        parent.add(this.group);
    }

    setVisible(visible: boolean): void
    {
        this.group.visible = visible;
    }

    setPosition(x: number, y: number, z: number): void
    {
        this.group.position.set(x, y, z);
    }

    // Turns the arrow's face toward the given viewer, around the vertical axis only: the arrow means
    // "down at this", so its own down must stay the world's down however the view swings around it.
    faceViewer(viewerPos: THREE.Vector3): void
    {
        this.group.rotation.y = Math.atan2(
            viewerPos.x - this.group.position.x,
            viewerPos.z - this.group.position.z);
    }

    dispose(): void
    {
        this.group.removeFromParent();
        this.coreMaterial.dispose();
        this.haloMaterial.dispose();
        this.coreLine.geometry.dispose(); // shared with haloLine
    }
}

// The outline's corners, expanded into the pairs of endpoints that a line-segment geometry is
// made of: each corner joined to the next, and the last one back to the first.
function buildOutlineSegmentPositions(): number[]
{
    const positions: number[] = [];
    for (let i = 0; i < ARROW_CORNERS.length; ++i)
    {
        const [fromX, fromY] = ARROW_CORNERS[i];
        const [toX, toY] = ARROW_CORNERS[(i + 1) % ARROW_CORNERS.length];
        positions.push(fromX, fromY, 0, toX, toY, 0);
    }
    return positions;
}

function makeMaterial(color: string, linewidth: number, opacity: number,
    blending: THREE.Blending, fade: boolean): LineMaterial
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
        // Fades the wide halo out toward its edge, turning it into a soft glow in a single draw
        // call (see WorldSpaceOutlineRect, which patches the same shader for the same reason).
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
