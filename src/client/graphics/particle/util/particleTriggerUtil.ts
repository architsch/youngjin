import Vec3 from "../../../../shared/math/types/vec3";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { objectCollectedObservable, voxelBlockEditObservable } from "../../../system/clientObservables";
import ParticleSystem from "../particleSystem";

// Which gameplay event plays which effect: the one place gameplay and particles meet, so gameplay code
// never calls the particle system. A block's removal plays one, as does someone else collecting a dollar bill, the
// only thing there is to collect; the user's own collecting is a bill flying to their count, not an effect (see
// DollarBillGameObject.onCollected). Other object edits are left unbound.
const ParticleTriggerUtil =
{
    onVoxelBlockEdit: (edit: {kind: "add" | "remove" | "move" | "retexture", quadIndex: number}): void =>
    {
        if (edit.kind === "remove")
            ParticleSystem.play("blockRemoved", getBlockCenter(edit.quadIndex));
    },
    onObjectCollected: (object: AddObjectSignal): void =>
    {
        ParticleSystem.play("dollarCollected", object.transform.pos);
    },
}

// The middle of the block that a quad belongs to.
function getBlockCenter(quadIndex: number): Vec3
{
    return VoxelQueryUtil.getVoxelBlockBox(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex)).center;
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
objectCollectedObservable.addListener("particleTriggerUtil", guarded(ParticleTriggerUtil.onObjectCollected));

export default ParticleTriggerUtil;
