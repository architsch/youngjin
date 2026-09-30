import Vec3 from "../../../../shared/math/types/vec3";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import { ObjectCategoryEnumMap } from "../../../../shared/object/types/objectCategory";
import ObjectScaleUtil from "../../../../shared/object/util/objectScaleUtil";
import Geometry3DUtil from "../../../../shared/math/util/geometry3DUtil";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { objectEditObservable, voxelBlockEditObservable } from "../../../system/clientObservables";
import ParticleSystem from "../particleSystem";

// Which gameplay event plays which effect: the one place gameplay and particles meet, so gameplay code
// never calls the particle system. Moves, retextures and players coming and going are left unbound.
const ParticleTriggerUtil =
{
    onVoxelBlockEdit: (edit: {kind: "add" | "remove" | "move" | "retexture", quadIndex: number}): void =>
    {
        if (edit.kind === "add")
            ParticleSystem.play("blockAdded", getBlockCenter(edit.quadIndex));
        else if (edit.kind === "remove")
            ParticleSystem.play("blockRemoved", getBlockCenter(edit.quadIndex));
    },
    onObjectEdit: (edit: {kind: "add" | "remove", object: AddObjectSignal}): void =>
    {
        const {objectTypeIndex, transform} = edit.object;
        const category = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex).category;
        if (category === ObjectCategoryEnumMap.Player || category === ObjectCategoryEnumMap.Voxel)
            return;

        // Just in front of the object, sized to its footprint.
        const size = ObjectScaleUtil.getObjectSize(objectTypeIndex, transform.scale);
        const scale = Math.max(size.x, size.y);
        const {normal} = Geometry3DUtil.getAxisFacingBasis(transform.dir);
        const position: Vec3 = {
            x: transform.pos.x + normal.x * 0.1 * scale,
            y: transform.pos.y + normal.y * 0.1 * scale,
            z: transform.pos.z + normal.z * 0.1 * scale,
        };
        ParticleSystem.play((edit.kind === "add") ? "objectAdded" : "objectRemoved", position,
            {direction: normal, scale});
    },
}

// The middle of the block a quad belongs to.
function getBlockCenter(quadIndex: number): Vec3
{
    return {
        x: VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex) + 0.5,
        y: VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(
            VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex)),
        z: VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex) + 0.5,
    };
}

// Observable dispatch has no try/catch, so an effect that fails must not stop the listeners after it.
function guarded<T>(handle: (event: T) => void): (event: T) => void
{
    return (event: T) =>
    {
        try
        {
            handle(event);
        }
        catch (err)
        {
            console.error("ParticleTriggerUtil :: Failed to play an effect", err);
        }
    };
}

// Registered on import (see app.ts); events before the particle system loads play nothing.
voxelBlockEditObservable.addListener("particleTriggerUtil", guarded(ParticleTriggerUtil.onVoxelBlockEdit));
objectEditObservable.addListener("particleTriggerUtil", guarded(ParticleTriggerUtil.onObjectEdit));

export default ParticleTriggerUtil;
