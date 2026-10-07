/**
 * Scenario tests: moving and resizing the selected attached object by its selection outline (see
 * ObjectAttachmentEditGizmos), driven as the player drives it: presses, drags and releases on the canvas,
 * seen through a real camera and passed through the canvas's own arbitration (see GizmoDragUtil).
 * Covers: a drag inside the outline carrying the object along its wall and onto another face; a drag of a
 * corner resizing it about the corner across from it; each gesture previewed locally and sent as one
 * edit, or put back when abandoned; a press outside the outline, and a press that never becomes a drag,
 * changing nothing.
 * Browser-bound client modules are stubbed; the room, the placement rules and the gizmo run for real.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";

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
        // As the real one: its line runs this far outside the area it outlines.
        static getEdgeOffset(size: number) { return 0.5 * size + 0.08; }
        addToParent() {}
        setTransform() {}
        setTransformRaw() {}
        setVisible() {}
        isVisible() { return true; }
        dispose() {}
    },
}));

// What the gizmo sends the server; watched to see what each gesture comes to.
vi.mock("../../../src/client/networking/client/socketsClient", () => ({
    default: {
        emitSetObjectTransformSignal: vi.fn(),
        emitSetObjectMetadataSignal: vi.fn(),
    },
}));

import * as THREE from "three";
import App from "../../../src/client/app";
import "../../../src/client/graphics/types/gizmo/objectAttachmentEditGizmos";
import GizmoDragUtil from "../../../src/client/graphics/util/gizmoDragUtil";
import ObjectSelection from "../../../src/client/graphics/types/gizmo/objectSelection";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import SocketsClient from "../../../src/client/networking/client/socketsClient";
import { gameModeObservable, objectSelectionObservable,
    voxelQuadSelectionObservable } from "../../../src/client/system/clientObservables";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MIN } from "../../../src/shared/system/sharedConstants";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import Room from "../../../src/shared/room/types/room";
import Vec3 from "../../../src/shared/math/types/vec3";
import { createEditingUser } from "../helpers/mockUser";
import { createRoom, quadIndexOf } from "../helpers/selectionHarness";
import { cursorAt, drag, dragThrough, placeCamera, press, release, screenPointOf } from "../helpers/gizmoHarness";

// The acting user (editing utilities require one).
const actingUser = createEditingUser();

const ROOM_ID = "object-gizmo-room";
const OBJECT_ID = "a-canvas";
const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

// A free-standing wall running east-west, five cells long and two units high, whose south face (at
// z = WALL_Z) the canvas hangs on.
const WALL_ROW = 10, WALL_COL_MIN = 8, WALL_COL_MAX = 12, WALL_LAYERS = 4;
const WALL_Z = WALL_ROW + 1;
const SOUTH = {x: 0, y: 0, z: 1};

// How far outside the outlined area the outline's line runs (see WorldSpaceOutlineRect).
const OUTLINE_OUTSET = 0.08;

let room: Room;

// Hangs a canvas of the given size on the wall's south face, centred there, and selects it.
function hangCanvas(x: number, y: number, width: number = 1, height: number = 1): void
{
    const signal = new AddObjectSignal(room.id, actingUser.id, actingUser.userName, canvasTypeIndex, OBJECT_ID,
        new ObjectTransform({x, y, z: WALL_Z}, {...SOUTH}, {x: width, y: height, z: 1}));
    expect(ObjectUpdateUtil.addObject(actingUser, room, signal)).toBe(true);

    // The game object the client would have made of it, as far as the gizmo looks at one.
    const position = new THREE.Vector3(x, y, WALL_Z);
    const gameObject = {
        params: room.objectById[OBJECT_ID],
        position,
        quaternion: new THREE.Quaternion(),
        obj: {scale: new THREE.Vector3(1, 1, 1)},
        components: {},
        setObjectTransform: (pos: Vec3) => { position.set(pos.x, pos.y, pos.z); },
    } as unknown as GameObject;
    vi.spyOn(ClientObjectManager, "getObjectById").mockImplementation(
        (objectId: string) => (objectId == OBJECT_ID) ? gameObject : undefined);
    objectSelectionObservable.set(new ObjectSelection(gameObject));
}

function canvasTransform(): {pos: number[], dir: number[], scale: number[]}
{
    const {pos, dir, scale} = room.objectById[OBJECT_ID].transform;
    const rounded = (v: Vec3) => [v.x, v.y, v.z].map(n => Math.round(n * 1000) / 1000);
    return {pos: rounded(pos), dir: rounded(dir), scale: rounded(scale)};
}

// A point of the wall's south face.
const onWall = (x: number, y: number) => screenPointOf({x, y, z: WALL_Z});

// The signals sent since the last time this was asked, as [kind, ...what they say].
function sentSignals(): unknown[][]
{
    const sent: unknown[][] = [];
    const rounded = (v: Vec3) => [v.x, v.y, v.z].map(n => Math.round(n * 1000) / 1000);
    for (const [signal] of (SocketsClient.emitSetObjectTransformSignal as Mock).mock.calls)
        sent.push(["transform", signal.objectId, rounded(signal.transform.pos), rounded(signal.transform.scale)]);
    for (const [signal] of (SocketsClient.emitSetObjectMetadataSignal as Mock).mock.calls)
        sent.push(["metadata", signal.objectId, signal.metadataKey]);
    (SocketsClient.emitSetObjectTransformSignal as Mock).mockClear();
    (SocketsClient.emitSetObjectMetadataSignal as Mock).mockClear();
    return sent;
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    gameModeObservable.set("edit");
    voxelQuadSelectionObservable.set(null);
    objectSelectionObservable.set(null);

    (App.getUser as Mock).mockReturnValue(actingUser);
    room = createRoom(ROOM_ID);
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
    for (let col = WALL_COL_MIN; col <= WALL_COL_MAX; ++col)
    {
        for (let layer = COLLISION_LAYER_MIN; layer < COLLISION_LAYER_MIN + WALL_LAYERS; ++layer)
        {
            VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels,
                quadIndexOf(WALL_ROW, col, "y", "+", layer), [1, 1, 1, 1, 1, 1]);
        }
    }
    // South of the wall and level with its middle, under the slab between the room's two storeys.
    placeCamera({x: 10.5, y: 1.2, z: WALL_Z + 6}, {x: 10.5, y: 1, z: WALL_Z});
    sentSignals();
});

afterEach(() => {
    GizmoDragUtil.cancel();
    objectSelectionObservable.set(null);
    vi.restoreAllMocks();
});

describe("dragging the selected object by the inside of its outline", () => {
    it("is offered inside the outline, and nowhere else", () => {
        hangCanvas(10.5, 1);
        expect(cursorAt(onWall(10.5, 1))).toBe("move");
        expect(cursorAt(onWall(10.9, 0.6))).toBe("move");
        expect(cursorAt(onWall(11.4, 1))).toBe("");
        expect(press(onWall(11.4, 1))).toBe(false);
    });

    it("carries the object along its wall, keeping under the pointer the spot it was taken hold of", () => {
        hangCanvas(10.5, 1);
        expect(press(onWall(10.7, 1.2))).toBe(true);
        dragThrough(onWall(11, 1.2), onWall(11.7, 1.2));

        // A whole cell to the east: shown at once, and not yet sent.
        expect(canvasTransform()).toEqual({pos: [11.5, 1, WALL_Z], dir: [0, 0, 1], scale: [1, 1, 1]});
        expect(sentSignals()).toEqual([]);

        release();
        expect(sentSignals()).toEqual([["transform", OBJECT_ID, [11.5, 1, WALL_Z], [1, 1, 1]]]);
    });

    it("stops at the end of the wall, where the object would hang over nothing", () => {
        hangCanvas(10.5, 1);
        // The pointer stays on the wall, but too near its end for the object to be centred under it.
        expect(drag(onWall(10.5, 1), onWall(11, 1), onWall(12.5, 1), onWall(12.9, 1))).toBe(true);
        expect(canvasTransform().pos).toEqual([WALL_COL_MAX + 0.5, 1, WALL_Z]);
        expect(sentSignals()).toEqual([["transform", OBJECT_ID, [WALL_COL_MAX + 0.5, 1, WALL_Z], [1, 1, 1]]]);
    });

    it("lays the object on another face the pointer goes to", () => {
        hangCanvas(10.5, 1);
        // Onto the floor before the wall.
        expect(drag(onWall(10.5, 1), onWall(10.5, 0.7), screenPointOf({x: 10.5, y: 0, z: WALL_Z + 2.5}))).toBe(true);

        const laid = canvasTransform();
        expect(laid.dir).toEqual([0, 1, 0]);
        expect(laid.pos[1]).toBe(0);
        expect(sentSignals().length).toBe(1);
    });

    it("puts the object back when the drag is abandoned", () => {
        hangCanvas(10.5, 1);
        expect(press(onWall(10.5, 1))).toBe(true);
        dragThrough(onWall(11, 1), onWall(11.5, 1));
        expect(canvasTransform().pos).toEqual([11.5, 1, WALL_Z]);

        GizmoDragUtil.cancel(); // a second finger, or the canvas losing focus
        expect(canvasTransform()).toEqual({pos: [10.5, 1, WALL_Z], dir: [0, 0, 1], scale: [1, 1, 1]});
        expect(sentSignals()).toEqual([]);
    });

    it("changes nothing for a press that never becomes a drag", () => {
        hangCanvas(10.5, 1);
        expect(press(onWall(10.5, 1))).toBe(true);
        release();
        expect(canvasTransform().pos).toEqual([10.5, 1, WALL_Z]);
        expect(sentSignals()).toEqual([]);
    });

    it("is dropped, and the object put back, when the selection goes elsewhere", () => {
        hangCanvas(10.5, 1);
        expect(press(onWall(10.5, 1))).toBe(true);
        dragThrough(onWall(11, 1), onWall(11.5, 1));

        objectSelectionObservable.set(null);
        expect(GizmoDragUtil.isActive()).toBe(false);
        expect(canvasTransform().pos).toEqual([10.5, 1, WALL_Z]);
        expect(sentSignals()).toEqual([]);
    });

    it("is dropped on leaving edit mode", () => {
        hangCanvas(10.5, 1);
        expect(press(onWall(10.5, 1))).toBe(true);
        dragThrough(onWall(11, 1), onWall(11.5, 1));

        gameModeObservable.set("play");
        expect(GizmoDragUtil.isActive()).toBe(false);
        expect(canvasTransform().pos).toEqual([10.5, 1, WALL_Z]);
    });
});

describe("dragging a corner of the selected object's outline", () => {
    // The outline's corner towards the given side of the canvas, which is where its handle sits.
    const corner = (x: number, y: number, width: number, height: number, towardEast: number, towardUp: number) =>
        onWall(x + towardEast * (0.5 * width + OUTLINE_OUTSET), y + towardUp * (0.5 * height + OUTLINE_OUTSET));

    it("is offered on the corners, with an arrow along the diagonal each lies on", () => {
        hangCanvas(10.5, 1);
        expect(cursorAt(corner(10.5, 1, 1, 1, 1, 1))).toBe("nesw-resize");
        expect(cursorAt(corner(10.5, 1, 1, 1, -1, -1))).toBe("nesw-resize");
        expect(cursorAt(corner(10.5, 1, 1, 1, -1, 1))).toBe("nwse-resize");
        expect(cursorAt(corner(10.5, 1, 1, 1, 1, -1))).toBe("nwse-resize");
    });

    it("resizes the object about the corner across from it, in steps of its size", () => {
        hangCanvas(10.5, 1);
        const grip = corner(10.5, 1, 1, 1, 1, 1); // the corner up and to the east
        expect(press(grip)).toBe(true);
        dragThrough(corner(10.5, 1, 1.4, 1.2, 1, 1), corner(10.5, 1, 2, 2, 1, 1));

        // Half a unit wider and taller, with the corner down and to the west where it was.
        const resized = canvasTransform();
        expect(resized.scale).toEqual([1.5, 1.5, 1]);
        expect(resized.pos).toEqual([10.75, 1.25, WALL_Z]);
        expect(sentSignals()).toEqual([]);

        release();
        expect(sentSignals()).toEqual([["transform", OBJECT_ID, [10.75, 1.25, WALL_Z], [1.5, 1.5, 1]]]);
    });

    it("shrinks it as readily, and puts it back when the drag is abandoned", () => {
        hangCanvas(10.5, 1);
        expect(press(corner(10.5, 1, 1, 1, 1, 1))).toBe(true);
        dragThrough(corner(10.5, 1, 0.8, 0.8, 1, 1), corner(10.5, 1, 0, 0, 1, 1));
        expect(canvasTransform().scale).toEqual([0.5, 0.5, 1]);
        expect(canvasTransform().pos).toEqual([10.25, 0.75, WALL_Z]);

        GizmoDragUtil.cancel();
        expect(canvasTransform()).toEqual({pos: [10.5, 1, WALL_Z], dir: [0, 0, 1], scale: [1, 1, 1]});
        expect(sentSignals()).toEqual([]);
    });
});
