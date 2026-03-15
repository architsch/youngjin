import Vec3 from "./vec3";

export default interface RaycastHitResult3 // Result of performing a 3D raycast
{
    hitRayScale: number;
    hitNormal: Vec3 | undefined;
}