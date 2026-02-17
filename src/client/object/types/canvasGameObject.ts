import * as THREE from "three";
import GameObject from "./gameObject";
import GameSocketsClient from "../../networking/client/gameSocketsClient";
import RoomChangeRequestParams from "../../../shared/room/types/roomChangeRequestParams";
import PlayerProximityDetector from "../components/playerProximityDetector";
import PersistentObjectMeshInstancer from "../components/persistentObjectMeshInstancer";
import SpeechBubble from "../components/speechBubble";

export default class CanvasGameObject extends GameObject
{
    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        const detector = this.components.playerProximityDetector as PlayerProximityDetector;
        if (!detector.isProximityOn())
            return;

        const instancer = this.components.persistentObjectMeshInstancer as PersistentObjectMeshInstancer;
        const po = instancer.getPersistentObject();
        console.log(`Selected PersistentObject = ${JSON.stringify(po)}`);
        
        //const destinationRoomID = po.metadata[ObjectMetadataKeyEnumMap.RoomID];
        //GameSocketsClient.emitRoomChangeRequest(new RoomChangeRequestParams(destinationRoomID));
    }

    onPlayerProximityStart()
    {
        const speechBubble = this.components.speechBubble as SpeechBubble;
        const instancer = this.components.persistentObjectMeshInstancer as PersistentObjectMeshInstancer;
        const po = instancer.getPersistentObject();
        //const destinationRoomID = po.metadata[ObjectMetadataKeyEnumMap.RoomID];
        //speechBubble.setMessage(`Click to Visit ${destinationRoomID}`, true, false);
    }

    onPlayerProximityEnd()
    {
        const speechBubble = this.components.speechBubble as SpeechBubble;
        speechBubble.setMessage("", true, false);
    }
}