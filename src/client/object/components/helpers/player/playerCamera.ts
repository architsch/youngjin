import * as THREE from "three";
import PlayerController from "../../playerController";
import GraphicsManager from "../../../../graphics/graphicsManager";
import { cameraModeObservable, orbitCameraViewRequestObservable } from "../../../../system/clientObservables";
import AABB3 from "../../../../../shared/math/types/aabb3";
import FirstPersonCameraPose from "./firstPersonCameraPose";
import OrbitCameraPose from "./orbitCameraPose";
import OrbitOcclusionHider from "./orbitOcclusionHider";
import PlayerPointerInput from "./playerPointerInput";
import FreeCameraPose from "./freeCameraPose";

const worldPositionTemp = new THREE.Vector3();
const roomLightTemp = new THREE.Color();

// Parents the camera to the player and eases it toward the active mode's pose (FirstPersonCameraPose,
// OrbitCameraPose, FreeCameraPose), so mode changes glide.

export default class PlayerCamera
{
    private camera: THREE.PerspectiveCamera | undefined;
    private pointerInput: PlayerPointerInput | undefined;
    private quaternionInterpTarget = new THREE.Quaternion();
    private positionInterpTarget = new THREE.Vector3();
    private firstPersonPose = new FirstPersonCameraPose();
    private orbitPose = new OrbitCameraPose();
    private occlusionHider = new OrbitOcclusionHider();
    private freePose = new FreeCameraPose();

    // What the orbit is framing right now, or undefined while the orbit mode is not active.
    private orbitTarget: AABB3 | undefined;

    // Eased with the camera (not taken from the target pose) so the light doesn't flare ahead of a zoom.
    private pointLightViewDistance: number = 0;

    // Eased so the head light doesn't flicker when walking under a lamp.
    private roomLightNearCamera = new THREE.Color(0, 0, 0);

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

        // Reset light and fog sizing when no one is looking through the camera.
        this.pointLightViewDistance = 0;
        GraphicsManager.setViewDistance(0);
        this.roomLightNearCamera.setRGB(0, 0, 0);
        GraphicsManager.setPointLightSurroundings(this.roomLightNearCamera);
    }

    update(deltaTime: number, controller: PlayerController): void
    {
        const mode = cameraModeObservable.peek();

        // Consumed here, after framing, so the requested view isn't overwritten. Always cleared so a
        // stale request can't apply to a later orbit.
        const viewRequest = orbitCameraViewRequestObservable.peek();
        if (viewRequest != null)
            orbitCameraViewRequestObservable.set(null);

        let interpRate: number;

        if (mode.type === "orbit")
        {
            // Re-frame on entering the mode or changing target.
            if (this.orbitTarget !== mode.target)
            {
                const orbitBegins = (this.orbitTarget == undefined);
                this.orbitPose.reframe(mode.target, mode.minDistance ?? 0,
                    this.camera!, controller.gameObject.obj);

                // Starts from the current distance; zoom survives re-targeting but not re-entering
                // the mode (see OrbitCameraPose).
                if (orbitBegins)
                    this.orbitPose.matchZoomToCurrentDistance();
            }
            if (viewRequest != null)
                this.orbitPose.setView(viewRequest);
            this.orbitTarget = mode.target;
            interpRate = this.orbitPose.updatePose(this.pointerInput!.dragDelta, this.pointerInput!.viewScale,
                mode.target, controller.gameObject.obj,
                this.positionInterpTarget, this.quaternionInterpTarget);
        }
        else if (mode.type == "firstPerson")
        {
            // Restore anything the orbit hid.
            if (this.orbitTarget != undefined)
            {
                this.occlusionHider.revealAll();
                this.orbitTarget = undefined;
            }
            interpRate = this.firstPersonPose.updatePose(controller, this.camera!,
                this.positionInterpTarget, this.quaternionInterpTarget);
        }
        else if (mode.type == "free")
        {
            // The camera hangs off the player, so the world-space pose is converted into its frame.
            interpRate = this.freePose.updatePose(controller.gameObject.obj,
                this.positionInterpTarget, this.quaternionInterpTarget);
        }
        else
            throw new Error("Unknown camera mode");

        // Ease toward the active mode's pose, so switching modes glides rather than snaps.
        const t = Math.min(1, interpRate * deltaTime);
        this.camera!.position.lerp(this.positionInterpTarget, t);
        this.camera!.quaternion.slerp(this.quaternionInterpTarget, t);

        // Light and fog reach depend on the mode's view distance, eased with the camera (see
        // pointLightViewDistance).
        const viewDistance = (mode.type === "orbit") ? this.orbitPose.getOrbitDistance()
            : (mode.type === "free") ? FreeCameraPose.getViewDistance() : 0;
        this.pointLightViewDistance += (viewDistance - this.pointLightViewDistance) * t;
        GraphicsManager.setViewDistance(this.pointLightViewDistance);

        // Sampled at the eased camera position.
        GraphicsManager.getLightBlockMap().getNearbyLightAt(
            this.camera!.getWorldPosition(worldPositionTemp), roomLightTemp);
        this.roomLightNearCamera.lerp(roomLightTemp, t);
        GraphicsManager.setPointLightSurroundings(this.roomLightNearCamera);

        // The camera the sweep must see past is the eased one, so this follows the easing above.
        if (mode.type === "orbit")
            this.occlusionHider.update(deltaTime, this.camera!, mode.target);
    }
}
