import * as THREE from "three";
import PlayerController from "../../playerController";
import NumUtil from "../../../../../shared/math/util/numUtil";
import ClientVoxelQueryUtil from "../../../../voxel/util/clientVoxelQueryUtil";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { PLAYER_HEIGHT } from "../../../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";

// "firstPerson" pose: camera at the player's eye, pitched by the room ahead.

// Pitch per unit of ground drop ahead. The drop is a neighbourhood average, so even a sheer drop
// arrives well short of its depth.
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
