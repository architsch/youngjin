import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import RoomChangedSignal from "../../../shared/room/types/roomChangedSignal";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import SocketRoomContext from "../../sockets/types/socketRoomContext";
import DBUserUtil from "../../db/util/dbUserUtil";
import DBAgentAwayEventsUtil from "../../db/util/dbAgentAwayEventsUtil";
import ServerUserManager from "../../user/serverUserManager";
import { AGENT_AWAY_LOG_FLUSH_MS } from "../../system/serverConstants";
import AgentInbox from "../types/agentInbox";
import AgentEvent from "../types/agentEvent";
import AgentUserContext from "../types/agentUserContext";

// The agents' rooms loaded, by id: whose each is, and what has happened in it since its owner was last there.
const watches: {[roomID: string]: {ownerID: string, roomRuntimeMemory: RoomRuntimeMemory, inbox: AgentInbox | undefined}}
    = {};

// What happens in an agent's own room while the agent is elsewhere, or away, as its inbox would have had it (see
// AgentInbox): handed to the agent while it is in ThingsPool, else kept until it comes back (see DBAgentAwayEventsUtil).
// A room is watched while it is loaded, which is while someone is in it.
const AgentAwayLogUtil =
{
    // Watches a room just loaded, if an agent owns it.
    watchRoom: async (roomRuntimeMemory: RoomRuntimeMemory, socketRoomContext: SocketRoomContext): Promise<void> =>
    {
        const room = roomRuntimeMemory.room;
        if (room.roomType != RoomTypeEnumMap.Regular || room.ownerUserID.length == 0)
            return;
        const owner = await DBUserUtil.findUserById(room.ownerUserID);
        if (owner?.userType != UserTypeEnumMap.Agent)
            return;

        const watch = {ownerID: room.ownerUserID, roomRuntimeMemory, inbox: undefined as AgentInbox | undefined};
        watches[room.id] = watch;
        socketRoomContext.observer = (signalType, signalData) => {
            // The owner in its room hears all of it, and is told at once what happened before it came.
            if (socketRoomContext.getUserContexts()[watch.ownerID] != undefined)
            {
                void handOn(watch);
                watch.inbox = undefined;
                return;
            }
            if (watch.inbox == undefined)
            {
                // Knowing whoever is in the room already, as the owner arriving would be told.
                watch.inbox = new AgentInbox(watch.ownerID);
                watch.inbox.note("roomChangedSignal", {roomRuntimeMemory: watch.roomRuntimeMemory} as RoomChangedSignal);
                watch.inbox.take();
            }
            watch.inbox.note(signalType, signalData);
        };
    },
    unwatchRoom: (roomID: string): void =>
    {
        const watch = watches[roomID];
        if (watch == undefined)
            return;
        delete watches[roomID];
        void handOn(watch);
    },
    // What was kept for the agent while it was away, which it is then told (see AgentPresenceUtil).
    takeKept: async (agentID: string): Promise<AgentEvent[]> =>
    {
        return await DBAgentAwayEventsUtil.take(agentID);
    },
    // Hands on what every watched room has new, as before a shutdown.
    handOnAll: async (): Promise<void> =>
    {
        await Promise.all(Object.values(watches).map(handOn));
    },
}

// A watched room's new events, marked as the owner's room's: into its inbox while it is in ThingsPool, else kept.
async function handOn(watch: {ownerID: string, inbox: AgentInbox | undefined}): Promise<void>
{
    const events = watch.inbox?.take() ?? [];
    if (events.length == 0)
        return;
    for (const event of events)
        event.inYourRoom = true;
    const owner = ServerUserManager.getSocketUserContext(watch.ownerID);
    if (owner instanceof AgentUserContext && !owner.isClosed())
        owner.inbox.receive(events);
    else
        await DBAgentAwayEventsUtil.append(watch.ownerID, events);
}

// Unref'd, so it never keeps the process alive (e.g. the SSG run); shutdown hands on what is left.
setInterval(() => void AgentAwayLogUtil.handOnAll(), AGENT_AWAY_LOG_FLUSH_MS).unref();

export default AgentAwayLogUtil;
