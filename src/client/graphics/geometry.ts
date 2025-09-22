import * as THREE from "three";

const Geometry = {
    player: new THREE.CapsuleGeometry(0.3, 2.5, 8, 8),
    wall: new THREE.BoxGeometry(1, 4, 1),
    floor: new THREE.PlaneGeometry(1, 1),
}

export default Geometry;