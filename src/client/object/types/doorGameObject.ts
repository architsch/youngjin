import * as THREE from "three";
import GameObject from "./gameObject";
import SpeechBubble from "../components/speechBubble";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import PlayerProximityDetector from "../components/playerProximityDetector";
import { notificationMessageObservable } from "../../system/clientObservables";
import { tryStartClientProcess } from "../../system/types/clientProcess";
import SocketsClient from "../../networking/client/socketsClient";
import RequestRoomChangeSignal from "../../../shared/room/types/requestRoomChangeSignal";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import DoorObjectUtil from "../../../shared/object/util/doorObjectUtil";
import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import GameModeUtil from "../../system/util/gameModeUtil";
import GraphicsManager from "../../graphics/graphicsManager";
import App from "../../app";
import { DOOR_FOOTPRINT_HEIGHT, DOOR_FOOTPRINT_WIDTH } from "../../../shared/system/sharedConstants";

const vector3Temp = new THREE.Vector3();

// The stretch of wall a door lays claim to as an attachment, which is what its selection outline
// frames and what its move arrows are placed around.
const selectionOutlineScale = new THREE.Vector3(DOOR_FOOTPRINT_WIDTH, DOOR_FOOTPRINT_HEIGHT, 1);

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

    // A door means two different things to two kinds of user. To almost everybody it is the way out
    // of the room, and a click on it is a journey. To an admin it is also a piece of the world he is
    // building, and a click is how he takes hold of it — which is why he is not made to walk up to a
    // door to select one, the way he is not made to walk up to a picture to move it.
    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        const room = App.getCurrentRoom();
        if (room == undefined)
        {
            console.error("Current room not found in DoorGameObject's onClick.");
            return;
        }

        if (RoomValidationUtil.canUserManageDoors(App.getUser(), room))
        {
            GraphicsManager.getCamera().getWorldPosition(vector3Temp);
            if (hitPoint.distanceTo(vector3Temp) > WorldSpaceSelectionUtil.getMaxSelectDist())
                return;
            // Taking hold of a door is the start of working on it, and there is nothing else an
            // admin picks one out for: a door he only meant to walk through he walks through. So the
            // mode that work happens in opens along with the selection, rather than leaving him
            // holding a door with no tools out and a mode button to find.
            if (ObjectSelection.trySelect(this))
                GameModeUtil.enterEditModeOnCurrentSelection();
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
        const destinationRoomID = DoorObjectUtil.getDestinationRoomId(this.params);
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
            false, DoorObjectUtil.getDestinationDoorLabel(this.params)));
    }

    getSelectionOutlineScale(): THREE.Vector3
    {
        return selectionOutlineScale;
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
