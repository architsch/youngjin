import * as THREE from "three";
import PlayerController from "../../playerController";
import NumUtil from "../../../../../shared/math/util/numUtil";
import ClientVoxelQueryUtil from "../../../../voxel/util/clientVoxelQueryUtil";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { PLAYER_HEIGHT } from "../../../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";

//------------------------------------------------------------------------
// Computes the camera pose for the "firstPerson" camera mode: the camera
// sits at the player's eye, and its pitch reacts to the room the player is
// standing in.
//------------------------------------------------------------------------

// How far the camera pitches down per world unit that the ground ahead falls below the player's own.
// A whole neighbourhood of the room is averaged into that figure, most of which is ordinarily the
// ground he is already standing on, so even a sheer drop directly ahead arrives here well short of
// its own depth.
const pitchAnglePerOpenSpaceDrop = 0.7;

// How far we can pitch the camera up or down, in radians.
const pitchLimit = 0.8;

const cameraPos = new THREE.Vector3();
const playerForwardDir = new THREE.Vector3();

export default class FirstPersonCameraPose
{
    // The camera's position in the player's local frame (at the eye).
    static readonly restPosition = new THREE.Vector3(0, 0.3 * PLAYER_HEIGHT, 0);

    // Returns the desired camera interpolation rate.
    updatePose(controller: PlayerController, camera: THREE.PerspectiveCamera,
        outPos: THREE.Vector3, outQuat: THREE.Quaternion): number
    {
        outPos.copy(FirstPersonCameraPose.restPosition);

        const player = controller.gameObject;

        camera.getWorldPosition(cameraPos);
        player.obj.getWorldDirection(playerForwardDir);
        playerForwardDir.negate(); // Player-camera's "forward" direction is the opposite of the player-gameObject's forward direction.

        const drop = ClientVoxelQueryUtil.getOpenSpaceDropAhead(cameraPos, playerForwardDir,
            player.obj.position.y - 0.5 * PLAYER_HEIGHT);
        const pitchAngle = -NumUtil.clampInRange(pitchAnglePerOpenSpaceDrop * drop, 0, pitchLimit);
        outQuat.setFromAxisAngle(DIRECTION_VECTORS["+x"], pitchAngle);

        return 8;
    }
}
