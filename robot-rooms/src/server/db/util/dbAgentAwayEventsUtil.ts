import FirebaseUtil from "../../networking/util/firebaseUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import AgentEvent from "../../agent/types/agentEvent";
import { AGENT_INBOX_MAX_EVENTS, COLLECTION_AGENT_AWAY_EVENTS } from "../../system/serverConstants";

// The format documents are written in. One written in another is read as having nothing to tell.
const FORMAT_VERSION = 1;

// What happened in agents' rooms while they were away, kept until each comes back (see AgentAwayLogUtil): a document per
// agent, the newest events, written directly as the helpers' spending is (see DBHelperSpendingUtil).
const DBAgentAwayEventsUtil =
{
    // False if they couldn't be written.
    append: async (agentID: string, events: AgentEvent[]): Promise<boolean> =>
    {
        try
        {
            const db = await FirebaseUtil.getDB();
            const ref = db.collection(COLLECTION_AGENT_AWAY_EVENTS).doc(agentID);
            // Firestore takes no undefined field, which events leave out rather than write.
            const plainEvents = JSON.parse(JSON.stringify(events)) as AgentEvent[];
            await db.runTransaction(async transaction => {
                const doc = await transaction.get(ref);
                const kept = (doc.exists && doc.data()?.version == FORMAT_VERSION) ? doc.data()?.events ?? [] : [];
                transaction.set(ref, {version: FORMAT_VERSION, updatedAt: Date.now(),
                    events: [...kept, ...plainEvents].slice(-AGENT_INBOX_MAX_EVENTS)});
            });
            return true;
        }
        catch (err)
        {
            LogUtil.log("DBAgentAwayEventsUtil - failed to keep events", {agentID, err}, "high", "error");
            return false;
        }
    },
    // What was kept for the agent, which is forgotten as it is taken; none if it couldn't be read.
    take: async (agentID: string): Promise<AgentEvent[]> =>
    {
        try
        {
            const db = await FirebaseUtil.getDB();
            const ref = db.collection(COLLECTION_AGENT_AWAY_EVENTS).doc(agentID);
            return await db.runTransaction(async transaction => {
                const doc = await transaction.get(ref);
                if (!doc.exists)
                    return [];
                transaction.delete(ref);
                return (doc.data()?.version == FORMAT_VERSION) ? doc.data()?.events ?? [] : [];
            });
        }
        catch (err)
        {
            LogUtil.log("DBAgentAwayEventsUtil - failed to take events", {agentID, err}, "high", "error");
            return [];
        }
    },
    remove: async (agentID: string): Promise<void> =>
    {
        try
        {
            const db = await FirebaseUtil.getDB();
            await db.collection(COLLECTION_AGENT_AWAY_EVENTS).doc(agentID).delete();
        }
        catch (err)
        {
            LogUtil.log("DBAgentAwayEventsUtil - failed to remove events", {agentID, err}, "high", "error");
        }
    },
}

export default DBAgentAwayEventsUtil;
