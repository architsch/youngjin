import * as THREE from "three";
import PlayerController from "../../playerController";
import GraphicsManager from "../../../../graphics/graphicsManager";
import { cameraModeObservable, orbitCameraDistanceRangeRequestObservable,
    orbitCameraViewRequestObservable } from "../../../../system/clientObservables";
import AABB3 from "../../../../../shared/math/types/aabb3";
import FirstPersonCameraPose from "./firstPersonCameraPose";
import OrbitCameraPose from "./orbitCameraPose";
import OrbitOcclusionHider from "./orbitOcclusionHider";
import PlayerPointerInput from "./playerPointerInput";
import FreeCameraPose from "./freeCameraPose";
import Vec3 from "../../../../../shared/math/types/vec3";

const viewReferenceTemp = new THREE.Vector3();
const roomLightTemp = new THREE.Color();
const vectorTemp = new THREE.Vector3();
const quaternionTemp = new THREE.Quaternion();

// How far in front of the camera the head light and the fog may be measured from (see
// GraphicsManager.setViewReferenceOffset). Past it, an orbit lights and fogs the room the way it
// looks from beside its subject, rather than from wherever the camera was pulled back to.
const maxViewReferenceDistance = 8;

// Stiffness of the spring the first-person camera trails the physics' moves on (see updateTrail).
// The physics' speed caps keep the trail within about a block.
const trailRate = 12;

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

    // Eased with the camera (not taken from the target pose) so the light doesn't slide ahead of a zoom.
    private viewReferenceOffset: number = 0;

    // Eased so the head light doesn't flicker when walking under a lamp.
    private roomLightNearCamera = new THREE.Color(0, 0, 0);

    // How far the camera is left behind its pose by moves the player didn't steer: in world terms, and
    // in the player's frame as last applied to the camera.
    private trailOffset = new THREE.Vector3();
    private trailVelocity = new THREE.Vector3();
    private appliedTrailOffset = new THREE.Vector3();

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

        // Reset light and fog placement when no one is looking through the camera.
        this.viewReferenceOffset = 0;
        GraphicsManager.setViewReferenceOffset(0);
        this.roomLightNearCamera.setRGB(0, 0, 0);
        GraphicsManager.setPointLightSurroundings(this.roomLightNearCamera);
    }

    // Runs after physics has moved the player this frame (see PlayerController.lateUpdate).
    update(deltaTime: number, controller: PlayerController, imposedDisplacement: Vec3): void
    {
        const mode = cameraModeObservable.peek();

        // The poses and the easing work without the trail; it is laid back on after them.
        this.camera!.position.sub(this.appliedTrailOffset);

        // Requests are consumed here, after framing, so they aren't overwritten. Always cleared so a
        // stale request can't apply to a later orbit.
        const viewRequest = orbitCameraViewRequestObservable.peek();
        if (viewRequest != null)
            orbitCameraViewRequestObservable.set(null);
        const distanceRangeRequest = orbitCameraDistanceRangeRequestObservable.peek();
        if (distanceRangeRequest != null)
            orbitCameraDistanceRangeRequestObservable.set(null);

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
            if (distanceRangeRequest != null)
                this.orbitPose.applyDistanceRange(distanceRangeRequest, mode.target);
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
            interpRate = this.firstPersonPose.updatePose(deltaTime, controller, this.camera!,
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

        this.updateTrail(deltaTime, imposedDisplacement, mode.type === "firstPerson");
        controller.gameObject.obj.getWorldQuaternion(quaternionTemp).invert();
        this.appliedTrailOffset.copy(this.trailOffset).applyQuaternion(quaternionTemp);
        this.camera!.position.add(this.appliedTrailOffset);

        // Light and fog stand where a player looking at the same subject would, which is the camera
        // itself until it is pulled further back than maxViewReferenceDistance.
        const viewDistance = (mode.type === "orbit") ? this.orbitPose.getOrbitDistance()
            : (mode.type === "free") ? FreeCameraPose.getViewDistance() : 0;
        const offset = Math.max(0, viewDistance - maxViewReferenceDistance);
        this.viewReferenceOffset += (offset - this.viewReferenceOffset) * t;
        GraphicsManager.setViewReferenceOffset(this.viewReferenceOffset);

        // Sampled where the head light stands rather than at the camera, so it still yields to the
        // lamps around its subject. The eased pose is the one the light follows.
        this.camera!.updateWorldMatrix(true, false);
        GraphicsManager.getLightBlockMap().getNearbyLightAt(
            this.camera!.localToWorld(viewReferenceTemp.set(0, 0, -this.viewReferenceOffset)),
            roomLightTemp);
        this.roomLightNearCamera.lerp(roomLightTemp, t);
        GraphicsManager.setPointLightSurroundings(this.roomLightNearCamera);

        // The camera the sweep must see past is the eased one, so this follows the easing above.
        if (mode.type === "orbit")
            this.occlusionHider.update(deltaTime, this.camera!, mode.target);
    }

    // Physics moves the player in jolts (a step climbed, a drop, a push) that steering never makes.
    // The camera is held against those and catches up on a critically damped spring, while steering
    // is followed as is, so a staircase becomes a steady glide and walking never lags.
    private updateTrail(deltaTime: number, imposedDisplacement: Vec3, trailPlayer: boolean): void
    {
        // The other modes place the camera in world terms, so a trail would displace it.
        if (trailPlayer)
            this.trailOffset.sub(vectorTemp.set(imposedDisplacement.x, imposedDisplacement.y, imposedDisplacement.z));

        // Closed-form spring step toward zero, stable at any frame rate.
        const decay = Math.exp(-trailRate * deltaTime);
        const step = vectorTemp.copy(this.trailOffset).multiplyScalar(trailRate)
            .add(this.trailVelocity).multiplyScalar(deltaTime);
        this.trailOffset.add(step).multiplyScalar(decay);
        this.trailVelocity.addScaledVector(step, -trailRate).multiplyScalar(decay);
    }
}
