import socketIO from "socket.io";
import zlib from "zlib";
import EncodableData from "../../../shared/networking/types/encodableData";
import SignalTypeConfigMap from "../../../shared/networking/maps/signalTypeConfigMap";
import EncodableArray from "../../../shared/networking/types/encodableArray";
import EncodableRawByteNumber from "../../../shared/networking/types/encodableRawByteNumber";
import EncodingUtil from "../../../shared/networking/util/encodingUtil";
import { SIGNAL_BATCH_DEFLATE_MIN_BYTES } from "../../system/serverConstants";

// The signals waiting to go to one socket, sent as one batch at each flush (see SocketsServer).
export default class SocketSignalQueue
{
    readonly socket: socketIO.Socket;

    // What the next batch will carry, in the order queued, as runs of one type each. The order is kept across
    // types: a client that undoes an edit and redoes it sends a removal and then an add of the same thing, and
    // the others must hear of them that way round.
    private runs: {typeIndex: number, signals: EncodableData[]}[] = [];

    constructor(socket: socketIO.Socket)
    {
        this.socket = socket;
    }

    add(signalType: string, signalData: EncodableData): void
    {
        const typeIndex = SignalTypeConfigMap.getIndexByType(signalType);
        if (typeIndex == undefined)
        {
            console.error(`Failed to add the incoming signal. The signal's type is unknown (signalType = ${signalType})`);
            return;
        }

        const latestRun = this.runs[this.runs.length - 1];
        if (latestRun != undefined && latestRun.typeIndex == typeIndex)
            latestRun.signals.push(signalData);
        else
            this.runs.push({typeIndex, signals: [signalData]});
    }

    // Changes the latest one queued of that type; false if there is none.
    updateLatest(signalType: string, signalDataUpdateMethod: (signal: EncodableData) => void): boolean
    {
        const typeIndex = SignalTypeConfigMap.getIndexByType(signalType);
        if (typeIndex == undefined)
        {
            console.error(`Failed to add the incoming signal. The signal's type is unknown (signalType = ${signalType})`);
            return false;
        }

        for (let i = this.runs.length - 1; i >= 0; --i)
        {
            const run = this.runs[i];
            if (run.typeIndex == typeIndex)
            {
                signalDataUpdateMethod(run.signals[run.signals.length - 1]);
                return true;
            }
        }
        return false;
    }

    clear(): void
    {
        this.runs.length = 0;
    }

    flush(): void
    {
        const bufferState = EncodingUtil.startEncoding();

        for (const run of this.runs)
        {
            //console.log(`preparing to send signal of type [${SignalTypeConfigMap.getConfigByIndex(run.typeIndex).signalType}] - length = ${run.signals.length}`);
            new EncodableRawByteNumber(run.typeIndex).encode(bufferState);
            new EncodableArray(run.signals, 65535).encode(bufferState);
        }
        this.runs.length = 0;

        const subBuffer = EncodingUtil.endEncoding(bufferState);
        if (bufferState.byteIndex > 0)
        {
            //console.log(`signalBatch sent :: ${bufferState.byteIndex}`);
            // A long batch (a whole room, or a crowd's movements) goes out deflated. The fastest level,
            // since everyone in a room may be sent it in one flush.
            if (subBuffer.byteLength >= SIGNAL_BATCH_DEFLATE_MIN_BYTES)
                this.socket.emit("deflatedSignalBatch", zlib.deflateRawSync(subBuffer, {level: zlib.constants.Z_BEST_SPEED}));
            else
                this.socket.emit("signalBatch", subBuffer);
        }
    }
}
