import * as THREE from "three";
import GameObject from "./gameObject";
import InstancedMeshComposer from "../../components/instancedMeshComposer";
import SpeechBubble from "../../components/speechBubble";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import LabelTextUtil from "../../../../shared/object/util/labelTextUtil";
import ObjectPoseUtil from "../../util/objectPoseUtil";

// A character an admin stood on a floor (see NpcObjectTypeConfig). Its transform is an attached object's: on the
// floor, facing up out of it. Its body is a player's, built upright about its own middle, so it is posed apart from
// that transform: stood on the floor, and turned the way its QuarterTurns has it face.
export default class NpcGameObject extends GameObject
{
    private body: THREE.Object3D = new THREE.Object3D();
    private instancedMeshComposer: InstancedMeshComposer;
    private speechBubble: SpeechBubble;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("NpcGameObject requires InstancedMeshComposer component");

        this.speechBubble = this.components.speechBubble as SpeechBubble;
        if (!this.speechBubble)
            throw new Error("NpcGameObject requires SpeechBubble component");

        // What draws the body, and what is placed about it, hangs from the pose (see GameObject.bodyObj).
        this.obj.add(this.body);
        this.body.add(this.visualObj);
        this.poseBody();
    }

    getSpeakerName(): string
    {
        return LabelTextUtil.toName(LabelTextUtil.getText(this.params));
    }

    // Hidden while the camera is inside it, as another player's body is (see PlayerGameObject).
    onPlayerProximityStart()
    {
        this.instancedMeshComposer.setHidden(true);
    }
    onPlayerProximityEnd()
    {
        this.instancedMeshComposer.setHidden(false);
    }

    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key === ObjectMetadataKeyEnumMap.Label)
            this.speechBubble.refresh();
        if (key === ObjectMetadataKeyEnumMap.QuarterTurns)
        {
            this.poseBody();
            this.notifyTransformChanged();
        }
    }

    private poseBody()
    {
        ObjectPoseUtil.poseNpcBody(this.body, this.obj, this.params);
    }
}
