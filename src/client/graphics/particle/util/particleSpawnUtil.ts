import * as THREE from "three";
import App from "../../../app";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MIN } from "../../../../shared/system/sharedConstants";
import Vec3 from "../../../../shared/math/types/vec3";
import ParticleEmitterHandle from "../types/particleEmitterHandle";
import ParticleLayerConfig from "../types/particleLayerConfig";
import ParticleSpawn from "../types/particleSpawn";

// Below any floor, for particles that don't land.
const NO_LANDING_Y = -1e6;
const DOWN: Vec3 = {x: 0, y: -1, z: 0};

const offsetTemp = new THREE.Vector3();
const axisTemp = new THREE.Vector3();
const directionTemp = new THREE.Vector3();
const sideTemp = new THREE.Vector3();
const otherSideTemp = new THREE.Vector3();

// A particle's starting state, drawn at random within its layer's ranges, in its emitter's frame. Everything
// after its birth is the shader's.
const ParticleSpawnUtil =
{
    fill: (out: ParticleSpawn, emitter: ParticleEmitterHandle, layer: ParticleLayerConfig, paramRow: number,
        spawnTime: number, level: number, packedTint: number): void =>
    {
        const scale = emitter.sizeScale;
        const half = layer.spawnHalfSize;
        let across = half ? randomSigned() * half.x * scale : 0;
        let up = half ? randomSigned() * half.y * scale : 0;
        let along = half ? randomSigned() * half.z * scale : 0;
        if (half && layer.spawnOnSurface)
        {
            // Onto one of the box's faces, chosen in proportion to its area.
            const areaX = half.y * half.z, areaY = half.x * half.z, areaZ = half.x * half.y;
            const pick = Math.random() * (areaX + areaY + areaZ);
            const side = (Math.random() < 0.5) ? -1 : 1;
            if (pick < areaX)
                across = side * half.x * scale;
            else if (pick < areaX + areaY)
                up = side * half.y * scale;
            else
                along = side * half.z * scale;
        }
        offsetTemp.set(0, 0, 0)
            .addScaledVector(emitter.right, across)
            .addScaledVector(emitter.up, up)
            .addScaledVector(emitter.forward, along);
        out.origin.x = emitter.position.x + offsetTemp.x;
        out.origin.y = emitter.position.y + offsetTemp.y;
        out.origin.z = emitter.position.z + offsetTemp.z;

        axisTemp.copy(emitter.forward);
        if (layer.launch === "radial" && offsetTemp.lengthSq() > 1e-8)
            axisTemp.copy(offsetTemp).normalize();
        randomDirectionInCone(axisTemp, layer.spread ?? 0, directionTemp);

        const speed = randomInRange(layer.speed) * emitter.speedScale * level * scale;
        out.velocity.x = directionTemp.x * speed;
        out.velocity.y = directionTemp.y * speed;
        out.velocity.z = directionTemp.z * speed;

        let lifetime = randomInRange(layer.lifetime);
        if (emitter.stopDistance < Infinity)
        {
            const axialSpeed = directionTemp.dot(emitter.forward) * speed;
            lifetime = Math.min(lifetime, getTimeToTravel(emitter.stopDistance - along, axialSpeed, layer.drag ?? 0));
        }

        out.spawnTime = spawnTime;
        out.lifetime = lifetime;
        out.paramRow = paramRow;
        out.seed = Math.random();
        out.size = randomInRange(layer.size) * scale;
        out.packedTint = packedTint;
        out.levelAtBirth = level;
        out.landingY = layer.landing ? getFloorBelow(out.origin.x, out.origin.y, out.origin.z) : NO_LANDING_Y;
    },
    createSpawn: (): ParticleSpawn =>
    {
        return {origin: {x: 0, y: 0, z: 0}, spawnTime: 0, velocity: {x: 0, y: 0, z: 0}, lifetime: 0,
            paramRow: 0, seed: 0, size: 0, packedTint: 0, levelAtBirth: 1, landingY: NO_LANDING_Y};
    },
}

// How long a particle launched at this speed along an axis, slowed by linear drag, takes to travel a
// distance along it; forever if it never gets that far.
function getTimeToTravel(distance: number, axialSpeed: number, drag: number): number
{
    if (distance <= 0)
        return 0;
    if (axialSpeed <= 0)
        return Infinity;
    if (drag <= 0)
        return distance / axialSpeed;
    // Travel under drag approaches speed / drag.
    const reach = axialSpeed / drag;
    if (distance >= reach)
        return Infinity;
    return -Math.log(1 - distance / reach) / drag;
}

// The top of the highest occupied block under a point, or the room's floor.
function getFloorBelow(x: number, y: number, z: number): number
{
    const voxels = App.getCurrentRoom()?.voxelGrid.voxels;
    if (voxels == undefined)
        return NO_LANDING_Y;
    const distance = VoxelQueryUtil.getDistanceToOccupiedBlock(voxels, {x, y, z}, DOWN, y);
    return (distance < Infinity) ? y - distance : COLLISION_LAYER_MIN * COLLISION_LAYER_HEIGHT;
}

// Uniform over the cap of directions within angle of axis (a unit vector).
function randomDirectionInCone(axis: THREE.Vector3, angle: number, out: THREE.Vector3): THREE.Vector3
{
    if (angle <= 0)
        return out.copy(axis);
    const cosTheta = 1 - Math.random() * (1 - Math.cos(Math.min(angle, Math.PI)));
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const phi = 2 * Math.PI * Math.random();
    // Any two axes across the cone's axis.
    sideTemp.set(Math.abs(axis.y) < 0.9 ? 0 : 1, Math.abs(axis.y) < 0.9 ? 1 : 0, 0).cross(axis).normalize();
    otherSideTemp.copy(axis).cross(sideTemp);
    return out.copy(axis).multiplyScalar(cosTheta)
        .addScaledVector(sideTemp, sinTheta * Math.cos(phi))
        .addScaledVector(otherSideTemp, sinTheta * Math.sin(phi));
}

function randomInRange(range: [number, number]): number
{
    return range[0] + Math.random() * (range[1] - range[0]);
}

function randomSigned(): number
{
    return 2 * Math.random() - 1;
}

export default ParticleSpawnUtil;
