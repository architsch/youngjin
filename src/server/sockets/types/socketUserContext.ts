import socketIO from "socket.io";
import EncodableData from "../../../shared/networking/types/encodableData";
import SignalTypeConfigMap from "../../../shared/networking/maps/signalTypeConfigMap";
import EncodableArray from "../../../shared/networking/types/encodableArray";
import EncodableRawByteNumber from "../../../shared/networking/types/encodableRawByteNumber";
import EncodingUtil from "../../../shared/networking/util/encodingUtil";

export default class SocketUserContext
{
    socket: socketIO.Socket;

    private pendingSignalsToUserByTypeIndex: Array<EncodableData[]>;
    private throttleTimestamps: {[signalType: string]: number} = {};

    constructor(socket: socketIO.Socket)
    {
        this.socket = socket;
        this.pendingSignalsToUserByTypeIndex = new Array<EncodableData[]>(SignalTypeConfigMap.getMaxIndex() + 1);
    }

    onReceivedSignalFromUser(signalType: string,
        handler: (buffer: ArrayBuffer) => void,
        throttleInterval: number = 0): void
    {
        this.socket.on(signalType, (buffer: ArrayBuffer) => {
            if (throttleInterval > 0)
            {
                const now = Date.now();
                const lastTime = this.throttleTimestamps[signalType];
                if (lastTime && now - lastTime < throttleInterval)
                    return;
                this.throttleTimestamps[signalType] = now;
            }
            handler(buffer);
        });
    }

    addPendingSignalToUser(signalType: string, signalData: EncodableData)
    {
        const typeIndex = SignalTypeConfigMap.getIndexByType(signalType);
        if (typeIndex == undefined)
        {
            console.error(`Failed to add the incoming signal. The signal's type is unknown (signalType = ${signalType})`);
            return;
        }

        let pendingSignals = this.pendingSignalsToUserByTypeIndex[typeIndex];
        if (pendingSignals == undefined)
        {
            pendingSignals = [];
            this.pendingSignalsToUserByTypeIndex[typeIndex] = pendingSignals;
        }
        pendingSignals.push(signalData);
    }

    tryUpdateLatestPendingSignalToUser(signalType: string, signalDataUpdateMethod: (signal: EncodableData) => void): boolean
    {
        const typeIndex = SignalTypeConfigMap.getIndexByType(signalType);
        if (typeIndex == undefined)
        {
            console.error(`Failed to add the incoming signal. The signal's type is unknown (signalType = ${signalType})`);
            return false;
        }

        let pendingSignals = this.pendingSignalsToUserByTypeIndex[typeIndex];
        if (pendingSignals == undefined)
            return false;

        const lastIndex = pendingSignals.length-1;
        if (lastIndex < 0)
            return false;
        
        signalDataUpdateMethod(pendingSignals[lastIndex]);
        return true;
    }

    processAllPendingSignalsToUser()
    {
        const bufferState = EncodingUtil.startEncoding();

        for (let typeIndex = 0; typeIndex < this.pendingSignalsToUserByTypeIndex.length; ++typeIndex)
        {
            const pendingSignals = this.pendingSignalsToUserByTypeIndex[typeIndex];
            if (pendingSignals && pendingSignals.length > 0)
            {
                //console.log(`preparing to send signal of type [${SignalTypeConfigMap.getConfigByIndex(typeIndex).signalType}] - length = ${pendingSignals.length}`);
                new EncodableRawByteNumber(typeIndex).encode(bufferState);
                new EncodableArray(pendingSignals, 65535).encode(bufferState);
                pendingSignals.length = 0;
            }
        }

        const subBuffer = EncodingUtil.endEncoding(bufferState);
        if (bufferState.byteIndex > 0)
        {
            //console.log(`signalBatch sent :: ${bufferState.byteIndex}`);
            this.socket.emit("signalBatch", subBuffer);
        }
    }
}