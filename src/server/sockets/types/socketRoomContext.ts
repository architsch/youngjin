import EncodableData from "../../../shared/networking/types/encodableData";
import SocketUserContext from "./socketUserContext";

export default class SocketRoomContext
{
    private socketUserContexts: {[userID: string]: SocketUserContext};

    constructor()
    {
        this.socketUserContexts = {};
    }

    getUserContexts(): {[userID: string]: SocketUserContext}
    {
        return this.socketUserContexts;
    }

    multicastSignal(signalType: string, signalData: EncodableData, userIDToExclude: string | undefined = undefined)
    {
        for (const [userID, socketUserContext] of Object.entries(this.socketUserContexts))
        {
            if (userID != userIDToExclude)
                socketUserContext.addPendingSignalToUser(signalType, signalData);
        }
    }

    unicastSignal(signalType: string, signalData: EncodableData, targetUserID: string)
    {
        const socketUserContext = this.socketUserContexts[targetUserID];
        if (socketUserContext == undefined)
        {
            console.error(`SocketUserContext not found (targetUserID = ${targetUserID})`);
            return;
        }
        socketUserContext.addPendingSignalToUser(signalType, signalData);
    }

    addSocketUserContext(userID: string, socketUserContext: SocketUserContext)
    {
        if (this.socketUserContexts[userID] != undefined)
        {
            console.error(`SocketUserContext already exists (userID = ${userID})`);
            return;
        }
        this.socketUserContexts[userID] = socketUserContext;
    }

    removeSocketUserContext(userID: string)
    {
        if (this.socketUserContexts[userID] == undefined)
        {
            console.error(`SocketUserContext doesn't exist (userID = ${userID})`);
            return;
        }
        delete this.socketUserContexts[userID];
    }
}