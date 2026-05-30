import * as THREE from "three";
import GameObject from "./gameObject";
import SpeechBubble from "../components/speechBubble";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import PlayerProximityDetector from "../components/playerProximityDetector";
import PopupUtil from "../../ui/util/popupUtil";
import { clientFeatureFlagsObservable } from "../../system/clientObservables";
import { FeatureFlag } from "../../../shared/system/types/featureFlag";
import { tryStartClientProcess } from "../../system/types/clientProcess";
import SocketsClient from "../../networking/client/socketsClient";
import RequestRoomChangeSignal from "../../../shared/room/types/requestRoomChangeSignal";

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

        if (clientFeatureFlagsObservable.has(FeatureFlag.GoToHubImmediatelyOnDoorClick))
        {
            if (!tryStartClientProcess("roomChange", 1, 1))
                return;
            // "hub" is not an actual roomID. It is a special keyword which indicates that the user wants to join a Hub-type room.
            SocketsClient.emitRequestRoomChangeSignal(new RequestRoomChangeSignal("hub"));
        }
        else
        {
            PopupUtil.openPopup({popupType: "roomList"});
        }
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