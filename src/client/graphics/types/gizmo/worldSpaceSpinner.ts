import * as THREE from "three";
import { notificationMessageObservable, roomChangedObservable } from "../../../system/clientObservables";
import MeshFactory from "../../factories/meshFactory";
import WireframeMaterialParams from "../material/wireframeMaterialParams";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";

const TIMEOUT_MS = 5000;
const ROTATION_SPEED = 3; // radians per second

const vec3Temp = new THREE.Vector3();

export default class WorldSpaceSpinner
{
    static async createSpinner(x: number, y: number, z: number,
        dirX: number, dirY: number, dirZ: number, onTimeout?: () => void)
    {
        const key = `${x},${y},${z}`;

        // If a spinner with this key already exists, hide it first.
        WorldSpaceSpinner.destroySpinnerWithKey(key);

        const baseMesh = await getTemplateMesh();
        const mesh = baseMesh.clone();
        GraphicsManager.getScene().add(mesh);

        mesh.position.set(x, y, z);
        vec3Temp.set(x + dirX, y + dirY, z + dirZ);
        mesh.lookAt(vec3Temp);
        mesh.scale.set(0.6, 0.6, 0.6);
        mesh.visible = true;

        // Animate rotation
        const intervalMs = 1000 / 30;
        const rotationInterval = setInterval(() => {
            mesh.rotateZ(ROTATION_SPEED * intervalMs / 1000);
        }, intervalMs);

        // Auto-timeout
        const timeoutHandle = setTimeout(() => {
            notificationMessageObservable.set("Request timed out. Please try again.");
            WorldSpaceSpinner.destroySpinnerWithKey(key);
            if (onTimeout)
                onTimeout();
        }, TIMEOUT_MS);

        spinners.set(key, {
            mesh,
            rotationInterval,
            timeoutHandle,
            onTimeoutCallback: onTimeout ?? null,
        });
    }

    static async destroySpinner(x: number, y: number, z: number)
    {
        WorldSpaceSpinner.destroySpinnerWithKey(`${x},${y},${z}`);
    }

    private static destroySpinnerWithKey(key: string)
    {
        const spinner = spinners.get(key);
        if (!spinner)
            return;

        spinner.mesh.visible = false;
        spinner.mesh.removeFromParent();
        clearInterval(spinner.rotationInterval);
        clearTimeout(spinner.timeoutHandle);
        spinners.delete(key);
    }

    static destroyAllSpinners()
    {
        for (const key of spinners.keys())
            WorldSpaceSpinner.destroySpinnerWithKey(key);
    }
}

interface SpinnerInstance
{
    mesh: THREE.Mesh;
    rotationInterval: ReturnType<typeof setInterval>;
    timeoutHandle: ReturnType<typeof setTimeout>;
    onTimeoutCallback: (() => void) | null;
}

const spinners = new Map<string, SpinnerInstance>();
let templateMesh: THREE.Mesh | null = null;

async function getTemplateMesh(): Promise<THREE.Mesh>
{
    if (templateMesh)
        return templateMesh;

    const mesh = await MeshFactory.loadMesh("Square", new WireframeMaterialParams("#ffff00"));
    templateMesh = mesh;
    return templateMesh;
}

roomChangedObservable.addListener("worldSpaceSpinner", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    WorldSpaceSpinner.destroyAllSpinners();
    templateMesh = null;
});
