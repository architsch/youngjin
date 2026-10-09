import socketIO from "socket.io";
import zlib from "zlib";
import User from "../../../shared/user/types/user";
import EncodableData from "../../../shared/networking/types/encodableData";
import SignalTypeConfigMap from "../../../shared/networking/maps/signalTypeConfigMap";
import EncodableArray from "../../../shared/networking/types/encodableArray";
import EncodableRawByteNumber from "../../../shared/networking/types/encodableRawByteNumber";
import EncodingUtil from "../../../shared/networking/util/encodingUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import { SIGNAL_BATCH_DEFLATE_MIN_BYTES } from "../../system/serverConstants";

export default class SocketUserContext
{
    socket: socketIO.Socket;
    user: User;
    isInSinglePlayerRoom: boolean = false;

    // Recorded funnel milestones from the authenticated row, so analytics can skip DB reads on the
    // edit path. Not on User, which is serialized to the browser. Kept in sync by
    // ServerAnalyticsManager.
    funnel: string;

    // What the next batch will carry, in the order queued, as runs of one type each. The order is kept across
    // types: a client that undoes an edit and redoes it sends a removal and then an add of the same thing, and
    // the others must hear of them that way round.
    private pendingSignalRunsToUser: {typeIndex: number, signals: EncodableData[]}[] = [];
    private throttleTimestamps: {[signalType: string]: number} = {};

    constructor(socket: socketIO.Socket)
    {
        this.socket = socket;
        this.user = socket.handshake.auth.user as User;
        this.funnel = (socket.handshake.auth.funnel as string) ?? "";
    }

    onReceivedSignalFromUser(signalType: string, handler: (buffer: ArrayBuffer) => void): void
    {
        const minClientToServerSendInterval = SignalTypeConfigMap.getConfigByType(signalType).minClientToServerSendInterval;

        this.socket.on(signalType, (buffer: ArrayBuffer) => {
            if (minClientToServerSendInterval > 0)
            {
                const now = Date.now();
                const lastTime = this.throttleTimestamps[signalType];
                if (lastTime && now - lastTime < minClientToServerSendInterval)
                    return;
                this.throttleTimestamps[signalType] = now;
            }
            try {
                handler(buffer);
            } catch (err) {
                console.error(`Exception while handling '${signalType}' from user (ID: ${this.user.id}, Name: ${this.user.userName}) :: Error: ${ErrorUtil.getErrorMessage(err)}`);
            }
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

        const latestRun = this.pendingSignalRunsToUser[this.pendingSignalRunsToUser.length - 1];
        if (latestRun != undefined && latestRun.typeIndex == typeIndex)
            latestRun.signals.push(signalData);
        else
            this.pendingSignalRunsToUser.push({typeIndex, signals: [signalData]});
    }

    tryUpdateLatestPendingSignalToUser(signalType: string, signalDataUpdateMethod: (signal: EncodableData) => void): boolean
    {
        const typeIndex = SignalTypeConfigMap.getIndexByType(signalType);
        if (typeIndex == undefined)
        {
            console.error(`Failed to add the incoming signal. The signal's type is unknown (signalType = ${signalType})`);
            return false;
        }

        // (The latest one queued of that type.)
        for (let i = this.pendingSignalRunsToUser.length - 1; i >= 0; --i)
        {
            const run = this.pendingSignalRunsToUser[i];
            if (run.typeIndex == typeIndex)
            {
                signalDataUpdateMethod(run.signals[run.signals.length - 1]);
                return true;
            }
        }
        return false;
    }

    // Drops what is queued, for when the signal queued next replaces all of it (see
    // ServerRoomManager.loadRoomFile).
    clearAllPendingSignalsToUser()
    {
        this.pendingSignalRunsToUser.length = 0;
    }

    processAllPendingSignalsToUser()
    {
        const bufferState = EncodingUtil.startEncoding();

        for (const run of this.pendingSignalRunsToUser)
        {
            //console.log(`preparing to send signal of type [${SignalTypeConfigMap.getConfigByIndex(run.typeIndex).signalType}] - length = ${run.signals.length}`);
            new EncodableRawByteNumber(run.typeIndex).encode(bufferState);
            new EncodableArray(run.signals, 65535).encode(bufferState);
        }
        this.pendingSignalRunsToUser.length = 0;

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