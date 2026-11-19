import * as THREE from "three";
import MeshFactory from "../../../../graphics/factories/meshFactory";
import SpriteMaterialParams from "../../../../../shared/graphics/material/types/spriteMaterialParams";

const tempDir = new THREE.Vector3();
let nextInstanceId = 0;

const TEXTURE_SIZE = 128;
const ARROW_OPACITY = 0.85;

// A flat textured arrow lying in the XZ plane (like a floor marking), readable from any angle. Renders
// on top of scene geometry.
export default class WorldSpaceSpriteArrow
{
    private group: THREE.Group = new THREE.Group();
    private arrowAssembly: THREE.Group = new THREE.Group();
    private meshId: string;

    private constructor(mesh: THREE.Mesh, meshId: string, scale: number)
    {
        this.meshId = meshId;
        mesh.renderOrder = 9999;

        // Lay the upright "Square" quad flat. Afterwards the arrow's heading is world -Z until
        // setDirection() rotates the assembly about Y.
        mesh.rotation.x = -Math.PI / 2;

        this.arrowAssembly.add(mesh);
        this.arrowAssembly.scale.setScalar(scale);
        this.group.add(this.arrowAssembly);
    }

    static async create(color: string = "#00ff00", scale: number = 1): Promise<WorldSpaceSpriteArrow>
    {
        // Texture/material are shared per color; the mesh is unique per instance.
        const textureId = `SpriteArrow-${color}`;
        const meshId = `${textureId}-${nextInstanceId++}`;
        const materialParams = new SpriteMaterialParams(textureId, TEXTURE_SIZE, TEXTURE_SIZE,
            (ctx, width, height) => WorldSpaceSpriteArrow.drawArrow(ctx, width, height, color), ARROW_OPACITY);
        const mesh = await MeshFactory.loadMesh(meshId, "Square", materialParams);
        return new WorldSpaceSpriteArrow(mesh, meshId, scale);
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
    }

    // Horizontal heading only (y ignored).
    setDirection(dir: THREE.Vector3): void
    {
        tempDir.set(dir.x, 0, dir.z);
        if (tempDir.lengthSq() < 1e-6)
            return;
        // The arrow's base heading (no rotation) points toward world -Z; spin about Y to face dir.
        this.arrowAssembly.rotation.y = Math.atan2(-dir.x, -dir.z);
    }

    dispose(): void
    {
        this.group.removeFromParent();
        MeshFactory.unload(this.meshId);
    }

    // Draws a filled arrow (pointing toward the top of the canvas) onto a sprite texture's canvas.
    private static drawArrow(ctx: CanvasRenderingContext2D, width: number, height: number, color: string): void
    {
        ctx.beginPath();
        ctx.moveTo(0.500 * width, 0.063 * height); // tip
        ctx.lineTo(0.906 * width, 0.469 * height); // right wing
        ctx.lineTo(0.688 * width, 0.469 * height); // right shaft (outer corner)
        ctx.lineTo(0.688 * width, 0.938 * height); // right shaft (base)
        ctx.lineTo(0.313 * width, 0.938 * height); // left shaft (base)
        ctx.lineTo(0.313 * width, 0.469 * height); // left shaft (outer corner)
        ctx.lineTo(0.094 * width, 0.469 * height); // left wing
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();

        // A thin dark outline keeps the arrow legible over bright surfaces.
        ctx.lineJoin = "round";
        ctx.lineWidth = 0.03 * width;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
        ctx.stroke();
    }
}
