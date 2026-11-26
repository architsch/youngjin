import { InventoryItemTypeEnumMap } from "../../../shared/inventory/types/inventoryItemType";
import Vec3 from "../../../shared/math/types/vec3";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import InjectPetSignal from "../../../shared/object/types/injectPetSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import PetObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/petObjectTypeConfig";
import PetScrapObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/petScrapObjectTypeConfig";
import ServerPetObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/serverPetObjectTypeConfig";
import { PetActionEnumMap } from "../../../shared/object/types/petAction";
import { PetExpressionEnumMap } from "../../../shared/object/types/petExpression";
import { PetInjectionEnumMap } from "../../../shared/object/types/petInjection";
import PetRecord from "../../../shared/object/types/petRecord";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import NpcFacingUtil from "../../../shared/object/util/npcFacingUtil";
import ObjectAttachmentUtil from "../../../shared/object/util/objectAttachmentUtil";
import ObjectIdUtil from "../../../shared/object/util/objectIdUtil";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import { PET_WRENCH_HEALTH } from "../../../shared/object/util/petBehaviorUtil";
import PetBodyUtil from "../../../shared/object/util/petBodyUtil";
import PetIdentityUtil from "../../../shared/object/util/petIdentityUtil";
import PetInjectionUtil from "../../../shared/object/util/petInjectionUtil";
import PetNeedsUtil from "../../../shared/object/util/petNeedsUtil";
import PetOwnerUtil from "../../../shared/object/util/petOwnerUtil";
import PetRecordUtil from "../../../shared/object/util/petRecordUtil";
import PetSaleUtil from "../../../shared/object/util/petSaleUtil";
import PetShownStateUtil, { PET_BATTERY_LEVELS, PET_RUST_LEVELS } from "../../../shared/object/util/petShownStateUtil";
import Room from "../../../shared/room/types/room";
import { DIR_VEC_BY_NAME, UNIT_VEC3 } from "../../../shared/system/sharedConstants";
import LogUtil from "../../../shared/system/util/logUtil";
import User from "../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import VoxelPathUtil from "../../../shared/voxel/util/voxelPathUtil";
import DBInventoryUtil from "../../db/util/dbInventoryUtil";
import DBPetUtil from "../../db/util/dbPetUtil";
import DBUserWriteQueueUtil from "../../db/util/dbUserWriteQueueUtil";
import ServerInventoryManager from "../../inventory/serverInventoryManager";
import ServerRoomManager from "../../room/serverRoomManager";
import UserContext from "../../sockets/types/userContext";
import ServerUserManager from "../../user/serverUserManager";
import ServerObjectManager from "../serverObjectManager";
import PetPlayUtil from "./petPlayUtil";

const PET_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(PetObjectTypeConfig.objectType);
const SERVER_PET_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(ServerPetObjectTypeConfig.objectType);
const SCRAP_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(PetScrapObjectTypeConfig.objectType);
const DOLLAR = InventoryItemTypeEnumMap.Dollar;
// How many steps of rust a wrench takes off what a pet shows, at the least: what its health then shows by itself follows.
const RUST_LEVELS_PER_WRENCH = Math.floor(PET_WRENCH_HEALTH * PET_RUST_LEVELS);
// How far from where a pet died, in grid vertices and layers, a floor is looked for to leave its scrap on.
const SCRAP_SEARCH_RADIUS = 6;
// How many times a write of a user's pets that fails is tried, and how long it waits before each further try.
const SAVE_ATTEMPTS = 3;
const SAVE_RETRY_MS = 500;
const UP = DIR_VEC_BY_NAME["+y"];
// What the server sets of its own accord, it sets as nobody in particular.
const NOBODY = new User("", "", UserTypeEnumMap.Guest, "", "");

// The server's part in pets (see PetObjectTypeConfig): which pets each user owns, which is the server's alone to change
// (see PetRecordUtil), what they pay and are paid for them, what becomes of one that dies, and what is put into one,
// for dollars. How a pet behaves is whoever plays it's: its owner's browser, or the server (see PetPlayUtil).
//
// A user's record of their pets is their player's Pets metadata, and so part of what their row keeps of their player
// (see ServerUserManager). Each change of which pets it lists is made there at once and written to the row at once, with
// the dollars that go with it, in turn with the user's other writes (see DBUserWriteQueueUtil).
const PetServerUtil =
{
    // Whether adding the object is a user's generating a pet that will follow them: one their record doesn't list.
    isAdoption: (room: Room, obj: AddObjectSignal): boolean =>
    {
        return obj.objectTypeIndex == PET_TYPE_INDEX
            && PetOwnerUtil.findRecord(room, obj.sourceUserID, obj.objectId) == undefined;
    },
    // Whether an add a user's browser sent is one of their pets coming into the room after them.
    isComingIn: (ctx: UserContext, obj: AddObjectSignal): boolean =>
    {
        const room = getRoomOf(ctx);
        return room != undefined && obj.objectTypeIndex == PET_TYPE_INDEX
            && PetOwnerUtil.findRecord(room, ctx.user.id, obj.objectId) != undefined;
    },
    // Whether a value a user's browser sets is its telling of a pet it plays (what the pet shows or says, or how the
    // user's pets are) rather than anything the user did.
    isWordOfPet: (ctx: UserContext, signal: SetObjectMetadataSignal): boolean =>
    {
        return signal.metadataKey == ObjectMetadataKeyEnumMap.Pets
            || PetOwnerUtil.isPet(getRoomOf(ctx)?.objectById[signal.objectId]);
    },
    // Whether the user's record can take a pet: only if their player arrived with it (see
    // ServerUserManager.hasReadPlayerMetadata), or the pets their row still keeps would be written over with this one.
    canAdopt: (ctx: UserContext): boolean =>
    {
        return ServerUserManager.hasReadPlayerMetadata(ctx.user.id);
    },
    // A pet its user has just generated and put in the room, for dollars already taken from what they hold (see
    // ServerInventoryManager.spendDollars): theirs from now on.
    adopt: (ctx: UserContext, room: Room, pet: AddObjectSignal, price: number): void =>
    {
        const records = PetOwnerUtil.getRecords(room, ctx.user.id);
        records.push({petId: pet.objectId, identity: PetIdentityUtil.getObjectIdentity(pet), needs: PetNeedsUtil.getFresh()});
        keep(room, ctx.user.id, records, -price);
    },
    // The object, if removing it is its owner selling a pet (see sell).
    findPetSoldBy: (user: User, room: Room, objectId: string): AddObjectSignal | undefined =>
    {
        const obj = room.objectById[objectId];
        return (PetOwnerUtil.isPet(obj) && obj.sourceUserID == user.id) ? obj : undefined;
    },
    // A pet its owner has just removed from the room, which sells it: they are paid what it is worth in the health it
    // was last known to be in (see PetSaleUtil), and it is theirs no longer.
    sell: (ctx: UserContext, room: Room, pet: AddObjectSignal): void =>
    {
        if (pet.objectTypeIndex == SERVER_PET_TYPE_INDEX)
        {
            const needs = PetNeedsUtil.decode(pet.metadata[ObjectMetadataKeyEnumMap.PetNeeds]?.str ?? "");
            ServerInventoryManager.addItem(ctx, DOLLAR, PetSaleUtil.getPrice(needs.health));
            return;
        }
        const records = PetOwnerUtil.getRecords(room, ctx.user.id);
        const record = records.find(owned => owned.petId == pet.objectId);
        if (record == undefined)
            return;
        // In the health the server plays it in (an agent's), or its owner's browser last told.
        const price = PetSaleUtil.getPrice((PetPlayUtil.getNeeds(room, pet.objectId) ?? record.needs).health);
        ServerInventoryManager.addItem(ctx, DOLLAR, price, false);
        keep(room, ctx.user.id, records.filter(owned => owned != record), price);
    },
    // After a user's word on how their pets are (see PetRecordUtil.encodeReport): each one in the room that has run
    // out of health dies.
    buryTheDead: (ctx: UserContext, room: Room): void =>
    {
        for (const record of PetOwnerUtil.getRecords(room, ctx.user.id))
        {
            const pet = room.objectById[record.petId];
            if (record.needs.health <= 0 && pet != undefined && pet.objectTypeIndex == PET_TYPE_INDEX
                && pet.sourceUserID == ctx.user.id)
            {
                PetServerUtil.bury(room, pet);
            }
        }
    },
    // A pet that has run out of health: shown dead, then taken away, with its scrap left on the floor where it stood,
    // or the nearest floor that takes it, if any does (see PetScrapObjectTypeConfig); and its owner's no longer.
    bury: (room: Room, pet: AddObjectSignal): void =>
    {
        const owner = getOwner(pet);
        const shown = {...PetShownStateUtil.getObjectState(pet), action: PetActionEnumMap.Dead,
            expression: PetExpressionEnumMap.Off, targetId: ""};
        PetServerUtil.tell(room, pet, ObjectMetadataKeyEnumMap.SentMessage, "");
        PetServerUtil.tell(room, pet, ObjectMetadataKeyEnumMap.PetState, PetShownStateUtil.encode(shown));

        leaveScrap(room, owner, pet);
        ServerObjectManager.removeObjectAsServer(room, owner, new RemoveObjectSignal(room.id, pet.objectId));
        if (pet.objectTypeIndex != PET_TYPE_INDEX)
            return;
        const records = PetOwnerUtil.getRecords(room, pet.sourceUserID);
        if (records.some(owned => owned.petId == pet.objectId))
            keep(room, pet.sourceUserID, records.filter(owned => owned.petId != pet.objectId), 0);
    },
    // Someone's asking to put a battery or a wrench into a pet in their room (see InjectPetSignal): whether they did.
    // It goes in if the pet would be the better for it (see PetInjectionUtil.canInject) and they have the dollars it
    // costs, which are taken. The room is told, whoever asked included, and whoever plays the pet makes it the better
    // for it: its owner's browser at that word, or the server (see PetPlayUtil). What the pet shows is set at once to
    // about what it will show by itself, so that the next to ask finds it as it now is.
    onInjectPetSignalReceived: (ctx: UserContext, signal: InjectPetSignal): boolean =>
    {
        const room = getRoomOf(ctx);
        const pet = room?.objectById[signal.objectId];
        if (room == undefined || pet == undefined || !PetInjectionUtil.isInjection(signal.injection)
            || !PetInjectionUtil.canInject(pet, signal.injection)
            || !ServerInventoryManager.spendDollars(ctx, PetInjectionUtil.getPrice(signal.injection)))
        {
            return false;
        }
        const shown = PetShownStateUtil.getObjectState(pet);
        if (signal.injection == PetInjectionEnumMap.Battery)
            Object.assign(shown, {batteryLevel: PET_BATTERY_LEVELS, powerless: false});
        else
            shown.rust = Math.max(0, shown.rust - RUST_LEVELS_PER_WRENCH);
        PetServerUtil.tell(room, pet, ObjectMetadataKeyEnumMap.PetState, PetShownStateUtil.encode(shown));
        ServerRoomManager.socketRoomContexts[room.id].multicastSignal("injectPetSignal",
            new InjectPetSignal(room.id, pet.objectId, signal.injection));
        PetPlayUtil.inject(room, pet, signal.injection);
        return true;
    },
    // Sets what an object holds under a key, of the server's own accord, and tells the room.
    tell: (room: Room, obj: AddObjectSignal, metadataKey: number, value: string): void =>
    {
        const signal = new SetObjectMetadataSignal(room.id, obj.objectId, metadataKey, value);
        ObjectUpdateUtil.setObjectMetadata(NOBODY, room, signal, false);
        ServerRoomManager.socketRoomContexts[room.id]?.multicastSignal("setObjectMetadataSignal", signal);
    },
}

// The room the user is in on the server, which a single-player user has none of.
function getRoomOf(ctx: UserContext): Room | undefined
{
    return ServerRoomManager.roomRuntimeMemories[ServerRoomManager.currentRoomIDByUserID[ctx.user.id]]?.room;
}

// Makes a user's record what it is given, on their player, for everyone in the room, and in their row, with a change in
// their dollars. Nothing for a user who isn't in the room, who has no pet there either.
function keep(room: Room, userID: string, records: PetRecord[], dollarsChange: number): void
{
    const player = PetOwnerUtil.findPlayer(room, userID);
    if (player == undefined)
        return;
    const pets = PetRecordUtil.encode(records);
    PetServerUtil.tell(room, player, ObjectMetadataKeyEnumMap.Pets, pets);
    if (ServerUserManager.hasReadPlayerMetadata(userID))
        void DBUserWriteQueueUtil.run(userID, () => save(userID, pets, dollarsChange));
}

// Written again if it fails. One that still fails leaves the pets to the next write of them, which holds all of them
// (the next change, or the user's leaving the room), and the dollars to a write of their own.
async function save(userID: string, pets: string, dollarsChange: number): Promise<void>
{
    for (let attempt = 0; attempt < SAVE_ATTEMPTS; ++attempt)
    {
        if (attempt > 0)
            await new Promise(resolve => setTimeout(resolve, SAVE_RETRY_MS * attempt));
        if (await DBPetUtil.savePets(userID, pets, dollarsChange))
            return;
    }
    LogUtil.log("PetServerUtil - a user's pets were not saved", {userID, dollarsChange}, "high", "error");
    if (dollarsChange != 0)
        await DBInventoryUtil.addItem(userID, DOLLAR, dollarsChange);
}

// Whoever made a pet: as they are connected, or else as the pet has them, a user like any other.
function getOwner(pet: AddObjectSignal): User
{
    return ServerUserManager.getSocketUserContext(pet.sourceUserID)?.user
        ?? new User(pet.sourceUserID, pet.sourceUserName, UserTypeEnumMap.Guest, "", "");
}

// The dead pet's scrap, under its name and facing the way it faced: on the floor it stood on, or else on the nearest
// floor that takes one. None where no floor near does (in the air, in a restricted zone its owner may not build in, or
// with as much scrap in the room already as it holds).
function leaveScrap(room: Room, owner: User, pet: AddObjectSignal): void
{
    const metadata = {
        [ObjectMetadataKeyEnumMap.PetIdentity]: new EncodableByteString(PetIdentityUtil.encode(
            PetIdentityUtil.getObjectIdentity(pet))),
        [ObjectMetadataKeyEnumMap.Facing]: new EncodableByteString(NpcFacingUtil.encode(
            PetBodyUtil.getFacing(pet.transform.dir))),
    };
    const objectId = ObjectIdUtil.generateUniqueObjectId(room.objectById);
    const makeScrap = (transform: ObjectTransform) => new AddObjectSignal(room.id, pet.sourceUserID, pet.sourceUserName,
        SCRAP_TYPE_INDEX, objectId, transform, {...metadata});
    const findSpot = (floorPoint: Vec3) => ObjectAttachmentUtil.findPlacement(room, SCRAP_TYPE_INDEX, floorPoint, UP,
        {...UNIT_VEC3}, transform => ObjectUpdateUtil.canAddObject(owner, room, makeScrap(transform), true));

    const feet = PetBodyUtil.getFeet(pet.transform.pos);
    let spot = findSpot(feet);
    if (spot == undefined)
    {
        const vertex = VoxelPathUtil.findStandingVertexNear(room.voxelGrid.voxels, feet, SCRAP_SEARCH_RADIUS,
            candidate => findSpot(VoxelPathUtil.toWorld(candidate)) != undefined);
        spot = (vertex == undefined) ? undefined : findSpot(VoxelPathUtil.toWorld(vertex));
    }
    if (spot != undefined)
        ServerObjectManager.addObjectAsServer(room, owner, makeScrap(spot));
}

export default PetServerUtil;
