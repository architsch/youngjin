import * as THREE from "three";
import PlayerController from "../../playerController";
import GameObject from "../../../types/gameObject";
import { playerViewTargetPosObservable } from "../../../../system/clientObservables";
import NumUtil from "../../../../../shared/math/util/numUtil";
import WorldSpaceSelectionUtil from "../../../../graphics/util/worldSpaceSelectionUtil";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { PLAYER_HEIGHT } from "../../../../../shared/system/sharedConstants";

const frustum = new THREE.Frustum();
const mat4Temp = new THREE.Matrix4();

const cameraPos = new THREE.Vector3();
const playerRightDir = new THREE.Vector3();
const viewDir = new THREE.Vector3();
const viewDirOnVerticalPlane = new THREE.Vector3();
const playerForwardDir = new THREE.Vector3();

//------------------------------------------------------------------------
// Computes the camera pose for the "firstPerson" camera mode: the camera
// sits at the player's eye, and its pitch reacts to the active view target
// (if any) or otherwise to the player's altitude.
//------------------------------------------------------------------------

export default class FirstPersonCameraPose
{
    // The camera's position in the player's local frame (at the eye).
    static readonly restPosition = new THREE.Vector3(0, 0.3 * PLAYER_HEIGHT, 0);

    updatePose(controller: PlayerController, camera: THREE.PerspectiveCamera,
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
        const playerBottomY = Math.max(0, player.position.y - 0.5*PLAYER_HEIGHT);

        // The higher you are, the more you should look down
        // (unless there is a view target that is placed higher).
        const pitchAngleForAltitude = -0.4 * playerBottomY;

        const desiredPitchAngle = (pitchAngleForViewTarget == 0) ? pitchAngleForAltitude : pitchAngleForViewTarget;
        outQuat.setFromAxisAngle(DIRECTION_VECTORS["+x"], desiredPitchAngle);
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

        // If the current selection is out of the camera view for a certain duration,
        // automatically remove that selection so as to make the camera recover its normal pitch.
        if (frustum.containsPoint(playerViewTargetPos)) // selection is in camera view
        {
            // Cancel the plan to unselect the current selection if it
            // came back into the camera view before the timeout.
            WorldSpaceSelectionUtil.cancelDelayedUnselectTimeout();
        }
        else // selection is NOT in camera view
        {
            // Unselect the current selection after a bit of delay.
            if (!WorldSpaceSelectionUtil.unselectionPending())
                WorldSpaceSelectionUtil.unselectAllAfterDelay(300);
        }

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
            0.6 * playerForwardDir.angleTo(viewDirOnVerticalPlane)
                * Math.sign(viewDirOnVerticalPlane.y - playerForwardDir.y), // Math.sign(...) = (+1 if you need to "look up", or -1 if you need to "look down")
            -0.7, 0.7
        );
        // If the angle is approximately 0, it will be misinterpreted as: "View-target is null".
        // Therefore, always make sure that the angle is obviously nonzero if the view-target exists.
        if (Math.abs(pitchAngleForViewTarget) < 0.001)
            pitchAngleForViewTarget = 0.001;
        return pitchAngleForViewTarget;
    }
}
