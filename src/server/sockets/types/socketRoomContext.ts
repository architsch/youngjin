import EncodableData from "../../../shared/networking/types/encodableData";
import UserContext from "./userContext";

export default class SocketRoomContext
{
    private socketUserContexts: {[userID: string]: UserContext};

    constructor()
    {
        this.socketUserContexts = {};
    }

    getUserContexts(): {[userID: string]: UserContext}
    {
        return this.socketUserContexts;
    }

    multicastSignal(signalType: string, signalData: EncodableData, userIDToExclude: string | undefined = undefined)
    {
        for (const userID in this.socketUserContexts)
        {
            if (userID != userIDToExclude)
                this.socketUserContexts[userID].addPendingSignalToUser(signalType, signalData);
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

    addSocketUserContext(userID: string, socketUserContext: UserContext)
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