import socketIO from "socket.io";
import EncodableData from "../../../shared/networking/types/encodableData";
import SignalTypeConfigMap from "../../../shared/networking/maps/signalTypeConfigMap";
import EncodableArray from "../../../shared/networking/types/encodableArray";
import EncodableRawByteNumber from "../../../shared/networking/types/encodableRawByteNumber";
import Encoding from "../../../shared/networking/encoding";

export default class SocketUserContext
{
    socket: socketIO.Socket;

    private pendingSignalsByTypeIndex: Array<EncodableData[]>;

    constructor(socket: socketIO.Socket)
    {
        this.socket = socket;
        this.pendingSignalsByTypeIndex = new Array<EncodableData[]>(SignalTypeConfigMap.getMaxIndex() + 1);
    }

    addPendingSignal(signalType: string, signalData: EncodableData)
    {
        const typeIndex = SignalTypeConfigMap.getIndexByType(signalType);
        if (typeIndex == undefined)
        {
            console.error(`Failed to add the incoming signal. The signal's type is unknown (signalType = ${signalType})`);
            return;
        }

        let pendingSignals = this.pendingSignalsByTypeIndex[typeIndex];
        if (pendingSignals == undefined)
        {
            pendingSignals = [];
            this.pendingSignalsByTypeIndex[typeIndex] = pendingSignals;
        }
        pendingSignals.push(signalData);
    }

    tryUpdateLatestPendingSignal(signalType: string, signalDataUpdateMethod: (signal: EncodableData) => void): boolean
    {
        const typeIndex = SignalTypeConfigMap.getIndexByType(signalType);
        if (typeIndex == undefined)
        {
            console.error(`Failed to add the incoming signal. The signal's type is unknown (signalType = ${signalType})`);
            return false;
        }

        let pendingSignals = this.pendingSignalsByTypeIndex[typeIndex];
        if (pendingSignals == undefined)
            return false;

        const lastIndex = pendingSignals.length-1;
        if (lastIndex < 0)
            return false;
        
        signalDataUpdateMethod(pendingSignals[lastIndex]);
        return true;
    }

    processAllPendingSignals()
    {
        const bufferState = Encoding.startWrite();

        for (let typeIndex = 0; typeIndex < this.pendingSignalsByTypeIndex.length; ++typeIndex)
        {
            const pendingSignals = this.pendingSignalsByTypeIndex[typeIndex];
            if (pendingSignals && pendingSignals.length > 0)
            {
                //console.log(`preparing to send signal of type [${SignalTypeConfigMap.getConfigByIndex(typeIndex).signalType}] - length = ${pendingSignals.length}`);
                new EncodableRawByteNumber(typeIndex).encode(bufferState);
                new EncodableArray(pendingSignals, 65535).encode(bufferState);
                pendingSignals.length = 0;
            }
        }

        const subBuffer = Encoding.endWrite(bufferState);
        if (bufferState.byteIndex > 0)
        {
            //console.log(`signalBatch sent :: ${bufferState.byteIndex}`);
            this.socket.emit("signalBatch", subBuffer);
        }
    }
}