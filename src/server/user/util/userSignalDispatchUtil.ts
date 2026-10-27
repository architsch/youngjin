import UserContext from "../../sockets/types/userContext";
import BufferState from "../../../shared/networking/types/bufferState";
import SignalTypeConfigMap from "../../../shared/networking/maps/signalTypeConfigMap";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import AddVoxelBlockSignal from "../../../shared/voxel/types/update/addVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../../shared/voxel/types/update/moveVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import UserCommandSignal from "../../../shared/user/types/userCommandSignal";
import RequestRoomChangeSignal from "../../../shared/room/types/requestRoomChangeSignal";
import HoldObjectSignal from "../../../shared/object/types/holdObjectSignal";
import TypingSignal from "../../../shared/user/types/typingSignal";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import ServerObjectManager from "../../object/serverObjectManager";
import ServerVoxelManager from "../../voxel/serverVoxelManager";
import ServerRoomManager from "../../room/serverRoomManager";
import ServerAnalyticsManager from "../../analytics/serverAnalyticsManager";
import { FunnelMilestoneEnumMap } from "../../analytics/types/funnelMilestone";
import UserCommandUtil from "./userCommandUtil";
import EditRateLogUtil from "./editRateLogUtil";
import UserBudgetUtil from "./userBudgetUtil";
import PlayerMessageExpiryUtil from "./playerMessageExpiryUtil";
import HelperAgentUtil from "../../agent/util/helperAgentUtil";

// Every signal a user may send, as it arrives over the wire, whoever sends it (a browser's socket or an AI agent),
// so both pass the same throttle, budgets, checks and milestones. A handler resolves to false for a signal it drops.

const handlers: {[signalType: string]: (ctx: UserContext, bufferState: BufferState) => boolean | Promise<boolean>} = {
    setObjectTransformSignal: (ctx, bufferState) => {
        const signal = SetObjectTransformSignal.decode(bufferState) as SetObjectTransformSignal;
        if (signal.shown)
            return false;
        // A placement of something put in the room is an edit; anything else moves the user's player.
        if (signal.ignorePhysics)
            return edit(ctx, () => ServerObjectManager.onSetObjectTransformSignalReceived(ctx, signal));
        if (!UserBudgetUtil.trySpend(ctx.user.id, "moves"))
            return false;
        ServerObjectManager.onSetObjectTransformSignalReceived(ctx, signal);
        return true;
    },
    userCommandSignal: async (ctx, bufferState) => {
        await UserCommandUtil.onUserCommandSignalReceived(ctx.user, UserCommandSignal.decode(bufferState) as UserCommandSignal);
        return true;
    },
    addVoxelBlockSignal: (ctx, bufferState) => edit(ctx, () =>
        ServerVoxelManager.onAddVoxelBlockSignalReceived(ctx, AddVoxelBlockSignal.decode(bufferState) as AddVoxelBlockSignal)),
    moveVoxelBlockSignal: (ctx, bufferState) => edit(ctx, () =>
        ServerVoxelManager.onMoveVoxelBlockSignalReceived(ctx, MoveVoxelBlockSignal.decode(bufferState) as MoveVoxelBlockSignal)),
    removeVoxelBlockSignal: (ctx, bufferState) => edit(ctx, () =>
        ServerVoxelManager.onRemoveVoxelBlockSignalReceived(ctx, RemoveVoxelBlockSignal.decode(bufferState) as RemoveVoxelBlockSignal)),
    setVoxelQuadTextureSignal: (ctx, bufferState) => edit(ctx, () =>
        ServerVoxelManager.onSetVoxelQuadTextureSignalReceived(ctx, SetVoxelQuadTextureSignal.decode(bufferState) as SetVoxelQuadTextureSignal)),
    addObjectSignal: (ctx, bufferState) => edit(ctx, () =>
        ServerObjectManager.onAddObjectSignalReceived(ctx, AddObjectSignal.decode(bufferState) as AddObjectSignal)),
    removeObjectSignal: (ctx, bufferState) => edit(ctx, () =>
        ServerObjectManager.onRemoveObjectSignalReceived(ctx, RemoveObjectSignal.decode(bufferState) as RemoveObjectSignal)),
    setObjectMetadataSignal: (ctx, bufferState) => {
        const signal = SetObjectMetadataSignal.decode(bufferState) as SetObjectMetadataSignal;
        // A switch of mode arrives on this signal too (Editing metadata), and is neither an edit nor speech.
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.Editing)
        {
            if (!UserBudgetUtil.trySpend(ctx.user.id, "modeSwitches"))
                return false;
            ServerObjectManager.onSetObjectMetadataSignalReceived(ctx, signal);
            return true;
        }
        // Chat arrives on this signal too (SentMessage metadata), so it's counted as speech rather than an edit.
        if (signal.metadataKey != ObjectMetadataKeyEnumMap.SentMessage)
            return edit(ctx, () => ServerObjectManager.onSetObjectMetadataSignalReceived(ctx, signal));
        EditRateLogUtil.note(ctx.user.id, "speech");
        if (!UserBudgetUtil.trySpend(ctx.user.id, "speech"))
            return false;
        if (ServerObjectManager.onSetObjectMetadataSignalReceived(ctx, signal))
            PlayerMessageExpiryUtil.noteMessage(ctx.user.id);
        ServerAnalyticsManager.recordMilestone(ctx.user.id, FunnelMilestoneEnumMap.Chatted, ctx);
        HelperAgentUtil.hear(ctx.user.id, signal);
        return true;
    },
    requestRoomChangeSignal: async (ctx, bufferState) => {
        await ServerRoomManager.onRequestRoomChangeSignalReceived(ctx,
            RequestRoomChangeSignal.decode(bufferState) as RequestRoomChangeSignal);
        return true;
    },
    holdObjectSignal: async (ctx, bufferState) => {
        HelperAgentUtil.hold(ctx, HoldObjectSignal.decode(bufferState) as HoldObjectSignal);
        return true;
    },
    typingSignal: (ctx, bufferState) => {
        HelperAgentUtil.noteTyping(ctx, TypingSignal.decode(bufferState) as TypingSignal);
        return true;
    },
};

const UserSignalDispatchUtil =
{
    signalTypes: Object.keys(handlers),
    // Resolves once the signal is handled, to false if it was dropped instead (throttled, past its budget, or of no
    // known type). Never rejects.
    dispatch: async (ctx: UserContext, signalType: string, buffer: ArrayBuffer): Promise<boolean> =>
    {
        const handler = handlers[signalType];
        if (handler == undefined)
        {
            console.error(`UserSignalDispatchUtil.dispatch :: No handler (signalType = ${signalType}, userID = ${ctx.user.id})`);
            return false;
        }
        if (isThrottled(ctx, signalType))
            return false;

        try
        {
            return await handler(ctx, new BufferState(new Uint8Array(buffer)));
        }
        catch (err)
        {
            console.error(`Exception while handling '${signalType}' from user (ID: ${ctx.user.id}, Name: ${ctx.user.userName}) :: Error: ${ErrorUtil.getErrorMessage(err)}`);
        }
        return true;
    },
}

// An edit is paid for from the user's edit budget, and dropped if it can't be: unanswered, as a throttled signal is,
// since only a script edits that fast. Counted either way (see EditRateLogUtil). One handled records the Built
// milestone; only the first reaches the DB (session cache), not awaited, and it never rejects.
function edit(ctx: UserContext, handle: () => void): boolean
{
    EditRateLogUtil.note(ctx.user.id, "edit");
    if (!UserBudgetUtil.trySpend(ctx.user.id, "edit"))
        return false;
    handle();
    ServerAnalyticsManager.recordMilestone(ctx.user.id, FunnelMilestoneEnumMap.Built, ctx);
    return true;
}

function isThrottled(ctx: UserContext, signalType: string): boolean
{
    const minInterval = SignalTypeConfigMap.getConfigByType(signalType).minClientToServerSendInterval;
    if (minInterval <= 0)
        return false;

    const now = Date.now();
    const lastTime = ctx.signalThrottleTimestamps[signalType];
    if (lastTime && now - lastTime < minInterval)
        return true;
    ctx.signalThrottleTimestamps[signalType] = now;
    return false;
}

export default UserSignalDispatchUtil;
