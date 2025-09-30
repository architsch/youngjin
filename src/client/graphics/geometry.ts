import * as THREE from "three";

const Geometry = {
    player: new THREE.CapsuleGeometry(0.3, 1.75, 8, 8),
    playerEye: new THREE.BoxGeometry(0.1, 0.1, 0.1),
    wall: new THREE.BoxGeometry(1, 4, 1),
    floor: new THREE.PlaneGeometry(1, 1),
}

export default Geometry;