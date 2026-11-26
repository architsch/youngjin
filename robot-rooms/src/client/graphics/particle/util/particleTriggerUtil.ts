import Vec3 from "../../../../shared/math/types/vec3";
import Geometry3DUtil from "../../../../shared/math/util/geometry3DUtil";
import Vector3DUtil from "../../../../shared/math/util/vector3DUtil";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import ObjectScaleUtil from "../../../../shared/object/util/objectScaleUtil";
import PhysicsColliderStateUtil from "../../../../shared/physics/util/physicsColliderStateUtil";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { PetActionEnumMap } from "../../../../shared/object/types/petAction";
import { PetInjectionEnumMap } from "../../../../shared/object/types/petInjection";
import PetOwnerUtil from "../../../../shared/object/util/petOwnerUtil";
import PetShownStateUtil from "../../../../shared/object/util/petShownStateUtil";
import { cannonBallBounceObservable, cannonBallBurstObservable, cannonFiredObservable, cannonScrappedObservable,
    objectCollectedObservable, objectEditObservable, petInjectedObservable, petSnoreObservable, petStrikeObservable,
    voxelBlockEditObservable } from "../../../system/clientObservables";
import ParticleSystem from "../particleSystem";

// An attached object comes apart in small breaks about this far apart across its face, in world units, and never in
// more of them than this: a larger one's are as much farther apart.
export const BREAK_SPACING = 0.5;
export const MAX_BREAKS = 24;

// Which gameplay event plays which effect: the one place gameplay and particles meet, so gameplay code
// never calls the particle system. A block's removal plays one, as does someone else collecting a dollar bill, the
// only thing there is to collect; the user's own collecting is a bill flying to their count, not an effect (see
// DollarBillGameObject.onCollected). A cannon's shot, its ball's bounce and its ball's burst play one each, and its
// turning to scrap a puff. A pet plays one as something is put into it, as it rams another, at each breath it draws
// asleep, and as it goes. An attached object taken away, by anyone or anything, comes apart all over its face; other
// object edits are left unbound.
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
    onCannonFired: (shot: {position: Vec3, direction: Vec3}): void =>
    {
        ParticleSystem.play("cannonFire", shot.position, {direction: shot.direction});
    },
    onCannonBallBounce: (bounce: {position: Vec3, normal: Vec3}): void =>
    {
        ParticleSystem.play("cannonBallBounce", bounce.position, {direction: bounce.normal});
    },
    onCannonBallBurst: (burst: {position: Vec3}): void =>
    {
        ParticleSystem.play("cannonBallBurst", burst.position);
    },
    onCannonScrapped: (wreck: {position: Vec3}): void =>
    {
        ParticleSystem.play("cannonPuff", wreck.position);
    },
    onPetInjected: (given: {injection: number, position: Vec3}): void =>
    {
        ParticleSystem.play((given.injection == PetInjectionEnumMap.Battery) ? "petCharged" : "petRepaired", given.position);
    },
    onPetStrike: (strike: {position: Vec3}): void =>
    {
        ParticleSystem.play("petStrike", strike.position);
    },
    onPetSnore: (breath: {position: Vec3}): void =>
    {
        ParticleSystem.play("petSnore", breath.position);
    },
    // A pet taken away is beamed out, or, out of health, breaks down where it stood. An NPC, which steps off a block
    // rather than going with it, is nothing that comes apart.
    onObjectEdit: (edit: {kind: "add" | "remove" | "change", object: AddObjectSignal}): void =>
    {
        const {kind, object} = edit;
        if (kind == "remove" && PetOwnerUtil.isPet(object))
        {
            const dead = PetShownStateUtil.getObjectState(object).action == PetActionEnumMap.Dead;
            ParticleSystem.play(dead ? "petDeath" : "petVanish", object.transform.pos);
            return;
        }
        const attachment = ObjectTypeConfigMap.getConfigByIndex(object.objectTypeIndex).attachment;
        if (kind != "remove" || attachment == undefined || attachment.stepsAside)
            return;
        const middle = PhysicsColliderStateUtil.getObjectColliderState(object.objectTypeIndex, object.transform)?.hitbox.center
            ?? object.transform.pos;
        const {normal} = Geometry3DUtil.getAxisFacingBasis(object.transform.dir);
        for (const point of getBreakPoints(object, middle))
            ParticleSystem.play("objectDestroyed", point, {direction: normal});
    },
}

// The middle of the block that a quad belongs to.
function getBlockCenter(quadIndex: number): Vec3
{
    return VoxelQueryUtil.getVoxelBlockBox(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex)).center;
}

// Where an attached object's breaks are: a grid over its footprint, through its middle.
function getBreakPoints(object: AddObjectSignal, middle: Vec3): Vec3[]
{
    const {right, up} = Geometry3DUtil.getAxisFacingBasis(object.transform.dir);
    const size = ObjectScaleUtil.getObjectSize(object.objectTypeIndex, object.transform.scale);
    const spacing = Math.max(BREAK_SPACING, Math.sqrt(size.x * size.y / MAX_BREAKS));
    const numAcross = Math.max(1, Math.floor(size.x / spacing));
    const numUp = Math.max(1, Math.floor(size.y / spacing));

    const points: Vec3[] = [];
    for (let i = 0; i < numAcross; ++i)
    {
        for (let j = 0; j < numUp; ++j)
        {
            points.push(Vector3DUtil.add(middle, Vector3DUtil.add(
                Vector3DUtil.scale(right, ((i + 0.5) / numAcross - 0.5) * size.x),
                Vector3DUtil.scale(up, ((j + 0.5) / numUp - 0.5) * size.y))));
        }
    }
    return points;
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
cannonFiredObservable.addListener("particleTriggerUtil", guarded(ParticleTriggerUtil.onCannonFired));
cannonBallBounceObservable.addListener("particleTriggerUtil", guarded(ParticleTriggerUtil.onCannonBallBounce));
cannonBallBurstObservable.addListener("particleTriggerUtil", guarded(ParticleTriggerUtil.onCannonBallBurst));
cannonScrappedObservable.addListener("particleTriggerUtil", guarded(ParticleTriggerUtil.onCannonScrapped));
petInjectedObservable.addListener("particleTriggerUtil", guarded(ParticleTriggerUtil.onPetInjected));
petStrikeObservable.addListener("particleTriggerUtil", guarded(ParticleTriggerUtil.onPetStrike));
petSnoreObservable.addListener("particleTriggerUtil", guarded(ParticleTriggerUtil.onPetSnore));
objectEditObservable.addListener("particleTriggerUtil", guarded(ParticleTriggerUtil.onObjectEdit));

export default ParticleTriggerUtil;
