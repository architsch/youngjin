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
import { DoorTypeEnumMap } from "../../../shared/object/types/doorType";
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
    enter()
    {
        const destinationRoomID = DoorObjectUtil.getDestinationRoomId(this.params);
        if (destinationRoomID.length > 0)
        {
            this.travel(destinationRoomID, false,
                DoorObjectUtil.getDestinationDoorLabel(this.params));
            return;
        }

        // A door that leads nowhere yet. Which of the two things that means depends on what the door
        // is for: a room's own way in is also its way out, so it falls back on taking the user out to
        // a hub rather than shutting him in — while a door somebody hung and has not yet wired up is
        // simply not a way anywhere.
        if (DoorObjectUtil.getDoorType(this.params) == DoorTypeEnumMap.DefaultEntrance)
            this.travel("", true, "");
        else
            notificationMessageObservable.set("This door is locked!");
    }

    private travel(roomID: string, allowFallback: boolean, destinationDoorLabel: string)
    {
        if (!tryStartClientProcess("roomChange", 1, 1))
            return;
        SocketsClient.emitRequestRoomChangeSignal(
            new RequestRoomChangeSignal(roomID, allowFallback, destinationDoorLabel));
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
