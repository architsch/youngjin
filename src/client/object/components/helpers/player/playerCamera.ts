import * as THREE from "three";
import GameObject from "../../../types/gameObject/gameObject";
import GraphicsManager from "../../../../graphics/graphicsManager";
import { cameraModeObservable, orbitCameraAngleHoldRequestObservable, orbitCameraDistanceRangeRequestObservable,
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

// Stiffness of the spring the first-person camera trails the physics' moves on (see updateTrail). Never capped:
// a wind lifting or throwing the player fast leaves it further behind, since any limit would jolt the camera into
// step with the player, and again to a stop when the player hits something.
const trailRate = 12;

// Parents the camera to the player and eases it toward the active mode's pose (FirstPersonCameraPose,
// OrbitCameraPose, FreeCameraPose), so mode changes glide. Without a pointer input, which only the user's own player
// has, there is only first person (see WatchedPlayerCameraUtil).

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

    // Where the orbit's eased pose stood in the world after the last frame, kept while one is under way: the
    // next frame eases on from there, whatever has moved the player meanwhile (see update).
    private orbitWorldPosition = new THREE.Vector3();
    private orbitWorldQuaternion = new THREE.Quaternion();
    private orbitWorldPoseKept: boolean = false;

    // Eased with the camera (not taken from the target pose) so the light doesn't slide ahead of a zoom.
    private viewReferenceOffset: number = 0;

    // Eased so the head light doesn't flicker when walking under a lamp.
    private roomLightNearCamera = new THREE.Color(0, 0, 0);

    // How far the camera is left behind its pose by moves the player didn't steer: in world terms, and
    // in the player's frame as last applied to the camera.
    private trailOffset = new THREE.Vector3();
    private trailVelocity = new THREE.Vector3();
    private appliedTrailOffset = new THREE.Vector3();

    onSpawn(player: GameObject, pointerInput?: PlayerPointerInput): void
    {
        this.pointerInput = pointerInput;
        this.camera = GraphicsManager.getCamera();
        player.obj.add(this.camera);
        this.camera.position.copy(FirstPersonCameraPose.restPosition);
        this.positionInterpTarget.copy(this.camera.position);
        this.quaternionInterpTarget.copy(this.camera.quaternion);
    }

    onDespawn(): void
    {
        this.occlusionHider.revealAll();

        // Reset light and fog placement when no one is looking through the camera.
        this.viewReferenceOffset = 0;
        GraphicsManager.setViewReferenceOffset(0);
        this.roomLightNearCamera.setRGB(0, 0, 0);
        GraphicsManager.setPointLightSurroundings(this.roomLightNearCamera);
    }

    // Runs after physics has moved the player this frame (see PlayerController.lateUpdate). imposedDisplacement
    // and underForce: what Rigidbody reports of that move.
    update(deltaTime: number, player: GameObject, imposedDisplacement: Vec3, underForce: boolean): void
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
        const angleHoldRequest = orbitCameraAngleHoldRequestObservable.peek();
        if (angleHoldRequest)
            orbitCameraAngleHoldRequestObservable.set(false);

        if (mode.type !== "firstPerson")
            this.firstPersonPose.releaseLook();
        if (mode.type !== "orbit")
            this.orbitWorldPoseKept = false;

        let interpRate: number;

        if (mode.type === "orbit")
        {
            // The camera hangs off the player, but an orbit under way is eased in the world: whatever has
            // moved the player since last frame (a fan bouncing them as they edit) is taken out of it first,
            // so that only what it orbits moves it.
            if (this.orbitWorldPoseKept)
                this.restoreOrbitWorldPose(player.obj);

            // Re-frame on entering the mode or changing target.
            if (this.orbitTarget !== mode.target)
            {
                // (An orbit just beginning has no angles of its own to hold yet.)
                const orbitBegins = (this.orbitTarget == undefined);
                this.orbitPose.reframe(mode.target, mode.minDistance ?? 0,
                    this.camera!, player.obj, angleHoldRequest && !orbitBegins);

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
                mode.target, player.obj,
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
            interpRate = this.firstPersonPose.updatePose(deltaTime, player, this.camera!,
                this.pointerInput?.clickedPoint, imposedDisplacement, underForce,
                this.positionInterpTarget, this.quaternionInterpTarget);
        }
        else if (mode.type == "free")
        {
            // The camera hangs off the player, so the world-space pose is converted into its frame.
            interpRate = this.freePose.updatePose(player.obj,
                this.positionInterpTarget, this.quaternionInterpTarget);
        }
        else
            throw new Error("Unknown camera mode");

        // Ease toward the active mode's pose, so switching modes glides rather than snaps.
        const t = Math.min(1, interpRate * deltaTime);
        this.camera!.position.lerp(this.positionInterpTarget, t);
        this.camera!.quaternion.slerp(this.quaternionInterpTarget, t);
        if (mode.type === "orbit")
            this.keepOrbitWorldPose(player.obj);

        this.updateTrail(deltaTime, imposedDisplacement, mode.type === "firstPerson");
        player.obj.getWorldQuaternion(quaternionTemp).invert();
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

    // Notes where the orbit's eased pose stands in the world (without the trail, which is laid on after it).
    private keepOrbitWorldPose(playerObj: THREE.Object3D): void
    {
        playerObj.updateWorldMatrix(true, false);
        playerObj.localToWorld(this.orbitWorldPosition.copy(this.camera!.position));
        playerObj.getWorldQuaternion(this.orbitWorldQuaternion).multiply(this.camera!.quaternion);
        this.orbitWorldPoseKept = true;
    }

    // Puts the camera back there, in the player's frame as it is now.
    private restoreOrbitWorldPose(playerObj: THREE.Object3D): void
    {
        playerObj.updateWorldMatrix(true, false);
        this.camera!.position.copy(playerObj.worldToLocal(vectorTemp.copy(this.orbitWorldPosition)));
        this.camera!.quaternion.copy(playerObj.getWorldQuaternion(quaternionTemp).invert())
            .multiply(this.orbitWorldQuaternion);
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
