import App from "../../app";
import ClientObjectManager from "../clientObjectManager";
import SpeechBubble from "../components/speechBubble";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
import HelperBehaviorUtil from "../../../shared/object/util/helperBehaviorUtil";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";

const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");

// A helper shown thinking before the server says so: in a multiplayer room, the one the server will have hear a line the
// user has just said, by the same rule (see HelperBehaviorUtil.pickListener), is shown thinking at once rather than a
// round trip later. A single-player room's helpers are the browser's own, and show it as they hear.
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
        // Where each stands as the room was last shown it, which the room's own copy here follows.
        const helpers = Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex == NPC_TYPE_INDEX && HelperBehaviorUtil.isPlayed(obj))
            .map(obj => ({...HelperBehaviorUtil.create(obj, now), objectId: obj.objectId}));
        // A player's transform points behind it, so it faces the other way (see PlayerController).
        const facing = me.direction.negate();
        const listener = HelperBehaviorUtil.pickListener(helpers, text,
            {x: me.position.x, y: me.position.y, z: me.position.z}, {x: facing.x, y: facing.y, z: facing.z});
        if (listener == undefined)
            return;
        (ClientObjectManager.getObjectById(listener.objectId)?.components.speechBubble as SpeechBubble | undefined)
            ?.expectThinking();
    },
}

export default HelperThinkingUtil;
