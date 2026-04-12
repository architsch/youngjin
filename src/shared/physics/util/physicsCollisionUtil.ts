import AABB3 from "../../math/types/aabb3";
import Vec3 from "../../math/types/vec3";
import Vector3DUtil from "../../math/util/vector3DUtil";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import PhysicsObject from "../types/physicsObject";
import PhysicsRoom from "../types/physicsRoom";
import PhysicsColliderStateUtil from "./physicsColliderStateUtil";
import ObjectTransformUpdateResult from "../../object/types/objectTransformUpdateResult";
import ObjectTransform from "../../object/types/objectTransform";
import { GRAVITY_SPEED, SOFT_COLLISION_PUSH_SPEED_LIMIT } from "../../system/sharedConstants";
import { ColliderState } from "../types/colliderState";

const PhysicsCollisionUtil =
{
    applyHardCollision: (physicsRoom: PhysicsRoom, object: PhysicsObject, target: Vec3, targetDir: Vec3): ObjectTransformUpdateResult =>
    {
        const newColliderState = PhysicsColliderStateUtil.getObjectColliderState(object.objectTypeIndex, target, targetDir);
        if (!newColliderState)
            throw new Error(`ColliderState couldn't be computed (objectId = ${object.objectId}, objectTypeIndex = ${object.objectTypeIndex})`);

        const halfSize = newColliderState.hitbox.halfSize;
        const maxClimbableHeight = newColliderState.colliderConfig.maxClimbableHeight;
        let start = object.colliderState.hitbox.center;

        // Any attempt to move more than 3 units from the server's last synced location
        // will be subject to forced resync.
        if (Vector3DUtil.distSqr(target, start) >= 9)
        {
            console.warn(`Physics-position desync due to distance gap`);
            return {transform: new ObjectTransform(start, targetDir), desyncDetected: true};
        }
        const result1 = applyHardCollisionToAABBMovement(physicsRoom, object,
            start, target, halfSize, maxClimbableHeight);
        let resolvedTarget = result1.closestHitPos;
        if (result1.closestHitSlide != undefined) // Need to slide
        {
            const slideTarget = Vector3DUtil.add(result1.closestHitPos, result1.closestHitSlide);
            const result2 = applyHardCollisionToAABBMovement(physicsRoom, object,
                result1.closestHitPos, slideTarget, halfSize, maxClimbableHeight);
            resolvedTarget = result2.closestHitPos;
            if (result2.closestHitSlide != undefined) // Need to slide again
            {
                const slideTarget2 = Vector3DUtil.add(result2.closestHitPos, result2.closestHitSlide);
                const result3 = applyHardCollisionToAABBMovement(physicsRoom, object,
                    result2.closestHitPos, slideTarget2, halfSize, maxClimbableHeight);
                resolvedTarget = result3.closestHitPos;
            }
        }
        return {transform: new ObjectTransform(resolvedTarget, targetDir), desyncDetected: false};
    },

    // Returns the adjusted velocity.
    applySoftCollision: (physicsRoom: PhysicsRoom, object: PhysicsObject, desiredVelocity: Vec3): Vec3 =>
    {
        let velocity = desiredVelocity;

        const objectHitbox = object.colliderState.hitbox;
        const objectVolume = 8 * objectHitbox.halfSize.x * objectHitbox.halfSize.y * objectHitbox.halfSize.z; // 8 = 2*2*2
        const objectCenter = objectHitbox.center;
        const colliderConfig = object.colliderState.colliderConfig;

        const overlaps = PhysicsColliderStateUtil.findOverlappingColliderStates(
            physicsRoom, objectHitbox);

        let climbing = false;
        overlaps.forEach((overlap) =>
        {
            // Climb up the obstacle if it is climbable.
            if (canClimbObstacle(physicsRoom, object, objectCenter,
                colliderConfig.maxClimbableHeight, overlap))
            {
                climbing = true;
                return;
            }

            const outgoingMult = overlap.colliderConfig.outgoingSoftCollisionForceMultiplier;
            if (outgoingMult <= 0)
                return;
            const intersection = Geometry3DUtil.getIntersectionAABB(objectHitbox, overlap.hitbox);
            const intersectionVolume = 8 * intersection.halfSize.x * intersection.halfSize.y * intersection.halfSize.z; // 8 = 2*2*2
            const intersectionToObjectDir = Vector3DUtil.normalize(
                Vector3DUtil.subtract(objectCenter, intersection.center));
            
            const intersectionProportion = intersectionVolume / objectVolume;
            const incomingMult = colliderConfig.incomingSoftCollisionForceMultiplier;
            const pushMagnitude = 10 * intersectionProportion * outgoingMult * incomingMult;

            // Limit the push magnitude.
            let push = Vector3DUtil.scale(intersectionToObjectDir, pushMagnitude);
            const pushLength = Vector3DUtil.length(push);
            if (pushLength > SOFT_COLLISION_PUSH_SPEED_LIMIT)
                push = Vector3DUtil.scale(push, SOFT_COLLISION_PUSH_SPEED_LIMIT / pushLength);

            velocity = Vector3DUtil.add(velocity, push);

            // Limit the velocity magnitude.
            const velocityLength = Vector3DUtil.length(velocity);
            if (velocityLength > GRAVITY_SPEED)
                velocity = Vector3DUtil.scale(velocity, GRAVITY_SPEED / velocityLength);
        });

        if (climbing)
            velocity.y = Math.max(GRAVITY_SPEED, velocity.y);
        return velocity;
    },
}

function applyHardCollisionToAABBMovement(physicsRoom: PhysicsRoom, object: PhysicsObject,
    start: Vec3, target: Vec3, halfSize: Vec3, maxClimbableHeight: number)
    : {closestHitPos: Vec3, closestHitSlide: Vec3 | undefined}
{
    // Step back a bit to prevent raycasting from within obstacles.
    const startToTarget = Vector3DUtil.subtract(target, start);
    const startToTargetDir = Vector3DUtil.normalize(startToTarget);
    const startToTargetEpsilon = Vector3DUtil.scale(startToTargetDir, 0.001);
    start = Vector3DUtil.subtract(start, startToTargetEpsilon);
    
    const ray = Vector3DUtil.subtract(target, start);
    const rayStartAABB: AABB3 = {center: start, halfSize};

    const minX = Math.min(start.x, target.x) - halfSize.x;
    const maxX = Math.max(start.x, target.x) + halfSize.x;
    const minY = Math.min(start.y, target.y) - halfSize.y;
    const maxY = Math.max(start.y, target.y) + halfSize.y;
    const minZ = Math.min(start.z, target.z) - halfSize.z;
    const maxZ = Math.max(start.z, target.z) + halfSize.z;
    const rayRangeAABB: AABB3 = {
        center: {x: 0.5*(minX+maxX), y: 0.5*(minY+maxY), z: 0.5*(minZ+maxZ)},
        halfSize: {x: 0.5*(maxX-minX), y: 0.5*(maxY-minY), z: 0.5*(maxZ-minZ)},
    };
    const overlaps = PhysicsColliderStateUtil.findOverlappingColliderStates(
        physicsRoom, rayRangeAABB);

    let closestHitPos = target;
    let closestHitSlide: Vec3 | undefined = undefined;
    let closestRaycastHitDistSqr = Vector3DUtil.distSqr(target, start);

    overlaps.forEach((overlap) =>
    {
        if (!overlap.colliderConfig.applyHardCollisionToOthers)
            return;

        // Prevent climbable obstacles from exerting hard collision forces.
        const hypotheticalTargetWhenClimbing: Vec3 = {x: target.x, y: start.y, z: target.z};
        if (canClimbObstacle(physicsRoom, object, hypotheticalTargetWhenClimbing, maxClimbableHeight, overlap))
            return;

        const result = Geometry3DUtil.castAABBAgainstAABB(rayStartAABB, target, overlap.hitbox);
        if (result.hitNormal != undefined) // Hit detected
        {
            const startToHit = Vector3DUtil.scale(ray, result.hitRayScale);
            const hitPos = Vector3DUtil.add(start, startToHit);
            const hitPosDistSqr = Vector3DUtil.distSqr(hitPos, start);
            if (hitPosDistSqr < closestRaycastHitDistSqr)
            {
                closestHitPos = hitPos;
                closestRaycastHitDistSqr = hitPosDistSqr;

                // Slide along the hit surface ("slide" is basically the "hitToTarget" vector projected upon the surface which was hit by the ray)
                const hitToTarget = Vector3DUtil.subtract(target, hitPos);
                const dotNormal = Vector3DUtil.dot(hitToTarget, result.hitNormal);
                closestHitSlide = Vector3DUtil.subtract(hitToTarget, Vector3DUtil.scale(result.hitNormal, dotNormal));
            }
        }
    });
    return {closestHitPos, closestHitSlide};
}

function canClimbObstacle(physicsRoom: PhysicsRoom, object: PhysicsObject,
    myPos: Vec3, maxClimbableHeight: number, obstacle: ColliderState): boolean
{
    const myHitbox = object.colliderState.hitbox;
    const myBottom = myPos.y - myHitbox.halfSize.y;
    const obstacleTop = obstacle.hitbox.center.y + obstacle.hitbox.halfSize.y;
    const heightToClimb = obstacleTop - myBottom;
    if (heightToClimb > maxClimbableHeight || heightToClimb <= 0) // height constraint not met
        return false;
    
    // Is there room on top of the obstacle for me to stand?
    const onTopCheckAABB: AABB3 = {
        center: {x: myPos.x, y: obstacleTop + myHitbox.halfSize.y, z: myPos.z},
        halfSize: {x: myHitbox.halfSize.x, y: myHitbox.halfSize.y, z: myHitbox.halfSize.z},
    };
    const onTopOverlaps = PhysicsColliderStateUtil.findOverlappingColliderStates(
        physicsRoom, onTopCheckAABB);
    let onTopBlocked = false;
    onTopOverlaps.forEach((overlap) => {
        if (overlap.colliderConfig.applyHardCollisionToOthers &&
            !Geometry3DUtil.areAABBsEqual(overlap.hitbox, object.colliderState.hitbox))
        {
            onTopBlocked = true;
        }
    });
    if (onTopBlocked)
        return false;
    return true;
}

export default PhysicsCollisionUtil;