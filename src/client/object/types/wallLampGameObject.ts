import GameObject from "./gameObject";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import Vec3 from "../../../shared/math/types/vec3";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import LightSource from "../components/lightSource";
import InstancedMeshComposer from "../components/instancedMeshComposer";

// Keeps a lamp's composed parts and its LightSource in sync (position and color).
export default class WallLampGameObject extends GameObject
{
    private lightSource: LightSource;
    private instancedMeshComposer: InstancedMeshComposer;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.lightSource = this.components.lightSource as LightSource;
        if (!this.lightSource)
            throw new Error("WallLampGameObject requires LightSource component");

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("WallLampGameObject requires InstancedMeshComposer component");
    }

    // Wall attachments are placed, not driven, so the light is moved here. (Parts re-bake on their own.)
    setObjectTransform(pos: Vec3, dir: Vec3)
    {
        super.setObjectTransform(pos, dir);
        this.lightSource.setTransform(pos, dir);
    }

    // The face color derives from the light setting, so the parts are recomposed (see
    // WallLampObjectTypeConfig).
    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key === ObjectMetadataKeyEnumMap.LightProperties)
            this.instancedMeshComposer.reloadComposition();
    }
}