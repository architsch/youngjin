import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial, LineMaterialParameters } from "three/examples/jsm/lines/LineMaterial.js";

// Same widths and glow as WorldSpaceOutlineRect, so the two read as one family.
const CORE_WIDTH = 0.03;
const HALO_WIDTH = 0.16;
const HALO_OPACITY = 0.5;

// Downward arrow outline in the XY plane, tip at the origin, 1x1 before scaling.
const ARROW_CORNERS: [number, number][] = [
    [0, 0],          // tip
    [-0.5, 0.5],     // left barb
    [-0.2, 0.5],     // left shoulder
    [-0.2, 1],       // left tail
    [0.2, 1],        // right tail
    [0.2, 0.5],      // right shoulder
    [0.5, 0.5],      // right barb
];

// A flat glowing downward arrow that billboards around Y. Marks selections with no surface to outline
// against (e.g. the user's own character).
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

    // Yaw-only billboard, so the arrow's down stays world-down.
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
        // Halo edge fade (see WorldSpaceOutlineRect).
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
