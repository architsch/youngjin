import * as THREE from "three";
import PlayerController from "../../playerController";
import GraphicsManager from "../../../../graphics/graphicsManager";
import { cameraModeObservable } from "../../../../system/clientObservables";
import AABB3 from "../../../../../shared/math/types/aabb3";
import FirstPersonCameraPose from "./firstPersonCameraPose";
import OrbitCameraPose from "./orbitCameraPose";
import OrbitOcclusionHider from "./orbitOcclusionHider";
import PlayerPointerInput from "./playerPointerInput";

//------------------------------------------------------------------------
// Owns the player's camera: attaches it to the player object and eases it
// toward the pose requested by the active camera mode (cameraModeObservable).
// The per-mode pose computation is delegated to FirstPersonCameraPose and
// OrbitCameraPose; this class only blends the camera toward whichever
// pose is active, so switching modes glides rather than snaps.
//------------------------------------------------------------------------

export default class PlayerCamera
{
    private camera: THREE.PerspectiveCamera | undefined;
    private pointerInput: PlayerPointerInput | undefined;
    private quaternionInterpTarget = new THREE.Quaternion();
    private positionInterpTarget = new THREE.Vector3();
    private firstPersonPose = new FirstPersonCameraPose();
    private orbitPose = new OrbitCameraPose();
    private occlusionHider = new OrbitOcclusionHider();

    // What the orbit is framing right now, or undefined while the orbit mode is not active.
    private orbitTarget: AABB3 | undefined;

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
        const mode = cameraModeObservable.peek();
        if (mode.type === "orbit")
        {
            // Frame the target afresh each time the mode is entered, and each time it is pointed
            // at something else, so that the camera pulls back from wherever it was looking.
            if (this.orbitTarget !== mode.target)
            {
                this.orbitPose.reframe(mode.target, mode.minDistance ?? 0,
                    this.camera!, controller.gameObject.obj);
            }
            this.orbitTarget = mode.target;
            this.orbitPose.updatePose(this.pointerInput!.dragDelta, mode.target,
                controller.gameObject.obj, this.positionInterpTarget, this.quaternionInterpTarget);
        }
        else
        {
            // Whatever the orbit hid to keep its view of the target clear belongs
            // to the room again as soon as the mode is left.
            if (this.orbitTarget != undefined)
            {
                this.occlusionHider.revealAll();
                this.orbitTarget = undefined;
            }
            this.firstPersonPose.updatePose(controller, this.camera!, this.positionInterpTarget, this.quaternionInterpTarget);
        }

        // Ease toward the active mode's pose, so switching modes glides rather than snaps.
        const t = Math.min(1, 4 * deltaTime);
        this.camera!.position.lerp(this.positionInterpTarget, t);
        this.camera!.quaternion.slerp(this.quaternionInterpTarget, t);

        // The camera the sweep must see past is the eased one, so this follows the easing above.
        if (mode.type === "orbit")
            this.occlusionHider.update(deltaTime, this.camera!, mode.target);
    }
}
