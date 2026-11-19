import AABB3 from "../../math/types/aabb3";
import RaycastHitResult3 from "../../math/types/raycastHitResult3";
import Vec3 from "../../math/types/vec3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import Vector3DUtil from "../../math/util/vector3DUtil";
import ObjectTypeConfigMap from "../../object/maps/objectTypeConfigMap";
import AdminPrefsUtil from "../../object/util/adminPrefsUtil";
import VoxelQueryUtil from "../../voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS } from "../../system/sharedConstants";
import { ColliderState } from "../types/colliderState";
import PhysicsObject from "../types/physicsObject";
import PhysicsRoom from "../types/physicsRoom";
import PhysicsSphereHit from "../types/physicsSphereHit";
import PhysicsVoxelUtil from "./physicsVoxelUtil";

// What a sphere only touches it doesn't reach, by more than rounding leaves where it touches.
const REACH_TOLERANCE = 0.000001;

// Spheres among the boxes (see ColliderConfig.shape): what one in motion strikes, and what one reaches into. Nothing
// here moves anything: what a strike does is its caller's (see CannonBallUtil).
const PhysicsSphereUtil =
{
    isSphere: (colliderState: ColliderState): boolean =>
    {
        return colliderState.colliderConfig.shape == "sphere";
    },
    getRadius: (colliderState: ColliderState): number =>
    {
        return colliderState.hitbox.halfSize.x;
    },
    // Whether physics moves an object as a body (its type's Rigidbody component), and it is no ghost, which nothing
    // touches (see AdminPrefsUtil.isGhost).
    isBody: (physicsRoom: PhysicsRoom, object: PhysicsObject): boolean =>
    {
        return ObjectTypeConfigMap.getConfigByIndex(object.objectTypeIndex).components.spawnedByMe?.rigidbody != undefined
            && !AdminPrefsUtil.isGhost(physicsRoom.room.objectById[object.objectId]);
    },
    // Whether a sphere that strikes an object bounces off it (see ColliderConfig.bouncesSpheres).
    bounces: (object: PhysicsObject): boolean =>
    {
        return object.colliderState.colliderConfig.bouncesSpheres == true;
    },
    // The first thing a sphere strikes as its middle goes from one place to another, if anything: a voxel block, the
    // room's own floor or ceiling, a body, another sphere, an object that stops bodies, unless the sphere sets off
    // from inside that one, or any other object spheres bounce off, if the sphere is closing on it. The room's sides,
    // beyond its blocks, stop nothing. A radius of zero casts a ray.
    cast: (physicsRoom: PhysicsRoom, from: Vec3, to: Vec3, radius: number,
        ignoredObjectIds: ReadonlySet<string>): PhysicsSphereHit | undefined =>
    {
        const swept: AABB3 = {
            center: Vector3DUtil.scale(Vector3DUtil.add(from, to), 0.5),
            halfSize: {x: 0.5 * Math.abs(to.x - from.x) + radius, y: 0.5 * Math.abs(to.y - from.y) + radius,
                z: 0.5 * Math.abs(to.z - from.z) + radius},
        };
        const struck: {result: RaycastHitResult3, block?: PhysicsSphereHit["block"], object?: PhysicsObject}[] = [];
        const consider = (result: RaycastHitResult3, block?: PhysicsSphereHit["block"], object?: PhysicsObject) => {
            if (result.hitNormal != undefined && (struck.length == 0 || result.hitRayScale < struck[0].result.hitRayScale))
                struck[0] = {result, block, object};
        };

        forEachBlockIn(physicsRoom, swept, (row, col, collisionLayer) => consider(Geometry3DUtil.castSphereAgainstAABB(
            from, to, radius, VoxelQueryUtil.getVoxelBlockBox(row, col, collisionLayer)), {row, col, collisionLayer}));
        for (const bound of physicsRoom.floorAndCeiling)
            consider(Geometry3DUtil.castSphereAgainstAABB(from, to, radius, bound.hitbox));
        for (const object of getObjectsIn(physicsRoom, swept, ignoredObjectIds))
        {
            const {hitbox, colliderConfig} = object.colliderState;
            if (PhysicsSphereUtil.isSphere(object.colliderState))
            {
                consider(Geometry3DUtil.castSphereAgainstSphere(from, to, radius, hitbox.center,
                    PhysicsSphereUtil.getRadius(object.colliderState)), undefined, object);
            }
            else if (PhysicsSphereUtil.isBody(physicsRoom, object))
                consider(castAgainstShape(object, from, to, radius), undefined, object);
            else if (colliderConfig.applyHardCollisionToOthers)
            {
                const result = Geometry3DUtil.castSphereAgainstAABB(from, to, radius, hitbox);
                if (result.hitRayScale > 0)
                    consider(result, undefined, object);
            }
            else if (PhysicsSphereUtil.bounces(object))
            {
                const result = castAgainstShape(object, from, to, radius);
                const normal = (result.hitNormal == undefined) ? undefined
                    : getBounceNormal(physicsRoom, object, result.hitNormal);
                // One it is leaving, as it is having bounced off it, lets it go.
                if (normal != undefined && Vector3DUtil.dot(Vector3DUtil.subtract(to, from), normal) < 0)
                    consider({hitRayScale: result.hitRayScale, hitNormal: normal}, undefined, object);
            }
        }
        if (struck.length == 0)
            return undefined;

        const {result, block, object} = struck[0];
        const normal = result.hitNormal!;
        const center = Vector3DUtil.add(from, Vector3DUtil.scale(Vector3DUtil.subtract(to, from), result.hitRayScale));
        return {rayScale: result.hitRayScale, center, normal,
            contact: Vector3DUtil.subtract(center, Vector3DUtil.scale(normal, radius)), block, object};
    },
    // The voxel blocks and the objects a sphere reaches into, whatever they are.
    getReached: (physicsRoom: PhysicsRoom, center: Vec3, radius: number, ignoredObjectIds: ReadonlySet<string>)
        : {blocks: {row: number, col: number, collisionLayer: number}[], objects: PhysicsObject[]} =>
    {
        const reach = Math.max(0, radius - REACH_TOLERANCE);
        const box: AABB3 = {center, halfSize: {x: reach, y: reach, z: reach}};
        const blocks: {row: number, col: number, collisionLayer: number}[] = [];
        forEachBlockIn(physicsRoom, box, (row, col, collisionLayer) => {
            if (Geometry3DUtil.sphereOverlapsAABB(center, reach, VoxelQueryUtil.getVoxelBlockBox(row, col, collisionLayer)))
                blocks.push({row, col, collisionLayer});
        });
        const objects = getObjectsIn(physicsRoom, box, ignoredObjectIds).filter(object =>
            PhysicsSphereUtil.isSphere(object.colliderState)
                ? Vector3DUtil.distSqr(center, object.colliderState.hitbox.center)
                    < (reach + PhysicsSphereUtil.getRadius(object.colliderState)) ** 2
                : Geometry3DUtil.sphereOverlapsAABB(center, reach, object.colliderState.hitbox));
        return {blocks, objects};
    },
}

// A sphere's way against an object, as the shape a sphere meets it as (see ColliderConfig.shape).
function castAgainstShape(object: PhysicsObject, from: Vec3, to: Vec3, radius: number): RaycastHitResult3
{
    const {hitbox, colliderConfig} = object.colliderState;
    return (colliderConfig.shape == "cylinder")
        ? Geometry3DUtil.castSphereAgainstUprightCylinder(from, to, radius, hitbox)
        : Geometry3DUtil.castSphereAgainstAABB(from, to, radius, hitbox);
}

// The way a sphere bounces off an object that stops no body, where it touches it: out of a cylinder there, and, off a
// box, the way the room keeps it facing (none for one the room no longer keeps).
function getBounceNormal(physicsRoom: PhysicsRoom, object: PhysicsObject, wayOut: Vec3): Vec3 | undefined
{
    if (object.colliderState.colliderConfig.shape == "cylinder")
        return wayOut;
    const facing = physicsRoom.room.objectById[object.objectId]?.transform.dir;
    return (facing == undefined) ? undefined : Geometry3DUtil.getAxisFacingBasis(facing).normal;
}

// The room's blocks whose cells a box reaches into, from its grid as it stands.
function forEachBlockIn(physicsRoom: PhysicsRoom, box: AABB3,
    visit: (row: number, col: number, collisionLayer: number) => void): void
{
    const voxels = physicsRoom.room.voxelGrid.voxels;
    const minCol = Math.max(0, VoxelQueryUtil.getVoxelColFromWorldX(box.center.x - box.halfSize.x));
    const maxCol = Math.min(NUM_VOXEL_COLS - 1, VoxelQueryUtil.getVoxelColFromWorldX(box.center.x + box.halfSize.x));
    const minRow = Math.max(0, VoxelQueryUtil.getVoxelRowFromWorldZ(box.center.z - box.halfSize.z));
    const maxRow = Math.min(NUM_VOXEL_ROWS - 1, VoxelQueryUtil.getVoxelRowFromWorldZ(box.center.z + box.halfSize.z));
    const minLayer = Math.max(COLLISION_LAYER_MIN,
        VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(box.center.y - box.halfSize.y));
    const maxLayer = Math.min(COLLISION_LAYER_MAX,
        VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(box.center.y + box.halfSize.y));
    for (let row = minRow; row <= maxRow; ++row)
    {
        for (let col = minCol; col <= maxCol; ++col)
        {
            const blockLayerMask = voxels[row * NUM_VOXEL_COLS + col].blockLayerMask;
            for (let layer = minLayer; layer <= maxLayer; ++layer)
            {
                if ((blockLayerMask & (1 << layer)) != 0)
                    visit(row, col, layer);
            }
        }
    }
}

// The objects kept in the physics voxels a box reaches into, each once.
function getObjectsIn(physicsRoom: PhysicsRoom, box: AABB3, ignoredObjectIds: ReadonlySet<string>): PhysicsObject[]
{
    const objects: PhysicsObject[] = [];
    for (const voxel of PhysicsVoxelUtil.getVoxelsInBox(physicsRoom, box))
    {
        for (const object of voxel.intersectingObjects)
        {
            if (!ignoredObjectIds.has(object.objectId) && !objects.includes(object))
                objects.push(object);
        }
    }
    return objects;
}

export default PhysicsSphereUtil;
