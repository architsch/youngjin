import * as THREE from "three";
import NumUtil from "../../../../../shared/math/util/numUtil";
import AABB3 from "../../../../../shared/math/types/aabb3";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { NEAR_EPSILON } from "../../../../../shared/system/sharedConstants";
import { orbitCameraAnglesObservable, orbitCameraZoomObservable } from "../../../../system/clientObservables";

// Pointer travel (CSS px) for one full orbit turn; fixed length so orientation doesn't matter.
const orbitPixelsPerFullTurn = 960;
const orbitSensitivity = (2 * Math.PI) / orbitPixelsPerFullTurn; // radians per CSS pixel

// Keeps the orbit off the poles, where the look-at up-vector degenerates.
const minPolarAngle = 0.15;
const maxPolarAngle = Math.PI * 0.75;

// Framing distance as a multiple of the target's bounding-sphere radius, so any target size frames well.
const orbitDistancePerTargetReach = 2.4;
const minOrbitDistance = 3;

// Zoom range as multiples of the framing distance.
const minZoomDistanceFactor = 0.4;
const maxZoomDistanceFactor = 2;

// Zoom is multiplicative, so steps are measured against this ratio.
const zoomDistanceFactorSpan = maxZoomDistanceFactor / minZoomDistanceFactor;

// The camera always stays outside the target's bounding sphere.
const minZoomDistancePerTargetReach = 1.2;

// Aim point above centre as a share of half-height (faces and door tops sit above the middle). A share
// rather than a distance keeps flat targets like floor tiles centred.
const orbitPivotHeightPerTargetHalfHeight = 0.2;

// Over-the-shoulder default (player frame, -z = forward) when the camera has no direction to keep.
const defaultOrbitDirection = new THREE.Vector3(0, 0.5, 1).normalize();

const pivotTemp = new THREE.Vector3();
const orbitOffsetTemp = new THREE.Vector3();
const worldPosTemp = new THREE.Vector3();
const worldQuatTemp = new THREE.Quaternion();
const parentQuatTemp = new THREE.Quaternion();
const lookMat4Temp = new THREE.Matrix4();

// "orbit" pose: orbits a pivot within the target (see setPivot), driven by 1:1 drags, with zoom
// shared via orbitCameraZoomObservable and angles via orbitCameraAnglesObservable (settable by
// scripted steps; see setView). Computed in world space and returned in the player's frame, because
// the camera stays parented to the player (re-parenting mid-glide would break the easing).

export default class OrbitCameraPose
{
    private spherical = new THREE.Spherical();

    // Size-based framing distance, kept separate from the user's zoom so re-targeting keeps the zoom.
    private framingDistance: number = 0;

    // Camera distance at the last reframe (0 if none); the next orbit starts here
    // (see matchZoomToCurrentDistance).
    private distanceAtReframe: number = 0;

    // Frames a target, keeping the camera's current viewing direction (a fixed side could put the
    // camera behind a wall). Inside the target's footprint (e.g. orbiting one's own body), the default
    // direction is used. minDistance: caller-imposed floor (see CameraMode).
    reframe(target: AABB3, minDistance: number, camera: THREE.Camera, playerObj: THREE.Object3D): void
    {
        camera.getWorldPosition(worldPosTemp);
        orbitOffsetTemp.subVectors(worldPosTemp, setPivot(target, pivotTemp));

        // Tests the footprint rather than a circle: wall-flat targets are wide and thin, and a circle
        // would swallow the floor the user stands on and send the camera through the wall.
        const cameraHasItsOwnView =
            Math.abs(orbitOffsetTemp.x) > Math.max(target.halfSize.x, NEAR_EPSILON) ||
            Math.abs(orbitOffsetTemp.z) > Math.max(target.halfSize.z, NEAR_EPSILON);
        if (!cameraHasItsOwnView)
        {
            playerObj.getWorldQuaternion(parentQuatTemp);
            orbitOffsetTemp.copy(defaultOrbitDirection).applyQuaternion(parentQuatTemp);
        }

        this.spherical.setFromVector3(orbitOffsetTemp);
        this.spherical.phi = NumUtil.clampInRange(this.spherical.phi, minPolarAngle, maxPolarAngle);
        this.publishAngles();
        this.framingDistance = Math.max(minOrbitDistance, minDistance, orbitDistancePerTargetReach *
            getTargetReach(target));

        // The default direction has no distance to start from.
        this.distanceAtReframe = cameraHasItsOwnView ? this.spherical.radius : 0;
    }

    // Applies an externally requested view (see orbitCameraViewRequestObservable). Called after
    // framing, so a step can set the target and the view together.
    setView(view: {azimuth: number, polar: number, zoomAmount: number}): void
    {
        this.spherical.theta = view.azimuth;
        this.spherical.phi = NumUtil.clampInRange(view.polar, minPolarAngle, maxPolarAngle);
        this.publishAngles();
        orbitCameraZoomObservable.set(NumUtil.clampInRange(view.zoomAmount, 0, 1));
    }

    // How far the camera is currently being held from the target.
    getOrbitDistance(): number
    {
        return this.spherical.radius;
    }

    // Starts the orbit at the camera's current distance (the user's chosen vantage). Called on mode
    // entry only, so re-targeting keeps the zoom.
    matchZoomToCurrentDistance(): void
    {
        // Inside the target's footprint there is no distance to keep; use the framing distance.
        const zoomDistanceFactor = (this.distanceAtReframe > 0)
            ? NumUtil.clampInRange(this.distanceAtReframe / this.framingDistance,
                minZoomDistanceFactor, maxZoomDistanceFactor)
            : 1;
        orbitCameraZoomObservable.set(getZoomAmount(zoomDistanceFactor));
    }

    // viewScale: requested growth since last frame (see PointerZoomInput). Returns the interpolation rate.
    updatePose(dragDelta: THREE.Vector2, viewScale: number, target: AABB3, playerObj: THREE.Object3D,
        outPos: THREE.Vector3, outQuat: THREE.Quaternion): number
    {
        // Read back from the observables so external changes (steps, the slider) are respected.
        const angles = orbitCameraAnglesObservable.peek();
        this.spherical.theta = angles.azimuth - orbitSensitivity * dragDelta.x;
        this.spherical.phi = NumUtil.clampInRange(
            angles.polar + orbitSensitivity * dragDelta.y, minPolarAngle, maxPolarAngle);
        this.publishAngles();

        // Size is 1/distance. Stepped in published zoom terms so idle frames don't republish (and
        // twitch the slider).
        const zoomAmount = orbitCameraZoomObservable.peek();
        const newZoomAmount = NumUtil.clampInRange(
            zoomAmount + Math.log(viewScale) / Math.log(zoomDistanceFactorSpan), 0, 1);
        if (newZoomAmount !== zoomAmount)
            orbitCameraZoomObservable.set(newZoomAmount);

        this.spherical.radius = Math.max(
            this.framingDistance * getZoomDistanceFactor(newZoomAmount),
            minZoomDistancePerTargetReach * getTargetReach(target));

        setPivot(target, pivotTemp);
        orbitOffsetTemp.setFromSpherical(this.spherical);
        worldPosTemp.addVectors(pivotTemp, orbitOffsetTemp);
        lookMat4Temp.lookAt(worldPosTemp, pivotTemp, DIRECTION_VECTORS["+y"]);
        worldQuatTemp.setFromRotationMatrix(lookMat4Temp);

        // Down into the player's frame, which is where the camera itself lives (see above).
        playerObj.updateMatrixWorld();
        playerObj.getWorldQuaternion(parentQuatTemp);
        outPos.copy(playerObj.worldToLocal(worldPosTemp));
        outQuat.copy(parentQuatTemp.invert()).multiply(worldQuatTemp);

        return 4;
    }

    // Publishes only on actual change.
    private publishAngles(): void
    {
        const angles = orbitCameraAnglesObservable.peek();
        if (angles.azimuth === this.spherical.theta && angles.polar === this.spherical.phi)
            return;
        orbitCameraAnglesObservable.set({azimuth: this.spherical.theta, polar: this.spherical.phi});
    }
}

// Zoom is published as a 0..1 position (0 = far, 1 = near) so UI needs no camera knowledge. The
// mapping is logarithmic, so slider steps match wheel notches; the middle is the framing distance.

function getZoomDistanceFactor(zoomAmount: number): number
{
    return maxZoomDistanceFactor * Math.pow(1 / zoomDistanceFactorSpan, zoomAmount);
}

function getZoomAmount(zoomDistanceFactor: number): number
{
    return Math.log(maxZoomDistanceFactor / zoomDistanceFactor) / Math.log(zoomDistanceFactorSpan);
}

// The point within the target that the camera orbits around and looks at (see the share above).
function setPivot(target: AABB3, out: THREE.Vector3): THREE.Vector3
{
    return out.set(
        target.center.x,
        target.center.y + orbitPivotHeightPerTargetHalfHeight * target.halfSize.y,
        target.center.z);
}

// Target bounding-sphere radius, the unit for all orbit distances.
function getTargetReach(target: AABB3): number
{
    return Math.hypot(target.halfSize.x, target.halfSize.y, target.halfSize.z);
}
