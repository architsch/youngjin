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

// How far the camera pitches down per world unit that the ground ahead falls below the player's own.
// A whole neighbourhood of the room is averaged into that figure, most of which is ordinarily the
// ground he is already standing on, so even a sheer drop directly ahead arrives here well short of
// its own depth.
const pitchAnglePerOpenSpaceDrop = 0.7;

// How far we can pitch the camera up or down, in radians.
const pitchLimit = 0.8;

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

    private lastViewTargetActiveTime: number = 0;

    // Returns the desired camera interpolation rate.
    updatePose(controller: PlayerController, camera: THREE.PerspectiveCamera,
        outPos: THREE.Vector3, outQuat: THREE.Quaternion): number
    {
        outPos.copy(FirstPersonCameraPose.restPosition);

        const player = controller.gameObject;
        const playerViewTarget = playerViewTargetPosObservable.peek();

        // If there is an active view target, you should either:
        // (1) Look down toward the view target if it is placed below your eye level, or
        // (2) Look up toward the view target if it is placed above your eye level.
        // (3) Neither try to look down nor up if the view target doesn't exist (i.e. angle == 0).
        const pitchAngleForViewTarget = this.processViewTarget(camera, player, playerViewTarget);

        camera.getWorldPosition(cameraPos);
        player.obj.getWorldDirection(playerForwardDir);
        playerForwardDir.negate(); // Player-camera's "forward" direction is the opposite of the player-gameObject's forward direction.

        const drop = ClientVoxelQueryUtil.getOpenSpaceDropAhead(cameraPos, playerForwardDir,
            player.obj.position.y - 0.5 * PLAYER_HEIGHT);
        const surroundingsPitchAngle = -NumUtil.clampInRange(pitchAnglePerOpenSpaceDrop * drop, 0, pitchLimit);

        const desiredPitchAngle = (pitchAngleForViewTarget == 0)
            ? surroundingsPitchAngle : pitchAngleForViewTarget;
        outQuat.setFromAxisAngle(DIRECTION_VECTORS["+x"], desiredPitchAngle);
        
        this.lastViewTargetActiveTime = playerViewTarget
            ? performance.now()
            : this.lastViewTargetActiveTime;

        return performance.now() <= this.lastViewTargetActiveTime + 1000
            ? 4 : 8; // Camera should interpolate more smoothly when you have a view target (e.g. active selection).
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
