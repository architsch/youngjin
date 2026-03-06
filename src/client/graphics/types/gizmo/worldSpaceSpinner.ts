import * as THREE from "three";
import { notificationMessageObservable, roomChangedObservable } from "../../../system/clientObservables";
import MeshFactory from "../../factories/meshFactory";
import WireframeMaterialParams from "../material/wireframeMaterialParams";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";

const TIMEOUT_MS = 5000;
const ROTATION_SPEED = 3; // radians per second

let spinnerMesh: THREE.Mesh | null = null;
let rotationInterval: ReturnType<typeof setInterval> | null = null;
let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
let onTimeoutCallback: (() => void) | null = null;

const vec3Temp = new THREE.Vector3();

export function showWorldSpaceSpinner(x: number, y: number, z: number,
    dirX: number, dirY: number, dirZ: number, onTimeout?: () => void)
{
    onTimeoutCallback = onTimeout ?? null;

    initSpinnerMesh().then(mesh =>
    {
        mesh.position.set(x, y, z);
        vec3Temp.set(x + dirX, y + dirY, z + dirZ);
        mesh.lookAt(vec3Temp);
        mesh.scale.set(0.6, 0.6, 0.6);
        mesh.visible = true;

        // Animate rotation
        if (rotationInterval)
            clearInterval(rotationInterval);
        const intervalMs = 1000 / 30;
        rotationInterval = setInterval(() => {
            mesh.rotateZ(ROTATION_SPEED * intervalMs / 1000);
        }, intervalMs);
    });

    // Auto-timeout
    if (timeoutHandle)
        clearTimeout(timeoutHandle);
    timeoutHandle = setTimeout(() => {
        notificationMessageObservable.set("Request timed out. Please try again.");
        hideWorldSpaceSpinner();
        if (onTimeoutCallback)
            onTimeoutCallback();
    }, TIMEOUT_MS);
}

export function hideWorldSpaceSpinner()
{
    if (spinnerMesh)
        spinnerMesh.visible = false;

    if (rotationInterval)
    {
        clearInterval(rotationInterval);
        rotationInterval = null;
    }

    if (timeoutHandle)
    {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
    }

    onTimeoutCallback = null;
}

async function initSpinnerMesh(): Promise<THREE.Mesh>
{
    if (spinnerMesh)
        return spinnerMesh;

    const mesh = await MeshFactory.loadMesh("Square", new WireframeMaterialParams("#ffff00"));
    spinnerMesh = mesh.clone();
    GraphicsManager.getScene().add(spinnerMesh);
    return spinnerMesh;
}

roomChangedObservable.addListener("worldSpaceSpinner", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    hideWorldSpaceSpinner();

    if (spinnerMesh)
    {
        spinnerMesh.removeFromParent();
        spinnerMesh = null;
    }
});
