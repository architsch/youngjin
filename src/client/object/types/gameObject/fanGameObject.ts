import GameObject from "./gameObject";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import InstancedMeshComposer from "../../components/instancedMeshComposer";

// A fan: a composed housing, blades turning in their vents and a wind out of it. The blades and the wind are its
// AnimatedSprite and ParticleEmitter, which follow its setting on their own, as its push does (see
// FanObjectTypeConfig, PhysicsForceUtil); the housing is recomposed here in its color.
export default class FanGameObject extends GameObject
{
    private instancedMeshComposer: InstancedMeshComposer;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("FanGameObject requires InstancedMeshComposer component");
        if (!this.components.animatedSprite)
            throw new Error("FanGameObject requires AnimatedSprite component");
        if (!this.components.particleEmitter)
            throw new Error("FanGameObject requires ParticleEmitter component");
    }

    // The housing's color is derived from the fan's own key rather than stored in the composition (see
    // FanObjectTypeConfig).
    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key === ObjectMetadataKeyEnumMap.FanColor)
            this.instancedMeshComposer.rebuildParts();
    }
}
