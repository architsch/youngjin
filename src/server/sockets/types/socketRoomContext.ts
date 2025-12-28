import EncodableData from "../../../shared/networking/types/encodableData";
import SocketUserContext from "./socketUserContext";

export default class SocketRoomContext
{
    private socketUserContexts: {[userName: string]: SocketUserContext};

    constructor()
    {
        this.socketUserContexts = {};
    }

    getUserContexts(): {[userName: string]: SocketUserContext}
    {
        return this.socketUserContexts;
    }

    multicastSignal(signalType: string, signalData: EncodableData, userNameToExclude: string | undefined = undefined)
    {
        for (const [userName, socketUserContext] of Object.entries(this.socketUserContexts))
        {
            if (userName != userNameToExclude)
                socketUserContext.addPendingSignal(signalType, signalData);
        }
    }

    unicastSignal(signalType: string, signalData: EncodableData, targetUserName: string)
    {
        const socketUserContext = this.socketUserContexts[targetUserName];
        if (socketUserContext == undefined)
        {
            console.error(`SocketUserContext not found (targetUserName = ${targetUserName})`);
            return;
        }
        socketUserContext.addPendingSignal(signalType, signalData);
    }

    addSocketUserContext(userName: string, socketUserContext: SocketUserContext)
    {
        if (this.socketUserContexts[userName] != undefined)
        {
            console.error(`SocketUserContext already exists (userName = ${userName})`);
            return;
        }
        this.socketUserContexts[userName] = socketUserContext;
    }

    removeSocketUserContext(userName: string)
    {
        if (this.socketUserContexts[userName] == undefined)
        {
            console.error(`SocketUserContext doesn't exist (userName = ${userName})`);
            return;
        }
        delete this.socketUserContexts[userName];
    }
}