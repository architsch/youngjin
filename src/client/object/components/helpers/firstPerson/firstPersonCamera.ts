import * as THREE from "three";
import FirstPersonController from "../../firstPersonController";
import GraphicsManager from "../../../../graphics/graphicsManager";
import { playerViewTargetPosObservable } from "../../../../system/clientObservables";
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

export default class FirstPersonCamera
{
    private player: GameObject | undefined;
    private camera: THREE.PerspectiveCamera | undefined;
    private defaultQuaternion = new THREE.Quaternion();
    private quaternionInterpTarget = new THREE.Quaternion();

    onSpawn(controller: FirstPersonController): void
    {
        this.player = controller.gameObject;

        this.camera = GraphicsManager.getCamera();
        controller.gameObject.obj.add(this.camera);
        this.camera.position.set(0, 0.3*PLAYER_HEIGHT, 0);

        this.defaultQuaternion.copy(this.camera.quaternion);
        this.quaternionInterpTarget.copy(this.defaultQuaternion);

        const pointLight = new THREE.PointLight(0xffffff, 4.0, 16, 0.5);
        this.camera.add(pointLight);
        pointLight.position.set(0, 0, 0);
    }

    update(deltaTime: number, controller: FirstPersonController): void
    {
        this.updateTargetPitch();
        this.camera!.quaternion.slerpQuaternions(
            this.camera!.quaternion, this.quaternionInterpTarget, 4 * deltaTime);
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

        // (+1 = "look up"), (-1 = "look down"), (0 = "neither")
        const s1 = Math.sign(pitchAngleForViewTarget);
        const s2 = Math.sign(pitchAngleForAltitude);

        let desiredPitchAngle = 0;
        if (s2 == 0) // If there is no "look down" due to the player's altitude, only take the view-target into account.
            desiredPitchAngle = pitchAngleForViewTarget;
        else if (s1 == 0) // If there is neither "look up" nor "look down" that is due to the view-target, only take the player's altitude into account.
            desiredPitchAngle = pitchAngleForAltitude;
        else // Otherwise, always prefer looking up.
            desiredPitchAngle = Math.max(pitchAngleForViewTarget, pitchAngleForAltitude);

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