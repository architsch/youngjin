import * as THREE from "three";
import PlayerController from "../../playerController";
import GameObject from "../../../types/gameObject";
import { playerViewTargetPosObservable } from "../../../../system/clientObservables";
import NumUtil from "../../../../../shared/math/util/numUtil";
import WorldSpaceSelectionUtil from "../../../../graphics/util/worldSpaceSelectionUtil";
import ClientVoxelQueryUtil from "../../../../voxel/util/clientVoxelQueryUtil";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { PLAYER_HEIGHT } from "../../../../../shared/system/sharedConstants";

//------------------------------------------------------------------------
// Computes the camera pose for the "firstPerson" camera mode: the camera
// sits at the player's eye, and its pitch reacts to the active view target
// (if any) or otherwise to the room the player is standing in.
//------------------------------------------------------------------------

// How often the room around the player is measured afresh, in seconds. What it answers changes as
// he walks rather than as fast as he walks, and every measurement costs a walk of the voxel grid
// per empty block on view.
const surroundingsScanInterval = 0.2;

// How far the camera pitches down per world unit that the open space ahead lies below the eye.
const pitchAnglePerOpenSpaceDrop = 0.6;

// How far we can pitch the camera up or down, in radians.
const pitchLimit = 0.8;

// How quickly the camera takes up a pitch the room has newly asked for, per second. Deliberately
// gentler than the easing the camera itself is under (see PlayerCamera), because what lies ahead
// can change entirely in a single step — walking out over a ledge, or turning to face a wall — and
// a camera answering that as promptly as it answers the user's own input would lurch on its own.
const surroundingsPitchEaseRate = 10;

const frustum = new THREE.Frustum();
const mat4Temp = new THREE.Matrix4();

const cameraPos = new THREE.Vector3();
const playerRightDir = new THREE.Vector3();
const viewDir = new THREE.Vector3();
const viewDirOnVerticalPlane = new THREE.Vector3();
const playerForwardDir = new THREE.Vector3();

export default class FirstPersonCameraPose
{
    // The camera's position in the player's local frame (at the eye).
    static readonly restPosition = new THREE.Vector3(0, 0.3 * PLAYER_HEIGHT, 0);

    // What the room around the player currently asks of the camera's pitch, how far the camera has
    // come toward it, and how long it is since the room was last asked.
    private surroundingsPitchTarget = 0;
    private surroundingsPitchAngle = 0;
    private surroundingsMeasured = false;
    private timeSinceLastScan = 0;

    updatePose(deltaTime: number, controller: PlayerController, camera: THREE.PerspectiveCamera,
        outPos: THREE.Vector3, outQuat: THREE.Quaternion): void
    {
        outPos.copy(FirstPersonCameraPose.restPosition);

        const player = controller.gameObject;
        const playerViewTarget = playerViewTargetPosObservable.peek();

        // If there is an active view target, you should either:
        // (1) Look down toward the view target if it is placed below your eye level, or
        // (2) Look up toward the view target if it is placed above your eye level.
        // (3) Neither try to look down nor up if the view target doesn't exist (i.e. angle == 0).
        const pitchAngleForViewTarget = this.processViewTarget(camera, player, playerViewTarget);

        // Kept up to date even while a view target is holding the camera, so that letting go of one
        // hands the camera back to a reading of where the player is standing now rather than to a
        // stale one taken before he was pointed at anything.
        this.updateSurroundingsPitchAngle(deltaTime, camera, player);

        const desiredPitchAngle = (pitchAngleForViewTarget == 0)
            ? this.surroundingsPitchAngle : pitchAngleForViewTarget;
        outQuat.setFromAxisAngle(DIRECTION_VECTORS["+x"], desiredPitchAngle);
    }

    // Pitches the camera to suit the room the player is standing in: the further below his eye the
    // open space he can see into lies, the further down he looks, so that a player who has climbed
    // above the floor of the room is shown what is down there rather than the empty air ahead of him.
    //
    // Read off the room rather than off the player's own altitude, which a room more than one storey
    // tall makes nonsense of: a player who has walked upstairs stands far above the room's floor
    // while the storey he is on lies flat around him, and has no more reason to look down than he
    // had downstairs. How high he stands cannot tell those two apart; what he can see into can.
    //
    // Only the downward half of the answer is acted on. Open space lying *above* the eye is the
    // ordinary case rather than a reason to tilt — it is what standing in any room with headroom to
    // spare, or in front of anything shorter than the player, amounts to — so a camera answering it
    // would spend the walk down a low-walled corridor, or through a hall, gazing at the ceiling.
    private updateSurroundingsPitchAngle(deltaTime: number, camera: THREE.PerspectiveCamera,
        player: GameObject): void
    {
        this.timeSinceLastScan += deltaTime;
        if (this.timeSinceLastScan >= surroundingsScanInterval)
        {
            this.timeSinceLastScan = 0;

            camera.getWorldPosition(cameraPos);
            player.obj.getWorldDirection(playerForwardDir);
            playerForwardDir.negate(); // Player-camera's "forward" direction is the opposite of the player-gameObject's forward direction.

            const drop = ClientVoxelQueryUtil.getOpenSpaceDropAhead(cameraPos, playerForwardDir);
            this.surroundingsPitchTarget = -NumUtil.clampInRange(
                pitchAnglePerOpenSpaceDrop * drop, 0, pitchLimit);

            if (!this.surroundingsMeasured) // The first reading has nothing behind it to ease from.
            {
                this.surroundingsPitchAngle = this.surroundingsPitchTarget;
                this.surroundingsMeasured = true;
            }
        }
        this.surroundingsPitchAngle += (this.surroundingsPitchTarget - this.surroundingsPitchAngle)
            * Math.min(1, surroundingsPitchEaseRate * deltaTime);
    }

    // Updates the view-target's selection state and returns the desired camera pitch angle.
    private processViewTarget(camera: THREE.PerspectiveCamera, player: GameObject,
        playerViewTargetPos: THREE.Vector3 | null): number
    {
        // If there is no view-target, stay neutral (i.e. neither try to look up nor look down).
        if (playerViewTargetPos == null)
            return 0;

        // Current selection went out of sight? Then just unselect whatever was selected (after a bit of delay).
        mat4Temp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(mat4Temp);

        // If the current selection is out of the camera view,
        // automatically remove that selection so as to make the camera recover its normal pitch.
        if (!frustum.containsPoint(playerViewTargetPos))
            WorldSpaceSelectionUtil.unselectAll();

        camera.getWorldPosition(cameraPos);
        player.obj.getWorldDirection(playerRightDir);
        playerRightDir.negate();
        playerForwardDir.copy(playerRightDir);
        playerRightDir.applyAxisAngle(DIRECTION_VECTORS["+y"], -Math.PI*0.5);

        viewDir.subVectors(playerViewTargetPos, cameraPos);
        viewDirOnVerticalPlane.copy(viewDir);
        viewDirOnVerticalPlane.projectOnPlane(playerRightDir); // viewDirOnVerticalPlane = view direction that is projected onto the plane which dissects the player's face vertically.
        viewDirOnVerticalPlane.normalize();

        let pitchAngleForViewTarget = NumUtil.clampInRange(
            0.8 * playerForwardDir.angleTo(viewDirOnVerticalPlane)
                * Math.sign(viewDirOnVerticalPlane.y - playerForwardDir.y), // Math.sign(...) = (+1 if you need to "look up", or -1 if you need to "look down")
            -pitchLimit, pitchLimit
        );
        // If the angle is approximately 0, it will be misinterpreted as: "View-target is null".
        // Therefore, always make sure that the angle is obviously nonzero if the view-target exists.
        if (Math.abs(pitchAngleForViewTarget) < 0.001)
            pitchAngleForViewTarget = 0.001;
        return pitchAngleForViewTarget;
    }
}
