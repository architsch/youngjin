import * as THREE from "three";
import NumUtil from "../../../../../shared/math/util/numUtil";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { PLAYER_HEIGHT } from "../../../../../shared/system/sharedConstants";

// Default framing: above, slightly off to the side, and out front of the player,
// looking back toward the body.
const defaultCameraPos = new THREE.Vector3(0.5 * PLAYER_HEIGHT, 0.7 * PLAYER_HEIGHT, -1 * PLAYER_HEIGHT);

// How fast a pointer-drag orbits the camera (radians per NDC unit of pointer travel).
const orbitSensitivity = 2.5;

// Keep the orbit away from the poles (straight above/below the player),
// where the look-at up-vector would degenerate.
const minPolarAngle = 0.15;
const maxPolarAngle = Math.PI * 0.75;

const orbitOffsetTemp = new THREE.Vector3();
const lookMat4Temp = new THREE.Matrix4();

//------------------------------------------------------------------------
// Computes the camera pose for the "selfView" camera mode: the camera orbits
// around a pivot on the player's body (in the player's local frame), driven
// by grab-style pointer drags (the orbit angle follows the pointer's movement,
// like Three.js's OrbitControls), so the user can inspect his/her own player
// from any angle.
//------------------------------------------------------------------------

export default class SelfViewCameraPose
{
    // The point on the player's body that the camera orbits around and looks at,
    // in the player's local frame.
    static readonly orbitPivot = new THREE.Vector3(0, 0, 0);

    private static readonly defaultOrbitOffset =
        new THREE.Vector3().subVectors(defaultCameraPos, SelfViewCameraPose.orbitPivot);

    private spherical = new THREE.Spherical();

    constructor()
    {
        this.reset();
    }

    // Returns to the default framing (called each time the self-view mode is entered).
    reset(): void
    {
        this.spherical.setFromVector3(SelfViewCameraPose.defaultOrbitOffset);
    }

    updatePose(dragDelta: THREE.Vector2, outPos: THREE.Vector3, outQuat: THREE.Quaternion): void
    {
        this.spherical.theta -= orbitSensitivity * dragDelta.x;
        this.spherical.phi = NumUtil.clampInRange(
            this.spherical.phi + orbitSensitivity * dragDelta.y, minPolarAngle, maxPolarAngle);

        orbitOffsetTemp.setFromSpherical(this.spherical);
        outPos.copy(SelfViewCameraPose.orbitPivot).add(orbitOffsetTemp);
        lookMat4Temp.lookAt(outPos, SelfViewCameraPose.orbitPivot, DIRECTION_VECTORS["+y"]);
        outQuat.setFromRotationMatrix(lookMat4Temp);
    }
}
