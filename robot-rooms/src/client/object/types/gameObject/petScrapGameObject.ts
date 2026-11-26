import * as THREE from "three";
import GameObject from "./gameObject";
import InstancedMeshComposer from "../../components/instancedMeshComposer";
import InstancedMeshGraphics from "../../components/instancedMeshGraphics";
import PetNamePlate from "../../components/helpers/pet/petNamePlate";
import ObjectPoseUtil from "../../util/objectPoseUtil";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import NpcFacingUtil from "../../../../shared/object/util/npcFacingUtil";

const LISTENER_KEY = "petScrapGameObject";

// What is left of a pet (see PetScrapObjectTypeConfig). Its transform is an attached object's: on the floor, facing up
// out of it. Its body is a pet's, built upright about its own middle, so it is posed apart from that transform, as an
// NPC's is: stood on the floor, facing the way the pet faced as it died (its Facing).
export default class PetScrapGameObject extends GameObject
{
    private body: THREE.Object3D = new THREE.Object3D();
    private instancedMeshComposer: InstancedMeshComposer;
    private namePlate: PetNamePlate;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("PetScrapGameObject requires InstancedMeshComposer component");

        // What draws the body, and what is printed on it, hangs from the pose (see GameObject.bodyObj).
        this.obj.add(this.body);
        this.body.add(this.visualObj);
        this.poseBody();
        this.namePlate = new PetNamePlate(this, this.components.instancedMeshGraphics as InstancedMeshGraphics, true);
        // What is printed on the body goes where the body is drawn, each time that is (see PetGameObject).
        this.instancedMeshComposer.instancesPlacedObservable.addListener(LISTENER_KEY, () => this.namePlate.place());
    }

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();
        await this.namePlate.load();
    }

    async onDespawn(): Promise<void>
    {
        this.instancedMeshComposer.instancesPlacedObservable.removeListener(LISTENER_KEY);
        this.namePlate.dispose();
        await super.onDespawn();
    }

    onTransformChanged(resized: boolean)
    {
        this.poseBody();
        super.onTransformChanged(resized);
    }

    forEachOwnedInstance(visit: (instancedMeshId: string, instanceId: number) => void)
    {
        this.namePlate.forEachInstance(visit);
    }

    private poseBody()
    {
        const facing = NpcFacingUtil.decode(this.params.metadata[ObjectMetadataKeyEnumMap.Facing]?.str ?? "") ?? 0;
        ObjectPoseUtil.poseNpcBody(this.body, this.obj, this.params, NpcFacingUtil.getDir(facing));
    }
}
