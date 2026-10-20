import * as THREE from "three";
import GameObject from "./gameObject";
import InstancedMeshComposer from "../../components/instancedMeshComposer";
import SpeechBubble from "../../components/speechBubble";
import App from "../../../app";
import GameModeUtil from "../../../system/util/gameModeUtil";
import { objectSelectionObservable } from "../../../system/clientObservables";
import Vec3 from "../../../../shared/math/types/vec3";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import LabelTextUtil from "../../../../shared/object/util/labelTextUtil";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import ObjectPoseUtil from "../../util/objectPoseUtil";

// A guide's steps (see HelperAgentUtil) come with each batch of signals, so each is glided over in about that long. A
// longer move is a jump, as an admin's placing it.
const GLIDE_SECONDS = 0.25;
const MAX_GLIDE_STEP = 1.5;

// A character an admin stood on a floor (see NpcObjectTypeConfig). Its transform is an attached object's: on the
// floor, facing up out of it. Its body is a player's, built upright about its own middle, so it is posed apart from
// that transform: stood on the floor, and turned the way its QuarterTurns has it face. In a multiplayer room it is a
// helper, an AI guide the server plays, walking and talking (see HelperAgentUtil).
export default class NpcGameObject extends GameObject
{
    private body: THREE.Object3D = new THREE.Object3D();
    private instancedMeshComposer: InstancedMeshComposer;
    private speechBubble: SpeechBubble;
    private glide: {from: Vec3, to: Vec3, dir: Vec3, elapsed: number} | undefined = undefined;

    // Whether this user holds it, selected in edit mode to drag: it is theirs to move until let go, so the server's
    // steps and turns pass it by meanwhile (see ClientObjectManager).
    static isHeld(objectId: string): boolean
    {
        const selection = objectSelectionObservable.peek();
        return selection?.gameObject instanceof NpcGameObject && selection.gameObject.params.objectId == objectId
            && GameModeUtil.isInEditMode();
    }

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

    // A helper, which people are told is an AI; one in a single-player room is the room's script's.
    getSpeakerName(): string
    {
        const name = LabelTextUtil.toName(LabelTextUtil.getText(this.params));
        return this.isHelper() ? `${name} (AI)`.trim() : name;
    }

    setObjectTransform(pos: Vec3, dir: Vec3)
    {
        const from = this.obj.position;
        const step = Math.hypot(pos.x - from.x, pos.y - from.y, pos.z - from.z);
        if (this.isHelper() && step > 0 && step <= MAX_GLIDE_STEP && !NpcGameObject.isHeld(this.params.objectId))
        {
            this.glide = {from: {x: from.x, y: from.y, z: from.z}, to: {...pos}, dir: {...dir}, elapsed: 0};
            return;
        }
        this.glide = undefined;
        super.setObjectTransform(pos, dir);
    }

    update(deltaTime: number)
    {
        if (this.glide == undefined)
            return;
        const glide = this.glide;
        glide.elapsed += deltaTime;
        const t = Math.min(1, glide.elapsed / GLIDE_SECONDS);
        if (t >= 1)
            this.glide = undefined;
        super.setObjectTransform({x: glide.from.x + (glide.to.x - glide.from.x) * t,
            y: glide.from.y + (glide.to.y - glide.from.y) * t, z: glide.from.z + (glide.to.z - glide.from.z) * t}, glide.dir);
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

    private isHelper(): boolean
    {
        const room = App.getCurrentRoom();
        return room != undefined && room.roomType != RoomTypeEnumMap.SinglePlayer;
    }
}
