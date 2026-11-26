import App from "../../app";
import ClientObjectManager from "../clientObjectManager";
import SpeechBubble from "../components/speechBubble";
import NpcGameObject from "../types/gameObject/npcGameObject";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
import HelperBehaviorUtil from "../../../shared/object/util/helperBehaviorUtil";
import PetListenerUtil from "../../../shared/object/util/petListenerUtil";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";

const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");

// A helper, or a pet, shown thinking before the server says so: in a multiplayer room, the one the server will have hear
// a line the user has just said, by the same rule (see HelperBehaviorUtil.pickListener), is shown thinking at once rather
// than a round trip later. A single-player room's helpers are the browser's own, and show it as they hear.
const HelperThinkingUtil =
{
    expectAnswerTo: (text: string): void =>
    {
        const room = App.getCurrentRoom();
        const me = ClientObjectManager.getMyPlayer();
        if (room == undefined || room.roomType == RoomTypeEnumMap.SinglePlayer || me == undefined
            || AdminPrefsUtil.isGhost(me.params) || text.trim().length == 0)
        {
            return;
        }
        const now = Date.now();
        // Where each was last shown standing, rather than at home, where the room keeps it.
        const helpers = Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex == NPC_TYPE_INDEX && HelperBehaviorUtil.isPlayed(obj))
            .map(obj => {
                const body = ClientObjectManager.getObjectById(obj.objectId);
                return {...HelperBehaviorUtil.create(obj, now), objectId: obj.objectId,
                    at: (body instanceof NpcGameObject) ? body.getShownAt() : {...obj.transform.pos}};
            });
        // A player's transform points behind it, so it faces the other way (see PlayerController).
        const facing = me.direction.negate();
        const speaker = {x: me.position.x, y: me.position.y, z: me.position.z};
        const {helper, pet} = HelperBehaviorUtil.pickListener(helpers, text, speaker,
            {x: facing.x, y: facing.y, z: facing.z}, PetListenerUtil.find(room, text, speaker));
        const listenerId = helper?.objectId ?? pet?.objectId;
        if (listenerId == undefined)
            return;
        (ClientObjectManager.getObjectById(listenerId)?.components.speechBubble as SpeechBubble | undefined)
            ?.expectThinking();
    },
}

export default HelperThinkingUtil;
