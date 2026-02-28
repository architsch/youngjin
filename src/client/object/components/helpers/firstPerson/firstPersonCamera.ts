import * as THREE from "three";
import FirstPersonController from "../../firstPersonController";
import GraphicsManager from "../../../../graphics/graphicsManager";
import { playerViewTargetPosObservable } from "../../../../system/clientObservables";
import GameObject from "../../../types/gameObject";
import Num from "../../../../../shared/math/util/num";
import WorldSpaceSelectionUtil from "../../../../graphics/util/worldSpaceSelectionUtil";

const frustum = new THREE.Frustum();
const mat4Temp = new THREE.Matrix4();

const cameraPos = new THREE.Vector3();
const playerRightDir = new THREE.Vector3();
const viewDir = new THREE.Vector3();
const viewDirOnVerticalPlane = new THREE.Vector3();
const playerForwardDir = new THREE.Vector3();
const right = new THREE.Vector3(1, 0, 0);
const up = new THREE.Vector3(0, 1, 0);

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
        this.camera.position.set(0, 2, 0);

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

        // The higher you are, the more you should look down
        // (unless there is a view target that is placed higher).
        const pitchAngleForAltitude = -0.4 * this.player!.position.y;

        // (+1 = "look up"), (-1 = "look down"), (0 = "neither")
        const s1 = Math.sign(pitchAngleForViewTarget);
        const s2 = Math.sign(pitchAngleForAltitude);

        const desiredPitchAngle = (s1 == -s2)
            ? Math.max(pitchAngleForViewTarget, pitchAngleForAltitude) // If one of the angles tries to look down and the other tries to look up, always prefer looking up.
            : (s1 == 0 ? s2 : s1) * Math.max(s1 * pitchAngleForViewTarget, s2 * pitchAngleForAltitude); // Otherwise, choose the angle with the biggest absolute value.

        this.quaternionInterpTarget.setFromAxisAngle(right, desiredPitchAngle);
    }

    // Updates the view-target's selection state and returns the desired camera pitch angle.
    private processViewTarget(playerViewTargetPos: THREE.Vector3 | null): number
    {
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
        playerRightDir.applyAxisAngle(up, -Math.PI*0.5);

        viewDir.subVectors(playerViewTargetPos, cameraPos);
        viewDirOnVerticalPlane.copy(viewDir);
        viewDirOnVerticalPlane.projectOnPlane(playerRightDir); // viewDirOnVerticalPlane = view direction that is projected onto the plane which dissects the player's face vertically.
        viewDirOnVerticalPlane.normalize();

        const pitchAngleForViewTarget = Num.clampInRange(
            0.5 * playerForwardDir.angleTo(viewDirOnVerticalPlane)
                * Math.sign(viewDirOnVerticalPlane.y - playerForwardDir.y), // Math.sign(...) = (+1 if you need to "look up", or -1 if you need to "look down")
            -0.7, 0.7
        );
        return pitchAngleForViewTarget;
    }
}