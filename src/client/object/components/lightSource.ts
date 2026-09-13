import * as THREE from "three";
import Vec3 from "../../../shared/math/types/vec3";
import ColorUtil from "../../../shared/math/util/colorUtil";
import LampLightUtil from "../../../shared/graphics/light/util/lampLightUtil";
import WallLampObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/wallLampObjectTypeConfig";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { LIGHT_COLOR_PALETTE_NAME } from "../../../shared/system/sharedConstants";
import GraphicsManager from "../../graphics/graphicsManager";
import GameObjectComponent from "./gameObjectComponent";

const colorTemp = new THREE.Color();

// Registers an object's light with the light block map (data, not a THREE light; see LightBlockMap).
// The light is placed in the block in front of the object: a wall attachment's origin sits on the wall
// face, and propagation from a solid block lights nothing.
export default class LightSource extends GameObjectComponent
{
    async onSpawn(): Promise<void>
    {
        this.registerLight();
    }

    async onDespawn(): Promise<void>
    {
        GraphicsManager.getLightBlockMap().removeLightSource(this.gameObject.params.objectId);
    }

    onSetMetadata(key: ObjectMetadataKey, _value: string): void
    {
        if (key !== ObjectMetadataKeyEnumMap.LightProperties)
            return;
        this.registerLight();
    }

    // Called on placement (not every frame). Takes the transform as arguments so it doesn't depend on
    // the object's copy having updated yet.
    setTransform(pos: Vec3, dir: Vec3): void
    {
        GraphicsManager.getLightBlockMap().setLightSourcePosition(
            this.gameObject.params.objectId, getLightWorldPos(pos, dir));
    }

    private registerLight()
    {
        const obj = this.gameObject.params;

        // THREE.Color converts sRGB hex to linear, matching the block map's space.
        colorTemp.set(ColorUtil.rgbToHex(
            ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME,
                WallLampObjectTypeConfig.util.getColorIndex(obj))));
        const intensity = WallLampObjectTypeConfig.util.getIntensity(obj);
        const range = WallLampObjectTypeConfig.util.getRange(obj);

        GraphicsManager.getLightBlockMap().addLightSource(obj.objectId, {
            worldPos: getLightWorldPos(obj.transform.pos, obj.transform.dir),
            colorR: colorTemp.r * intensity,
            colorG: colorTemp.g * intensity,
            colorB: colorTemp.b * intensity,
            range,
            decay: LampLightUtil.getDecay(range),
        });
    }

}

// Centre of the block in front of the wall. Attachments are quantized to half-integers with an axis
// facing (see WallAttachedObjectUtil), so a half-block step lands inside that cell.
function getLightWorldPos(pos: Vec3, dir: Vec3): Vec3
{
    return {
        x: pos.x + 0.5 * dir.x,
        y: pos.y + 0.5 * dir.y,
        z: pos.z + 0.5 * dir.z,
    };
}
