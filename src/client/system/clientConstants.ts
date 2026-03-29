import * as THREE from "three";

// three.js

export const DIRECTION_VECTORS: {[key: string]: THREE.Vector3} = {
    "+x": new THREE.Vector3(1, 0, 0),
    "-x": new THREE.Vector3(-1, 0, 0),
    "+y": new THREE.Vector3(0, 1, 0),
    "-y": new THREE.Vector3(0, -1, 0),
    "+z": new THREE.Vector3(0, 0, 1),
    "-z": new THREE.Vector3(0, 0, -1),
};