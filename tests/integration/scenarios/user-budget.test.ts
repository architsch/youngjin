/**
 * Integration tests: users' budgets (see UserBudgetUtil, USER_BUDGETS), the same for a browser and an AI agent, through
 * the dispatch they share: edits, speech and reported moves past a budget are dropped unheard and come back over time,
 * one kind apart from another, and a player moved farther than its distance budget is put back for its sender alone.
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
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { INITIAL_MULTI_PLAYER_ENTRANCE_POS } from "../../../src/shared/system/sharedConstants";
import Vec3 from "../../../src/shared/math/types/vec3";
import LogUtil from "../../../src/shared/system/util/logUtil";

const HUB_ID = "hubAAAAAAAAAAAAAAAAA";
const STANDING_Y = 0.5 * PLAYER_HEIGHT;
// Out on the open floor, straight in from the hub's door.
const OUT_OF_THE_DOORWAY: Vec3 = {x: INITIAL_MULTI_PLAYER_ENTRANCE_POS.x, y: STANDING_Y, z: 25};

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

function blockAt(row: number, column: number): boolean
{
    return VoxelQueryUtil.isVoxelBlockPresentAt(ServerRoomManager.roomRuntimeMemories[HUB_ID].room.voxelGrid.voxels,
        row, column, 0);
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

function wait(seconds: number): void
{
    vi.setSystemTime(Date.now() + 1000 * seconds);
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

    it("drops a user's edits past the edit budget, which the room never hears of, and lets them by as it fills again",
        async () => {
        const builder = await joinHuman("Builder");
        const watcher = await joinHuman("Watcher");
        const {capacity, refillPerSecond} = USER_BUDGETS.edit;

        for (let i = 0; i < capacity; ++i)
            expect(await placeBlock(builder, i), `edit ${i}`).toBe(true);
        expect(await placeBlock(builder, capacity)).toBe(false);
        expect(blockAt(5 + Math.floor(capacity / 50), 5 + capacity % 50)).toBe(false);
        expect(getPendingSignals(watcher, "addVoxelBlockSignal").length).toBe(capacity);

        // Another user's budget is their own.
        expect(await placeBlock(watcher, capacity + 1)).toBe(true);

        wait(1 / refillPerSecond);
        expect(await placeBlock(builder, capacity)).toBe(true);
        expect(await placeBlock(builder, capacity + 2)).toBe(false);
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
