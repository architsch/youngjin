import * as THREE from "three";
import PlayerController from "../../playerController";
import GraphicsManager from "../../../../graphics/graphicsManager";
import { cameraModeObservable } from "../../../../system/clientObservables";
import FirstPersonCameraPose from "./firstPersonCameraPose";
import SelfViewCameraPose from "./selfViewCameraPose";
import PlayerPointerInput from "./playerPointerInput";

//------------------------------------------------------------------------
// Owns the player's camera: attaches it to the player object and eases it
// toward the pose requested by the active camera mode (cameraModeObservable).
// The per-mode pose computation is delegated to FirstPersonCameraPose and
// SelfViewCameraPose; this class only blends the camera toward whichever
// pose is active, so switching modes glides rather than snaps.
//------------------------------------------------------------------------

export default class PlayerCamera
{
    private camera: THREE.PerspectiveCamera | undefined;
    private pointerInput: PlayerPointerInput | undefined;
    private quaternionInterpTarget = new THREE.Quaternion();
    private positionInterpTarget = new THREE.Vector3();
    private firstPersonPose = new FirstPersonCameraPose();
    private selfViewPose = new SelfViewCameraPose();
    private selfViewWasActive = false;

    onSpawn(controller: PlayerController, pointerInput: PlayerPointerInput): void
    {
        this.pointerInput = pointerInput;
        this.camera = GraphicsManager.getCamera();
        controller.gameObject.obj.add(this.camera);
        this.camera.position.copy(FirstPersonCameraPose.restPosition);
        this.positionInterpTarget.copy(this.camera.position);
        this.quaternionInterpTarget.copy(this.camera.quaternion);
    }

    update(deltaTime: number, controller: PlayerController): void
    {
        const selfViewIsActive = cameraModeObservable.peek() === "selfView";
        if (selfViewIsActive)
        {
            // Return to the default self-view framing each time the mode is entered.
            if (!this.selfViewWasActive)
                this.selfViewPose.reset();
            this.selfViewPose.updatePose(this.pointerInput!.dragDelta, this.positionInterpTarget, this.quaternionInterpTarget);
        }
        else
            this.firstPersonPose.updatePose(controller, this.camera!, this.positionInterpTarget, this.quaternionInterpTarget);
        this.selfViewWasActive = selfViewIsActive;

        // Ease toward the active mode's pose, so switching modes glides rather than snaps.
        const t = Math.min(1, 4 * deltaTime);
        this.camera!.position.lerp(this.positionInterpTarget, t);
        this.camera!.quaternion.slerp(this.quaternionInterpTarget, t);
    }
}
