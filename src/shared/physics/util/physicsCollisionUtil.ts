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

const PhysicsCollisionUtil =
{
    applyHardCollision: (physicsRoom: PhysicsRoom, object: PhysicsObject, targetPos: Vec3, targetDir: Vec3): ObjectTransformUpdateResult =>
    {
        const newColliderState = PhysicsColliderStateUtil.getObjectColliderState(object.objectTypeIndex, targetPos, targetDir);
        if (!newColliderState)
            throw new Error(`ColliderState couldn't be computed (objectId = ${object.objectId}, objectTypeIndex = ${object.objectTypeIndex})`);
        const halfSize = newColliderState.hitbox.halfSize;

        const startPos = object.colliderState.hitbox.center;
        const startToTargetDir = Vector3DUtil.normalize(Vector3DUtil.subtract(targetPos, startPos));
        const rayStepMargin = Vector3DUtil.scale(startToTargetDir, 0.001);

        // Step back a bit to prevent raycasting from within obstacles.
        const raycastStartPos = Vector3DUtil.subtract(startPos, rayStepMargin);
        const raycastStartAABB: AABB3 = {center: raycastStartPos, halfSize};

        // Any attempt to move more than 3 units will force-sync the object back to its original location.
        if (Vector3DUtil.distSqr(targetPos, startPos) >= 9)
        {
            console.warn(`Physics-position desync due to distance gap`);
            return {transform: new ObjectTransform(startPos, targetDir), desyncDetected: true};
        }

        const minX = Math.min(startPos.x, targetPos.x) - halfSize.x;
        const maxX = Math.max(startPos.x, targetPos.x) + halfSize.x;
        const minY = Math.min(startPos.y, targetPos.y) - halfSize.y;
        const maxY = Math.max(startPos.y, targetPos.y) + halfSize.y;
        const minZ = Math.min(startPos.z, targetPos.z) - halfSize.z;
        const maxZ = Math.max(startPos.z, targetPos.z) + halfSize.z;

        const startToTargetAABB: AABB3 = {
            center: {x: 0.5*(minX+maxX), y: 0.5*(minY+maxY), z: 0.5*(minZ+maxZ)},
            halfSize: {x: 0.5*(maxX-minX), y: 0.5*(maxY-minY), z: 0.5*(maxZ-minZ)},
        };
        const overlappingColliderStates = PhysicsColliderStateUtil.findOverlappingColliderStates(
            physicsRoom, startToTargetAABB);

        // Process collisions

        let displacement = Vector3DUtil.subtract(targetPos, startPos);

        overlappingColliderStates.forEach((overlappingColliderState) =>
        {
            if (!overlappingColliderState.colliderConfig.applyHardCollisionToOthers)
                return;

            const result = Geometry3DUtil.castAABBAgainstAABB(raycastStartAABB, targetPos, overlappingColliderState.hitbox);

            if (result.hitNormal != undefined) // Hit detected
            {
                const raycastStartToTarget = Vector3DUtil.subtract(targetPos, raycastStartPos);
                const raycastStartToHit = Vector3DUtil.scale(raycastStartToTarget, result.hitRayScale);
                const hitPos = Vector3DUtil.add(raycastStartPos, raycastStartToHit);
                const hitPosSteppedBack = Vector3DUtil.subtract(hitPos, rayStepMargin);

                const hitToTarget = Vector3DUtil.subtract(targetPos, hitPos);

                // Slide along the hit surface
                const dotNormal = Vector3DUtil.dot(hitToTarget, result.hitNormal);
                const hitToTargetProjected = Vector3DUtil.subtract(hitToTarget,
                    Vector3DUtil.scale(result.hitNormal, dotNormal));

                const slidedHitPos = Vector3DUtil.add(hitPosSteppedBack, hitToTargetProjected);
                let invalidHit = false; // Hit is invalid if the slide penetrates through a hitbox.
                overlappingColliderStates.forEach((overlappingColliderState2) =>
                {
                    if (Geometry3DUtil.pointOverlapsAABB(slidedHitPos, overlappingColliderState2.hitbox))
                        invalidHit = true;
                });
                if (invalidHit)
                    return;

                // Take the least-magnitude coordinates from the displacement vectors (in order to take into account of movement restrictions in all 3 axes).
                // (Warning: This approach may only work with AABBs; it may not work with arbitrary volumes whose surfaces are not aligned with the X,Y,Z axes.)
                if (Math.abs(hitToTargetProjected.x) < Math.abs(displacement.x))
                    displacement.x = hitToTargetProjected.x;
                if (Math.abs(hitToTargetProjected.y) < Math.abs(displacement.y))
                    displacement.y = hitToTargetProjected.y;
                if (Math.abs(hitToTargetProjected.z) < Math.abs(displacement.z))
                    displacement.z = hitToTargetProjected.z;
            }
        });
        const resolvedTargetPos = Vector3DUtil.add(startPos, displacement);
        return {transform: new ObjectTransform(resolvedTargetPos, targetDir), desyncDetected: false};
    },

    // Returns the adjusted velocity.
    applySoftCollision: (physicsRoom: PhysicsRoom, object: PhysicsObject, desiredVelocity: Vec3): Vec3 =>
    {
        let velocity = desiredVelocity;

        const objectHitbox = object.colliderState.hitbox;
        const objectVolume = 8 * objectHitbox.halfSize.x * objectHitbox.halfSize.y * objectHitbox.halfSize.z; // 8 = 2*2*2
        const objectCenter = objectHitbox.center;
        const colliderConfig = object.colliderState.colliderConfig;

        const overlappingColliderStates = PhysicsColliderStateUtil.findOverlappingColliderStates(
            physicsRoom, objectHitbox);

        overlappingColliderStates.forEach((overlappingColliderState) =>
        {
            const outgoingMult = overlappingColliderState.colliderConfig.outgoingSoftCollisionForceMultiplier;
            if (outgoingMult <= 0)
                return;
            const overlap = Geometry3DUtil.getIntersectionAABB(objectHitbox, overlappingColliderState.hitbox);
            const overlapVolume = 8 * overlap.halfSize.x * overlap.halfSize.y * overlap.halfSize.z; // 8 = 2*2*2
            const overlapToObjectDir = Vector3DUtil.normalize(
                Vector3DUtil.subtract(objectCenter, overlap.center));
            
            const overlapProportion = overlapVolume / objectVolume;
            const incomingMult = colliderConfig.incomingSoftCollisionForceMultiplier;
            const pushMagnitude = 100 * overlapProportion * outgoingMult * incomingMult;

            let push = Vector3DUtil.scale(overlapToObjectDir, pushMagnitude);
            const pushLength = Vector3DUtil.length(push);
            if (pushLength > SOFT_COLLISION_PUSH_SPEED_LIMIT) // Limit the push magnitude.
                push = Vector3DUtil.scale(push, SOFT_COLLISION_PUSH_SPEED_LIMIT / pushLength);

            velocity = Vector3DUtil.add(velocity, push);

            const velocityLength = Vector3DUtil.length(velocity);
            if (velocityLength > GRAVITY_SPEED) // Limit the velocity magnitude.
                velocity = Vector3DUtil.scale(velocity, GRAVITY_SPEED / velocityLength);
        });
        return velocity;
    },
}

export default PhysicsCollisionUtil;