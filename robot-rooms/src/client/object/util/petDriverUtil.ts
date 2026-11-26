import * as THREE from "three";
import App from "../../app";
import GraphicsManager from "../../graphics/graphicsManager";
import ClientObjectManager from "../clientObjectManager";
import PetDrive from "../types/petDrive";
import type PetGameObject from "../types/gameObject/petGameObject";
import SocketsClient from "../../networking/client/socketsClient";
import { cameraModeObservable, cannonBlastObservable, chatLineObservable, objectEditObservable, objectPlacedObservable,
    petInjectedObservable, roomChangedObservable, updateObservable,
    voxelBlockEditObservable } from "../../system/clientObservables";
import Vec3 from "../../../shared/math/types/vec3";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import InjectPetSignal from "../../../shared/object/types/injectPetSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import PetObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/petObjectTypeConfig";
import PetChatSignal from "../../../shared/object/types/petChatSignal";
import { PetEditKind } from "../../../shared/object/types/petEditKind";
import PetEntrance from "../../../shared/object/types/petEntrance";
import PetNeeds from "../../../shared/object/types/petNeeds";
import PetSurroundings from "../../../shared/object/types/petSurroundings";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import SetObjectPathSignal from "../../../shared/object/types/setObjectPathSignal";
import PetBehaviorUtil, { PET_BLAST_FRIGHT, PET_GUST_FRIGHT } from "../../../shared/object/util/petBehaviorUtil";
import PetBodyUtil from "../../../shared/object/util/petBodyUtil";
import PetEntranceUtil from "../../../shared/object/util/petEntranceUtil";
import PetFrightUtil from "../../../shared/object/util/petFrightUtil";
import PetIdentityUtil from "../../../shared/object/util/petIdentityUtil";
import PetNeedsUtil from "../../../shared/object/util/petNeedsUtil";
import PetPathSyncUtil from "../../../shared/object/util/petPathSyncUtil";
import PetRecordUtil from "../../../shared/object/util/petRecordUtil";
import PetShownStateUtil from "../../../shared/object/util/petShownStateUtil";
import PetSurroundingsUtil from "../../../shared/object/util/petSurroundingsUtil";
import PhysicsManager from "../../../shared/physics/physicsManager";
import Room from "../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { UNIT_VEC3 } from "../../../shared/system/sharedConstants";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";

const PET_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(PetObjectTypeConfig.objectType);
// How often each pet takes a beat of its life (see PetBehaviorUtil.update), in seconds, as the server's are given
// theirs.
const BEAT_SECONDS = 0.2;
// How often the server is told how the user's pets are, in milliseconds (see PetRecordUtil.encodeReport), and a fan's
// wind catching a body is looked for (see PetFrightUtil).
const REPORT_INTERVAL_MS = 10_000;
const GUST_CHECK_INTERVAL_MS = 600;
// How long after one pet has come in the next may, and how long after one the room refused the next try is made.
const ENTRANCE_GAP_MS = 500;
const ENTRANCE_RETRY_MS = 3000;
// The time a pet's frames leave out is made up in steps this long, once it comes to this much; what is beyond the most
// kept is dropped, and the pet told off its way instead (see PetPathSyncUtil).
const EXTRA_STEP_SECONDS = 0.05;
const MIN_EXTRA_STEP_SECONDS = 0.01;
const MAX_SECONDS_BEHIND = 0.25;
const LISTENER_KEY = "petDriverUtil";
const cameraPosTemp = new THREE.Vector3();

// The pets of the user's that are in the room, by object id.
const drives = new Map<string, PetDrive>();
// How each of the user's pets was when this browser last played it, wherever that was: what it is taken up as in the
// next room, the user's record of it being only as fresh as the last report (see PetRecordUtil).
const needsByPetId = new Map<string, PetNeeds>();
// The pets the user has sold here, or that have died here, which their record lists until the server has heard of it.
const soldPetIds = new Set<string>();
// The pets that have just died here, whose last word of how they are is still to be told.
const deadNeeds = new Map<string, PetNeeds>();
// Until when a pet not yet played here is to be held, once it is (see hold); and the way one just brought in behind a
// door is to walk out of it, once it is played (see PetEntranceUtil).
const heldUntilByPetId = new Map<string, number>();
const wayInByPetId = new Map<string, Vec3[]>();
const gustFrightAt = new Map<string, number>();
let roomID: string | undefined = undefined;
let entrance: PetEntrance | undefined = undefined;
// Until when no pet comes in: a moment after the last, and longer after one the room had no room for.
let entranceHeldUntil = 0;
// The frames' time since the last beat, and when the next is due, by the clock.
let secondsSinceBeat = 0;
let beatDueAt = 0;
let reportedAt = 0;
let gustsCheckedAt = 0;

// The user's own pets, which their browser plays (see PetObjectTypeConfig): it brings them into each room after the
// user, one at a time (see PetEntranceUtil); steers each by physics as PetBehaviorUtil has it, every frame; gives each
// a beat of its life a few times a second; tells it what happens around it (what is built, what is said, who speaks to
// it and what it answers them, what is put into it); and tells the server what the room is to know of them: the way each
// sets off on, or where physics has taken it instead, what it shows of itself and says, and now and then how they all
// are, which is what the user's record of them keeps. A pet the server plays (an agent's, or one a room keeps) is none
// of its business, but for telling what was put into one.
const PetDriverUtil =
{
    // Steers a pet for a frame, if it is one played here: whether it is. From its own update, ahead of its body's.
    drive: (pet: PetGameObject, deltaTime: number): boolean =>
    {
        const drive = drives.get(pet.params.objectId);
        const rigidbody = pet.getRigidbody();
        const room = App.getCurrentRoom();
        if (drive == undefined || rigidbody == undefined || room == undefined)
            return false;
        const b = drive.behavior;

        // The room plays the pet's way out by the clock, which a slow browser's frames fall short of (see App): its body
        // takes the time they leave out in steps of its own, ahead of the frame's.
        const now = performance.now();
        const clockSeconds = (drive.steeredAt == undefined) ? deltaTime : 0.001 * (now - drive.steeredAt);
        drive.steeredAt = now;
        // (Where its body's own step left it, a frame ago.)
        PetPathSyncUtil.trace(drive.sync, pet.position, deltaTime);
        drive.secondsBehind = Math.min(MAX_SECONDS_BEHIND, drive.secondsBehind + clockSeconds - deltaTime);
        let underForce = rigidbody.isUnderForce();
        while (drive.secondsBehind >= MIN_EXTRA_STEP_SECONDS)
        {
            const seconds = Math.min(EXTRA_STEP_SECONDS, drive.secondsBehind);
            underForce = stepBody(room, pet, drive, seconds) || underForce;
            drive.secondsBehind -= seconds;
            PetPathSyncUtil.trace(drive.sync, pet.position, seconds);
        }

        b.at = PetBodyUtil.getFeet(pet.position);
        const velocity = PetBehaviorUtil.steer(b, deltaTime);
        pet.face(b.facing);
        rigidbody.setDesiredVelocity(velocity.x, velocity.y, velocity.z);
        PetPathSyncUtil.advance(drive.sync, clockSeconds);

        if (underForce && !drive.underForce)
            PetBehaviorUtil.takePush(b, observe(room, pet.params.objectId));
        drive.underForce = underForce;
        return true;
    },
    // Whether a pet is one this browser plays.
    plays: (objectId: string): boolean =>
    {
        return drives.has(objectId);
    },
    // How a pet of the user's is, as this browser last had it; undefined for any other.
    getNeeds: (objectId: string): PetNeeds | undefined =>
    {
        const needs = drives.get(objectId)?.behavior.needs ?? needsByPetId.get(objectId);
        return (needs == undefined) ? undefined : {...needs};
    },
    // Sells one of the user's pets: the server is told that it is removed, which is the sale; for one played here, how
    // it is first, which is what the server pays for (see PetSaleUtil).
    sell: (objectId: string): void =>
    {
        const room = App.getCurrentRoom();
        if (room == undefined)
            return;
        if (drives.has(objectId))
        {
            tellNeeds(room);
            forget(objectId);
        }
        void ClientObjectManager.removeObject(objectId).then(removed => {
            if (removed)
                SocketsClient.emitRemoveObjectSignal(new RemoveObjectSignal(room.id, objectId));
        });
    },
    // Puts every pet played here in such a state at once, each part from 0 to 1 and any left out as it is, and says how
    // many there were: a dev server's debug command (see DebugCommandUtil), for trying what a pet does as it fails,
    // rages, takes fright or tires without the wait.
    setNeeds: (needs: Partial<PetNeeds>): number =>
    {
        drives.forEach(drive => Object.assign(drive.behavior.needs, needs));
        return drives.size;
    },
    // Keeps one of the user's pets standing idle and silent for a while from now, whatever else it would do; one not
    // played here yet (just generated) from then on.
    hold: (objectId: string, milliseconds: number): void =>
    {
        const now = performance.now();
        const drive = drives.get(objectId);
        if (drive != undefined)
            PetBehaviorUtil.hold(drive.behavior, now, milliseconds);
        else
            heldUntilByPetId.set(objectId, now + milliseconds);
    },
    // Tells the server how the user's pets are now: ahead of what would otherwise leave it with an older word (the
    // user's leaving the room).
    tellHowPetsAre: (): void =>
    {
        const room = App.getCurrentRoom();
        if (room != undefined && drives.size > 0)
            tellNeeds(room);
    },
    // The server's word that a battery or a wrench was put into a pet (see InjectPetSignal): told to whatever shows and
    // sounds it, and one played here is the better for it.
    onInjectPetSignalReceived: async (signal: InjectPetSignal): Promise<void> =>
    {
        if (!await App.whenInRoom(signal.roomID))
            return;
        const room = App.getCurrentRoom()!;
        const pet = room.objectById[signal.objectId];
        if (pet == undefined)
            return;
        petInjectedObservable.set({injection: signal.injection, position: {...pet.transform.pos}});
        const drive = drives.get(signal.objectId);
        if (drive != undefined)
            PetBehaviorUtil.inject(drive.behavior, observe(room, signal.objectId), signal.injection);
    },
    // The server's word that someone has spoken to a pet played here, or of what it answers them (see PetChatSignal):
    // it turns to them, and says it.
    onPetChatSignalReceived: async (signal: PetChatSignal): Promise<void> =>
    {
        if (!await App.whenInRoom(signal.roomID))
            return;
        const drive = drives.get(signal.objectId);
        if (drive == undefined)
            return;
        const surroundings = observe(App.getCurrentRoom()!, signal.objectId);
        if (signal.text.length == 0)
            PetBehaviorUtil.attend(drive.behavior, surroundings, signal.speakerObjectId);
        else
            PetBehaviorUtil.answer(drive.behavior, surroundings, signal.speakerObjectId, {text: signal.text, mood: signal.mood});
    },
}

// Moves a pet's body on by a stretch of time its frames left out, steered as its own step is (see Rigidbody). Whether a
// force of the room's had a part in the move.
function stepBody(room: Room, pet: PetGameObject, drive: PetDrive, seconds: number): boolean
{
    const b = drive.behavior;
    b.at = PetBodyUtil.getFeet(pet.position);
    const steering = PetBehaviorUtil.steer(b, seconds);
    const step = PhysicsManager.getStepVelocity(room.id, pet.params.objectId, steering, seconds);
    const pos = pet.position, dir = pet.direction;
    ClientObjectManager.setObjectTransform(pet.params.objectId, new ObjectTransform(
        {x: pos.x + step.velocity.x * seconds, y: pos.y + step.velocity.y * seconds, z: pos.z + step.velocity.z * seconds},
        {x: dir.x, y: dir.y, z: dir.z}, pet.params.transform.scale), false);
    return step.underForce;
}

// A pet of the user's that is theirs no longer, sold or dead: it isn't played, nor brought in again, though their
// record lists it until the server has heard.
function forget(objectId: string): void
{
    soldPetIds.add(objectId);
    drives.delete(objectId);
    needsByPetId.delete(objectId);
    heldUntilByPetId.delete(objectId);
    wayInByPetId.delete(objectId);
}

// The room on screen, once it has come on screen, if pets are played in it: one the server keeps.
function getPlayedRoom(): Room | undefined
{
    const room = App.getCurrentRoom();
    return (room != undefined && room.id == roomID && room.roomType != RoomTypeEnumMap.SinglePlayer) ? room : undefined;
}

function observe(room: Room, objectId: string): PetSurroundings
{
    return PetSurroundingsUtil.seenBy(PetSurroundingsUtil.observe(room, performance.now()), objectId);
}

// The room has just come on screen (again, for one the server sent anew): whichever pets were played are no longer
// there, and all the user owns come in after them, once their player is there (see beat).
function onRoomChanged(): void
{
    drives.clear();
    gustFrightAt.clear();
    soldPetIds.clear();
    deadNeeds.clear();
    heldUntilByPetId.clear();
    wayInByPetId.clear();
    entrance = undefined;
    entranceHeldUntil = 0;
    roomID = App.getCurrentRoom()?.id;
    reportedAt = performance.now();
}

function update(deltaTime: number): void
{
    const room = getPlayedRoom();
    if (room == undefined)
        return;
    secondsSinceBeat += deltaTime;
    const now = performance.now();
    if (now < beatDueAt)
        return;
    // Kept to the clock, a beat a frame late being followed by the next on time: the server passes on what the pets
    // tell at beats as long as these (see SocketsServer), and so has something of each to pass on at nearly every one.
    beatDueAt = (now - beatDueAt > 1000 * BEAT_SECONDS) ? now + 1000 * BEAT_SECONDS : beatDueAt + 1000 * BEAT_SECONDS;
    const seconds = secondsSinceBeat;
    secondsSinceBeat = 0;
    try
    {
        beat(room, seconds, performance.now());
    }
    catch (err)
    {
        console.error("PetDriverUtil :: Failed to play the user's pets", err);
    }
}

function beat(room: Room, seconds: number, now: number): void
{
    // (A camera page, which watches someone else's player, plays nobody's pets.)
    const player = ClientObjectManager.getMyPlayer();
    if (player == undefined || App.getWatchedUserID().length > 0)
        return;
    // From where the user arrived, which is where their player first is.
    entrance ??= PetEntranceUtil.create(room, player.params.transform,
        PetRecordUtil.getPlayerRecords(player.params).map(record => record.petId), now);
    bringIn(room, player.params, now);
    findPets(room, player.params, now);
    if (drives.size == 0)
        return;

    // What the user looks at while editing: the pivot their camera orbits.
    const mode = cameraModeObservable.peek();
    const surroundings: PetSurroundings = {...PetSurroundingsUtil.observe(room, now),
        ownerFocus: (mode.type == "orbit") ? {...mode.target.center} : undefined};
    if (now - gustsCheckedAt >= GUST_CHECK_INTERVAL_MS)
    {
        gustsCheckedAt = now;
        for (const at of PetFrightUtil.findGusts(room, now, gustFrightAt))
            forEachDrive(surroundings, (drive, seen) => PetBehaviorUtil.expose(drive.behavior, seen, at, PET_GUST_FRIGHT));
    }
    let died = false;
    for (const [objectId, drive] of [...drives])
    {
        const pet = room.objectById[objectId];
        if (pet != undefined)
            died = beatPet(room, pet, drive, PetSurroundingsUtil.seenBy(surroundings, objectId), seconds) || died;
    }
    if (died || now - reportedAt >= REPORT_INTERVAL_MS)
        tellNeeds(room);
}

// The next of the user's pets comes into the room, if it can (see PetEntranceUtil.takeNext). One the room has no room
// for waits its turn again. A pet their record lists that is neither in the room nor on its way (one the room lost as
// the server sent it anew) joins those waiting.
function bringIn(room: Room, player: AddObjectSignal, now: number): void
{
    if (entrance == undefined || now < entranceHeldUntil)
        return;
    const records = PetRecordUtil.getPlayerRecords(player);
    for (const record of records)
    {
        if (room.objectById[record.petId] == undefined && !entrance.waiting.includes(record.petId)
            && !soldPetIds.has(record.petId))
        {
            entrance.waiting.push(record.petId);
        }
    }
    const next = PetEntranceUtil.takeNext(room, entrance, now);
    const record = (next == undefined) ? undefined : records.find(owned => owned.petId == next.petId);
    if (next == undefined || record == undefined)
        return;

    entranceHeldUntil = now + ENTRANCE_GAP_MS;
    const transform = new ObjectTransform({...next.pos}, PetBodyUtil.getDir(entrance.spot.facing), {...UNIT_VEC3});
    const metadata = {[ObjectMetadataKeyEnumMap.PetIdentity]: new EncodableByteString(PetIdentityUtil.encode(record.identity))};
    wayInByPetId.set(record.petId, next.way);
    void ClientObjectManager.addOwnObject(PET_TYPE_INDEX, transform, metadata, record.petId).then(pet => {
        if (pet != undefined)
            SocketsClient.emitAddObjectSignal(pet.params);
        // The room has no room for it (as many pets as it holds): it waits its turn again.
        else
        {
            wayInByPetId.delete(record.petId);
            entranceHeldUntil = performance.now() + ENTRANCE_RETRY_MS;
        }
    });
}

// Every pet of the user's in the room is played from the beat after it is all there (see PetGameObject.isSpawned)
// until it is gone.
function findPets(room: Room, player: AddObjectSignal, now: number): void
{
    for (const objectId of [...drives.keys()])
    {
        if (room.objectById[objectId] == undefined)
            drives.delete(objectId);
    }
    const records = PetRecordUtil.getPlayerRecords(player);
    for (const petId of [...soldPetIds])
    {
        if (!records.some(record => record.petId == petId))
            soldPetIds.delete(petId);
    }
    for (const objectId in room.objectById)
    {
        const pet = room.objectById[objectId];
        if (pet.objectTypeIndex != PET_TYPE_INDEX || pet.sourceUserID != App.getUser().id || drives.has(objectId)
            || soldPetIds.has(objectId)
            || !(ClientObjectManager.getObjectById(objectId) as PetGameObject | undefined)?.isSpawned())
        {
            continue;
        }
        // As this browser last had it, or else as the user's record does; a pet just generated has neither yet.
        const needs = needsByPetId.get(objectId) ?? records.find(record => record.petId == objectId)?.needs
            ?? PetNeedsUtil.getFresh();
        const behavior = PetBehaviorUtil.create(objectId, pet.sourceUserID, PetIdentityUtil.getObjectIdentity(pet), needs,
            PetBodyUtil.getFeet(pet.transform.pos), PetBodyUtil.getFacing(pet.transform.dir), now);
        const heldUntil = heldUntilByPetId.get(objectId) ?? 0;
        heldUntilByPetId.delete(objectId);
        if (heldUntil > now)
            PetBehaviorUtil.hold(behavior, now, heldUntil - now);
        PetBehaviorUtil.enter(behavior, wayInByPetId.get(objectId) ?? [], now);
        wayInByPetId.delete(objectId);
        drives.set(objectId, {
            behavior,
            sync: PetPathSyncUtil.create(pet.transform.pos),
            toldState: pet.metadata[ObjectMetadataKeyEnumMap.PetState]?.str ?? "",
            toldSaying: pet.metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str ?? "",
            underForce: false,
            steeredAt: undefined,
            secondsBehind: 0,
        });
    }
}

// A beat of a pet's life, and what the room is then told of it. Whether it died of it.
function beatPet(room: Room, pet: AddObjectSignal, drive: PetDrive, surroundings: PetSurroundings, seconds: number): boolean
{
    const b = drive.behavior;
    b.at = PetBodyUtil.getFeet(pet.transform.pos);
    PetBehaviorUtil.update(b, surroundings, seconds);
    needsByPetId.set(pet.objectId, b.needs);

    const state = PetShownStateUtil.encode(PetBehaviorUtil.getShownState(b));
    if (state != drive.toldState)
    {
        drive.toldState = state;
        tell(room, pet.objectId, ObjectMetadataKeyEnumMap.PetState, state);
    }
    if (b.saying != drive.toldSaying)
    {
        drive.toldSaying = b.saying;
        tell(room, pet.objectId, ObjectMetadataKeyEnumMap.SentMessage, b.saying);
    }
    const waypoints = PetPathSyncUtil.takeWaypoints(drive.sync, b, pet.transform.pos);
    if (waypoints != undefined)
        SocketsClient.emitSetObjectPathSignal(new SetObjectPathSignal(room.id, pet.objectId, waypoints));

    if (!b.dead)
        return false;
    // The server takes it away once told its health has run out (see PetServerUtil.buryTheDead).
    forget(pet.objectId);
    deadNeeds.set(pet.objectId, b.needs);
    return true;
}

// Sets what one of the user's own objects holds under a key, here and on the server.
function tell(room: Room, objectId: string, metadataKey: number, value: string): void
{
    if (ClientObjectManager.setObjectMetadata(objectId, metadataKey, value))
        SocketsClient.emitSetObjectMetadataSignal(new SetObjectMetadataSignal(room.id, objectId, metadataKey, value));
}

// Tells the server how every pet played here is, the dead included, once.
function tellNeeds(room: Room): void
{
    const player = ClientObjectManager.getMyPlayer();
    if (player == undefined)
        return;
    const needs: {[petId: string]: PetNeeds} = {};
    drives.forEach((drive, objectId) => needs[objectId] = drive.behavior.needs);
    deadNeeds.forEach((dead, objectId) => needs[objectId] = dead);
    deadNeeds.clear();
    reportedAt = performance.now();
    if (Object.keys(needs).length > 0)
        tell(room, player.params.objectId, ObjectMetadataKeyEnumMap.Pets, PetRecordUtil.encodeReport(needs));
}

function forEachDrive(surroundings: PetSurroundings, visit: (drive: PetDrive, seen: PetSurroundings) => void): void
{
    drives.forEach((drive, objectId) => visit(drive, PetSurroundingsUtil.seenBy(surroundings, objectId)));
}

// Something built or changed in the room, which a pet near it may have a word for: the user's own doing, watched from
// their camera, or someone else's (otherUserID: whose, where this browser can tell).
function noticeEdit(kind: PetEditKind, at: Vec3, own: boolean, otherUserID: string = ""): void
{
    const room = (drives.size == 0) ? undefined : getPlayedRoom();
    if (room == undefined)
        return;
    const byUserID = own ? App.getUser().id : otherUserID;
    const viewFrom = own ? GraphicsManager.getCamera().getWorldPosition(cameraPosTemp) : undefined;
    forEachDrive(PetSurroundingsUtil.observe(room, performance.now()), (drive, seen) => PetBehaviorUtil.noticeEdit(
        drive.behavior, seen, kind, at, byUserID, (viewFrom == undefined) ? undefined : {...viewFrom}));
}

// Only what a room keeps is built: players and pets come and go of themselves.
function isBuilt(object: AddObjectSignal): boolean
{
    return ObjectTypeConfigMap.getConfigByIndex(object.objectTypeIndex).persistent;
}

function onCannonBlast(blast: {position: Vec3, hitObjectIds: string[]}): void
{
    const room = (drives.size == 0) ? undefined : getPlayedRoom();
    if (room == undefined)
        return;
    forEachDrive(PetSurroundingsUtil.observe(room, performance.now()), (drive, seen) => {
        if (blast.hitObjectIds.includes(drive.behavior.objectId))
            PetBehaviorUtil.takeBlast(drive.behavior, seen);
        PetBehaviorUtil.expose(drive.behavior, seen, blast.position, PET_BLAST_FRIGHT);
    });
}

// Registered on import (see app.ts).
roomChangedObservable.addListener(LISTENER_KEY, onRoomChanged);
updateObservable.addListener(LISTENER_KEY, update);
cannonBlastObservable.addListener(LISTENER_KEY, onCannonBlast);
voxelBlockEditObservable.addListener(LISTENER_KEY, edit => {
    if (edit.kind == "retexture" || !VoxelQueryUtil.isValidVoxelQuadIndex(edit.quadIndex))
        return;
    noticeEdit((edit.kind == "remove") ? "blockRemoved" : "blockAdded",
        VoxelQueryUtil.getVoxelBlockBox(VoxelQueryUtil.getVoxelRowFromQuadIndex(edit.quadIndex),
            VoxelQueryUtil.getVoxelColFromQuadIndex(edit.quadIndex),
            VoxelQueryUtil.getVoxelBlockCollisionLayerFromQuadIndex(edit.quadIndex)).center, edit.own);
});
objectEditObservable.addListener(LISTENER_KEY, edit => {
    const {object, kind, own} = edit;
    // A pet the user takes away is their own, which they sell by it (see PetObjectTypeConfig): it isn't brought in
    // again.
    if (kind == "remove" && own && object.objectTypeIndex == PET_TYPE_INDEX)
        forget(object.objectId);
    if (!isBuilt(object))
        return;
    // Whoever added a thing is its source; of a change or a removal only the user's own is known to be theirs.
    if (kind == "add")
        noticeEdit("objectAdded", object.transform.pos, own, object.sourceUserID);
    else
        noticeEdit((kind == "remove") ? "objectRemoved" : "objectChanged", object.transform.pos, own);
});
objectPlacedObservable.addListener(LISTENER_KEY, placed => {
    if (isBuilt(placed.object))
        noticeEdit("objectChanged", placed.object.transform.pos, placed.own);
});
chatLineObservable.addListener(LISTENER_KEY, line => {
    const room = (drives.size == 0) ? undefined : getPlayedRoom();
    if (room == undefined)
        return;
    forEachDrive(PetSurroundingsUtil.observe(room, performance.now()),
        (drive, seen) => PetBehaviorUtil.hear(drive.behavior, seen, line.userID, line.text));
});

export default PetDriverUtil;
