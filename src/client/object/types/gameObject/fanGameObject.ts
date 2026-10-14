import GameObject from "./gameObject";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";

// A fan: a composed housing, blades turning in its vent and a wind out of it. The blades and the wind are its
// AnimatedSprite and ParticleEmitter, which follow its setting on their own, as its push does (see
// FanObjectTypeConfig, PhysicsForceUtil).
export default class FanGameObject extends GameObject
{
    constructor(params: AddObjectSignal)
    {
        super(params);

        if (!this.components.instancedMeshComposer)
            throw new Error("FanGameObject requires InstancedMeshComposer component");
        if (!this.components.animatedSprite)
            throw new Error("FanGameObject requires AnimatedSprite component");
        if (!this.components.particleEmitter)
            throw new Error("FanGameObject requires ParticleEmitter component");
    }
}
