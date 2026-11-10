import Vec3 from "../../math/types/vec3";
import PhysicsObject from "./physicsObject";

// What a moving sphere strikes first (see PhysicsSphereUtil.cast).
export default interface PhysicsSphereHit
{
    // How far along its move it strikes, from 0 to 1, and where its middle is then.
    rayScale: number;
    center: Vec3;
    // Where the two touch, and the way out of what is struck there.
    contact: Vec3;
    normal: Vec3;
    // What is struck: a voxel block, or an object. Neither: the room's own floor or ceiling.
    block?: {row: number, col: number, collisionLayer: number};
    object?: PhysicsObject;
}
