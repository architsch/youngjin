import * as THREE from "three";
import { COLLISION_LAYER_HEIGHT, NUM_COLLISION_LAYERS, NUM_VOXEL_COLS, NUM_VOXEL_ROWS }
    from "../../../../../shared/system/sharedConstants";

// Where the camera stands and what it is aimed at, kept apart so that either can be set on its own:
// moving without re-aiming would otherwise swing the view off its subject, and the two are set one
// at a time by a caller that has no reason to know they are related.
const cameraPos = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

const cameraQuat = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const lookRotationMatrix = new THREE.Matrix4();

// Where a camera that has been told nothing yet looks from. The middle of the room at head height,
// aimed at the middle of the floor - which is a view of the room rather than of the inside of a
// wall, and is what the mode is worth being entered without arguments for. The origin, which is
// where an unset vector would put it, is the bottom corner of the grid: outside everything, aimed
// out of the room.
const DEFAULT_POS = {
    x: 0.5 * NUM_VOXEL_COLS,
    y: 0.5 * NUM_COLLISION_LAYERS * COLLISION_LAYER_HEIGHT,
    z: 0.5 * NUM_VOXEL_ROWS,
};
const DEFAULT_TARGET = {x: DEFAULT_POS.x, y: 0, z: DEFAULT_POS.z};

cameraPos.set(DEFAULT_POS.x, DEFAULT_POS.y, DEFAULT_POS.z);
lookTarget.set(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);

// The rotation that puts the camera's view down the line from where it stands to what it is aimed
// at. Recomputed from both every time either changes, rather than being remembered from the moment
// `lookAt` was called: a camera moved afterwards would otherwise keep the direction it was facing
// from the place it has left, and drift off its subject the further it goes.
function refreshOrientation()
{
    // A camera standing exactly on its target has no direction to face, and the matrix below would
    // come out degenerate - so the orientation it already had is kept instead.
    if (cameraPos.distanceToSquared(lookTarget) < 1e-12)
        return;

    lookRotationMatrix.lookAt(cameraPos, lookTarget, up);
    cameraQuat.setFromRotationMatrix(lookRotationMatrix);
}

refreshOrientation();

const worldPosTemp = new THREE.Vector3();
const parentQuatTemp = new THREE.Quaternion();

// A rate high enough that the ease below lands in one frame. The point of this mode is a camera that
// goes where it is told rather than travelling there - a cut, not a move - so a glide would only be
// a settling time every caller had to wait out before the view meant what it says.
const SNAP_INTERP_RATE = 1e6;

export default class FreeCameraPose
{
    // Returns the desired camera interpolation rate.
    //
    // The pose above is written in world coordinates, because that is the only frame a camera free
    // of the player can be aimed in. What comes out is in the player's, because that is where the
    // camera object itself lives - it hangs off the player object (see PlayerCamera), so a world
    // position written straight out would be read as an offset from wherever the player happens to
    // stand, and a world rotation as one applied on top of whichever way he happens to face.
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

    // Use this method to set the free-mode camera's look-direction.
    // The (x,y,z) parameters are the coordinates of the look-target's position.
    static lookAt(x: number, y: number, z: number)
    {
        lookTarget.set(x, y, z);
        refreshOrientation();
    }

    // Where the camera stands and what it is aimed at, for a caller composing a view by adjusting
    // the one it already has.
    static getPose(): {position: THREE.Vector3, target: THREE.Vector3}
    {
        return {position: cameraPos.clone(), target: lookTarget.clone()};
    }

    // How far off the camera is from what it is aimed at. The room is lit by a light the camera
    // carries, and how far that light has to reach is this distance - so a camera stood well back to
    // take in a whole set would otherwise be lighting the air in front of it and leaving the set
    // itself in the dark (see GraphicsManager.setPointLightReach).
    static getViewDistance(): number
    {
        return cameraPos.distanceTo(lookTarget);
    }

    // Puts the view back where it starts, so that one session arranging a scene does not begin
    // wherever the last one left the camera.
    static reset()
    {
        FreeCameraPose.moveTo(DEFAULT_POS.x, DEFAULT_POS.y, DEFAULT_POS.z);
        FreeCameraPose.lookAt(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);
    }
}
