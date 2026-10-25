import DBUser from "../../db/types/row/dbUser";
import DBUserUtil from "../../db/util/dbUserUtil";
import ServerUserManager from "../../user/serverUserManager";
import UserSessionUtil from "../../user/util/userSessionUtil";
import AgentUserContext from "../types/agentUserContext";
import AgentBodyUtil from "./agentBodyUtil";
import AgentKeyUtil from "./agentKeyUtil";
import AgentAwayLogUtil from "./agentAwayLogUtil";
import { AGENT_MAX_PRESENT } from "../../system/serverConstants";

// An agent is present, its player in a room, from its first request until it leaves or goes quiet (see
// AgentUserContext.isConnected, which SocketsServer's sweep acts on). Requests carry no session, so presence
// is the server's to keep.

// Arrivals under way, so that requests arriving together share one.
const pendingArrivals: {[userID: string]: Promise<AgentUserContext>} = {};

const AgentPresenceUtil =
{
    // The present agent a key belongs to, known without reading its row: a read for each request would soon use up
    // the database's query rate (see DBQueryRateMonitorUtil).
    findByKey: (key: string): AgentUserContext | undefined =>
    {
        const parsed = AgentKeyUtil.parse(key.trim());
        if (parsed == undefined)
            return undefined;
        const present = ServerUserManager.getSocketUserContext(parsed.userID);
        return (present instanceof AgentUserContext && !present.isClosed()
            && AgentKeyUtil.matches(parsed.secret, present.keyHash)) ? present : undefined;
    },
    // The agent's context, arriving it first if it isn't present; none if it isn't and as many agents are present as
    // may be (see AGENT_MAX_PRESENT).
    attend: async (dbUser: DBUser): Promise<AgentUserContext | undefined> =>
    {
        const userID = dbUser.id as string;
        // First, since an arriving agent is registered before it has a room.
        if (pendingArrivals[userID] != undefined)
            return await pendingArrivals[userID];

        const present = ServerUserManager.getSocketUserContext(userID);
        if (present instanceof AgentUserContext && !present.isClosed())
        {
            present.noteRequest();
            return present;
        }
        const numPresent = Object.values(ServerUserManager.socketUserContexts)
            .filter(ctx => ctx instanceof AgentUserContext && !ctx.isClosed()).length;
        if (numPresent + Object.keys(pendingArrivals).length >= AGENT_MAX_PRESENT)
            return undefined;

        pendingArrivals[userID] = arrive(dbUser).finally(() => delete pendingArrivals[userID]);
        return await pendingArrivals[userID];
    },
    leave: async (ctx: AgentUserContext): Promise<void> =>
    {
        AgentBodyUtil.stop(ctx);
        ctx.disconnect();
        await UserSessionUtil.release(ctx);
    },
}

async function arrive(dbUser: DBUser): Promise<AgentUserContext>
{
    const ctx = new AgentUserContext(DBUserUtil.fromDBType(dbUser), dbUser.funnel ?? "", DBUserUtil.getLoginCount(dbUser),
        dbUser.agentKeyHash ?? "");
    // As a browser's visit does, so that a quiet agent is cleaned up as a quiet guest is.
    DBUserUtil.updateLastLogin(ctx.user.id, dbUser.lastLoginAt);
    // What happened in its room while it was away, read as it arrives and told after its arrival.
    const kept = AgentAwayLogUtil.takeKept(ctx.user.id);
    await UserSessionUtil.admit(ctx);
    await UserSessionUtil.joinFirstRoom(ctx);
    ctx.inbox.receive(await kept);
    return ctx;
}

export default AgentPresenceUtil;
