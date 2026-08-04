import * as THREE from "three";
import NumUtil from "../../../../../shared/math/util/numUtil";
import AABB3 from "../../../../../shared/math/types/aabb3";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { NEAR_EPSILON } from "../../../../../shared/system/sharedConstants";

// How far the pointer travels, in CSS pixels, to carry the camera one full turn around the target.
// A physical distance rather than a share of the canvas, so the orbit answers a given movement of
// the finger the same way whichever way the device is held (PlayerPointerInput documents why a
// canvas-relative measure does not).
const orbitPixelsPerFullTurn = 960;
const orbitSensitivity = (2 * Math.PI) / orbitPixelsPerFullTurn; // radians per CSS pixel

// Keep the orbit away from the poles (straight above/below the target),
// where the look-at up-vector would degenerate.
const minPolarAngle = 0.15;
const maxPolarAngle = Math.PI * 0.75;

// How far back the camera sits, as a multiple of the target's own reach (the radius of the sphere
// that holds it). Framing a target by its size is what lets the same orbit inspect a whole
// character and a single block without either filling the screen or being lost in it. The lower
// bound keeps a target with next to no size of its own from pulling the camera inside it.
const orbitDistancePerTargetReach = 2.4;
const minOrbitDistance = 3;

// Where the camera goes when it has no direction of its own to keep (see reframe): above, slightly
// off to the side, and out front of the player, looking back — the framing that shows the user's
// own character. Expressed in the player's frame, where -z is the direction the player looks in.
const defaultOrbitDirection = new THREE.Vector3(0.5, 0.7, -1).normalize();

const pivotTemp = new THREE.Vector3();
const orbitOffsetTemp = new THREE.Vector3();
const worldPosTemp = new THREE.Vector3();
const worldQuatTemp = new THREE.Quaternion();
const parentQuatTemp = new THREE.Quaternion();
const lookMat4Temp = new THREE.Matrix4();

//------------------------------------------------------------------------
// Computes the camera pose for the "orbit" camera mode: the camera orbits around the center of the
// mode's target volume — which may be anywhere in the room, and need not be on the player — and
// looks at it, driven by grab-style pointer drags (the orbit angle follows the pointer's movement,
// like Three.js's OrbitControls), so the user can inspect the target from any angle.
//
// The orbit is described in world space, while the camera hangs off the player object (which is
// what makes the first-person view follow the player's eye for free). The pose is therefore handed
// back in the player's frame, the frame both modes are eased in, rather than the camera being taken
// off the player for the duration of the mode: expressing one pose in another frame costs a pair of
// conversions, whereas re-parenting mid-glide would split the easing across two frames of reference.
//------------------------------------------------------------------------

export default class OrbitCameraPose
{
    private spherical = new THREE.Spherical();

    // Frames the given target, keeping the direction the camera already views it from. Called each
    // time the mode is entered and each time it is pointed at something else, so that the camera
    // pulls back from where the user was already looking rather than swinging around to a fixed
    // side of the target — which, for a target in a wall, would be the far side of that wall.
    // A camera standing within the target's own footprint (the user orbiting his own body) has no
    // such direction to keep, and gets the default framing instead.
    // "minDistance" is the caller's own floor under the framing distance, for a target that has to
    // be seen in its surroundings rather than on its own (see CameraMode).
    reframe(target: AABB3, minDistance: number, camera: THREE.Camera, playerObj: THREE.Object3D): void
    {
        camera.getWorldPosition(worldPosTemp);
        orbitOffsetTemp.set(
            worldPosTemp.x - target.center.x,
            worldPosTemp.y - target.center.y,
            worldPosTemp.z - target.center.z);

        const horizontalReach = Math.max(target.halfSize.x, target.halfSize.z, NEAR_EPSILON);
        const horizontalDistSqr = orbitOffsetTemp.x * orbitOffsetTemp.x +
            orbitOffsetTemp.z * orbitOffsetTemp.z;
        if (horizontalDistSqr < horizontalReach * horizontalReach)
        {
            playerObj.getWorldQuaternion(parentQuatTemp);
            orbitOffsetTemp.copy(defaultOrbitDirection).applyQuaternion(parentQuatTemp);
        }

        this.spherical.setFromVector3(orbitOffsetTemp);
        this.spherical.phi = NumUtil.clampInRange(this.spherical.phi, minPolarAngle, maxPolarAngle);
        this.spherical.radius = Math.max(minOrbitDistance, minDistance, orbitDistancePerTargetReach *
            Math.hypot(target.halfSize.x, target.halfSize.y, target.halfSize.z));
    }

    updatePose(dragDelta: THREE.Vector2, target: AABB3, playerObj: THREE.Object3D,
        outPos: THREE.Vector3, outQuat: THREE.Quaternion): void
    {
        this.spherical.theta -= orbitSensitivity * dragDelta.x;
        this.spherical.phi = NumUtil.clampInRange(
            this.spherical.phi + orbitSensitivity * dragDelta.y, minPolarAngle, maxPolarAngle);

        pivotTemp.set(target.center.x, target.center.y, target.center.z);
        orbitOffsetTemp.setFromSpherical(this.spherical);
        worldPosTemp.addVectors(pivotTemp, orbitOffsetTemp);
        lookMat4Temp.lookAt(worldPosTemp, pivotTemp, DIRECTION_VECTORS["+y"]);
        worldQuatTemp.setFromRotationMatrix(lookMat4Temp);

        // Down into the player's frame, which is where the camera itself lives (see above).
        playerObj.updateMatrixWorld();
        playerObj.getWorldQuaternion(parentQuatTemp);
        outPos.copy(playerObj.worldToLocal(worldPosTemp));
        outQuat.copy(parentQuatTemp.invert()).multiply(worldQuatTemp);
    }
}
