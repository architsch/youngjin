import * as THREE from "three";
import FirstPersonController from "../../firstPersonController";
import GraphicsManager from "../../../../graphics/graphicsManager";
import { cameraModeObservable, playerViewTargetPosObservable, popupStateObservable } from "../../../../system/clientObservables";
import GameObject from "../../../types/gameObject";
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

const firstPersonCameraPos = new THREE.Vector3(0, 0.3 * PLAYER_HEIGHT, 0); // at the eye
const selfViewCameraPos = new THREE.Vector3(0.5 * PLAYER_HEIGHT, 0.7 * PLAYER_HEIGHT, -1 * PLAYER_HEIGHT); // up & out front
const selfViewLookTarget = new THREE.Vector3(0, -0.15 * PLAYER_HEIGHT, 0);
const lookMat4Temp = new THREE.Matrix4();

export default class FirstPersonCamera
{
    private player: GameObject | undefined;
    private camera: THREE.PerspectiveCamera | undefined;
    private quaternionInterpTarget = new THREE.Quaternion();
    private positionInterpTarget = new THREE.Vector3();
    private selfViewQuaternion = new THREE.Quaternion();

    onSpawn(controller: FirstPersonController): void
    {
        this.player = controller.gameObject;

        this.camera = GraphicsManager.getCamera();
        controller.gameObject.obj.add(this.camera);
        this.camera.position.copy(firstPersonCameraPos);
        this.quaternionInterpTarget.copy(this.camera.quaternion);

        // The self-view orientation is fixed in the player's local frame (look from the pulled-back
        // position back toward the body), so precompute it once.
        lookMat4Temp.lookAt(selfViewCameraPos, selfViewLookTarget, DIRECTION_VECTORS["+y"]);
        this.selfViewQuaternion.setFromRotationMatrix(lookMat4Temp);

        // The pulled-back self-view is shown while (and only while) the player-customization panel is
        // open; any other popup state returns the camera to first-person.
        popupStateObservable.addListener("firstPersonCamera", (state) =>
            cameraModeObservable.set(state.popupType === "customizePlayer" ? "selfView" : "firstPerson"));
    }

    onDespawn(): void
    {
        popupStateObservable.removeListener("firstPersonCamera");
        cameraModeObservable.set("firstPerson");
    }

    update(deltaTime: number, controller: FirstPersonController): void
    {
        if (cameraModeObservable.peek() === "selfView")
        {
            this.positionInterpTarget.copy(selfViewCameraPos);
            this.quaternionInterpTarget.copy(this.selfViewQuaternion);
        }
        else
        {
            this.positionInterpTarget.copy(firstPersonCameraPos);
            this.updateTargetPitch();
        }

        // Ease toward the active mode's pose, so switching modes glides rather than snaps.
        const t = Math.min(1, 4 * deltaTime);
        this.camera!.position.lerp(this.positionInterpTarget, t);
        this.camera!.quaternion.slerp(this.quaternionInterpTarget, t);
    }

    private updateTargetPitch(): void
    {
        const playerViewTarget = playerViewTargetPosObservable.peek();

        // If there is an active view target, you should either:
        // (1) Look down toward the view target if it is placed below your eye level, or
        // (2) Look up toward the view target if it is placed above your eye level.
        // (3) Neither try to look down nor up if the view target doesn't exist (i.e. angle == 0).
        const pitchAngleForViewTarget = this.processViewTarget(playerViewTarget);
        const playerBottomY = Math.max(0, this.player!.position.y - 0.5*PLAYER_HEIGHT);

        // The higher you are, the more you should look down
        // (unless there is a view target that is placed higher).
        const pitchAngleForAltitude = -0.4 * playerBottomY;

        const desiredPitchAngle = (pitchAngleForViewTarget == 0) ? pitchAngleForAltitude : pitchAngleForViewTarget;
        this.quaternionInterpTarget.setFromAxisAngle(DIRECTION_VECTORS["+x"], desiredPitchAngle);
    }

    // Updates the view-target's selection state and returns the desired camera pitch angle.
    private processViewTarget(playerViewTargetPos: THREE.Vector3 | null): number
    {
        // If there is no view-target, stay neutral (i.e. neither try to look up nor look down).
        if (playerViewTargetPos == null)
            return 0;
    
        // Current selection went out of sight? Then just unselect whatever was selected (after a bit of delay).
        mat4Temp.multiplyMatrices(this.camera!.projectionMatrix, this.camera!.matrixWorldInverse);
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

        this.camera!.getWorldPosition(cameraPos);
        this.player!.obj.getWorldDirection(playerRightDir);
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