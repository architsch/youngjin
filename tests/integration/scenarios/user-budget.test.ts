/**
 * Integration tests: users' budgets (see UserBudgetUtil, USER_BUDGETS), the same for a browser and an AI agent, through
 * the dispatch they share: an edit past its budget is refused and answered as one its own checks refuse is, since the
 * sender has applied it already; speech and reported moves past a budget are dropped unheard; each comes back over
 * time, one kind apart from another, and a player moved farther than its distance budget is put back for its sender
 * alone.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { harness, ConnectedUser } from "../helpers/serverHarness";
import { getPendingSignals } from "../helpers/invariants";
import UserSignalDispatchUtil from "../../../src/server/user/util/userSignalDispatchUtil";
import UserBudgetUtil from "../../../src/server/user/util/userBudgetUtil";
import ServerRoomManager from "../../../src/server/room/serverRoomManager";
import ServerUserManager from "../../../src/server/user/serverUserManager";
import { USER_BUDGETS } from "../../../src/server/system/serverConstants";
import EncodableData from "../../../src/shared/networking/types/encodableData";
import EncodingUtil from "../../../src/shared/networking/util/encodingUtil";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/removeVoxelBlockSignal";
import MoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/moveVoxelBlockSignal";
import SetVoxelQuadTextureSignal from "../../../src/shared/voxel/types/update/setVoxelQuadTextureSignal";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectAttachmentUtil from "../../../src/shared/object/util/objectAttachmentUtil";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import LampObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import { COLLISION_LAYER_HEIGHT, INITIAL_MULTI_PLAYER_ENTRANCE_POS, NUM_VOXEL_TEXTURES,
    STOREY_FLOOR_COLLISION_LAYER } from "../../../src/shared/system/sharedConstants";
import Vec3 from "../../../src/shared/math/types/vec3";
import LogUtil from "../../../src/shared/system/util/logUtil";

const HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const STANDING_Y = 0.5 * PLAYER_HEIGHT;
// Out on the open floor, straight in from the hub's door.
const OUT_OF_THE_DOORWAY: Vec3 = {x: INITIAL_MULTI_PLAYER_ENTRANCE_POS.x, y: STANDING_Y, z: 25};

const lampTypeIndex = ObjectTypeConfigMap.getIndexByType("Lamp");
// Hung from the underside of the storey slab the hub has everywhere (see buildBareMultiplayerRoomContent), where it
// rests on the four slab blocks around this point.
const UNDER_THE_SLAB: Vec3 = {x: 12, y: STOREY_FLOOR_COLLISION_LAYER * COLLISION_LAYER_HEIGHT, z: 12};
const SLAB_BLOCK_ABOVE_THE_LAMP = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(23, 23, STOREY_FLOOR_COLLISION_LAYER);

async function joinHuman(userName: string): Promise<ConnectedUser>
{
    const human = harness.connectUser({id: `id-${userName}`, userName});
    await harness.joinRoom(human, HUB_ID);
    return human;
}

async function dispatchAs(user: ConnectedUser, signalType: string, signal: EncodableData): Promise<boolean>
{
    const bufferState = EncodingUtil.startEncoding();
    signal.encode(bufferState);
    return await UserSignalDispatchUtil.dispatch(user.socketUserContext, signalType, EncodingUtil.endEncoding(bufferState));
}

function blockAt(row: number, column: number, layer: number = 0): boolean
{
    return VoxelQueryUtil.isVoxelBlockPresentAt(ServerRoomManager.roomRuntimeMemories[HUB_ID].room.voxelGrid.voxels,
        row, column, layer);
}

// Spends whatever is left of the user's edit budget, with the clock standing still.
function spendEditBudget(user: ConnectedUser): void
{
    expect(UserBudgetUtil.trySpend(user.user.id, "edit", Math.floor(UserBudgetUtil.getLevel(user.user.id, "edit"))))
        .toBe(true);
}

async function hangLamp(user: ConnectedUser, objectId: string): Promise<AddObjectSignal>
{
    const lamp = new AddObjectSignal(HUB_ID, user.user.id, user.user.userName, lampTypeIndex, objectId,
        new ObjectTransform({...UNDER_THE_SLAB}, {x: 0, y: -1, z: 0}, {x: 1, y: 1, z: 1}), {});
    expect(await dispatchAs(user, "addObjectSignal", lamp)).toBe(true);
    expect(ServerRoomManager.roomRuntimeMemories[HUB_ID].room.objectById[objectId]).toBeDefined();
    return lamp;
}

// A block in the next cell of a stretch of the hub's lower floor.
async function placeBlock(user: ConnectedUser, index: number): Promise<boolean>
{
    return await dispatchAs(user, "addVoxelBlockSignal", new AddVoxelBlockSignal(HUB_ID,
        VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(5 + Math.floor(index / 50), 5 + index % 50, 0), [0, 0, 0, 0, 0, 0]));
}

async function say(user: ConnectedUser, text: string): Promise<boolean>
{
    return await dispatchAs(user, "setObjectMetadataSignal", new SetObjectMetadataSignal(HUB_ID,
        harness.getPlayerObjectId(user)!, ObjectMetadataKeyEnumMap.SentMessage, text));
}

async function moveTo(user: ConnectedUser, pos: Vec3): Promise<boolean>
{
    return await dispatchAs(user, "setObjectTransformSignal", new SetObjectTransformSignal(HUB_ID,
        harness.getPlayerObjectId(user)!, new ObjectTransform({...pos}, {x: 0, y: 0, z: -1}, {x: 1, y: 1, z: 1}), false));
}

function positionOf(user: ConnectedUser): Vec3
{
    return {...ServerUserManager.getPlayerObject(user.user.id)!.transform.pos};
}

// As near as a position comes through the wire (see ObjectTransform).
function isNear(a: Vec3, b: Vec3): boolean
{
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.05;
}

// (Rounded up, as the clock keeps whole milliseconds.)
function wait(seconds: number): void
{
    vi.setSystemTime(Date.now() + Math.ceil(1000 * seconds));
}

describe("users' budgets", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        // Only the clock: promises and the harness's own timers run as usual.
        vi.useFakeTimers({toFake: ["Date"]});
        harness.reset();
        harness.seedHub(HUB_ID);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("refuses a user's edits past the edit budget, which the room never hears of, and lets them by as it fills again",
        async () => {
        const builder = await joinHuman("Builder");
        const watcher = await joinHuman("Watcher");
        const {capacity, refillPerSecond} = USER_BUDGETS.edit;

        for (let i = 0; i < capacity; ++i)
            expect(await placeBlock(builder, i), `edit ${i}`).toBe(true);
        expect(await placeBlock(builder, capacity)).toBe(false);
        expect(blockAt(5 + Math.floor(capacity / 50), 5 + capacity % 50)).toBe(false);
        expect(getPendingSignals(watcher, "addVoxelBlockSignal").length).toBe(capacity);
        // The builder's browser has put the block there already, so it is told the cell holds none.
        expect(getPendingSignals(builder, "removeVoxelBlockSignal").map(s => s.quadIndex)).toEqual([
            VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(5 + Math.floor(capacity / 50), 5 + capacity % 50, 0)]);

        // Another user's budget is their own.
        expect(await placeBlock(watcher, capacity + 1)).toBe(true);

        wait(1 / refillPerSecond);
        expect(await placeBlock(builder, capacity)).toBe(true);
        expect(await placeBlock(builder, capacity + 2)).toBe(false);
    });

    // Unanswered, the builder's room would lack the block the stored one keeps, and a block built there again would
    // be refused, its answer repainting the new block with this one's textures.
    it("answers a block's removal past the edit budget with the block as the room keeps it", async () => {
        const builder = await joinHuman("Builder");
        const watcher = await joinHuman("Watcher");
        const quadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(5, 5, 0);
        expect(await dispatchAs(builder, "addVoxelBlockSignal",
            new AddVoxelBlockSignal(HUB_ID, quadIndex, [3, 3, 3, 3, 3, 3]))).toBe(true);
        spendEditBudget(builder);

        expect(await dispatchAs(builder, "removeVoxelBlockSignal", new RemoveVoxelBlockSignal(HUB_ID, quadIndex)))
            .toBe(false);
        expect(blockAt(5, 5)).toBe(true);
        expect(getPendingSignals(builder, "addVoxelBlockSignal").map(s => [s.quadIndex, s.quadTextureIndicesWithinLayer]))
            .toEqual([[quadIndex, [3, 3, 3, 3, 3, 3]]]);
        expect(getPendingSignals(watcher, "removeVoxelBlockSignal")).toEqual([]);
    });

    // Unanswered, the painter's room would show a face the stored room doesn't have, until it came in again.
    it("answers a face's painting past the edit budget with the texture the face still has", async () => {
        const painter = await joinHuman("Painter");
        const floorTile = VoxelQueryUtil.getFloorVoxelQuadIndex(20, 20);
        const quads = ServerRoomManager.roomRuntimeMemories[HUB_ID].room.voxelGrid.quadsMem.quads;
        const texture = quads[floorTile];
        spendEditBudget(painter);

        expect(await dispatchAs(painter, "setVoxelQuadTextureSignal",
            new SetVoxelQuadTextureSignal(HUB_ID, floorTile, (texture + 1) % NUM_VOXEL_TEXTURES))).toBe(false);
        expect(quads[floorTile]).toBe(texture);
        expect(getPendingSignals(painter, "setVoxelQuadTextureSignal").map(s => [s.quadIndex, s.textureIndex]))
            .toEqual([[floorTile, texture]]);
    });

    // Unanswered, the remover's room would lack the lamp the stored one keeps, and so see nothing holding up the block
    // it hangs from, whose every removal would be refused, and the block sent back, with nobody told why.
    it("answers an attached object's removal past the edit budget with the object, which its block is then removed with",
        async () => {
        const builder = await joinHuman("Builder");
        const room = ServerRoomManager.roomRuntimeMemories[HUB_ID].room;
        await hangLamp(builder, "lamp");
        expect(ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, SLAB_BLOCK_ABOVE_THE_LAMP)).toEqual(["lamp"]);
        spendEditBudget(builder);

        expect(await dispatchAs(builder, "removeObjectSignal", new RemoveObjectSignal(HUB_ID, "lamp"))).toBe(false);
        expect(room.objectById["lamp"]).toBeDefined();
        expect(getPendingSignals(builder, "addObjectSignal").filter(s => s.objectId == "lamp")).toEqual(
            [room.objectById["lamp"]]);

        // As the builder's browser does once it holds the lamp again: the lamp first, then the block.
        wait(2 / USER_BUDGETS.edit.refillPerSecond);
        expect(await dispatchAs(builder, "removeObjectSignal", new RemoveObjectSignal(HUB_ID, "lamp"))).toBe(true);
        expect(await dispatchAs(builder, "removeVoxelBlockSignal",
            new RemoveVoxelBlockSignal(HUB_ID, SLAB_BLOCK_ABOVE_THE_LAMP))).toBe(true);
        expect(blockAt(23, 23, STOREY_FLOOR_COLLISION_LAYER)).toBe(false);
    });

    it("answers a block's move, an object's placement and an object's value past the edit budget with what the room keeps",
        async () => {
        const builder = await joinHuman("Builder");
        const room = ServerRoomManager.roomRuntimeMemories[HUB_ID].room;
        const from = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(5, 5, 0);
        const to = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(5, 6, 0);
        expect(await dispatchAs(builder, "addVoxelBlockSignal", new AddVoxelBlockSignal(HUB_ID, from, [4, 4, 4, 4, 4, 4])))
            .toBe(true);
        const lamp = await hangLamp(builder, "lamp");
        const kept = {pos: {...room.objectById["lamp"].transform.pos}, light: LampObjectTypeConfig.util.getDefaultLightProperties()};
        expect(await dispatchAs(builder, "setObjectMetadataSignal", new SetObjectMetadataSignal(HUB_ID, "lamp",
            ObjectMetadataKeyEnumMap.LightProperties, kept.light))).toBe(true);
        spendEditBudget(builder);

        expect(await dispatchAs(builder, "moveVoxelBlockSignal", new MoveVoxelBlockSignal(HUB_ID, from, 0, 1, 0))).toBe(false);
        expect(getPendingSignals(builder, "addVoxelBlockSignal").map(s => s.quadIndex)).toEqual([from]);
        expect(getPendingSignals(builder, "removeVoxelBlockSignal").map(s => s.quadIndex)).toEqual([to]);

        expect(await dispatchAs(builder, "setObjectTransformSignal", new SetObjectTransformSignal(HUB_ID, "lamp",
            new ObjectTransform({...kept.pos, x: kept.pos.x + 2}, {...lamp.transform.dir}, {x: 1, y: 1, z: 1}), true)))
            .toBe(false);
        expect(room.objectById["lamp"].transform.pos).toEqual(kept.pos);
        const putBack = getPendingSignals(builder, "setObjectTransformSignal").filter(s => s.objectId == "lamp");
        expect(putBack.map(s => [s.transform.pos, s.ignorePhysics])).toEqual([[kept.pos, true]]);

        expect(await dispatchAs(builder, "setObjectMetadataSignal", new SetObjectMetadataSignal(HUB_ID, "lamp",
            ObjectMetadataKeyEnumMap.LightProperties, LampObjectTypeConfig.util.encodeLightProperties(3, 8, 9))))
            .toBe(false);
        expect(getPendingSignals(builder, "setObjectMetadataSignal").filter(s => s.objectId == "lamp")
            .map(s => s.metadataValue)).toEqual([kept.light]);
    });

    it("keeps speech apart from edits, each with a budget of its own", async () => {
        const talker = await joinHuman("Talker");
        const {capacity, refillPerSecond} = USER_BUDGETS.speech;

        for (let i = 0; i < capacity; ++i)
            expect(await say(talker, `line ${i}`), `line ${i}`).toBe(true);
        expect(await say(talker, "one too many")).toBe(false);
        expect(ServerUserManager.getPlayerObject(talker.user.id)!.metadata[ObjectMetadataKeyEnumMap.SentMessage].str)
            .toBe(`line ${capacity - 1}`);
        expect(await placeBlock(talker, 0)).toBe(true);

        wait(1 / refillPerSecond);
        expect(await say(talker, "and now")).toBe(true);
    });

    it("drops a player's reported moves past their budget, a browser's few a second well within it", async () => {
        const walker = await joinHuman("Walker");
        expect(await moveTo(walker, OUT_OF_THE_DOORWAY)).toBe(true);
        const {capacity, refillPerSecond} = USER_BUDGETS.moves;

        // Small steps, so that only their number counts.
        for (let i = 1; i < capacity; ++i)
            expect(await moveTo(walker, {...OUT_OF_THE_DOORWAY, x: OUT_OF_THE_DOORWAY.x + 0.01 * i}), `move ${i}`).toBe(true);
        expect(await moveTo(walker, OUT_OF_THE_DOORWAY)).toBe(false);

        wait(1 / refillPerSecond);
        expect(await moveTo(walker, OUT_OF_THE_DOORWAY)).toBe(true);
    });

    it("puts a player moved farther than its distance budget back, for its sender alone, until it has filled again",
        async () => {
        const runner = await joinHuman("Runner");
        const watcher = await joinHuman("Watcher");
        const {capacity, refillPerSecond} = USER_BUDGETS.distance;
        expect(await moveTo(runner, OUT_OF_THE_DOORWAY)).toBe(true);
        wait(capacity / refillPerSecond);
        getPendingSignals(runner, "setObjectTransformSignal").length = 0;

        // Back and forth across the hub, a long jump each time: as far as the budget goes, and no farther.
        const ends = [{...OUT_OF_THE_DOORWAY, x: 4.5}, {...OUT_OF_THE_DOORWAY, x: 28.5}];
        const jump = ends[1].x - ends[0].x;
        let jumps = 0;
        while (await moveTo(runner, ends[jumps % 2]) && isNear(positionOf(runner), ends[jumps % 2]))
            ++jumps;
        expect(jumps).toBe(Math.floor((capacity - Math.abs(ends[0].x - OUT_OF_THE_DOORWAY.x)) / jump) + 1);

        const before = ends[(jumps + 1) % 2];
        expect(isNear(positionOf(runner), before)).toBe(true);
        const putBack = getPendingSignals(runner, "setObjectTransformSignal").filter(s => s.ignorePhysics);
        expect(putBack.length).toBe(1);
        expect(isNear(putBack[0].transform.pos, before)).toBe(true);
        expect(getPendingSignals(watcher, "setObjectTransformSignal").filter(s => s.ignorePhysics)).toEqual([]);

        wait(jump / refillPerSecond);
        expect(await moveTo(runner, ends[jumps % 2])).toBe(true);
        expect(isNear(positionOf(runner), ends[jumps % 2])).toBe(true);
    });

    it("logs what a budget refuses a user once a minute, however much it refuses", async () => {
        const builder = await joinHuman("Builder");
        const logSpy = vi.spyOn(LogUtil, "log");
        const spentLines = () => logSpy.mock.calls.filter(([title]) => title == "Budget spent").map(([, data]) => data);

        for (let i = 0; i < USER_BUDGETS.edit.capacity + 20; ++i)
            await placeBlock(builder, i % 100);
        expect(spentLines()).toEqual([{userID: builder.user.id, kind: "edit"}]);

        wait(60);
        for (let i = 0; i < USER_BUDGETS.edit.capacity + 1; ++i)
            await placeBlock(builder, i % 100);
        expect(spentLines().length).toBe(2);
    });

    it("keeps a user's budgets across their connections", async () => {
        const builder = await joinHuman("Builder");
        for (let i = 0; i < USER_BUDGETS.edit.capacity; ++i)
            await placeBlock(builder, i);

        const again = harness.connectUser({id: builder.user.id, userName: builder.user.userName});
        await harness.joinRoom(again, HUB_ID);

        expect(UserBudgetUtil.getLevel(builder.user.id, "edit")).toBeLessThan(1);
        expect(await placeBlock(again, USER_BUDGETS.edit.capacity)).toBe(false);
    });
});
