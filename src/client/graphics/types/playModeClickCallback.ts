import type * as THREE from "three";
import type GameObject from "../../object/types/gameObject/gameObject";

// What clicking an object does in play mode (see PlayModeClickCallbackMap).
type PlayModeClickCallback = (gameObject: GameObject, hitPoint: THREE.Vector3) => void;

export default PlayModeClickCallback;
