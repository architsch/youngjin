import Vec3 from "../../../../shared/math/types/vec3";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { voxelBlockEditObservable } from "../../../system/clientObservables";
import ParticleSystem from "../particleSystem";

// Which gameplay event plays which effect: the one place gameplay and particles meet, so gameplay code
// never calls the particle system. Only a block's removal plays one; object edits are left unbound.
const ParticleTriggerUtil =
{
    onVoxelBlockEdit: (edit: {kind: "add" | "remove" | "move" | "reshape" | "retexture", quadIndex: number,
        shape: number}): void =>
    {
        if (edit.kind === "remove")
            ParticleSystem.play("blockRemoved", getBlockCenter(edit.quadIndex, edit.shape));
    },
}

// The middle of the block of the given shape that a quad belongs to.
function getBlockCenter(quadIndex: number, shape: number): Vec3
{
    return VoxelQueryUtil.getVoxelBlockBox(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex), shape).center;
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

export default ParticleTriggerUtil;
