/**
 * Integration tests: buying a locked shape for one's character (see @docs/gameplay/inventory.md) — which shapes are for
 * sale, what a request spends and answers through the real signal dispatch, the server holding a look to what its wearer
 * holds, the looks new characters are given, shapes a saved look already wears, and how a browser asks and takes the answer.
 * That the dollars and the shape are written as one is the DB suite's.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../../../src/client/networking/client/socketsClient", () => ({ default: { emitBuyItemSignal: vi.fn() } }));

import fc from "fast-check";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { getPendingSignals } from "../helpers/invariants";
import DBInventoryUtil from "../../../src/server/db/util/dbInventoryUtil";
import DBUserUtil from "../../../src/server/db/util/dbUserUtil";
import DBUserVersionMigration from "../../../src/server/db/types/versionMigration/dbUserVersionMigration";
import UserSignalDispatchUtil from "../../../src/server/user/util/userSignalDispatchUtil";
import ClientInventoryManager from "../../../src/client/inventory/clientInventoryManager";
import PlayerShapeUnlockUtil from "../../../src/client/inventory/util/playerShapeUnlockUtil";
import SocketsClient from "../../../src/client/networking/client/socketsClient";
import { connectionStateObservable, dollarsInFlightObservable, dollarsSpentObservable, inventoryObservable,
    notificationMessageObservable, pendingPurchaseElementObservable,
    screenCoachMarksObservable } from "../../../src/client/system/clientObservables";
import RefusalCoachMarkUtil from "../../../src/client/ui/util/refusalCoachMarkUtil";
import ScreenInputBlockUtil from "../../../src/client/ui/util/screenInputBlockUtil";
import PlayerCompositionConstants, { NUM_FREE_PLAYER_PART_TYPES } from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/playerCompositionConstants";
import { getRandomFreeComposition, PlayerCompositionCodec } from "../../../src/shared/graphics/mesh/composition/types/compositionCodec/playerCompositionCodec";
import PlayerCompositionParams from "../../../src/shared/graphics/mesh/composition/types/compositionParams/playerCompositionParams";
import CompositionMetadataUtil from "../../../src/shared/graphics/mesh/composition/util/compositionMetadataUtil";
import BuyItemResultSignal from "../../../src/shared/inventory/types/buyItemResultSignal";
import BuyItemSignal from "../../../src/shared/inventory/types/buyItemSignal";
import InventorySignal from "../../../src/shared/inventory/types/inventorySignal";
import { InventoryItemTypeEnumMap } from "../../../src/shared/inventory/types/inventoryItemType";
import PlayerShapeItemUtil from "../../../src/shared/inventory/util/playerShapeItemUtil";
import EncodableData from "../../../src/shared/networking/types/encodableData";
import BufferState from "../../../src/shared/networking/types/bufferState";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import SignalTypeConfigMap from "../../../src/shared/networking/maps/signalTypeConfigMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import NpcObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/npcObjectTypeConfig";
import PlayerObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import ObjectCompositionUtil from "../../../src/shared/object/util/objectCompositionUtil";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import StringUtil from "../../../src/shared/math/util/stringUtil";
import { PLAYER_SHAPE_PRICE_DOLLARS, UNIT_VEC3 } from "../../../src/shared/system/sharedConstants";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";

const HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const DOLLAR = InventoryItemTypeEnumMap.Dollar;
const PARTS = Object.keys(PlayerCompositionConstants.numTypes);
// The fourth of a head's shapes, which is the first to be bought.
const HEAD_SHAPE = NUM_FREE_PLAYER_PART_TYPES;
const HEAD_ITEM = PlayerShapeItemUtil.getItemType("head", HEAD_SHAPE);
const COMPOSER = PlayerObjectTypeConfig.components.spawnedByAny.instancedMeshComposer;

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    harness.reset();
    harness.seedHub(HUB_ID);
    vi.mocked(DBInventoryUtil.buyItem).mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

async function arrive(userName: string, inventory: {[itemType: string]: number} = {}): Promise<ConnectedUser>
{
    const user = harness.connectUser({id: `id-${userName}`, userName});
    await harness.joinRoom(user, HUB_ID);
    Object.assign(user.socketUserContext.inventory, inventory);
    (await DBUserUtil.findUserById(user.user.id))!.inventory = {...inventory};
    return user;
}

async function storedInventory(user: ConnectedUser): Promise<{[itemType: string]: number}>
{
    return (await DBUserUtil.findUserById(user.user.id))!.inventory;
}

async function dispatchAs(user: ConnectedUser, signalType: string, signal: EncodableData): Promise<boolean>
{
    const bufferState = EncodingUtil.startEncoding();
    signal.encode(bufferState);
    return await UserSignalDispatchUtil.dispatch(user.socketUserContext, signalType, EncodingUtil.endEncoding(bufferState));
}

async function buy(user: ConnectedUser, itemType: string): Promise<boolean[]>
{
    delete user.socketUserContext.signalThrottleTimestamps.buyItemSignal;
    await dispatchAs(user, "buyItemSignal", new BuyItemSignal(itemType));
    return getPendingSignals(user, "buyItemResultSignal").map((signal: BuyItemResultSignal) => {
        expect(signal.itemType).toBe(itemType);
        return signal.bought;
    });
}

function roomOf(user: ConnectedUser)
{
    return ServerRoomManager.roomRuntimeMemories[ServerRoomManager.currentRoomIDByUserID[user.user.id]].room;
}

function playerOf(user: ConnectedUser): AddObjectSignal
{
    return Object.values(roomOf(user).objectById).find(obj => obj.sourceUserID == user.user.id
        && obj.objectTypeIndex == ObjectTypeConfigMap.getIndexByType("Player"))!;
}

function lookWith(types: Partial<PlayerCompositionParams["types"]>, color: number = 0): string
{
    const params = getRandomFreeComposition(1).params as PlayerCompositionParams;
    params.types = {...params.types, head: 0, ear: 0, hat: 0, torso: 0, arm: 0, bottom: 0, ...types};
    params.colors.head = ColorUtil.paletteIndexToRGB("Player", color);
    return CompositionMetadataUtil.encode(COMPOSER.codecType, COMPOSER.codecVersion, params);
}

async function setLook(user: ConnectedUser, look: string): Promise<void>
{
    await dispatchAs(user, "setObjectMetadataSignal", new SetObjectMetadataSignal(roomOf(user).id, playerOf(user).objectId,
        ObjectMetadataKeyEnumMap.InstancedMeshComposition, look));
}

function worn(user: ConnectedUser): string | undefined
{
    return playerOf(user).metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition]?.str;
}

describe("what is for sale", () => {
    it("is every part's shapes past its first three, and nothing else, at one price", () => {
        for (const part of PARTS)
        {
            for (let shape = 0; shape < PlayerCompositionConstants.numTypes[part]; ++shape)
            {
                const itemType = PlayerShapeItemUtil.getItemType(part, shape);
                expect(PlayerShapeItemUtil.getPrice(itemType), itemType)
                    .toBe(shape < 3 ? undefined : PLAYER_SHAPE_PRICE_DOLLARS);
                expect(PlayerShapeItemUtil.isLocked({}, part, shape), itemType).toBe(shape >= 3);
            }
        }
        expect(PLAYER_SHAPE_PRICE_DOLLARS).toBe(10);
        expect(PlayerShapeItemUtil.getPrice(DOLLAR)).toBeUndefined();
        expect(PlayerShapeItemUtil.getPrice("shape_head_6")).toBeUndefined();
        expect(PlayerShapeItemUtil.getPrice("shape_tail_3")).toBeUndefined();
        expect(PlayerShapeItemUtil.getPrice("__proto__")).toBeUndefined();
    });

    it("names its items so that they can be a field of the stored inventory, each its own", () => {
        const itemTypes = PARTS.flatMap(part => [3, 4, 5].map(shape => PlayerShapeItemUtil.getItemType(part, shape)));
        expect(new Set(itemTypes).size).toBe(18);
        for (const itemType of itemTypes)
            expect(itemType).toMatch(/^[a-z_0-9]+$/);
    });

    it("is unlocked by holding it, for that shape alone", () => {
        const inventory = {[HEAD_ITEM]: 1};
        expect(PlayerShapeItemUtil.isLocked(inventory, "head", HEAD_SHAPE)).toBe(false);
        expect(PlayerShapeItemUtil.isLocked(inventory, "head", HEAD_SHAPE + 1)).toBe(true);
        expect(PlayerShapeItemUtil.isLocked(inventory, "ear", HEAD_SHAPE)).toBe(true);
    });
});

describe("what goes over the wire", () => {
    function roundTrip(signalType: string, signal: EncodableData): EncodableData
    {
        const bufferState = EncodingUtil.startEncoding();
        signal.encode(bufferState);
        const decoded = SignalTypeConfigMap.getConfigByType(signalType).decode(
            new BufferState(new Uint8Array(EncodingUtil.endEncoding(bufferState))));
        return decoded;
    }

    it("says what is asked for, and how it ended", () => {
        expect((roundTrip("buyItemSignal", new BuyItemSignal(HEAD_ITEM)) as BuyItemSignal).itemType).toBe(HEAD_ITEM);
        for (const bought of [true, false])
        {
            const decoded = roundTrip("buyItemResultSignal", new BuyItemResultSignal(HEAD_ITEM, bought)) as BuyItemResultSignal;
            expect([decoded.itemType, decoded.bought]).toEqual([HEAD_ITEM, bought]);
        }
    });
});

describe("spending dollars on a shape", () => {
    it("takes its price and gives it, and answers after telling what they now hold", async () => {
        const user = await arrive("Buyer", {[DOLLAR]: 12});

        expect(await buy(user, HEAD_ITEM)).toEqual([true]);

        expect(user.socketUserContext.inventory).toEqual({[DOLLAR]: 2, [HEAD_ITEM]: 1});
        expect(await storedInventory(user)).toEqual({[DOLLAR]: 2, [HEAD_ITEM]: 1});
        expect(getPendingSignals(user, "inventorySignal").pop().inventory).toEqual({[DOLLAR]: 2, [HEAD_ITEM]: 1});
        const runs: {typeIndex: number}[] = (user.socketUserContext as any).pendingSignalsToUser.runs;
        const order = runs.map(run => run.typeIndex);
        expect(order.lastIndexOf(SignalTypeConfigMap.getIndexByType("inventorySignal")))
            .toBeLessThan(order.lastIndexOf(SignalTypeConfigMap.getIndexByType("buyItemResultSignal")));
    });

    it("can spend the very last of them", async () => {
        const user = await arrive("Exact", {[DOLLAR]: PLAYER_SHAPE_PRICE_DOLLARS});
        expect(await buy(user, HEAD_ITEM)).toEqual([true]);
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(0);
    });

    it("refuses someone a dollar short, without troubling the row", async () => {
        const user = await arrive("Short", {[DOLLAR]: PLAYER_SHAPE_PRICE_DOLLARS - 1});
        expect(await buy(user, HEAD_ITEM)).toEqual([false]);
        expect(DBInventoryUtil.buyItem).not.toHaveBeenCalled();
        expect(user.socketUserContext.inventory).toEqual({[DOLLAR]: PLAYER_SHAPE_PRICE_DOLLARS - 1});
    });

    it("refuses someone with nothing at all", async () => {
        const user = await arrive("Broke");
        expect(await buy(user, HEAD_ITEM)).toEqual([false]);
    });

    it("sells nothing that isn't for sale, and never touches what they hold of it", async () => {
        const user = await arrive("Tricky", {[DOLLAR]: 50});
        for (const itemType of [DOLLAR, PlayerShapeItemUtil.getItemType("head", 0), "shape_head_6", "shape_tail_3",
            "__proto__", "constructor", "inventory", ""])
        {
            await dispatchAs(user, "buyItemSignal", new BuyItemSignal(itemType));
            delete user.socketUserContext.signalThrottleTimestamps.buyItemSignal;
        }
        expect(DBInventoryUtil.buyItem).not.toHaveBeenCalled();
        expect(user.socketUserContext.inventory).toEqual({[DOLLAR]: 50});
        expect(getPendingSignals(user, "buyItemResultSignal").every((signal: BuyItemResultSignal) => !signal.bought)).toBe(true);
    });

    it("charges nothing for a shape already held, and says they have it, so that a repeated request is harmless", async () => {
        const user = await arrive("Twice", {[DOLLAR]: 30});
        await buy(user, HEAD_ITEM);
        expect(await buy(user, HEAD_ITEM)).toEqual([true, true]);
        expect(DBInventoryUtil.buyItem).toHaveBeenCalledTimes(1);
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(20);
    });

    it("goes by the row when it refuses, and gives nothing", async () => {
        const user = await arrive("Unlucky", {[DOLLAR]: 30});
        vi.mocked(DBInventoryUtil.buyItem).mockResolvedValueOnce("refused");
        expect(await buy(user, HEAD_ITEM)).toEqual([false]);
        expect(user.socketUserContext.inventory).toEqual({[DOLLAR]: 30});
        expect(getPendingSignals(user, "inventorySignal").pop().inventory).toEqual({[DOLLAR]: 30});
    });

    it("spends nothing when the row says it is held already", async () => {
        const user = await arrive("Elsewhere", {[DOLLAR]: 30});
        vi.mocked(DBInventoryUtil.buyItem).mockResolvedValueOnce("held");
        expect(await buy(user, HEAD_ITEM)).toEqual([true]);
        expect(user.socketUserContext.inventory).toEqual({[DOLLAR]: 30, [HEAD_ITEM]: 1});
    });

    it("never takes more than they have, however requests for different shapes cross", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({min: 0, max: 45}), fc.uniqueArray(fc.integer({min: 0, max: 17}),
            {minLength: 1, maxLength: 8}), async (dollars, picks) => {
            harness.reset();
            harness.seedHub(HUB_ID);
            const user = await arrive("Crossing", {[DOLLAR]: dollars});
            const itemTypes = picks.map(pick => PlayerShapeItemUtil.getItemType(PARTS[pick % 6], 3 + Math.floor(pick / 6)));

            await Promise.all(itemTypes.map(itemType => {
                delete user.socketUserContext.signalThrottleTimestamps.buyItemSignal;
                return dispatchAs(user, "buyItemSignal", new BuyItemSignal(itemType));
            }));

            const {inventory} = user.socketUserContext;
            const numBought = itemTypes.filter(itemType => inventory[itemType] > 0).length;
            expect(inventory[DOLLAR]).toBe(dollars - numBought * PLAYER_SHAPE_PRICE_DOLLARS);
            expect(inventory[DOLLAR]).toBeGreaterThanOrEqual(0);
            expect(await storedInventory(user)).toEqual(inventory);
        }), {numRuns: 40});
    });
});

describe("a look its wearer doesn't hold", () => {
    it("is refused for a locked shape, told to nobody, and put back for the one who sent it", async () => {
        const user = await arrive("Cheat", {[DOLLAR]: 50});
        const onlooker = await arrive("Onlooker");
        const onlookerSignals = getPendingSignals(onlooker, "setObjectMetadataSignal").length;
        await setLook(user, lookWith({head: 1}));
        const look = worn(user);

        await setLook(user, lookWith({head: HEAD_SHAPE}));

        expect(worn(user)).toBe(look);
        expect(getPendingSignals(user, "setObjectMetadataSignal").pop().metadataValue).toBe(look);
        expect(getPendingSignals(onlooker, "setObjectMetadataSignal")).toHaveLength(onlookerSignals + 1);
    });

    it("is refused for every part alike", async () => {
        const user = await arrive("Everywhere");
        for (const part of PARTS)
        {
            await setLook(user, lookWith({[part]: 5}));
            expect(worn(user), part).toBeUndefined();
        }
    });

    it("is judged by what browsers would draw, not by what it claims", async () => {
        const user = await arrive("Clever");
        // A shape past the last is drawn as the last, which is locked.
        const look = lookWith({});
        const pastTheLast = `${look.slice(0, 2)}${StringUtil.convertRawNumberToVisibleASCII(90)}${look.slice(3)}`;
        await setLook(user, pastTheLast);
        expect(worn(user)).toBeUndefined();
        user.socketUserContext.inventory[PlayerShapeItemUtil.getItemType("head", 5)] = 1;
        await setLook(user, pastTheLast);
        expect(worn(user)).toBe(pastTheLast);

        // Another codec's string is drawn as the default look, which wears nothing locked.
        await setLook(user, `~~${look.slice(2)}`);
        const drawn = {} as PlayerCompositionParams;
        ObjectCompositionUtil.decode(playerOf(user), drawn, []);
        for (const part of PARTS)
            expect(drawn.types[part as keyof PlayerCompositionParams["types"]]).toBeLessThan(NUM_FREE_PLAYER_PART_TYPES);
    });

    it("goes through once the shape is bought, for everyone to see, and lasts", async () => {
        const user = await arrive("Honest", {[DOLLAR]: 10});
        const onlooker = await arrive("Onlooker");
        await buy(user, HEAD_ITEM);

        await setLook(user, lookWith({head: HEAD_SHAPE}));

        expect(worn(user)).toBe(lookWith({head: HEAD_SHAPE}));
        expect(getPendingSignals(onlooker, "setObjectMetadataSignal").pop().metadataValue).toBe(lookWith({head: HEAD_SHAPE}));
    });

    it("leaves a shape they took off bought, to put on again for nothing", async () => {
        const user = await arrive("Changing", {[DOLLAR]: 10});
        await buy(user, HEAD_ITEM);
        await setLook(user, lookWith({head: HEAD_SHAPE}));
        await setLook(user, lookWith({head: 0}));
        await setLook(user, lookWith({head: HEAD_SHAPE}));
        expect(worn(user)).toBe(lookWith({head: HEAD_SHAPE}));
        expect(user.socketUserContext.inventory[DOLLAR]).toBe(0);
    });

    it("lets a look from before shapes were bought change, but not take another locked shape", async () => {
        const user = await arrive("Veteran");
        playerOf(user).metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition] =
            new EncodableByteString(lookWith({hat: 4}));

        await setLook(user, lookWith({hat: 4}, 3));
        expect(worn(user)).toBe(lookWith({hat: 4}, 3));

        await setLook(user, lookWith({hat: 5}, 3));
        expect(worn(user)).toBe(lookWith({hat: 4}, 3));
    });

    it("is no concern of an NPC's, whose look is the admin's who edits it, whatever they hold", async () => {
        const admin = harness.connectUser({id: "an-admin", userName: "An-Admin", userType: UserTypeEnumMap.Admin});
        await harness.joinRoom(admin, HUB_ID);
        const room = roomOf(admin);
        const npc = new AddObjectSignal(room.id, admin.user.id, admin.user.userName, ObjectTypeConfigMap.getIndexByType("Npc"),
            "an-npc", new ObjectTransform({x: 16, y: 0, z: 16}, {x: 0, y: 1, z: 0}, {...UNIT_VEC3}), {});
        room.objectById[npc.objectId] = npc;

        await dispatchAs(admin, "setObjectMetadataSignal", new SetObjectMetadataSignal(room.id, npc.objectId,
            ObjectMetadataKeyEnumMap.InstancedMeshComposition, lookWith({head: 5, hat: 4})));

        expect(npc.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition]?.str).toBe(lookWith({head: 5, hat: 4}));
    });

    it("has nothing to say of what isn't a look", async () => {
        const user = await arrive("Talker");
        await dispatchAs(user, "setObjectMetadataSignal", new SetObjectMetadataSignal(roomOf(user).id, playerOf(user).objectId,
            ObjectMetadataKeyEnumMap.SentMessage, "hello"));
        expect(playerOf(user).metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str).toBe("hello");
    });
});

describe("the looks characters start with", () => {
    it("wear nothing a new user would have to buy, however they are seeded", () => {
        fc.assert(fc.property(fc.string({minLength: 1, maxLength: 24}), userID => {
            const obj = new AddObjectSignal("room", userID, userID, ObjectTypeConfigMap.getIndexByType("Player"), userID,
                {pos: {x: 0, y: 0, z: 0}, dir: {x: 0, y: 0, z: 1}, scale: UNIT_VEC3} as any, {});
            const {params} = PlayerObjectTypeConfig.components.spawnedByAny.instancedMeshComposer.generateDefaultParts(obj);
            for (const part of PARTS)
                expect((params.types as any)[part]).toBeLessThan(NUM_FREE_PLAYER_PART_TYPES);
        }), {numRuns: 300});
    });

    it("take every free shape among them, with the colors the same seed always had", () => {
        const seen: {[part: string]: Set<number>} = Object.fromEntries(PARTS.map(part => [part, new Set()]));
        for (let seed = 0; seed < 400; ++seed)
        {
            const free = getRandomFreeComposition(seed).params as PlayerCompositionParams;
            const any = PlayerCompositionCodec.getRandomComposition(seed, UNIT_VEC3).params as PlayerCompositionParams;
            expect(free.colors).toEqual(any.colors);
            for (const part of PARTS)
                seen[part].add((free.types as any)[part]);
        }
        for (const part of PARTS)
            expect([...seen[part]].sort(), part).toEqual([0, 1, 2]);
    });

    it("leave an NPC's look drawn as it always was, from all its shapes", () => {
        const seen = new Set<number>();
        for (let id = 0; id < 200; ++id)
        {
            const obj = new AddObjectSignal("room", "", "", ObjectTypeConfigMap.getIndexByType("Npc"), `npc-${id}`,
                {pos: {x: 0, y: 0, z: 0}, dir: {x: 0, y: 0, z: 1}, scale: UNIT_VEC3} as any, {});
            const {params} = NpcObjectTypeConfig.components.spawnedByAny.instancedMeshComposer.generateDefaultParts(obj);
            seen.add((params as PlayerCompositionParams).types.head);
        }
        expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    });
});

describe("a saved look from before shapes were bought", () => {
    const toV7 = DBUserVersionMigration[6];

    it("keeps its locked shapes for nothing, each one held", async () => {
        const look = lookWith({head: 4, hat: 3, bottom: 5, arm: 2});
        const migrated = await toV7({lastLoginAt: 5, playerMetadata: {[ObjectMetadataKeyEnumMap.InstancedMeshComposition]: look}});
        expect(migrated.inventory).toEqual({shape_head_4: 1, shape_hat_3: 1, shape_bottom_5: 1});
    });

    it("gives nothing for free shapes, or to someone with no saved look", async () => {
        const free = await toV7({playerMetadata: {[ObjectMetadataKeyEnumMap.InstancedMeshComposition]: lookWith({head: 2})}});
        expect(free.inventory).toEqual({});
        expect((await toV7({playerMetadata: {}})).inventory).toEqual({});
        expect((await toV7({})).inventory).toEqual({});
        expect((await toV7({playerMetadata: {[ObjectMetadataKeyEnumMap.SentMessage]: "hello"}})).inventory).toEqual({});
    });

    it("keeps what the row holds already", async () => {
        const migrated = await toV7({inventory: {[DOLLAR]: 7}, playerMetadata: {
            [ObjectMetadataKeyEnumMap.InstancedMeshComposition]: lookWith({ear: 5})}});
        expect(migrated.inventory).toEqual({[DOLLAR]: 7, shape_ear_5: 1});
    });
});

describe("a browser buying a shape", () => {
    let sent: BuyItemSignal[];
    let spent: number[];
    let onUnlocked: ReturnType<typeof vi.fn>;
    const TILE = "partShape_head.3";
    const unlockHead = () => PlayerShapeUnlockUtil.unlock("head", HEAD_SHAPE, TILE, onUnlocked as () => void);
    const marks = () => screenCoachMarksObservable.peek();

    beforeEach(() => {
        sent = [];
        spent = [];
        onUnlocked = vi.fn();
        vi.spyOn(SocketsClient, "emitBuyItemSignal").mockImplementation((signal: BuyItemSignal) => { sent.push(signal); });
        dollarsSpentObservable.addListener("test", dollars => { spent.push(dollars); });
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 25}));
        // A failed answer of an earlier test leaves nothing to find.
        PlayerShapeUnlockUtil.onBuyItemResultSignalReceived(new BuyItemResultSignal(HEAD_ITEM, false));
        notificationMessageObservable.set(null);
        RefusalCoachMarkUtil.hide();
    });

    afterEach(() => {
        dollarsSpentObservable.removeListener("test");
        inventoryObservable.set({});
        dollarsInFlightObservable.set(0);
        RefusalCoachMarkUtil.hide();
        vi.useRealTimers();
    });

    function answer(bought: boolean, inventory: {[itemType: string]: number}): void
    {
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal(inventory));
        PlayerShapeUnlockUtil.onBuyItemResultSignalReceived(new BuyItemResultSignal(HEAD_ITEM, bought));
    }

    it("shows a shape locked until the server has given it", () => {
        expect(PlayerShapeUnlockUtil.isLocked("head", HEAD_SHAPE)).toBe(true);
        unlockHead();
        expect(PlayerShapeUnlockUtil.isLocked("head", HEAD_SHAPE)).toBe(true);
        expect(onUnlocked).not.toHaveBeenCalled();
        expect(spent).toEqual([]);

        answer(true, {[DOLLAR]: 15, [HEAD_ITEM]: 1});

        expect(PlayerShapeUnlockUtil.isLocked("head", HEAD_SHAPE)).toBe(false);
        expect(ClientInventoryManager.getDollarsShown()).toBe(15);
        expect(onUnlocked).toHaveBeenCalledTimes(1);
        expect(spent).toEqual([PLAYER_SHAPE_PRICE_DOLLARS]);
    });

    it("asks for just the one shape, once, however often it is clicked meanwhile", () => {
        unlockHead();
        unlockHead();
        unlockHead();
        expect(sent.map(signal => signal.itemType)).toEqual([HEAD_ITEM]);
    });

    it("doesn't ask with fewer dollars than it costs, and says so over what was clicked, with an x", () => {
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 9}));
        unlockHead();
        expect(sent).toEqual([]);
        expect(marks()).toHaveLength(1);
        expect(marks()[0]).toMatchObject({targetElementId: TILE, text: "You need $10\nto unlock this.", refusal: true});
        expect(marks()[0].onDismiss).toBeDefined();
        expect(notificationMessageObservable.peek()).toBeNull();
    });

    it("takes the mark away after three seconds at most, or at once by its x", () => {
        vi.useFakeTimers();
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 9}));
        unlockHead();
        vi.advanceTimersByTime(2999);
        expect(marks()).toHaveLength(1);
        vi.advanceTimersByTime(1);
        expect(marks()).toEqual([]);

        unlockHead();
        marks()[0].onDismiss!();
        expect(marks()).toEqual([]);
        // Its time running out later changes nothing, as for a mark shown since.
        vi.advanceTimersByTime(1000);
        unlockHead();
        vi.advanceTimersByTime(2999);
        expect(marks()).toHaveLength(1);
    });

    it("keeps one mark up, the last click's, for its full time, each coming in afresh", () => {
        vi.useFakeTimers();
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 9}));
        unlockHead();
        const first = marks()[0];
        vi.advanceTimersByTime(2000);
        PlayerShapeUnlockUtil.unlock("hat", 5, "partShape_hat.5", onUnlocked as () => void);

        expect(marks()).toHaveLength(1);
        expect(marks()[0].targetElementId).toBe("partShape_hat.5");
        expect(marks()[0].showing).not.toBe(first.showing);
        vi.advanceTimersByTime(2999);
        expect(marks()).toHaveLength(1);
    });

    it("leaves other marks up, whatever becomes of its own", () => {
        const other = {targetElementId: "dollarCounter", text: "Something else"};
        screenCoachMarksObservable.set([other]);
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 9}));
        unlockHead();
        expect(marks()).toHaveLength(2);
        RefusalCoachMarkUtil.hide();
        expect(marks()).toEqual([other]);
        screenCoachMarksObservable.set([]);
    });

    it("counts only what the user can see they have", () => {
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 10}));
        ClientInventoryManager.onDollarTakingOff();
        unlockHead();
        expect(sent).toEqual([]);

        ClientInventoryManager.onDollarArrived();
        unlockHead();
        expect(sent).toHaveLength(1);
    });

    it("says so when it is refused, spends nothing, and lets the user try again", () => {
        unlockHead();
        answer(false, {[DOLLAR]: 25});
        expect(onUnlocked).not.toHaveBeenCalled();
        expect(spent).toEqual([]);
        expect(notificationMessageObservable.peek()).toMatch(/no dollars were spent/);

        unlockHead();
        expect(sent).toHaveLength(2);
    });

    it("says the price over what was clicked, not to try again, when the dollars went on something else first", () => {
        unlockHead();
        answer(false, {[DOLLAR]: 5, shape_ear_3: 1});
        expect(marks()).toHaveLength(1);
        expect(marks()[0]).toMatchObject({targetElementId: TILE, text: "You need $10\nto unlock this.", refusal: true});
        expect(notificationMessageObservable.peek()).toBeNull();
    });

    it("may ask again once an answer can't be coming", () => {
        vi.useFakeTimers({toFake: ["Date"]});
        unlockHead();
        vi.advanceTimersByTime(4999);
        unlockHead();
        expect(sent).toHaveLength(1);
        vi.advanceTimersByTime(1);
        unlockHead();
        expect(sent).toHaveLength(2);
    });

    it("ignores an answer to nothing it asked", () => {
        answer(true, {[DOLLAR]: 25});
        expect(spent).toEqual([]);
    });

    describe("while it waits for the answer", () => {
        let endHold: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            endHold = vi.fn();
            vi.spyOn(ScreenInputBlockUtil, "hold").mockReturnValue(endHold as () => void);
        });

        it("darkens what was clicked and holds the whole screen, until the answer comes", () => {
            unlockHead();
            expect(pendingPurchaseElementObservable.peek()).toBe(TILE);
            expect(ScreenInputBlockUtil.hold).toHaveBeenCalledTimes(1);
            expect(endHold).not.toHaveBeenCalled();

            answer(true, {[DOLLAR]: 15, [HEAD_ITEM]: 1});
            expect(pendingPurchaseElementObservable.peek()).toBeNull();
            expect(endHold).toHaveBeenCalledTimes(1);
            expect(onUnlocked).toHaveBeenCalledTimes(1);
        });

        it("lets go of it before a refusal is said, for the mark's x to be pressed", () => {
            unlockHead();
            answer(false, {[DOLLAR]: 5, shape_ear_3: 1});
            expect(endHold).toHaveBeenCalledTimes(1);
            expect(pendingPurchaseElementObservable.peek()).toBeNull();
            expect(marks()).toHaveLength(1);
        });

        it("asks for nothing else meanwhile, nor holds the screen again", () => {
            unlockHead();
            PlayerShapeUnlockUtil.unlock("hat", 5, "partShape_hat.5", onUnlocked as () => void);
            expect(sent.map(signal => signal.itemType)).toEqual([HEAD_ITEM]);
            expect(ScreenInputBlockUtil.hold).toHaveBeenCalledTimes(1);
            expect(pendingPurchaseElementObservable.peek()).toBe(TILE);
        });

        it("gives up when no answer comes in time, and still takes one that comes later", () => {
            vi.useFakeTimers();
            unlockHead();
            vi.advanceTimersByTime(4999);
            expect(endHold).not.toHaveBeenCalled();
            vi.advanceTimersByTime(1);
            expect(endHold).toHaveBeenCalledTimes(1);
            expect(pendingPurchaseElementObservable.peek()).toBeNull();

            answer(true, {[DOLLAR]: 15, [HEAD_ITEM]: 1});
            expect(onUnlocked).toHaveBeenCalledTimes(1);
            expect(endHold).toHaveBeenCalledTimes(1);
        });

        it("gives up as the connection changes, which takes its answer with it", () => {
            unlockHead();
            connectionStateObservable.set("reconnecting");
            expect(endHold).toHaveBeenCalledTimes(1);
            expect(pendingPurchaseElementObservable.peek()).toBeNull();
            connectionStateObservable.set("connected");
            expect(endHold).toHaveBeenCalledTimes(1);
        });
    });
});

describe("holding the screen", () => {
    // A window of events alone, as the page's is to what listens on it.
    const page = new EventTarget();
    const heard: string[] = [];

    beforeEach(() => {
        heard.length = 0;
    });

    it("keeps from everything that listens what would start a press, a click, a scroll or a key", () => {
        vi.stubGlobal("window", page);
        ScreenInputBlockUtil.install();
        for (const type of ["pointerdown", "click", "wheel", "keydown", "pointerup", "keyup"])
            page.addEventListener(type, () => heard.push(type), true);

        const endHold = ScreenInputBlockUtil.hold();
        const events = ["pointerdown", "click", "wheel", "keydown", "pointerup", "keyup"]
            .map(type => Object.assign(new Event(type, {cancelable: true}), {key: "r"}));
        events.forEach(event => page.dispatchEvent(event));
        // What ends a press or a key still passes, so that nothing held down is left stuck.
        expect(heard).toEqual(["pointerup", "keyup"]);
        // What the browser does with a key is its own, but for Escape's close request, which would close a panel.
        expect(events.filter(event => event.defaultPrevented).map(event => event.type)).toEqual(["pointerdown", "click",
            "wheel"]);
        const escape = Object.assign(new Event("keydown", {cancelable: true}), {key: "Escape"});
        page.dispatchEvent(escape);
        expect(escape.defaultPrevented).toBe(true);
        expect(heard).toEqual(["pointerup", "keyup"]);

        endHold();
        endHold();
        heard.length = 0;
        ["pointerdown", "keydown"].forEach(type => page.dispatchEvent(new Event(type)));
        expect(heard).toEqual(["pointerdown", "keydown"]);
        vi.unstubAllGlobals();
    });
});
