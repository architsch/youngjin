import * as THREE from "three";
import Vec3 from "../../../shared/math/types/vec3";
import ColorUtil from "../../../shared/math/util/colorUtil";
import LampLightUtil from "../../../shared/graphics/light/util/lampLightUtil";
import LampObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { LIGHT_COLOR_PALETTE_NAME } from "../../../shared/system/sharedConstants";
import GraphicsManager from "../../graphics/graphicsManager";
import GameObjectComponent from "./gameObjectComponent";

const colorTemp = new THREE.Color();

// The bridge between an object that is meant to give off light and the field the room is actually lit
// by. What it registers is data rather than a THREE.PointLight — see LightBlockMap for why the scene
// keeps exactly one real light.
//
// The light stands in the block in front of the object rather than in the object itself. This is not
// cosmetic: a wall attachment's own origin sits on the wall face, and propagation returns
// immediately from a block that is solid, so a lamp whose light was placed at its own origin would
// light nothing at all.
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

    // Called whenever the object is moved, which for a wall attachment is a placement rather than a
    // motion — so this runs a handful of times as somebody slides a lamp along a wall, rather than
    // every frame. Handed the new transform rather than reading it back off the object, so that it
    // cannot depend on whether the object's own copy has caught up yet.
    setTransform(pos: Vec3, dir: Vec3): void
    {
        GraphicsManager.getLightBlockMap().setLightSourcePosition(
            this.gameObject.params.objectId, getLightWorldPos(pos, dir));
    }

    private registerLight()
    {
        const obj = this.gameObject.params;

        // Read back through THREE.Color so the palette's sRGB hex is converted into the renderer's
        // linear working space, which is what the block map accumulates in — the same treatment the
        // materials give their own colors.
        colorTemp.set(ColorUtil.rgbToHex(
            ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME,
                LampObjectTypeConfig.util.getColorIndex(obj))));
        const intensity = LampObjectTypeConfig.util.getIntensity(obj);
        const range = LampObjectTypeConfig.util.getRange(obj);

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

// The centre of the block standing in front of the wall the object is mounted on. A wall
// attachment's transform is quantized to half-integers across the wall and its facing to -1|0|1
// (see WallAttachedObjectUtil), so stepping half a block along that facing lands exactly inside the
// front cell rather than near it.
function getLightWorldPos(pos: Vec3, dir: Vec3): Vec3
{
    return {
        x: pos.x + 0.5 * dir.x,
        y: pos.y + 0.5 * dir.y,
        z: pos.z + 0.5 * dir.z,
    };
}
