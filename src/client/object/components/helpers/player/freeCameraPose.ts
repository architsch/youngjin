import * as THREE from "three";
import { COLLISION_LAYER_HEIGHT, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS }
    from "../../../../../shared/system/sharedConstants";

// Position and target are stored separately so each can be set without swinging the view.
const cameraPos = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

const cameraQuat = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const lookRotationMatrix = new THREE.Matrix4();

// Default view: room centre at head height, looking at the floor centre (not the grid origin, which
// is outside the room).
const DEFAULT_POS = {
    x: 0.5 * NUM_VOXEL_COLS,
    y: 0.5 * NUM_COLLISION_LAYERS * COLLISION_LAYER_HEIGHT,
    z: 0.5 * NUM_VOXEL_ROWS,
};
const DEFAULT_TARGET = {x: DEFAULT_POS.x, y: 0, z: DEFAULT_POS.z};

cameraPos.set(DEFAULT_POS.x, DEFAULT_POS.y, DEFAULT_POS.z);
lookTarget.set(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);

// Recomputed from position and target on every change, so moving keeps the camera aimed at its subject.
function refreshOrientation()
{
    // Degenerate when on the target; keep the previous orientation.
    if (cameraPos.distanceToSquared(lookTarget) < 1e-12)
        return;

    lookRotationMatrix.lookAt(cameraPos, lookTarget, up);
    cameraQuat.setFromRotationMatrix(lookRotationMatrix);
}

refreshOrientation();

const worldPosTemp = new THREE.Vector3();
const parentQuatTemp = new THREE.Quaternion();

// Effectively instant: free mode cuts rather than glides.
const SNAP_INTERP_RATE = 1e6;

export default class FreeCameraPose
{
    // Returns the interpolation rate. The pose is authored in world space but output in the player's
    // frame, since the camera is parented to the player (see PlayerCamera).
    updatePose(playerObj: THREE.Object3D, outPos: THREE.Vector3, outQuat: THREE.Quaternion): number
    {
        worldPosTemp.copy(cameraPos);

        playerObj.updateMatrixWorld();
        playerObj.getWorldQuaternion(parentQuatTemp);
        outPos.copy(playerObj.worldToLocal(worldPosTemp));
        outQuat.copy(parentQuatTemp.invert()).multiply(cameraQuat);

        return SNAP_INTERP_RATE;
    }

    // Use this method to set the free-mode camera's position.
    static moveTo(x: number, y: number, z: number)
    {
        cameraPos.set(x, y, z);
        refreshOrientation();
    }

    // Sets the look-target position.
    static lookAt(x: number, y: number, z: number)
    {
        lookTarget.set(x, y, z);
        refreshOrientation();
    }

    static getPose(): {position: THREE.Vector3, target: THREE.Vector3}
    {
        return {position: cameraPos.clone(), target: lookTarget.clone()};
    }

    // Distance to the subject, which places the camera-mounted light and the fog (see PlayerCamera).
    static getViewDistance(): number
    {
        return cameraPos.distanceTo(lookTarget);
    }

    // Resets to the default view so each session starts fresh.
    static reset()
    {
        FreeCameraPose.moveTo(DEFAULT_POS.x, DEFAULT_POS.y, DEFAULT_POS.z);
        FreeCameraPose.lookAt(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);
    }
}
