import * as THREE from "three";
import GameObject from "./gameObject";
import InstancedMeshComposer from "../../components/instancedMeshComposer";
import SpeechBubble from "../../components/speechBubble";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import LabelTextUtil from "../../../../shared/object/util/labelTextUtil";
import ObjectScaleUtil from "../../../../shared/object/util/objectScaleUtil";
import QuarterTurnsUtil from "../../../../shared/object/util/quarterTurnsUtil";

const WORLD_UP = new THREE.Vector3(0, 1, 0);

const rightTemp = new THREE.Vector3();
const backTemp = new THREE.Vector3();
const basisTemp = new THREE.Matrix4();
const uprightTemp = new THREE.Quaternion();

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

    // The body looks along its own -z (see FORWARD_DIR), which is turned onto the way its content's top points
    // across the floor (see QuarterTurnsUtil.getContentUp); its middle is half its height up from there.
    private poseBody()
    {
        const transform = this.params.transform;
        const facing = QuarterTurnsUtil.getContentUp(transform.dir, QuarterTurnsUtil.getQuarterTurns(this.params));
        backTemp.set(-facing.x, -facing.y, -facing.z);
        rightTemp.crossVectors(WORLD_UP, backTemp);
        uprightTemp.setFromRotationMatrix(basisTemp.makeBasis(rightTemp, WORLD_UP, backTemp));

        // Relative to the object's own turn, which lays its local z along the floor's normal.
        this.body.quaternion.copy(this.obj.quaternion).invert().multiply(uprightTemp);
        const height = ObjectScaleUtil.getObjectSize(this.params.objectTypeIndex, transform.scale).z;
        this.body.position.set(0, 0, 0.5 * height);
    }
}
