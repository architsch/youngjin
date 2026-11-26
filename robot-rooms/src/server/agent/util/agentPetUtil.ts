import { InventoryItemTypeEnumMap } from "../../../shared/inventory/types/inventoryItemType";
import Vec3 from "../../../shared/math/types/vec3";
import ColorUtil from "../../../shared/math/util/colorUtil";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import ObjectCategoryConfigMap from "../../../shared/object/maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import InjectPetSignal from "../../../shared/object/types/injectPetSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import PetObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/petObjectTypeConfig";
import ServerPetObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/serverPetObjectTypeConfig";
import { PetActionEnumMap } from "../../../shared/object/types/petAction";
import { PetInjection, PetInjectionEnumMap } from "../../../shared/object/types/petInjection";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import MessageLinkUtil from "../../../shared/object/util/messageLinkUtil";
import NpcFacingUtil from "../../../shared/object/util/npcFacingUtil";
import ObjectIdUtil from "../../../shared/object/util/objectIdUtil";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import PetBodyUtil from "../../../shared/object/util/petBodyUtil";
import PetIdentityUtil, { PET_COLOR_PALETTE_NAME, PET_NAME_MAX_LENGTH,
    PET_TRAIT_LEVELS } from "../../../shared/object/util/petIdentityUtil";
import PetInjectionUtil from "../../../shared/object/util/petInjectionUtil";
import PetNeedsUtil from "../../../shared/object/util/petNeedsUtil";
import PetOwnerUtil from "../../../shared/object/util/petOwnerUtil";
import { MAX_PETS_PER_USER } from "../../../shared/object/util/petRecordUtil";
import PetSaleUtil from "../../../shared/object/util/petSaleUtil";
import PetShownStateUtil, { PET_BATTERY_LEVELS, PET_RUST_LEVELS } from "../../../shared/object/util/petShownStateUtil";
import PetZodiacUtil from "../../../shared/object/util/petZodiacUtil";
import Room from "../../../shared/room/types/room";
import { PET_PRICE_DOLLARS, UNIT_VEC3, VOXEL_CELL_SIZE } from "../../../shared/system/sharedConstants";
import User from "../../../shared/user/types/user";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import PetPlayUtil from "../../object/util/petPlayUtil";
import AgentFace from "../types/agentFace";
import AgentUserContext from "../types/agentUserContext";
import AgentBudgetUtil from "./agentBudgetUtil";
import AgentGridUtil from "./agentGridUtil";
import AgentRoomUtil from "./agentRoomUtil";
import AgentSignalUtil from "./agentSignalUtil";
import PetChatUtil from "./petChatUtil";

const NOT_IN_A_ROOM = "You aren't in a room.";
const NO_SUCH_PET = "No pet by that id is here (look lists the pets).";
const GET_DOLLARS_NOTE = "collect_bill gets you dollars, and coming back gives you some once a day.";

const PET_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(PetObjectTypeConfig.objectType);
const SERVER_PET_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(ServerPetObjectTypeConfig.objectType);
// How much of a trait a pet has, as agents name it, from the least.
const TRAIT_LEVELS = ["low", "medium", "high"].slice(0, PET_TRAIT_LEVELS);
const DEFAULT_TRAIT_LEVEL = "medium";
// What is put into a pet, as agents name it.
const INJECTIONS: {[item: string]: PetInjection} = {battery: PetInjectionEnumMap.Battery, wrench: PetInjectionEnumMap.Wrench};
const A = PetActionEnumMap;
// What a pet is doing, as look tells it.
const ACTION_WORDS: {[action: number]: string} = {
    [A.Idle]: "standing", [A.Wander]: "wandering", [A.SmallTalk]: "chatting with a pet", [A.ObjectRemark]: "looking at a thing",
    [A.EditRemark]: "remarking on what was built", [A.Attack]: "attacking a pet", [A.Panic]: "panicking",
    [A.Sleep]: "sleeping", [A.Come]: "coming to who called it", [A.Hug]: "hugging someone", [A.Flee]: "running away",
    [A.Dead]: "dead", [A.PersonRemark]: "talking to someone", [A.Chat]: "answering someone",
};

// An agent's pets, and the pets around it (see PetObjectTypeConfig): generating one, putting a battery or a wrench
// into any, and selling its own, each by the signal a browser sends for a person's, so that it passes the same
// checks. The server plays an agent's pets itself (see PetPlayUtil).
const AgentPetUtil =
{
    traitLevels: TRAIT_LEVELS,
    items: Object.keys(INJECTIONS),

    // The room's pets, nearest a point first.
    describePets: (room: Room, user: User, from: Vec3): object[] =>
    {
        return Object.values(room.objectById).filter(obj => PetOwnerUtil.isPet(obj))
            .map(pet => ({pet, distance: getDistance(from, pet.transform.pos)}))
            .sort((a, b) => a.distance - b.distance)
            .map(({pet, distance}) => ({...describePet(room, user, pet), distance}));
    },
    // A pet of the agent's own, standing on the up side of a block, bought as it is added.
    generate: async (ctx: AgentUserContext, request: {name: string, on: AgentFace, color?: string, dependence?: string,
        sociability?: string, aggressiveness?: string, bravery?: string, curiosity?: string}): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: NOT_IN_A_ROOM};
        const user = ctx.user;
        const name = PetIdentityUtil.sanitizeName(request.name);
        if (name.length == 0)
            return {error: `Give it a name, of up to ${PET_NAME_MAX_LENGTH} characters.`};
        if (request.color != undefined && !ColorUtil.isHex(request.color))
            return {error: `color is a color, given as "#rrggbb".`};
        const colorIndex = (request.color == undefined) ? 0
            : ColorUtil.rgbToPaletteIndex(PET_COLOR_PALETTE_NAME, ColorUtil.hexToRGB(request.color));
        if (getDollars(ctx) < PET_PRICE_DOLLARS)
            return {error: `A pet costs $${PET_PRICE_DOLLARS}, and you hold $${getDollars(ctx)}. ${GET_DOLLARS_NOTE}`};
        if (PetOwnerUtil.getRecords(room, user.id).length >= MAX_PETS_PER_USER)
            return {error: `You have as many pets as anyone may (${MAX_PETS_PER_USER}): sell_pet makes room for another.`};
        const category = ObjectTypeConfigMap.getConfigByIndex(PET_TYPE_INDEX).category;
        if (room.objectGroup.getCategoryCount(category) >= ObjectCategoryConfigMap.getMaxCountPerRoom(category))
            return {error: "This room already holds as many pets as it may."};
        const spent = AgentBudgetUtil.describeSpentEdits(user.id, 1);
        if (spent != undefined)
            return {error: spent};

        const quadIndex = AgentGridUtil.getFaceQuadIndex(request.on);
        if (request.on.side != "up" || quadIndex < 0 || !VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, quadIndex))
            return {error: "A pet stands on a floor: give the up side of a block that shows (look_blocks tells which do)."};
        const pos = PetBodyUtil.getStandingPos(AgentGridUtil.getFaceCenter(room.voxelGrid.voxels, quadIndex).center);
        // It looks at whoever generated it.
        const me = AgentRoomUtil.getMyPlayer(ctx);
        const toward = (me == undefined) ? {x: 0, y: 0, z: 1} : {x: me.transform.pos.x - pos.x, y: 0, z: me.transform.pos.z - pos.z};
        const facing = (Math.hypot(toward.x, toward.z) > 0.01) ? NpcFacingUtil.getDegrees(toward) : 0;

        const identity = PetIdentityUtil.encode({name, fixedHealthLevel: 0, fixedEnergyLevel: 0, colorIndex, traits: {
            dependence: getTraitLevel(request.dependence), sociability: getTraitLevel(request.sociability),
            aggressiveness: getTraitLevel(request.aggressiveness), bravery: getTraitLevel(request.bravery),
            curiosity: getTraitLevel(request.curiosity), zodiac: PetZodiacUtil.pick()}});
        const objectId = ObjectIdUtil.generateUniqueObjectId(room.objectById);
        const signal = new AddObjectSignal(room.id, user.id, user.userName, PET_TYPE_INDEX, objectId,
            new ObjectTransform(pos, PetBodyUtil.getDir(facing), {...UNIT_VEC3}),
            {[ObjectMetadataKeyEnumMap.PetIdentity]: new EncodableByteString(identity)});
        if (!ObjectUpdateUtil.canAddObject(user, room, signal))
            return {error: "A pet can't stand there: it needs a floor inside the room with nothing in the way over it."};

        await AgentSignalUtil.send(ctx, "addObjectSignal", signal);
        const pet = room.objectById[objectId];
        if (pet == undefined)
            return {error: "It couldn't be generated there."};
        ctx.inbox.notePet(pet);
        return {generated: describePet(room, user, pet), spent: PET_PRICE_DOLLARS, dollars: getDollars(ctx)};
    },
    // A battery or a wrench into any pet in the room, for what it costs.
    inject: async (ctx: AgentUserContext, petId: string, item: string): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: NOT_IN_A_ROOM};
        const pet = room.objectById[petId];
        const injection = INJECTIONS[item];
        if (pet == undefined || !PetOwnerUtil.isPet(pet))
            return {error: NO_SUCH_PET};
        if (injection == undefined)
            return {error: `Only a ${AgentPetUtil.items.join(" or a ")} goes into a pet.`};
        if (!PetInjectionUtil.canInject(pet, injection))
            return {error: describeNoUse(pet, injection)};
        const price = PetInjectionUtil.getPrice(injection);
        if (getDollars(ctx) < price)
            return {error: `A ${item} costs $${price}, and you hold $${getDollars(ctx)}. ${GET_DOLLARS_NOTE}`};
        const spent = AgentBudgetUtil.describeSpentEdits(ctx.user.id, 1);
        if (spent != undefined)
            return {error: spent};

        if (!await AgentSignalUtil.send(ctx, "injectPetSignal", new InjectPetSignal(room.id, petId, injection)))
            return {error: `The ${item} couldn't be put into it.`};
        return {given: item, pet: describePet(room, ctx.user, pet), spent: price, dollars: getDollars(ctx)};
    },
    // Removing one's own pet sells it (see PetServerUtil.sell).
    sell: async (ctx: AgentUserContext, petId: string): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: NOT_IN_A_ROOM};
        const pet = room.objectById[petId];
        if (pet == undefined || !PetOwnerUtil.isPet(pet))
            return {error: NO_SUCH_PET};
        const signal = new RemoveObjectSignal(room.id, petId);
        if (pet.sourceUserID != ctx.user.id || !ObjectUpdateUtil.canRemoveObject(ctx.user, room, signal))
            return {error: "Only a pet's owner sells it."};
        const spent = AgentBudgetUtil.describeSpentEdits(ctx.user.id, 1);
        if (spent != undefined)
            return {error: spent};

        const dollarsBefore = getDollars(ctx);
        await AgentSignalUtil.send(ctx, "removeObjectSignal", signal);
        if (room.objectById[petId] != undefined)
            return {error: "It couldn't be sold."};
        return {sold: petId, for: getDollars(ctx) - dollarsBefore, dollars: getDollars(ctx)};
    },
}

// Who it is and whose, its color, where it stands, what it is doing and saying (and whether it is thinking of an answer),
// and what it shows of how it is: the lit cells of its battery indicator, and its rust, as the shares of its health
// gone. Its owner is told what it would sell for.
function describePet(room: Room, user: User, pet: AddObjectSignal): object
{
    const shown = PetShownStateUtil.getObjectState(pet);
    const saying = pet.metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str ?? "";
    const mine = pet.sourceUserID == user.id;
    const identity = PetIdentityUtil.getObjectIdentity(pet);
    return {
        id: pet.objectId,
        name: identity.name,
        color: ColorUtil.rgbToHex(PetIdentityUtil.getBodyColor(identity)),
        owner: pet.sourceUserName,
        yours: mine ? true : undefined,
        staysWithRoom: (pet.objectTypeIndex == SERVER_PET_TYPE_INDEX) ? true : undefined,
        at: AgentGridUtil.toGridPosition(PetBodyUtil.getFeet(pet.transform.pos)),
        doing: ACTION_WORDS[shown.action],
        saying: (saying.length > 0) ? MessageLinkUtil.withControlsInWords(saying) : undefined,
        thinking: PetChatUtil.isThinking(room.id, pet.objectId) ? true : undefined,
        battery: `${shown.batteryLevel}/${PET_BATTERY_LEVELS}`,
        rust: `${shown.rust}/${PET_RUST_LEVELS}`,
        takesBattery: PetInjectionUtil.canInject(pet, PetInjectionEnumMap.Battery),
        takesWrench: PetInjectionUtil.canInject(pet, PetInjectionEnumMap.Wrench),
        sellsFor: mine ? getSalePrice(room, user, pet) : undefined,
    };
}

// What its owner would be paid for it now (see PetServerUtil.sell).
function getSalePrice(room: Room, user: User, pet: AddObjectSignal): number
{
    const needs = PetPlayUtil.getNeeds(room, pet.objectId)
        ?? ((pet.objectTypeIndex == SERVER_PET_TYPE_INDEX)
            ? PetNeedsUtil.decode(pet.metadata[ObjectMetadataKeyEnumMap.PetNeeds]?.str ?? "")
            : PetOwnerUtil.findRecord(room, user.id, pet.objectId)?.needs)
        ?? PetNeedsUtil.getFresh();
    return PetSaleUtil.getPrice(needs.health);
}

// Why a pet would be none the better for what is offered it.
function describeNoUse(pet: AddObjectSignal, injection: PetInjection): string
{
    if (PetShownStateUtil.getObjectState(pet).action == A.Dead)
        return "That pet has run out of health: nothing helps it now.";
    if (injection == PetInjectionEnumMap.Battery)
    {
        return PetInjectionUtil.takesBattery(pet) ? "Its battery is full: every cell of its indicator is lit."
            : "Its charge is kept where it is, and never changes: it takes no battery.";
    }
    return PetInjectionUtil.takesWrench(pet) ? "It shows no rust: a wrench would mend nothing."
        : "Its health is kept where it is, and never changes: it takes no wrench.";
}

function getTraitLevel(level: string | undefined): number
{
    return Math.max(0, TRAIT_LEVELS.indexOf(level ?? DEFAULT_TRAIT_LEVEL));
}

function getDistance(from: Vec3, to: Vec3): number
{
    return Math.round(10 * Math.hypot(from.x - to.x, from.y - to.y, from.z - to.z) / VOXEL_CELL_SIZE) / 10;
}

function getDollars(ctx: AgentUserContext): number
{
    return ctx.inventory[InventoryItemTypeEnumMap.Dollar] ?? 0;
}

export default AgentPetUtil;
