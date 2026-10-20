import User from "../../../shared/user/types/user";
import EncodableData from "../../../shared/networking/types/encodableData";
import UserJoinHints from "./userJoinHints";

// A connected user, whatever carries them: a browser's socket (SocketUserContext) or an AI agent's requests
// (AgentUserContext). Rooms and managers hold users only through this.
export default interface UserContext
{
    user: User;
    isInSinglePlayerRoom: boolean;

    // Recorded funnel milestones from the authenticated row, so analytics can skip DB reads on the edit path.
    // Not on User, which is serialized to the browser. Kept in sync by ServerAnalyticsManager.
    funnel: string;
    // The login this visit belongs to (see DBUserUtil.getLoginCount), by which a helper greets each visitor once a login.
    loginCount: number;

    // When each throttled signal type was last let through (see UserSignalDispatchUtil).
    signalThrottleTimestamps: {[signalType: string]: number};

    addPendingSignalToUser(signalType: string, signalData: EncodableData): void;
    // A change the user made, which their own client has applied already (see SocketRoomContext.multicastSignalFromUser):
    // nothing to send them, but whatever else shows the room through their eyes needs it (see AgentCameraUtil).
    addOwnSignalToUser(signalType: string, signalData: EncodableData): void;
    // Drops what is queued, for when the signal queued next replaces all of it (see
    // ServerRoomManager.loadRoomFile).
    clearAllPendingSignalsToUser(): void;
    // Delivers what is queued (see SocketsServer's flush).
    processAllPendingSignalsToUser(): void;

    // Told at once rather than with the next batch, so the client waits as for a lost connection.
    notifyRoomReloadStarted(): void;
    // False once the connection is gone, which the stale-connection sweep acts on (see SocketsServer).
    isConnected(): boolean;
    // Ends the connection; a browser is sent to redirectURL, if given.
    disconnect(redirectURL?: string): void;
    getJoinHints(): UserJoinHints;
}
