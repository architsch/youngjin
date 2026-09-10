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

    // A door means two different things to two kinds of user. To somebody laying out the world it is
    // a piece of that world, and a click is how he takes hold of it — the ordinary business of
    // picking an object out, on the terms every object is picked out by, which is why he is not made
    // to walk up to a door to select one any more than he is made to walk up to a picture to move
    // one. To everybody else it is the way out of the room, and a click on it is a journey.
    //
    // Which of the two a click is has to be settled before it is made, rather than read off what
    // came of it: a door the user may work on but did not manage to pick out this time is still not
    // a door he means to be walked through. What settles it is the same question the taking itself
    // would ask, asked here in advance — so who may work on a door, and when, is said once, in the
    // door's client config and the conditions every object shares (see GameObject).
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

    // Walks the user through this door. Also what the admin's own "Enter" button does, since a door
    // he has picked out is still a door he can go through.
    //
    // Two destinations are no destination, and both are met with the same locked door: a door that
    // names no room at all, and one that names the room it is hanging in. The second is worth
    // ruling out here rather than letting the room change be asked for and granted, since a journey
    // that ends where it began reads as a broken door — and it is an easy way to wire one up, the
    // ids a destination is chosen from being long strings nobody reads.
    //
    // The reserved hub keyword is neither, and travels: which hub it opens onto is the server's to
    // answer when it is asked (see RoomPickerUtil).
    enter()
    {
        const destinationRoomID = DoorObjectTypeConfig.util.getDestinationRoomId(this.params);
        if (destinationRoomID.length == 0 || destinationRoomID == App.getCurrentRoom()?.id)
        {
            notificationMessageObservable.set("This door is locked!");
            return;
        }
        // No fallback is asked for: the door names where it goes, so a destination that cannot take
        // the user is a refusal he should be told about rather than a reason to put him somewhere
        // else. The hub keyword is the one destination that is routed on from instead, and it is
        // the server that makes it so — a hub the user never named is a hub he can be moved on from.
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
