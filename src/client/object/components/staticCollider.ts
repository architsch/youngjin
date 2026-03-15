import * as THREE from "three";
import Collider from "./collider";

export default class StaticCollider extends Collider
{
    trySetTransform(pos: THREE.Vector3, dir: THREE.Vector3): void
    {
        throw new Error("StaticCollider doesn't support 'trySetTransform'.");
    }
}