import PersistentObjectMeshInstancer from "../components/persistentObjectMeshInstancer";
import SpeechBubble from "../components/speechBubble";
import GameObject from "../types/gameObject";

export const ObjectPlayerProximityCallbackMap: {[objectType: string]: {
        proximityStart: (gameObject: GameObject) => void,
        proximityEnd: (gameObject: GameObject) => void
    }} =
{
    "Voxel": {
        proximityStart: (gameObject: GameObject) => {},
        proximityEnd: (gameObject: GameObject) => {},
    },
    "Door": {
        proximityStart: (gameObject: GameObject) =>
        {
            const speechBubble = gameObject.components.speechBubble as SpeechBubble;
            const instancer = gameObject.components.persistentObjectMeshInstancer as PersistentObjectMeshInstancer;
            const po = instancer.getPersistentObject();
            const destinationRoomID = po.metadata;
            speechBubble.showMessage(`Click to Visit ${destinationRoomID}`, true, false);
        },
        proximityEnd: (gameObject: GameObject) =>
        {
            const speechBubble = gameObject.components.speechBubble as SpeechBubble;
            speechBubble.clearMessage();
        },
    },
}