import * as THREE from "three";
import Vec3 from "../../../shared/math/types/vec3";
import ColorUtil from "../../../shared/math/util/colorUtil";
import LampLightUtil from "../../../shared/graphics/light/util/lampLightUtil";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import LampObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { COLLISION_LAYER_HEIGHT, LIGHT_COLOR_PALETTE_NAME, VOXEL_CELL_SIZE }
    from "../../../shared/system/sharedConstants";
import GraphicsManager from "../../graphics/graphicsManager";
import GameObjectComponent from "./gameObjectComponent";

const colorTemp = new THREE.Color();

// Registers an object's light with the light block map (data, not a THREE light; see LightBlockMap).
// The light is placed in front of the object: an attached object's origin sits on its face, and
// propagation from inside a block lights nothing.
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

    // From the stored placement, not the rendered one, so a cosmetic bounce doesn't move the light (the
    // block map ignores a position it already has).
    onTransformChanged(_resized: boolean): void
    {
        const {pos, dir} = this.gameObject.params.transform;
        GraphicsManager.getLightBlockMap().setLightSourcePosition(
            this.gameObject.params.objectId, getLightWorldPos(pos, dir), getLightOutletPos(pos, dir));
    }

    private registerLight()
    {
        const obj = this.gameObject.params;

        // THREE.Color converts sRGB hex to linear, matching the block map's space.
        colorTemp.set(ColorUtil.rgbToHex(
            ColorUtil.paletteIndexToRGB(LIGHT_COLOR_PALETTE_NAME,
                LampObjectTypeConfig.util.getColorIndex(obj))));
        const intensity = LampObjectTypeConfig.util.getIntensity(obj);
        const range = LampObjectTypeConfig.util.getRange(obj);

        GraphicsManager.getLightBlockMap().addLightSource(obj.objectId, {
            worldPos: getLightWorldPos(obj.transform.pos, obj.transform.dir),
            outletPos: getLightOutletPos(obj.transform.pos, obj.transform.dir),
            colorR: colorTemp.r * intensity,
            colorG: colorTemp.g * intensity,
            colorB: colorTemp.b * intensity,
            range,
            decay: LampLightUtil.getDecay(range),
        });
    }

}

// Where the light is measured from: half a world unit out from a wall, but half a layer from a floor or a
// ceiling. Lamp ranges are tuned to it.
function getLightWorldPos(pos: Vec3, dir: Vec3): Vec3
{
    return getPosInFront(pos, dir, 0.5, 0.5 * COLLISION_LAYER_HEIGHT);
}

// Where the light comes out: the middle of the blocks right in front of the face.
function getLightOutletPos(pos: Vec3, dir: Vec3): Vec3
{
    return getPosInFront(pos, dir, 0.5 * VOXEL_CELL_SIZE, 0.5 * COLLISION_LAYER_HEIGHT);
}

function getPosInFront(pos: Vec3, dir: Vec3, reachAlongXZ: number, reachAlongY: number): Vec3
{
    const {normal} = Geometry3DUtil.getAxisFacingBasis(dir);
    return {
        x: pos.x + reachAlongXZ * normal.x,
        y: pos.y + reachAlongY * normal.y,
        z: pos.z + reachAlongXZ * normal.z,
    };
}
