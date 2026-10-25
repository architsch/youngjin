import EncodableData from "../../../shared/networking/types/encodableData";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import RoomChangedSignal from "../../../shared/room/types/roomChangedSignal";
import RoomChangeRejectedSignal from "../../../shared/room/types/roomChangeRejectedSignal";
import { RoomChangeRejectionReasonEnumMap } from "../../../shared/room/types/roomChangeRejectionReason";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import VolumeObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import NpcObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/npcObjectTypeConfig";
import LabelTextUtil from "../../../shared/object/util/labelTextUtil";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
import AddVoxelBlockSignal from "../../../shared/voxel/types/update/addVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../../shared/voxel/types/update/moveVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import { AGENT_INBOX_MAX_EVENTS } from "../../system/serverConstants";
import AgentEvent from "./agentEvent";

// The signals that tell of an edit: someone else's, or the server's answer to a refused edit of the agent's own.
const EDIT_SIGNAL_TYPES = ["addVoxelBlockSignal", "removeVoxelBlockSignal", "moveVoxelBlockSignal",
    "setVoxelQuadTextureSignal", "addObjectSignal", "removeObjectSignal", "setObjectMetadataSignal",
    "setObjectTransformSignal"];

// What happened around an agent since it last asked, made from the signals a browser would have been sent.
// Only small facts are copied: a queued signal is shared with other users, and a room snapshot is the live room.
// Others' edits run together, one after another, as an event a person would take in at a glance.
export default class AgentInbox
{
    // Set while the agent's own edit is handled: any edit it is sent meanwhile is the server's answer to it, which
    // the tool that made the edit reports (see AgentSignalUtil).
    muted: boolean = false;

    private readonly userID: string;
    private events: AgentEvent[] = [];
    // Players in the agent's room by object id, so that a departure is still named once its player is gone. A ghost
    // (see AdminPrefsUtil.isGhost) comes, goes, speaks and places things unseen.
    private playerByObjectId: {[objectId: string]: {userID: string, name: string, isAgent: boolean, ghost: boolean}} = {};
    // What every other object in the room is, likewise.
    private objectTypeById: {[objectId: string]: string} = {};
    // The helpers' names (see HelperAgentUtil): every NPC in a room an agent can be in is one.
    private helperNameById: {[objectId: string]: string} = {};

    constructor(userID: string)
    {
        this.userID = userID;
    }

    note(signalType: string, signalData: EncodableData): void
    {
        if (this.muted && EDIT_SIGNAL_TYPES.includes(signalType))
            return;
        switch (signalType)
        {
            case "roomChangedSignal":
            {
                const room = (signalData as RoomChangedSignal).roomRuntimeMemory.room;
                this.playerByObjectId = {};
                this.objectTypeById = {};
                this.helperNameById = {};
                for (const obj of Object.values(room.objectById))
                    this.noteObject(obj);
                this.push({kind: "roomEntered", roomID: room.id});
                break;
            }
            case "roomChangeRejectedSignal":
            {
                const reason = (signalData as RoomChangeRejectedSignal).reason;
                this.push({kind: "roomChangeRefused", reason: Object.keys(RoomChangeRejectionReasonEnumMap)
                    .find(name => RoomChangeRejectionReasonEnumMap[name] == reason) ?? "Unknown"});
                break;
            }
            case "addObjectSignal":
            {
                const obj = signalData as AddObjectSignal;
                this.noteObject(obj);
                const player = this.playerByObjectId[obj.objectId];
                const type = this.objectTypeById[obj.objectId];
                if (player)
                {
                    if (!player.ghost)
                        this.push({kind: "arrival", who: player.name, whoIsAgent: player.isAgent});
                }
                else if (type)
                {
                    const unseen = Object.values(this.playerByObjectId)
                        .some(placer => placer.userID == obj.sourceUserID && placer.ghost);
                    this.push({kind: "objectAdded", id: obj.objectId, type,
                        who: (unseen || obj.sourceUserName.length == 0) ? undefined : obj.sourceUserName,
                        whoIsAgent: unseen ? undefined : this.isAgentNamed(obj.sourceUserName)});
                }
                break;
            }
            case "removeObjectSignal":
            {
                const objectId = (signalData as RemoveObjectSignal).objectId;
                const player = this.playerByObjectId[objectId];
                const type = this.objectTypeById[objectId];
                if (player)
                {
                    delete this.playerByObjectId[objectId];
                    if (!player.ghost)
                        this.push({kind: "departure", who: player.name, whoIsAgent: player.isAgent});
                }
                else if (type)
                {
                    delete this.objectTypeById[objectId];
                    delete this.helperNameById[objectId];
                    this.push({kind: "objectRemoved", id: objectId, type});
                }
                break;
            }
            case "setObjectMetadataSignal":
            {
                const signal = signalData as SetObjectMetadataSignal;
                const player = this.playerByObjectId[signal.objectId];
                const helperName = this.helperNameById[signal.objectId];
                const text = signal.metadataValue.trim();
                const isSpeech = signal.metadataKey == ObjectMetadataKeyEnumMap.SentMessage;
                if (player && signal.metadataKey == ObjectMetadataKeyEnumMap.AdminPrefs)
                    player.ghost = AdminPrefsUtil.decode(signal.metadataValue).ghostMode;
                else if (player && isSpeech && text.length > 0)
                {
                    if (!player.ghost)
                        this.push({kind: "speech", who: player.name, whoIsAgent: player.isAgent, text});
                }
                else if (helperName != undefined)
                {
                    // A helper's speech, or a new name; which way it faces is its own doing, not anyone's edit.
                    if (isSpeech && text.length > 0)
                        this.push({kind: "speech", who: helperName, whoIsAgent: true, text});
                    else if (signal.metadataKey == ObjectMetadataKeyEnumMap.Label)
                        this.helperNameById[signal.objectId] = LabelTextUtil.toName(signal.metadataValue);
                }
                else
                    this.noteObjectChange(signal.objectId);
                break;
            }
            case "setObjectTransformSignal":
            {
                // A helper walks of its own accord.
                const objectId = (signalData as SetObjectTransformSignal).objectId;
                if (this.helperNameById[objectId] == undefined)
                    this.noteObjectChange(objectId);
                break;
            }
            case "addVoxelBlockSignal":
                this.noteBlocks("placed", [(signalData as AddVoxelBlockSignal).quadIndex]);
                break;
            case "removeVoxelBlockSignal":
                this.noteBlocks("removed", [(signalData as RemoveVoxelBlockSignal).quadIndex]);
                break;
            case "moveVoxelBlockSignal":
            {
                const signal = signalData as MoveVoxelBlockSignal;
                const target = VoxelQueryUtil.getVoxelQuadIndex(
                    VoxelQueryUtil.getVoxelRowFromQuadIndex(signal.quadIndex) + signal.rowOffset,
                    VoxelQueryUtil.getVoxelColFromQuadIndex(signal.quadIndex) + signal.colOffset, "y", "-",
                    VoxelQueryUtil.getVoxelQuadCollisionLayerAfterOffset(signal.quadIndex, signal.collisionLayerOffset));
                this.noteBlocks("moved", [signal.quadIndex, target]);
                break;
            }
            case "setVoxelQuadTextureSignal":
                this.noteBlocks("painted", [(signalData as SetVoxelQuadTextureSignal).quadIndex]);
                break;
        }
    }

    noteRoomReloading(): void
    {
        this.push({kind: "roomReloading"});
    }

    take(): AgentEvent[]
    {
        const events = this.events;
        this.events = [];
        return events;
    }

    // Events from elsewhere: what happened in the agent's own room without it (see AgentAwayLogUtil).
    receive(events: AgentEvent[]): void
    {
        this.events.push(...events);
        if (this.events.length > AGENT_INBOX_MAX_EVENTS)
            this.events.splice(0, this.events.length - AGENT_INBOX_MAX_EVENTS);
    }

    // Records another user's player, or what any other object is (a zone, for a volume).
    private noteObject(obj: AddObjectSignal): void
    {
        const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
        if (config.objectType == "Player")
        {
            if (obj.sourceUserID != this.userID)
            {
                this.playerByObjectId[obj.objectId] = {userID: obj.sourceUserID, name: obj.sourceUserName,
                    isAgent: (obj.metadata[ObjectMetadataKeyEnumMap.AgentMark]?.str ?? "").length > 0,
                    ghost: AdminPrefsUtil.isGhost(obj)};
            }
        }
        else
        {
            this.objectTypeById[obj.objectId] = (config == VolumeObjectTypeConfig) ? "zone" : config.objectType.toLowerCase();
            if (config == NpcObjectTypeConfig)
                this.helperNameById[obj.objectId] = LabelTextUtil.toName(LabelTextUtil.getText(obj));
        }
    }

    // Whether a player of the room by that name is an agent, as far as can be told.
    private isAgentNamed(name: string): boolean | undefined
    {
        return Object.values(this.playerByObjectId).find(player => player.name == name)?.isAgent;
    }

    // Changes to one object one after another are one change.
    private noteObjectChange(objectId: string): void
    {
        const type = this.objectTypeById[objectId];
        if (type == undefined)
            return;
        const last = this.events[this.events.length - 1];
        if (last?.kind == "objectChanged" && last.id == objectId)
            last.at = Date.now();
        else
            this.push({kind: "objectChanged", id: objectId, type});
    }

    private noteBlocks(count: "placed" | "removed" | "moved" | "painted", quadIndices: number[]): void
    {
        let last = this.events[this.events.length - 1];
        if (last?.kind == "blocksChanged")
            last.at = Date.now();
        else
            last = this.push({kind: "blocksChanged"});
        last[count] = (last[count] ?? 0) + 1;
        for (const quadIndex of quadIndices.filter(quadIndex => VoxelQueryUtil.isValidVoxelQuadIndex(quadIndex)))
        {
            last.rows = widen(last.rows, VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex));
            last.columns = widen(last.columns, VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex));
            last.layers = widen(last.layers, VoxelQueryUtil.getVoxelBlockCollisionLayerFromQuadIndex(quadIndex));
        }
    }

    private push(event: Omit<AgentEvent, "at">): AgentEvent
    {
        const pushed = {at: Date.now(), ...event};
        this.events.push(pushed);
        if (this.events.length > AGENT_INBOX_MAX_EVENTS)
            this.events.shift();
        return pushed;
    }
}

// [from, to] stretched to take a value in.
function widen(span: number[] | undefined, value: number): number[]
{
    return (span == undefined) ? [value, value] : [Math.min(span[0], value), Math.max(span[1], value)];
}
