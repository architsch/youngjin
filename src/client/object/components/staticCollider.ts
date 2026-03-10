import * as THREE from "three";
import Collider from "./collider";

export default class StaticCollider extends Collider
{
    trySetPosition(pos: THREE.Vector3): void
    {
        throw new Error("StaticCollider doesn't support 'trySetPosition'. Use 'forceSetPosition' only.");
    }
}