import socketIO from "socket.io";
import User from "../../../shared/user/types/user";
import EncodableData from "../../../shared/networking/types/encodableData";
import UserContext from "./userContext";
import UserJoinHints from "./userJoinHints";
import SocketSignalQueue from "./socketSignalQueue";

export default class SocketUserContext implements UserContext
{
    socket: socketIO.Socket;
    user: User;
    isInSinglePlayerRoom: boolean = false;
    funnel: string;
    loginCount: number;
    signalThrottleTimestamps: {[signalType: string]: number} = {};

    private readonly pendingSignalsToUser: SocketSignalQueue;

    constructor(socket: socketIO.Socket)
    {
        this.socket = socket;
        this.user = socket.handshake.auth.user as User;
        this.funnel = (socket.handshake.auth.funnel as string) ?? "";
        this.loginCount = (socket.handshake.auth.loginCount as number) ?? 0;
        this.pendingSignalsToUser = new SocketSignalQueue(socket);
    }

    notifyRoomReloadStarted(): void
    {
        this.socket.emit("roomReloadStarted");
    }

    isConnected(): boolean
    {
        return this.socket.connected;
    }

    disconnect(redirectURL?: string): void
    {
        if (redirectURL != undefined)
            this.socket.emit("forceRedirect", redirectURL);
        this.socket.disconnect(true);
    }

    getJoinHints(): UserJoinHints
    {
        const auth = this.socket.handshake.auth;
        return {
            targetRoomID: auth.targetRoomID as string | undefined,
            roomEditorOpen: auth.roomEditorOpen === true,
        };
    }

    addPendingSignalToUser(signalType: string, signalData: EncodableData)
    {
        this.pendingSignalsToUser.add(signalType, signalData);
    }

    // The browser has applied its own change already.
    addOwnSignalToUser(_signalType: string, _signalData: EncodableData): void
    {
    }

    tryUpdateLatestPendingSignalToUser(signalType: string, signalDataUpdateMethod: (signal: EncodableData) => void): boolean
    {
        return this.pendingSignalsToUser.updateLatest(signalType, signalDataUpdateMethod);
    }

    clearAllPendingSignalsToUser()
    {
        this.pendingSignalsToUser.clear();
    }

    processAllPendingSignalsToUser()
    {
        this.pendingSignalsToUser.flush();
    }
}
