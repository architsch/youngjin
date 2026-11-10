import AABB3 from "../../math/types/aabb3";
import Geometry3DUtil from "../../math/util/geometry3DUtil";
import PhysicsColliderStateUtil from "../../physics/util/physicsColliderStateUtil";
import VoxelVertex from "../../voxel/types/voxelVertex";
import VoxelPathUtil from "../../voxel/util/voxelPathUtil";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";
import AddObjectSignal from "../types/addObjectSignal";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../types/objectTypeConfig/playerObjectTypeConfig";

const BODY_HALF_SIZE = {x: PLAYER_RADIUS_XZ, y: 0.5 * PLAYER_HEIGHT, z: PLAYER_RADIUS_XZ};

// The objects as solid as blocks (see ColliderConfig.applyHardCollisionToOthers), for paths planned over the voxel
// grid, which knows of blocks alone (see VoxelPathUtil).
const ObjectObstacleUtil =
{
    // Tells of a vertex whether a body standing on it is clear of every such object among those given, as they now
    // stand.
    getClearance: (objectById: {[objectId: string]: AddObjectSignal}): ((vertex: VoxelVertex) => boolean) =>
    {
        const boxes: AABB3[] = [];
        for (const objectId in objectById)
        {
            const obj = objectById[objectId];
            const collider = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).components.spawnedByAny?.collider;
            if (collider?.applyHardCollisionToOthers)
                boxes.push(PhysicsColliderStateUtil.getObjectColliderState(obj.objectTypeIndex, obj.transform)!.hitbox);
        }
        if (boxes.length == 0)
            return () => true;

        return (vertex: VoxelVertex) => {
            const feet = VoxelPathUtil.toWorld(vertex);
            const body = {center: {x: feet.x, y: feet.y + BODY_HALF_SIZE.y, z: feet.z}, halfSize: BODY_HALF_SIZE};
            return !boxes.some(box => Geometry3DUtil.AABBsOverlap(body, box));
        };
    },
}

export default ObjectObstacleUtil;
