/**
 * Integration tests: pets (see @docs/gameplay/pet.md) — who a pet is, what it shows and how it is, each kept through
 * its encoding and decoded from anything; a user's record of their pets, which a report changes only the needs of; what
 * a pet sells for and what goes into one; how one behaves (running down, out of battery, failing, kept at a fixed
 * health and charge, called by name, held still, panicking and calming down, blasted, attacked, frightened from afar,
 * held up by a fan's wind and getting out of it, wandering within its leash, noticing its owner's edits above a stranger's and going to speak of one in front of it,
 * reacting only a moment after, turning to its way before it goes, going up to someone (to hug them, or at their call)
 * straight for a little way off where they are now and round a wall between, and keeping that far off them, setting off on
 * any way from where it stands, its way told a stretch at a time, its body told as where it has been once physics has it
 * off that way, backing off from a pet it chats with right against it, staying turned to whom it speaks to while its
 * words are up, keeping quiet between its doings, its words up long after they are read and its face
 * in their mood a while after, asleep with its eyes shut, its lines varied, seldom repeated and now and then on a
 * writing, and turning to and answering whoever speaks to it); ways that climb two blocks for a pet and one for a
 * player, up and down a stair, and farther the more curious it is; how it looks (its rust, its name's labels);
 * coming in after its owner, out of the door they came by; and,
 * through the real server modules: buying one, bringing it in again for nothing, reporting, selling, dying and its
 * scrap, injecting a battery and a wrench, an admin's room pets, a cannon that turns after no pet, a fan that throws a
 * pet up, and a user's record
 * surviving leaving, coming back, a row that can't be read and a shutdown.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import fs from "fs";
import path from "path";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { getPendingSignals } from "../helpers/invariants";
import DBPetUtil from "../../../src/server/db/util/dbPetUtil";
import DBUserUtil from "../../../src/server/db/util/dbUserUtil";
import DBUserWriteQueueUtil from "../../../src/server/db/util/dbUserWriteQueueUtil";
import DollarBillFlightUtil from "../../../src/server/inventory/util/dollarBillFlightUtil";
import CannonUtil from "../../../src/server/object/util/cannonUtil";
import PetPlayUtil from "../../../src/server/object/util/petPlayUtil";
import PetServerUtil from "../../../src/server/object/util/petServerUtil";
import ServerObjectManager from "../../../src/server/object/serverObjectManager";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import { InventoryItemTypeEnumMap } from "../../../src/shared/inventory/types/inventoryItemType";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import ObjectCategoryConfigMap from "../../../src/shared/object/maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import PetLineMap, { PET_LINES_ASSET_PATH } from "../../../src/shared/object/maps/petLineMap";
// What pets chat in, as the server has it (a browser fetches it instead).
import { PET_LINES } from "../../../src/server/agent/data/petLines";
import { PET_ROBOT_SOUND } from "../../../src/server/agent/util/petChatUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { CannonPhaseEnumMap } from "../../../src/shared/object/types/cannonPhase";
import InjectPetSignal from "../../../src/shared/object/types/injectPetSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import CannonObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/cannonObjectTypeConfig";
import FanObjectTypeConfig, { FAN_SETTINGS } from "../../../src/shared/object/types/objectTypeConfig/fanObjectTypeConfig";
import PetObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/petObjectTypeConfig";
import PetScrapObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/petScrapObjectTypeConfig";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import ServerPetObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/serverPetObjectTypeConfig";
import { PetActionEnumMap } from "../../../src/shared/object/types/petAction";
import PetBehavior from "../../../src/shared/object/types/petBehavior";
import { PetExpressionEnumMap } from "../../../src/shared/object/types/petExpression";
import PetIdentity from "../../../src/shared/object/types/petIdentity";
import { PetInjectionEnumMap } from "../../../src/shared/object/types/petInjection";
import PetNeeds from "../../../src/shared/object/types/petNeeds";
import PetShownState from "../../../src/shared/object/types/petShownState";
import { PetSpeechToneEnumMap } from "../../../src/shared/object/types/petSpeechTone";
import PetSurroundings from "../../../src/shared/object/types/petSurroundings";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import AdminPrefsUtil from "../../../src/shared/object/util/adminPrefsUtil";
import CannonAimUtil from "../../../src/shared/object/util/cannonAimUtil";
import CannonStateUtil from "../../../src/shared/object/util/cannonStateUtil";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import PetBehaviorUtil, { PET_ANSWER_WAIT_MS, PET_APPROACH_DISTANCE, PET_APPROACH_SLACK, PET_ATTACK_DAMAGE_RATE,
    PET_ATTACK_REACH, PET_BLAST_DAMAGE_HOURS,
    PET_BLAST_FRIGHT, PET_CHARGE_STOP_DISTANCE, PET_CURIOSITY_PULL, PET_DYING_HOURS, PET_DYING_LEASH, PET_EDIT_VIEW_DISTANCE,
    PET_ENERGY_HOURS, PET_ENTERING_TIMEOUT_MS, PET_FRIGHT_RADIUS, PET_HEALTH_HOURS, PET_HURRIED_TURN_RATE,
    PET_LEASH_BY_DEPENDENCE, PET_MAX_DEGREES_OFF_WAY, PET_MOOD_LINGER_MS, PET_PANIC_START, PET_PANIC_STOP,
    PET_REACTION_MS, PET_START_MS, PET_TALK_MIN_SPACE, PET_TALK_SPACE, PET_TURN_RATE,
    PET_WRENCH_HEALTH } from "../../../src/shared/object/util/petBehaviorUtil";
import MessageLinkUtil from "../../../src/shared/object/util/messageLinkUtil";
import NpcFacingUtil from "../../../src/shared/object/util/npcFacingUtil";
import PetLine from "../../../src/shared/object/types/petLine";
import PetCompositionUtil from "../../../src/shared/graphics/mesh/composition/util/petCompositionUtil";
import PetCompositionConstants from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/petCompositionConstants";
import PetPathSyncUtil from "../../../src/shared/object/util/petPathSyncUtil";
import DoorEntranceUtil from "../../../src/shared/object/util/doorEntranceUtil";
import PetBodyUtil, { PET_WALKER } from "../../../src/shared/object/util/petBodyUtil";
import PetEntranceUtil, { PET_ENTRANCE_PATIENCE_MS } from "../../../src/shared/object/util/petEntranceUtil";
import PetIdentityUtil, { PET_COLOR_PALETTE_NAME, PET_FIXED_ENERGIES, PET_FIXED_HEALTHS, PET_NAME_MAX_LENGTH,
    PET_TRAIT_LEVELS } from "../../../src/shared/object/util/petIdentityUtil";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import { ColorPaletteMap } from "../../../src/shared/math/maps/colorPaletteMap";
import PetAffinityUtil from "../../../src/shared/object/util/petAffinityUtil";
import PetInjectionUtil from "../../../src/shared/object/util/petInjectionUtil";
import PetNeedsUtil from "../../../src/shared/object/util/petNeedsUtil";
import PetRecordUtil, { MAX_PETS_PER_USER } from "../../../src/shared/object/util/petRecordUtil";
import PetSaleUtil, { PET_SALE_PRICE_STEPS } from "../../../src/shared/object/util/petSaleUtil";
import PetShownStateUtil, { PET_BATTERY_LEVELS,
    PET_RUST_LEVELS } from "../../../src/shared/object/util/petShownStateUtil";
import PetSurroundingsUtil from "../../../src/shared/object/util/petSurroundingsUtil";
import PetTypeConfigUtil from "../../../src/shared/object/util/petTypeConfigUtil";
import { NUM_ZODIAC_SIGNS } from "../../../src/shared/object/util/petZodiacUtil";
import { PET_BODY_HEIGHT, PET_BODY_WIDTH,
    PET_CLIMB_LAYERS } from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/petCompositionConstants";
import PhysicsManager from "../../../src/shared/physics/physicsManager";
import Vec3 from "../../../src/shared/math/types/vec3";
import Room from "../../../src/shared/room/types/room";
import { COLLISION_LAYER_HEIGHT, HOUR_IN_MS, INSTANCED_TIN_MATERIAL_ID, OBJECT_MESSAGE_MAX_LENGTH,
    PET_BATTERY_PRICE_DOLLARS, PET_PRICE_DOLLARS, PET_WRENCH_PRICE_DOLLARS, PLAYER_MESSAGE_EXPIRATION_MS,
    SIGNAL_BATCH_SEND_INTERVAL, SITE_URL, STOREY_FLOOR_COLLISION_LAYER, UNIT_VEC3,
    VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import VoxelPathUtil, { PLAYER_WALKER } from "../../../src/shared/voxel/util/voxelPathUtil";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";

const HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const PET_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(PetObjectTypeConfig.objectType);
const SERVER_PET_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(ServerPetObjectTypeConfig.objectType);
const SCRAP_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(PetScrapObjectTypeConfig.objectType);
const CANNON_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(CannonObjectTypeConfig.objectType);
const PETS_KEY = ObjectMetadataKeyEnumMap.Pets;
const DOLLAR = InventoryItemTypeEnumMap.Dollar;
const FLUSH_SECONDS = SIGNAL_BATCH_SEND_INTERVAL / 1000;
const ADMIN = new User("an-admin", "Admin", UserTypeEnumMap.Admin, "", "");
const A = PetActionEnumMap;
const MIDDLE_LEVEL = 1;
const TOP_LEVEL = PET_TRAIT_LEVELS - 1;
// By when a pet has surely reacted to what it noticed, or to what startled it, in seconds: the longest it takes, and a
// beat.
const REACTION_SECONDS = PET_REACTION_MS[1] / 1000 + 0.2;
const START_SECONDS = PET_START_MS[1] / 1000 + 0.2;
const MOOD_LINGER_SECONDS = PET_MOOD_LINGER_MS.map(ms => ms / 1000);
// The site's pages, which its links open.
const PUBLIC_DIR = path.resolve(__dirname, "../../../../public");

const STANDING_Y = 0.5 * PLAYER_HEIGHT;
// Where the people of most scenes stand, and their pets: open floor of the lower storey, well apart.
const OWNER_SPOT: Vec3 = {x: 12.5, y: STANDING_Y, z: 16.5};
const STRANGER_SPOT: Vec3 = {x: 20.5, y: STANDING_Y, z: 20.5};
const PET_FLOOR: Vec3 = {x: 14.5, y: 0, z: 16.5};
const OTHER_PET_FLOOR: Vec3 = {x: 16.5, y: 0, z: 18.5};
// How finely a need is kept in its one or two characters, with room for rounding; and a cannon's aim, in radians.
const COARSE_STEP = 1 / 93 + 0.000001;
const FINE_STEP = 1 / 8835 + 0.000001;
const AIM_STEP = 2 * Math.PI / 8835 + 0.000001;

function getRoom(): Room
{
    return ServerRoomManager.roomRuntimeMemories[HUB_ID].room;
}

function getObjects(objectTypeIndex: number): AddObjectSignal[]
{
    return Object.values(getRoom().objectById).filter(obj => obj.objectTypeIndex == objectTypeIndex);
}

// A pet whose health is kept at a level has its charge kept too, full unless said otherwise, as a room's pet does.
function identity(name: string = "Rex", overrides: Partial<PetIdentity["traits"]> = {}, fixedHealthLevel: number = 0,
    fixedEnergyLevel: number = (fixedHealthLevel > 0) ? PET_FIXED_ENERGIES.length : 0): PetIdentity
{
    return {name, fixedHealthLevel, fixedEnergyLevel, colorIndex: 0, traits: {dependence: MIDDLE_LEVEL,
        sociability: MIDDLE_LEVEL, aggressiveness: MIDDLE_LEVEL, bravery: MIDDLE_LEVEL, curiosity: MIDDLE_LEVEL, zodiac: 0,
        ...overrides}};
}

function petSignal(owner: User, petId: string, who: PetIdentity = identity(), floor: Vec3 = PET_FLOOR,
    objectTypeIndex: number = PET_TYPE_INDEX): AddObjectSignal
{
    return new AddObjectSignal(HUB_ID, owner.id, owner.userName, objectTypeIndex, petId,
        new ObjectTransform(PetBodyUtil.getStandingPos(floor), PetBodyUtil.getDir(0), {...UNIT_VEC3}),
        {[ObjectMetadataKeyEnumMap.PetIdentity]: new EncodableByteString(PetIdentityUtil.encode(who))});
}

// A fan the admin puts down on the floor there, blowing upward, at the default setting unless given another.
function addFloorFan(at: Vec3, setting?: (typeof FAN_SETTINGS)[number]): void
{
    expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, new AddObjectSignal(HUB_ID, ADMIN.id, ADMIN.userName,
        ObjectTypeConfigMap.getIndexByType(FanObjectTypeConfig.objectType), "a-fan",
        new ObjectTransform({...at}, {x: 0, y: 1, z: 0}, {...UNIT_VEC3}), (setting == undefined) ? {}
            : {[ObjectMetadataKeyEnumMap.ForceProperties]: new EncodableByteString(
                FanObjectTypeConfig.util.encodeForceProperties(setting))}))).toBe(true);
}

// Whether a wind lifts a pet with its middle there.
function isLiftedAt(pos: Vec3): boolean
{
    return PhysicsManager.getPush(HUB_ID, PetBodyUtil.getBox(pos)).y > 0;
}

async function join(id: string, at: Vec3 = OWNER_SPOT, overrides: {userType?: number,
    playerMetadata?: {[key: string]: string}} = {}, dollars: number = 0): Promise<ConnectedUser>
{
    const user = harness.connectUser({id, userName: id, ...overrides});
    await harness.joinRoom(user, HUB_ID);
    moveTo(user, at);
    user.socketUserContext.inventory[DOLLAR] = dollars;
    return user;
}

function moveTo(user: ConnectedUser, pos: Vec3): void
{
    const player = harness.getPlayerObject(user.user.id)!;
    Object.assign(player.transform.pos, pos);
    PhysicsManager.setObjectTransform(HUB_ID, player.objectId, player.transform, true);
}

function add(user: ConnectedUser, signal: AddObjectSignal): boolean
{
    return ServerObjectManager.onAddObjectSignalReceived(user.socketUserContext, signal);
}

function remove(user: ConnectedUser, objectId: string): boolean
{
    return ServerObjectManager.onRemoveObjectSignalReceived(user.socketUserContext, new RemoveObjectSignal(HUB_ID, objectId));
}

// How the user's pets are, as their browser tells it now and then.
function report(user: ConnectedUser, needsByPetId: {[petId: string]: PetNeeds}): boolean
{
    return ServerObjectManager.onSetObjectMetadataSignalReceived(user.socketUserContext, new SetObjectMetadataSignal(HUB_ID,
        harness.getPlayerObject(user.user.id)!.objectId, PETS_KEY, PetRecordUtil.encodeReport(needsByPetId)));
}

function recordsOf(user: ConnectedUser)
{
    return PetRecordUtil.getPlayerRecords(harness.getPlayerObject(user.user.id));
}

function storedRecordsOf(userID: string)
{
    return PetRecordUtil.decode(harness.getStoredPlayerMetadata(userID)?.[PETS_KEY] ?? "");
}

function dollarsOf(user: ConnectedUser): number
{
    return user.socketUserContext.inventory[DOLLAR] ?? 0;
}

function shownOf(petId: string): PetShownState
{
    return PetShownStateUtil.getObjectState(getRoom().objectById[petId]);
}

function show(petId: string, changes: Partial<PetShownState>): void
{
    const pet = getRoom().objectById[petId];
    pet.metadata[ObjectMetadataKeyEnumMap.PetState] = new EncodableByteString(
        PetShownStateUtil.encode({...PetShownStateUtil.getObjectState(pet), ...changes}));
}

function forget(user: ConnectedUser): void
{
    (user.socketUserContext as any).pendingSignalsToUser.runs.length = 0;
}

// A pet as whoever plays it has it, standing on a floor of the hub.
function behave(who: PetIdentity = identity(), needs: Partial<PetNeeds> = {}, ownerUserID: string = "an-owner",
    floor: Vec3 = PET_FLOOR, objectId: string = "petAAAA1"): PetBehavior
{
    return PetBehaviorUtil.create(objectId, ownerUserID, who, {...PetNeedsUtil.getFresh(), ...needs}, {...floor}, 0, Date.now());
}

function surroundings(): PetSurroundings
{
    return PetSurroundingsUtil.observe(getRoom(), Date.now());
}

// Time passes for a pet, a beat at a time. What it said meanwhile, each line once, with the tone it said it in.
function live(b: PetBehavior, seconds: number, beatSeconds: number = 0.2): {text: string, tone: number}[]
{
    const said: {text: string, tone: number}[] = [];
    for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += beatSeconds)
    {
        vi.setSystemTime(Date.now() + 1000 * beatSeconds);
        PetBehaviorUtil.update(b, surroundings(), beatSeconds);
        if (b.saying.length > 0 && said[said.length - 1]?.text != b.saying)
            said.push({text: b.saying, tone: b.tone});
    }
    return said;
}

// Time passes for a pet whose body goes where it steers it, as over open floor, a beat at a time. What it said meanwhile,
// each line once, with where it stood and which way it faced as it said it. ownerFocus: what its owner looks at while
// they edit, as their browser would have it.
function liveMoving(b: PetBehavior, seconds: number, beatSeconds: number = 0.2, ownerFocus?: Vec3):
    {text: string, tone: number, at: Vec3, facing: number}[]
{
    const STEPS_A_BEAT = 10;
    const said: {text: string, tone: number, at: Vec3, facing: number}[] = [];
    for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += beatSeconds)
    {
        vi.setSystemTime(Date.now() + 1000 * beatSeconds);
        PetBehaviorUtil.update(b, {...surroundings(), ownerFocus}, beatSeconds);
        for (let step = 0; step < STEPS_A_BEAT; ++step)
        {
            const velocity = PetBehaviorUtil.steer(b, beatSeconds / STEPS_A_BEAT);
            b.at = {x: b.at.x + velocity.x * beatSeconds / STEPS_A_BEAT, y: b.at.y,
                z: b.at.z + velocity.z * beatSeconds / STEPS_A_BEAT};
        }
        if (b.saying.length > 0 && said[said.length - 1]?.text != b.saying)
            said.push({text: b.saying, tone: b.tone, at: {...b.at}, facing: b.facing});
    }
    return said;
}

// The clock moved on, then a flush, as SocketsServer's interval makes them.
function flush(): void
{
    vi.setSystemTime(Date.now() + SIGNAL_BATCH_SEND_INTERVAL);
    PetPlayUtil.stepAll(FLUSH_SECONDS);
    CannonUtil.stepAll(FLUSH_SECONDS);
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    // Only the clock: promises and the harness's own timers run as usual.
    vi.useFakeTimers({toFake: ["Date"]});
    harness.reset();
    harness.seedHub(HUB_ID);
    vi.spyOn(DollarBillFlightUtil, "planGust").mockReturnValue([]);
    vi.mocked(DBPetUtil.savePets).mockClear();
});

afterEach(async () => {
    // What a scene left on its way to a user's row lands before the next begins, whose users go by the same ids.
    await DBUserWriteQueueUtil.drain();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("who a pet is", () => {
    const levelArb = fc.integer({min: 0, max: PET_TRAIT_LEVELS - 1});
    const identityArb: fc.Arbitrary<PetIdentity> = fc.record({
        name: fc.constantFrom("Rex", "미미", "Señor Botón", "ポチ", "A"),
        fixedHealthLevel: fc.integer({min: 0, max: PET_FIXED_HEALTHS.length}),
        fixedEnergyLevel: fc.integer({min: 0, max: PET_FIXED_ENERGIES.length}),
        colorIndex: fc.integer({min: 0, max: ColorUtil.getPaletteSize(PET_COLOR_PALETTE_NAME) - 1}),
        traits: fc.record({dependence: levelArb, sociability: levelArb, aggressiveness: levelArb, bravery: levelArb,
            curiosity: levelArb, zodiac: fc.integer({min: 0, max: NUM_ZODIAC_SIGNS - 1})}),
    });

    it("is kept through its encoding, name and nature, whatever script the name is in", () => {
        fc.assert(fc.property(identityArb, who => {
            const encoded = PetIdentityUtil.encode(who);
            expect(PetIdentityUtil.decode(encoded)).toEqual(who);
            expect(PetIdentityUtil.isComplete(encoded)).toBe(true);
        }));
    });

    it("is decoded from anything, as a nameless pet of medium traits whose health runs down, which nobody may generate", () => {
        for (const junk of ["", "?", "\u0000\u0001"])
        {
            const who = PetIdentityUtil.decode(junk);
            expect(PetIdentityUtil.getTraitLevels(who.traits).every(level => level >= 0 && level < PET_TRAIT_LEVELS)).toBe(true);
            expect(who.name).toBe("");
            expect(PetIdentityUtil.isComplete(junk)).toBe(false);
        }
        expect(PetIdentityUtil.decode("")).toEqual(identity(""));
        expect(PetIdentityUtil.getFixedHealth(identity())).toBeUndefined();
    });

    it(`keeps a name to one line of at most ${PET_NAME_MAX_LENGTH} characters, trimmed, counted by code point`, () => {
        expect(PetIdentityUtil.sanitizeName("  Rex  ")).toBe("Rex");
        expect(PetIdentityUtil.sanitizeName("Mr\n\tBeep   Boop")).toBe("Mr Beep Boop");
        expect(Array.from(PetIdentityUtil.sanitizeName("가".repeat(PET_NAME_MAX_LENGTH + 5)))).toHaveLength(PET_NAME_MAX_LENGTH);
        expect(Array.from(PetIdentityUtil.sanitizeName("\u{1F916}".repeat(PET_NAME_MAX_LENGTH + 5)))).toHaveLength(PET_NAME_MAX_LENGTH);
        expect(PetIdentityUtil.sanitizeName("   ")).toBe("");
    });

    it("is kept at a health and a charge of its own only where it says which, counted from one", () => {
        PET_FIXED_HEALTHS.forEach((health, i) =>
            expect(PetIdentityUtil.getFixedHealth(identity("Rex", {}, i + 1))).toBe(health));
        PET_FIXED_ENERGIES.forEach((energy, i) =>
            expect(PetIdentityUtil.getFixedEnergy(identity("Rex", {}, 1, i + 1))).toBe(energy));
        expect(PetIdentityUtil.getFixedEnergy(identity())).toBeUndefined();
        // Each fixed charge lights one cell of its indicator more than the last, and each fixed health shows one step of
        // rust less than the last, from the most a living pet shows to none.
        expect(PET_FIXED_ENERGIES.map(PetShownStateUtil.getBatteryLevel)).toEqual(
            Array.from({length: PET_BATTERY_LEVELS}, (_, i) => i + 1));
        expect(PET_FIXED_HEALTHS.map(health => PetShownStateUtil.getRust(health))).toEqual(
            Array.from({length: PET_RUST_LEVELS}, (_, i) => PET_RUST_LEVELS - 1 - i));
    });
});

describe("what a pet shows of itself, and how it is", () => {
    const shownArb: fc.Arbitrary<PetShownState> = fc.record({
        action: fc.constantFrom(...Object.values(PetActionEnumMap)),
        expression: fc.constantFrom(...Object.values(PetExpressionEnumMap)),
        sleepy: fc.boolean(), powerless: fc.boolean(), excited: fc.boolean(),
        tone: fc.constantFrom(...Object.values(PetSpeechToneEnumMap)),
        batteryLevel: fc.integer({min: 0, max: PET_BATTERY_LEVELS}),
        rust: fc.integer({min: 0, max: PET_RUST_LEVELS - 1}),
        hits: fc.integer({min: 0, max: 93}), turn: fc.integer({min: 0, max: 93}),
        // A chat's place, told in two characters.
        topic: fc.integer({min: 0, max: 94 * 94 - 1}),
        facing: fc.option(fc.integer({min: 0, max: 89}).map(step => 4 * step), {nil: undefined}),
        targetId: fc.constantFrom("", "petAAAA2", "@17"),
    });
    const levelArb = fc.integer({min: 0, max: 1000}).map(n => n / 1000);

    it("keeps what it shows through its encoding, and decodes anything as a pet standing idle, charged and clean", () => {
        fc.assert(fc.property(shownArb, shown => {
            expect(PetShownStateUtil.decode(PetShownStateUtil.encode(shown))).toEqual(shown);
        }));
        const fresh = PetShownStateUtil.decode("");
        expect(fresh.action).toBe(A.Idle);
        expect(fresh.batteryLevel).toBe(PET_BATTERY_LEVELS);
        expect(fresh.rust).toBe(0);
        expect(fresh.powerless).toBe(false);
    });

    it("keeps how it is through its encoding, its health and its battery the finer", () => {
        fc.assert(fc.property(fc.record({health: levelArb, energy: levelArb, anger: levelArb, horror: levelArb,
            fatigue: levelArb}), needs => {
            const decoded = PetNeedsUtil.decode(PetNeedsUtil.encode(needs));
            expect(Math.abs(decoded.health - needs.health)).toBeLessThan(FINE_STEP);
            expect(Math.abs(decoded.energy - needs.energy)).toBeLessThan(FINE_STEP);
            for (const key of ["anger", "horror", "fatigue"] as const)
                expect(Math.abs(decoded[key] - needs[key])).toBeLessThan(COARSE_STEP);
        }));
        expect(PetNeedsUtil.decode("")).toEqual(PetNeedsUtil.getFresh());
    });

    it(`lights a cell of its indicator for each third of a charge it reaches into, and none once it is spent`, () => {
        expect(PetShownStateUtil.getBatteryLevel(1)).toBe(PET_BATTERY_LEVELS);
        expect(PetShownStateUtil.getBatteryLevel(0.5)).toBe(2);
        expect(PetShownStateUtil.getBatteryLevel(0.01)).toBe(1);
        expect(PetShownStateUtil.getBatteryLevel(0)).toBe(0);
    });

    it("shows a step of rust for each share of its health lost in full, as one kept at what it has left does", () => {
        const step = 1 / PET_RUST_LEVELS;
        expect(PetShownStateUtil.getRust(1)).toBe(0);
        expect(PetShownStateUtil.getRust(1 - 0.5 * step)).toBe(0);
        expect(PetShownStateUtil.getRust(0.5 * step)).toBe(PET_RUST_LEVELS - 1);
        expect(PetShownStateUtil.getRust(0)).toBe(PET_RUST_LEVELS - 1);
        // Run down to a health a pet can be kept at, it looks as that one does until it is down to the next.
        for (const health of PET_FIXED_HEALTHS)
        {
            const kept = PetShownStateUtil.getRust(health);
            expect(PetShownStateUtil.getRust(health - 0.5 * step)).toBe(kept);
            if (health < 1)
                expect(PetShownStateUtil.getRust(health + 0.5 * step)).toBe(kept - 1);
        }
        let last = 0;
        for (let health = 1; health >= 0; health -= 0.05)
        {
            expect(PetShownStateUtil.getRust(health)).toBeGreaterThanOrEqual(last);
            last = PetShownStateUtil.getRust(health);
        }
    });
});

describe("a user's record of their pets", () => {
    const records = [
        {petId: "petAAAA1", identity: identity("Rex"), needs: {...PetNeedsUtil.getFresh(), health: 0.5}},
        {petId: "petAAAA2", identity: identity("미미", {bravery: TOP_LEVEL}), needs: PetNeedsUtil.getFresh()},
    ];

    it("is kept through its encoding, and decoded from anything as no pets", () => {
        const decoded = PetRecordUtil.decode(PetRecordUtil.encode(records));
        expect(decoded.map(record => record.petId)).toEqual(["petAAAA1", "petAAAA2"]);
        expect(decoded.map(record => record.identity)).toEqual(records.map(record => record.identity));
        expect(Math.abs(decoded[0].needs.health - 0.5)).toBeLessThan(FINE_STEP);
        for (const junk of ["", "?", "short", "~petAAAA1"])
            expect(PetRecordUtil.decode(junk)).toEqual([]);
    });

    it(`lists each pet once, and no more than ${MAX_PETS_PER_USER}`, () => {
        const many = Array.from({length: MAX_PETS_PER_USER + 3}, (_, i) => ({...records[0], petId: `petAAA${10 + i}`}));
        expect(PetRecordUtil.decode(PetRecordUtil.encode(many))).toHaveLength(MAX_PETS_PER_USER);
        const twice = PetRecordUtil.encode([records[0]]) + "\n" + PetRecordUtil.encode([records[0]]);
        expect(PetRecordUtil.decode(twice)).toHaveLength(1);
    });

    it("takes a report as how the pets it already lists now are, and as nothing else: no pet comes or goes by one", () => {
        const stored = PetRecordUtil.encode(records);
        const merged = PetRecordUtil.decode(PetRecordUtil.merge(PetRecordUtil.encodeReport({
            petAAAA2: {...PetNeedsUtil.getFresh(), energy: 0.25},
            petZZZZ9: PetNeedsUtil.getFresh(),
        }), stored));
        expect(merged.map(record => record.petId)).toEqual(["petAAAA1", "petAAAA2"]);
        expect(merged.map(record => record.identity)).toEqual(records.map(record => record.identity));
        expect(Math.abs(merged[1].needs.energy - 0.25)).toBeLessThan(FINE_STEP);
        expect(Math.abs(merged[0].needs.health - 0.5)).toBeLessThan(FINE_STEP);
        // On a player that holds none, a report leaves none.
        expect(PetRecordUtil.decode(PetRecordUtil.merge(PetRecordUtil.encodeReport({petAAAA1: PetNeedsUtil.getFresh()}))))
            .toEqual([]);
    });
});

describe("what a pet sells for, and what goes into one", () => {
    it(`sells for all of its price down to two thirds of its health, and a step less for each third below`, () => {
        expect(PetSaleUtil.getPrice(1)).toBe(PET_PRICE_DOLLARS);
        for (let step = 1; step <= PET_SALE_PRICE_STEPS; ++step)
        {
            const price = Math.round(PET_PRICE_DOLLARS * step / PET_SALE_PRICE_STEPS);
            expect(PetSaleUtil.getPrice((step - 1) / PET_SALE_PRICE_STEPS + 0.001)).toBe(price);
            expect(PetSaleUtil.getPrice(step / PET_SALE_PRICE_STEPS - 0.001)).toBe(price);
        }
        expect(PetSaleUtil.getPrice(0)).toBe(Math.round(PET_PRICE_DOLLARS / PET_SALE_PRICE_STEPS));
        expect(PetSaleUtil.getPrice(-1)).toBe(Math.round(PET_PRICE_DOLLARS / PET_SALE_PRICE_STEPS));
    });

    it("takes a battery while a cell of its indicator is dark, and a wrench while it shows rust, each for its price", async () => {
        await harness.loadRoom(HUB_ID);
        ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, petSignal(ADMIN, "petAAAA1"));
        const pet = getRoom().objectById["petAAAA1"];
        const {Battery, Wrench} = PetInjectionEnumMap;
        expect(PetInjectionUtil.getPrice(Battery)).toBe(PET_BATTERY_PRICE_DOLLARS);
        expect(PetInjectionUtil.getPrice(Wrench)).toBe(PET_WRENCH_PRICE_DOLLARS);

        // As it is generated: charged and clean.
        expect(PetInjectionUtil.canInject(pet, Battery)).toBe(false);
        expect(PetInjectionUtil.canInject(pet, Wrench)).toBe(false);
        show("petAAAA1", {batteryLevel: PET_BATTERY_LEVELS - 1, rust: 1});
        expect(PetInjectionUtil.canInject(pet, Battery)).toBe(true);
        expect(PetInjectionUtil.canInject(pet, Wrench)).toBe(true);
        // Nothing helps a dead one, and nothing but a pet takes either.
        show("petAAAA1", {action: A.Dead});
        expect(PetInjectionUtil.canInject(pet, Battery)).toBe(false);
        expect(PetInjectionUtil.canInject(pet, Wrench)).toBe(false);
        expect(PetInjectionUtil.canInject(undefined, Battery)).toBe(false);
        expect(PetInjectionUtil.isInjection(2)).toBe(false);
    });

    it("takes no wrench where its health is kept as it is, nor a battery where its charge is", async () => {
        await harness.loadRoom(HUB_ID);
        ServerObjectManager.addObjectAsServer(getRoom(), ADMIN,
            petSignal(ADMIN, "petAAAA1", identity("Rex", {}, 1, 1), PET_FLOOR, SERVER_PET_TYPE_INDEX));
        const pet = getRoom().objectById["petAAAA1"];
        show("petAAAA1", {batteryLevel: 1, rust: PET_RUST_LEVELS - 1});
        expect(PetInjectionUtil.takesWrench(pet)).toBe(false);
        expect(PetInjectionUtil.takesBattery(pet)).toBe(false);
        expect(PetInjectionUtil.canInject(pet, PetInjectionEnumMap.Wrench)).toBe(false);
        expect(PetInjectionUtil.canInject(pet, PetInjectionEnumMap.Battery)).toBe(false);

        // Nor does the server take either, whoever pays.
        const someone = await join("someone", OWNER_SPOT, {}, PET_BATTERY_PRICE_DOLLARS + PET_WRENCH_PRICE_DOLLARS);
        for (const injection of [PetInjectionEnumMap.Battery, PetInjectionEnumMap.Wrench])
            expect(PetServerUtil.onInjectPetSignalReceived(someone.socketUserContext, new InjectPetSignal(HUB_ID, "petAAAA1", injection))).toBe(false);
        expect(dollarsOf(someone)).toBe(PET_BATTERY_PRICE_DOLLARS + PET_WRENCH_PRICE_DOLLARS);
    });
});

describe("how a pet behaves", () => {
    beforeEach(async () => {
        await harness.loadRoom(HUB_ID);
    });

    it(`runs out of health in ${PET_HEALTH_HOURS} hours and of battery in ${PET_ENERGY_HOURS}, at a steady rate`, () => {
        const b = behave();
        live(b, 3600, 60);
        expect(b.needs.health).toBeCloseTo(1 - 1 / PET_HEALTH_HOURS, 4);
        expect(b.needs.energy).toBeCloseTo(1 - 1 / PET_ENERGY_HOURS, 4);
        expect(b.dead).toBe(false);
    });

    it("out of battery stands where it is, shows it, and asks for a battery until it is given one", () => {
        const b = behave(identity(), {energy: 0.0001});
        live(b, 30);
        expect(PetBehaviorUtil.isPowerless(b)).toBe(true);
        const shown = PetBehaviorUtil.getShownState(b);
        expect(shown.powerless).toBe(true);
        expect(shown.batteryLevel).toBe(0);
        expect(b.action).toBe(A.Idle);
        expect(b.path).toEqual([]);
        expect(PetBehaviorUtil.steer(b, 0.016)).toEqual({x: 0, y: 0, z: 0});
        // It says that, and nothing else.
        expect(live(b, 60)).toEqual([{text: PetLineMap.getPowerlessLine().text, tone: PetSpeechToneEnumMap.Powerless}]);

        PetBehaviorUtil.inject(b, surroundings(), PetInjectionEnumMap.Battery);
        expect(b.needs.energy).toBe(1);
        expect(PetBehaviorUtil.isPowerless(b)).toBe(false);
        expect(PetBehaviorUtil.getShownState(b).batteryLevel).toBe(PET_BATTERY_LEVELS);
    });

    it(`with under ${PET_DYING_HOURS} hours of health left says it is dying, and a wrench mends a third of its health`, () => {
        const failing = PET_DYING_HOURS / PET_HEALTH_HOURS - 0.01;
        expect(PetBehaviorUtil.isDying({...PetNeedsUtil.getFresh(), health: failing})).toBe(true);
        expect(PetBehaviorUtil.isDying({...PetNeedsUtil.getFresh(), health: failing + 0.02})).toBe(false);
        const b = behave(identity(), {health: failing});
        expect(live(b, 60)).toContainEqual({text: PetLineMap.getDyingLine().text, tone: PetSpeechToneEnumMap.Dying});

        const before = b.needs.health;
        PetBehaviorUtil.inject(b, surroundings(), PetInjectionEnumMap.Wrench);
        expect(b.needs.health).toBeCloseTo(before + PET_WRENCH_HEALTH, 6);
        // Never past whole.
        PetBehaviorUtil.inject(b, surroundings(), PetInjectionEnumMap.Wrench);
        PetBehaviorUtil.inject(b, surroundings(), PetInjectionEnumMap.Wrench);
        expect(b.needs.health).toBe(1);
    });

    it("out of health is dead, for good", () => {
        const b = behave(identity(), {health: 0.000001});
        live(b, 2);
        expect(b.dead).toBe(true);
        expect(PetBehaviorUtil.getShownState(b).action).toBe(A.Dead);
        PetBehaviorUtil.inject(b, surroundings(), PetInjectionEnumMap.Wrench);
        expect(b.needs.health).toBe(0);
    });

    it("keeps the health it is kept at, whatever happens to it, never one it would ask for a wrench at", () => {
        PET_FIXED_HEALTHS.forEach((health, i) => {
            const b = behave(identity("Rex", {}, i + 1));
            expect(b.needs.health).toBe(health);
            expect(PetBehaviorUtil.isDying(b.needs)).toBe(false);
            // An hour of its life at the least and the most it can be kept at; a beat, which would move it too, between.
            live(b, (i == 0 || i == PET_FIXED_HEALTHS.length - 1) ? 3600 : 60, 60);
            PetBehaviorUtil.takeBlast(b, surroundings());
            PetBehaviorUtil.inject(b, surroundings(), PetInjectionEnumMap.Wrench);
            expect(b.needs.health).toBe(health);
            expect(b.dead).toBe(false);
        });
    });

    it(`loses ${PET_BLAST_DAMAGE_HOURS} hours of health to a cannon ball's blast`, () => {
        const b = behave();
        PetBehaviorUtil.takeBlast(b, surroundings());
        expect(b.needs.health).toBeCloseTo(1 - PET_BLAST_DAMAGE_HOURS / PET_HEALTH_HOURS, 6);
    });

    it(`loses health ${PET_ATTACK_DAMAGE_RATE} times as fast while another pet attacks it from near`, () => {
        const attacked = behave();
        const s = surroundings();
        const attacker = {objectId: "petAAAA2", ownerUserID: "someone", identity: identity("Grr"),
            at: {x: PET_FLOOR.x + 0.5 * PET_ATTACK_REACH, y: 0, z: PET_FLOOR.z},
            shown: {...PetShownStateUtil.decode(""), action: A.Attack, targetId: attacked.objectId}};
        PetBehaviorUtil.update(attacked, {...s, pets: [attacker]}, 1);
        const lost = 1 - attacked.needs.health;
        expect(lost).toBeCloseTo(PET_ATTACK_DAMAGE_RATE / (PET_HEALTH_HOURS * HOUR_IN_MS / 1000), 6);

        // One attacking something else, or from too far off, does it no harm.
        for (const other of [{...attacker, shown: {...attacker.shown, targetId: "petAAAA3"}},
            {...attacker, at: {x: PET_FLOOR.x + 2 * PET_ATTACK_REACH, y: 0, z: PET_FLOOR.z}}])
        {
            const safe = behave();
            PetBehaviorUtil.update(safe, {...s, pets: [other]}, 1);
            expect(1 - safe.needs.health).toBeCloseTo(1 / (PET_HEALTH_HOURS * HOUR_IN_MS / 1000), 8);
        }
    });

    it("charging a pet that charges it back, strikes it again and again without running through it", () => {
        // Two that hate each other, whatever else their signs would make of it.
        const fierce = {sociability: 0, aggressiveness: TOP_LEVEL};
        const one = identity("Grr", {...fierce, zodiac: 0});
        const other = Array.from({length: NUM_ZODIAC_SIGNS}, (_, zodiac) => identity("Arf", {...fierce, zodiac})).find(who =>
            PetAffinityUtil.hates("petAAAA1", one.traits, "petAAAA2", who.traits)
            && PetAffinityUtil.hates("petAAAA2", who.traits, "petAAAA1", one.traits))!;
        expect(other).toBeDefined();

        const a = behave(one, {anger: 1}, "an-owner", PET_FLOOR, "petAAAA1");
        const b = behave(other, {anger: 1}, "someone", {...PET_FLOOR, x: PET_FLOOR.x + 3.5}, "petAAAA2");
        const seenAs = (pet: PetBehavior) => ({objectId: pet.objectId, ownerUserID: pet.ownerUserID, identity: pet.identity,
            at: {...pet.at}, shown: PetBehaviorUtil.getShownState(pet)});
        const BEAT_SECONDS = 0.2, STEPS_A_BEAT = 12;
        let leastGap = Infinity;
        for (let seconds = 0; seconds < 5; seconds += BEAT_SECONDS)
        {
            vi.setSystemTime(Date.now() + 1000 * BEAT_SECONDS);
            const [seenA, seenB] = [seenAs(a), seenAs(b)];
            PetBehaviorUtil.update(a, {...surroundings(), pets: [seenB]}, BEAT_SECONDS);
            PetBehaviorUtil.update(b, {...surroundings(), pets: [seenA]}, BEAT_SECONDS);
            for (let step = 0; step < STEPS_A_BEAT; ++step)
            {
                for (const pet of [a, b])
                {
                    const velocity = PetBehaviorUtil.steer(pet, BEAT_SECONDS / STEPS_A_BEAT);
                    pet.at = {x: pet.at.x + velocity.x * BEAT_SECONDS / STEPS_A_BEAT, y: pet.at.y,
                        z: pet.at.z + velocity.z * BEAT_SECONDS / STEPS_A_BEAT};
                }
                leastGap = Math.min(leastGap, b.at.x - a.at.x);
            }
        }
        expect(a.action).toBe(A.Attack);
        expect(b.action).toBe(A.Attack);
        expect(a.hits).toBeGreaterThanOrEqual(2);
        expect(b.hits).toBeGreaterThanOrEqual(2);
        // Each keeps to its own side, never nearer than two bodies face to face.
        expect(PET_CHARGE_STOP_DISTANCE).toBeGreaterThan(PET_BODY_WIDTH);
        expect(leastGap).toBeGreaterThanOrEqual(PET_BODY_WIDTH);
    });

    it("chatting with a pet that stands right against it, backs off from it, facing it still, until the two stand apart", () => {
        // Two that don't mind each other, whatever their signs would make of it, the one about to begin a chat.
        const one = identity("Abe", {zodiac: 0});
        const other = Array.from({length: NUM_ZODIAC_SIGNS}, (_, zodiac) => identity("Bea", {zodiac})).find(who =>
            !PetAffinityUtil.hates("petAAAA1", one.traits, "petAAAA2", who.traits)
            && !PetAffinityUtil.hates("petAAAA2", who.traits, "petAAAA1", one.traits))!;
        expect(other).toBeDefined();
        const a = behave(one, {}, "an-owner", PET_FLOOR, "petAAAA1");
        const b = behave(other, {}, "someone", {...PET_FLOOR, x: PET_FLOOR.x + 0.6 * PET_TALK_MIN_SPACE}, "petAAAA2");
        for (const pet of [a, b])
            pet.nextWanderAt = pet.nextRemarkAt = pet.nextTalkAt = Infinity;
        a.nextTalkAt = Date.now();

        const seenAs = (pet: PetBehavior) => ({objectId: pet.objectId, ownerUserID: pet.ownerUserID, identity: pet.identity,
            at: {...pet.at}, shown: PetBehaviorUtil.getShownState(pet)});
        const gap = () => Math.hypot(a.at.x - b.at.x, a.at.z - b.at.z);
        const BEAT_SECONDS = 0.2, STEPS_A_BEAT = 12;
        let chatted = false;
        for (let seconds = 0; seconds < REACTION_SECONDS + 3; seconds += BEAT_SECONDS)
        {
            vi.setSystemTime(Date.now() + 1000 * BEAT_SECONDS);
            const [seenA, seenB] = [seenAs(a), seenAs(b)];
            PetBehaviorUtil.update(a, {...surroundings(), pets: [seenB]}, BEAT_SECONDS);
            PetBehaviorUtil.update(b, {...surroundings(), pets: [seenA]}, BEAT_SECONDS);
            chatted ||= a.action == A.SmallTalk && b.action == A.SmallTalk;
            for (let step = 0; step < STEPS_A_BEAT; ++step)
            {
                for (const pet of [a, b])
                {
                    const velocity = PetBehaviorUtil.steer(pet, BEAT_SECONDS / STEPS_A_BEAT);
                    pet.at = {x: pet.at.x + velocity.x * BEAT_SECONDS / STEPS_A_BEAT, y: pet.at.y,
                        z: pet.at.z + velocity.z * BEAT_SECONDS / STEPS_A_BEAT};
                }
            }
            // Whichever moves, moves away from the other, and shows the room it faces it.
            for (const [pet, towardOther] of [[a, 90], [b, 270]] as const)
            {
                if (pet.path.length > 0)
                    expect(PetBehaviorUtil.getShownState(pet).facing).toBe(towardOther);
            }
        }
        expect(chatted).toBe(true);
        expect(gap()).toBeGreaterThanOrEqual(PET_TALK_MIN_SPACE);
        expect(gap()).toBeLessThan(PET_TALK_SPACE + 0.5);
        expect(a.path).toEqual([]);
        expect(b.path).toEqual([]);
        expect(a.facing).toBe(90);
        expect(b.facing).toBe(270);
    });

    it(`panics from ${PET_PANIC_START} of horror up, and goes on until it is under ${PET_PANIC_STOP}`, () => {
        const b = behave();
        b.needs.horror = PET_PANIC_START - 0.05;
        PetBehaviorUtil.update(b, surroundings(), 0.001);
        expect(b.action).not.toBe(A.Panic);
        b.needs.horror = PET_PANIC_START + 0.01;
        PetBehaviorUtil.update(b, surroundings(), 0.001);
        expect(b.action).toBe(A.Panic);
        // Calmer than it took to start, it panics still.
        b.needs.horror = 0.5 * (PET_PANIC_START + PET_PANIC_STOP);
        PetBehaviorUtil.update(b, surroundings(), 0.001);
        expect(b.action).toBe(A.Panic);
        b.needs.horror = PET_PANIC_STOP - 0.05;
        PetBehaviorUtil.update(b, surroundings(), 0.001);
        expect(b.action).not.toBe(A.Panic);
    });

    it("goes to whoever says its name in a line someone else answers, whatever the letter case, but not for a word its name is only part of", async () => {
        const caller = await join("a-caller", {x: PET_FLOOR.x + 5, y: STANDING_Y, z: PET_FLOOR.z});
        const callerObjectId = harness.getPlayerObject(caller.user.id)!.objectId;
        for (const line of ["rex", "Come here, REX!", "rex?", "Hey Rex."])
        {
            const b = behave(identity("Rex"));
            PetBehaviorUtil.hear(b, surroundings(), caller.user.id, line);
            // A moment later, not at once.
            PetBehaviorUtil.update(b, surroundings(), 0.2);
            expect(b.action, line).not.toBe(A.Come);
            live(b, REACTION_SECONDS);
            expect(b.action, line).toBe(A.Come);
            expect(b.targetId, line).toBe(callerObjectId);
            expect(b.path.length, line).toBeGreaterThan(0);
        }
        for (const line of ["", "hello", "t-rex1", "rexy is nice", "prefix"])
        {
            const b = behave(identity("Rex"));
            PetBehaviorUtil.hear(b, surroundings(), caller.user.id, line);
            expect(b.calledBy, line).toBeUndefined();
        }
        // A name in a script written without spaces is found wherever it stands.
        const b = behave(identity("미미"));
        PetBehaviorUtil.hear(b, surroundings(), caller.user.id, "우리미미야");
        expect(b.calledBy?.userID).toBe(caller.user.id);
    });

    it("held, stands idle and silent until then, whatever it hears", async () => {
        const caller = await join("a-caller", {x: PET_FLOOR.x + 5, y: STANDING_Y, z: PET_FLOOR.z});
        const b = behave(identity("Rex", {dependence: TOP_LEVEL, sociability: TOP_LEVEL}));
        const holdMs = 10_000;
        PetBehaviorUtil.hold(b, Date.now(), holdMs);
        for (let elapsed = 0; elapsed < holdMs / 1000 - 0.5; elapsed += 0.2)
        {
            PetBehaviorUtil.hear(b, surroundings(), caller.user.id, "Rex!");
            live(b, 0.2);
            expect(b.action).toBe(A.Idle);
            expect(b.saying).toBe("");
            expect(b.path).toEqual([]);
        }
        // Then it is itself again.
        live(b, 1);
        PetBehaviorUtil.hear(b, surroundings(), caller.user.id, "Rex!");
        live(b, REACTION_SECONDS);
        expect(b.action).toBe(A.Come);
    });

    it("takes what happens to it at once, and reacts to it only a moment later", async () => {
        const owner = await join("an-owner", OWNER_SPOT);
        const E = PetExpressionEnumMap;

        // A blast costs it health there and then; it starts after.
        const blasted = behave();
        PetBehaviorUtil.takeBlast(blasted, surroundings());
        expect(blasted.needs.health).toBeLessThan(1);
        PetBehaviorUtil.update(blasted, surroundings(), 0.001);
        expect(blasted.expression).not.toBe(E.Surprised);
        live(blasted, START_SECONDS);
        expect(blasted.expression).toBe(E.Surprised);

        // A fright rouses it after, and then it panics.
        const scared = behave(identity("Rex", {bravery: 0}));
        PetBehaviorUtil.expose(scared, surroundings(), {...PET_FLOOR}, {anger: 0, horror: 1});
        PetBehaviorUtil.update(scared, surroundings(), 0.001);
        expect(scared.needs.horror).toBe(0);
        expect(scared.action).not.toBe(A.Panic);
        live(scared, START_SECONDS);
        expect(scared.action).toBe(A.Panic);

        // A battery charges it at once; its word for it comes after.
        const charged = behave(identity(), {energy: 0.5});
        PetBehaviorUtil.inject(charged, surroundings(), PetInjectionEnumMap.Battery);
        expect(charged.needs.energy).toBe(1);
        PetBehaviorUtil.update(charged, surroundings(), 0.001);
        expect(charged.saying).toBe("");
        expect(live(charged, REACTION_SECONDS)).toHaveLength(1);

        // Something built near it is remarked on after.
        const watching = behave(identity("Rex", {dependence: TOP_LEVEL}), {}, owner.user.id);
        for (let i = 0; i < 200 && watching.pendingEdit == undefined; ++i)
            PetBehaviorUtil.noticeEdit(watching, surroundings(), "blockAdded", {x: PET_FLOOR.x + 2, y: 0.25, z: PET_FLOOR.z}, owner.user.id);
        expect(watching.pendingEdit).toBeDefined();
        PetBehaviorUtil.update(watching, surroundings(), 0.001);
        expect(watching.action).not.toBe(A.EditRemark);
        live(watching, REACTION_SECONDS);
        expect(watching.action).toBe(A.EditRemark);

        // Set on by another pet, it starts, and fights back or runs, after.
        const victim = behave();
        const attacker = {objectId: "petAAAA2", ownerUserID: "someone", identity: identity("Grr"),
            at: {x: PET_FLOOR.x + 0.5 * PET_ATTACK_REACH, y: 0, z: PET_FLOOR.z},
            shown: {...PetShownStateUtil.decode(""), action: A.Attack, targetId: victim.objectId}};
        PetBehaviorUtil.update(victim, {...surroundings(), pets: [attacker]}, 0.001);
        expect([A.Attack, A.Flee]).not.toContain(victim.action);
        for (let elapsed = 0; elapsed < START_SECONDS; elapsed += 0.2)
        {
            vi.setSystemTime(Date.now() + 200);
            PetBehaviorUtil.update(victim, {...surroundings(), pets: [attacker]}, 0.2);
        }
        expect([A.Attack, A.Flee]).toContain(victim.action);
    });

    it("turns to its way before it goes, standing meanwhile, and faster in a fight or a fright", () => {
        expect(PET_HURRIED_TURN_RATE).toBeGreaterThan(PET_TURN_RATE);
        for (const action of [A.Attack, A.Panic, A.Flee])
            expect(PetBehaviorUtil.getTurnRate(action)).toBe(PET_HURRIED_TURN_RATE);
        for (const action of [A.Idle, A.Wander, A.SmallTalk, A.Come, A.Chat])
            expect(PetBehaviorUtil.getTurnRate(action)).toBe(PET_TURN_RATE);

        // It faces north; its way lies due south, right behind it.
        const b = behave();
        b.path = [{x: PET_FLOOR.x, y: 0, z: PET_FLOOR.z + 3}];
        const STEP_SECONDS = 0.05;
        let stoodSeconds = 0;
        while (stoodSeconds < 10 && Math.hypot(...Object.values(PetBehaviorUtil.steer(b, STEP_SECONDS))) == 0)
        {
            stoodSeconds += STEP_SECONDS;
            expect(b.turning).toBe(true);
            // The room is shown which way it turns.
            expect(PetBehaviorUtil.getShownState(b).facing).toBe(180);
        }
        expect(stoodSeconds).toBeGreaterThan((180 - PET_MAX_DEGREES_OFF_WAY) / PET_TURN_RATE - 2 * STEP_SECONDS);
        expect(stoodSeconds).toBeLessThan((180 - PET_MAX_DEGREES_OFF_WAY) / PET_TURN_RATE + 2 * STEP_SECONDS);
        // Then it goes, south, still turning the rest of the way.
        expect(b.turning).toBe(false);
        expect(PetBehaviorUtil.steer(b, STEP_SECONDS).z).toBeGreaterThan(0);
        expect(PetBehaviorUtil.getShownState(b).facing).toBeUndefined();
        expect(Math.abs(180 - b.facing)).toBeLessThanOrEqual(PET_MAX_DEGREES_OFF_WAY);
    });

    // The most dependent, east of its owner and a little off the grid's points, with a hug due.
    function hugger(): PetBehavior
    {
        const b = behave(identity("Rex", {dependence: TOP_LEVEL}), {}, "an-owner",
            {x: OWNER_SPOT.x + 5.87, y: 0, z: OWNER_SPOT.z + 0.11});
        b.nextWanderAt = b.nextTalkAt = b.nextRemarkAt = b.nextPersonRemarkAt = Infinity;
        b.nextHugAt = Date.now();
        return b;
    }

    // Where a pet standing at one place stops on its way up to someone at another: a little way off them, on the line
    // from them to it.
    function approachPoint(from: Vec3, to: Vec3): Vec3
    {
        const distance = Math.hypot(from.x - to.x, from.z - to.z);
        return {x: to.x + (from.x - to.x) / distance * PET_APPROACH_DISTANCE, y: to.y,
            z: to.z + (from.z - to.z) / distance * PET_APPROACH_DISTANCE};
    }

    it("goes to hug someone straight at a little way off where they are now, wherever they walk, never turning away from them", async () => {
        const owner = await join("an-owner");
        const b = hugger();
        let setOff = false;
        for (let beat = 0; beat < 150 && b.pressUntil == 0; ++beat)
        {
            // Its owner strolls north, across its way.
            moveTo(owner, {x: OWNER_SPOT.x, y: STANDING_Y, z: OWNER_SPOT.z - 0.1 * beat});
            const ownerAt = surroundings().people.find(person => person.userID == "an-owner")!.at;
            const from = {...b.at};
            liveMoving(b, 0.2);
            expect(b.action).toBe(A.Hug);
            if (b.pressUntil > 0)
                break;
            const to = approachPoint(from, ownerAt);
            // (Short of it by less than a beat's walk, it gets there within the beat, to hug them from the next.)
            if (b.path.length == 0)
                expect(Math.hypot(b.at.x - to.x, b.at.z - to.z), `beat ${beat}`).toBeLessThanOrEqual(PET_APPROACH_SLACK);
            else
            {
                expect(b.path).toHaveLength(1);
                expect(b.path[0].x).toBeCloseTo(to.x, 6);
                expect(b.path[0].z).toBeCloseTo(to.z, 6);
            }
            setOff = setOff || Math.hypot(b.at.x - from.x, b.at.z - from.z) > 0;
            if (setOff)
                expect(b.turning, `beat ${beat}`).toBe(false);
        }
        expect(b.pressUntil).toBeGreaterThan(0);
    });

    it(`hugging someone, keeps ${PET_APPROACH_DISTANCE} units off them, turned to them: after them as they go, and back from them as they come`, async () => {
        const owner = await join("an-owner");
        const b = hugger();
        const ownerFeet = (): Vec3 => surroundings().people.find(person => person.userID == "an-owner")!.at;
        const apart = () => Math.hypot(b.at.x - ownerFeet().x, b.at.z - ownerFeet().z);
        const offFacing = () => Math.abs(NpcFacingUtil.getTurn(b.facing,
            NpcFacingUtil.getDegrees({x: ownerFeet().x - b.at.x, y: 0, z: ownerFeet().z - b.at.z})));
        const expectKept = (slack: number) => {
            expect(apart()).toBeGreaterThanOrEqual(PET_APPROACH_DISTANCE - slack - 0.01);
            expect(apart()).toBeLessThanOrEqual(PET_APPROACH_DISTANCE + PET_APPROACH_SLACK);
        };
        let nearest = Infinity;
        for (let beat = 0; beat < 150 && b.pressUntil == 0; ++beat)
        {
            liveMoving(b, 0.2);
            nearest = Math.min(nearest, apart());
        }
        expect(b.pressUntil).toBeGreaterThan(0);
        // Long enough for all it does here.
        b.pressUntil = Date.now() + 60_000;
        liveMoving(b, 1);
        expect(Math.min(nearest, apart())).toBeGreaterThanOrEqual(PET_APPROACH_DISTANCE - 0.01);
        expectKept(0);
        expect(b.path).toEqual([]);
        expect(offFacing()).toBeLessThan(5);

        // They step up to it: it backs off, facing them still.
        const {x, z} = ownerFeet();
        moveTo(owner, {x: x + 1, y: STANDING_Y, z});
        let backedOff = false;
        for (let beat = 0; beat < 15; ++beat)
        {
            liveMoving(b, 0.2);
            backedOff = backedOff || b.backingOff;
            expect(b.turning, `beat ${beat}`).toBe(false);
            expect(offFacing(), `beat ${beat}`).toBeLessThan(10);
        }
        expect(backedOff).toBe(true);
        expectKept(PET_APPROACH_SLACK);

        // They step away from it: it goes after them, as far.
        moveTo(owner, {x: x - 2, y: STANDING_Y, z});
        liveMoving(b, 4);
        expect(b.action).toBe(A.Hug);
        expectKept(0);
        expect(b.path).toEqual([]);
    });

    it(`called by its name, comes up to whoever called it, ${PET_APPROACH_DISTANCE} units off them, and stands turned to them`, async () => {
        const caller = await join("a-caller", {x: PET_FLOOR.x + 6, y: STANDING_Y, z: PET_FLOOR.z + 0.3});
        const callerFeet = surroundings().people.find(person => person.userID == caller.user.id)!.at;
        const apart = (b: PetBehavior) => Math.hypot(b.at.x - callerFeet.x, b.at.z - callerFeet.z);
        const b = behave(identity("Rex"));
        b.nextWanderAt = b.nextTalkAt = b.nextRemarkAt = b.nextHugAt = b.nextPersonRemarkAt = Infinity;
        PetBehaviorUtil.hear(b, surroundings(), caller.user.id, "Rex!");
        let nearest = Infinity;
        for (let beat = 0; beat < 50 && (b.stayUntil == 0 || b.path.length > 0); ++beat)
        {
            liveMoving(b, 0.2);
            nearest = Math.min(nearest, apart(b));
        }
        expect(b.action).toBe(A.Come);
        expect(b.stayUntil).toBeGreaterThan(0);
        expect(nearest).toBeGreaterThanOrEqual(PET_APPROACH_DISTANCE - 0.01);
        expect(apart(b)).toBeLessThanOrEqual(PET_APPROACH_DISTANCE + PET_APPROACH_SLACK);
        liveMoving(b, 1);
        expect(b.action).toBe(A.Come);
        expect(Math.abs(NpcFacingUtil.getTurn(b.facing,
            NpcFacingUtil.getDegrees({x: callerFeet.x - b.at.x, y: 0, z: callerFeet.z - b.at.z})))).toBeLessThan(5);
    });

    it("goes round a wall between it and whoever it hugs, setting off from where it stands, never through it", async () => {
        const voxels = getRoom().voxelGrid.voxels;
        const wallCol = VoxelQueryUtil.getVoxelColFromWorldX(OWNER_SPOT.x + 3.25);
        for (let row = VoxelQueryUtil.getVoxelRowFromWorldZ(OWNER_SPOT.z - 3.5);
            row <= VoxelQueryUtil.getVoxelRowFromWorldZ(OWNER_SPOT.z + 4); ++row)
        {
            for (let layer = 0; layer < STOREY_FLOOR_COLLISION_LAYER; ++layer)
                VoxelQueryUtil.getVoxel(voxels, row, wallCol)!.blockLayerMask |= 1 << layer;
        }
        await join("an-owner");
        const b = hugger();
        b.facing = 270;
        live(b, 0.2);
        expect(b.action).toBe(A.Hug);
        // Off for the wall's end, straight to the farthest point of its way it can walk straight to, not first to the
        // point of the grid nearest it.
        expect(b.path.length).toBeGreaterThan(1);
        expect(Math.hypot(b.path[0].x - b.at.x, b.path[0].z - b.at.z)).toBeGreaterThan(VOXEL_CELL_SIZE);
        for (let beat = 0; beat < 150 && b.pressUntil == 0; ++beat)
        {
            const from = {...b.at};
            liveMoving(b, 0.2);
            expect(VoxelQueryUtil.isLineClear(voxels, {...from, y: 0.25}, {...b.at, y: 0.25}), `beat ${beat}`).toBe(true);
        }
        expect(b.pressUntil).toBeGreaterThan(0);
    });

    it("sets off on any way from where it stands, never back to the point of the grid nearest it first", () => {
        // A little east of a point of the grid, frightened by something west of it, it flees east.
        const b = behave(identity(), {}, "an-owner", {x: PET_FLOOR.x + 0.2, y: 0, z: PET_FLOOR.z});
        PetBehaviorUtil.expose(b, surroundings(), {x: PET_FLOOR.x - 2, y: 0, z: PET_FLOOR.z}, PET_BLAST_FRIGHT);
        live(b, START_SECONDS);
        expect(b.action).toBe(A.Flee);
        expect(b.path[0].x).toBeGreaterThan(b.at.x);
    });

    it("is told to its room a stretch at a time: none while it stands turning, then as far as the next corner it turns at", () => {
        const standing = (feet: Vec3) => PetBodyUtil.getStandingPos(feet);
        const north = {x: PET_FLOOR.x, y: 0, z: PET_FLOOR.z - 2};
        const northEast = {x: PET_FLOOR.x + 2, y: 0, z: PET_FLOOR.z - 2};
        const farEast = {x: PET_FLOOR.x + 4, y: 0, z: PET_FLOOR.z - 2};
        // It faces north: its way goes north, turns east at a right angle, and goes on east.
        const b = behave();
        b.path = [north, northEast, farEast];
        b.speed = 1;
        ++b.pathRevision;
        const sync = PetPathSyncUtil.create(standing(b.at));
        PetBehaviorUtil.steer(b, 0.001);
        expect(b.turning).toBe(false);
        expect(PetPathSyncUtil.takeWaypoints(sync, b, standing(b.at))).toEqual([{pos: standing(north), speed: 1}]);
        expect(PetPathSyncUtil.takeWaypoints(sync, b, standing(b.at))).toBeUndefined();

        // At the corner it stands and turns, where the room has it stand already: nothing more is told.
        PetPathSyncUtil.advance(sync, 2);
        b.at = {...north};
        vi.setSystemTime(Date.now() + 2000);
        expect(PetBehaviorUtil.steer(b, 0.001)).toEqual({x: 0, y: 0, z: 0});
        expect(b.turning).toBe(true);
        expect(PetPathSyncUtil.takeWaypoints(sync, b, standing(north))).toBeUndefined();

        // Turned, it goes on, and the rest, which runs straight, is told whole.
        b.facing = 90;
        expect(PetBehaviorUtil.steer(b, 0.001).x).toBeGreaterThan(0);
        expect(PetPathSyncUtil.takeWaypoints(sync, b, standing(north))?.map(waypoint => waypoint.pos))
            .toEqual([standing(northEast), standing(farEast)]);
    });

    describe("its body, where physics has it off its way", () => {
        const standing = (feet: Vec3) => PetBodyUtil.getStandingPos(feet);
        const BEAT = 0.2, STEP = 0.05;
        // A beat of its body's steps, each leaving it at one of the places given, with the room playing on meanwhile:
        // where that leaves it.
        function step(sync: ReturnType<typeof PetPathSyncUtil.create>, places: Vec3[]): Vec3
        {
            for (const place of places)
            {
                PetPathSyncUtil.trace(sync, place, STEP);
                PetPathSyncUtil.advance(sync, STEP);
            }
            return places[places.length - 1];
        }

        it("is told to its room as where it has been: there in a beat at first, then point by point, as fast as it went", () => {
            const b = behave();
            const start = standing(b.at);
            const up = (height: number) => ({...start, y: start.y + height});
            const sync = PetPathSyncUtil.create(start);
            expect(PetPathSyncUtil.takeWaypoints(sync, b, start)).toBeUndefined();

            // Something throws it up: at first the room is told only where that has left it, to bring it there in the
            // beat's time, and to turn it nowhere for that.
            let at = step(sync, [up(0.2), up(0.5), up(0.9), up(1.2)]);
            let told = PetPathSyncUtil.takeWaypoints(sync, b, at)!;
            expect(told.map(waypoint => waypoint.pos)).toEqual([up(1.2)]);
            expect(told[0].carried).toBe(true);
            expect(told[0].speed).toBeCloseTo(1.2 / BEAT, 6);

            // From then on every place its body was at, each reached as fast as its body got there: up a little more,
            // and down again past where the room had it a beat before.
            at = step(sync, [up(1.3), up(1.2), up(0.9), up(0.6)]);
            told = PetPathSyncUtil.takeWaypoints(sync, b, at)!;
            expect(told.map(waypoint => waypoint.pos)).toEqual([up(1.3), up(1.2), up(0.9), up(0.6)]);
            expect(told.every(waypoint => waypoint.carried)).toBe(true);
            [0.1, 0.1, 0.3, 0.3].forEach((rise, i) => expect(told[i].speed).toBeCloseTo(rise / STEP, 6));

            // A beat on, the room has it where its body was then; and lying still there, nothing more is told of it.
            at = step(sync, [at, at, at, at]);
            expect(Math.abs(sync.shownAt.y - at.y)).toBeLessThan(1e-6);
            expect(PetPathSyncUtil.takeWaypoints(sync, b, at)).toBeUndefined();
            at = step(sync, [at, at, at, at]);
            expect(PetPathSyncUtil.takeWaypoints(sync, b, at)).toBeUndefined();
        });

        it("going its way by itself is none of that, however fast; held up on it, it is, and then goes on from there", () => {
            const b = behave();
            b.facing = 90;
            const end = {x: PET_FLOOR.x + 12, y: 0, z: PET_FLOOR.z};
            b.path = [end];
            b.speed = 4.5;
            ++b.pathRevision;
            const sync = PetPathSyncUtil.create(standing(b.at));
            PetBehaviorUtil.steer(b, 0.001);
            expect(PetPathSyncUtil.takeWaypoints(sync, b, standing(b.at))).toEqual([{pos: standing(end), speed: 4.5}]);

            // Each beat takes it far more than it may be off its way, along it.
            const walk = () => {
                const places: Vec3[] = [];
                for (let i = 0; i < BEAT / STEP; ++i)
                {
                    b.at = {...b.at, x: b.at.x + b.speed * STEP};
                    places.push(standing(b.at));
                }
                return step(sync, places);
            };
            for (let beat = 0; beat < 5; ++beat)
                expect(PetPathSyncUtil.takeWaypoints(sync, b, walk())).toBeUndefined();

            // Something holds it up where it is, while the room has it go on: a beat behind is no matter, two are.
            const held = standing(b.at);
            step(sync, [held, held, held, held]);
            expect(PetPathSyncUtil.takeWaypoints(sync, b, held)).toBeUndefined();
            step(sync, [held, held, held, held]);
            const told = PetPathSyncUtil.takeWaypoints(sync, b, held)!;
            expect(told.map(waypoint => waypoint.pos)).toEqual([held, standing(end)]);
            expect(told.map(waypoint => waypoint.carried)).toEqual([true, undefined]);
            // Back to where it is in a beat, at no rush, and then on along its way as fast as it goes.
            expect(told[0].speed).toBeCloseTo(2 * b.speed, 6);
            expect(told[1].speed).toBe(b.speed);

            // Let go, it goes on by itself, the room a beat behind it on the same way: nothing more to tell.
            for (let beat = 0; beat < 3; ++beat)
                expect(PetPathSyncUtil.takeWaypoints(sync, b, walk())).toBeUndefined();
        });

        it("on a way that climbs, is played at the pace it keeps across the floor", () => {
            const b = behave();
            b.facing = 90;
            const foot = {x: PET_FLOOR.x + 2, y: 0, z: PET_FLOOR.z};
            const top = {x: PET_FLOOR.x + 2.5, y: PET_CLIMB_LAYERS * COLLISION_LAYER_HEIGHT, z: PET_FLOOR.z};
            b.path = [foot, top];
            b.speed = 1;
            ++b.pathRevision;
            const sync = PetPathSyncUtil.create(standing(b.at));
            PetBehaviorUtil.steer(b, 0.001);
            const told = PetPathSyncUtil.takeWaypoints(sync, b, standing(b.at))!;
            expect(told.map(waypoint => waypoint.pos)).toEqual([standing(foot), standing(top)]);
            expect(told[0].speed).toBe(1);
            expect(told[1].speed).toBeCloseTo(Math.hypot(0.5, top.y) / 0.5, 6);
        });

        it("has it turned toward the next place it goes to by itself, and nowhere for a place it is carried to", () => {
            const from = standing(PET_FLOOR);
            const thrown = {pos: {...from, y: from.y + 1, z: from.z + 1}, speed: 6, carried: true};
            const east = {pos: {...from, x: from.x + 3}, speed: 1};
            expect(PetPathSyncUtil.follow([thrown], 0, {...from}, 0.01).facing).toBeUndefined();
            expect(PetPathSyncUtil.follow([thrown, east], 0, {...from}, 0.01).facing).toBe(90);
            expect(PetPathSyncUtil.follow([east], 0, {...from}, 0.01).facing).toBe(90);
            // It gets where it is carried all the same.
            const pos = {...from};
            expect(PetPathSyncUtil.follow([thrown], 0, pos, 10).next).toBe(1);
            expect(pos).toEqual(thrown.pos);
        });
    });

    it("stays turned to whoever it has a word for, wherever they go, and then keeps quiet a while", async () => {
        const owner = await join("an-owner", {x: PET_FLOOR.x + 2, y: STANDING_Y, z: PET_FLOOR.z});
        const b = behave(identity("Rex", {sociability: 0}), {}, owner.user.id);
        b.nextPersonRemarkAt = 0;
        b.nextWanderAt = b.nextTalkAt = b.nextRemarkAt = b.nextHugAt = Infinity;
        PetBehaviorUtil.update(b, surroundings(), 0.2);
        expect(b.action).toBe(A.PersonRemark);
        expect(b.standFacing).toBe(90);
        moveTo(owner, {x: PET_FLOOR.x, y: STANDING_Y, z: PET_FLOOR.z + 2});
        live(b, 0.2);
        expect(b.action).toBe(A.PersonRemark);
        expect(b.standFacing).toBe(180);

        // Its word said, it has no other for a good while, though one is due.
        live(b, PetBehaviorUtil.getReadTime(b.saying) / 1000);
        expect(b.action).toBe(A.Idle);
        expect(b.quietUntil).toBeGreaterThan(Date.now());
        b.nextPersonRemarkAt = 0;
        live(b, 1);
        expect(b.action).toBe(A.Idle);
        vi.setSystemTime(b.quietUntil);
        live(b, 0.2);
        expect(b.action).toBe(A.PersonRemark);
    });

    it("spoken to, turns to them a moment later, says its answer once it has one, and stays turned to them a while", async () => {
        const speaker = await join("a-speaker", {x: PET_FLOOR.x + 2, y: STANDING_Y, z: PET_FLOOR.z});
        const speakerObjectId = harness.getPlayerObject(speaker.user.id)!.objectId;
        const b = behave();
        PetBehaviorUtil.attend(b, surroundings(), speakerObjectId);
        PetBehaviorUtil.update(b, surroundings(), 0.2);
        expect(b.action).not.toBe(A.Chat);
        live(b, REACTION_SECONDS);
        expect(b.action).toBe(A.Chat);
        expect(b.targetId).toBe(speakerObjectId);
        expect(b.standFacing).toBe(90);
        expect(b.path).toEqual([]);

        PetBehaviorUtil.answer(b, surroundings(), speakerObjectId, {text: "Hello there!", mood: 1});
        expect(live(b, 0.4)).toEqual([{text: "Hello there!", tone: PetSpeechToneEnumMap.Normal}]);
        expect(b.expression).toBe(PetExpressionEnumMap.Happy);
        moveTo(speaker, {x: PET_FLOOR.x, y: STANDING_Y, z: PET_FLOOR.z + 2});
        live(b, 0.2);
        expect(b.standFacing).toBe(180);
        // Left alone, it waits no longer than it does for an answer, and goes back to its own doings.
        live(b, PET_ANSWER_WAIT_MS / 1000);
        expect(b.action).not.toBe(A.Chat);
        // Its answer still up, it stays turned to them wherever they go.
        expect(b.saying).toBe("Hello there!");
        moveTo(speaker, {x: PET_FLOOR.x - 2, y: STANDING_Y, z: PET_FLOOR.z});
        live(b, 0.2);
        expect(b.standFacing).toBe(270);
        expect(PetBehaviorUtil.getShownState(b).facing).toBe(270);

        // An answer that comes before it has turned to them is said once it has.
        const quick = behave();
        PetBehaviorUtil.answer(quick, surroundings(), speakerObjectId, {text: "Hi.", mood: 0});
        expect(quick.saying).toBe("");
        expect(live(quick, REACTION_SECONDS)).toContainEqual({text: "Hi.", tone: PetSpeechToneEnumMap.Normal});
        expect(quick.action).toBe(A.Chat);

        // Asleep, nothing but its name reaches it (see PetListenerUtil), which wakes it to answer; out of battery, nothing
        // does.
        const asleep = behave(identity(), {fatigue: 1});
        live(asleep, 0.4);
        expect(asleep.action).toBe(A.Sleep);
        PetBehaviorUtil.attend(asleep, surroundings(), speakerObjectId);
        live(asleep, 2 * REACTION_SECONDS);
        expect(asleep.action).toBe(A.Chat);
        const flat = behave(identity(), {energy: 0});
        PetBehaviorUtil.attend(flat, surroundings(), speakerObjectId);
        expect(flat.heard).toBeUndefined();
    });

    it("spoken to by its name, turns to them and answers where it stands, never going to them, whichever word comes first", async () => {
        const caller = await join("a-caller", {x: PET_FLOOR.x + 5, y: STANDING_Y, z: PET_FLOOR.z});
        const callerObjectId = harness.getPlayerObject(caller.user.id)!.objectId;
        const line = "Rex, how are you?";
        // Its owner's browser may hear the line before it is told the line is for the pet, or after; the server tells
        // itself the line's listener first.
        for (const first of ["line", "listener"])
        {
            const b = behave(identity("Rex"));
            b.nextWanderAt = Infinity;
            if (first == "line")
                PetBehaviorUtil.hear(b, surroundings(), caller.user.id, line);
            PetBehaviorUtil.attend(b, surroundings(), callerObjectId);
            if (first == "listener")
                PetBehaviorUtil.hear(b, surroundings(), caller.user.id, line);
            const said: string[] = [];
            for (let beat = 0; beat < (REACTION_SECONDS + 3) / 0.2; ++beat)
            {
                if (beat == Math.ceil(REACTION_SECONDS / 0.2))
                    PetBehaviorUtil.answer(b, surroundings(), callerObjectId, {text: "Never better!", mood: 1});
                for (const {text} of liveMoving(b, 0.2))
                {
                    if (said[said.length - 1] != text)
                        said.push(text);
                }
                expect(b.action, first).not.toBe(A.Come);
                expect(b.at, first).toEqual(PET_FLOOR);
            }
            expect(b.action, first).toBe(A.Chat);
            expect(said, first).toEqual(["Never better!"]);
        }

        // On its way to them already, at a line someone else answered, it stops where it is to answer them.
        const coming = behave(identity("Rex"));
        PetBehaviorUtil.hear(coming, surroundings(), caller.user.id, "Rex!");
        live(coming, REACTION_SECONDS);
        expect(coming.action).toBe(A.Come);
        PetBehaviorUtil.answer(coming, surroundings(), callerObjectId, {text: "Yes?", mood: 0});
        expect(live(coming, REACTION_SECONDS)).toContainEqual({text: "Yes?", tone: PetSpeechToneEnumMap.Normal});
        expect(coming.action).toBe(A.Chat);
        expect(coming.path).toEqual([]);
    });

    it("spoken to by its name from across the room, answers from there, turned to them a while", async () => {
        const caller = await join("a-caller", {x: PET_FLOOR.x + 15, y: STANDING_Y, z: PET_FLOOR.z});
        const callerObjectId = harness.getPlayerObject(caller.user.id)!.objectId;
        const b = behave(identity("Rex"));
        PetBehaviorUtil.hear(b, surroundings(), caller.user.id, "Rex, how are you?");
        PetBehaviorUtil.attend(b, surroundings(), callerObjectId);
        live(b, REACTION_SECONDS + 2);
        expect(b.action).toBe(A.Chat);
        expect(b.standFacing).toBe(90);
        PetBehaviorUtil.answer(b, surroundings(), callerObjectId, {text: "Never better!", mood: 1});
        expect(live(b, 2)).toEqual([{text: "Never better!", tone: PetSpeechToneEnumMap.Normal}]);
        expect(b.action).toBe(A.Chat);
        expect(b.at).toEqual(PET_FLOOR);
    });

    it("dying, keeps close to its owner, or to what they look at while they edit, however little it depends on them", async () => {
        const owner = await join("an-owner", OWNER_SPOT);
        const ownerFeet = {x: OWNER_SPOT.x, y: 0, z: OWNER_SPOT.z};
        const dying = PET_DYING_HOURS / PET_HEALTH_HOURS - 0.01;
        // Back within its leash, give or take what it lets slip before it goes after them.
        const near = (at: Vec3, to: Vec3) => Math.hypot(at.x - to.x, at.z - to.z) <= PET_DYING_LEASH + 2;
        const start = {x: OWNER_SPOT.x + 7, y: 0, z: OWNER_SPOT.z};
        const quiet = (b: PetBehavior) => { b.nextTalkAt = b.nextRemarkAt = b.nextHugAt = b.nextPersonRemarkAt = Infinity; };

        const b = behave(identity("Rex", {dependence: 0}), {health: dying}, owner.user.id, start);
        quiet(b);
        liveMoving(b, 40);
        expect(near(b.at, ownerFeet)).toBe(true);
        // Healthy, nothing draws it back.
        expect(PET_LEASH_BY_DEPENDENCE[0]).toBe(Infinity);

        const focus = {x: OWNER_SPOT.x, y: 0, z: OWNER_SPOT.z - 7};
        const c = behave(identity("Rex", {dependence: 0}), {health: dying}, owner.user.id, {...ownerFeet});
        quiet(c);
        liveMoving(c, 40, 0.2, focus);
        expect(near(c.at, focus)).toBe(true);
        expect(near(c.at, ownerFeet)).toBe(false);
    });

    it("the more it depends on its owner, wanders the nearer them, and where it likes if it doesn't", async () => {
        const owner = await join("an-owner", OWNER_SPOT);
        const ownerFeet = {x: OWNER_SPOT.x, y: 0, z: OWNER_SPOT.z};
        const farthestWander = (dependence: number): number => {
            let farthest = 0;
            for (let i = 0; i < 60; ++i)
            {
                const b = behave(identity("Rex", {dependence, sociability: 0}), {}, owner.user.id,
                    {x: OWNER_SPOT.x + 1, y: 0, z: OWNER_SPOT.z});
                b.nextWanderAt = 0;
                // Nothing else on its mind.
                b.nextTalkAt = b.nextRemarkAt = b.nextHugAt = b.nextPersonRemarkAt = Infinity;
                PetBehaviorUtil.update(b, surroundings(), 0.2);
                if (b.action != A.Wander || b.path.length == 0)
                    continue;
                const end = b.path[b.path.length - 1];
                farthest = Math.max(farthest, Math.hypot(end.x - ownerFeet.x, end.z - ownerFeet.z));
            }
            return farthest;
        };
        for (let dependence = 1; dependence < PET_TRAIT_LEVELS; ++dependence)
        {
            const farthest = farthestWander(dependence);
            expect(farthest).toBeGreaterThan(0);
            expect(farthest).toBeLessThanOrEqual(PET_LEASH_BY_DEPENDENCE[dependence] + 0.001);
        }
        expect(PET_LEASH_BY_DEPENDENCE[TOP_LEVEL]).toBeLessThan(PET_LEASH_BY_DEPENDENCE[MIDDLE_LEVEL]);
        expect(farthestWander(0)).toBeGreaterThan(PET_LEASH_BY_DEPENDENCE[TOP_LEVEL]);
    });

    it("means to say a word on what its owner builds far oftener than on what anyone else does, and on neither from afar", async () => {
        const owner = await join("an-owner", OWNER_SPOT);
        const count = (byUserID: string, at: Vec3): number => {
            let noticed = 0;
            for (let i = 0; i < 400; ++i)
            {
                const b = behave(identity(), {}, owner.user.id);
                PetBehaviorUtil.noticeEdit(b, surroundings(), "blockAdded", at, byUserID);
                noticed += (b.pendingEdit != undefined) ? 1 : 0;
            }
            return noticed;
        };
        const near = {x: PET_FLOOR.x + 2, y: 0.25, z: PET_FLOOR.z};
        const ownersEdits = count(owner.user.id, near);
        const strangersEdits = count("a-stranger", near);
        expect(strangersEdits).toBeGreaterThan(0);
        expect(ownersEdits).toBeGreaterThan(1.8 * strangersEdits);
        expect(count(owner.user.id, {x: PET_FLOOR.x + 15, y: 0.25, z: PET_FLOOR.z})).toBe(0);
    });

    it("has a word now and then for someone near who is doing nothing, its owner far oftener than anyone else", async () => {
        const owner = await join("an-owner", {x: PET_FLOOR.x + 2, y: STANDING_Y, z: PET_FLOOR.z});
        await join("a-stranger", {x: PET_FLOOR.x - 2, y: STANDING_Y, z: PET_FLOOR.z});
        const spokenTo = {owner: 0, stranger: 0};
        for (let i = 0; i < 300; ++i)
        {
            const b = behave(identity("Rex", {sociability: 0}), {}, owner.user.id);
            b.nextPersonRemarkAt = 0;
            b.nextWanderAt = b.nextTalkAt = b.nextRemarkAt = b.nextHugAt = Infinity;
            PetBehaviorUtil.update(b, surroundings(), 0.2);
            if (b.action != A.PersonRemark)
                continue;
            expect(b.saying.length).toBeGreaterThan(0);
            if (b.targetId == harness.getPlayerObject(owner.user.id)!.objectId)
                ++spokenTo.owner;
            else
                ++spokenTo.stranger;
        }
        expect(spokenTo.stranger).toBeGreaterThan(0);
        expect(spokenTo.owner).toBeGreaterThan(2 * spokenTo.stranger);
    });

    it("says nothing longer than a bubble takes, however it says it, and pictures no control but a battery and a wrench", () => {
        for (const line of PetLineMap.getAllLines())
        {
            const controls = [...line.text.matchAll(/<control name="(\w+)"\/>/g)].map(match => match[1]);
            expect(controls.every(control => control == "battery" || control == "wrench"), line.text).toBe(true);
            expect(line.text).not.toMatch(/\$\d/);
            expect(MessageLinkUtil.getVisibleLength(line.text), line.text).toBeLessThanOrEqual(OBJECT_MESSAGE_MAX_LENGTH);
            for (let i = 0; i < 20; ++i)
            {
                const said = PetLineMap.vary(line);
                expect(MessageLinkUtil.getVisibleLength(said.text), said.text).toBeLessThanOrEqual(OBJECT_MESSAGE_MAX_LENGTH);
                expect(said.mood).toBe(line.mood);
            }
        }
        expect(PetLineMap.getDyingLine().text).toContain(`<control name="wrench"/>`);
        expect(PetLineMap.getPowerlessLine().text).toContain(`<control name="battery"/>`);
    });

    it("never spells out a robot's sound, however it says a line: its voice makes those as it speaks", () => {
        const spelled = new RegExp(String.raw`\b${PET_ROBOT_SOUND}\b`, "i");
        for (const line of PetLineMap.getAllLines())
        {
            expect(line.text).not.toMatch(spelled);
            for (let i = 0; i < 20; ++i)
                expect(PetLineMap.vary(line).text).not.toMatch(spelled);
        }
    });

    it("seldom says the same thing twice running, and now and then speaks of a writing of Youngjin's, on a page the site has", () => {
        // Of a pool of words, no line comes again within the next few.
        const said = Array.from({length: 60}, () => PetLineMap.pickCueLine("wordless").text);
        said.forEach((line, i) => expect(said.slice(Math.max(0, i - 3), i)).not.toContain(line));
        expect(new Set(said).size).toBeGreaterThan(3);

        // About a writing: some chats, and some words to people, never most of them.
        const topics = Array.from({length: 2000}, () => PetLineMap.pickSmallTalk()!);
        const aboutWritings = (lines: PetLine[]) => lines.some(line => line.text.includes("<link"));
        const share = topics.filter(topic => aboutWritings(PetLineMap.getSmallTalk(topic))).length / topics.length;
        expect(share).toBeGreaterThan(0.05);
        expect(share).toBeLessThan(0.3);
        // Each such line links a page the site has, as a button of a word or two, at most once in a chat.
        for (const line of PetLineMap.getAllLines().filter(line => line.text.includes("<link")))
        {
            const links = MessageLinkUtil.parse(line.text).filter(segment => segment.kind == "link");
            expect(links, line.text).toHaveLength(1);
            const link = links[0] as {href: string, label: string};
            expect(link.label.split(" ").length).toBeLessThanOrEqual(2);
            expect(link.href.startsWith(`${SITE_URL}/`)).toBe(true);
            expect(fs.existsSync(path.join(PUBLIC_DIR, new URL(link.href).pathname.slice(1))), link.href).toBe(true);
        }
        for (let topic = 0; topic < PetLineMap.getNumSmallTalks(); ++topic)
        {
            const talk = PetLineMap.getSmallTalk(topic);
            expect(talk.filter(line => line.text.includes("<link")).length).toBeLessThanOrEqual(1);
            expect(talk.slice(0, -1).some(line => line.text.includes("<link"))).toBe(false);
        }
    });

    it("chats in what browsers fetch, as the server has it, which the client's bundle carries none of", () => {
        // Written by the game's build (see PetLinesBuilder): one left stale here would have browsers chat out of step.
        const written = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, "app/assets", PET_LINES_ASSET_PATH), "utf8"));
        expect(written).toEqual(JSON.parse(JSON.stringify(PET_LINES)));
        const shared = fs.readFileSync(path.resolve(__dirname, "../../../src/shared/object/maps/petLineMap.ts"), "utf8");
        expect(shared).not.toContain(PET_LINES.talks[0][0].text);
    });

    it("asleep shows its eyes shut, however cross it is", () => {
        const b = behave(identity(), {fatigue: 1, anger: 0.6});
        live(b, 0.2);
        expect(b.action).toBe(A.Sleep);
        expect(b.expression).toBe(PetExpressionEnumMap.Asleep);
    });

    it("leaves what it says up long after it has been read, and keeps its face a while after it is done", async () => {
        const owner = await join("an-owner", {x: PET_FLOOR.x + 2, y: STANDING_Y, z: PET_FLOOR.z});
        const line = {text: "Rex! Look at me roll.", mood: 1};
        vi.spyOn(PetLineMap, "pickPersonRemark").mockReturnValue(line);
        const b = behave(identity("Rex", {dependence: TOP_LEVEL}), {}, owner.user.id);
        b.nextPersonRemarkAt = Date.now();
        b.nextWanderAt = b.nextTalkAt = b.nextRemarkAt = b.nextHugAt = Infinity;
        live(b, 0.2);
        expect(b.action).toBe(A.PersonRemark);
        expect(b.saying).toBe(line.text);
        const said = Date.now();

        // Done with it once it has been read, its words still up, and its face glad still.
        const readMs = PetBehaviorUtil.getReadTime(line.text);
        live(b, readMs / 1000 + 0.2);
        expect(b.action).toBe(A.Idle);
        const done = Date.now();
        expect(b.saying).toBe(line.text);
        live(b, (MOOD_LINGER_SECONDS[0] - 0.4));
        expect(b.expression).toBe(PetExpressionEnumMap.Happy);
        live(b, (done + 1000 * MOOD_LINGER_SECONDS[1] - Date.now()) / 1000 + 0.4);
        expect(b.expression).toBe(PetExpressionEnumMap.Neutral);

        // Up as long as a player's message, or three times its reading, whichever is longer.
        const upMs = Math.max(PLAYER_MESSAGE_EXPIRATION_MS, 3 * readMs);
        live(b, (said + upMs - Date.now()) / 1000 - 0.4);
        expect(b.saying).toBe(line.text);
        live(b, 0.8);
        expect(b.saying).toBe("");
    });

    it("idle, stays turned to whoever its words are for while they are still up, wherever they go, and strolls off only after", async () => {
        const owner = await join("an-owner", {x: PET_FLOOR.x + 2, y: STANDING_Y, z: PET_FLOOR.z});
        const line = {text: "Rex! Look at me roll.", mood: 1};
        vi.spyOn(PetLineMap, "pickPersonRemark").mockReturnValue(line);
        const b = behave(identity("Rex", {dependence: TOP_LEVEL}), {}, owner.user.id);
        b.nextPersonRemarkAt = Date.now();
        b.nextWanderAt = b.nextTalkAt = b.nextRemarkAt = b.nextHugAt = Infinity;
        live(b, 0.2);
        expect(b.action).toBe(A.PersonRemark);
        const said = Date.now();
        live(b, PetBehaviorUtil.getReadTime(line.text) / 1000 + 0.2);
        expect(b.action).toBe(A.Idle);

        // A stroll due, it stays where it is, turned to them as they go.
        b.nextWanderAt = Date.now();
        for (const [x, z, facing] of [[PET_FLOOR.x, PET_FLOOR.z + 2, 180], [PET_FLOOR.x - 2, PET_FLOOR.z, 270]])
        {
            moveTo(owner, {x, y: STANDING_Y, z});
            live(b, 0.2);
            expect(b.action).toBe(A.Idle);
            expect(b.standFacing).toBe(facing);
            expect(PetBehaviorUtil.getShownState(b).facing).toBe(facing);
        }

        // Its words gone, it strolls off.
        const upMs = Math.max(PLAYER_MESSAGE_EXPIRATION_MS, 3 * PetBehaviorUtil.getReadTime(line.text));
        live(b, (said + upMs - Date.now()) / 1000 + 0.4);
        expect(b.saying).toBe("");
        expect(b.action).toBe(A.Wander);
    });

    it("goes to say its word on what was built right in front of it, where whoever built it watches it from, turned to it", async () => {
        const owner = await join("an-owner", {x: PET_FLOOR.x - 4, y: STANDING_Y, z: PET_FLOOR.z + 3});
        const start = {x: PET_FLOOR.x - 3, y: 0, z: PET_FLOOR.z};
        const b = behave(identity("Rex", {dependence: TOP_LEVEL}), {}, owner.user.id, start);
        b.nextWanderAt = b.nextTalkAt = b.nextRemarkAt = b.nextHugAt = b.nextPersonRemarkAt = Infinity;
        // A block just built three units east of it, watched from far off to the east, above.
        const at = {x: PET_FLOOR.x, y: 0.25, z: PET_FLOOR.z};
        const viewFrom = {x: PET_FLOOR.x + 6, y: 3, z: PET_FLOOR.z};
        for (let i = 0; i < 50 && b.pendingEdit == undefined; ++i)
            PetBehaviorUtil.noticeEdit(b, surroundings(), "blockAdded", at, owner.user.id, viewFrom);
        expect(b.pendingEdit).toBeDefined();

        const said = liveMoving(b, REACTION_SECONDS + 8);
        expect(said.length).toBeGreaterThan(0);
        const {at: where, facing} = said[0];
        const across = Math.hypot(where.x - at.x, where.z - at.z);
        expect(across).toBeGreaterThanOrEqual(PET_EDIT_VIEW_DISTANCE[0] - 0.2);
        expect(across).toBeLessThanOrEqual(PET_EDIT_VIEW_DISTANCE[1] + 0.2);
        // On the side it is watched from, facing it.
        expect(where.x).toBeGreaterThan(at.x);
        expect(Math.abs(NpcFacingUtil.getTurn(facing, NpcFacingUtil.getDegrees({x: at.x - where.x, y: 0, z: at.z - where.z}))))
            .toBeLessThanOrEqual(PET_MAX_DEGREES_OFF_WAY + 1);
    });

    it(`takes fright from as far as ${PET_FRIGHT_RADIUS} units, near the whole of it a good way off`, () => {
        expect(PetBehaviorUtil.getFrightShare(0)).toBe(1);
        expect(PetBehaviorUtil.getFrightShare(0.5 * PET_FRIGHT_RADIUS)).toBeGreaterThanOrEqual(0.7);
        expect(PetBehaviorUtil.getFrightShare(PET_FRIGHT_RADIUS)).toBe(0);
        const b = behave();
        PetBehaviorUtil.expose(b, surroundings(), {x: PET_FLOOR.x + 0.8 * PET_FRIGHT_RADIUS, y: 0, z: PET_FLOOR.z},
            PET_BLAST_FRIGHT);
        live(b, START_SECONDS);
        expect(b.needs.horror).toBeGreaterThan(0.1);
    });

    it("runs from a fright on a way from where it would come down, while a fan's wind holds it off its feet", () => {
        const b = behave();
        b.at = {...PET_FLOOR, y: PET_FLOOR.y + 4 * COLLISION_LAYER_HEIGHT};
        PetBehaviorUtil.expose(b, surroundings(), PET_FLOOR, PET_BLAST_FRIGHT);
        live(b, START_SECONDS);
        expect(b.action).toBe(A.Flee);
        expect(b.path.length).toBeGreaterThan(0);
        expect(b.path.every(point => point.y == PET_FLOOR.y)).toBe(true);
        const end = b.path[b.path.length - 1];
        expect(Math.hypot(end.x - PET_FLOOR.x, end.z - PET_FLOOR.z)).toBeGreaterThan(1);
    });

    it("steps out of a fan's wind that holds it up, with nowhere it means to go: to the nearest place no wind lifts, as it faces", () => {
        addFloorFan(PET_FLOOR);
        expect(isLiftedAt(PetBodyUtil.getStandingPos(PET_FLOOR))).toBe(true);
        for (const facing of [0, 90, 180, 270])
        {
            const b = behave();
            b.nextWanderAt = Infinity;
            b.facing = facing;
            b.at = {...PET_FLOOR, y: PET_FLOOR.y + 3 * COLLISION_LAYER_HEIGHT};
            live(b, 0.2);
            expect(b.action).toBe(A.Wander);
            const end = b.path[b.path.length - 1];
            expect(isLiftedAt(PetBodyUtil.getStandingPos(end))).toBe(false);
            // The fan's wind is a block wide: a step of two cells clears a body of it.
            expect(Math.hypot(end.x - PET_FLOOR.x, end.z - PET_FLOOR.z)).toBeCloseTo(2 * VOXEL_CELL_SIZE);
            // Off at once, whichever way that is, turning to nothing, and shown so.
            const velocity = PetBehaviorUtil.steer(b, 0.1);
            expect(Math.hypot(velocity.x, velocity.z)).toBeGreaterThan(0);
            expect(b.facing).toBe(facing);
            expect(PetBehaviorUtil.getShownState(b).facing).toBe(facing);
        }
    });

    it("walks on out of a fan's wind it wakes in, worn out as it is, and only then lies down again", () => {
        addFloorFan(PET_FLOOR);
        const b = behave(identity(), {fatigue: 1});
        b.nextWanderAt = Infinity;
        PetBehaviorUtil.takePush(b, surroundings());
        liveMoving(b, START_SECONDS + 3);
        expect(b.action).toBe(A.Sleep);
        expect(isLiftedAt(PetBodyUtil.getStandingPos(b.at))).toBe(false);
    });

    it("called to stand where a fan's wind holds it up, steps out of the wind rather than stay in it", async () => {
        addFloorFan(PET_FLOOR);
        // Past the fan from the pet, which stops short of whoever called it, over the fan.
        const caller = await join("a-caller", {x: PET_FLOOR.x + PET_APPROACH_DISTANCE, y: STANDING_Y, z: PET_FLOOR.z});
        const b = behave(identity("Rex"), {}, "an-owner", {x: PET_FLOOR.x - 4, y: 0, z: PET_FLOOR.z});
        b.nextWanderAt = Infinity;
        PetBehaviorUtil.hear(b, surroundings(), caller.user.id, "Rex!");
        let beatsInWind = 0;
        for (let beat = 0; beat < 40; ++beat)
        {
            liveMoving(b, 0.2);
            if (isLiftedAt(PetBodyUtil.getStandingPos(b.at)))
                ++beatsInWind;
        }
        expect(beatsInWind).toBeGreaterThan(0);
        expect(beatsInWind).toBeLessThanOrEqual(5);
        expect(isLiftedAt(PetBodyUtil.getStandingPos(b.at))).toBe(false);
        expect(Math.hypot(b.at.x - PET_FLOOR.x, b.at.z - PET_FLOOR.z)).toBeLessThan(3);
    });

    it("caught in a fan's wind while it owes someone an answer, says it first, and only then steps out", async () => {
        const speaker = await join("a-speaker", {x: PET_FLOOR.x + 3, y: STANDING_Y, z: PET_FLOOR.z});
        const speakerObjectId = harness.getPlayerObject(speaker.user.id)!.objectId;
        const b = behave();
        b.nextWanderAt = Infinity;
        PetBehaviorUtil.attend(b, surroundings(), speakerObjectId);
        live(b, REACTION_SECONDS);
        expect(b.action).toBe(A.Chat);
        addFloorFan(PET_FLOOR);
        live(b, 1);
        expect(b.action).toBe(A.Chat);
        PetBehaviorUtil.answer(b, surroundings(), speakerObjectId, {text: "Never better!", mood: 1});
        const said = liveMoving(b, 20);
        expect(said.map(line => line.text)).toContain("Never better!");
        expect(isLiftedAt(PetBodyUtil.getStandingPos(b.at))).toBe(false);
    });
});

describe("where a pet can go", () => {
    // A platform of blocks so many layers high, in open floor (each at a place of its own), and a walker's way from
    // the floor beside it to its top, where a pet can stand.
    function findWayOnto(layers: number, walker: typeof PET_WALKER, z: number): unknown
    {
        const voxels = getRoom().voxelGrid.voxels;
        for (let x = 24.25; x < 26; x += VOXEL_CELL_SIZE)
        {
            for (let dz = -0.75; dz < 1; dz += VOXEL_CELL_SIZE)
            {
                const voxel = VoxelQueryUtil.getVoxel(voxels, VoxelQueryUtil.getVoxelRowFromWorldZ(z + dz),
                    VoxelQueryUtil.getVoxelColFromWorldX(x))!;
                for (let layer = 0; layer < layers; ++layer)
                    voxel.blockLayerMask |= 1 << layer;
            }
        }
        const start = VoxelPathUtil.findStandingVertexNear(voxels, {x: 22, y: 0, z}, 0, undefined, PET_WALKER);
        const goal = VoxelPathUtil.findStandingVertexNear(voxels, {x: 25, y: layers * COLLISION_LAYER_HEIGHT, z}, 0,
            undefined, PET_WALKER);
        expect(start).toBeDefined();
        expect(goal).toBeDefined();
        return VoxelPathUtil.findPath(voxels, start!, goal!, undefined, walker);
    }

    beforeEach(async () => {
        await harness.loadRoom(HUB_ID);
    });

    it(`climbs ${PET_CLIMB_LAYERS} blocks at a step, where a player climbs one`, () => {
        expect(PET_WALKER.climbLayers).toBe(PET_CLIMB_LAYERS);
        expect(PLAYER_WALKER.climbLayers).toBe(1);
        expect(PET_WALKER.bodyLayers).toBe(Math.ceil(PET_BODY_HEIGHT / COLLISION_LAYER_HEIGHT));
        expect(PetTypeConfigUtil.getComponents().collider!.maxClimbableHeight)
            .toBeGreaterThanOrEqual(PET_CLIMB_LAYERS * COLLISION_LAYER_HEIGHT);
        expect(PetTypeConfigUtil.getComponents().collider!.maxClimbableHeight)
            .toBeLessThan((PET_CLIMB_LAYERS + 1) * COLLISION_LAYER_HEIGHT);
    });

    it("finds a way up a wall two blocks high, and none up one a block higher", () => {
        expect(findWayOnto(PET_CLIMB_LAYERS, PET_WALKER, 12)).toBeDefined();
        expect(findWayOnto(PET_CLIMB_LAYERS + 1, PET_WALKER, 18)).toBeUndefined();
    });

    it("leaves a player at the foot of two blocks, who goes up one", () => {
        expect(findWayOnto(PET_CLIMB_LAYERS, PLAYER_WALKER, 12)).toBeUndefined();
        expect(findWayOnto(1, PLAYER_WALKER, 18)).toBeDefined();
    });

    // Where a wander sets off for, from a place on a floor, so many times over, each a pet's first.
    function wanderEnds(who: PetIdentity, ownerUserID: string, from: Vec3, count: number): Vec3[]
    {
        const ends: Vec3[] = [];
        for (let i = 0; i < count; ++i)
        {
            const b = behave(who, {}, ownerUserID, from);
            b.nextWanderAt = Date.now();
            b.nextTalkAt = b.nextRemarkAt = b.nextHugAt = b.nextPersonRemarkAt = Infinity;
            live(b, 0.2);
            if (b.path.length > 0)
                ends.push(b.path[b.path.length - 1]);
        }
        return ends;
    }

    it("wanders up and down a stair, whichever floor its owner is on, however curious it is", async () => {
        // A stair a block a step, three units wide, up to the upper floor (feet at its slab's top), through an opening
        // in the slab over all of it but its top step.
        const voxels = getRoom().voxelGrid.voxels;
        expect(VoxelQueryUtil.isVoxelBlockPresentAt(voxels, 20, 20, STOREY_FLOOR_COLLISION_LAYER)).toBe(true);
        for (let row = 26; row < 32; ++row)
        {
            for (let step = 0; step <= STOREY_FLOOR_COLLISION_LAYER; ++step)
            {
                const voxel = VoxelQueryUtil.getVoxel(voxels, row, 30 + step)!;
                for (let layer = 0; layer <= step; ++layer)
                    voxel.blockLayerMask |= 1 << layer;
            }
            for (let col = 26; col < 30 + STOREY_FLOOR_COLLISION_LAYER; ++col)
                VoxelQueryUtil.getVoxel(voxels, row, col)!.blockLayerMask &= ~(1 << STOREY_FLOOR_COLLISION_LAYER);
        }
        const upperFloorY = (STOREY_FLOOR_COLLISION_LAYER + 1) * COLLISION_LAYER_HEIGHT;
        const owner = await join("an-owner", {x: 12, y: STANDING_Y, z: 17.5});
        for (const curiosity of [0, TOP_LEVEL])
        {
            // The least curious seldom tries another floor, so it is given more strolls to be seen doing it.
            const strolls = (curiosity == 0) ? 150 : 30;
            const who = identity("Rex", {dependence: MIDDLE_LEVEL, curiosity, sociability: 0});
            const ups = wanderEnds(who, owner.user.id, {x: 13, y: 0, z: 14.5}, strolls);
            expect(ups.filter(end => end.y > upperFloorY - 0.5).length, `curiosity ${curiosity}, up`).toBeGreaterThan(0);
            const downs = wanderEnds(who, owner.user.id, {x: 20.5, y: upperFloorY, z: 14.5}, strolls);
            expect(downs.filter(end => end.y < 0.5).length, `curiosity ${curiosity}, down`).toBeGreaterThan(0);
        }
    });

    it("the more curious wanders the farther off, the less curious the nearer", () => {
        const from = {x: 16, y: 0, z: 20};
        const meanSpan = (curiosity: number) => {
            const ends = wanderEnds(identity("Rex", {dependence: 0, curiosity, sociability: 0}), "nobody-here", from, 40);
            expect(ends.length).toBe(40);
            return ends.reduce((total, end) => total + Math.hypot(end.x - from.x, end.z - from.z), 0) / ends.length;
        };
        expect(PET_CURIOSITY_PULL[0]).toBeLessThan(0);
        expect(PET_CURIOSITY_PULL[TOP_LEVEL]).toBeGreaterThan(0);
        expect(meanSpan(TOP_LEVEL)).toBeGreaterThan(1.5 * meanSpan(0));
    });
});

describe("how a pet looks", () => {
    const C = PetCompositionConstants;
    const isLabel = (i: number) => i >= C.firstLabelIndex && i < C.firstLabelIndex + C.numLabels;

    it("rusts on more of its tin the more rust it shows, all of it only as scrap, but never on the labels its name is on", () => {
        const parts = PetCompositionUtil.buildParts();
        const ages: number[] = [];
        for (let rust = 0; rust < PET_RUST_LEVELS; ++rust)
        {
            PetCompositionUtil.pose(parts, rust, PET_RUST_LEVELS, PET_BATTERY_LEVELS, PetExpressionEnumMap.Neutral, false, false);
            ages.push(parts[C.baseIndex].rust!);
            parts.forEach((part, i) => {
                if (part.materialId == INSTANCED_TIN_MATERIAL_ID)
                    expect(part.rust).toBe(isLabel(i) ? -1 : ages[rust]);
            });
        }
        expect(ages[0]).toBe(-1);
        expect(ages[ages.length - 1]).toBeLessThan(1);
        ages.slice(1).forEach((age, i) => expect(age).toBeGreaterThan(ages[i]));
        // As scrap, rusted through but for its labels.
        PetCompositionUtil.poseScrap(parts);
        parts.forEach((part, i) => {
            if (part.materialId == INSTANCED_TIN_MATERIAL_ID)
                expect(part.rust).toBe(isLabel(i) ? -1 : 1);
        });
    });

    it("is painted the color it was generated with, but for its face, wheels and labels, and prints light on the darkest", () => {
        const colors = ColorPaletteMap[PET_COLOR_PALETTE_NAME].map(hex => ColorUtil.hexToRGB(hex));
        // One stored with no color chosen is white.
        expect(PetIdentityUtil.getBodyColor(PetIdentityUtil.decode(""))).toEqual({x: 255, y: 255, z: 255});
        const derive = PetTypeConfigUtil.getComponents().instancedMeshComposer!.deriveParts!;
        colors.forEach((color, colorIndex) => {
            const parts = PetCompositionUtil.buildParts();
            const pet = new AddObjectSignal(HUB_ID, "an-owner", "An Owner", ObjectTypeConfigMap.getIndexByType("Pet"), "petAAAA1",
                new ObjectTransform({...PET_FLOOR}, {x: 0, y: 0, z: 1}, {x: 1, y: 1, z: 1}),
                {[ObjectMetadataKeyEnumMap.PetIdentity]: new EncodableByteString(PetIdentityUtil.encode(
                    {...identity(), colorIndex}))});
            derive(pet, parts);
            expect(parts[C.baseIndex].color).toEqual(color);
            expect(parts[C.headIndex].color).toEqual(color);
            for (let i = 0; i < C.numWheels; ++i)
                expect(parts[C.firstWheelIndex + i].color).toEqual(C.wheelColor);
            for (let i = 0; i < C.numLabels; ++i)
                expect(parts[C.firstLabelIndex + i].color).toEqual(C.labelColor);
        });
        // Only on the darkest of them does dark ink go unseen.
        const brightness = (c: Vec3) => 0.299 * c.x + 0.587 * c.y + 0.114 * c.z;
        const darkest = colors.reduce((a, c) => (brightness(c) < brightness(a)) ? c : a);
        expect(colors.filter(c => PetCompositionUtil.getPrintInk(c).x == C.lightInkColor.x)).toEqual([darkest]);
        expect(PetCompositionUtil.getPrintInk(colors[0])).toEqual(C.inkColor);
    });

    it("has a label of its own color under the box its name is printed in, front and back, just short of the print", () => {
        const parts = PetCompositionUtil.buildParts();
        const plates = PetCompositionUtil.getPlates();
        expect(C.numLabels).toBe(plates.length);
        plates.forEach((plate, i) => {
            const label = parts[C.firstLabelIndex + i];
            expect(label.color).toEqual(C.labelColor);
            expect(label.color).not.toEqual(C.bodyColor);
            // Within the plate, as wide as the box and as high, on the plate's side of the body.
            expect(label.scale.x).toBeCloseTo((C.nameBox.right - C.nameBox.left) * plate.size.x, 6);
            expect(label.scale.y).toBeCloseTo((C.nameBox.bottom - C.nameBox.top) * plate.size.y, 6);
            expect(Math.abs(label.offset.y - plate.offset.y) + 0.5 * label.scale.y).toBeLessThanOrEqual(0.5 * plate.size.y);
            const front = Math.sign(plate.dir.z) * (label.offset.z + Math.sign(plate.dir.z) * 0.5 * label.scale.z);
            expect(front).toBeGreaterThan(0.5 * PET_BODY_WIDTH);
            expect(front).toBeLessThan(Math.abs(plate.offset.z));
        });
    });
});

describe("coming into a room after their owner", () => {
    const boxesOverlap = (a: Vec3, b: Vec3) => Math.abs(a.x - b.x) < 2 * PetBodyUtil.getBox(a).halfSize.x
        && Math.abs(a.z - b.z) < 2 * PetBodyUtil.getBox(a).halfSize.z;

    it("a pet waits for the spot to clear, then comes in beside it, and the next beside that one", async () => {
        const owner = await join("an-owner");
        const arrival = harness.getPlayerObject(owner.user.id)!.transform;
        const entrance = PetEntranceUtil.create(getRoom(), arrival, ["petAAAA1", "petAAAA2", "petAAAA3"], Date.now());
        // Its owner stands on the spot, having been put down there.
        expect(PetEntranceUtil.isFree(getRoom(), entrance.spot.pos)).toBe(false);
        expect(PetEntranceUtil.takeNext(getRoom(), entrance, Date.now() + PET_ENTRANCE_PATIENCE_MS - 1)).toBeUndefined();

        // Each comes in where the last one would have, had it not stood there still.
        const taken: Vec3[] = [];
        for (const petId of ["petAAAA1", "petAAAA2", "petAAAA3"])
        {
            vi.setSystemTime(Date.now() + PET_ENTRANCE_PATIENCE_MS);
            const next = PetEntranceUtil.takeNext(getRoom(), entrance, Date.now());
            expect(next?.petId).toBe(petId);
            expect(PetEntranceUtil.isFree(getRoom(), next!.pos)).toBe(true);
            expect(taken.some(pos => boxesOverlap(pos, next!.pos))).toBe(false);
            taken.push(next!.pos);
            // (A pet of the room's stands in for it, which nobody has to have paid for.)
            const body = petSignal(ADMIN, petId, identity("Rex", {}, 1), PetBodyUtil.getFeet(next!.pos), SERVER_PET_TYPE_INDEX);
            expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, body)).toBe(true);
        }
        expect(entrance.waiting).toEqual([]);
    });

    it("with a crowd about the spot, a pet looks for room farther off the longer it has waited", async () => {
        const owner = await join("an-owner");
        const entrance = PetEntranceUtil.create(getRoom(), harness.getPlayerObject(owner.user.id)!.transform,
            ["petAAAA1"], Date.now());
        // A ring of pets about the owner, close enough that no pet fits between any two of them.
        const feet = PetBodyUtil.getFeet(entrance.spot.pos);
        let crowd = 0;
        for (const dx of [-1, 0, 1])
        {
            for (const dz of [-1, 0, 1])
            {
                const body = petSignal(ADMIN, `petBBBB${++crowd}`, identity("Rex", {}, 1),
                    {x: feet.x + dx, y: feet.y, z: feet.z + dz}, SERVER_PET_TYPE_INDEX);
                expect(dx == 0 && dz == 0 || ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, body)).toBe(true);
            }
        }
        const start = Date.now();
        expect(PetEntranceUtil.takeNext(getRoom(), entrance, start + PET_ENTRANCE_PATIENCE_MS)).toBeUndefined();
        const next = PetEntranceUtil.takeNext(getRoom(), entrance, start + 2 * PET_ENTRANCE_PATIENCE_MS);
        expect(next?.petId).toBe("petAAAA1");
        expect(PetEntranceUtil.isFree(getRoom(), next!.pos)).toBe(true);
        expect(next!.pos.y).toBe(entrance.spot.pos.y);
    });

    it("the spot is in front of the door its owner came in by, wherever along the walk out of it they are found, and pets set out from behind it", async () => {
        await join("a-stranger", STRANGER_SPOT);
        const door = getObjects(ObjectTypeConfigMap.getIndexByType("Door"))[0];
        const behind = DoorEntranceUtil.getArrivalTransform(getRoom(), door);
        const end = DoorEntranceUtil.getWalk(getRoom(), behind.pos)!.to;
        expect(Math.hypot(end.x - behind.pos.x, end.z - behind.pos.z)).toBeGreaterThan(0.5);
        const standAt = (playerPos: Vec3) => PetBodyUtil.getStandingPos({x: playerPos.x, y: behind.pos.y - STANDING_Y, z: playerPos.z});
        const near = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-9;
        // Behind the door still, half-way out of it, or at the end of the walk, pushed a little aside.
        for (const [share, aside] of [[0, 0], [0.5, 0], [1, 0.2]])
        {
            const along = {x: end.x - behind.pos.x, z: end.z - behind.pos.z};
            const at = {x: behind.pos.x + along.x * share + along.z * aside, y: behind.pos.y,
                z: behind.pos.z + along.z * share - along.x * aside};
            const found = PetEntranceUtil.create(getRoom(), new ObjectTransform(at, behind.dir, {...UNIT_VEC3}), [], Date.now());
            expect(near(found.spot.pos, standAt(end))).toBe(true);
            expect(near(found.from!, standAt(behind.pos))).toBe(true);
        }
        // Anyone put down anywhere else has their pets come in right there, from nowhere.
        const elsewhere = PetEntranceUtil.create(getRoom(), new ObjectTransform({...OWNER_SPOT}, behind.dir, {...UNIT_VEC3}), [],
            Date.now());
        expect(elsewhere.spot.pos).toEqual(PetBodyUtil.getStandingPos({...OWNER_SPOT, y: 0}));
        expect(elsewhere.from).toBeUndefined();
        expect(PetEntranceUtil.isFree(getRoom(), standAt(end))).toBe(true);
    });

    it("a pet comes in on the spot at once, once nobody stands there", async () => {
        const owner = await join("an-owner");
        const arrival = {...harness.getPlayerObject(owner.user.id)!.transform};
        const entrance = PetEntranceUtil.create(getRoom(), new ObjectTransform({...arrival.pos}, {...arrival.dir}, {...UNIT_VEC3}),
            ["petAAAA1"], Date.now());
        moveTo(owner, STRANGER_SPOT);
        expect(PetEntranceUtil.takeNext(getRoom(), entrance, Date.now()))
            .toEqual({petId: "petAAAA1", pos: entrance.spot.pos, way: []});
    });

    it("a pet whose owner came in by a door is put behind it, to walk straight out of it, and on to wherever it is bound", async () => {
        await harness.loadRoom(HUB_ID);
        const door = getObjects(ObjectTypeConfigMap.getIndexByType("Door"))[0];
        const behind = DoorEntranceUtil.getArrivalTransform(getRoom(), door);
        const entrance = PetEntranceUtil.create(getRoom(), behind, ["petAAAA1", "petAAAA2"], Date.now());
        const spot = entrance.spot.pos;
        // Not while its owner is still behind the door, where it would set out inside them: unless they stay there.
        const owner = await join("an-owner", behind.pos);
        expect(PetEntranceUtil.takeNext(getRoom(), entrance, Date.now() + PET_ENTRANCE_PATIENCE_MS - 1)).toBeUndefined();
        const impatient = PetEntranceUtil.create(getRoom(), behind, ["petAAAA9"], Date.now());
        expect(PetEntranceUtil.takeNext(getRoom(), impatient, Date.now() + PET_ENTRANCE_PATIENCE_MS)?.way)
            .toEqual([PetBodyUtil.getFeet(spot)]);
        moveTo(owner, STRANGER_SPOT);
        expect(PetEntranceUtil.takeNext(getRoom(), entrance, Date.now()))
            .toEqual({petId: "petAAAA1", pos: entrance.from, way: [PetBodyUtil.getFeet(spot)]});

        // With someone standing on the spot for too long, the next goes out by the spot all the same, and then aside.
        const body = petSignal(ADMIN, "petBBBB1", identity("Rex", {}, 1), PetBodyUtil.getFeet(spot), SERVER_PET_TYPE_INDEX);
        expect(ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, body)).toBe(true);
        expect(PetEntranceUtil.takeNext(getRoom(), entrance, Date.now())).toBeUndefined();
        const next = PetEntranceUtil.takeNext(getRoom(), entrance, Date.now() + PET_ENTRANCE_PATIENCE_MS)!;
        expect(next.pos).toEqual(entrance.from);
        expect(next.way).toHaveLength(2);
        expect(next.way[0]).toEqual(PetBodyUtil.getFeet(spot));
        expect(PetEntranceUtil.isFree(getRoom(), PetBodyUtil.getStandingPos(next.way[1]))).toBe(true);
    });

    it("on its way in a pet does nothing else, with or without a charge, and then looks about it as one just come", async () => {
        await harness.loadRoom(HUB_ID);
        const spot = {x: PET_FLOOR.x, y: 0, z: PET_FLOOR.z - 1};
        for (const energy of [1, 0])
        {
            // It faces north, the way it is to go; and is far gone in a fright, which would have it run about.
            const b = behave(identity("Rex"), {energy, horror: 1});
            PetBehaviorUtil.enter(b, [spot], Date.now());
            let seconds = 0;
            for (; seconds < 10 && b.enteringUntil > 0; seconds += 0.05)
            {
                const velocity = PetBehaviorUtil.steer(b, 0.05);
                // Straight there, without a turn or a stop.
                if (b.path.length > 0)
                    expect(velocity.z).toBeLessThan(0);
                b.at = {x: b.at.x + velocity.x * 0.05, y: b.at.y, z: b.at.z + velocity.z * 0.05};
                live(b, 0.05, 0.05);
                if (b.enteringUntil > 0)
                    expect(b.action).toBe(A.Idle);
            }
            expect(seconds).toBeLessThan(2);
            expect(Math.hypot(b.at.x - spot.x, b.at.z - spot.z)).toBeLessThan(0.2);
            // In, it takes fright as it would have, if it has the charge for it.
            expect(b.action).toBe((energy > 0) ? A.Panic : A.Idle);
        }

        // One that can't get there is left where it is before long, to do as it likes.
        const stuck = behave();
        PetBehaviorUtil.enter(stuck, [spot], Date.now());
        live(stuck, PET_ENTERING_TIMEOUT_MS / 1000 - 0.5);
        expect(stuck.enteringUntil).toBeGreaterThan(0);
        live(stuck, 1);
        expect(stuck.enteringUntil).toBe(0);
        // None is given for a pet put down where it is bound.
        const put = behave();
        PetBehaviorUtil.enter(put, [], Date.now());
        expect(put.enteringUntil).toBe(0);
    });
});

describe("owning a pet", () => {
    it(`is bought for $${PET_PRICE_DOLLARS} as it is generated: listed on its user's player, and written to their row with what it cost`, async () => {
        const user = await join("someone", OWNER_SPOT, {}, PET_PRICE_DOLLARS + 4);
        const other = await join("another", STRANGER_SPOT);
        forget(other);

        expect(add(user, petSignal(user.user, "petAAAA1", identity("Rex", {bravery: TOP_LEVEL})))).toBe(true);
        expect(getRoom().objectById["petAAAA1"]).toBeDefined();
        expect(dollarsOf(user)).toBe(4);
        expect(recordsOf(user).map(record => record.petId)).toEqual(["petAAAA1"]);
        expect(recordsOf(user)[0].identity).toEqual(identity("Rex", {bravery: TOP_LEVEL}));
        expect(recordsOf(user)[0].needs).toEqual(PetNeedsUtil.getFresh());
        // The room sees the pet, and whose it is.
        expect(getPendingSignals(other, "addObjectSignal").map((signal: AddObjectSignal) => signal.objectId)).toEqual(["petAAAA1"]);
        expect(getPendingSignals(other, "setObjectMetadataSignal").some((signal: SetObjectMetadataSignal) =>
            signal.metadataKey == PETS_KEY)).toBe(true);

        // The pet and its price reach the row as one write.
        await DBUserWriteQueueUtil.settle(user.user.id);
        expect(vi.mocked(DBPetUtil.savePets)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(DBPetUtil.savePets)).toHaveBeenCalledWith(user.user.id,
            harness.getPlayerMetadata(user.user.id)![PETS_KEY], -PET_PRICE_DOLLARS);
        expect(storedRecordsOf(user.user.id).map(record => record.petId)).toEqual(["petAAAA1"]);
    });

    it("is refused whoever has too few dollars, gives it no name, is not its owner, or has as many as anyone may", async () => {
        const user = await join("someone", OWNER_SPOT, {}, PET_PRICE_DOLLARS - 1);
        expect(add(user, petSignal(user.user, "petAAAA1"))).toBe(false);
        expect(recordsOf(user)).toEqual([]);
        expect(dollarsOf(user)).toBe(PET_PRICE_DOLLARS - 1);

        user.socketUserContext.inventory[DOLLAR] = 100 * PET_PRICE_DOLLARS;
        expect(add(user, petSignal(user.user, "petAAAA1", identity("")))).toBe(false);
        expect(add(user, petSignal(new User("another", "another", UserTypeEnumMap.Member, "", ""), "petAAAA1"))).toBe(false);
        // A pet that follows its user has no health of its own to keep, and an id as a record takes.
        expect(add(user, petSignal(user.user, "petAAAA1", identity("Rex", {}, 1)))).toBe(false);
        expect(add(user, petSignal(user.user, "not-a-pet-id"))).toBe(false);
        // In mid-air, or inside a block.
        expect(add(user, petSignal(user.user, "petAAAA1", identity(), {x: PET_FLOOR.x, y: 30, z: PET_FLOOR.z}))).toBe(false);
        expect(dollarsOf(user)).toBe(100 * PET_PRICE_DOLLARS);

        // In rows of eight, well apart.
        for (let i = 0; i < MAX_PETS_PER_USER; ++i)
        {
            expect(add(user, petSignal(user.user, `petAAA${String(i).padStart(2, "0")}`, identity(),
                {x: 8.5 + 1.5 * (i % 8), y: 0, z: 22.5 + 1.5 * Math.floor(i / 8)}))).toBe(true);
        }
        expect(add(user, petSignal(user.user, "petAAAAz", identity(), {x: 8.5, y: 0, z: 27.5}))).toBe(false);
        expect(recordsOf(user)).toHaveLength(MAX_PETS_PER_USER);
        expect(dollarsOf(user)).toBe((100 - MAX_PETS_PER_USER) * PET_PRICE_DOLLARS);
    });

    it("leaves with its user and comes in after them for nothing, as who their record says it is", async () => {
        const user = await join("someone", OWNER_SPOT, {}, PET_PRICE_DOLLARS);
        expect(add(user, petSignal(user.user, "petAAAA1"))).toBe(true);
        await DBUserWriteQueueUtil.settle(user.user.id);
        await harness.disconnectUser(user);
        expect(getRoom().objectById["petAAAA1"]).toBeUndefined();
        expect(storedRecordsOf(user.user.id).map(record => record.petId)).toEqual(["petAAAA1"]);

        const back = harness.reconnectUser(user);
        await harness.joinRoom(back, HUB_ID);
        moveTo(back, OWNER_SPOT);
        expect(recordsOf(back).map(record => record.petId)).toEqual(["petAAAA1"]);
        back.socketUserContext.inventory[DOLLAR] = 0;
        // Under another name it is nobody's pet.
        expect(add(back, petSignal(back.user, "petAAAA1", identity("Max")))).toBe(false);
        expect(add(back, petSignal(back.user, "petAAAA1"))).toBe(true);
        expect(dollarsOf(back)).toBe(0);
        expect(recordsOf(back)).toHaveLength(1);
    });

    it("is told how it is by its user's reports, which add and remove no pet, and by nothing else its user sets", async () => {
        const user = await join("someone", OWNER_SPOT, {}, PET_PRICE_DOLLARS);
        expect(add(user, petSignal(user.user, "petAAAA1"))).toBe(true);
        expect(report(user, {petAAAA1: {...PetNeedsUtil.getFresh(), health: 0.4, energy: 0.6},
            petZZZZ9: PetNeedsUtil.getFresh()})).toBe(true);
        expect(recordsOf(user).map(record => record.petId)).toEqual(["petAAAA1"]);
        expect(Math.abs(recordsOf(user)[0].needs.health - 0.4)).toBeLessThan(FINE_STEP);
        expect(Math.abs(recordsOf(user)[0].needs.energy - 0.6)).toBeLessThan(FINE_STEP);

        // A whole record of their own making is refused: pets for nothing.
        const forged = PetRecordUtil.encode([{petId: "petZZZZ9", identity: identity("Free"), needs: PetNeedsUtil.getFresh()}]);
        const player = harness.getPlayerObject(user.user.id)!;
        expect(ObjectUpdateUtil.canSetObjectMetadata(user.user, getRoom(),
            new SetObjectMetadataSignal(HUB_ID, player.objectId, PETS_KEY, forged))).toBe(false);
        expect(recordsOf(user).map(record => record.petId)).toEqual(["petAAAA1"]);
    });

    it("is sold by its owner taking it away, for what it is worth in the health it is in, and by nobody else", async () => {
        const user = await join("someone", OWNER_SPOT, {}, 2 * PET_PRICE_DOLLARS);
        const other = await join("another", STRANGER_SPOT, {userType: UserTypeEnumMap.Admin});
        expect(add(user, petSignal(user.user, "petAAAA1"))).toBe(true);
        expect(add(user, petSignal(user.user, "petAAAA2", identity("Max"), OTHER_PET_FLOOR))).toBe(true);
        expect(remove(other, "petAAAA1")).toBe(false);
        expect(getRoom().objectById["petAAAA1"]).toBeDefined();

        // In full health, for all it cost.
        expect(remove(user, "petAAAA1")).toBe(true);
        expect(dollarsOf(user)).toBe(PET_PRICE_DOLLARS);
        expect(recordsOf(user).map(record => record.petId)).toEqual(["petAAAA2"]);
        // In poor health, for a third of it.
        expect(report(user, {petAAAA2: {...PetNeedsUtil.getFresh(), health: 0.2}})).toBe(true);
        expect(remove(user, "petAAAA2")).toBe(true);
        expect(dollarsOf(user)).toBe(PET_PRICE_DOLLARS + PetSaleUtil.getPrice(0.2));
        expect(recordsOf(user)).toEqual([]);

        await DBUserWriteQueueUtil.settle(user.user.id);
        expect(vi.mocked(DBPetUtil.savePets)).toHaveBeenLastCalledWith(user.user.id, "", PetSaleUtil.getPrice(0.2));
        expect(storedRecordsOf(user.user.id)).toEqual([]);
    });

    it("dies once its user's report has it out of health: gone, unlisted, and left as scrap only its owner or an admin removes", async () => {
        const user = await join("someone", OWNER_SPOT, {}, PET_PRICE_DOLLARS);
        const stranger = await join("a-stranger", STRANGER_SPOT);
        const admin = await join("an-admin", {x: 24.5, y: STANDING_Y, z: 12.5}, {userType: UserTypeEnumMap.Admin});
        expect(add(user, petSignal(user.user, "petAAAA1", identity("Rex")))).toBe(true);
        expect(report(user, {petAAAA1: {...PetNeedsUtil.getFresh(), health: 0}})).toBe(true);

        expect(getRoom().objectById["petAAAA1"]).toBeUndefined();
        expect(recordsOf(user)).toEqual([]);
        expect(dollarsOf(user)).toBe(0);
        const scraps = getObjects(SCRAP_TYPE_INDEX);
        expect(scraps).toHaveLength(1);
        expect(PetIdentityUtil.getObjectIdentity(scraps[0]).name).toBe("Rex");
        expect(scraps[0].sourceUserID).toBe(user.user.id);
        expect(Math.hypot(scraps[0].transform.pos.x - PET_FLOOR.x, scraps[0].transform.pos.z - PET_FLOOR.z)).toBeLessThan(1);

        expect(remove(stranger, scraps[0].objectId)).toBe(false);
        expect(remove(admin, scraps[0].objectId)).toBe(true);
        expect(getObjects(SCRAP_TYPE_INDEX)).toEqual([]);
        expect(dollarsOf(admin)).toBe(0);

        await DBUserWriteQueueUtil.settle(user.user.id);
        expect(storedRecordsOf(user.user.id)).toEqual([]);
    });

    it("is its owner's to take away once it is scrap", async () => {
        const user = await join("someone", OWNER_SPOT, {}, PET_PRICE_DOLLARS);
        expect(add(user, petSignal(user.user, "petAAAA1"))).toBe(true);
        expect(report(user, {petAAAA1: {...PetNeedsUtil.getFresh(), health: 0}})).toBe(true);
        const [scrap] = getObjects(SCRAP_TYPE_INDEX);
        expect(remove(user, scrap.objectId)).toBe(true);
        expect(dollarsOf(user)).toBe(0);
    });
});

describe("what is put into a pet", () => {
    function inject(user: ConnectedUser, petId: string, injection: number): boolean
    {
        return PetServerUtil.onInjectPetSignalReceived(user.socketUserContext, new InjectPetSignal(HUB_ID, petId, injection));
    }

    it(`is a battery for $${PET_BATTERY_PRICE_DOLLARS} or a wrench for $${PET_WRENCH_PRICE_DOLLARS}, from anyone in the room, which the room is told of`, async () => {
        const owner = await join("an-owner", OWNER_SPOT, {}, PET_PRICE_DOLLARS);
        const stranger = await join("a-stranger", STRANGER_SPOT, {}, PET_BATTERY_PRICE_DOLLARS + PET_WRENCH_PRICE_DOLLARS + 1);
        expect(add(owner, petSignal(owner.user, "petAAAA1"))).toBe(true);
        show("petAAAA1", {batteryLevel: 0, powerless: true, rust: PET_RUST_LEVELS - 1});
        forget(owner);
        forget(stranger);

        expect(inject(stranger, "petAAAA1", PetInjectionEnumMap.Battery)).toBe(true);
        expect(dollarsOf(stranger)).toBe(PET_WRENCH_PRICE_DOLLARS + 1);
        expect(shownOf("petAAAA1").batteryLevel).toBe(PET_BATTERY_LEVELS);
        expect(shownOf("petAAAA1").powerless).toBe(false);
        // Full, it takes no second one, and nothing is paid for it.
        expect(inject(stranger, "petAAAA1", PetInjectionEnumMap.Battery)).toBe(false);
        expect(dollarsOf(stranger)).toBe(PET_WRENCH_PRICE_DOLLARS + 1);

        expect(inject(stranger, "petAAAA1", PetInjectionEnumMap.Wrench)).toBe(true);
        expect(dollarsOf(stranger)).toBe(1);
        expect(shownOf("petAAAA1").rust).toBeLessThan(PET_RUST_LEVELS - 1);
        // Out of dollars for another, though it would still help.
        expect(PetInjectionUtil.canInject(getRoom().objectById["petAAAA1"], PetInjectionEnumMap.Wrench)).toBe(true);
        expect(inject(stranger, "petAAAA1", PetInjectionEnumMap.Wrench)).toBe(false);

        // Everyone hears of each, whoever plays the pet and whoever paid included.
        for (const listener of [owner, stranger])
        {
            expect(getPendingSignals(listener, "injectPetSignal").map((signal: InjectPetSignal) => signal.injection))
                .toEqual([PetInjectionEnumMap.Battery, PetInjectionEnumMap.Wrench]);
        }
    });

    it("is refused for no pet, for one in another state than it would help, and for anything but the two", async () => {
        const user = await join("someone", OWNER_SPOT, {}, 10 * PET_PRICE_DOLLARS);
        expect(add(user, petSignal(user.user, "petAAAA1"))).toBe(true);
        const before = dollarsOf(user);
        expect(inject(user, "no-such-pet", PetInjectionEnumMap.Battery)).toBe(false);
        expect(inject(user, harness.getPlayerObject(user.user.id)!.objectId, PetInjectionEnumMap.Battery)).toBe(false);
        expect(inject(user, "petAAAA1", PetInjectionEnumMap.Battery)).toBe(false);
        expect(inject(user, "petAAAA1", PetInjectionEnumMap.Wrench)).toBe(false);
        show("petAAAA1", {batteryLevel: 0});
        expect(inject(user, "petAAAA1", 7)).toBe(false);
        expect(dollarsOf(user)).toBe(before);
    });
});

describe("an admin's pets, which stay with the room", () => {
    it("are generated with a health of their own, by an admin alone, for the same price, and sold by it for what that health is worth", async () => {
        const admin = await join("an-admin", OWNER_SPOT, {userType: UserTypeEnumMap.Admin}, 3 * PET_PRICE_DOLLARS);
        const member = await join("a-member", STRANGER_SPOT, {}, 3 * PET_PRICE_DOLLARS);
        const roomPet = (owner: User, petId: string, level: number, floor: Vec3 = PET_FLOOR, energyLevel: number = 1) =>
            petSignal(owner, petId, identity("Rex", {}, level, energyLevel), floor, SERVER_PET_TYPE_INDEX);

        expect(add(member, roomPet(member.user, "petAAAA1", 1))).toBe(false);
        // An admin's are the room's, each with a health and a charge to keep, and never the kind that follows its user.
        expect(add(admin, petSignal(admin.user, "petAAAA1"))).toBe(false);
        expect(add(admin, roomPet(admin.user, "petAAAA1", 0))).toBe(false);
        expect(add(admin, roomPet(admin.user, "petAAAA1", 1, PET_FLOOR, 0))).toBe(false);
        expect(add(admin, roomPet(admin.user, "petAAAA1", 1))).toBe(true);
        expect(add(admin, roomPet(admin.user, "petAAAA2", PET_FIXED_HEALTHS.length, OTHER_PET_FLOOR,
            PET_FIXED_ENERGIES.length))).toBe(true);
        expect(dollarsOf(admin)).toBe(PET_PRICE_DOLLARS);
        expect(recordsOf(admin)).toEqual([]);
        expect(ServerPetObjectTypeConfig.persistent).toBe(true);
        expect(PetObjectTypeConfig.persistent).toBe(false);

        // The server plays them: each shows itself in the health and the charge it is kept at, and takes nothing.
        for (let i = 0; i < 10; ++i)
            flush();
        expect(PetPlayUtil.getNeeds(getRoom(), "petAAAA1")?.health).toBe(PET_FIXED_HEALTHS[0]);
        expect(PetPlayUtil.getNeeds(getRoom(), "petAAAA2")?.health).toBe(1);
        expect(PetPlayUtil.getNeeds(getRoom(), "petAAAA1")?.energy).toBe(PET_FIXED_ENERGIES[0]);
        expect(PetPlayUtil.getNeeds(getRoom(), "petAAAA2")?.energy).toBe(1);
        expect(shownOf("petAAAA1").rust).toBe(PetShownStateUtil.getRust(PET_FIXED_HEALTHS[0]));
        expect(shownOf("petAAAA1").batteryLevel).toBe(1);
        expect(shownOf("petAAAA2").rust).toBe(0);
        for (const injection of [PetInjectionEnumMap.Battery, PetInjectionEnumMap.Wrench])
            expect(PetInjectionUtil.canInject(getRoom().objectById["petAAAA1"], injection)).toBe(false);

        expect(remove(member, "petAAAA1")).toBe(false);
        expect(remove(admin, "petAAAA1")).toBe(true);
        expect(dollarsOf(admin)).toBe(PET_PRICE_DOLLARS + PetSaleUtil.getPrice(PET_FIXED_HEALTHS[0]));
    });

    it("stay where they are when whoever generated them leaves", async () => {
        const admin = await join("an-admin", OWNER_SPOT, {userType: UserTypeEnumMap.Admin}, PET_PRICE_DOLLARS);
        await join("a-member", STRANGER_SPOT);
        expect(add(admin, petSignal(admin.user, "petAAAA1", identity("Rex", {}, 2), PET_FLOOR, SERVER_PET_TYPE_INDEX))).toBe(true);
        await harness.disconnectUser(admin);
        expect(getRoom().objectById["petAAAA1"]).toBeDefined();
        for (let i = 0; i < 10; ++i)
            flush();
        expect(PetPlayUtil.getNeeds(getRoom(), "petAAAA1")?.health).toBe(PET_FIXED_HEALTHS[1]);
    });
});

describe("a cannon near a pet", () => {
    it("turns after nobody with only a pet there, and after whoever comes", async () => {
        // A ghost keeps the room played, and is nobody to a cannon.
        await join("a-ghost", {x: 30.5, y: STANDING_Y, z: 30.5}, {userType: UserTypeEnumMap.Admin,
            playerMetadata: {[ObjectMetadataKeyEnumMap.AdminPrefs]: AdminPrefsUtil.encode({ghostMode: true})}});
        const fresh = CannonStateUtil.decode("");
        ServerObjectManager.addObjectAsServer(getRoom(), ADMIN, new AddObjectSignal(HUB_ID, ADMIN.id, ADMIN.userName,
            CANNON_TYPE_INDEX, "a-cannon", new ObjectTransform({x: 10.5, y: 0, z: 16.5}, {x: 0, y: 1, z: 0}, {...UNIT_VEC3}),
            {[ObjectMetadataKeyEnumMap.CannonState]: new EncodableByteString(
                CannonStateUtil.encode({...fresh, phase: CannonPhaseEnumMap.Waiting, timeLeft: 0}))}));
        ServerObjectManager.addObjectAsServer(getRoom(), ADMIN,
            petSignal(ADMIN, "petAAAA1", identity("Rex", {}, 3), {x: 15.5, y: 0, z: 16.5}, SERVER_PET_TYPE_INDEX));
        const cannon = getRoom().objectById["a-cannon"];
        for (let i = 0; i < 100; ++i)
            flush();
        expect(CannonAimUtil.getAngleBetween(CannonStateUtil.getObjectState(cannon).aim, fresh.aim)).toBeLessThan(AIM_STEP);
        expect(CannonStateUtil.getObjectState(cannon).ballsLeft).toBe(fresh.ballsLeft);

        await join("someone", {x: 10.5, y: STANDING_Y, z: 23.5});
        for (let i = 0; i < 10; ++i)
            flush();
        expect(CannonAimUtil.getAngleBetween(CannonStateUtil.getObjectState(cannon).aim, fresh.aim)).toBeGreaterThan(AIM_STEP);
    });
});

describe("a user's record, whatever happens to their connection", () => {
    const stored = PetRecordUtil.encode([
        {petId: "petAAAA1", identity: identity("Rex"), needs: {...PetNeedsUtil.getFresh(), health: 0.75}},
        {petId: "petAAAA2", identity: identity("Max"), needs: PetNeedsUtil.getFresh()},
    ]);

    it("comes back with them, whichever of their old connection's end and their new one's start comes first", async () => {
        for (const reconnect of [harness.reconnectCaseA, harness.reconnectCaseB])
        {
            const user = await join("someone", OWNER_SPOT, {playerMetadata: {[PETS_KEY]: stored}});
            expect(recordsOf(user).map(record => record.petId)).toEqual(["petAAAA1", "petAAAA2"]);
            const back = await reconnect(user);
            await harness.joinRoom(back, HUB_ID);
            expect(recordsOf(back).map(record => record.petId)).toEqual(["petAAAA1", "petAAAA2"]);
            expect(storedRecordsOf("someone").map(record => record.petId)).toEqual(["petAAAA1", "petAAAA2"]);
            await harness.disconnectUser(back);
            harness.reset();
            harness.seedHub(HUB_ID);
        }
    });

    it("is not written over by a player that arrived without it, their row having failed to be read, who can generate no pet", async () => {
        const user = harness.connectUser({id: "someone", userName: "someone", playerMetadata: {[PETS_KEY]: stored}});
        vi.mocked(DBUserUtil.lookUpUserById).mockResolvedValue({success: false, data: []} as any);
        await harness.joinRoom(user, HUB_ID);
        vi.mocked(DBUserUtil.lookUpUserById).mockRestore();
        moveTo(user, OWNER_SPOT);

        // They are in, with no pets to show, and nothing they hold is taken for all they have.
        expect(harness.getPlayerObject("someone")).toBeDefined();
        expect(recordsOf(user)).toEqual([]);
        expect(ServerUserManager.hasReadPlayerMetadata("someone")).toBe(false);
        expect(harness.getPlayerMetadata("someone")).toBeUndefined();
        user.socketUserContext.inventory[DOLLAR] = PET_PRICE_DOLLARS;
        expect(add(user, petSignal(user.user, "petAAAA9"))).toBe(false);
        expect(dollarsOf(user)).toBe(PET_PRICE_DOLLARS);

        const savesBefore = harness.savedPlayerMetadataRecords.length;
        await harness.disconnectUser(user);
        expect(harness.savedPlayerMetadataRecords.length).toBe(savesBefore);
        expect(harness.hasRecentDisconnectMetadata("someone")).toBe(false);
        expect(vi.mocked(DBPetUtil.savePets)).not.toHaveBeenCalled();
        expect(storedRecordsOf("someone").map(record => record.petId)).toEqual(["petAAAA1", "petAAAA2"]);

        // The next time the row is read, they have them again.
        const back = harness.reconnectUser(user);
        await harness.joinRoom(back, HUB_ID);
        expect(recordsOf(back).map(record => record.petId)).toEqual(["petAAAA1", "petAAAA2"]);
    });

    it("reaches their row in the order things happened, however long each write takes", async () => {
        const user = await join("someone", OWNER_SPOT, {}, 3 * PET_PRICE_DOLLARS);
        harness.setLatency(true, 0, 8);
        expect(add(user, petSignal(user.user, "petAAAA1"))).toBe(true);
        expect(add(user, petSignal(user.user, "petAAAA2", identity("Max"), OTHER_PET_FLOOR))).toBe(true);
        expect(remove(user, "petAAAA1")).toBe(true);
        expect(report(user, {petAAAA2: {...PetNeedsUtil.getFresh(), health: 0.5}})).toBe(true);
        await harness.disconnectUser(user);
        await DBUserWriteQueueUtil.drain();
        harness.setLatency(false);

        const kept = storedRecordsOf("someone");
        expect(kept.map(record => record.petId)).toEqual(["petAAAA2"]);
        expect(Math.abs(kept[0].needs.health - 0.5)).toBeLessThan(FINE_STEP);
        expect(vi.mocked(DBPetUtil.savePets).mock.calls.map(call => call[2]))
            .toEqual([-PET_PRICE_DOLLARS, -PET_PRICE_DOLLARS, PET_PRICE_DOLLARS]);
    });

    it("is kept by a shutdown, for everyone still in a room", async () => {
        const user = await join("someone", OWNER_SPOT, {}, PET_PRICE_DOLLARS);
        expect(add(user, petSignal(user.user, "petAAAA1"))).toBe(true);
        expect(report(user, {petAAAA1: {...PetNeedsUtil.getFresh(), energy: 0.3}})).toBe(true);
        await harness.gracefulShutdown();
        const kept = storedRecordsOf("someone");
        expect(kept.map(record => record.petId)).toEqual(["petAAAA1"]);
        expect(Math.abs(kept[0].needs.energy - 0.3)).toBeLessThan(FINE_STEP);
    });
});

describe("a fan blowing up under a pet", () => {
    // In open floor, and a pet's middle standing on it.
    const FAN_SPOT: Vec3 = {x: 14.5, y: 0, z: 16.5};
    const STANDING_MIDDLE_Y = PetBodyUtil.getStandingPos(FAN_SPOT).y;
    // By when a pet the wind has caught stands out of it again.
    const ESCAPE_SECONDS = 5;

    it("throws a pet up, which steps out of its wind of its own accord, whatever its nature and the fan's strength", async () => {
        for (const setting of FAN_SETTINGS)
        {
            for (let bravery = 0; bravery < PET_TRAIT_LEVELS; ++bravery)
            {
                const label = `strength ${setting.strength}, bravery ${bravery}`;
                harness.reset();
                harness.seedHub(HUB_ID);
                // A ghost keeps the room played, and is nobody to a pet.
                await join("a-ghost", {x: 30.5, y: STANDING_Y, z: 30.5}, {userType: UserTypeEnumMap.Admin,
                    playerMetadata: {[ObjectMetadataKeyEnumMap.AdminPrefs]: AdminPrefsUtil.encode({ghostMode: true})}});
                addFloorFan(FAN_SPOT, setting);
                ServerObjectManager.addObjectAsServer(getRoom(), ADMIN,
                    petSignal(ADMIN, "petAAAA1", identity("Rex", {bravery}, 3), FAN_SPOT, SERVER_PET_TYPE_INDEX));
                const pet = getRoom().objectById["petAAAA1"];

                let highest = 0;
                let outAt: number | undefined = undefined;
                const actions = new Set<number>();
                for (let i = 1; i <= ESCAPE_SECONDS / FLUSH_SECONDS && outAt == undefined; ++i)
                {
                    flush();
                    highest = Math.max(highest, pet.transform.pos.y);
                    actions.add(PetShownStateUtil.getObjectState(pet).action);
                    if (!isLiftedAt(pet.transform.pos) && Math.abs(pet.transform.pos.y - STANDING_MIDDLE_Y) < 0.01)
                        outAt = i * FLUSH_SECONDS;
                }
                expect(highest, label).toBeGreaterThan(STANDING_MIDDLE_Y + 2 * COLLISION_LAYER_HEIGHT);
                expect(outAt, label).toBeDefined();
                // The bravest takes no fright at being thrown about: it gets out all the same.
                if (bravery == TOP_LEVEL)
                    expect([...actions].some(action => action == A.Flee || action == A.Panic), label).toBe(false);
            }
        }
    });
});
