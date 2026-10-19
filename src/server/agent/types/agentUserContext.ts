import User from "../../../shared/user/types/user";
import EncodableData from "../../../shared/networking/types/encodableData";
import UserContext from "../../sockets/types/userContext";
import UserJoinHints from "../../sockets/types/userJoinHints";
import { AGENT_PRESENCE_IDLE_TIMEOUT_MS } from "../../system/serverConstants";
import AgentInbox from "./agentInbox";
import AgentMotion from "./agentMotion";

// An AI agent carried by its requests to the MCP endpoint rather than by a socket. It stays connected while
// the requests keep coming (see AgentPresenceUtil), and reads the live room rather than a queue of signals.
export default class AgentUserContext implements UserContext
{
    user: User;
    isInSinglePlayerRoom: boolean = false;
    funnel: string;
    signalThrottleTimestamps: {[signalType: string]: number} = {};
    readonly inbox: AgentInbox;
    // Set once its body is first stepped in a room (see AgentBodyUtil).
    motion: AgentMotion | undefined = undefined;

    private lastRequestAt: number = Date.now();
    private closed: boolean = false;

    constructor(user: User, funnel: string)
    {
        this.user = user;
        this.funnel = funnel;
        this.inbox = new AgentInbox(user.id);
    }

    noteRequest(): void
    {
        this.lastRequestAt = Date.now();
    }

    isClosed(): boolean
    {
        return this.closed;
    }

    addPendingSignalToUser(signalType: string, signalData: EncodableData): void
    {
        this.inbox.note(signalType, signalData);
    }

    // Nothing waits to be dropped or sent: the inbox keeps only facts, and the room is read live.
    clearAllPendingSignalsToUser(): void
    {
    }

    processAllPendingSignalsToUser(): void
    {
    }

    notifyRoomReloadStarted(): void
    {
        this.inbox.noteRoomReloading();
    }

    isConnected(): boolean
    {
        return !this.closed && Date.now() - this.lastRequestAt < AGENT_PRESENCE_IDLE_TIMEOUT_MS;
    }

    disconnect(_redirectURL?: string): void
    {
        this.closed = true;
    }

    getJoinHints(): UserJoinHints
    {
        return {};
    }
}
