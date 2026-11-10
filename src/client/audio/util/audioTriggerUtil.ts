import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
import CannonStateUtil from "../../../shared/object/util/cannonStateUtil";
import PhysicsColliderStateUtil from "../../../shared/physics/util/physicsColliderStateUtil";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import Vec3 from "../../../shared/math/types/vec3";
import { InventoryItemTypeEnumMap } from "../../../shared/inventory/types/inventoryItemType";
import App from "../../app";
import { cannonBallBurstObservable, cannonBlastObservable, cannonFiredObservable, chatLineSentObservable,
    clickRefusedObservable, controlPressedObservable, dollarsSpentObservable,
    downwardArrowTargetObservable, headlineMessageObservable, inventoryGainObservable, loginRewardStageObservable,
    navigationArrowTargetObservable, numOpenPanelsObservable, numOpenPopupsObservable, objectCollectedObservable,
    objectEditObservable, objectPlacedObservable, objectSelectionObservable, roomTravelObservable,
    screenArrowTargetObservable, screenDiagramObservable, screenOutlineCapsuleTargetObservable,
    screenOutlineRectTargetObservable, voxelBlockEditObservable, voxelQuadHighlightObservable,
    voxelQuadSelectionObservable } from "../../system/clientObservables";
import AudioManager from "../audioManager";
import AudioBundleMap from "../maps/audioBundleMap";
import AudioClipName from "../types/audioClipName";

// How far the sound of someone else's edit carries, block or object, in world units; that of someone coming or going;
// that of someone else's dollar; and that of a cannon's shot or its ball's burst.
export const EDIT_SOUND_RANGE = 14;
export const ARRIVAL_SOUND_RANGE = 14;
export const COLLECT_SOUND_RANGE = 12;
export const CANNON_SOUND_RANGE = 22;
// How far either way the pitch of a sound heard over and over is varied, so that no two of them sound alike.
export const PITCH_VARIATION = 0.05;
// How long the moment lasts whose sounds are heard as one (see tell and cueSlight).
export const SOUND_MOMENT_MS = 40;
// An object picked out sounds higher than a block's face.
export const OBJECT_SELECTION_RATE = 1.12;

const BLOCK_EDIT_SOUNDS: {[kind: string]: {clip: AudioClipName, volume: number}} = {
    add: {clip: "edit/blockAdd", volume: 0.9},
    remove: {clip: "edit/blockRemove", volume: 0.9},
    move: {clip: "edit/blockMove", volume: 0.8},
    retexture: {clip: "edit/retexture", volume: 0.3},
};
// Someone else's edit of an object sounds as the same edit of a block; a change to its settings, which a block has none
// of, as a breath of air.
const OBJECT_EDIT_SOUNDS: {[kind: string]: {clip: AudioClipName, volume: number}} = {
    add: BLOCK_EDIT_SOUNDS.add,
    remove: BLOCK_EDIT_SOUNDS.remove,
    move: BLOCK_EDIT_SOUNDS.move,
    change: {clip: "edit/objectChange", volume: 0.7},
};

// The slight sounds, from the least telling: in a moment, each gives way to any above it.
const SLIGHT_RANKS = {press: 0, panel: 1, selection: 2, popup: 3, tutorialCleared: 4, tutorialShown: 5};

// What a single-player mode's steps point the user with (see SinglePlayerActionMap).
const TUTORIAL_MARKS: {peek(): unknown, addListener(key: string, callback: (value: unknown) => void): void}[] = [
    headlineMessageObservable, screenDiagramObservable, screenArrowTargetObservable, screenOutlineRectTargetObservable,
    screenOutlineCapsuleTargetObservable, navigationArrowTargetObservable, downwardArrowTargetObservable,
    voxelQuadHighlightObservable];

let numOpenPopups = numOpenPopupsObservable.peek();
let numOpenPanels = numOpenPanelsObservable.peek();
let selectionKey = getSelectionKey();
let tutorialMarks = TUTORIAL_MARKS.map(mark => mark.peek());
let slightSound: {rank: number, play: () => void} | undefined;
let slightSoundTimer: ReturnType<typeof setTimeout> | undefined;
let quietUntil = -Infinity;
// When the door the user last left by is shut, and their arrival waiting for it.
let doorShutAt = -Infinity;
let arrivalTimer: ReturnType<typeof setTimeout> | undefined;

// Which event sounds as what: the one place gameplay and the UI meet sound, so neither calls AudioManager itself.
// Others' edits sound where they are made (an object's own, a fan's wind or a cannon's gears, sounds where it stands; see
// FanGameObject, CannonGameObject), as do others coming and going and collecting, and what cannons do; what the user
// does and is given, their own edits included, is heard alike from anywhere. Whatever one action sets off at once (a
// press, the panel it opens, the selection an edit moves) is heard as one sound, the most telling.
const AudioTriggerUtil =
{
    onVoxelBlockEdit: (edit: {kind: "add" | "remove" | "move" | "retexture", quadIndex: number, own: boolean}): void =>
    {
        const sound = BLOCK_EDIT_SOUNDS[edit.kind];
        tell(() => edit.own
            ? AudioManager.play(sound.clip, {volume: sound.volume, rate: vary()})
            : AudioManager.playAt(sound.clip, getBlockCenter(edit.quadIndex),
                {volume: sound.volume, range: EDIT_SOUND_RANGE, rate: vary()}));
    },
    // Players come and go through doors; the user's own coming and going sounds as they travel (see onRoomTravel), and an
    // admin's in ghost mode not at all. The user's own object added clicks as a press of the UI does, and one changed
    // sounds as the control pressed for it already does. An attached object taken away, by anyone or anything, sounds
    // as its coming apart (see tellObjectDestroyed).
    onObjectEdit: (edit: {kind: "add" | "remove" | "change", object: AddObjectSignal, own: boolean}): void =>
    {
        const {kind, object} = edit;
        if (isPlayer(object))
        {
            if (kind != "change" && object.sourceUserID != App.getUser().id &&
                !AdminPrefsUtil.getObjectPrefs(object).ghostMode)
            {
                AudioManager.playAt((kind == "add") ? "room/arrive" : "room/leave", object.transform.pos,
                    {volume: 0.6, range: ARRIVAL_SOUND_RANGE});
            }
        }
        else if (isRoomObject(object))
        {
            if (kind == "remove" && comesApart(object))
                tellObjectDestroyed(object, edit.own);
            else if (!edit.own)
                tellOthersObjectEdit(kind, object.transform.pos);
            // (One that costs dollars sounds as their spending does; see onDollarsSpent.)
            else if (kind == "add" && !isPriced(object))
                tell(playClick);
        }
    },
    onCannonFired: (shot: {position: Vec3}): void =>
    {
        AudioManager.playAt("cannon/fire", shot.position, {volume: 0.7, range: CANNON_SOUND_RANGE, rate: vary()});
    },
    // Heard whatever else the moment sounds, and in place of all its blast breaks (see onCannonBlast).
    onCannonBallBurst: (burst: {position: Vec3}): void =>
    {
        hush();
        AudioManager.playAt("cannon/explosion", burst.position, {volume: 0.8, range: CANNON_SOUND_RANGE, rate: vary()});
    },
    // What a blast breaks comes right after the server's word of it, and sounds as the burst alone, which may have
    // been heard a moment sooner (see CannonBallGameObject).
    onCannonBlast: (): void =>
    {
        hush();
    },
    onObjectPlaced: (placement: {object: AddObjectSignal, own: boolean}): void =>
    {
        if (!isRoomObject(placement.object))
            return;
        if (placement.own)
            tell(playClick);
        else
            tellOthersObjectEdit("move", placement.object.transform.pos);
    },
    onObjectCollected: (object: AddObjectSignal): void =>
    {
        AudioManager.playAt("dollar/gain", object.transform.pos, {volume: 0.5, range: COLLECT_SOUND_RANGE, rate: vary()});
    },
    onInventoryGain: (itemType: string): void =>
    {
        if (itemType == InventoryItemTypeEnumMap.Dollar)
            AudioManager.play("dollar/gain", {volume: 0.6, rate: vary()});
    },
    onLoginRewardStage: (stage: "none" | "waiting" | "shown"): void =>
    {
        if (stage == "shown")
            tell(() => AudioManager.play("dollar/reward", {volume: 0.8}));
    },
    onDollarsSpent: (): void =>
    {
        tell(() => AudioManager.play("dollar/spend", {volume: 0.8}));
    },
    onClickRefused: (): void =>
    {
        tell(() => AudioManager.play("ui/refusal", {volume: 0.7}));
    },
    onControlPressed: (): void =>
    {
        cueSlight(SLIGHT_RANKS.press, playClick);
    },
    onNumOpenPopups: (count: number): void =>
    {
        if (count != numOpenPopups)
        {
            const clip = (count > numOpenPopups) ? "ui/popupOpen" : "ui/popupClose";
            cueSlight(SLIGHT_RANKS.popup, () => AudioManager.play(clip, {volume: 0.6}));
        }
        numOpenPopups = count;
    },
    onNumOpenPanels: (count: number): void =>
    {
        if (count != numOpenPanels)
        {
            const clip = (count > numOpenPanels) ? "ui/panelOpen" : "ui/panelClose";
            cueSlight(SLIGHT_RANKS.panel, () => AudioManager.play(clip, {volume: 0.5}));
        }
        numOpenPanels = count;
    },
    // A block's face or an object picked out, another in its place, or the selection let go of (which leaving edit mode
    // does); not the selection refreshed where it is.
    onSelection: (): void =>
    {
        const key = getSelectionKey();
        if (key == selectionKey)
            return;
        selectionKey = key;
        const rate = (objectSelectionObservable.peek() != null) ? OBJECT_SELECTION_RATE : 1;
        cueSlight(SLIGHT_RANKS.selection, () => AudioManager.play((key == "") ? "edit/deselect" : "edit/select",
            {volume: 0.5, rate}));
    },
    // The tutorial pointing with something new, or done pointing: the last of its marks taken away.
    onTutorialMarks: (): void =>
    {
        const marks = TUTORIAL_MARKS.map(mark => mark.peek());
        const shown = marks.some((mark, i) => mark != null && mark !== tutorialMarks[i]);
        const cleared = marks.every(mark => mark == null) && tutorialMarks.some(mark => mark != null);
        tutorialMarks = marks;
        if (shown)
            cueSlight(SLIGHT_RANKS.tutorialShown, () => AudioManager.play("tutorial/show", {volume: 0.6}));
        else if (cleared)
            cueSlight(SLIGHT_RANKS.tutorialCleared, () => AudioManager.play("tutorial/clear", {volume: 0.5}));
    },
    // A door shutting behind the user as they leave a room, and one opening as they come into the next, once the first
    // has shut.
    onRoomTravel: (travel: {kind: "leave" | "arrive", roomID: string}): void =>
    {
        clearTimeout(arrivalTimer);
        arrivalTimer = undefined;
        if (travel.kind == "leave")
        {
            tell(() => AudioManager.play("room/leave", {volume: 0.7}));
            doorShutAt = performance.now() + 1000 * AudioBundleMap.clips["room/leave"].duration;
            return;
        }
        const wait = doorShutAt - performance.now();
        if (wait > 0)
            arrivalTimer = setTimeout(() => attempt(() => tell(playArrival)), wait);
        else
            tell(playArrival);
    },
    onChatLineSent: (): void =>
    {
        tell(() => AudioManager.play("chat/send", {volume: 0.6}));
    },
}

// A sound of something done, heard at once: the first of its moment, in place of every slight one the moment brings.
function tell(play: () => void): void
{
    if (performance.now() < quietUntil)
        return;
    hush();
    play();
}

// Starts a moment in which nothing else is heard.
function hush(): void
{
    quietUntil = performance.now() + SOUND_MOMENT_MS;
    slightSound = undefined;
    clearTimeout(slightSoundTimer);
    slightSoundTimer = undefined;
}

// A slight sound waits out its moment, and is heard unless the moment brings one above it, or a telling one.
function cueSlight(rank: number, play: () => void): void
{
    if (performance.now() < quietUntil || (slightSound != undefined && slightSound.rank > rank))
        return;
    slightSound = {rank, play};
    slightSoundTimer ??= setTimeout(playSlightSound, SOUND_MOMENT_MS);
}

function playSlightSound(): void
{
    const sound = slightSound;
    slightSound = undefined;
    slightSoundTimer = undefined;
    if (sound != undefined)
        attempt(sound.play);
}

function playClick(): void
{
    AudioManager.play("ui/press", {volume: 0.5, rate: vary()});
}

function playArrival(): void
{
    AudioManager.play("room/arrive", {volume: 0.7});
}

function tellOthersObjectEdit(kind: "add" | "remove" | "move" | "change", position: Vec3): void
{
    const sound = OBJECT_EDIT_SOUNDS[kind];
    tell(() => AudioManager.playAt(sound.clip, position, {volume: sound.volume, range: EDIT_SOUND_RANGE, rate: vary()}));
}

// An attached object coming apart, whatever took it away, heard from its middle: the user's own removal of one as any
// of their edits is, from anywhere. A cannon that has fired its last ball goes in a puff instead.
function tellObjectDestroyed(object: AddObjectSignal, own: boolean): void
{
    const middle = PhysicsColliderStateUtil.getObjectColliderState(object.objectTypeIndex, object.transform)?.hitbox.center
        ?? object.transform.pos;
    if (CannonStateUtil.isSpent(object))
        tell(() => AudioManager.playAt("cannon/puff", middle, {volume: 0.6, range: EDIT_SOUND_RANGE}));
    else if (own)
        tell(() => AudioManager.play("edit/objectDestroy", {volume: 0.5, rate: vary()}));
    else
        tell(() => AudioManager.playAt("edit/objectDestroy", middle, {volume: 0.5, range: EDIT_SOUND_RANGE, rate: vary()}));
}

// One attached to a face, but for an NPC, which steps off a block rather than going with it (see ParticleTriggerUtil).
function comesApart(object: AddObjectSignal): boolean
{
    const attachment = ObjectTypeConfigMap.getConfigByIndex(object.objectTypeIndex).attachment;
    return attachment != undefined && !attachment.stepsAside;
}

function isPriced(object: AddObjectSignal): boolean
{
    return (ObjectTypeConfigMap.getConfigByIndex(object.objectTypeIndex).price ?? 0) > 0;
}

function isPlayer(object: AddObjectSignal): boolean
{
    return ObjectTypeConfigMap.getConfigByIndex(object.objectTypeIndex).objectType == "Player";
}

// One of the room's own objects, which its edits are made of: not a player, nor a dollar bill.
function isRoomObject(object: AddObjectSignal): boolean
{
    return ObjectTypeConfigMap.getConfigByIndex(object.objectTypeIndex).persistent;
}

// What is selected, as a key that changes only when the selection does.
function getSelectionKey(): string
{
    const quad = voxelQuadSelectionObservable.peek();
    const object = objectSelectionObservable.peek();
    return (quad == null && object == null) ? "" : `${quad?.quadIndex ?? ""}/${object?.gameObject.params.objectId ?? ""}`;
}

function vary(): number
{
    return 1 + PITCH_VARIATION * (2 * Math.random() - 1);
}

// The middle of the block that a quad belongs to.
function getBlockCenter(quadIndex: number): Vec3
{
    return VoxelQueryUtil.getVoxelBlockBox(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex)).center;
}

// Observable dispatch has no try/catch, so a sound that fails must not stop the listeners after it.
function attempt(play: () => void): void
{
    try
    {
        play();
    }
    catch (err)
    {
        console.error("AudioTriggerUtil :: Failed to play a sound", err);
    }
}

function guarded<T>(handle: (event: T) => void): (event: T) => void
{
    return (event: T) => attempt(() => handle(event));
}

// Registered on import (see app.ts). Events before the audio loads, or before the user's first input, sound nothing.
const LISTENER_KEY = "audioTriggerUtil";
voxelBlockEditObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onVoxelBlockEdit));
objectEditObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onObjectEdit));
objectPlacedObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onObjectPlaced));
objectCollectedObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onObjectCollected));
cannonFiredObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onCannonFired));
cannonBallBurstObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onCannonBallBurst));
cannonBlastObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onCannonBlast));
inventoryGainObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onInventoryGain));
loginRewardStageObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onLoginRewardStage));
dollarsSpentObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onDollarsSpent));
clickRefusedObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onClickRefused));
controlPressedObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onControlPressed));
numOpenPopupsObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onNumOpenPopups));
numOpenPanelsObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onNumOpenPanels));
voxelQuadSelectionObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onSelection));
objectSelectionObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onSelection));
for (const mark of TUTORIAL_MARKS)
    mark.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onTutorialMarks));
roomTravelObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onRoomTravel));
chatLineSentObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onChatLineSent));

export default AudioTriggerUtil;
