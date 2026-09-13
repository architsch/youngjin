import * as THREE from "three";
import GameObject from "./gameObject";
import SpeechBubble from "../components/speechBubble";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import PlayerProximityDetector from "../components/playerProximityDetector";
import { notificationMessageObservable } from "../../system/clientObservables";
import { tryStartClientProcess } from "../../system/types/clientProcess";
import SocketsClient from "../../networking/client/socketsClient";
import RequestRoomChangeSignal from "../../../shared/room/types/requestRoomChangeSignal";
import DoorObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import App from "../../app";

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

    // A click selects the door for users who may edit it (decided up front by the same selection
    // check, not by whether selection succeeded); for everyone else it travels through the door.
    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        if (this.canBeSelected(hitPoint))
        {
            super.onClick(instanceId, hitPoint);
            return;
        }

        if (this.playerProximityDetector.isProximityOn())
            this.enter();
    }

    // Travels through the door (also the admin's "Enter" button). A missing destination, or one
    // naming the current room, is shown as locked. The hub keyword resolves on the server
    // (see RoomPickerUtil).
    enter()
    {
        const destinationRoomID = DoorObjectTypeConfig.util.getDestinationRoomId(this.params);
        if (destinationRoomID.length == 0 || destinationRoomID == App.getCurrentRoom()?.id)
        {
            notificationMessageObservable.set("This door is locked!");
            return;
        }
        // No fallback: a refused destination should be reported. (The server itself reroutes the hub
        // keyword.)
        if (!tryStartClientProcess("roomChange", 1, 1))
            return;
        SocketsClient.emitRequestRoomChangeSignal(new RequestRoomChangeSignal(destinationRoomID,
            false, DoorObjectTypeConfig.util.getDestinationDoorLabel(this.params)));
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
