/**
 * Scenario tests: how close the orbit camera comes to what it frames (see @docs/graphics/camera_control.md).
 * OrbitCameraPose runs for real on plain three.js objects. The player stands at the origin, unturned, so
 * its frame is the world's.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import fc from "fast-check";
import OrbitCameraPose from "../../../src/client/object/components/helpers/player/orbitCameraPose";
import { orbitCameraAnglesObservable, orbitCameraZoomObservable } from "../../../src/client/system/clientObservables";
import AABB3 from "../../../src/shared/math/types/aabb3";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";

// The game camera's near plane (see GraphicsManager).
const CAMERA_NEAR = 0.1;

// A zoom position (see orbitCameraZoomObservable).
const ZOOMED_ALL_THE_WAY_IN = 1;

// three.js cameras look down their own -z.
const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);

/** Where the orbit puts the camera, and which way it looks, for a view of the target at a zoom. */
function poseFor(target: AABB3, minDistance: number, view: {azimuth: number, polar: number},
    zoomAmount: number): {position: THREE.Vector3, forward: THREE.Vector3}
{
    const player = new THREE.Object3D();
    const camera = new THREE.PerspectiveCamera();
    player.add(camera);
    // Well off to one side, so the orbit has a direction of its own to begin from.
    camera.position.set(target.center.x + 20, target.center.y, target.center.z + 20);

    const pose = new OrbitCameraPose();
    pose.reframe(target, minDistance, camera, player);
    orbitCameraAnglesObservable.set(view);
    orbitCameraZoomObservable.set(zoomAmount);

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    pose.updatePose(new THREE.Vector2(), 1, target, player, position, quaternion);
    return {position, forward: LOCAL_FORWARD.clone().applyQuaternion(quaternion)};
}

function cornersOf(target: AABB3): THREE.Vector3[]
{
    const corners: THREE.Vector3[] = [];
    for (const sx of [-1, 1])
        for (const sy of [-1, 1])
            for (const sz of [-1, 1])
                corners.push(new THREE.Vector3(target.center.x + sx * target.halfSize.x,
                    target.center.y + sy * target.halfSize.y, target.center.z + sz * target.halfSize.z));
    return corners;
}

describe("zooming the orbit in", () => {
    it("comes right up to a character's side, rather than stopping as far off as it is tall", () => {
        const character: AABB3 = {
            center: {x: 0, y: 0.5 * PLAYER_HEIGHT, z: 0},
            halfSize: {x: PLAYER_RADIUS_XZ, y: 0.5 * PLAYER_HEIGHT, z: PLAYER_RADIUS_XZ},
        };

        // Level with the character, on its +z side.
        const {position} = poseFor(character, 0, {azimuth: 0, polar: 0.5 * Math.PI}, ZOOMED_ALL_THE_WAY_IN);

        const gapToItsSide = position.z - PLAYER_RADIUS_XZ;
        expect(gapToItsSide).toBeGreaterThan(CAMERA_NEAR);
        expect(gapToItsSide).toBeLessThan(2 * PLAYER_RADIUS_XZ);
    });

    it("never lets any part of the target reach the camera's near plane, from any side", () => {
        fc.assert(fc.property(
            fc.record({
                halfX: fc.double({min: 0, max: 2, noNaN: true}),
                halfY: fc.double({min: 0, max: 2, noNaN: true}),
                halfZ: fc.double({min: 0, max: 2, noNaN: true}),
                azimuth: fc.double({min: -Math.PI, max: Math.PI, noNaN: true}),
                polar: fc.double({min: 0, max: Math.PI, noNaN: true}),
                // Both kinds of framing: by size alone, and with a minimum distance.
                minDistance: fc.constantFrom(0, 5),
            }),
            ({halfX, halfY, halfZ, azimuth, polar, minDistance}) =>
            {
                const target: AABB3 = {center: {x: 10, y: 2, z: 10}, halfSize: {x: halfX, y: halfY, z: halfZ}};
                const {position, forward} = poseFor(target, minDistance, {azimuth, polar},
                    ZOOMED_ALL_THE_WAY_IN);

                for (const corner of cornersOf(target))
                    expect(corner.sub(position).dot(forward)).toBeGreaterThan(CAMERA_NEAR);
            }),
            // Always tried: a tall target seen from as low as the orbit goes, whose aim point sits above
            // its middle and so furthest from its bottom.
            {examples: [[{halfX: 0, halfY: 2, halfZ: 0, azimuth: 0, polar: Math.PI, minDistance: 0}]]});
    });
});

describe("bringing the orbit within a distance range", () => {
    // How near to and far from its target a step might ask the camera to be.
    const RANGE = {min: 2.5, max: 6};

    /** How far a point is from the nearest and the farthest point of a target. */
    function distancesTo(target: AABB3, point: THREE.Vector3): {nearest: number, farthest: number}
    {
        const box = new THREE.Box3(
            new THREE.Vector3(target.center.x - target.halfSize.x, target.center.y - target.halfSize.y,
                target.center.z - target.halfSize.z),
            new THREE.Vector3(target.center.x + target.halfSize.x, target.center.y + target.halfSize.y,
                target.center.z + target.halfSize.z));
        const farthest = Math.max(...cornersOf(target).map(corner => corner.distanceTo(point)));
        return {nearest: box.distanceToPoint(point), farthest};
    }

    it("holds every point of the target within range, however far off the camera began and however it turns after", () => {
        fc.assert(fc.property(
            fc.record({
                // No larger than a block each way, so the range can hold from every side.
                halfX: fc.double({min: 0, max: 0.5, noNaN: true}),
                halfY: fc.double({min: 0, max: 0.5, noNaN: true}),
                halfZ: fc.double({min: 0, max: 0.5, noNaN: true}),
                zoomAmount: fc.double({min: 0, max: 1, noNaN: true}),
                azimuth: fc.double({min: -Math.PI, max: Math.PI, noNaN: true}),
                polar: fc.double({min: 0, max: Math.PI, noNaN: true}),
                minDistance: fc.constantFrom(0, 5),
            }),
            ({halfX, halfY, halfZ, zoomAmount, azimuth, polar, minDistance}) =>
            {
                const target: AABB3 = {center: {x: 10, y: 2, z: 10}, halfSize: {x: halfX, y: halfY, z: halfZ}};
                const player = new THREE.Object3D();
                const camera = new THREE.PerspectiveCamera();
                player.add(camera);
                camera.position.set(target.center.x + 20, target.center.y, target.center.z + 20);

                const pose = new OrbitCameraPose();
                pose.reframe(target, minDistance, camera, player);
                orbitCameraZoomObservable.set(zoomAmount);
                pose.applyDistanceRange(RANGE, target);

                // Turned only afterwards.
                orbitCameraAnglesObservable.set({azimuth, polar});
                const position = new THREE.Vector3();
                pose.updatePose(new THREE.Vector2(), 1, target, player, position, new THREE.Quaternion());

                const {nearest, farthest} = distancesTo(target, position);
                expect(nearest).toBeGreaterThanOrEqual(RANGE.min - 1e-9);
                expect(farthest).toBeLessThanOrEqual(RANGE.max + 1e-9);
            }));
    });

    it("leaves a zoom already within range as it was", () => {
        const target: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: {x: 0.5, y: 0.25, z: 0.5}};
        const player = new THREE.Object3D();
        const camera = new THREE.PerspectiveCamera();
        player.add(camera);
        camera.position.set(4, 1, 0);

        const pose = new OrbitCameraPose();
        pose.reframe(target, 5, camera, player);
        pose.matchZoomToCurrentDistance();
        const zoomAmount = orbitCameraZoomObservable.peek();

        pose.applyDistanceRange(RANGE, target);

        expect(orbitCameraZoomObservable.peek()).toBeCloseTo(zoomAmount, 12);
    });
});
