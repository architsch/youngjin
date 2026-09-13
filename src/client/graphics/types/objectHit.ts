import GameObject from "../../object/types/gameObject";

// A game object where a ray met it. instanceId is the instance hit, which for a voxel names the quad.
type ObjectHit = {gameObject: GameObject, instanceId: number};

export default ObjectHit;
