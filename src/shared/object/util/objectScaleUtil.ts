import Vec3 from "../../math/types/vec3";
import NumUtil from "../../math/util/numUtil";
import { UNIT_VEC3 } from "../../system/sharedConstants";
import ObjectTypeConfigMap from "../maps/objectTypeConfigMap";

// The only way to read an object's scale, and the only way to ask how big one actually is.
//
// A stored scale is never trusted as read: it arrives from the wire, and the byte it is encoded in
// decodes slightly below what was written (see ObjectTransform). Snapping it back onto the type's own
// step grid absorbs that, clamps whatever a hostile client sent, and keeps objects legal when a type's
// limits are later retuned.
const ObjectScaleUtil =
{
    // Unit scale for a type that declares no scaling; otherwise on the grid, within the limits.
    sanitize: (objectTypeIndex: number, scale: Vec3): Vec3 =>
    {
        const scaling = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).scaling;
        if (!scaling)
            return {...UNIT_VEC3};

        return {
            x: snap(scale.x, scaling.scaleStep.x, scaling.minScale.x, scaling.maxScale.x),
            y: snap(scale.y, scaling.scaleStep.y, scaling.minScale.y, scaling.maxScale.y),
            z: snap(scale.z, scaling.scaleStep.z, scaling.minScale.z, scaling.maxScale.z),
        };
    },
    // The object's footprint in world units: its collider's base size at the given scale, which is
    // sanitized on the way through. A type with no collider declares no footprint and reads as a unit cube.
    getObjectSize: (objectTypeIndex: number, scale: Vec3): Vec3 =>
    {
        const sanitized = ObjectScaleUtil.sanitize(objectTypeIndex, scale);
        const baseHitboxSize = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex)
            .components.spawnedByAny?.collider?.baseHitboxSize;
        if (!baseHitboxSize)
            return sanitized;

        return {
            x: baseHitboxSize.sizeX * sanitized.x,
            y: baseHitboxSize.sizeY * sanitized.y,
            z: baseHitboxSize.sizeZ * sanitized.z,
        };
    },
    // The largest footprint the type can take, for anything that has to hold the worst case (see
    // InstancedMeshCapacityBuilder).
    getMaxObjectSize: (objectTypeIndex: number): Vec3 =>
    {
        const config = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex);
        const maxScale = config.scaling?.maxScale ?? UNIT_VEC3;
        const baseHitboxSize = config.components.spawnedByAny?.collider?.baseHitboxSize;
        if (!baseHitboxSize)
            return {...maxScale};

        return {
            x: baseHitboxSize.sizeX * maxScale.x,
            y: baseHitboxSize.sizeY * maxScale.y,
            z: baseHitboxSize.sizeZ * maxScale.z,
        };
    },
}

// A step of 0 means the axis doesn't resize, so only the limits apply.
function snap(value: number, step: number, min: number, max: number): number
{
    if (!Number.isFinite(value))
        return min;
    const clamped = NumUtil.clampInRange(value, min, max);
    if (step <= 0)
        return clamped;
    return NumUtil.clampInRange(min + step * Math.round((clamped - min) / step), min, max);
}

export default ObjectScaleUtil;
