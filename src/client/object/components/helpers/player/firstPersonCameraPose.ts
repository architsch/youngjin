import * as THREE from "three";
import App from "../../../../app";
import PlayerController from "../../playerController";
import NumUtil from "../../../../../shared/math/util/numUtil";
import AABB3 from "../../../../../shared/math/types/aabb3";
import Vec3 from "../../../../../shared/math/types/vec3";
import PhysicsManager from "../../../../../shared/physics/physicsManager";
import PhysicsColliderStateUtil from "../../../../../shared/physics/util/physicsColliderStateUtil";
import ClientVoxelQueryUtil from "../../../../voxel/util/clientVoxelQueryUtil";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { COLLISION_LAYER_HEIGHT } from "../../../../../shared/system/sharedConstants";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";

// "firstPerson" pose: camera at the player's eye, pitched by the room ahead, toward what a play-mode click
// hit, or down to pitchLimit while falling.

// Pitch per unit of ground drop ahead. The drop is a neighbourhood average, so even a sheer drop
// arrives well short of its depth.
const pitchAnglePerOpenSpaceDrop = 0.7;

// How far the room ahead or a fall pitches the camera down, in radians.
const pitchLimit = 0.8;

// How far a click can pitch the camera up or down, in radians: short of vertical, where turning would
// spin the view about its middle.
const lookPitchLimit = 1.3;

// How fast the user may walk, per second, before the look a click took ends. Only their own steering
// counts: a push or a step climbed doesn't, and turning in place keeps the look.
const lookMaxSpeed = 4;

// Easing rate of the camera toward this pose, per second (see PlayerCamera).
const easingRate = 8;

// Easing rate of the pitch the gaze turns through toward a clicked spot, and back once the look ends (per
// second, like easingRate). The camera eases after that pitch in turn, so each turn sets off gently
// rather than at full speed.
const lookEasingRate = 4;

// How close the turn back from a look must come to the pose's own pitch before handing over to it, in
// radians.
const lookSettledAngle = 0.01;

// Gap under the feet past which the player is falling: more than one collision layer, so stepping down
// a stair isn't a fall.
const freeFallClearance = 1.2 * COLLISION_LAYER_HEIGHT;

// Footprint inset of the ground probe, so a wall touched from the side isn't taken for ground.
const groundProbeInset = 0.1;

// Easing rate of the pitch the gaze rises back through after a fall (per second, like easingRate). The
// camera eases after that pitch in turn, so the rise starts gently and landing doesn't jerk the view up.
const lookUpAfterFallRate = 8;

// How close to the room's pitch the rise after a fall ends, in radians.
const lookUpAfterFallTolerance = 0.1;

const cameraPos = new THREE.Vector3();
const eyePos = new THREE.Vector3();
const walkedStep = new THREE.Vector3();
const imposedStep = new THREE.Vector3();
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

    // Where the gaze has got to on its way back up after a fall (while still falling, as far down as the
    // camera has got), or undefined once there is no rise to make.
    private pitchAfterFall: number | undefined;

    // The spot a click's look is fixed on, from the click until the user walks faster than lookMaxSpeed or
    // falls; undefined otherwise.
    private lookSpot: THREE.Vector3 | undefined;

    // Where the player stood last frame, which the walking speed is measured from.
    private lastPlayerPos = new THREE.Vector3();

    // The pitch the gaze turns through, from a click until it has turned back after the look ends (see
    // lookEasingRate); undefined otherwise.
    private lookTurnPitch: number | undefined;

    // Returns the desired camera interpolation rate. clickedPoint: where a play-mode click hit this frame.
    // imposedDisplacement: physics' part of the player's move this frame (see Rigidbody).
    updatePose(deltaTime: number, controller: PlayerController, camera: THREE.PerspectiveCamera,
        clickedPoint: THREE.Vector3 | undefined, imposedDisplacement: Vec3,
        outPos: THREE.Vector3, outQuat: THREE.Quaternion): number
    {
        outPos.copy(FirstPersonCameraPose.restPosition);

        const player = controller.gameObject;
        const standingLevelY = player.position.y - 0.5 * PLAYER_HEIGHT;

        if (clickedPoint != undefined)
            this.takeLook(clickedPoint, camera);

        // What the user walked since last frame: the move, less physics' part of it.
        walkedStep.subVectors(player.position, this.lastPlayerPos)
            .sub(imposedStep.set(imposedDisplacement.x, imposedDisplacement.y, imposedDisplacement.z));
        this.lastPlayerPos.copy(player.position);
        if (walkedStep.length() > lookMaxSpeed * deltaTime)
            this.lookSpot = undefined;

        let pitchAngle: number;
        if (this.isFalling(player.position, standingLevelY))
        {
            // The drop ahead shrinks as the ground nears, which would lift the gaze on the way down.
            pitchAngle = -pitchLimit;
            // The rise starts from as far down as the camera actually got.
            this.pitchAfterFall = cameraEuler.setFromQuaternion(camera.quaternion, "YXZ").x;
            // A fall is physics' move rather than walking, so it ends the look here instead.
            this.lookSpot = undefined;
        }
        else if (this.lookSpot != undefined)
            pitchAngle = this.getPitchToward(this.lookSpot, controller);
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

        if (this.lookTurnPitch != undefined)
        {
            this.lookTurnPitch += (pitchAngle - this.lookTurnPitch) * Math.min(1, lookEasingRate * deltaTime);
            if (this.lookSpot == undefined && Math.abs(pitchAngle - this.lookTurnPitch) < lookSettledAngle)
                this.lookTurnPitch = undefined;
            else
                pitchAngle = this.lookTurnPitch;
        }
        outQuat.setFromAxisAngle(DIRECTION_VECTORS["+x"], pitchAngle);

        return easingRate;
    }

    // Lets go of a click's look, as when another camera mode takes the camera away from the eye.
    releaseLook(): void
    {
        this.lookSpot = undefined;
        this.lookTurnPitch = undefined; // Coming back from the other mode glides as any mode change does.
    }

    // Fixes the look on a clicked spot. The turn toward it sets off from wherever the camera is, or carries
    // on from where a turn under way has got.
    private takeLook(point: THREE.Vector3, camera: THREE.PerspectiveCamera): void
    {
        this.lookSpot = point.clone();
        if (this.lookTurnPitch == undefined)
            this.lookTurnPitch = cameraEuler.setFromQuaternion(camera.quaternion, "YXZ").x;

        // A rise the look cut short would otherwise resume from its stale pitch once the look ends.
        this.pitchAfterFall = undefined;
    }

    // The pitch of the line of sight from the eye to a spot, whichever way the player faces. Facing the
    // spot, that brings it level with the middle of the view.
    private getPitchToward(spot: THREE.Vector3, controller: PlayerController): number
    {
        const playerObj = controller.gameObject.obj;
        playerObj.updateWorldMatrix(true, false);
        const eye = playerObj.localToWorld(eyePos.copy(FirstPersonCameraPose.restPosition));

        const pitch = Math.atan2(spot.y - eye.y, Math.hypot(spot.x - eye.x, spot.z - eye.z));
        return NumUtil.clampInRange(pitch, -lookPitchLimit, lookPitchLimit);
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
