import * as THREE from "three";
import GameObject from "./gameObject";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import Vec3 from "../../../shared/math/types/vec3";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import LightSource from "../components/lightSource";
import InstancedMeshComposer from "../components/instancedMeshComposer";

// A light somebody installed on a wall. What is drawn is the composer's business and what is lit is
// the light source's; what this class does is keep the two pointed at the same place and the same
// color as the lamp is moved and adjusted.
export default class LampGameObject extends GameObject
{
    private lightSource: LightSource;
    private instancedMeshComposer: InstancedMeshComposer;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.lightSource = this.components.lightSource as LightSource;
        if (!this.lightSource)
            throw new Error("LampGameObject requires LightSource component");

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("LampGameObject requires InstancedMeshComposer component");
    }

    // Moving a lamp moves the light it gives off, and there is no update loop to notice that: a wall
    // attachment is placed rather than driven, so this is called a handful of times as somebody
    // slides one along a wall. (The parts follow on their own — the composer re-bakes its instances
    // whenever the object's world matrix changes.)
    setObjectTransform(pos: Vec3, dir: Vec3)
    {
        super.setObjectTransform(pos, dir);
        this.lightSource.setTransform(pos, dir);
    }

    // Re-lighting a lamp also repaints it: the lit face takes its color from the same setting the
    // light does, and the parts are derived from that setting rather than stored beside it, so they
    // have to be built again from the new one (see LampObjectTypeConfig).
    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key === ObjectMetadataKeyEnumMap.LightProperties)
            this.instancedMeshComposer.reloadComposition();
    }

}
