import * as THREE from "three";

const Material = {
    standard_0: createStandardMaterial(0.5),
    standard_1: createStandardMaterial(0.25),
    standard_2: createStandardMaterial(0.75),
    standard_3: createStandardMaterial(0),
}

function createStandardMaterial(hue: number): THREE.Material
{
    const material = new THREE.MeshPhongMaterial();
    const saturation = 1;
    const luminance = .5;
    material.color.setHSL(hue, saturation, luminance);
    
    return material;
}

export default Material;