import User from "../../../shared/user/types/user";
import EncodableData from "../../../shared/networking/types/encodableData";
import UserContext from "../../sockets/types/userContext";
import UserJoinHints from "../../sockets/types/userJoinHints";
import SocketSignalQueue from "../../sockets/types/socketSignalQueue";
import { AGENT_PRESENCE_IDLE_TIMEOUT_MS } from "../../system/serverConstants";
import AgentInbox from "./agentInbox";
import AgentMotion from "./agentMotion";

// An AI agent carried by its requests to the MCP endpoint rather than by a socket. It stays connected while
// the requests keep coming (see AgentPresenceUtil), and reads the live room rather than a queue of signals.
export default class AgentUserContext implements UserContext
{
    user: User;
    singlePlayerMode: string = "";
    funnel: string;
    loginCount: number;
    signalThrottleTimestamps: {[signalType: string]: number} = {};
    readonly inbox: AgentInbox;
    // Its key's hash, by which its requests are known while it is present (see AgentPresenceUtil.findByKey).
    readonly keyHash: string;
    // Set once its body is first stepped in a room (see AgentBodyUtil).
    motion: AgentMotion | undefined = undefined;
    // The secret in its camera's link, made when first asked for, and the pages open on it, which are sent what a
    // browser in its place would be (see AgentCameraUtil).
    cameraToken: string | undefined = undefined;
    readonly cameras: SocketSignalQueue[] = [];

    private lastRequestAt: number = Date.now();
    private closed: boolean = false;

    constructor(user: User, funnel: string, loginCount: number, keyHash: string)
    {
        this.user = user;
        this.funnel = funnel;
        this.loginCount = loginCount;
        this.keyHash = keyHash;
        this.inbox = new AgentInbox(user.id);
    }

    get isInSinglePlayerRoom(): boolean
    {
        return this.singlePlayerMode != "";
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
        for (const camera of this.cameras)
            camera.add(signalType, signalData);
    }

    addOwnSignalToUser(signalType: string, signalData: EncodableData): void
    {
        for (const camera of this.cameras)
            camera.add(signalType, signalData);
    }

    // Only its cameras have anything waiting: the inbox keeps only facts, and the room is read live.
    clearAllPendingSignalsToUser(): void
    {
        for (const camera of this.cameras)
            camera.clear();
    }

    processAllPendingSignalsToUser(): void
    {
        for (const camera of this.cameras)
            camera.flush();
    }

    notifyRoomReloadStarted(): void
    {
        this.inbox.noteRoomReloading();
        for (const camera of this.cameras)
            camera.socket.emit("roomReloadStarted");
    }

    isConnected(): boolean
    {
        return !this.closed && Date.now() - this.lastRequestAt < AGENT_PRESENCE_IDLE_TIMEOUT_MS;
    }

    // Its cameras go off with it: a page reloads to say so.
    disconnect(_redirectURL?: string): void
    {
        this.closed = true;
        for (const camera of this.cameras.splice(0))
            camera.socket.disconnect(true);
    }

    getJoinHints(): UserJoinHints
    {
        return {};
    }
}
