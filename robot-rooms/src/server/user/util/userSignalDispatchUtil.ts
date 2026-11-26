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
import BuyItemSignal from "../../../shared/inventory/types/buyItemSignal";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import ServerInventoryManager from "../../inventory/serverInventoryManager";
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
import SetObjectPathSignal from "../../../shared/object/types/setObjectPathSignal";
import InjectPetSignal from "../../../shared/object/types/injectPetSignal";
import PetServerUtil from "../../object/util/petServerUtil";
import PetPathServerUtil from "../../object/util/petPathServerUtil";
import PetPlayUtil from "../../object/util/petPlayUtil";

// Every signal a user may send, as it arrives over the wire, whoever sends it (a browser's socket or an AI agent),
// so both pass the same throttle, budgets, checks and milestones. A handler resolves to false for a signal it drops.

const handlers: {[signalType: string]: (ctx: UserContext, bufferState: BufferState) => boolean | Promise<boolean>} = {
    setObjectTransformSignal: (ctx, bufferState) => {
        const signal = SetObjectTransformSignal.decode(bufferState) as SetObjectTransformSignal;
        if (signal.shown)
            return false;
        // A placement of something put in the room is an edit; anything else moves the user's player.
        if (signal.ignorePhysics)
        {
            return edit(ctx, () => {
                ServerObjectManager.onSetObjectTransformSignalReceived(ctx, signal);
                PetPlayUtil.noteObjectEdit(ctx.user.id, "objectChanged", signal.objectId);
            }, () => ServerObjectManager.refuseSetObjectTransformSignal(ctx, signal));
        }
        if (!UserBudgetUtil.trySpend(ctx.user.id, "moves"))
            return false;
        ServerObjectManager.onSetObjectTransformSignalReceived(ctx, signal);
        return true;
    },
    userCommandSignal: async (ctx, bufferState) => {
        await UserCommandUtil.onUserCommandSignalReceived(ctx, UserCommandSignal.decode(bufferState) as UserCommandSignal);
        return true;
    },
    addVoxelBlockSignal: (ctx, bufferState) => {
        const signal = AddVoxelBlockSignal.decode(bufferState) as AddVoxelBlockSignal;
        return edit(ctx, () => {
            ServerVoxelManager.onAddVoxelBlockSignalReceived(ctx, signal);
            PetPlayUtil.noteBlockEdit(ctx.user.id, "blockAdded", signal.quadIndex);
        }, () => ServerVoxelManager.refuseAddVoxelBlockSignal(ctx, signal));
    },
    moveVoxelBlockSignal: (ctx, bufferState) => {
        const signal = MoveVoxelBlockSignal.decode(bufferState) as MoveVoxelBlockSignal;
        return edit(ctx, () => {
            ServerVoxelManager.onMoveVoxelBlockSignalReceived(ctx, signal);
            PetPlayUtil.noteBlockEdit(ctx.user.id, "blockAdded", signal.quadIndex);
        }, () => ServerVoxelManager.refuseMoveVoxelBlockSignal(ctx, signal));
    },
    removeVoxelBlockSignal: (ctx, bufferState) => {
        const signal = RemoveVoxelBlockSignal.decode(bufferState) as RemoveVoxelBlockSignal;
        return edit(ctx, () => {
            ServerVoxelManager.onRemoveVoxelBlockSignalReceived(ctx, signal);
            PetPlayUtil.noteBlockEdit(ctx.user.id, "blockRemoved", signal.quadIndex);
        }, () => ServerVoxelManager.refuseRemoveVoxelBlockSignal(ctx, signal));
    },
    setVoxelQuadTextureSignal: (ctx, bufferState) => {
        const signal = SetVoxelQuadTextureSignal.decode(bufferState) as SetVoxelQuadTextureSignal;
        return edit(ctx, () => ServerVoxelManager.onSetVoxelQuadTextureSignalReceived(ctx, signal),
            () => ServerVoxelManager.refuseSetVoxelQuadTextureSignal(ctx, signal));
    },
    addObjectSignal: (ctx, bufferState) => {
        const signal = AddObjectSignal.decode(bufferState) as AddObjectSignal;
        // A pet coming into the room after its owner is their browser's doing, not something they built.
        if (PetServerUtil.isComingIn(ctx, signal))
        {
            return tellOfPet(ctx, () => ServerObjectManager.onAddObjectSignalReceived(ctx, signal),
                () => ServerObjectManager.refuseAddObjectSignal(ctx, signal));
        }
        return edit(ctx, () => {
            if (ServerObjectManager.onAddObjectSignalReceived(ctx, signal))
                PetPlayUtil.noteObjectEdit(ctx.user.id, "objectAdded", signal.objectId);
        }, () => ServerObjectManager.refuseAddObjectSignal(ctx, signal));
    },
    removeObjectSignal: (ctx, bufferState) => {
        const signal = RemoveObjectSignal.decode(bufferState) as RemoveObjectSignal;
        return edit(ctx, () => {
            // Noted first, the object being what says where it happened.
            PetPlayUtil.noteObjectEdit(ctx.user.id, "objectRemoved", signal.objectId);
            ServerObjectManager.onRemoveObjectSignalReceived(ctx, signal);
        }, () => ServerObjectManager.refuseRemoveObjectSignal(ctx, signal));
    },
    setObjectMetadataSignal: (ctx, bufferState) => {
        const signal = SetObjectMetadataSignal.decode(bufferState) as SetObjectMetadataSignal;
        // What a browser tells of a pet it plays arrives on this signal too (what the pet shows and says, how the
        // user's pets are), and is neither an edit nor the user's speech.
        if (PetServerUtil.isWordOfPet(ctx, signal))
        {
            return tellOfPet(ctx, () => ServerObjectManager.onSetObjectMetadataSignalReceived(ctx, signal),
                () => ServerObjectManager.refuseSetObjectMetadataSignal(ctx, signal));
        }
        // What the user is busy with arrives on this signal too (Activity metadata), and is neither an edit nor speech.
        if (signal.metadataKey == ObjectMetadataKeyEnumMap.Activity)
        {
            if (!UserBudgetUtil.trySpend(ctx.user.id, "activityChanges"))
                return false;
            ServerObjectManager.onSetObjectMetadataSignalReceived(ctx, signal);
            HelperAgentUtil.noteTyping(ctx);
            return true;
        }
        // Chat arrives on this signal too (SentMessage metadata), so it's counted as speech rather than an edit.
        if (signal.metadataKey != ObjectMetadataKeyEnumMap.SentMessage)
        {
            return edit(ctx, () => {
                if (ServerObjectManager.onSetObjectMetadataSignalReceived(ctx, signal))
                    PetPlayUtil.noteObjectEdit(ctx.user.id, "objectChanged", signal.objectId);
            }, () => ServerObjectManager.refuseSetObjectMetadataSignal(ctx, signal));
        }
        EditRateLogUtil.note(ctx.user.id, "speech");
        if (!UserBudgetUtil.trySpend(ctx.user.id, "speech"))
            return false;
        if (ServerObjectManager.onSetObjectMetadataSignalReceived(ctx, signal))
            PlayerMessageExpiryUtil.noteMessage(ctx.user.id);
        ServerAnalyticsManager.recordMilestone(ctx.user.id, FunnelMilestoneEnumMap.Chatted, ctx);
        HelperAgentUtil.hear(ctx.user.id, signal);
        PetPlayUtil.hear(ctx.user.id, signal.metadataValue);
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
    buyItemSignal: async (ctx, bufferState) => {
        await ServerInventoryManager.buyItem(ctx, (BuyItemSignal.decode(bufferState) as BuyItemSignal).itemType);
        return true;
    },
    setObjectPathSignal: (ctx, bufferState) => {
        const signal = SetObjectPathSignal.decode(bufferState) as SetObjectPathSignal;
        return tellOfPet(ctx, () => PetPathServerUtil.onSetObjectPathSignalReceived(ctx, signal));
    },
    // Paid for in dollars as it is done, and from the edit budget, though it builds nothing.
    injectPetSignal: (ctx, bufferState) => {
        const signal = InjectPetSignal.decode(bufferState) as InjectPetSignal;
        return UserBudgetUtil.trySpend(ctx.user.id, "edit") && PetServerUtil.onInjectPetSignalReceived(ctx, signal);
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

// An edit is paid for from the user's edit budget. One it can't pay for is refused, and answered as one refused by its
// own checks is (refuse), since a browser has applied it already: left unanswered, its room would part from the stored
// one until it came in again. Counted either way (see EditRateLogUtil). One handled records the Built milestone; only
// the first reaches the DB (session cache), not awaited, and it never rejects.
function edit(ctx: UserContext, handle: () => void, refuse: () => void): boolean
{
    EditRateLogUtil.note(ctx.user.id, "edit");
    if (!UserBudgetUtil.trySpend(ctx.user.id, "edit"))
    {
        refuse();
        return false;
    }
    handle();
    ServerAnalyticsManager.recordMilestone(ctx.user.id, FunnelMilestoneEnumMap.Built, ctx);
    return true;
}

// What a browser tells of a pet it plays is paid for from a budget of its own, and is no edit of the user's: it counts
// toward nothing they did. One it can't pay for is answered as a refused edit is, where the browser has applied it.
function tellOfPet(ctx: UserContext, handle: () => void, refuse?: () => void): boolean
{
    if (!UserBudgetUtil.trySpend(ctx.user.id, "petSignals"))
    {
        refuse?.();
        return false;
    }
    handle();
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
