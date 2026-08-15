import * as THREE from "three";
import PlayerController from "../../playerController";
import GraphicsManager from "../../../../graphics/graphicsManager";
import { cameraModeObservable, orbitCameraViewRequestObservable } from "../../../../system/clientObservables";
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

    // How far the light the camera carries is currently being asked to reach. Eased alongside the
    // camera rather than taken straight from the pose, because the pose is where the camera is
    // headed, not where it is: a wheel notch moves it at once while the camera spends the next
    // moment gliding there, and a light that answered the pose would light the target as if from
    // the new distance while still standing at the old one — a flare on every notch.
    private pointLightViewDistance: number = 0;

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

        // Nobody is looking through the camera any more, so the light it carries goes back to what
        // it is tuned for rather than staying stretched over the last orbit's distance.
        this.pointLightViewDistance = 0;
        GraphicsManager.setPointLightReach(0);
    }

    update(deltaTime: number, controller: PlayerController): void
    {
        const mode = cameraModeObservable.peek();

        // A view asked for from outside is taken up here and nowhere else, so that it lands after
        // the framing below rather than being overwritten by it. Taken off the request either way:
        // outside an orbit there is no view to take up, and a request left standing would be
        // answered by whichever orbit happened to begin next.
        const viewRequest = orbitCameraViewRequestObservable.peek();
        if (viewRequest != null)
            orbitCameraViewRequestObservable.set(null);

        if (mode.type === "orbit")
        {
            // Frame the target afresh each time the mode is entered, and each time it is pointed
            // at something else, so that the camera pulls back from wherever it was looking.
            if (this.orbitTarget !== mode.target)
            {
                const orbitBegins = (this.orbitTarget == undefined);
                this.orbitPose.reframe(mode.target, mode.minDistance ?? 0,
                    this.camera!, controller.gameObject.obj);

                // An orbit begins from where the user was already standing when he pointed the
                // camera at something, and carries on from wherever he has zoomed to since; how
                // close he wants to look survives the orbit being re-pointed, but not the mode
                // being left and entered again (see OrbitCameraPose).
                if (orbitBegins)
                    this.orbitPose.matchZoomToCurrentDistance();
            }
            if (viewRequest != null)
                this.orbitPose.setView(viewRequest);
            this.orbitTarget = mode.target;
            this.orbitPose.updatePose(this.pointerInput!.dragDelta, this.pointerInput!.viewScale,
                mode.target, controller.gameObject.obj,
                this.positionInterpTarget, this.quaternionInterpTarget);
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

        // The camera carries the room's light with it, so how far that light has to reach is a
        // question only the active mode can answer: an orbit may hold the camera much further from
        // what the user is looking at than his own eye ever does (see GraphicsManager). Eased on
        // the same terms as the camera itself, so that the light travels with the camera instead of
        // arriving before it (see pointLightViewDistance).
        const viewDistance = (mode.type === "orbit") ? this.orbitPose.getOrbitDistance() : 0;
        this.pointLightViewDistance += (viewDistance - this.pointLightViewDistance) * t;
        GraphicsManager.setPointLightReach(this.pointLightViewDistance);

        // The camera the sweep must see past is the eased one, so this follows the easing above.
        if (mode.type === "orbit")
            this.occlusionHider.update(deltaTime, this.camera!, mode.target);
    }
}
