/**
 * Integration tests: what a browser does with what the server says of the room it is in (see ClientObjectManager): a
 * helper's moves, which are only shown, carry its body and collider and leave the room's copy of it at home, as a room
 * file saves it, while the browser's guess at which helper will answer goes by where they took it; someone else's change
 * to an object's settings told of as theirs, and none of what a helper shows of what it is doing; what is said of a
 * room while it is still loading reaches it once it has loaded, in the order said; a dollar bill collected, which flies
 * straight to the count on its collector's screen and into its collector's body on everyone else's; and what coming back
 * has earned, shown once it can be seen.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 100);
    return { default: { getScene: () => scene, addObjectToScene: () => {}, getCamera: () => camera } };
});

vi.mock("../../../src/client/app", () => ({
    default: {
        getCurrentRoom: vi.fn(),
        getUser: vi.fn(),
        whenInRoom: vi.fn(),
    },
}));

vi.mock("../../../src/client/networking/client/socketsClient", () => ({ default: {} }));

import * as THREE from "three";
import fc from "fast-check";
import App from "../../../src/client/app";
import GraphicsManager from "../../../src/client/graphics/graphicsManager";
import MeshFactory from "../../../src/client/graphics/factories/meshFactory";
import ClientInventoryManager from "../../../src/client/inventory/clientInventoryManager";
import LoginRewardUtil, { COACH_MARK_DURATION_MS as REWARD_MARK_DURATION_MS,
    SHOW_DELAY_MS as REWARD_SHOW_DELAY_MS } from "../../../src/client/inventory/util/loginRewardUtil";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import InstancedMeshGraphics from "../../../src/client/object/components/instancedMeshGraphics";
import DollarBillGameObject, { ABSORB_SECONDS, COUNT_CORNER,
    COUNT_FLIGHT_SECONDS } from "../../../src/client/object/types/gameObject/dollarBillGameObject";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import NpcGameObject from "../../../src/client/object/types/gameObject/npcGameObject";
import HelperThinkingUtil from "../../../src/client/object/util/helperThinkingUtil";
import { dollarsInFlightObservable, inventoryGainObservable, loginRewardStageObservable, objectCollectedObservable,
    inventoryObservable, objectEditObservable, objectPlacedObservable, roomChangedObservable, screenCoachMarksObservable }
    from "../../../src/client/system/clientObservables";
import { SpeakerActivityEnumMap } from "../../../src/shared/object/types/speakerActivity";
import { endClientProcess, tryStartClientProcess } from "../../../src/client/system/types/clientProcess";
import { InventoryItemTypeEnumMap } from "../../../src/shared/inventory/types/inventoryItemType";
import InventorySignal from "../../../src/shared/inventory/types/inventorySignal";
import LoginRewardSignal from "../../../src/shared/inventory/types/loginRewardSignal";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { LOGIN_REWARD_DOLLARS } from "../../../src/shared/system/sharedConstants";
import { FTUEElementCodeEnumMap } from "../../../src/shared/user/types/ftueElementCode";
import DollarBillObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/dollarBillObjectTypeConfig";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectCollectedSignal from "../../../src/shared/object/types/objectCollectedSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import SetObjectTransformSignal from "../../../src/shared/object/types/setObjectTransformSignal";
import SetObjectMetadataSignal from "../../../src/shared/object/types/setObjectMetadataSignal";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import NpcFacingUtil from "../../../src/shared/object/util/npcFacingUtil";
import PhysicsObjectUtil from "../../../src/shared/physics/util/physicsObjectUtil";
import Room from "../../../src/shared/room/types/room";
import RoomFile from "../../../src/shared/room/types/roomFile";
import Vec3 from "../../../src/shared/math/types/vec3";
import { createEditingUser } from "../helpers/mockUser";
import { createRoom } from "../helpers/selectionHarness";

const ROOM_ID = "a-hub";
const NPC_ID = "a-helper";
const NPC_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType("Npc");
const UP: Vec3 = {x: 0, y: 1, z: 0};
const HOME: Vec3 = {x: 10, y: 0, z: 10};
const AWAY: Vec3 = {x: 13, y: 0, z: 14};

const user = createEditingUser();
let room: Room;
// Where the helper's body has been put, in turn.
let bodyAt: Vec3[];

function transformTo(pos: Vec3): ObjectTransform
{
    return new ObjectTransform({...pos}, {...UP}, {x: 1, y: 1, z: 1});
}

// Whether the helper's collider is near a floor point, as whatever looks for what is near asks (see
// PlayerProximityDetectionUpdater).
function colliderIsNear(point: Vec3): boolean
{
    return PhysicsObjectUtil.getObjectsIn2DDist(ROOM_ID, point.x, point.z, 0.5)[NPC_ID] != undefined;
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    room = createRoom(ROOM_ID);
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getUser as Mock).mockReturnValue(user);
    (App.whenInRoom as Mock).mockImplementation(async (roomID: string) => App.getCurrentRoom()?.id == roomID);

    // A helper, as the room keeps it, and the body its game object draws.
    expect(ObjectUpdateUtil.addObject(user, room, new AddObjectSignal(ROOM_ID, user.id, user.userName, NPC_TYPE_INDEX,
        NPC_ID, transformTo(HOME), {}), false)).toBe(true);
    bodyAt = [];
    const body = {
        params: room.objectById[NPC_ID],
        components: {},
        setObjectTransform: (pos: Vec3) => { bodyAt.push({...pos}); },
        onSetMetadata: () => {},
    } as unknown as GameObject;
    vi.spyOn(ClientObjectManager, "getObjectById").mockImplementation(
        (objectId: string) => (objectId == NPC_ID) ? body : undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("an object added just as the room was sent", () => {
    it("is taken once, the room having held it already", async () => {
        const add = vi.spyOn(ClientObjectManager, "addObject");
        await ClientObjectManager.onAddObjectSignalReceived(new AddObjectSignal(ROOM_ID, user.id, user.userName,
            NPC_TYPE_INDEX, NPC_ID, transformTo(HOME), {}));
        expect(add).not.toHaveBeenCalled();
    });
});

describe("a helper's moves in a browser", () => {
    it("carry its body and collider when only shown, and leave the room's copy of it at home, as a room file saves it",
        async () => {
        await ClientObjectManager.onSetObjectTransformSignalReceived(
            new SetObjectTransformSignal(ROOM_ID, NPC_ID, transformTo(AWAY), true, true));
        expect(bodyAt).toEqual([AWAY]);
        expect(colliderIsNear(AWAY)).toBe(true);
        expect(colliderIsNear(HOME)).toBe(false);
        expect(room.objectById[NPC_ID].transform.pos).toEqual(HOME);
        expect(RoomFile.fromRoom(room).objectGroup.objectById[NPC_ID].transform.pos).toEqual(HOME);

        // An admin's move of it, which the room keeps, moves its home.
        await ClientObjectManager.onSetObjectTransformSignalReceived(
            new SetObjectTransformSignal(ROOM_ID, NPC_ID, transformTo(AWAY), true));
        expect(room.objectById[NPC_ID].transform.pos).toEqual(AWAY);
    });

    it("tell of an admin's move of it as someone else's placement, and of none of its own steps", async () => {
        const placed: [string, boolean][] = [];
        objectPlacedObservable.addListener("test", ({object, own}) => { placed.push([object.objectId, own]); });
        await ClientObjectManager.onSetObjectTransformSignalReceived(
            new SetObjectTransformSignal(ROOM_ID, NPC_ID, transformTo(AWAY), true, true));
        expect(placed).toEqual([]);
        await ClientObjectManager.onSetObjectTransformSignalReceived(
            new SetObjectTransformSignal(ROOM_ID, NPC_ID, transformTo(AWAY), true));
        expect(placed).toEqual([[NPC_ID, false]]);

        // Nor is a player moved outside physics, which is none of the room's own.
        expect(ObjectUpdateUtil.addObject(user, room, new AddObjectSignal(ROOM_ID, user.id, user.userName,
            ObjectTypeConfigMap.getIndexByType("Player"), "a-player", transformTo(HOME), {}), false)).toBe(true);
        await ClientObjectManager.onSetObjectTransformSignalReceived(
            new SetObjectTransformSignal(ROOM_ID, "a-player", transformTo(AWAY), true));
        expect(placed).toEqual([[NPC_ID, false]]);
        objectPlacedObservable.removeListener("test");
    });

    it("leave it where the browser guesses which helper will answer a line from, as the server picks it", () => {
        // The user stands facing north, one helper at home ahead of them but shown off to their right, the other the
        // other way round.
        const me = {x: 10, y: 0, z: 20};
        const ahead = {x: 10, y: 0, z: 15};
        const right = {x: 16, y: 0, z: 20};
        const thinking: string[] = [];
        const bodies: {[objectId: string]: GameObject} = {};
        for (const [objectId, home, shownAt] of [["ahead-at-home", ahead, right], ["right-at-home", right, ahead]] as
            [string, Vec3, Vec3][])
        {
            expect(ObjectUpdateUtil.addObject(user, room, new AddObjectSignal(ROOM_ID, user.id, user.userName,
                NPC_TYPE_INDEX, objectId, transformTo(home), {}), false)).toBe(true);
            bodies[objectId] = Object.assign(Object.create(NpcGameObject.prototype), {
                params: room.objectById[objectId],
                obj: {position: {...shownAt}},
                components: {speechBubble: {expectThinking: () => thinking.push(objectId)}},
            });
        }
        vi.spyOn(ClientObjectManager, "getObjectById").mockImplementation((objectId: string) => bodies[objectId]);
        // A player's transform points behind it (see PlayerController).
        vi.spyOn(ClientObjectManager, "getMyPlayer").mockReturnValue({
            params: new AddObjectSignal(ROOM_ID, user.id, user.userName, ObjectTypeConfigMap.getIndexByType("Player"),
                "me", transformTo(me), {}),
            position: new THREE.Vector3(me.x, me.y + 0.5 * PLAYER_HEIGHT, me.z),
            direction: new THREE.Vector3(0, 0, 1),
        } as unknown as GameObject);

        HelperThinkingUtil.expectAnswerTo("hello?");
        expect(thinking).toEqual(["right-at-home"]);
    });
});

describe("someone else's change to an object, in a browser", () => {
    it("is told of as theirs, and none of what a helper shows of what it is doing is", async () => {
        const changed: [string, string, boolean][] = [];
        objectEditObservable.addListener("test", ({kind, object, own}) => { changed.push([kind, object.objectId, own]); });
        for (const [key, value] of [[ObjectMetadataKeyEnumMap.Facing, NpcFacingUtil.encode(90)],
            [ObjectMetadataKeyEnumMap.SentMessage, "Hello!"],
            [ObjectMetadataKeyEnumMap.Activity, SpeakerActivityEnumMap.Typing]] as [number, string][])
        {
            await ClientObjectManager.onSetObjectMetadataSignalReceived(new SetObjectMetadataSignal(ROOM_ID, NPC_ID, key,
                value));
        }
        expect(changed).toEqual([]);
        await ClientObjectManager.onSetObjectMetadataSignalReceived(new SetObjectMetadataSignal(ROOM_ID, NPC_ID,
            ObjectMetadataKeyEnumMap.Tags, "guide"));
        expect(changed).toEqual([["change", NPC_ID, false]]);
        objectEditObservable.removeListener("test");
    });
});

describe("what is said of a room in a browser", () => {
    it("reaches the room once it has loaded, in the order said, and nothing said of another room reaches it",
        async () => {
        let loaded = () => {};
        const loading = new Promise<void>(resolve => { loaded = resolve; });
        (App.whenInRoom as Mock).mockImplementation(
            (roomID: string) => loading.then(() => App.getCurrentRoom()?.id == roomID));
        const facing = (roomID: string, degrees: number) => ClientObjectManager.onSetObjectMetadataSignalReceived(
            new SetObjectMetadataSignal(roomID, NPC_ID, ObjectMetadataKeyEnumMap.Facing, NpcFacingUtil.encode(degrees)));

        const received = [facing(ROOM_ID, 90), facing(ROOM_ID, 180), facing(ROOM_ID, 270), facing("another-room", 45)];
        await new Promise(resolve => setImmediate(resolve));
        expect(room.objectById[NPC_ID].metadata[ObjectMetadataKeyEnumMap.Facing]).toBeUndefined();

        loaded();
        await Promise.all(received);
        expect(room.objectById[NPC_ID].metadata[ObjectMetadataKeyEnumMap.Facing].str).toBe("270");
    });
});

describe("a dollar bill collected, in a browser", () => {
    const BILL_TYPE_INDEX = ObjectTypeConfigMap.getIndexByType(DollarBillObjectTypeConfig.objectType);
    const DOLLAR = InventoryItemTypeEnumMap.Dollar;
    const SOMEONE_ELSE = "someone-else";
    const FRAME = 1 / 60;
    const ABSORB_FRAMES = Math.round(ABSORB_SECONDS / FRAME);
    const EYES: Vec3 = {x: 10, y: 2, z: 20};
    // Where the bill makes for, the page in a test having no count on it.
    const COUNT = COUNT_CORNER;
    const QUAD_CORNERS = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];

    const camera = GraphicsManager.getCamera() as THREE.PerspectiveCamera;
    // What the bill draws itself with: each instance it holds, by mesh, and the matrix it last wrote of it.
    let drawn: Map<string, THREE.Matrix4>;
    let nextInstanceId: number;
    let plusShownFor: AddObjectSignal[];
    let gains: string[];
    let somebody: GameObject;

    beforeEach(() => {
        drawn = new Map();
        nextInstanceId = 0;
        plusShownFor = [];
        gains = [];
        somebody = {obj: new THREE.Object3D()} as unknown as GameObject;
        vi.stubGlobal("document", {getElementById: () => null});
        vi.spyOn(ClientObjectManager, "getPlayerOfUser").mockReturnValue(somebody);
        vi.spyOn(InstancedMeshGraphics, "loadInstancedMesh").mockResolvedValue(undefined as never);
        vi.spyOn(MeshFactory, "stopRaycasting").mockImplementation(() => {});
        vi.spyOn(InstancedMeshGraphics.prototype, "updateInstanceTextureRect").mockImplementation(() => {});
        vi.spyOn(InstancedMeshGraphics.prototype, "rentInstanceFromPool").mockImplementation((meshId: string) => {
            drawn.set(`${meshId}#${nextInstanceId}`, new THREE.Matrix4());
            return nextInstanceId++;
        });
        vi.spyOn(InstancedMeshGraphics.prototype, "returnInstanceToPool").mockImplementation(
            (meshId: string, instanceId: number) => { drawn.delete(`${meshId}#${instanceId}`); });
        vi.spyOn(InstancedMeshGraphics.prototype, "updateInstanceMatrix").mockImplementation(
            (meshId: string, instanceId: number, matrix: THREE.Matrix4) => { drawn.set(`${meshId}#${instanceId}`, matrix.clone()); });

        camera.position.set(EYES.x, EYES.y, EYES.z);
        camera.lookAt(EYES.x, EYES.y, 0);
        camera.updateWorldMatrix(true, false);
        objectCollectedObservable.addListener("test", object => { plusShownFor.push(object); });
        inventoryGainObservable.addListener("test", item => { gains.push(item); });
    });

    afterEach(() => {
        DollarBillGameObject.landFlying();
        objectCollectedObservable.removeListener("test");
        inventoryGainObservable.removeListener("test");
        inventoryObservable.set({});
        dollarsInFlightObservable.set(0);
        vi.unstubAllGlobals();
    });

    async function spawnBill(objectId: string, pos: Vec3): Promise<DollarBillGameObject>
    {
        const bill = new DollarBillGameObject(new AddObjectSignal(ROOM_ID, "", "", BILL_TYPE_INDEX, objectId,
            transformTo(pos), {}));
        await bill.onSpawn();
        // Until it has unfolded and settled.
        bill.update(0.5);
        bill.update(0.5);
        return bill;
    }

    async function collect(bill: DollarBillGameObject, collectorUserID: string): Promise<void>
    {
        vi.spyOn(ClientObjectManager, "getObjectById").mockReturnValue(bill);
        await ClientObjectManager.onObjectCollectedSignalReceived(new ObjectCollectedSignal(ROOM_ID, bill.params.objectId,
            collectorUserID));
        await bill.onDespawn();
    }

    function runFrames(numFrames: number): void
    {
        for (let i = 0; i < numFrames; ++i)
            DollarBillGameObject.updateFlying(FRAME);
    }

    function meshesDrawnOn(): Set<string>
    {
        return new Set([...drawn.keys()].map(key => key.split("#")[0]));
    }

    function cornersOnScreen(): THREE.Vector3[]
    {
        return [...drawn.values()].flatMap(matrix => QUAD_CORNERS.map(([x, y]) =>
            new THREE.Vector3(x, y, 0).applyMatrix4(matrix).project(camera)));
    }

    function middleOnScreen(): {x: number, y: number}
    {
        const corners = cornersOnScreen();
        return {x: corners.reduce((sum, {x}) => sum + x, 0) / corners.length,
            y: corners.reduce((sum, {y}) => sum + y, 0) / corners.length};
    }

    it("sets off to the count of whoever collected it looking just as it did where it lay, however it lay", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({min: 34, max: 50}), fc.integer({min: -30, max: 30}), fc.integer({min: 0, max: 1000}),
            async (ahead, aside, id) => {
            const bill = await spawnBill(`bill-${id}`, {x: EYES.x + aside / 10, y: 0.2, z: EYES.z - ahead / 10});
            const lying = cornersOnScreen();
            const roomMesh = meshesDrawnOn();

            await collect(bill, user.id);
            DollarBillGameObject.updateFlying(0);

            const flying = cornersOnScreen();
            expect(flying).toHaveLength(lying.length);
            flying.forEach((corner, i) => {
                expect(corner.x).toBeCloseTo(lying[i].x, 5);
                expect(corner.y).toBeCloseTo(lying[i].y, 5);
            });
            expect([...meshesDrawnOn()].some(mesh => roomMesh.has(mesh))).toBe(false);
            DollarBillGameObject.landFlying();
        }), {numRuns: 40});
    });

    it("sets off the same in the middle of a gust", async () => {
        const bill = await spawnBill("a-bill", {x: 10, y: 0.2, z: 16});
        bill.followPath([{pos: {x: 10, y: 0.2, z: 16}, speed: 2}, {pos: {x: 12, y: 1, z: 16}, speed: 2}]);
        for (let i = 0; i < 10; ++i)
            bill.update(FRAME);
        const inTheAir = cornersOnScreen();

        await collect(bill, user.id);
        DollarBillGameObject.updateFlying(0);

        cornersOnScreen().forEach((corner, i) => {
            expect(corner.x).toBeCloseTo(inTheAir[i].x, 5);
            expect(corner.y).toBeCloseTo(inTheAir[i].y, 5);
        });
    });

    it("flies straight to the count, nearer every frame and past no body, and counts only as it arrives", async () => {
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 3}));
        const bill = await spawnBill("a-bill", {x: 11, y: 0.2, z: 16});

        await collect(bill, user.id);
        expect(ClientInventoryManager.getDollarsShown()).toBe(2);

        let farthest = Number.POSITIVE_INFINITY, frames = 0;
        for (; drawn.size > 0 && frames < 200; ++frames)
        {
            runFrames(1);
            if (drawn.size == 0)
                break;
            const {x, y} = middleOnScreen();
            const away = Math.hypot(x - COUNT.x, y - COUNT.y);
            expect(away).toBeLessThan(farthest);
            farthest = away;
            expect(gains).toEqual([]);
        }
        expect(farthest).toBeLessThan(0.1);
        // No longer than the flight takes, give or take a frame.
        expect(frames * FRAME).toBeLessThan(COUNT_FLIGHT_SECONDS + FRAME);
        expect(ClientInventoryManager.getDollarsShown()).toBe(3);
        expect(gains).toEqual([DOLLAR]);
        expect(plusShownFor).toEqual([]);
    });

    it("comes in over the edge of the screen from under the view, one at the user's feet not being in it", async () => {
        const bill = await spawnBill("a-bill", {x: EYES.x, y: 0.2, z: EYES.z - 1});
        await collect(bill, user.id);
        runFrames(1);
        const {x, y} = middleOnScreen();
        expect(y).toBeLessThan(-1);
        expect(Math.abs(x)).toBeLessThan(0.1);
    });

    it("is drawn into the body of anyone else who collects it, wherever they have gone, and says what it was worth there", async () => {
        somebody.obj.position.set(13, 1.25, 16);
        const bill = await spawnBill("a-bill", {x: 10, y: 0.2, z: 12});
        const roomMesh = meshesDrawnOn();

        await collect(bill, SOMEONE_ELSE);
        expect(dollarsInFlightObservable.peek()).toBe(0);
        // Two thirds of the way in, and then twice that long.
        const partway = Math.floor(2 * ABSORB_FRAMES / 3);
        for (let i = 0; i < partway; ++i)
        {
            somebody.obj.position.x -= 0.05;
            runFrames(1);
        }
        expect(meshesDrawnOn()).toEqual(roomMesh);
        expect(plusShownFor).toEqual([]);

        runFrames(partway);
        expect(plusShownFor).toHaveLength(1);
        expect(plusShownFor[0].transform.pos).toEqual({x: somebody.obj.position.x, y: somebody.obj.position.y, z: somebody.obj.position.z});
        expect(drawn.size).toBe(0);
        expect(gains).toEqual([]);
        expect(dollarsInFlightObservable.peek()).toBe(0);
    });

    it("shrinks away where it was if nobody knows who took it", async () => {
        vi.spyOn(ClientObjectManager, "getPlayerOfUser").mockReturnValue(undefined);
        const bill = await spawnBill("a-bill", {x: 10, y: 0.2, z: 12});
        await collect(bill, SOMEONE_ELSE);
        runFrames(Math.ceil(4 * ABSORB_FRAMES / 3));
        expect(plusShownFor).toHaveLength(1);
        expect(plusShownFor[0].transform.pos).toMatchObject({x: 10, z: 12});
        expect(drawn.size).toBe(0);
    });

    it("arrives at once as the room is left, while one on its way to someone else just goes", async () => {
        ClientInventoryManager.onInventorySignalReceived(new InventorySignal({[DOLLAR]: 1}));
        await collect(await spawnBill("mine", {x: 11, y: 0.2, z: 16}), user.id);
        await collect(await spawnBill("theirs", {x: 12, y: 0.2, z: 16}), SOMEONE_ELSE);
        expect(drawn.size).toBe(4);

        DollarBillGameObject.landFlying();
        expect(drawn.size).toBe(0);
        expect(gains).toEqual([DOLLAR]);
        expect(ClientInventoryManager.getDollarsShown()).toBe(1);
        expect(plusShownFor).toEqual([]);
    });

    it("goes as soon as it is removed, if it was only destroyed", async () => {
        const bill = await spawnBill("a-bill", {x: 10, y: 0.2, z: 12});
        await bill.onDespawn();
        expect(drawn.size).toBe(0);
        runFrames(5);
        expect(plusShownFor).toEqual([]);
        expect(gains).toEqual([]);
    });
});

describe("what coming back has earned, in a browser", () => {
    const DOLLAR = InventoryItemTypeEnumMap.Dollar;
    const rewardText = (dollars: number) => `Welcome back!\nHere's your $${dollars}\ndaily reward.`;
    const MARK = {targetElementId: "dollarCounter", reward: true, text: rewardText(LOGIN_REWARD_DOLLARS)};
    const FEATURE_MARK = {ftueElementCode: FTUEElementCodeEnumMap.EnterEditMode, targetElementId: "gameModeToggleSwitch", text: "Try Editing"};
    let hidden: boolean;
    let onVisibilityChange: (() => void) | undefined;
    let stages: string[];

    const receive = () => LoginRewardUtil.onLoginRewardSignalReceived(new LoginRewardSignal(LOGIN_REWARD_DOLLARS));
    const marks = () => screenCoachMarksObservable.peek();

    beforeEach(() => {
        vi.useFakeTimers();
        hidden = false;
        onVisibilityChange = undefined;
        stages = [];
        vi.stubGlobal("document", {
            get hidden() { return hidden; },
            addEventListener: (_type: string, listener: () => void) => { onVisibilityChange = listener; },
            removeEventListener: () => { onVisibilityChange = undefined; },
        });
        inventoryObservable.set({[DOLLAR]: 3 + LOGIN_REWARD_DOLLARS});
        loginRewardStageObservable.addListener("test", stage => { stages.push(stage); });
    });

    afterEach(() => {
        vi.runAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        loginRewardStageObservable.removeListener("test");
        inventoryObservable.set({});
        dollarsInFlightObservable.set(0);
        screenCoachMarksObservable.set([]);
    });

    it("shows the count rising under a green mark a moment after it is told, and bouncing with it", () => {
        receive();
        expect(ClientInventoryManager.getDollarsShown()).toBe(3);

        vi.advanceTimersByTime(REWARD_SHOW_DELAY_MS - 1);
        expect(marks()).toEqual([]);
        expect(ClientInventoryManager.getDollarsShown()).toBe(3);
        expect(stages).toEqual(["waiting"]);

        vi.advanceTimersByTime(1);
        expect(marks()).toEqual([MARK]);
        expect(ClientInventoryManager.getDollarsShown()).toBe(3 + LOGIN_REWARD_DOLLARS);
        expect(stages).toEqual(["waiting", "shown"]);
    });

    it(`takes the mark away after ${REWARD_MARK_DURATION_MS / 1000} seconds, leaving any other`, () => {
        screenCoachMarksObservable.set([FEATURE_MARK]);
        receive();
        vi.advanceTimersByTime(REWARD_SHOW_DELAY_MS + REWARD_MARK_DURATION_MS - 1);
        expect(marks()).toEqual([FEATURE_MARK, MARK]);
        expect(stages[stages.length - 1]).toBe("shown");
        vi.advanceTimersByTime(1);
        expect(marks()).toEqual([FEATURE_MARK]);
        expect(stages[stages.length - 1]).toBe("none");
    });

    it("leaves the mark alone as a feature's mark goes, being no feature's", () => {
        receive();
        vi.advanceTimersByTime(REWARD_SHOW_DELAY_MS);
        screenCoachMarksObservable.change(coachMarks => coachMarks.filter(mark => mark.ftueElementCode != FEATURE_MARK.ftueElementCode));
        expect(marks()).toEqual([MARK]);
    });

    it("waits for a multiplayer room, there being no count on a single-player room's screen, however long that takes", () => {
        (App.getCurrentRoom as Mock).mockReturnValue({...room, roomType: RoomTypeEnumMap.SinglePlayer});
        receive();
        vi.advanceTimersByTime(60_000);
        expect(marks()).toEqual([]);
        expect(ClientInventoryManager.getDollarsShown()).toBe(3);

        (App.getCurrentRoom as Mock).mockReturnValue(room);
        roomChangedObservable.set({room} as any);
        vi.advanceTimersByTime(REWARD_SHOW_DELAY_MS);
        expect(marks()).toEqual([MARK]);
    });

    it("waits out the loading screen, which would hide it", () => {
        tryStartClientProcess("roomChange", 1, 0);
        receive();
        vi.advanceTimersByTime(60_000);
        expect(marks()).toEqual([]);

        endClientProcess("roomChange");
        vi.advanceTimersByTime(REWARD_SHOW_DELAY_MS);
        expect(marks()).toEqual([MARK]);
    });

    it("waits for a hidden page to be looked at", () => {
        hidden = true;
        receive();
        vi.advanceTimersByTime(60_000);
        expect(marks()).toEqual([]);

        hidden = false;
        onVisibilityChange!();
        vi.advanceTimersByTime(REWARD_SHOW_DELAY_MS);
        expect(marks()).toEqual([MARK]);
        expect(onVisibilityChange).toBeUndefined();
    });

    it("shows two told while it waits as one, without listening twice", () => {
        inventoryObservable.set({[DOLLAR]: 3 + 2 * LOGIN_REWARD_DOLLARS});
        hidden = true;
        receive();
        receive();
        expect(ClientInventoryManager.getDollarsShown()).toBe(3);

        hidden = false;
        onVisibilityChange!();
        vi.advanceTimersByTime(REWARD_SHOW_DELAY_MS);
        expect(stages.filter(stage => stage == "shown")).toHaveLength(1);
        expect(marks().map(mark => mark.text)).toEqual([rewardText(2 * LOGIN_REWARD_DOLLARS)]);
    });

    it("can be told again after being shown", () => {
        receive();
        vi.advanceTimersByTime(REWARD_SHOW_DELAY_MS + REWARD_MARK_DURATION_MS);
        inventoryObservable.set({[DOLLAR]: 3 + 2 * LOGIN_REWARD_DOLLARS});
        receive();
        vi.advanceTimersByTime(REWARD_SHOW_DELAY_MS);
        expect(stages.filter(stage => stage == "shown")).toHaveLength(2);
        expect(ClientInventoryManager.getDollarsShown()).toBe(3 + 2 * LOGIN_REWARD_DOLLARS);
    });
});
