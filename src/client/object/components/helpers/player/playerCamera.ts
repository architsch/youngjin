import * as THREE from "three";
import PlayerController from "../../playerController";
import GraphicsManager from "../../../../graphics/graphicsManager";
import { cameraModeObservable } from "../../../../system/clientObservables";
import FirstPersonCameraPose from "./firstPersonCameraPose";
import SelfViewCameraPose from "./selfViewCameraPose";
import SelfViewOcclusionHider from "./selfViewOcclusionHider";
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
    private occlusionHider = new SelfViewOcclusionHider();
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

    onDespawn(controller: PlayerController): void
    {
        this.occlusionHider.revealAll();
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
        {
            // Whatever the self-view hid to keep its view of the player clear belongs
            // to the room again as soon as the mode is left.
            if (this.selfViewWasActive)
                this.occlusionHider.revealAll();
            this.firstPersonPose.updatePose(controller, this.camera!, this.positionInterpTarget, this.quaternionInterpTarget);
        }
        this.selfViewWasActive = selfViewIsActive;

        // Ease toward the active mode's pose, so switching modes glides rather than snaps.
        const t = Math.min(1, 4 * deltaTime);
        this.camera!.position.lerp(this.positionInterpTarget, t);
        this.camera!.quaternion.slerp(this.quaternionInterpTarget, t);

        // The camera the sweep must see past is the eased one, so this follows the easing above.
        if (selfViewIsActive)
            this.occlusionHider.update(deltaTime, this.camera!, controller.gameObject);
    }
}
