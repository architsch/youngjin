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
import NpcFacingUtil from "../../../../shared/object/util/npcFacingUtil";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import ObjectPoseUtil from "../../util/objectPoseUtil";

// A guide's steps (see HelperAgentUtil) come with each batch of signals, so each is glided over in about that long. A
// longer move is a jump, as an admin's placing it.
const GLIDE_SECONDS = 0.25;
const MAX_GLIDE_STEP = 1.5;
// A turn eases out over about this long, no faster than this (in degrees a second), and ends once this near.
const TURN_SECONDS = 0.1;
const MAX_TURN_SPEED = 360;
const TURNED_WITHIN = 0.1;

// A character an admin stood on a floor (see NpcObjectTypeConfig). Its transform is an attached object's: on the
// floor, facing up out of it. Its body is a player's, built upright about its own middle, so it is posed apart from
// that transform: stood on the floor, and turned toward the way it faces (see getFacing) over a moment. In a
// multiplayer room it is a helper, an AI guide the server plays, walking, turning and talking (see HelperAgentUtil).
export default class NpcGameObject extends GameObject
{
    private body: THREE.Object3D = new THREE.Object3D();
    private instancedMeshComposer: InstancedMeshComposer;
    private speechBubble: SpeechBubble;
    private glide: {from: Vec3, to: Vec3, dir: Vec3, elapsed: number} | undefined = undefined;
    // The way the body faces as drawn (see NpcFacingUtil).
    private drawnFacing: number;

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
        this.drawnFacing = this.getFacing();
        this.poseBody();
    }

    // A helper, which people are told is an AI; one in a single-player room is the room's script's.
    getSpeakerName(): string
    {
        const name = LabelTextUtil.toName(LabelTextUtil.getText(this.params));
        return this.isHelper() ? `${name} (AI)`.trim() : name;
    }

    // For automation (see AutomationBridgeUtil).
    getDrawnFacing(): number
    {
        return this.drawnFacing;
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
        this.updateGlide(deltaTime);
        this.updateTurn(deltaTime);
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
    }

    private updateGlide(deltaTime: number)
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

    private updateTurn(deltaTime: number)
    {
        const facing = this.getFacing();
        const turn = NpcFacingUtil.getTurn(this.drawnFacing, facing);
        if (turn == 0)
            return;
        const step = Math.sign(turn) * Math.min(Math.abs(turn) * (1 - Math.exp(-deltaTime / TURN_SECONDS)),
            MAX_TURN_SPEED * deltaTime);
        this.drawnFacing = (Math.abs(turn - step) < TURNED_WITHIN) ? facing : this.drawnFacing + step;
        this.poseBody();
        this.notifyTransformChanged();
    }

    // The way it faces: a helper's as the server plays it (its Facing), else as its QuarterTurns has it, which is also
    // the way a helper this user holds faces, to be edited.
    private getFacing(): number
    {
        const put = NpcFacingUtil.getDegrees(ObjectPoseUtil.getNpcFacing(this.params));
        if (!this.isHelper() || NpcGameObject.isHeld(this.params.objectId))
            return put;
        return NpcFacingUtil.decode(this.params.metadata[ObjectMetadataKeyEnumMap.Facing]?.str ?? "") ?? put;
    }

    private poseBody()
    {
        ObjectPoseUtil.poseNpcBody(this.body, this.obj, this.params, NpcFacingUtil.getDir(this.drawnFacing));
    }

    private isHelper(): boolean
    {
        const room = App.getCurrentRoom();
        return room != undefined && room.roomType != RoomTypeEnumMap.SinglePlayer;
    }
}
