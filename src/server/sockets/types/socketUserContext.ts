import socketIO from "socket.io";

export default class SocketUserContext
{
    socket: socketIO.Socket;

    private incomingSignalsByType: {[type: string]: any};

    constructor(socket: socketIO.Socket)
    {
        this.socket = socket;
        this.incomingSignalsByType = {};
    }

    addIncomingSignal(signalType: string, signalData: any)
    {
        let incomingSignals = this.incomingSignalsByType[signalType];
        if (incomingSignals == undefined)
        {
            incomingSignals = [];
            this.incomingSignalsByType[signalType] = incomingSignals;
        }
        incomingSignals.push(signalData);
    }

    processAllIncomingSignals()
    {
        for (const [signalType, incomingSignals] of Object.entries(this.incomingSignalsByType))
        {
            this.socket.emit(signalType, incomingSignals);
            incomingSignals.length = 0;
        }
    }
}