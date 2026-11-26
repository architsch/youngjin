import * as THREE from "three";
import EmissiveGlyph from "../../../shared/graphics/mesh/composition/types/emissiveGlyph";
import { EMISSIVE_ANIMATION_BLINK, EMISSIVE_ANIMATION_DROOP, EMISSIVE_ANIMATION_FLICKER, EMISSIVE_ANIMATION_STEP,
    EMISSIVE_KIND_BATTERY, EMISSIVE_KIND_FACE } from "../shaders/instancedEmissiveShader";

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

    // "InstancedTin" age (see instancedTinShader): whether that changed it.
    setInstanceRust: (rustAttrib: THREE.BufferAttribute, instanceId: number, rust: number): boolean =>
    {
        if (rustAttrib.getX(instanceId) === Math.fround(rust))
            return false;
        rustAttrib.setX(instanceId, rust);
        return true;
    },

    // What an "InstancedEmissive" instance draws, and whether it dims with distance (see instancedEmissiveShader):
    // whether that changed it. No glyph is the instance's plain color.
    setInstanceGlyph: (glyphAttrib: THREE.BufferAttribute, shapeAttrib: THREE.BufferAttribute, instanceId: number,
        glyph: EmissiveGlyph | undefined, dims: boolean): boolean =>
    {
        const values = glyphValuesTemp;
        values.fill(0);
        values[1] = dims ? 1 : 0;
        values[3] = 1;
        if (glyph?.kind == "face")
        {
            values[0] = EMISSIVE_KIND_FACE;
            values[2] = glyph.eyeStyle + EMISSIVE_ANIMATION_STEP * ((glyph.blinks ? EMISSIVE_ANIMATION_BLINK : 0)
                + (glyph.droops ? EMISSIVE_ANIMATION_DROOP : 0) + (glyph.flickers ? EMISSIVE_ANIMATION_FLICKER : 0));
            values[3] = glyph.brightness;
            values[4] = glyph.eyeOpen;
            values[5] = glyph.mouthCurve;
            values[6] = glyph.mouthOpen;
        }
        else if (glyph?.kind == "battery")
        {
            values[0] = EMISSIVE_KIND_BATTERY;
            values[7] = glyph.level;
        }

        const offset = 4 * instanceId;
        let changed = false;
        for (let i = 0; i < 4; ++i)
        {
            changed = changed || glyphAttrib.array[offset + i] !== values[i] || shapeAttrib.array[offset + i] !== values[4 + i];
            glyphAttrib.array[offset + i] = values[i];
            shapeAttrib.array[offset + i] = values[4 + i];
        }
        return changed;
    },
}

// A Float32Array, so that what is compared with an attribute's values is rounded as they are.
const glyphValuesTemp = new Float32Array(8);

export default InstancedPartUtil;
