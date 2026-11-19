import * as THREE from "three";

const tempObj = new THREE.Object3D();
const vec3Temp = new THREE.Vector3();
const colorTemp = new THREE.Color();

// How a composed part becomes instance data. Shared by InstancedMeshBinding and the thumbnail renderer
// (see CompositionThumbnailBuilder), so thumbnails show parts exactly as the game does.
const InstancedPartUtil =
{
    // A part's world matrix: scaled, turned to face dir (in the parent's frame), then offset. The
    // parent's world matrix must be current.
    bakePartMatrix: (parent: THREE.Object3D,
        offsetX: number, offsetY: number, offsetZ: number,
        dirX: number, dirY: number, dirZ: number,
        xScale: number, yScale: number, zScale: number,
        out: THREE.Matrix4): THREE.Matrix4 =>
    {
        parent.add(tempObj);

        tempObj.scale.set(xScale, yScale, zScale);

        tempObj.position.set(0, 0, 0);
        vec3Temp.set(dirX, dirY, dirZ);
        parent.localToWorld(vec3Temp);
        tempObj.lookAt(vec3Temp);

        tempObj.position.set(offsetX, offsetY, offsetZ);
        tempObj.updateMatrixWorld();
        out.copy(tempObj.matrixWorld);

        tempObj.removeFromParent();
        return out;
    },

    // Colors are sRGB [0,255]; converted to the working color space, as three.js does for material colors.
    setInstanceColor: (mesh: THREE.InstancedMesh, instanceId: number, r: number, g: number, b: number): void =>
    {
        colorTemp.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
        mesh.setColorAt(instanceId, colorTemp);
    },

    // "InstancedWood" moulding inputs: color (3), and band width in world units with +1 proud / -1 sunk (2).
    setInstanceMoulding: (mouldingColorAttrib: THREE.BufferAttribute, mouldingParamsAttrib: THREE.BufferAttribute,
        instanceId: number, r: number, g: number, b: number, thickness: number, convex: boolean): void =>
    {
        colorTemp.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
        mouldingColorAttrib.setXYZ(instanceId, colorTemp.r, colorTemp.g, colorTemp.b);
        mouldingParamsAttrib.setXY(instanceId, thickness, convex ? 1 : -1);
    },
}

export default InstancedPartUtil;
