import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import ClientObjectManager from "../../object/clientObjectManager";
import ObjectFactory from "../../object/factories/objectFactory";
import ClientVoxelManager from "../../voxel/clientVoxelManager";
import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";
import { manualSelectionObservable, objectSelectionObservable, orbitCameraAngleHoldRequestObservable,
    voxelQuadSelectionObservable } from "../clientObservables";
import ClientEvent from "../types/clientEvent";
import { ClientEventType } from "../types/clientEventType";
import ClientEventHistoryUtil from "./clientEventHistoryUtil";
import EncodableData from "../../../shared/networking/types/encodableData";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import Room from "../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import { ObjectMetadata } from "../../../shared/object/types/objectMetadata";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import LabelTextUtil from "../../../shared/object/util/labelTextUtil";
import AddVoxelBlockSignal from "../../../shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../shared/voxel/util/voxelUpdateUtil";
import { NUM_VOXEL_QUADS_PER_COLLISION_LAYER } from "../../../shared/system/sharedConstants";
import Vec3 from "../../../shared/math/types/vec3";

// The user's own edits of the room as the history keeps them (see ClientEventHistoryUtil): each as the signals that
// made it and the signals that undo it. Undoing or redoing one makes those signals' edits as any of the user's own
// is made: checked as the server will check it, applied locally, then sent (a single-player room has no server to
// send it to). A signal the room no longer allows is passed over, and the step took if any of its signals did.
// The selections the user makes by hand between their edits are kept with them (see manualSelectionObservable).

const RoomEditUtil =
{
    // Enters an edit the user has just made in the history. redo: its signals, as sent; undo: the ones that take it
    // back; each in the order to be made in. selectionBefore: what was selected as the edit was made, where making
    // it moved the selection on.
    record: (type: ClientEventType, room: Room, edit: {redo: EncodableData[], undo: EncodableData[],
        selectionBefore?: VoxelQuadSelection | ObjectSelection | null, mergeKey?: string}): void =>
    {
        const roomID = room.id;
        const redo = edit.redo.map(keep);
        const undo = edit.undo.map(keep);
        const selectionAfter = getSelection();
        const selectionBefore = (edit.selectionBefore !== undefined) ? edit.selectionBefore : selectionAfter;
        ClientEventHistoryUtil.add(new ClientEvent(type, {
            undo: () => replay(roomID, undo, selectionAfter, selectionBefore),
            redo: () => replay(roomID, redo, selectionBefore, selectionAfter),
            mergeKey: edit.mergeKey,
        }));
    },

    // The signal that undoes one about to be made, as the room stands before it is.
    getUndoSignal: (room: Room, signal: EncodableData): EncodableData =>
    {
        if (signal instanceof AddVoxelBlockSignal)
            return new RemoveVoxelBlockSignal(room.id, signal.quadIndex);
        if (signal instanceof RemoveVoxelBlockSignal)
            return getVoxelBlockAddSignal(room, signal.quadIndex);
        if (signal instanceof SetVoxelQuadTextureSignal)
        {
            return new SetVoxelQuadTextureSignal(room.id, signal.quadIndex,
                room.voxelGrid.quadsMem.quads[signal.quadIndex] & 0b01111111);
        }
        if (signal instanceof AddObjectSignal)
            return new RemoveObjectSignal(room.id, signal.objectId);
        if (signal instanceof RemoveObjectSignal)
            return copyObject(room.objectById[signal.objectId]);
        if (signal instanceof SetObjectTransformSignal)
        {
            return new SetObjectTransformSignal(room.id, signal.objectId,
                copyTransform(room.objectById[signal.objectId].transform), true);
        }
        if (signal instanceof SetObjectMetadataSignal)
        {
            // (With the transform it has, if the edit brings one: the two are one edit either way.)
            const obj = room.objectById[signal.objectId];
            return new SetObjectMetadataSignal(room.id, signal.objectId, signal.metadataKey,
                getRestorableValue(obj, signal.metadataKey), signal.transform ? copyTransform(obj.transform) : undefined);
        }
        throw new Error("RoomEditUtil.getUndoSignal :: Not a signal of an edit that can be undone.");
    },

    // Makes one edit as the user's own and enters nothing in the history, for an edit no undo is to take back (see
    // RestrictedZonePlanUtil). Resolves to whether it took.
    make: (room: Room, signal: EncodableData): Promise<boolean> => make(room, signal),
}

// ─── Undoing and redoing ────────────────────────────────────────────────

// Makes an edit's signals in order, then settles the selection: while it is still where the edit's other end left it
// (leftAt), it goes back with the edit (to goesTo). Resolves to whether any of the signals took.
async function replay(roomID: string, signals: EncodableData[], leftAt: VoxelQuadSelection | ObjectSelection | null,
    goesTo: VoxelQuadSelection | ObjectSelection | null): Promise<boolean>
{
    const room = App.getCurrentRoom();
    if (room == undefined || room.id != roomID)
        return false;

    const follows = isSelected(leftAt);
    // Where the selected object stands, for the selection to move on from if a signal takes the object away.
    const selectedObject = objectSelectionObservable.peek()?.gameObject.params;
    const vacated = selectedObject ? {...selectedObject.transform.pos} : null;

    let took = false;
    for (const signal of signals)
        took = await make(room, signal) || took;
    if (took || getSelection() == null)
        settleSelection(room, (took && follows) ? goesTo : null, vacated);
    return took;
}

// Makes one edit as the user's own. One the room no longer allows is refused quietly, by the rule the server applies.
async function make(room: Room, signal: EncodableData): Promise<boolean>
{
    const user = App.getUser();
    const isMultiPlayer = room.roomType != RoomTypeEnumMap.SinglePlayer;

    if (signal instanceof AddVoxelBlockSignal)
    {
        if (!VoxelUpdateUtil.canAddVoxelBlock(user, room, signal.quadIndex) ||
            !ClientVoxelManager.addVoxelBlock(room, signal.quadIndex, signal.quadTextureIndicesWithinLayer))
        {
            return false;
        }
        if (isMultiPlayer)
            SocketsClient.emitAddVoxelBlockSignal(signal);
        return true;
    }
    if (signal instanceof RemoveVoxelBlockSignal)
    {
        if (!VoxelUpdateUtil.canRemoveVoxelBlock(user, room, signal.quadIndex) ||
            !ClientVoxelManager.removeVoxelBlock(room, signal.quadIndex))
        {
            return false;
        }
        if (isMultiPlayer)
            SocketsClient.emitRemoveVoxelBlockSignal(signal);
        return true;
    }
    if (signal instanceof SetVoxelQuadTextureSignal)
    {
        if (!VoxelUpdateUtil.canSetVoxelQuadTexture(user, room, signal.quadIndex) ||
            !ClientVoxelManager.setVoxelQuadTexture(room, signal.quadIndex, signal.textureIndex))
        {
            return false;
        }
        if (isMultiPlayer)
            SocketsClient.emitSetVoxelQuadTextureSignal(signal);
        return true;
    }
    if (signal instanceof AddObjectSignal)
    {
        // (A copy of its own each time it is added: see keep.)
        const added = copyObject(signal);
        if (!ObjectUpdateUtil.canAddObject(user, room, added) ||
            !await ClientObjectManager.addObject(ObjectFactory.createServerSideObject(added)))
        {
            return false;
        }
        if (isMultiPlayer)
            SocketsClient.emitAddObjectSignal(added);
        return true;
    }
    if (signal instanceof RemoveObjectSignal)
    {
        if (!ObjectUpdateUtil.canRemoveObject(user, room, signal))
            return false;
        // The selection lets go of an object before it leaves the room (see ObjectEditUtil).
        if (objectSelectionObservable.peek()?.gameObject.params.objectId === signal.objectId)
            ObjectSelection.unselect();
        if (!await ClientObjectManager.removeObject(signal.objectId))
            return false;
        if (isMultiPlayer)
            SocketsClient.emitRemoveObjectSignal(signal);
        return true;
    }
    if (signal instanceof SetObjectTransformSignal)
    {
        if (!ObjectUpdateUtil.canSetObjectTransform(user, room, signal))
            return false;
        const applied = ClientObjectManager.setObjectTransform(signal.objectId, copyTransform(signal.transform),
            true, false);
        if (isMultiPlayer)
        {
            SocketsClient.emitSetObjectTransformSignal(new SetObjectTransformSignal(room.id, signal.objectId,
                copyTransform(applied), true));
        }
        return true;
    }
    if (signal instanceof SetObjectMetadataSignal)
    {
        if (!ObjectUpdateUtil.canSetObjectMetadata(user, room, signal))
            return false;
        const transform = signal.transform ? copyTransform(signal.transform) : undefined;
        if (!ClientObjectManager.setObjectMetadata(signal.objectId, signal.metadataKey, signal.metadataValue, true, transform))
            return false;
        if (isMultiPlayer)
        {
            SocketsClient.emitSetObjectMetadataSignal(new SetObjectMetadataSignal(room.id, signal.objectId,
                signal.metadataKey, signal.metadataValue,
                transform ? copyTransform(room.objectById[signal.objectId].transform) : undefined));
        }
        return true;
    }
    return false;
}

// ─── The selection ──────────────────────────────────────────────────────

// Where an undone or redone edit leaves the selection: on what it is handed, where that can be selected. Otherwise
// where it is, announced again so that its outline and tools catch up, or moved on by the usual search if the edit
// took it away or covered it (see VoxelQuadSelection). Nothing is selected outside edit mode, where each of these
// comes to nothing.
function settleSelection(room: Room, target: VoxelQuadSelection | ObjectSelection | null, vacated: Vec3 | null): void
{
    if (target != null && !isSelected(target) && trySelect(room, target))
        return;

    const quadSelection = voxelQuadSelectionObservable.peek();
    if (quadSelection != null)
    {
        if (VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, quadSelection.quadIndex))
            voxelQuadSelectionObservable.notify();
        else
        {
            VoxelQuadSelection.unselect();
            VoxelQuadSelection.trySelectBestQuad(quadSelection.voxel, quadSelection.quadIndex);
        }
    }
    else if (objectSelectionObservable.peek() != null)
        objectSelectionObservable.notify();
    else if (vacated != null)
        VoxelQuadSelection.trySelectBestQuadNearby(vacated);
}

function getSelection(): VoxelQuadSelection | ObjectSelection | null
{
    return voxelQuadSelectionObservable.peek() ?? objectSelectionObservable.peek();
}

// Whether what is selected now is what a selection was of: the same quad, or the same object, which a removal
// undone has since made anew.
function isSelected(selection: VoxelQuadSelection | ObjectSelection | null): boolean
{
    if (selection instanceof VoxelQuadSelection)
        return voxelQuadSelectionObservable.peek()?.quadIndex === selection.quadIndex;
    return selection != null &&
        objectSelectionObservable.peek()?.gameObject.params.objectId === selection.gameObject.params.objectId;
}

function trySelect(room: Room, selection: VoxelQuadSelection | ObjectSelection): boolean
{
    if (selection instanceof VoxelQuadSelection)
    {
        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels,
            VoxelQueryUtil.getVoxelRowFromQuadIndex(selection.quadIndex),
            VoxelQueryUtil.getVoxelColFromQuadIndex(selection.quadIndex));
        return voxel != undefined && VoxelQuadSelection.trySelect(voxel, selection.quadIndex);
    }
    const gameObject = ClientObjectManager.getObjectById(selection.gameObject.params.objectId);
    return gameObject != undefined && gameObject.canBeSelected() && ObjectSelection.trySelect(gameObject);
}

// ─── Signals as they are kept ───────────────────────────────────────────

// A signal as the history holds it. An object takes the signal it is added by for its own and edits it from then
// on, so one of those is held as a copy, and a copy of that is what adds the object again.
function keep(signal: EncodableData): EncodableData
{
    return (signal instanceof AddObjectSignal) ? copyObject(signal) : signal;
}

// An object as it stands, as the signal this user adds it by: under their own name, as whoever adds one must (see
// ObjectTypeConfig.canUserAddObject).
function copyObject(obj: AddObjectSignal): AddObjectSignal
{
    const user = App.getUser();
    const metadata: ObjectMetadata = {};
    for (const [key, value] of Object.entries(obj.metadata))
        metadata[Number(key)] = new EncodableByteString(value.str);
    return new AddObjectSignal(obj.roomID, user.id, user.userName, obj.objectTypeIndex, obj.objectId,
        copyTransform(obj.transform), metadata);
}

function copyTransform(transform: ObjectTransform): ObjectTransform
{
    return new ObjectTransform({...transform.pos}, {...transform.dir}, {...transform.scale});
}

// The signal that puts a quad's block back as it stands, with its faces' textures.
function getVoxelBlockAddSignal(room: Room, quadIndex: number): AddVoxelBlockSignal
{
    const firstQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex), VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex));

    const textures = new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER);
    for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        textures[i] = room.voxelGrid.quadsMem.quads[firstQuadIndex + i] & 0b01111111;
    return new AddVoxelBlockSignal(room.id, firstQuadIndex, textures);
}

// The value to write under a key for it to read as it now does. One never written reads as its type's default,
// which for an ink is no palette position that writing nothing would give (see LabelTextUtil.getColorIndex).
function getRestorableValue(obj: AddObjectSignal, metadataKey: ObjectMetadataKey): string
{
    const stored = obj.metadata[metadataKey]?.str;
    if (stored != undefined)
        return stored;
    return (metadataKey == ObjectMetadataKeyEnumMap.LabelColor) ? `${LabelTextUtil.getColorIndex(obj)}` : "";
}

// ─── Selections made by hand ────────────────────────────────────────────

// Selects again what a selection made by hand left or took, as a click on it would, though with the view sliding
// alongside if the selection's own step had it slide (see SelectionStepUtil). Whether that moved the selection.
function reselect(roomID: string | undefined, selection: VoxelQuadSelection | ObjectSelection | null,
    slides: boolean): boolean
{
    const room = App.getCurrentRoom();
    if (room == undefined || room.id != roomID || selection == null || isSelected(selection) ||
        !trySelect(room, selection))
    {
        return false;
    }
    if (slides)
        orbitCameraAngleHoldRequestObservable.set(true);
    return true;
}

// Each enters the history as it is made: undone by selecting what it left, redone by selecting what it took, and
// passed over where that is gone or is selected already (see ClientEvent.skippable).
manualSelectionObservable.addListener("roomEditUtil", ({before, after}) => {
    const roomID = App.getCurrentRoom()?.id;
    const slides = orbitCameraAngleHoldRequestObservable.peek();
    ClientEventHistoryUtil.add(new ClientEvent(
        (after instanceof VoxelQuadSelection) ? ClientEventType.ManuallySelectedVoxelQuad
            : ClientEventType.ManuallySelectedObject,
        {
            undo: async () => reselect(roomID, before, slides),
            redo: async () => reselect(roomID, after, slides),
            skippable: true,
        }));
});

export default RoomEditUtil;
