import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
import Vec3 from "../../../shared/math/types/vec3";
import { InventoryItemTypeEnumMap } from "../../../shared/inventory/types/inventoryItemType";
import App from "../../app";
import { PetActionEnumMap } from "../../../shared/object/types/petAction";
import { PetInjectionEnumMap } from "../../../shared/object/types/petInjection";
import PetOwnerUtil from "../../../shared/object/util/petOwnerUtil";
import PetShownStateUtil from "../../../shared/object/util/petShownStateUtil";
import { cannonBallBounceObservable, cannonBallBurstObservable, cannonFiredObservable, cannonScrappedObservable,
    dollarsSpentObservable, inventoryGainObservable, loginRewardStageObservable, objectCollectedObservable,
    objectEditObservable, petInjectedObservable, petStrikeObservable, roomTravelObservable } from "../../system/clientObservables";
import AudioManager from "../audioManager";
import AudioBundleMap from "../maps/audioBundleMap";

// How far the puff of a cannon turning to scrap carries, in world units; that of someone coming or going; that of
// someone else's dollar; and that of a cannon's shot and of its ball's bounce or burst, which fade the slowest.
export const PUFF_SOUND_RANGE = 14;
export const ARRIVAL_SOUND_RANGE = 14;
export const COLLECT_SOUND_RANGE = 12;
export const CANNON_SOUND_RANGE = 40;
// How far what happens to a pet carries: its going, what is put into it, and its ramming another.
export const PET_SOUND_RANGE = 14;
// How loud a cannon's shot, its ball's bounce and its ball's burst are, over their recordings' own loudness.
export const CANNON_FIRE_VOLUME = 2.4;
export const CANNON_BOUNCE_VOLUME = 1.2;
export const CANNON_EXPLOSION_VOLUME = 2;
// How far either way the pitch of a sound heard over and over is varied, so that no two of them sound alike.
export const PITCH_VARIATION = 0.05;
// How long the moment lasts whose sounds are heard as one (see tell).
export const SOUND_MOMENT_MS = 40;

let quietUntil = -Infinity;
let bounceQuietUntil = -Infinity;
// When the door the user last left by is shut, and their arrival waiting for it.
let doorShutAt = -Infinity;
let arrivalTimer: ReturnType<typeof setTimeout> | undefined;

// Which event sounds as what: the one place gameplay and the UI meet sound, so neither calls AudioManager itself. The
// UI, chat and building make none, whoever builds. What others do sounds where they do it (an object's own, a fan's wind
// or a cannon's gears, sounds where it stands; see FanGameObject, CannonGameObject), as do others coming and going and
// collecting, what cannons do, and what befalls pets; what the user does and is given is heard alike from anywhere.
const AudioTriggerUtil =
{
    // Players come and go through doors; the user's own coming and going sounds as they travel (see onRoomTravel), and an
    // admin's in ghost mode not at all. A pet taken away is beamed out, or, out of health, breaks down: several going
    // at once, with their owner, sound as one. None of the room's own objects sounds as it is put up, taken away, moved
    // or changed.
    onObjectEdit: (edit: {kind: "add" | "remove" | "change", object: AddObjectSignal, own: boolean}): void =>
    {
        const {kind, object} = edit;
        if (isPlayer(object) && kind != "change" && object.sourceUserID != App.getUser().id &&
            !AdminPrefsUtil.getObjectPrefs(object).ghostMode)
        {
            AudioManager.playAt((kind == "add") ? "room/arrive" : "room/leave", object.transform.pos,
                {volume: 0.6, range: ARRIVAL_SOUND_RANGE});
        }
        else if (kind == "remove" && PetOwnerUtil.isPet(object))
        {
            const dead = PetShownStateUtil.getObjectState(object).action == PetActionEnumMap.Dead;
            tell(() => AudioManager.playAt(dead ? "pet/death" : "pet/vanish", object.transform.pos,
                {volume: 0.7, range: PET_SOUND_RANGE}));
        }
    },
    onPetInjected: (given: {injection: number, position: Vec3}): void =>
    {
        AudioManager.playAt((given.injection == PetInjectionEnumMap.Battery) ? "pet/charge" : "pet/repair", given.position,
            {volume: 0.8, range: PET_SOUND_RANGE});
    },
    onPetStrike: (strike: {position: Vec3}): void =>
    {
        AudioManager.playAt("pet/strike", strike.position, {volume: 0.8, range: PET_SOUND_RANGE, rate: vary()});
    },
    // Heard from its middle, as a puff.
    onCannonScrapped: (wreck: {position: Vec3}): void =>
    {
        tell(() => AudioManager.playAt("cannon/puff", wreck.position, {volume: 0.6, range: PUFF_SOUND_RANGE}));
    },
    onCannonFired: (shot: {position: Vec3}): void =>
    {
        AudioManager.playAt("cannon/fire", shot.position,
            {volume: CANNON_FIRE_VOLUME, range: CANNON_SOUND_RANGE, rate: vary()});
    },
    // Two balls that bounce off each other are told of as a bounce each in one moment, which sound as one.
    onCannonBallBounce: (bounce: {position: Vec3}): void =>
    {
        const now = performance.now();
        if (now < bounceQuietUntil)
            return;
        bounceQuietUntil = now + SOUND_MOMENT_MS;
        AudioManager.playAt("cannon/bounce", bounce.position,
            {volume: CANNON_BOUNCE_VOLUME, range: CANNON_SOUND_RANGE, rate: vary()});
    },
    // The only sound of its blast: what it breaks makes none.
    onCannonBallBurst: (burst: {position: Vec3}): void =>
    {
        AudioManager.playAt("cannon/explosion", burst.position,
            {volume: CANNON_EXPLOSION_VOLUME, range: CANNON_SOUND_RANGE, rate: vary()});
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
}

// A sound of something done, heard at once, unless another was in its moment: so that what one action sets off at once
// is heard as one sound.
function tell(play: () => void): void
{
    const now = performance.now();
    if (now < quietUntil)
        return;
    quietUntil = now + SOUND_MOMENT_MS;
    play();
}

function playArrival(): void
{
    AudioManager.play("room/arrive", {volume: 0.7});
}

function isPlayer(object: AddObjectSignal): boolean
{
    return ObjectTypeConfigMap.getConfigByIndex(object.objectTypeIndex).objectType == "Player";
}

function vary(): number
{
    return 1 + PITCH_VARIATION * (2 * Math.random() - 1);
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
objectEditObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onObjectEdit));
objectCollectedObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onObjectCollected));
cannonFiredObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onCannonFired));
cannonScrappedObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onCannonScrapped));
cannonBallBounceObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onCannonBallBounce));
cannonBallBurstObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onCannonBallBurst));
petInjectedObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onPetInjected));
petStrikeObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onPetStrike));
inventoryGainObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onInventoryGain));
loginRewardStageObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onLoginRewardStage));
dollarsSpentObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onDollarsSpent));
roomTravelObservable.addListener(LISTENER_KEY, guarded(AudioTriggerUtil.onRoomTravel));

export default AudioTriggerUtil;
