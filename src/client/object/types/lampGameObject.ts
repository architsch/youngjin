import GameObject from "./gameObject";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import InstancedMeshComposer from "../components/instancedMeshComposer";

// Keeps a lamp's composed glow the color of its light (its LightSource follows placement on its own).
export default class LampGameObject extends GameObject
{
    private instancedMeshComposer: InstancedMeshComposer;

    constructor(params: AddObjectSignal)
    {
        super(params);

        if (!this.components.lightSource)
            throw new Error("LampGameObject requires LightSource component");

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("LampGameObject requires InstancedMeshComposer component");
    }

    // The glow's color derives from the light setting, so the parts are recomposed (see
    // LampObjectTypeConfig).
    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key === ObjectMetadataKeyEnumMap.LightProperties)
            this.instancedMeshComposer.rebuildParts();
    }
}
