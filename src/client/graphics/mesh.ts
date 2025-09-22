import * as THREE from "three";
import Geometry from "./geometry";
import Material from "./material";

const Mesh = {
    player: () => new THREE.Mesh(Geometry.player, Material.standard_0),
    wall: () => new THREE.Mesh(Geometry.wall, Material.standard_1),
    floor: () => new THREE.Mesh(Geometry.floor, Material.standard_2),
}

export default Mesh;