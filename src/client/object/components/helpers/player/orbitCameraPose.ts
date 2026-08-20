import * as THREE from "three";
import NumUtil from "../../../../../shared/math/util/numUtil";
import AABB3 from "../../../../../shared/math/types/aabb3";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { NEAR_EPSILON } from "../../../../../shared/system/sharedConstants";
import { orbitCameraAnglesObservable, orbitCameraZoomObservable } from "../../../../system/clientObservables";

// How far the pointer travels, in CSS pixels, to carry the camera one full turn around the target.
// A physical distance rather than a share of the canvas, so the orbit answers a given movement of
// the finger the same way whichever way the device is held (PlayerPointerInput documents why a
// canvas-relative measure does not).
const orbitPixelsPerFullTurn = 960;
const orbitSensitivity = (2 * Math.PI) / orbitPixelsPerFullTurn; // radians per CSS pixel

// Keep the orbit away from the poles (straight above/below the target),
// where the look-at up-vector would degenerate.
const minPolarAngle = 0.15;
const maxPolarAngle = Math.PI * 0.75;

// How far back the camera sits, as a multiple of the target's own reach (the radius of the sphere
// that holds it). Framing a target by its size is what lets the same orbit inspect a whole
// character and a single block without either filling the screen or being lost in it. The lower
// bound keeps a target with next to no size of its own from pulling the camera inside it.
const orbitDistancePerTargetReach = 2.4;
const minOrbitDistance = 3;

// How far the camera may sit from the framing distance above, as a multiple of it — the range the
// user's own zoom works within, and the range the distance he was already standing at is taken to
// fit into when an orbit begins. A range rather than free rein, since the framing is what the mode
// is for: past the far end the target is a speck among everything around it, and past the near end
// there is more of it off screen than on it.
const minZoomDistanceFactor = 0.4;
const maxZoomDistanceFactor = 2;

// The whole span of that range, as the ratio between its two ends. Zoom is multiplicative — a wheel
// notch and a pinch each report a multiple of what the user currently sees — so this, rather than
// the difference between the ends, is what a step of the zoom is measured against.
const zoomDistanceFactorSpan = maxZoomDistanceFactor / minZoomDistanceFactor;

// However hard the zoom is pushed, the camera stays outside the sphere that holds the target: from
// within the thing being inspected there is nothing left to inspect.
const minZoomDistancePerTargetReach = 1.2;

// Where in the target the orbit aims, measured up from its center as a share of the target's own
// half-height. A little above the middle rather than dead center, because what is worth looking at
// in something that stands upright — a character's face, the upper half of a door — is above its
// middle, and aiming at the middle leaves that near the top edge of the view with empty floor under
// it. Taken as a share of the target's own height rather than as a distance, so that the aim stays
// square on a block or a floor tile, which have next to no height to be off-center within.
const orbitPivotHeightPerTargetHalfHeight = 0.2;

// Where the camera goes when it has no direction of its own to keep (see reframe): behind the
// player and above him, looking the way he is facing — the over-the-shoulder framing that shows the
// user's own character without turning the room around behind it, so that what he sees when the
// orbit opens is still the view he was walking in. Expressed in the player's frame, where -z is the
// direction the player looks in.
const defaultOrbitDirection = new THREE.Vector3(0, 0.5, 1).normalize();

const pivotTemp = new THREE.Vector3();
const orbitOffsetTemp = new THREE.Vector3();
const worldPosTemp = new THREE.Vector3();
const worldQuatTemp = new THREE.Quaternion();
const parentQuatTemp = new THREE.Quaternion();
const lookMat4Temp = new THREE.Matrix4();

//------------------------------------------------------------------------
// Computes the camera pose for the "orbit" camera mode: the camera orbits around a point within the
// mode's target volume — which may be anywhere in the room, and need not be on the player (see
// setPivot for where in it) — and looks at that point, driven by grab-style pointer drags (the orbit
// angle follows the pointer's movement,
// like Three.js's OrbitControls), so the user can inspect the target from any angle — and from as
// close or as far as he asks to see it from, whether by pinching, wheeling, or moving the on-screen
// zoom control, all of which meet in orbitCameraZoomObservable. Which way the target is viewed from
// is published on the same terms (orbitCameraAnglesObservable), and can also be asked for from
// outside — by a scripted step arranging the view it wants the user to begin from (see setView).
//
// The orbit is described in world space, while the camera hangs off the player object (which is
// what makes the first-person view follow the player's eye for free). The pose is therefore handed
// back in the player's frame, the frame both modes are eased in, rather than the camera being taken
// off the player for the duration of the mode: expressing one pose in another frame costs a pair of
// conversions, whereas re-parenting mid-glide would split the easing across two frames of reference.
//------------------------------------------------------------------------

export default class OrbitCameraPose
{
    private spherical = new THREE.Spherical();

    // How far back the target's own size (and the caller's own floor, if any) asks the camera to
    // sit. Kept apart from how much closer or further the user has since asked to be (the zoom,
    // which lives in orbitCameraZoomObservable), so that pointing the orbit at something else
    // re-frames it without undoing the zoom: how close the user wants to look is a preference he
    // expressed, not a property of what he was looking at.
    private framingDistance: number = 0;

    // How far the camera stood from the target when it was last framed, or zero if it stood
    // nowhere in particular (see reframe). Kept for the orbit that is about to begin, which starts
    // from there rather than from the framing distance (see matchZoomToCurrentDistance).
    private distanceAtReframe: number = 0;

    // Frames the given target, keeping the direction the camera already views it from. Called each
    // time the mode is entered and each time it is pointed at something else, so that the camera
    // pulls back from where the user was already looking rather than swinging around to a fixed
    // side of the target — which, for a target in a wall, would be the far side of that wall.
    // A camera standing within the target's own footprint (the user orbiting his own body) has no
    // such direction to keep, and gets the default framing instead.
    // "minDistance" is the caller's own floor under the framing distance, for a target that has to
    // be seen in its surroundings rather than on its own (see CameraMode).
    reframe(target: AABB3, minDistance: number, camera: THREE.Camera, playerObj: THREE.Object3D): void
    {
        camera.getWorldPosition(worldPosTemp);
        orbitOffsetTemp.subVectors(worldPosTemp, setPivot(target, pivotTemp));

        // Standing clear of the target on either horizontal axis is enough to be viewing it from
        // somewhere. The test is the target's own footprint, rather than a circle drawn around it,
        // because a target hung flat against a wall is wide and paper-thin: a circle sized to its
        // width would cover the whole stretch of floor the user has to stand on to look at it, and
        // would take him for someone with no view of it — sending the camera through the wall.
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

        // The default direction was substituted above and carries no distance of its own, so there
        // is nothing for the orbit to begin from in that case.
        this.distanceAtReframe = cameraHasItsOwnView ? this.spherical.radius : 0;
    }

    // Takes up a view chosen from outside (see orbitCameraViewRequestObservable), in place of the
    // one the camera would otherwise have kept. Called after the framing above, which is what lets
    // a step point the camera at something and say how it wants that something looked at in the
    // same breath: what a patch of floor is, and that it is to be seen from above rather than
    // edge-on, are one instruction.
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

    // Begins the orbit at the distance the camera already stands at, instead of at the framing
    // distance. Where the user stood when he pointed the camera at something is a view he chose:
    // he walked up to the wall he is editing, or stayed back to see it whole, and pulling him to a
    // fixed distance from it throws that away and leaves him to zoom back to where he already was.
    // Called when the mode is entered rather than on every reframe, so that pointing the same orbit
    // at something else keeps the closeness the user has since zoomed to.
    matchZoomToCurrentDistance(): void
    {
        // A camera standing within the target's own footprint (the user orbiting his own body) has
        // no distance of its own to keep, any more than it has a direction, and gets the framing
        // distance instead.
        const zoomDistanceFactor = (this.distanceAtReframe > 0)
            ? NumUtil.clampInRange(this.distanceAtReframe / this.framingDistance,
                minZoomDistanceFactor, maxZoomDistanceFactor)
            : 1;
        orbitCameraZoomObservable.set(getZoomAmount(zoomDistanceFactor));
    }

    // "viewScale" is how much the user asked the view to grow since the previous frame, as a
    // multiple of its current apparent size (see PointerZoomInput).
    // Returns the desired camera interpolation rate.
    updatePose(dragDelta: THREE.Vector2, viewScale: number, target: AABB3, playerObj: THREE.Object3D,
        outPos: THREE.Vector3, outQuat: THREE.Quaternion): number
    {
        // The angles are taken back out of what they were published as, rather than carried on from
        // here, so that whoever else set them meanwhile is answered — the drag then moves the view
        // on from wherever it has been pointed (see orbitCameraAnglesObservable), exactly as the
        // zoom below carries on from whatever the slider or a wheel notch last made of it.
        const angles = orbitCameraAnglesObservable.peek();
        this.spherical.theta = angles.azimuth - orbitSensitivity * dragDelta.x;
        this.spherical.phi = NumUtil.clampInRange(
            angles.polar + orbitSensitivity * dragDelta.y, minPolarAngle, maxPolarAngle);
        this.publishAngles();

        // Apparent size is the reciprocal of distance, so growing the view is closing in on it. The
        // gesture is stepped in the terms the zoom is published in rather than in distances of its
        // own, which is what keeps a frame the user asked nothing of from moving the zoom at all —
        // and so from telling the slider that shows it to twitch sixty times a second.
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

    // Publishes where the orbit now views its target from, but only once it has actually moved: a
    // frame the user asked nothing of must not tell everything listening that the view has changed.
    private publishAngles(): void
    {
        const angles = orbitCameraAnglesObservable.peek();
        if (angles.azimuth === this.spherical.theta && angles.polar === this.spherical.phi)
            return;
        orbitCameraAnglesObservable.set({azimuth: this.spherical.theta, polar: this.spherical.phi});
    }
}

//------------------------------------------------------------------------
// The zoom is published (see orbitCameraZoomObservable) as a position within its range — 0 at the
// far end, 1 at the near one — rather than as the distance factor it stands for. That is what lets
// a control show it and move it without knowing anything about how far back the camera is or what
// it is looking at, both of which are this module's business alone.
//
// The two are related logarithmically, since zoom is multiplicative: equal steps along the range
// are equal multiples of distance. So one step of a slider does exactly what one notch of the wheel
// does, wherever along the range it is taken — and the middle of the range is the framing distance,
// the far and near ends being reciprocal multiples of it.
//------------------------------------------------------------------------

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

// How far the target reaches from its own center: the radius of the sphere that holds it, which is
// what every distance the camera keeps from it is measured against.
function getTargetReach(target: AABB3): number
{
    return Math.hypot(target.halfSize.x, target.halfSize.y, target.halfSize.z);
}
