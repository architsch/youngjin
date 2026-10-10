/**
 * Scenario tests: the room settings' plan of restricted zones (see RestrictedZonePlanUtil), and volumes showing
 * only when asked for (see volumesShownObservable). Covers: a zone added from the plan (a volume in the middle of
 * the room, from floor to ceiling, kept for nobody, sent to the server), refused once the room holds as many
 * volumes as it may and to who may lay none; a zone laid over other rows and columns keeping its layers and its
 * user; a drag that ends where it began sending nothing; a zone removed; only a zone being the plan's to move or
 * remove; none of it entered in the undo history; a single-player room sending nothing; a drag's arithmetic (a
 * zone moved whole and held at the room's edges, a handle's edges stopped by the opposite ones and by the room's);
 * and a volume being selectable only while volumes are shown, the selection leaving one as they are hidden.
 * Browser-bound client modules are stubbed; the room, the rules, the managers and the selection run for real.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import fc from "fast-check";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000);
    const scene = new THREE.Scene();
    const canvas = {style: {cursor: ""}, clientHeight: 600,
        getBoundingClientRect: () => ({left: 0, top: 0, width: 800, height: 600})};
    // Voxel edits invalidate the light map (see LightBlockMap); a stub suffices.
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {},
        getNearbyLightAt(_worldPos: unknown, out: any) { return out.setRGB(0, 0, 0); } };
    return { default: { getCamera: () => camera, getScene: () => scene, getGameCanvas: () => canvas,
        getGameRenderer: () => ({getSize: (out: any) => out.set(800, 600)}),
        getLightBlockMap: () => lightBlockMap,
        setViewReferenceOffset: () => {}, setPointLightSurroundings: () => {},
        setRoomLightingPrefs: () => {} } };
});

vi.mock("../../../src/client/app", () => ({
    default: {
        getCurrentRoom: vi.fn(),
        getVoxelQuads: vi.fn(),
        getUser: vi.fn(),
        getEnv: vi.fn(),
    },
}));

vi.mock("../../../src/client/graphics/types/gizmo/generic/worldSpaceOutlineRect", () => ({
    default: class WorldSpaceOutlineRectStub
    {
        static async create() { return new WorldSpaceOutlineRectStub(); }
        static getEdgeOffset(size: number) { return 0.5 * size + 0.08; }
        addToParent() {}
        setTransform() {}
        setTransformRaw() {}
        setVisible() {}
        setColor() {}
        isVisible() { return true; }
        dispose() {}
    },
}));

// What an edit sends the server; watched to see what each of the plan's comes to.
vi.mock("../../../src/client/networking/client/socketsClient", () => ({
    default: {
        emitAddVoxelBlockSignal: vi.fn(),
        emitRemoveVoxelBlockSignal: vi.fn(),
        emitSetVoxelQuadTextureSignal: vi.fn(),
        emitAddObjectSignal: vi.fn(),
        emitRemoveObjectSignal: vi.fn(),
        emitSetObjectTransformSignal: vi.fn(),
        emitSetObjectMetadataSignal: vi.fn(),
    },
}));

import * as THREE from "three";
import App from "../../../src/client/app";
// The real configs and gizmos of a volume, which say when one may be selected and what hiding them does (and the
// config of the other type selected here, which a selection reads).
import "../../../src/client/object/types/objectTypeClientConfig/canvasObjectTypeClientConfig";
import "../../../src/client/object/types/objectTypeClientConfig/volumeObjectTypeClientConfig";
import "../../../src/client/graphics/types/gizmo/volumeEditGizmos";
import ObjectSelection from "../../../src/client/graphics/types/gizmo/objectSelection";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import ObjectFactory from "../../../src/client/object/factories/objectFactory";
import SocketsClient from "../../../src/client/networking/client/socketsClient";
import ClientEventHistoryUtil from "../../../src/client/system/util/clientEventHistoryUtil";
import RestrictedZonePlanUtil from "../../../src/client/ui/util/restrictedZonePlanUtil";
import { ZoneHandle } from "../../../src/client/ui/types/zoneHandle";
import { gameModeObservable, objectSelectionObservable, volumesShownObservable,
    voxelQuadSelectionObservable } from "../../../src/client/system/clientObservables";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_COLS, NUM_VOXEL_ROWS,
    ROOM_EDITOR_SINGLE_PLAYER_MODE, ZONE_USER_NAME_FOR_NOBODY } from "../../../src/shared/system/sharedConstants";
import Vec3 from "../../../src/shared/math/types/vec3";
import ObjectCategoryConfigMap from "../../../src/shared/object/maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import VolumeObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import Room from "../../../src/shared/room/types/room";
import RoomVolume from "../../../src/shared/room/types/roomVolume";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import RestrictedZoneUtil from "../../../src/shared/voxel/util/restrictedZoneUtil";
import { createEditingUser, createMockUser } from "../helpers/mockUser";
import { makeZoneSignal, zoneTransform, ZoneBlocks } from "../helpers/restrictedZone";
import { buildPillar, createRoom, forceSelect, quadIndexOf } from "../helpers/selectionHarness";

// The acting user unless a scenario says otherwise: an admin, who is a hub's superuser.
const ADMIN = createEditingUser();
const MEMBER = createEditingUser(UserTypeEnumMap.Member);

const ROOM_ID = "plan-room";
const REGULAR_ROOM_ID = "plan-regular-room";
const OWNER = createMockUser({userType: UserTypeEnumMap.Member, ownedRoomID: REGULAR_ROOM_ID}).user;

const volumeTypeIndex = ObjectTypeConfigMap.getIndexByType("Volume");
const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const FULL_HEIGHT = {collisionLayerMin: COLLISION_LAYER_MIN, collisionLayerMax: COLLISION_LAYER_MAX};

// Whether volumes show as the game starts, read before anything here says otherwise.
const SHOWN_AT_START = volumesShownObservable.peek();

let room: Room;
let numObjects = 0;

function useRoom(newRoom: Room): void
{
    room = newRoom;
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
}

function actAs(user: typeof ADMIN): void
{
    (App.getUser as Mock).mockReturnValue(user);
}

// The game object the client would make of a signal, as far as the manager and the selection look at one. Whether
// it may be selected is asked of its type's real rule.
function fakeGameObject(params: AddObjectSignal): GameObject
{
    const position = new THREE.Vector3(params.transform.pos.x, params.transform.pos.y, params.transform.pos.z);
    return {
        params,
        position,
        quaternion: new THREE.Quaternion(),
        obj: {scale: new THREE.Vector3(1, 1, 1)},
        components: {},
        update: GameObject.prototype.update,
        setObjectTransform: (to: Vec3) => { position.set(to.x, to.y, to.z); },
        onSetMetadata: () => {},
        onSpawn: async () => {},
        onDespawn: async () => {},
        canBeSelected: GameObject.prototype.canBeSelected,
        trySelect: GameObject.prototype.trySelect,
    } as unknown as GameObject;
}

// Stands a volume in the room as a room's arrival would: nothing is checked, sent or entered in the history. Kept
// for a user, it is a zone.
async function standVolume(blocks: ZoneBlocks, userName?: string): Promise<string>
{
    const objectId = `volume-${++numObjects}`;
    const signal = (userName == undefined)
        ? new AddObjectSignal(room.id, "", "", volumeTypeIndex, objectId, zoneTransform(blocks), {})
        : makeZoneSignal(room, blocks, userName, objectId);
    expect(await ClientObjectManager.addObject(fakeGameObject(signal), false)).toBe(true);
    return objectId;
}

function blocksOf(objectId: string): ZoneBlocks
{
    return {...VolumeObjectTypeConfig.util.getRoomVolume(room.objectById[objectId].transform)};
}

function userNameOf(objectId: string): string
{
    return VolumeObjectTypeConfig.util.getZoneUserName(room.objectById[objectId]);
}

const rounded = (v: Vec3) => [v.x, v.y, v.z].map(n => Math.round(n * 1000) / 1000);

// The signals sent since the last time this was asked, in the order sent, as [kind, ...what they say].
function sentSignals(): unknown[][]
{
    const sent: {order: number, entry: unknown[]}[] = [];
    const collect = (emit: unknown, describe: (signal: any) => unknown[]) => {
        const mock = (emit as Mock).mock;
        mock.calls.forEach(([signal], i) => sent.push({order: mock.invocationCallOrder[i], entry: describe(signal)}));
        (emit as Mock).mockClear();
    };
    collect(SocketsClient.emitAddObjectSignal, signal => ["addObject", signal.objectId, signal.sourceUserID]);
    collect(SocketsClient.emitRemoveObjectSignal, signal => ["removeObject", signal.objectId]);
    collect(SocketsClient.emitSetObjectTransformSignal, signal => ["transform", signal.objectId,
        rounded(signal.transform.pos), rounded(signal.transform.scale), signal.ignorePhysics]);
    collect(SocketsClient.emitSetObjectMetadataSignal, signal => ["metadata", signal.objectId]);
    return sent.sort((a, b) => a.order - b.order).map(({entry}) => entry);
}

// A transform as a sent signal is described.
function sentTransform(objectId: string, blocks: ZoneBlocks): unknown[]
{
    const transform = zoneTransform(blocks);
    return ["transform", objectId, rounded(transform.pos), rounded(transform.scale), true];
}

// Lets what a selection sets going come to rest: each kind's listener may wait a tick (see ObjectSelection).
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    gameModeObservable.set("play");
    voxelQuadSelectionObservable.set(null);
    objectSelectionObservable.set(null);
    volumesShownObservable.set(false);
    ClientEventHistoryUtil.clear();

    actAs(ADMIN);
    useRoom(createRoom(ROOM_ID));
    vi.spyOn(ObjectFactory, "createServerSideObject").mockImplementation(fakeGameObject);
    sentSignals();
});

afterEach(async () => {
    await settle();
    volumesShownObservable.set(false);
    vi.restoreAllMocks();
});

// ─── Zones drawn on the plan ────────────────────────────────────────────────

describe("a zone added from the plan", () => {
    it("is a volume in the middle of the room, from its floor to its ceiling, kept for nobody, and is sent", async () => {
        expect(RestrictedZonePlanUtil.canAddZone(room)).toBe(true);
        const objectId = await RestrictedZonePlanUtil.addZone(room);

        expect(objectId).not.toBeNull();
        expect(RestrictedZoneUtil.getZones(room).map(zone => zone.objectId)).toEqual([objectId]);
        expect(userNameOf(objectId!)).toBe(ZONE_USER_NAME_FOR_NOBODY);
        expect(blocksOf(objectId!)).toEqual({rowMin: NUM_VOXEL_ROWS / 2 - 6, rowMax: NUM_VOXEL_ROWS / 2 + 5,
            colMin: NUM_VOXEL_COLS / 2 - 6, colMax: NUM_VOXEL_COLS / 2 + 5, ...FULL_HEIGHT});
        expect(ClientObjectManager.getObjectById(objectId!)).toBeDefined();
        expect(sentSignals()).toEqual([["addObject", objectId, ADMIN.id]]);

        // It holds against everybody but the superuser, at any height.
        const [row, col] = [NUM_VOXEL_ROWS / 2, NUM_VOXEL_COLS / 2];
        for (const layer of [COLLISION_LAYER_MIN, COLLISION_LAYER_MAX])
        {
            expect(RestrictedZoneUtil.blocksVoxelBlockEdit(MEMBER, room, row, col, layer)).toBe(true);
            expect(RestrictedZoneUtil.blocksVoxelBlockEdit(ADMIN, room, row, col, layer)).toBe(false);
        }
        expect(RestrictedZoneUtil.blocksVoxelBlockEdit(MEMBER, room, row + 6, col, COLLISION_LAYER_MIN)).toBe(false);
    });

    it("comes with an id of its own each time", async () => {
        const first = await RestrictedZonePlanUtil.addZone(room);
        const second = await RestrictedZonePlanUtil.addZone(room);
        expect(first).not.toBeNull();
        expect(second).not.toBeNull();
        expect(second).not.toBe(first);
        expect(RestrictedZoneUtil.getZones(room)).toHaveLength(2);
    });

    it("is refused once the room holds as many volumes as it may, whether or not they are zones", async () => {
        const cap = ObjectCategoryConfigMap.getMaxCountPerRoom("Volume");
        for (let i = 0; i < cap - 1; ++i)
            await standVolume({rowMin: 4, rowMax: 5, colMin: 4, colMax: 5}, (i % 2 == 0) ? undefined : "Somebody");
        expect(RestrictedZonePlanUtil.canAddZone(room)).toBe(true);

        await standVolume({rowMin: 4, rowMax: 5, colMin: 4, colMax: 5});
        const numZones = RestrictedZoneUtil.getZones(room).length;
        expect(RestrictedZonePlanUtil.canAddZone(room)).toBe(false);
        expect(await RestrictedZonePlanUtil.addZone(room)).toBeNull();
        expect(RestrictedZoneUtil.getZones(room)).toHaveLength(numZones);
        expect(sentSignals()).toEqual([]);
    });

    it("is the room's superuser's to add: a hub's admin, and an owner in their own room", async () => {
        actAs(MEMBER);
        expect(RestrictedZonePlanUtil.canAddZone(room)).toBe(false);
        expect(await RestrictedZonePlanUtil.addZone(room)).toBeNull();
        expect(RestrictedZoneUtil.getZones(room)).toEqual([]);
        expect(sentSignals()).toEqual([]);

        useRoom(createRoom(REGULAR_ROOM_ID, RoomTypeEnumMap.Regular));
        expect(RestrictedZonePlanUtil.canAddZone(room)).toBe(false);
        actAs(OWNER);
        expect(RestrictedZonePlanUtil.canAddZone(room)).toBe(true);
        const objectId = await RestrictedZonePlanUtil.addZone(room);
        expect(objectId).not.toBeNull();
        expect(sentSignals()).toEqual([["addObject", objectId, OWNER.id]]);
    });
});

describe("a zone laid over other blocks from the plan", () => {
    const BLOCKS = {rowMin: 10, rowMax: 14, colMin: 20, colMax: 29, collisionLayerMin: 2, collisionLayerMax: 5};

    it("takes the rows and columns it is given, keeping its layers and its user, and is sent", async () => {
        const objectId = await standVolume(BLOCKS, "Somebody");
        const moved = {...BLOCKS, rowMin: 30, rowMax: 33, colMin: 2, colMax: 8};

        expect(await RestrictedZonePlanUtil.setZoneBlocks(room, objectId, new RoomVolume(moved.rowMin, moved.rowMax,
            moved.colMin, moved.colMax, moved.collisionLayerMin, moved.collisionLayerMax))).toBe(true);
        expect(blocksOf(objectId)).toEqual(moved);
        expect(userNameOf(objectId)).toBe("Somebody");
        expect(sentSignals()).toEqual([sentTransform(objectId, moved)]);
        // The client's own object goes with it.
        expect(rounded(ClientObjectManager.getObjectById(objectId)!.position)).toEqual(rounded(zoneTransform(moved).pos));
    });

    it("reaches the room's edges", async () => {
        const objectId = await standVolume({rowMin: 10, rowMax: 14, colMin: 20, colMax: 29}, ZONE_USER_NAME_FOR_NOBODY);
        const whole = {rowMin: 0, rowMax: NUM_VOXEL_ROWS - 1, colMin: 0, colMax: NUM_VOXEL_COLS - 1, ...FULL_HEIGHT};
        expect(await RestrictedZonePlanUtil.setZoneBlocks(room, objectId, new RoomVolume(whole.rowMin, whole.rowMax,
            whole.colMin, whole.colMax, whole.collisionLayerMin, whole.collisionLayerMax))).toBe(true);
        expect(blocksOf(objectId)).toEqual(whole);
        expect(sentSignals()).toEqual([sentTransform(objectId, whole)]);
    });

    it("sends nothing where it lies there already", async () => {
        const objectId = await standVolume(BLOCKS, ZONE_USER_NAME_FOR_NOBODY);
        expect(await RestrictedZonePlanUtil.setZoneBlocks(room, objectId, new RoomVolume(BLOCKS.rowMin, BLOCKS.rowMax,
            BLOCKS.colMin, BLOCKS.colMax, BLOCKS.collisionLayerMin, BLOCKS.collisionLayerMax))).toBe(true);
        expect(blocksOf(objectId)).toEqual(BLOCKS);
        expect(sentSignals()).toEqual([]);
    });

    it("is refused for what is no zone, and to who may edit no volume", async () => {
        const elsewhere = new RoomVolume(40, 44, 40, 44, BLOCKS.collisionLayerMin, BLOCKS.collisionLayerMax);
        const plainVolume = await standVolume(BLOCKS);
        expect(await RestrictedZonePlanUtil.setZoneBlocks(room, plainVolume, elsewhere)).toBe(false);
        expect(await RestrictedZonePlanUtil.removeZone(room, plainVolume)).toBe(false);
        expect(await RestrictedZonePlanUtil.setZoneBlocks(room, "nothing-by-this-id", elsewhere)).toBe(false);
        expect(await RestrictedZonePlanUtil.removeZone(room, "nothing-by-this-id")).toBe(false);
        expect(blocksOf(plainVolume)).toEqual(BLOCKS);

        const zone = await standVolume(BLOCKS, "Somebody");
        actAs(MEMBER);
        expect(await RestrictedZonePlanUtil.setZoneBlocks(room, zone, elsewhere)).toBe(false);
        expect(await RestrictedZonePlanUtil.removeZone(room, zone)).toBe(false);
        expect(blocksOf(zone)).toEqual(BLOCKS);
        expect(sentSignals()).toEqual([]);
    });
});

describe("a zone removed from the plan", () => {
    it("leaves the room, and is sent", async () => {
        const kept = await standVolume({rowMin: 2, rowMax: 5, colMin: 2, colMax: 5}, "Somebody");
        const objectId = await standVolume({rowMin: 10, rowMax: 14, colMin: 20, colMax: 29}, ZONE_USER_NAME_FOR_NOBODY);

        expect(await RestrictedZonePlanUtil.removeZone(room, objectId)).toBe(true);
        expect(room.objectById[objectId]).toBeUndefined();
        expect(ClientObjectManager.getObjectById(objectId)).toBeUndefined();
        expect(RestrictedZoneUtil.getZones(room).map(zone => zone.objectId)).toEqual([kept]);
        expect(sentSignals()).toEqual([["removeObject", objectId]]);
        expect(RestrictedZoneUtil.blocksVoxelBlockEdit(MEMBER, room, 12, 24, COLLISION_LAYER_MIN)).toBe(false);
    });

    it("lets go of the selection where its volume was selected", async () => {
        gameModeObservable.set("edit");
        volumesShownObservable.set(true);
        const objectId = await standVolume({rowMin: 10, rowMax: 14, colMin: 20, colMax: 29}, ZONE_USER_NAME_FOR_NOBODY);
        expect(ClientObjectManager.getObjectById(objectId)!.trySelect(-1)).toBe(true);
        await settle();

        expect(await RestrictedZonePlanUtil.removeZone(room, objectId)).toBe(true);
        expect(objectSelectionObservable.peek()).toBeNull();
    });
});

describe("the plan's edits", () => {
    it("enter nothing in the undo history", async () => {
        gameModeObservable.set("edit");
        const objectId = await RestrictedZonePlanUtil.addZone(room);
        expect(await ClientEventHistoryUtil.undo()).toBe("none");

        expect(await RestrictedZonePlanUtil.setZoneBlocks(room, objectId!,
            new RoomVolume(2, 9, 2, 9, COLLISION_LAYER_MIN, COLLISION_LAYER_MAX))).toBe(true);
        expect(await ClientEventHistoryUtil.undo()).toBe("none");
        expect(blocksOf(objectId!)).toEqual({rowMin: 2, rowMax: 9, colMin: 2, colMax: 9, ...FULL_HEIGHT});

        expect(await RestrictedZonePlanUtil.removeZone(room, objectId!)).toBe(true);
        expect(await ClientEventHistoryUtil.undo()).toBe("none");
        expect(room.objectById[objectId!]).toBeUndefined();
    });

    it("are sent nowhere from a single-player room, which has no server", async () => {
        room.roomType = RoomTypeEnumMap.SinglePlayer;
        room.roomName = ROOM_EDITOR_SINGLE_PLAYER_MODE;

        const objectId = await RestrictedZonePlanUtil.addZone(room);
        expect(objectId).not.toBeNull();
        expect(await RestrictedZonePlanUtil.setZoneBlocks(room, objectId!,
            new RoomVolume(2, 9, 2, 9, COLLISION_LAYER_MIN, COLLISION_LAYER_MAX))).toBe(true);
        expect(blocksOf(objectId!)).toEqual({rowMin: 2, rowMax: 9, colMin: 2, colMax: 9, ...FULL_HEIGHT});
        expect(await RestrictedZonePlanUtil.removeZone(room, objectId!)).toBe(true);
        expect(RestrictedZoneUtil.getZones(room)).toEqual([]);
        expect(sentSignals()).toEqual([]);
    });
});

// ─── A drag on the plan ─────────────────────────────────────────────────────

describe("a drag on the plan", () => {
    const LAST_ROW = NUM_VOXEL_ROWS - 1;
    const LAST_COL = NUM_VOXEL_COLS - 1;
    const drag = (blocks: number[], handle: ZoneHandle | "body", rowDelta: number, colDelta: number) => {
        const dragged = RestrictedZonePlanUtil.applyDrag(new RoomVolume(blocks[0], blocks[1], blocks[2], blocks[3], 2, 5),
            handle, rowDelta, colDelta);
        expect([dragged.collisionLayerMin, dragged.collisionLayerMax], "a drag changed the zone's height").toEqual([2, 5]);
        return [dragged.rowMin, dragged.rowMax, dragged.colMin, dragged.colMax];
    };

    it("moves a zone whole by its body, and holds it at the room's edges at the size it has", () => {
        expect(drag([10, 14, 20, 29], "body", 3, -4)).toEqual([13, 17, 16, 25]);
        expect(drag([10, 14, 20, 29], "body", 0, 0)).toEqual([10, 14, 20, 29]);
        expect(drag([10, 14, 20, 29], "body", -100, -100)).toEqual([0, 4, 0, 9]);
        expect(drag([10, 14, 20, 29], "body", 100, 100)).toEqual([LAST_ROW - 4, LAST_ROW, LAST_COL - 9, LAST_COL]);
        // Held one way, it still goes the other.
        expect(drag([10, 14, 20, 29], "body", -100, 2)).toEqual([0, 4, 22, 31]);
    });

    it("moves the edges a handle is on, and no others", () => {
        const from = [10, 14, 20, 29];
        expect(drag(from, "n", -3, 7)).toEqual([7, 14, 20, 29]);
        expect(drag(from, "s", 3, 7)).toEqual([10, 17, 20, 29]);
        expect(drag(from, "w", 7, -3)).toEqual([10, 14, 17, 29]);
        expect(drag(from, "e", 7, 3)).toEqual([10, 14, 20, 32]);
        expect(drag(from, "nw", -3, -2)).toEqual([7, 14, 18, 29]);
        expect(drag(from, "ne", -3, 2)).toEqual([7, 14, 20, 31]);
        expect(drag(from, "sw", 3, -2)).toEqual([10, 17, 18, 29]);
        expect(drag(from, "se", 3, 2)).toEqual([10, 17, 20, 31]);
    });

    it("stops an edge at the one across from it, a voxel wide, and at the room's edge", () => {
        const from = [10, 14, 20, 29];
        expect(drag(from, "n", 100, 0)).toEqual([14, 14, 20, 29]);
        expect(drag(from, "s", -100, 0)).toEqual([10, 10, 20, 29]);
        expect(drag(from, "w", 0, 100)).toEqual([10, 14, 29, 29]);
        expect(drag(from, "e", 0, -100)).toEqual([10, 14, 20, 20]);
        expect(drag(from, "nw", -100, -100)).toEqual([0, 14, 0, 29]);
        expect(drag(from, "se", 100, 100)).toEqual([10, LAST_ROW, 20, LAST_COL]);
    });

    it("leaves a zone inside the room and no thinner than a voxel, whatever the drag", () => {
        const span = (count: number) => fc.tuple(fc.integer({min: 0, max: count - 1}), fc.integer({min: 0, max: count - 1}))
            .map(([a, b]) => [Math.min(a, b), Math.max(a, b)]);
        const handle = fc.constantFrom<ZoneHandle | "body">("body", "nw", "n", "ne", "w", "e", "sw", "s", "se");
        const delta = fc.integer({min: -2 * NUM_VOXEL_ROWS, max: 2 * NUM_VOXEL_ROWS});
        fc.assert(fc.property(span(NUM_VOXEL_ROWS), span(NUM_VOXEL_COLS), handle, delta, delta,
            (rows, cols, held, rowDelta, colDelta) => {
                const [rowMin, rowMax, colMin, colMax] = drag([...rows, ...cols], held, rowDelta, colDelta);
                expect(rowMin).toBeGreaterThanOrEqual(0);
                expect(rowMax).toBeLessThanOrEqual(LAST_ROW);
                expect(rowMin).toBeLessThanOrEqual(rowMax);
                expect(colMin).toBeGreaterThanOrEqual(0);
                expect(colMax).toBeLessThanOrEqual(LAST_COL);
                expect(colMin).toBeLessThanOrEqual(colMax);
                if (held == "body")
                    expect([rowMax - rowMin, colMax - colMin]).toEqual([rows[1] - rows[0], cols[1] - cols[0]]);
            }));
    });
});

// ─── Volumes shown only when asked for ──────────────────────────────────────

describe("a volume, while volumes are hidden or shown", () => {
    const BLOCKS = {rowMin: 10, rowMax: 12, colMin: 4, colMax: 6, collisionLayerMin: 0, collisionLayerMax: 3};

    beforeEach(() => {
        gameModeObservable.set("edit");
    });

    it("can be selected only while they are shown, which they are not until asked for, and then only by who may edit it", async () => {
        expect(SHOWN_AT_START).toBe(false);
        const volume = ClientObjectManager.getObjectById(await standVolume(BLOCKS, ZONE_USER_NAME_FOR_NOBODY))!;
        expect(volume.canBeSelected()).toBe(false);
        expect(volume.trySelect(-1)).toBe(false);
        expect(objectSelectionObservable.peek()).toBeNull();

        volumesShownObservable.set(true);
        expect(volume.canBeSelected()).toBe(true);
        actAs(MEMBER);
        expect(volume.canBeSelected()).toBe(false);
        actAs(ADMIN);
        gameModeObservable.set("play");
        expect(volume.canBeSelected()).toBe(false);
        gameModeObservable.set("edit");

        volumesShownObservable.set(false);
        expect(volume.canBeSelected()).toBe(false);
    });

    it("is an owner's to select in their own room, and an admin's there too", async () => {
        useRoom(createRoom(REGULAR_ROOM_ID, RoomTypeEnumMap.Regular));
        const volume = ClientObjectManager.getObjectById(await standVolume(BLOCKS))!;
        volumesShownObservable.set(true);
        for (const [user, selectable] of [[OWNER, true], [ADMIN, true], [MEMBER, false]] as const)
        {
            actAs(user);
            expect(volume.canBeSelected(), `${user.userName} (type ${user.userType})`).toBe(selectable);
        }
    });

    it("is let go of as they are hidden, for a face near it", async () => {
        buildPillar(room, 11, 5, 0, 3);
        const volume = ClientObjectManager.getObjectById(await standVolume(BLOCKS, ZONE_USER_NAME_FOR_NOBODY))!;
        volumesShownObservable.set(true);
        expect(volume.trySelect(-1)).toBe(true);
        await settle();
        expect(objectSelectionObservable.peek()?.gameObject).toBe(volume);

        // Asked for again, they are shown as they were.
        volumesShownObservable.set(true);
        await settle();
        expect(objectSelectionObservable.peek()?.gameObject).toBe(volume);

        volumesShownObservable.set(false);
        await settle();
        expect(objectSelectionObservable.peek()).toBeNull();
        const face = voxelQuadSelectionObservable.peek();
        expect(face, "nothing was selected in the volume's place").not.toBeNull();
        expect(Math.abs(face!.voxel.row - 11)).toBeLessThanOrEqual(2);
        expect(Math.abs(face!.voxel.col - 5)).toBeLessThanOrEqual(2);

        // Shown again, it is not selected again.
        volumesShownObservable.set(true);
        await settle();
        expect(objectSelectionObservable.peek()).toBeNull();
    });

    it("leaves a selected face as it is, shown or hidden", async () => {
        buildPillar(room, 11, 5, 0, 3);
        await standVolume(BLOCKS, ZONE_USER_NAME_FOR_NOBODY);
        const selection = forceSelect(room, quadIndexOf(11, 5, "x", "+", 2));
        const announced = vi.fn();
        voxelQuadSelectionObservable.addListener("restricted-zone-plan.test", announced);
        try
        {
            volumesShownObservable.set(true);
            volumesShownObservable.set(false);
            await settle();
            expect(voxelQuadSelectionObservable.peek()).toBe(selection);
            expect(announced).not.toHaveBeenCalled();
        }
        finally
        {
            voxelQuadSelectionObservable.removeListener("restricted-zone-plan.test");
        }
    });

    it("leaves another selected object as it is, shown or hidden", async () => {
        await standVolume(BLOCKS, ZONE_USER_NAME_FOR_NOBODY);
        const canvas = fakeGameObject(new AddObjectSignal(room.id, "", "", canvasTypeIndex, `canvas-${++numObjects}`,
            new ObjectTransform({x: 3, y: 1, z: 5.75}, {x: 1, y: 0, z: 0}, {x: 1, y: 1, z: 1}), {}));
        expect(await ClientObjectManager.addObject(canvas, false)).toBe(true);
        expect(ObjectSelection.trySelect(canvas)).toBe(true);
        await settle();
        const selection = objectSelectionObservable.peek();
        expect(selection?.gameObject).toBe(canvas);

        volumesShownObservable.set(true);
        volumesShownObservable.set(false);
        await settle();
        // (The same selection, never one made again.)
        expect(objectSelectionObservable.peek()).toBe(selection);
        expect(voxelQuadSelectionObservable.peek()).toBeNull();
    });
});
