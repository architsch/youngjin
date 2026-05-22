import * as THREE from "three";
import GameObject from "./gameObject";
import SpeechBubble from "../components/speechBubble";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import PlayerProximityDetector from "../components/playerProximityDetector";
import PopupUtil from "../../ui/util/popupUtil";

export default class DoorGameObject extends GameObject
{
    private speechBubble: SpeechBubble;
    private playerProximityDetector: PlayerProximityDetector;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.speechBubble = this.components.speechBubble as SpeechBubble;
        if (!this.speechBubble)
            throw new Error("DoorGameObject requires SpeechBubble component");

        this.playerProximityDetector = this.components.playerProximityDetector as PlayerProximityDetector;
        if (!this.playerProximityDetector)
            throw new Error("DoorGameObject requires PlayerProximityDetector component");
    }

    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        if (!this.playerProximityDetector.isProximityOn())
            return;
        PopupUtil.openPopup({popupType: "roomList"});
    }

    onPlayerProximityStart(): void
    {
        this.speechBubble.setMessage("Click to Enter", false);
    }

    onPlayerProximityEnd(): void
    {
        this.speechBubble.setMessage("", false);
    }
}