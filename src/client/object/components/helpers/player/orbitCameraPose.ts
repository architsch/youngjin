import * as THREE from "three";
import NumUtil from "../../../../../shared/math/util/numUtil";
import AABB3 from "../../../../../shared/math/types/aabb3";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { NEAR_EPSILON } from "../../../../../shared/system/sharedConstants";

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
const minZoomDistanceFactor = 0.5;
const maxZoomDistanceFactor = 2;

// However hard the zoom is pushed, the camera stays outside the sphere that holds the target: from
// within the thing being inspected there is nothing left to inspect.
const minZoomDistancePerTargetReach = 1.2;

// Where the camera goes when it has no direction of its own to keep (see reframe): above, slightly
// off to the side, and out front of the player, looking back — the framing that shows the user's
// own character. Expressed in the player's frame, where -z is the direction the player looks in.
const defaultOrbitDirection = new THREE.Vector3(0.5, 0.7, -1).normalize();

const pivotTemp = new THREE.Vector3();
const orbitOffsetTemp = new THREE.Vector3();
const worldPosTemp = new THREE.Vector3();
const worldQuatTemp = new THREE.Quaternion();
const parentQuatTemp = new THREE.Quaternion();
const lookMat4Temp = new THREE.Matrix4();

//------------------------------------------------------------------------
// Computes the camera pose for the "orbit" camera mode: the camera orbits around the center of the
// mode's target volume — which may be anywhere in the room, and need not be on the player — and
// looks at it, driven by grab-style pointer drags (the orbit angle follows the pointer's movement,
// like Three.js's OrbitControls), so the user can inspect the target from any angle — and from as
// close or as far as he pinches or wheels the view to.
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
    // sit, and how much closer or further the user has since asked to be. Kept apart so that
    // pointing the orbit at something else re-frames it without undoing the zoom: how close the
    // user wants to look is a preference he expressed, not a property of what he was looking at.
    private framingDistance: number = 0;
    private zoomDistanceFactor: number = 1;

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
        orbitOffsetTemp.set(
            worldPosTemp.x - target.center.x,
            worldPosTemp.y - target.center.y,
            worldPosTemp.z - target.center.z);

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
        this.framingDistance = Math.max(minOrbitDistance, minDistance, orbitDistancePerTargetReach *
            getTargetReach(target));

        // The default direction was substituted above and carries no distance of its own, so there
        // is nothing for the orbit to begin from in that case.
        this.distanceAtReframe = cameraHasItsOwnView ? this.spherical.radius : 0;
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
        this.zoomDistanceFactor = (this.distanceAtReframe > 0)
            ? NumUtil.clampInRange(this.distanceAtReframe / this.framingDistance,
                minZoomDistanceFactor, maxZoomDistanceFactor)
            : 1;
    }

    // "viewScale" is how much the user asked the view to grow since the previous frame, as a
    // multiple of its current apparent size (see PointerZoomInput).
    updatePose(dragDelta: THREE.Vector2, viewScale: number, target: AABB3, playerObj: THREE.Object3D,
        outPos: THREE.Vector3, outQuat: THREE.Quaternion): void
    {
        this.spherical.theta -= orbitSensitivity * dragDelta.x;
        this.spherical.phi = NumUtil.clampInRange(
            this.spherical.phi + orbitSensitivity * dragDelta.y, minPolarAngle, maxPolarAngle);

        // Apparent size is the reciprocal of distance, so growing the view is closing in on it.
        this.zoomDistanceFactor = NumUtil.clampInRange(this.zoomDistanceFactor / viewScale,
            minZoomDistanceFactor, maxZoomDistanceFactor);
        this.spherical.radius = Math.max(this.framingDistance * this.zoomDistanceFactor,
            minZoomDistancePerTargetReach * getTargetReach(target));

        pivotTemp.set(target.center.x, target.center.y, target.center.z);
        orbitOffsetTemp.setFromSpherical(this.spherical);
        worldPosTemp.addVectors(pivotTemp, orbitOffsetTemp);
        lookMat4Temp.lookAt(worldPosTemp, pivotTemp, DIRECTION_VECTORS["+y"]);
        worldQuatTemp.setFromRotationMatrix(lookMat4Temp);

        // Down into the player's frame, which is where the camera itself lives (see above).
        playerObj.updateMatrixWorld();
        playerObj.getWorldQuaternion(parentQuatTemp);
        outPos.copy(playerObj.worldToLocal(worldPosTemp));
        outQuat.copy(parentQuatTemp.invert()).multiply(worldQuatTemp);
    }
}

// How far the target reaches from its own center: the radius of the sphere that holds it, which is
// what every distance the camera keeps from it is measured against.
function getTargetReach(target: AABB3): number
{
    return Math.hypot(target.halfSize.x, target.halfSize.y, target.halfSize.z);
}
