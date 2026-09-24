import * as THREE from "three";
import App from "../../../../app";
import PlayerController from "../../playerController";
import NumUtil from "../../../../../shared/math/util/numUtil";
import AABB3 from "../../../../../shared/math/types/aabb3";
import PhysicsManager from "../../../../../shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../../../shared/physics/util/physicsColliderStateUtil";
import ClientVoxelQueryUtil from "../../../../voxel/util/clientVoxelQueryUtil";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { COLLISION_LAYER_HEIGHT } from "../../../../../shared/system/sharedConstants";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";

// "firstPerson" pose: camera at the player's eye, pitched by the room ahead, or fully down while falling.

// Pitch per unit of ground drop ahead. The drop is a neighbourhood average, so even a sheer drop
// arrives well short of its depth.
const pitchAnglePerOpenSpaceDrop = 0.7;

// How far we can pitch the camera up or down, in radians.
const pitchLimit = 0.8;

// Gap under the feet past which the player is falling: more than one collision layer, so stepping down
// a stair isn't a fall.
const freeFallClearance = 1.2 * COLLISION_LAYER_HEIGHT;

// Footprint inset of the ground probe, so a wall touched from the side isn't taken for ground.
const groundProbeInset = 0.1;

// Easing rate of the gaze rising back after a fall (per second, as PlayerCamera's), well below the
// camera's own, so landing doesn't jerk the view up.
const lookUpAfterFallRate = 8;

// How close to the room's pitch the rise after a fall ends, in radians.
const lookUpAfterFallTolerance = 0.1;

const cameraPos = new THREE.Vector3();
const playerForwardDir = new THREE.Vector3();
const cameraEuler = new THREE.Euler();
const groundProbe: AABB3 = {
    center: {x: 0, y: 0, z: 0},
    halfSize: {
        x: PLAYER_RADIUS_XZ - groundProbeInset,
        y: 0.5 * freeFallClearance,
        z: PLAYER_RADIUS_XZ - groundProbeInset,
    },
};

export default class FirstPersonCameraPose
{
    // The camera's position in the player's local frame (at the eye).
    static readonly restPosition = new THREE.Vector3(0, 0.3 * PLAYER_HEIGHT, 0);

    // The pitch the gaze is rising back from after a fall, or undefined when it isn't.
    private pitchAfterFall: number | undefined;

    // Returns the desired camera interpolation rate.
    updatePose(deltaTime: number, controller: PlayerController, camera: THREE.PerspectiveCamera,
        outPos: THREE.Vector3, outQuat: THREE.Quaternion): number
    {
        outPos.copy(FirstPersonCameraPose.restPosition);

        const player = controller.gameObject;
        const standingLevelY = player.position.y - 0.5 * PLAYER_HEIGHT;

        let pitchAngle: number;
        if (this.isFalling(player.position, standingLevelY))
        {
            // The drop ahead shrinks as the ground nears, which would lift the gaze on the way down.
            pitchAngle = -pitchLimit;
            // The rise starts from as far down as the camera actually got.
            this.pitchAfterFall = cameraEuler.setFromQuaternion(camera.quaternion, "YXZ").x;
        }
        else
        {
            pitchAngle = this.getPitchForRoomAhead(controller, camera, standingLevelY);

            // Only rising is held back: once the room asks to look as far down, the rise is over.
            if (this.pitchAfterFall != undefined)
            {
                this.pitchAfterFall += (pitchAngle - this.pitchAfterFall) *
                    Math.min(1, lookUpAfterFallRate * deltaTime);
                if (this.pitchAfterFall < pitchAngle - lookUpAfterFallTolerance)
                    pitchAngle = this.pitchAfterFall;
                else
                    this.pitchAfterFall = undefined;
            }
        }
        outQuat.setFromAxisAngle(DIRECTION_VECTORS["+x"], pitchAngle);

        return 8;
    }

    private getPitchForRoomAhead(controller: PlayerController, camera: THREE.PerspectiveCamera,
        standingLevelY: number): number
    {
        camera.getWorldPosition(cameraPos);
        controller.gameObject.obj.getWorldDirection(playerForwardDir);
        playerForwardDir.negate(); // Player-camera's "forward" direction is the opposite of the player-gameObject's forward direction.

        const drop = ClientVoxelQueryUtil.getOpenSpaceDropAhead(cameraPos, playerForwardDir, standingLevelY);
        return -NumUtil.clampInRange(pitchAnglePerOpenSpaceDrop * drop, 0, pitchLimit);
    }

    // Nothing solid under the player's footprint within freeFallClearance of the feet.
    private isFalling(playerPos: THREE.Vector3, standingLevelY: number): boolean
    {
        const room = App.getCurrentRoom();
        if (room == undefined)
            return false;

        groundProbe.center.x = playerPos.x;
        groundProbe.center.y = standingLevelY - 0.5 * freeFallClearance;
        groundProbe.center.z = playerPos.z;
        return !PhysicsColliderStateUtil.boxOverlapsHardCollider(PhysicsManager.physicsRooms[room.id],
            groundProbe);
    }
}
