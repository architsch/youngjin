// What the pets it plays chat in, given to PetLineMap as it loads.
import "../../agent/data/petLines";
import Vec3 from "../../../shared/math/types/vec3";
import NumUtil from "../../../shared/math/util/numUtil";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import PetObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/petObjectTypeConfig";
import ServerPetObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/serverPetObjectTypeConfig";
import { PetEditKind } from "../../../shared/object/types/petEditKind";
import { PetInjection } from "../../../shared/object/types/petInjection";
import PetLine from "../../../shared/object/types/petLine";
import PetNeeds from "../../../shared/object/types/petNeeds";
import PetSurroundings from "../../../shared/object/types/petSurroundings";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import SetObjectPathSignal from "../../../shared/object/types/setObjectPathSignal";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import PetBehaviorUtil, { PET_BLAST_FRIGHT, PET_GUST_FRIGHT } from "../../../shared/object/util/petBehaviorUtil";
import PetBodyUtil from "../../../shared/object/util/petBodyUtil";
import PetEntranceUtil from "../../../shared/object/util/petEntranceUtil";
import PetFrightUtil from "../../../shared/object/util/petFrightUtil";
import PetIdentityUtil from "../../../shared/object/util/petIdentityUtil";
import PetNeedsUtil from "../../../shared/object/util/petNeedsUtil";
import PetOwnerUtil from "../../../shared/object/util/petOwnerUtil";
import PetPathSyncUtil from "../../../shared/object/util/petPathSyncUtil";
import PetRecordUtil from "../../../shared/object/util/petRecordUtil";
import PetSaleUtil from "../../../shared/object/util/petSaleUtil";
import PetShownStateUtil from "../../../shared/object/util/petShownStateUtil";
import PetSurroundingsUtil from "../../../shared/object/util/petSurroundingsUtil";
import PhysicsManager from "../../../shared/physics/physicsManager";
import Room from "../../../shared/room/types/room";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { UNIT_VEC3 } from "../../../shared/system/sharedConstants";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import User from "../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import AgentUserContext from "../../agent/types/agentUserContext";
import ServerRoomManager from "../../room/serverRoomManager";
import ServerLifecycleUtil from "../../system/util/serverLifecycleUtil";
import ServerUserManager from "../../user/serverUserManager";
import ServerObjectManager from "../serverObjectManager";
import PetPlay from "../types/petPlay";
import PetRoomPlay from "../types/petRoomPlay";
import PetServerUtil from "./petServerUtil";

const PET_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(PetObjectTypeConfig.objectType);
const SERVER_PET_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(ServerPetObjectTypeConfig.objectType);
const KEYS = ObjectMetadataKeyEnumMap;
// A body is stepped at a browser's frame rate, as an agent's is (see AgentBodyUtil).
const SUB_STEP_SECONDS = 1 / 60;
const MAX_SUB_STEPS = 30;
const SETTLED_DISTANCE = 1e-4;
// How often how a pet is goes where it is kept: its owner's record, or, for one the room keeps, a save of the room.
const NEEDS_KEEP_INTERVAL_MS = 10_000;
// How often a fan's wind catching a body is looked for (see PetFrightUtil).
const GUST_CHECK_INTERVAL_MS = 600;
const NOBODY = new User("", "", UserTypeEnumMap.Guest, "", "");

// Kept with each room as long as it is loaded, whose unloading forgets it.
const roomPlays = new WeakMap<RoomRuntimeMemory, PetRoomPlay>();

// The pets the server plays, in multiplayer rooms while anyone is there: those a room keeps (see
// ServerPetObjectTypeConfig), and those of the agents in it, whom it also brings them in after (see PetEntranceUtil), as
// a browser does its user's (see PetDriverUtil). Each behaves as PetBehaviorUtil has it, its body stepped by physics as
// an agent's is, and the room is told what a browser would tell it: what the pet shows of itself, what it says, and the
// way it sets off on.
const PetPlayUtil =
{
    // Every played pet, as time passes. From SocketsServer's flush, so what they do goes out with it. They keep still
    // once the server starts shutting down, as its last saves keep them (see keepAll).
    stepAll: (seconds: number): void =>
    {
        if (ServerLifecycleUtil.isShuttingDown())
            return;
        const now = Date.now();
        for (const memory of Object.values(ServerRoomManager.roomRuntimeMemories))
        {
            try
            {
                if (memory.room.roomType != RoomTypeEnumMap.SinglePlayer && Object.keys(memory.participantUserNameByID).length > 0)
                    stepRoom(memory, seconds, now);
            }
            catch (err)
            {
                console.error(`PetPlayUtil.stepAll :: (roomID = ${memory.room.id}) Error: ${ErrorUtil.getErrorMessage(err)}`);
            }
        }
    },
    // A cannon ball's blast reaching a body (see CannonBallUtil): whether it is a pet played here, which is then thrown
    // as a browser throws its own, and the worse for it.
    blast: (room: Room, body: AddObjectSignal, velocity: Vec3): boolean =>
    {
        const play = findPlays(room)?.pets.get(body.objectId);
        if (play == undefined)
            return false;
        PhysicsManager.addCarriedVelocity(room.id, body.objectId, velocity);
        play.settled = false;
        PetBehaviorUtil.takeBlast(play.behavior, PetSurroundingsUtil.observe(room, Date.now()));
        return true;
    },
    // A cannon ball has burst: a fright to the pets played here that are near it.
    noteBurst: (room: Room, at: Vec3): void =>
    {
        forEachPlay(room, (play, surroundings) => PetBehaviorUtil.expose(play.behavior, surroundings, at, PET_BLAST_FRIGHT));
    },
    // A battery or a wrench has been put into a pet (see PetServerUtil): one played here is the better for it.
    inject: (room: Room, pet: AddObjectSignal, injection: PetInjection): void =>
    {
        const play = findPlays(room)?.pets.get(pet.objectId);
        if (play != undefined)
        {
            PetBehaviorUtil.inject(play.behavior, PetSurroundingsUtil.seenBy(
                PetSurroundingsUtil.observe(room, Date.now()), pet.objectId), injection);
        }
    },
    // A line a user has just said in their room, which a pet played here may be named in.
    hear: (userID: string, text: string): void =>
    {
        const room = getRoomOfUser(userID);
        if (room != undefined && text.trim().length > 0)
            forEachPlay(room, (play, surroundings) => PetBehaviorUtil.hear(play.behavior, surroundings, userID, text));
    },
    // Someone speaking to a pet (see PetChatUtil), by their player's object, and then what it answers them: whether
    // the pet is one played here, which then turns to them, and says it.
    attend: (room: Room, petObjectId: string, speakerObjectId: string): boolean =>
    {
        const play = findPlays(room)?.pets.get(petObjectId);
        if (play != undefined)
            PetBehaviorUtil.attend(play.behavior, observeFor(room, petObjectId), speakerObjectId);
        return play != undefined;
    },
    answer: (room: Room, petObjectId: string, speakerObjectId: string, line: PetLine): boolean =>
    {
        const play = findPlays(room)?.pets.get(petObjectId);
        if (play != undefined)
            PetBehaviorUtil.answer(play.behavior, observeFor(room, petObjectId), speakerObjectId, line);
        return play != undefined;
    },
    // Something a user has just built or changed in their room, which a pet played here may have a word for: a block,
    // by one of its faces, or an object the room holds as this is called.
    noteBlockEdit: (userID: string, kind: PetEditKind, quadIndex: number): void =>
    {
        if (!VoxelQueryUtil.isValidVoxelQuadIndex(quadIndex))
            return;
        noteEdit(userID, kind, VoxelQueryUtil.getVoxelBlockBox(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
            VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex),
            VoxelQueryUtil.getVoxelBlockCollisionLayerFromQuadIndex(quadIndex)).center);
    },
    noteObjectEdit: (userID: string, kind: PetEditKind, objectId: string): void =>
    {
        const obj = getRoomOfUser(userID)?.objectById[objectId];
        if (obj != undefined)
            noteEdit(userID, kind, obj.transform.pos);
    },
    // A user just sent the room they come into (see ServerRoomManager.changeUserRoom): the rest of the way each pet
    // played here is on.
    tellNewcomer: (roomID: string, userID: string): void =>
    {
        const room = ServerRoomManager.roomRuntimeMemories[roomID]?.room;
        for (const [objectId, play] of (room == undefined) ? [] : (findPlays(room)?.pets ?? []))
        {
            if (play.sync.next < play.sync.waypoints.length)
            {
                ServerRoomManager.socketRoomContexts[roomID].unicastSignal("setObjectPathSignal",
                    new SetObjectPathSignal(roomID, objectId, play.sync.waypoints.slice(play.sync.next)), userID);
            }
        }
    },
    // A room sent whole again, its contents replaced (see ServerRoomManager.loadRoomFile): its pets are taken up anew
    // from what it now holds, and those of the agents in it, gone with the old room, come in again.
    restart: (roomID: string): void =>
    {
        const memory = ServerRoomManager.roomRuntimeMemories[roomID];
        if (memory != undefined)
            roomPlays.delete(memory);
    },
    // A user about to leave their room: how the pets played here for them are goes into their record first, which is
    // then saved with their player (see ServerUserManager.removeUserFromRoom).
    noteLeaving: (roomID: string, userID: string): void =>
    {
        const room = ServerRoomManager.roomRuntimeMemories[roomID]?.room;
        if (room != undefined)
            keepOwnersPets(room, userID);
    },
    // Ahead of the shutdown's saves: how every pet played here is goes where it is kept, and each room keeping pets of
    // its own is marked as changed, which those saves take only such rooms for.
    keepAll: (): void =>
    {
        for (const memory of Object.values(ServerRoomManager.roomRuntimeMemories))
        {
            const plays = roomPlays.get(memory);
            for (const [objectId, play] of plays?.pets ?? [])
            {
                const pet = memory.room.objectById[objectId];
                if (pet == undefined)
                    continue;
                if (pet.objectTypeIndex == SERVER_PET_TYPE_INDEX)
                    keepRoomsPet(memory.room, pet, play, Date.now(), true);
                else
                    keepOwnersPets(memory.room, pet.sourceUserID);
            }
        }
    },
    // How a pet played here is, by its object's id; undefined for any other.
    getNeeds: (room: Room, objectId: string): PetNeeds | undefined =>
    {
        const needs = findPlays(room)?.pets.get(objectId)?.behavior.needs;
        return (needs == undefined) ? undefined : {...needs};
    },
}

function getRoomOfUser(userID: string): Room | undefined
{
    return ServerRoomManager.roomRuntimeMemories[ServerRoomManager.currentRoomIDByUserID[userID]]?.room;
}

function noteEdit(userID: string, kind: PetEditKind, at: Vec3): void
{
    const room = getRoomOfUser(userID);
    if (room != undefined)
        forEachPlay(room, (play, surroundings) => PetBehaviorUtil.noticeEdit(play.behavior, surroundings, kind, at, userID));
}

function findPlays(room: Room): PetRoomPlay | undefined
{
    const memory = ServerRoomManager.roomRuntimeMemories[room.id];
    return (memory == undefined) ? undefined : roomPlays.get(memory);
}

// A room as one of its pets finds it now.
function observeFor(room: Room, petObjectId: string): PetSurroundings
{
    return PetSurroundingsUtil.seenBy(PetSurroundingsUtil.observe(room, Date.now()), petObjectId);
}

// Each pet played in a room, with the room as that pet finds it now.
function forEachPlay(room: Room, visit: (play: PetPlay, surroundings: PetSurroundings) => void): void
{
    const plays = findPlays(room);
    if (plays == undefined || plays.pets.size == 0)
        return;
    const surroundings = PetSurroundingsUtil.observe(room, Date.now());
    for (const [objectId, play] of plays.pets)
        visit(play, PetSurroundingsUtil.seenBy(surroundings, objectId));
}

function stepRoom(memory: RoomRuntimeMemory, seconds: number, now: number): void
{
    const room = memory.room;
    let plays = roomPlays.get(memory);
    if (plays == undefined)
    {
        roomPlays.set(memory, plays = {pets: new Map(), entrances: new Map(), waysIn: new Map(), gustFrightAt: new Map(),
            gustsCheckedAt: now});
    }

    bringInAgentsPets(memory, plays, now);
    findPets(room, plays, now);
    if (plays.pets.size == 0)
        return;

    const surroundings = PetSurroundingsUtil.observe(room, now);
    if (now - plays.gustsCheckedAt >= GUST_CHECK_INTERVAL_MS)
    {
        plays.gustsCheckedAt = now;
        for (const at of PetFrightUtil.findGusts(room, now, plays.gustFrightAt))
        {
            for (const [objectId, play] of plays.pets)
                PetBehaviorUtil.expose(play.behavior, PetSurroundingsUtil.seenBy(surroundings, objectId), at, PET_GUST_FRIGHT);
        }
    }
    for (const [objectId, play] of [...plays.pets])
    {
        const pet = room.objectById[objectId];
        if (pet != undefined && stepPet(room, pet, play, PetSurroundingsUtil.seenBy(surroundings, objectId), seconds, now))
            plays.pets.delete(objectId);
    }
}

// Each agent's pets come into the room after it, one at a time, as its record of them stood when it arrived.
function bringInAgentsPets(memory: RoomRuntimeMemory, plays: PetRoomPlay, now: number): void
{
    const room = memory.room;
    for (const userID of [...plays.entrances.keys()])
    {
        if (memory.participantUserNameByID[userID] == undefined)
            plays.entrances.delete(userID);
    }
    for (const userID of Object.keys(memory.participantUserNameByID))
    {
        const ctx = ServerUserManager.getSocketUserContext(userID);
        const player = ServerUserManager.getPlayerObject(userID);
        if (!(ctx instanceof AgentUserContext) || player == undefined || room.objectById[player.objectId] != player)
            continue;
        let arrival = plays.entrances.get(userID);
        if (arrival == undefined || arrival.playerObjectId != player.objectId)
        {
            arrival = {playerObjectId: player.objectId, entrance: PetEntranceUtil.create(room, player.transform,
                PetRecordUtil.getPlayerRecords(player).map(record => record.petId), now)};
            plays.entrances.set(userID, arrival);
        }
        const next = PetEntranceUtil.takeNext(room, arrival.entrance, now);
        const record = (next == undefined) ? undefined
            : PetRecordUtil.getPlayerRecords(player).find(owned => owned.petId == next.petId);
        if (next == undefined || record == undefined)
            continue;
        plays.waysIn.set(record.petId, next.way);
        ServerObjectManager.addObjectAsServer(room, ctx.user, new AddObjectSignal(room.id, userID, ctx.user.userName,
            PET_TYPE_INDEX, record.petId, new ObjectTransform({...next.pos}, PetBodyUtil.getDir(arrival.entrance.spot.facing),
                {...UNIT_VEC3}),
            {[KEYS.PetIdentity]: new EncodableByteString(PetIdentityUtil.encode(record.identity))}));
    }
}

// Every pet the room keeps and every pet of an agent in it is played from the step after it is there until it is gone.
function findPets(room: Room, plays: PetRoomPlay, now: number): void
{
    const numPets = room.objectGroup.getCategoryCount(PetObjectTypeConfig.category)
        + room.objectGroup.getCategoryCount(ServerPetObjectTypeConfig.category);
    if (numPets == 0 && plays.pets.size == 0)
        return;

    const found = new Set<string>();
    for (const objectId in room.objectById)
    {
        const obj = room.objectById[objectId];
        if (!isPlayedHere(obj))
            continue;
        found.add(objectId);
        if (!plays.pets.has(objectId))
        {
            const play = newPlay(room, obj, now);
            PetBehaviorUtil.enter(play.behavior, plays.waysIn.get(objectId) ?? [], now);
            plays.pets.set(objectId, play);
        }
    }
    plays.waysIn.clear();
    for (const objectId of [...plays.pets.keys()])
    {
        if (!found.has(objectId))
            plays.pets.delete(objectId);
    }
}

function isPlayedHere(obj: AddObjectSignal): boolean
{
    return obj.objectTypeIndex == SERVER_PET_TYPE_INDEX || (obj.objectTypeIndex == PET_TYPE_INDEX
        && ServerUserManager.getSocketUserContext(obj.sourceUserID) instanceof AgentUserContext);
}

// A pet taken up as it is kept: one of the room's by its own PetNeeds, an agent's by its owner's record.
function newPlay(room: Room, pet: AddObjectSignal, now: number): PetPlay
{
    const needs = (pet.objectTypeIndex == SERVER_PET_TYPE_INDEX)
        ? PetNeedsUtil.decode(pet.metadata[KEYS.PetNeeds]?.str ?? "")
        : (PetOwnerUtil.findRecord(room, pet.sourceUserID, pet.objectId)?.needs ?? PetNeedsUtil.getFresh());
    return {
        behavior: PetBehaviorUtil.create(pet.objectId, pet.sourceUserID, PetIdentityUtil.getObjectIdentity(pet), needs,
            PetBodyUtil.getFeet(pet.transform.pos), PetBodyUtil.getFacing(pet.transform.dir), now),
        sync: PetPathSyncUtil.create(pet.transform.pos),
        toldState: pet.metadata[KEYS.PetState]?.str ?? "",
        toldSaying: pet.metadata[KEYS.SentMessage]?.str ?? "",
        settled: false, underForce: false, toldPrice: -1, keptAt: now,
    };
}

// A pet's step: its body, a beat of its life, what the room is told of it, and its end. Whether it died.
function stepPet(room: Room, pet: AddObjectSignal, play: PetPlay, surroundings: PetSurroundings, seconds: number,
    now: number): boolean
{
    const b = play.behavior;
    const pos = stepBody(room, pet, play, surroundings, seconds);
    PetBehaviorUtil.update(b, surroundings, seconds);

    const state = PetShownStateUtil.encode(PetBehaviorUtil.getShownState(b));
    if (state != play.toldState)
    {
        play.toldState = state;
        PetServerUtil.tell(room, pet, KEYS.PetState, state);
    }
    if (b.saying != play.toldSaying)
    {
        play.toldSaying = b.saying;
        PetServerUtil.tell(room, pet, KEYS.SentMessage, b.saying);
    }
    PetPathSyncUtil.advance(play.sync, seconds);
    const waypoints = PetPathSyncUtil.takeWaypoints(play.sync, b, pos);
    if (waypoints != undefined)
    {
        ServerRoomManager.socketRoomContexts[room.id].multicastSignal("setObjectPathSignal",
            new SetObjectPathSignal(room.id, pet.objectId, waypoints));
    }

    if (b.dead)
    {
        PetServerUtil.bury(room, pet);
        return true;
    }
    if (pet.objectTypeIndex == SERVER_PET_TYPE_INDEX)
        keepRoomsPet(room, pet, play, now, false);
    else if (now - play.keptAt >= NEEDS_KEEP_INTERVAL_MS)
    {
        play.keptAt = now;
        keepOwnersPets(room, pet.sourceUserID);
    }
    return false;
}

// Moves a pet's body on by the time since the last flush, in steps each steered by its behavior, and leaves the room's
// copy of it where they end: its middle, which is returned. One lying still takes a single step, which lets it fall.
function stepBody(room: Room, pet: AddObjectSignal, play: PetPlay, surroundings: PetSurroundings, seconds: number): Vec3
{
    const b = play.behavior;
    const active = b.path.length > 0 || !play.settled;
    const numSteps = active ? NumUtil.clampInRange(Math.round(seconds / SUB_STEP_SECONDS), 1, MAX_SUB_STEPS) : 1;
    let pos = {...pet.transform.pos};
    let moved = 0;
    let underForce = false;
    for (let i = 0; i < numSteps; ++i)
    {
        b.at = PetBodyUtil.getFeet(pos);
        const steering = PetBehaviorUtil.steer(b, SUB_STEP_SECONDS);
        const step = PhysicsManager.getStepVelocity(room.id, pet.objectId, steering, SUB_STEP_SECONDS);
        const target = new ObjectTransform(Vector3DUtil.add(pos, Vector3DUtil.scale(step.velocity, SUB_STEP_SECONDS)),
            PetBodyUtil.getDir(b.facing), pet.transform.scale);
        const resolved = PhysicsManager.setObjectTransform(room.id, pet.objectId, target, false).transform.pos;
        moved += Math.sqrt(Vector3DUtil.distSqr(pos, resolved));
        pos = {...resolved};
        underForce = underForce || step.underForce;
        PetPathSyncUtil.trace(play.sync, pos, seconds / numSteps);
    }
    b.at = PetBodyUtil.getFeet(pos);
    Object.assign(pet.transform.pos, pos);
    Object.assign(pet.transform.dir, PetBodyUtil.getDir(b.facing));

    play.settled = moved < SETTLED_DISTANCE && !underForce;
    if (underForce && !play.underForce)
        PetBehaviorUtil.takePush(b, surroundings);
    play.underForce = underForce;
    return pos;
}

// How a pet the room keeps is goes into its PetNeeds, which the room is told whenever what it sells for changes (see
// PetSaleUtil), and the room is marked as changed now and then, so that a save takes where the pet is and how.
function keepRoomsPet(room: Room, pet: AddObjectSignal, play: PetPlay, now: number, markNow: boolean): void
{
    const needs = PetNeedsUtil.encode(play.behavior.needs);
    const price = PetSaleUtil.getPrice(play.behavior.needs.health);
    if (price != play.toldPrice)
    {
        play.toldPrice = price;
        PetServerUtil.tell(room, pet, KEYS.PetNeeds, needs);
    }
    else
        pet.metadata[KEYS.PetNeeds] = new EncodableByteString(needs);
    if (markNow || now - play.keptAt >= NEEDS_KEEP_INTERVAL_MS)
    {
        play.keptAt = now;
        room.dirty = true;
    }
}

// How the pets played here for a user are goes into their record of them, as a browser's report would (see
// PetRecordUtil.encodeReport). Nobody else is told: only its owner's player acts on it, and that is here.
function keepOwnersPets(room: Room, userID: string): void
{
    const plays = findPlays(room);
    const player = PetOwnerUtil.findPlayer(room, userID);
    if (plays == undefined || player == undefined)
        return;
    const needsByPetId: {[petId: string]: PetNeeds} = {};
    for (const [objectId, play] of plays.pets)
    {
        if (play.behavior.ownerUserID == userID && room.objectById[objectId]?.objectTypeIndex == PET_TYPE_INDEX)
            needsByPetId[objectId] = play.behavior.needs;
    }
    if (Object.keys(needsByPetId).length > 0)
    {
        ObjectUpdateUtil.setObjectMetadata(NOBODY, room, new SetObjectMetadataSignal(room.id, player.objectId, KEYS.Pets,
            PetRecordUtil.encodeReport(needsByPetId)), false);
    }
}

export default PetPlayUtil;
