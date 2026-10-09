/**
 * Scenario tests: moving and resizing the selected attached object by its selection outline (see
 * ObjectAttachmentEditGizmos), driven as the player drives it: presses, drags and releases on the canvas,
 * seen through a real camera and passed through the canvas's own arbitration (see GizmoDragUtil).
 * Covers: a drag inside the outline carrying the object along its wall and onto another face; a drag of a
 * corner resizing it about the corner across from it; each gesture previewed locally and sent as one
 * edit, or put back when abandoned; a press outside the outline, and a press that never becomes a drag,
 * changing nothing; a prop turning a quarter onto a spot that takes it no other way, and only there; the
 * corners that get a handle (those that can resize the object some way); a drag showing red while the
 * object can't do what the pointer asks; and the rotate tool (see ObjectEditUtil), which shifts the object
 * a grid step where it only fits turned so.
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
        // The color the selection's outline was last given.
        static lastColor: string | null = null;
        static async create() { return new WorldSpaceOutlineRectStub(); }
        // As the real one: its line runs this far outside the area it outlines.
        static getEdgeOffset(size: number) { return 0.5 * size + 0.08; }
        addToParent() {}
        setTransform() {}
        setTransformRaw() {}
        setVisible() {}
        setColor(color: string) { WorldSpaceOutlineRectStub.lastColor = color; }
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
import GraphicsManager from "../../../src/client/graphics/graphicsManager";
import "../../../src/client/graphics/types/gizmo/objectAttachmentEditGizmos";
import WorldSpaceOutlineRect from "../../../src/client/graphics/types/gizmo/generic/worldSpaceOutlineRect";
import GizmoDragUtil from "../../../src/client/graphics/util/gizmoDragUtil";
import CameraUtil from "../../../src/client/graphics/util/cameraUtil";
import SelectionEditGizmoUtil from "../../../src/client/graphics/util/selectionEditGizmoUtil";
import ObjectSelection from "../../../src/client/graphics/types/gizmo/objectSelection";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import ClientVoxelQueryUtil from "../../../src/client/voxel/util/clientVoxelQueryUtil";
import SocketsClient from "../../../src/client/networking/client/socketsClient";
import ObjectEditUtil from "../../../src/client/ui/util/objectEditUtil";
import { bottomUIHeightObservable, cameraModeObservable, gameModeObservable, objectEditObservable,
    objectSelectionObservable, orbitCameraAnglesObservable, orbitCameraTargetOverrideObservable,
    selectionEditBlockedObservable, updateObservable,
    voxelQuadSelectionObservable } from "../../../src/client/system/clientObservables";
import { SELECTION_BLOCKED_COLOR, SELECTION_COLOR,
    SELECTION_HANDLE_MAX_DISTANCE } from "../../../src/client/system/clientConstants";
import { COLLISION_LAYER_HEIGHT, VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import QuarterTurnsUtil from "../../../src/shared/object/util/quarterTurnsUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { ObjectMetadata } from "../../../src/shared/object/types/objectMetadata";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import PropObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/propObjectTypeConfig";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import Room from "../../../src/shared/room/types/room";
import Vec3 from "../../../src/shared/math/types/vec3";
import { createEditingUser } from "../helpers/mockUser";
import { FIXTURE_PICTURES, useFixturePictures } from "../helpers/pictureFixture";
import { createRoom, quadIndexOf } from "../helpers/selectionHarness";
import { stubFocus } from "../helpers/focusStub";
import { cursorAt, drag, dragThrough, placeCamera, press, release, screenPointOf } from "../helpers/gizmoHarness";

// The acting user (editing utilities require one).
const actingUser = createEditingUser();

const ROOM_ID = "object-gizmo-room";
const OBJECT_ID = "an-object";
const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const propTypeIndex = ObjectTypeConfigMap.getIndexByType("Prop");

// A free-standing wall running east-west, five units long, one thick and two high, whose south face (at
// z = WALL_Z) the canvas hangs on.
const WALL_X_MIN = 8, WALL_X_MAX = 13, WALL_THICKNESS = 1;
const WALL_Z = 11;
const WALL_TOP_Y = 2;
const SOUTH = {x: 0, y: 0, z: 1};
const UP = {x: 0, y: 1, z: 0};

// Blocks stood on the room's floor south of the wall, one layer high, in groups clear of one another: their
// tops are faces a unit across at most, lying in one plane, with their north edges along z = BLOCKS_Z. An
// object lying on one is as wide as its scale's x along the room's x, and as tall as its scale's y along z.
const BLOCKS_Z = 14;
const BLOCK_TOP_Y = COLLISION_LAYER_HEIGHT;

// How far outside the outlined area the outline's line runs (see WorldSpaceOutlineRect).
const OUTLINE_OUTSET = 0.08;

let room: Room;

// Attaches an object to a face, centred at a point of it, and selects it.
function attach(objectTypeIndex: number, pos: Vec3, dir: Vec3, scale: Vec3, metadata: ObjectMetadata = {}): void
{
    const signal = new AddObjectSignal(room.id, actingUser.id, actingUser.userName, objectTypeIndex, OBJECT_ID,
        new ObjectTransform({...pos}, {...dir}, {...scale}), metadata);
    expect(ObjectUpdateUtil.addObject(actingUser, room, signal)).toBe(true);

    // The game object the client would have made of it, as far as the gizmo and the tools look at one.
    const position = new THREE.Vector3(pos.x, pos.y, pos.z);
    const gameObject = {
        params: room.objectById[OBJECT_ID],
        position,
        quaternion: new THREE.Quaternion(),
        obj: {scale: new THREE.Vector3(1, 1, 1)},
        components: {},
        setObjectTransform: (to: Vec3) => { position.set(to.x, to.y, to.z); },
        onSetMetadata: () => {},
    } as unknown as GameObject;
    vi.spyOn(ClientObjectManager, "getObjectById").mockImplementation(
        (objectId: string) => (objectId == OBJECT_ID) ? gameObject : undefined);
    objectSelectionObservable.set(new ObjectSelection(gameObject));
}

// Hangs a canvas of the given size on the wall's south face, centred there, and selects it.
function hangCanvas(x: number, y: number, width: number = 1, height: number = 1): void
{
    attach(canvasTypeIndex, {x, y, z: WALL_Z}, SOUTH, {x: width, y: height, z: 1});
}

// Attaches a prop showing an image, at that image's own size, and selects it.
function attachProp(imagePath: string, pos: Vec3, dir: Vec3): void
{
    attach(propTypeIndex, pos, dir, PropObjectTypeConfig.util.getImageScale(imagePath, 0)!,
        {[ObjectMetadataKeyEnumMap.ImagePath]: new EncodableByteString(imagePath)});
}

// Fills a box of the room with blocks: given in world units, with its sides on block boundaries.
function fillWithBlocks(min: Vec3, max: Vec3): void
{
    const {getVoxelRowFromWorldZ: rowAt, getVoxelColFromWorldX: colAt,
        getVoxelCollisionLayerFromWorldY: layerAt} = VoxelQueryUtil;
    for (let row = rowAt(min.z); row < rowAt(max.z); ++row)
    {
        for (let col = colAt(min.x); col < colAt(max.x); ++col)
        {
            for (let layer = layerAt(min.y); layer < layerAt(max.y); ++layer)
            {
                VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels,
                    quadIndexOf(row, col, "y", "+", layer), [1, 1, 1, 1, 1, 1]);
            }
        }
    }
}

// Stands blocks on the room's floor by themselves, south of the wall and one layer high: from x eastward and
// from BLOCKS_Z southward, as far as given.
function standBlocks(x: number, width: number = 1, depth: number = 1): void
{
    fillWithBlocks({x, y: 0, z: BLOCKS_Z}, {x: x + width, y: BLOCK_TOP_Y, z: BLOCKS_Z + depth});
}

function objectTransform(): {pos: number[], dir: number[], scale: number[]}
{
    const {pos, dir, scale} = room.objectById[OBJECT_ID].transform;
    const rounded = (v: Vec3) => [v.x, v.y, v.z].map(n => Math.round(n * 1000) / 1000);
    return {pos: rounded(pos), dir: rounded(dir), scale: rounded(scale)};
}

function quarterTurns(): number
{
    return QuarterTurnsUtil.getQuarterTurns(room.objectById[OBJECT_ID]);
}

// A point of the wall's south face.
const onWall = (x: number, y: number) => screenPointOf({x, y, z: WALL_Z});

// A point of the plane the blocks' tops lie in.
const onTops = (x: number, z: number) => screenPointOf({x, y: BLOCK_TOP_Y, z});

// From the south and above, so that the blocks' tops show before the wall.
function lookDownOnTheBlocks(): void
{
    placeCamera({x: 11.5, y: 3.5, z: 19}, {x: 11.5, y: BLOCK_TOP_Y, z: BLOCKS_Z + 0.5});
}

// Whether the drag under way is asking for what the object can't do, which shows red.
const blocked = () => selectionEditBlockedObservable.peek();

// The corners that have a handle, each named for the way it lies from the middle along the face's right
// and up ("1,-1": to the east and down, on the wall).
function handleIds(): string[]
{
    return (SelectionEditGizmoUtil.getGrabPoints()?.handles ?? []).map(handle => handle.id).sort();
}

// The signals sent since the last time this was asked, as [kind, ...what they say].
function sentSignals(): unknown[][]
{
    const sent: unknown[][] = [];
    const rounded = (v: Vec3) => [v.x, v.y, v.z].map(n => Math.round(n * 1000) / 1000);
    for (const [signal] of (SocketsClient.emitSetObjectTransformSignal as Mock).mock.calls)
        sent.push(["transform", signal.objectId, rounded(signal.transform.pos), rounded(signal.transform.scale)]);
    for (const [signal] of (SocketsClient.emitSetObjectMetadataSignal as Mock).mock.calls)
    {
        // (A value that changes the object's size comes with the transform it needs.)
        sent.push(["metadata", signal.objectId, signal.metadataKey, ...(signal.transform
            ? [rounded(signal.transform.pos), rounded(signal.transform.scale)] : [])]);
    }
    (SocketsClient.emitSetObjectTransformSignal as Mock).mockClear();
    (SocketsClient.emitSetObjectMetadataSignal as Mock).mockClear();
    return sent;
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    // (A tool's edit asks whether it is being typed; see ObjectEditUtil.)
    stubFocus();

    gameModeObservable.set("edit");
    voxelQuadSelectionObservable.set(null);
    objectSelectionObservable.set(null);

    (App.getUser as Mock).mockReturnValue(actingUser);
    room = createRoom(ROOM_ID);
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
    fillWithBlocks({x: WALL_X_MIN, y: 0, z: WALL_Z - WALL_THICKNESS}, {x: WALL_X_MAX, y: WALL_TOP_Y, z: WALL_Z});
    // South of the wall and level with its middle, under the slab between the room's two storeys.
    placeCamera({x: 10.5, y: 1.2, z: WALL_Z + 6}, {x: 10.5, y: 1, z: WALL_Z});
    sentSignals();
});

afterEach(() => {
    GizmoDragUtil.cancel();
    objectSelectionObservable.set(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

        // A whole unit to the east: shown at once, and not yet sent.
        expect(objectTransform()).toEqual({pos: [11.5, 1, WALL_Z], dir: [0, 0, 1], scale: [1, 1, 1]});
        expect(sentSignals()).toEqual([]);

        release();
        expect(sentSignals()).toEqual([["transform", OBJECT_ID, [11.5, 1, WALL_Z], [1, 1, 1]]]);
    });

    it("stops at the end of the wall, where the object would hang over nothing", () => {
        hangCanvas(10.5, 1);
        // The pointer stays on the wall, but too near its end for the object to be centred under it.
        expect(drag(onWall(10.5, 1), onWall(11, 1), onWall(12.5, 1), onWall(12.9, 1))).toBe(true);
        expect(objectTransform().pos).toEqual([WALL_X_MAX - 0.5, 1, WALL_Z]);
        expect(sentSignals()).toEqual([["transform", OBJECT_ID, [WALL_X_MAX - 0.5, 1, WALL_Z], [1, 1, 1]]]);
    });

    it("lays the object on another face the pointer goes to", () => {
        hangCanvas(10.5, 1);
        // Onto the floor before the wall.
        expect(drag(onWall(10.5, 1), onWall(10.5, 0.7), screenPointOf({x: 10.5, y: 0, z: WALL_Z + 2.5}))).toBe(true);

        const laid = objectTransform();
        expect(laid.dir).toEqual([0, 1, 0]);
        expect(laid.pos[1]).toBe(0);
        expect(sentSignals().length).toBe(1);
    });

    it("puts the object back when the drag is abandoned", () => {
        hangCanvas(10.5, 1);
        expect(press(onWall(10.5, 1))).toBe(true);
        dragThrough(onWall(11, 1), onWall(11.5, 1));
        expect(objectTransform().pos).toEqual([11.5, 1, WALL_Z]);

        GizmoDragUtil.cancel(); // a second finger, or the canvas losing focus
        expect(objectTransform()).toEqual({pos: [10.5, 1, WALL_Z], dir: [0, 0, 1], scale: [1, 1, 1]});
        expect(sentSignals()).toEqual([]);
    });

    it("changes nothing for a press that never becomes a drag", () => {
        hangCanvas(10.5, 1);
        expect(press(onWall(10.5, 1))).toBe(true);
        release();
        expect(objectTransform().pos).toEqual([10.5, 1, WALL_Z]);
        expect(sentSignals()).toEqual([]);
    });

    it("is dropped, and the object put back, when the selection goes elsewhere", () => {
        hangCanvas(10.5, 1);
        expect(press(onWall(10.5, 1))).toBe(true);
        dragThrough(onWall(11, 1), onWall(11.5, 1));

        objectSelectionObservable.set(null);
        expect(GizmoDragUtil.isActive()).toBe(false);
        expect(objectTransform().pos).toEqual([10.5, 1, WALL_Z]);
        expect(sentSignals()).toEqual([]);
    });

    it("is dropped on leaving edit mode", () => {
        hangCanvas(10.5, 1);
        expect(press(onWall(10.5, 1))).toBe(true);
        dragThrough(onWall(11, 1), onWall(11.5, 1));

        gameModeObservable.set("play");
        expect(GizmoDragUtil.isActive()).toBe(false);
        expect(objectTransform().pos).toEqual([10.5, 1, WALL_Z]);
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
        const resized = objectTransform();
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
        expect(objectTransform().scale).toEqual([0.5, 0.5, 1]);
        expect(objectTransform().pos).toEqual([10.25, 0.75, WALL_Z]);

        GizmoDragUtil.cancel();
        expect(objectTransform()).toEqual({pos: [10.5, 1, WALL_Z], dir: [0, 0, 1], scale: [1, 1, 1]});
        expect(sentSignals()).toEqual([]);
    });

    it("shows red while a size that doesn't fit is asked for, the object keeping the last that did", () => {
        hangCanvas(10.5, 1);
        expect(press(corner(10.5, 1, 1, 1, 1, 1))).toBe(true);
        // Up to the top of the wall, half a unit above the canvas.
        dragThrough(corner(10.5, 1, 1, 1.4, 1, 1), corner(10.5, 1, 1, 2, 1, 1));
        expect(objectTransform().scale).toEqual([1, 1.5, 1]);
        expect(blocked()).toBe(false);

        // Past it, where no wall stands behind.
        dragThrough(corner(10.5, 1, 1, 3, 1, 1));
        expect(objectTransform().scale).toEqual([1, 1.5, 1]);
        expect(blocked()).toBe(true);
        dragThrough(corner(10.5, 1, 1, 2, 1, 1));
        expect(blocked()).toBe(false);

        dragThrough(corner(10.5, 1, 1, 3, 1, 1));
        release();
        expect(blocked()).toBe(false);
        expect(sentSignals()).toEqual([["transform", OBJECT_ID, [10.5, 1.25, WALL_Z], [1, 1.5, 1]]]);
    });

    it("shows red past the smallest and the largest its type may be", () => {
        hangCanvas(10.5, 1);
        expect(press(corner(10.5, 1, 1, 1, 1, 1))).toBe(true);
        dragThrough(corner(10.5, 1, 0.8, 0.8, 1, 1), corner(10.5, 1, 0, 0, 1, 1));
        expect(objectTransform().scale).toEqual([0.5, 0.5, 1]);
        expect(blocked()).toBe(false);

        // On past the corner that holds still.
        dragThrough(corner(10.5, 1, -1, -1, 1, 1));
        expect(objectTransform().scale).toEqual([0.5, 0.5, 1]);
        expect(blocked()).toBe(true);
    });

    // A point just outside a corner of the outline, within reach of a handle there and off the object's inside.
    const beyondCorner = (x: number, y: number, size: number, towardEast: number, towardUp: number) =>
        corner(x, y, size + 0.06, size + 0.06, towardEast, towardUp);

    it("has a handle on every corner that can take the object some other size", () => {
        hangCanvas(10.5, 1);
        expect(handleIds()).toEqual(["-1,-1", "-1,1", "1,-1", "1,1"]);
    });

    it("has none on a corner that can't: as small as it gets, in the corner of its wall", () => {
        // At the foot of the wall's west end, where the corner down and to the west could only take it off the
        // wall or under the floor.
        const x = WALL_X_MIN + 0.25, y = 0.25;
        hangCanvas(x, y, 0.5, 0.5);
        expect(handleIds()).toEqual(["-1,1", "1,-1", "1,1"]);
        expect(cursorAt(beyondCorner(x, y, 0.5, 1, 1))).toBe("nesw-resize");
        expect(cursorAt(beyondCorner(x, y, 0.5, -1, -1))).toBe("");
        expect(press(beyondCorner(x, y, 0.5, -1, -1))).toBe(false);
    });

    it("has none at all on an object that fills the only face near it, and still moves by its inside", () => {
        // The south side of a lone block: one block across, one layer up.
        standBlocks(10, VOXEL_CELL_SIZE, VOXEL_CELL_SIZE);
        const middle = {x: 10 + 0.5 * VOXEL_CELL_SIZE, y: 0.5 * COLLISION_LAYER_HEIGHT, z: BLOCKS_Z + VOXEL_CELL_SIZE};
        attach(canvasTypeIndex, middle, SOUTH, {x: 0.5, y: 0.5, z: 1});

        expect(handleIds()).toEqual([]);
        expect(SelectionEditGizmoUtil.getGrabPoints()!.canResize).toBe(false);
        expect(cursorAt(screenPointOf(middle))).toBe("move");
    });

    it("loses and regains handles as its neighbours come and go", () => {
        const x = WALL_X_MIN + 0.25, y = 0.25;
        hangCanvas(x, y, 0.5, 0.5);
        expect(handleIds()).toEqual(["-1,1", "1,-1", "1,1"]);

        // One beside it and one above it, each as small: nowhere is left for it to grow.
        const neighbours = [{id: "beside", x: x + 0.5, y}, {id: "above", x, y: y + 0.5}].map(at =>
            new AddObjectSignal(room.id, actingUser.id, actingUser.userName, canvasTypeIndex, at.id,
                new ObjectTransform({x: at.x, y: at.y, z: WALL_Z}, {...SOUTH}, {x: 0.5, y: 0.5, z: 1})));
        for (const neighbour of neighbours)
        {
            expect(ObjectUpdateUtil.addObject(actingUser, room, neighbour)).toBe(true);
            objectEditObservable.set({kind: "add", object: neighbour});
        }
        expect(handleIds()).toEqual([]);

        expect(ObjectUpdateUtil.removeObject(actingUser, room, new RemoveObjectSignal(room.id, "beside"))).toBe(true);
        objectEditObservable.set({kind: "remove", object: neighbours[0]});
        expect(handleIds()).toEqual(["1,-1", "1,1"]);
    });
});

describe("the corner handles of an object far from the camera", () => {
    // Squarely before the canvas, at a distance from its middle.
    const lookFrom = (distance: number) =>
        placeCamera({x: 10.5, y: 1, z: WALL_Z + distance}, {x: 10.5, y: 1, z: WALL_Z});
    // A point of the canvas just inside its outline's corner up and to the east, where a handle sits.
    const byCorner = (x: number, y: number) => onWall(x + 0.55, y + 0.55);
    const shownHandleMeshes = () => GraphicsManager.getScene().children.filter(
        child => (child as THREE.Mesh).isMesh && child.visible);
    const settle = () => new Promise(resolve => setTimeout(resolve, 0));
    const frame = () => updateObservable.set(1 / 60);

    it("are offered as far off as they can be held, and no further", () => {
        hangCanvas(10.5, 1);
        lookFrom(SELECTION_HANDLE_MAX_DISTANCE - 0.01);
        expect(handleIds()).toEqual(["-1,-1", "-1,1", "1,-1", "1,1"]);

        lookFrom(SELECTION_HANDLE_MAX_DISTANCE + 0.01);
        expect(handleIds()).toEqual([]);
        expect(SelectionEditGizmoUtil.getGrabPoints()!.canResize).toBe(false);

        lookFrom(6);
        expect(handleIds()).toEqual(["-1,-1", "-1,1", "1,-1", "1,1"]);
    });

    it("are drawn only while they are offered", async () => {
        hangCanvas(10.5, 1);
        await settle();
        frame();
        await settle(); // the handles are made the first time some are wanted
        frame();
        expect(shownHandleMeshes().length).toBe(4);

        lookFrom(SELECTION_HANDLE_MAX_DISTANCE + 2);
        frame();
        expect(shownHandleMeshes().length).toBe(0);

        lookFrom(6);
        frame();
        expect(shownHandleMeshes().length).toBe(4);
    });

    it("leave a press on a corner to move the object, at the size it has", () => {
        hangCanvas(10.5, 1);
        lookFrom(SELECTION_HANDLE_MAX_DISTANCE + 2);
        expect(cursorAt(byCorner(10.5, 1))).toBe("move");

        expect(drag(byCorner(10.5, 1), byCorner(11, 1), byCorner(11.5, 1))).toBe(true);
        expect(objectTransform()).toEqual({pos: [11.5, 1, WALL_Z], dir: [0, 0, 1], scale: [1, 1, 1]});
    });

    it("keep the one a drag holds when the view draws back from it, until it is let go", async () => {
        hangCanvas(10.5, 1);
        const grip = onWall(10.5 + 0.5 + OUTLINE_OUTSET, 1 + 0.5 + OUTLINE_OUTSET);
        expect(press(grip)).toBe(true);
        dragThrough(onWall(11.3, 1.8), onWall(11.6, 2.1));
        expect(objectTransform().scale).toEqual([1.5, 1.5, 1]);

        lookFrom(SELECTION_HANDLE_MAX_DISTANCE + 2);
        expect(handleIds()).toEqual(["1,1"]);
        await settle();
        frame();
        await settle();
        frame();
        expect(shownHandleMeshes().length).toBe(1);

        release();
        expect(handleIds()).toEqual([]);
        frame();
        expect(shownHandleMeshes().length).toBe(0);
    });
});

describe("the view following the pointer that drags an object to its edge", () => {
    // Near enough the wall that its east end lies past the view's own.
    const VIEW_DISTANCE = 3;
    const lookFromNear = (x: number = 10.5, distance: number = VIEW_DISTANCE) =>
        placeCamera({x, y: 1, z: WALL_Z + distance}, {x, y: 1, z: WALL_Z});
    // So near that the wall fills the view.
    const lookFromHardBy = () => lookFromNear(10.5, 0.5 * VIEW_DISTANCE);
    const frame = (seconds: number = 1 / 60) => updateObservable.set(seconds);
    // Where the orbit's pivot is.
    const pivot = (): Vec3 => {
        const mode = cameraModeObservable.peek();
        if (mode.type != "orbit")
            throw new Error(`The camera is not orbiting (mode = ${mode.type})`);
        return {x: mode.target.center.x, y: mode.target.center.y, z: mode.target.center.z};
    };
    // The orbit's angles, in degrees: round the room from due south of what it looks at, and down from overhead.
    const view = (): {azimuth: number, polar: number} => {
        const {azimuth, polar} = orbitCameraAnglesObservable.peek();
        return {azimuth: THREE.MathUtils.radToDeg(azimuth), polar: THREE.MathUtils.radToDeg(polar)};
    };
    const lookFromAngles = (azimuthDeg: number, polarDeg: number): void => orbitCameraAnglesObservable.set(
        {azimuth: THREE.MathUtils.degToRad(azimuthDeg), polar: THREE.MathUtils.degToRad(polarDeg)});
    // A point of the floor before the wall, a way south of it.
    const onFloor = (x: number, southOfWall: number) => screenPointOf({x, y: 0, z: WALL_Z + southOfWall});
    // A canvas in the middle of the view, taken by its middle and carried to where the pointer is then held.
    // (The points are where the view the test began with shows them.)
    const dragCanvasTo = (...through: ReturnType<typeof onWall>[]): void => {
        hangCanvas(10.5, 1);
        expect(press(onWall(10.5, 1))).toBe(true);
        dragThrough(...through);
    };
    const dragCanvasToWall = (x: number, y: number = 1): void =>
        dragCanvasTo(onWall(10.5 + 0.5 * (x - 10.5), 1 + 0.5 * (y - 1)), onWall(x, y));
    // How far the pivot goes in a time with the pointer held at a point of the screen.
    const slideAt = (point: {x: number, y: number}, seconds: number): number => {
        const middle = onWall(10.5, 1);
        dragCanvasTo({x: 0.5 * (middle.x + point.x), y: 0.5 * (middle.y + point.y)}, point);
        frame(seconds);
        const slid = pivot();
        GizmoDragUtil.cancel();
        objectSelectionObservable.set(null);
        expect(ObjectUpdateUtil.removeObject(actingUser, room, new RemoveObjectSignal(room.id, OBJECT_ID))).toBe(true);
        return Math.hypot(slid.x - 10.5, slid.y - 1, slid.z - WALL_Z);
    };
    // The same, for a point of the wall's plane at the canvas's height.
    const slideAfter = (x: number, seconds: number): number => slideAt(onWall(x, 1), seconds);

    beforeEach(() => {
        lookFromNear();
        lookFromAngles(0, 90);
    });

    afterEach(() => {
        GizmoDragUtil.cancel();
        objectSelectionObservable.set(null);
        bottomUIHeightObservable.set(0);
        orbitCameraTargetOverrideObservable.set(null);
        cameraModeObservable.set({type: "firstPerson"});
    });

    it("holds still while the pointer keeps to the middle of the view", () => {
        dragCanvasToWall(11.5);
        frame(1);
        expect(pivot()).toEqual({x: 10.5, y: 1, z: WALL_Z});
        expect(view()).toEqual({azimuth: 0, polar: 90});
    });

    it("slides toward the place pointed at once the pointer is in the view's margin", () => {
        dragCanvasToWall(12.6);
        frame(1);

        const slid = pivot();
        expect(slid.x).toBeGreaterThan(10.6);
        expect(slid.x).toBeLessThan(12.6);
        expect(slid.y).toBeCloseTo(1, 9);
        expect(slid.z).toBeCloseTo(WALL_Z, 9);
        // Only the view's pivot moves: the object is where the drag has it.
        expect(objectTransform().pos).toEqual([WALL_X_MAX - 0.5, 1, WALL_Z]);
    });

    it("goes toward the place pointed at though the object can't go there itself", () => {
        // Another canvas has the wall's east end, so ours is held back short of it.
        expect(ObjectUpdateUtil.addObject(actingUser, room, new AddObjectSignal(room.id, actingUser.id,
            actingUser.userName, canvasTypeIndex, "neighbour",
            new ObjectTransform({x: WALL_X_MAX - 0.5, y: 1, z: WALL_Z}, {...SOUTH}, {x: 1, y: 1, z: 1})))).toBe(true);
        dragCanvasToWall(12.6);
        expect(objectTransform().pos).toEqual([WALL_X_MAX - 1.5, 1, WALL_Z]);
        expect(blocked()).toBe(true);

        // All the way to where the pointer is, past where the object stays.
        for (let i = 0; i < 10; ++i)
            frame(1);
        expect(pivot().x).toBeCloseTo(12.6, 6);
        expect(objectTransform().pos).toEqual([WALL_X_MAX - 1.5, 1, WALL_Z]);
        expect(blocked()).toBe(true);
    });

    it("slides the faster the further into the margin the pointer is, and twice as far in a frame twice as long", () => {
        const justInside = slideAfter(12.05, 0.25);
        const nearTheEdge = slideAfter(12.75, 0.25);
        expect(justInside).toBeGreaterThan(0);
        expect(nearTheEdge).toBeGreaterThan(2 * justInside);
        expect(slideAfter(12.75, 0.5)).toBeCloseTo(2 * nearTheEdge, 9);
    });

    it("takes the pointer for near a side edge of the view from further off than for near its top or bottom", () => {
        // As far from an edge each time: near enough for a side one alone.
        const OFF_THE_EDGE = 120;
        lookFromHardBy();
        expect(slideAt({x: 800 - OFF_THE_EDGE, y: 300}, 0.25)).toBeGreaterThan(0.01);
        expect(slideAt({x: OFF_THE_EDGE, y: 300}, 0.25)).toBeGreaterThan(0.01);
        expect(slideAt({x: 400, y: OFF_THE_EDGE}, 0.25)).toBe(0);
        expect(slideAt({x: 400, y: 600 - OFF_THE_EDGE}, 0.25)).toBe(0);

        // Half as far from the top or bottom is near enough for those.
        expect(slideAt({x: 400, y: 0.5 * OFF_THE_EDGE}, 0.25)).toBeGreaterThan(0.01);
        expect(slideAt({x: 400, y: 600 - 0.5 * OFF_THE_EDGE}, 0.25)).toBeGreaterThan(0.01);
    });

    it("keeps the margin at a side edge as wide, however much of the view's height the 2D UI stands over", () => {
        const withAllTheHeight = slideAfter(12.4, 0.25);
        expect(withAllTheHeight).toBeGreaterThan(0);
        bottomUIHeightObservable.set(200);
        expect(slideAfter(12.4, 0.25)).toBeCloseTo(withAllTheHeight, 9);
    });

    it("holds still with the 2D UI standing over all of the view", () => {
        bottomUIHeightObservable.set(600);
        expect(slideAfter(12.75, 0.25)).toBe(0);
    });

    it("goes only the way of the edge the pointer is at", () => {
        // At the east edge and above the middle: across, and not up to the place pointed at.
        dragCanvasTo(onWall(11.5, 1.4), onWall(12.6, 1.8));
        frame(1);
        expect(pivot().x).toBeGreaterThan(10.6);
        expect(pivot().y).toBe(1);
        GizmoDragUtil.cancel();
        objectSelectionObservable.set(null);
        expect(ObjectUpdateUtil.removeObject(actingUser, room, new RemoveObjectSignal(room.id, OBJECT_ID))).toBe(true);

        // At the foot of the view and east of the middle: down, and not across.
        bottomUIHeightObservable.set(200);
        dragCanvasTo(onWall(11, 0.75), onWall(11.5, 0.5));
        frame(0.25);
        expect(pivot().y).toBeLessThan(0.99);
        expect(pivot().x).toBe(10.5);

        // In the corner: both.
        dragThrough(onWall(12.6, 0.5));
        frame(0.25);
        expect(pivot().x).toBeGreaterThan(10.6);
    });

    it("slides no faster for a pointer past the view's edge than for one at it", () => {
        // (Past the wall's end, the pointer is over the room beyond it.)
        const atTheEdge = slideAfter(13.5, 1);
        expect(atTheEdge).toBeGreaterThan(slideAfter(12.75, 1));
        expect(slideAfter(14.5, 1)).toBeCloseTo(atTheEdge, 9);
    });

    it("never slides past the place pointed at", () => {
        dragCanvasToWall(12.75);
        for (let i = 0; i < 50; ++i)
            frame(1);
        expect(pivot().x).toBeCloseTo(12.75, 6);
        expect(pivot().y).toBeCloseTo(1, 6);
        expect(pivot().z).toBeCloseTo(WALL_Z, 6);
    });

    it("holds still where the pointer is over nothing of the room", () => {
        dragCanvasToWall(12.75);
        vi.spyOn(ClientVoxelQueryUtil, "getFirstDrawnFaceAlongRay").mockReturnValue(undefined);
        frame(1);
        expect(pivot()).toEqual({x: 10.5, y: 1, z: WALL_Z});
    });

    it("counts what the 2D UI stands over along the bottom as out of view", () => {
        // Halfway down the wall, the pointer is clear of the canvas's own bottom margin...
        dragCanvasToWall(10.5, 0.5);
        frame(0.25);
        expect(pivot()).toEqual({x: 10.5, y: 1, z: WALL_Z});

        // ...but not of tools standing a third of the way up the screen.
        bottomUIHeightObservable.set(200);
        frame(0.25);
        const beside = pivot();
        expect(beside.y).toBeLessThan(0.99);
        expect(beside.y).toBeGreaterThan(0.5);
        expect(beside.x).toBeCloseTo(10.5, 9);

        // Over those tools the pointer is past the view's edge, and the view goes on toward what lies under them.
        dragThrough({x: 400, y: 500});
        frame(0.25);
        expect(pivot().y).toBeLessThan(beside.y);
    });

    it("hands the drag the pointer again once the view has moved under it", () => {
        dragCanvasToWall(11);
        expect(objectTransform().pos).toEqual([11, 1, WALL_Z]);

        // The view goes a unit east with the pointer held where it is: it is now over a spot a unit on.
        lookFromNear(11.5);
        expect(objectTransform().pos).toEqual([11, 1, WALL_Z]);
        frame();
        expect(objectTransform().pos).toEqual([12, 1, WALL_Z]);

        // And the pointer isn't read again while the view stands still.
        const pointerReads = vi.spyOn(CameraUtil, "getPointerRay");
        frame();
        frame();
        expect(pointerReads).not.toHaveBeenCalled();
    });

    it("leaves the view alone for a corner dragged to the edge", () => {
        hangCanvas(11.5, 1);
        lookFromNear();
        expect(press(onWall(11.5 + 0.5 + OUTLINE_OUTSET, 1 + 0.5 + OUTLINE_OUTSET))).toBe(true);
        dragThrough(onWall(12.6, 1.6), onWall(13.05, 1.6));
        expect(objectTransform().scale).toEqual([2, 1, 1]);

        frame(1);
        expect(pivot()).toEqual({x: 11.5, y: 1, z: WALL_Z});
    });

    it("leaves the view on a place a scripted step holds it on", () => {
        const stepsChosenPlace = {x: 10.5, y: 1, z: WALL_Z};
        orbitCameraTargetOverrideObservable.set(stepsChosenPlace);
        dragCanvasTo(onWall(10.5, 0.6), onFloor(10.5, 1));
        expect(objectTransform().dir).toEqual([0, 1, 0]);

        frame(1);
        expect(pivot()).toEqual(stepsChosenPlace);
        expect(view()).toEqual({azimuth: 0, polar: 90});
    });

    it("leaves a camera that isn't orbiting the selection where it stands", () => {
        hangCanvas(10.5, 1);
        lookFromNear();
        cameraModeObservable.set({type: "free"});
        expect(press(onWall(10.5, 1))).toBe(true);
        dragThrough(onWall(10.5, 0.6), onFloor(10.5, 1));
        expect(objectTransform().dir).toEqual([0, 1, 0]);

        frame(1);
        expect(cameraModeObservable.peek()).toEqual({type: "free"});
        expect(view()).toEqual({azimuth: 0, polar: 90});
    });

    it("turns to see an object that has turned onto a face looking another way, as far as seeing it well", () => {
        // Down the wall and onto the floor before it, near the foot of the view.
        dragCanvasTo(onWall(10.5, 0.6), onFloor(10.5, 1));
        expect(objectTransform().dir).toEqual([0, 1, 0]);

        // The camera begins to rise over the floor, heading as it was, while the view slides on.
        frame(0.5);
        const turning = view();
        expect(turning.polar).toBeLessThan(89);
        expect(turning.polar).toBeGreaterThan(46);
        expect(turning.azimuth).toBeCloseTo(0, 6);
        expect(pivot().y).toBeLessThan(1);

        // And goes no further over it than shows the object well.
        for (let i = 0; i < 20; ++i)
            frame(0.5);
        expect(view().polar).toBeCloseTo(45, 6);
        expect(view().azimuth).toBeCloseTo(0, 6);
    });

    it("turns the faster the further into the margin the pointer is", () => {
        const polarAfter = (southOfWall: number): number => {
            dragCanvasTo(onWall(10.5, 0.6), onFloor(10.5, southOfWall));
            expect(objectTransform().dir).toEqual([0, 1, 0]);
            frame(0.5);
            const polar = view().polar;
            GizmoDragUtil.cancel();
            objectSelectionObservable.set(null);
            expect(ObjectUpdateUtil.removeObject(actingUser, room, new RemoveObjectSignal(room.id, OBJECT_ID))).toBe(true);
            lookFromAngles(0, 90);
            return polar;
        };
        const justInside = 90 - polarAfter(0.6);
        const furtherIn = 90 - polarAfter(1);
        expect(justInside).toBeGreaterThan(0);
        expect(furtherIn).toBeGreaterThan(2 * justInside);
    });

    it("turns nothing for an object that keeps to the facing it began with, however aslant the view", () => {
        lookFromAngles(70, 90);
        dragCanvasToWall(12.75);
        frame(1);
        expect(pivot().x).toBeGreaterThan(10.6);
        expect(view().azimuth).toBeCloseTo(70, 9);
        expect(view().polar).toBeCloseTo(90, 9);
    });

    it("turns nothing while the pointer keeps to the middle of the view, though the object has turned", () => {
        hangCanvas(10.5, 1);
        // From further off, the floor before the wall shows in the middle of the view.
        placeCamera({x: 10.5, y: 1, z: WALL_Z + 6}, {x: 10.5, y: 1, z: WALL_Z});
        expect(press(onWall(10.5, 1))).toBe(true);
        dragThrough(onWall(10.5, 0.6), onFloor(10.5, 2));
        expect(objectTransform().dir).toEqual([0, 1, 0]);

        frame(1);
        expect(view()).toEqual({azimuth: 0, polar: 90});
        expect(pivot()).toEqual({x: 10.5, y: 1, z: WALL_Z});
    });

    it("goes on seeing to an object that has once turned, back on a face like the one it began on", () => {
        // From high overhead, the wall is seen at a slant, which a drag along the wall leaves alone...
        lookFromAngles(0, 20);
        dragCanvasToWall(12.6);
        frame(1);
        expect(view().polar).toBeCloseTo(20, 9);

        // ...as does the floor, which shows well from up there...
        dragThrough(onFloor(10.5, 1));
        expect(objectTransform().dir).toEqual([0, 1, 0]);
        frame(1);
        expect(view().polar).toBeCloseTo(20, 9);

        // ...but back on the wall the object has turned since the drag began, and the view comes down to see it.
        dragThrough(onWall(12.6, 1));
        expect(objectTransform().dir).toEqual([0, 0, 1]);
        frame(1);
        expect(view().polar).toBeGreaterThan(21);
        expect(view().polar).toBeLessThanOrEqual(45 + 1e-6);
    });
});

describe("a move the object can't follow", () => {
    it("shows red while the object is held back on its own face, and not once it catches up", () => {
        hangCanvas(10.5, 1);
        expect(press(onWall(10.5, 1))).toBe(true);
        dragThrough(onWall(11, 1), onWall(12.4, 1));
        expect(objectTransform().pos).toEqual([WALL_X_MAX - 0.5, 1, WALL_Z]);
        expect(blocked()).toBe(false);

        // On along the wall, too near its end for the object to be centred under the pointer.
        dragThrough(onWall(12.9, 1));
        expect(objectTransform().pos).toEqual([WALL_X_MAX - 0.5, 1, WALL_Z]);
        expect(blocked()).toBe(true);
        dragThrough(onWall(12.5, 1));
        expect(blocked()).toBe(false);

        dragThrough(onWall(12.9, 1));
        release();
        expect(blocked()).toBe(false);
    });

    it("shows red over another face that has no place for it, and leaves it where it was", () => {
        // From the south-east, so that the wall's east end shows as well: a face one unit across.
        placeCamera({x: 17, y: 1.2, z: WALL_Z + 5}, {x: 12.5, y: 1, z: WALL_Z});
        hangCanvas(10.5, 1, 2, 2);
        const wallEnd = screenPointOf({x: WALL_X_MAX, y: 1, z: WALL_Z - 0.5 * WALL_THICKNESS});

        expect(press(onWall(10.5, 1))).toBe(true);
        dragThrough(onWall(11, 1), wallEnd);
        expect(objectTransform()).toEqual({pos: [11, 1, WALL_Z], dir: [0, 0, 1], scale: [2, 2, 1]});
        expect(blocked()).toBe(true);

        dragThrough(onWall(11.5, 1));
        expect(objectTransform().pos).toEqual([11.5, 1, WALL_Z]);
        expect(blocked()).toBe(false);
    });

    it("turns the outline and its handles red meanwhile, and back", async () => {
        // The outline is made the first time something is selected, and the handles the first time some are wanted.
        const settle = () => new Promise(resolve => setTimeout(resolve, 0));
        const frame = () => updateObservable.set(1 / 60);
        const outlineColor = () => (WorldSpaceOutlineRect as unknown as {lastColor: string | null}).lastColor;
        const handleColors = () => [...new Set(GraphicsManager.getScene().children
            .filter(child => (child as THREE.Mesh).isMesh && child.visible)
            .map(child => ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHexString()))];

        hangCanvas(10.5, 1);
        await settle();
        frame();
        await settle();
        frame();
        expect(handleColors()).toEqual(["ffff00"]);

        expect(press(onWall(10.5, 1))).toBe(true);
        dragThrough(onWall(11, 1), onWall(12.9, 1));
        frame();
        expect(outlineColor()).toBe(SELECTION_BLOCKED_COLOR);
        expect(handleColors()).toEqual([new THREE.Color(SELECTION_BLOCKED_COLOR).getHexString()]);

        dragThrough(onWall(12.5, 1));
        frame();
        expect(outlineColor()).toBe(SELECTION_COLOR);
        expect(handleColors()).toEqual(["ffff00"]);

        // Let go while blocked: nothing stays red.
        dragThrough(onWall(12.9, 1));
        release();
        frame();
        expect(outlineColor()).toBe(SELECTION_COLOR);
        expect(handleColors()).toEqual(["ffff00"]);
    });
});

describe("a prop dragged to a spot that takes it only turned", () => {
    useFixturePictures();
    // An everyday object a unit wide and half a unit tall, and one the other way about.
    const wide = FIXTURE_PICTURES.wide, tall = FIXTURE_PICTURES.tall;

    // Three tops in one plane, each clear of the next: one a unit square, one half as wide (the west half of
    // such a square), and one half as deep (the north half of one).
    const ON_WHOLE = {x: 9.5, y: BLOCK_TOP_Y, z: BLOCKS_Z + 0.75};
    const NARROW = {x: 11.25, y: BLOCK_TOP_Y, z: BLOCKS_Z + 0.5};
    const SHALLOW = {x: 13.5, y: BLOCK_TOP_Y, z: BLOCKS_Z + 0.25};

    beforeEach(() => {
        standBlocks(9);
        standBlocks(11, 0.5, 1);
        standBlocks(13, 1, 0.5);
        lookDownOnTheBlocks();
    });

    it("turns a quarter onto a top too narrow for it as it lies, as one edit", () => {
        attachProp(wide, ON_WHOLE, UP);
        expect(press(screenPointOf(ON_WHOLE))).toBe(true);
        dragThrough(onTops(9.6, BLOCKS_Z + 0.7), screenPointOf(NARROW));

        expect(objectTransform()).toEqual({pos: [NARROW.x, NARROW.y, NARROW.z], dir: [0, 1, 0], scale: [0.5, 1, 1]});
        expect(quarterTurns()).toBe(1);
        expect(blocked()).toBe(false);
        expect(sentSignals()).toEqual([]);

        release();
        expect(sentSignals()).toEqual([["metadata", OBJECT_ID, ObjectMetadataKeyEnumMap.QuarterTurns,
            [NARROW.x, NARROW.y, NARROW.z], [0.5, 1, 1]]]);
    });

    it("lies as it did on a top wide enough for it, however near the edge the pointer goes", () => {
        attachProp(wide, ON_WHOLE, UP);
        expect(press(screenPointOf(ON_WHOLE))).toBe(true);
        // To the square top's east edge, where it would overhang if it followed.
        dragThrough(onTops(9.6, BLOCKS_Z + 0.7), onTops(9.95, BLOCKS_Z + 0.75));
        expect(objectTransform()).toEqual({pos: [ON_WHOLE.x, ON_WHOLE.y, ON_WHOLE.z], dir: [0, 1, 0], scale: [1, 0.5, 1]});
        expect(quarterTurns()).toBe(0);
        expect(blocked()).toBe(true);

        // And over to a top as wide as it is: it goes as it lies.
        dragThrough(screenPointOf(SHALLOW));
        expect(objectTransform()).toEqual({pos: [SHALLOW.x, SHALLOW.y, SHALLOW.z], dir: [0, 1, 0], scale: [1, 0.5, 1]});
        expect(quarterTurns()).toBe(0);
        expect(blocked()).toBe(false);

        release();
        expect(sentSignals()).toEqual([["transform", OBJECT_ID, [SHALLOW.x, SHALLOW.y, SHALLOW.z], [1, 0.5, 1]]]);
    });

    it("lies as it started again once the pointer is back where that fits", () => {
        attachProp(wide, ON_WHOLE, UP);
        expect(press(screenPointOf(ON_WHOLE))).toBe(true);
        dragThrough(onTops(9.6, BLOCKS_Z + 0.7), screenPointOf(NARROW));
        expect(quarterTurns()).toBe(1);

        dragThrough(screenPointOf(ON_WHOLE));
        expect(objectTransform()).toEqual({pos: [ON_WHOLE.x, ON_WHOLE.y, ON_WHOLE.z], dir: [0, 1, 0], scale: [1, 0.5, 1]});
        expect(quarterTurns()).toBe(0);
        release();
        expect(sentSignals()).toEqual([]);
    });

    it("turns the other way about: a tall one onto a top too shallow for it", () => {
        const start = {x: 9.25, y: BLOCK_TOP_Y, z: BLOCKS_Z + 0.5};
        attachProp(tall, start, UP);
        expect(drag(screenPointOf(start), onTops(9.3, BLOCKS_Z + 0.5), screenPointOf(SHALLOW))).toBe(true);
        expect(objectTransform()).toEqual({pos: [SHALLOW.x, SHALLOW.y, SHALLOW.z], dir: [0, 1, 0], scale: [1, 0.5, 1]});
        expect(quarterTurns()).toBe(1);
    });

    it("is turned back by the next such move, not on round", () => {
        attachProp(wide, ON_WHOLE, UP);
        expect(drag(screenPointOf(ON_WHOLE), onTops(9.6, BLOCKS_Z + 0.7), screenPointOf(NARROW))).toBe(true);
        expect(quarterTurns()).toBe(1);

        // Turned, it is too deep for the shallow top.
        expect(drag(screenPointOf(NARROW), onTops(11.3, BLOCKS_Z + 0.5), screenPointOf(SHALLOW))).toBe(true);
        expect(objectTransform()).toEqual({pos: [SHALLOW.x, SHALLOW.y, SHALLOW.z], dir: [0, 1, 0], scale: [1, 0.5, 1]});
        expect(quarterTurns()).toBe(0);
    });

    it("turns onto a face of another plane as well: from the wall onto the narrow top", () => {
        attachProp(wide, {x: 10.5, y: 1, z: WALL_Z}, SOUTH);
        expect(drag(onWall(10.5, 1), onWall(10.7, 1), screenPointOf(NARROW))).toBe(true);
        expect(objectTransform()).toEqual({pos: [NARROW.x, NARROW.y, NARROW.z], dir: [0, 1, 0], scale: [0.5, 1, 1]});
        expect(quarterTurns()).toBe(1);
    });

    it("leaves a canvas as it lies: only a prop turns to fit", () => {
        attach(canvasTypeIndex, ON_WHOLE, UP, {x: 1, y: 0.5, z: 1});
        expect(press(screenPointOf(ON_WHOLE))).toBe(true);
        dragThrough(onTops(9.6, BLOCKS_Z + 0.7), screenPointOf(NARROW));
        expect(objectTransform()).toEqual({pos: [ON_WHOLE.x, ON_WHOLE.y, ON_WHOLE.z], dir: [0, 1, 0], scale: [1, 0.5, 1]});
        expect(quarterTurns()).toBe(0);
        expect(blocked()).toBe(true);
    });
});

describe("the rotate tool of the selected object", () => {
    useFixturePictures();
    const selection = () => objectSelectionObservable.peek()!;

    it("turns the object where it stands, where it fits there turned", () => {
        hangCanvas(10.5, 0.75, 1, 0.5);
        expect(ObjectEditUtil.canQuarterTurn(selection())).toBe(true);
        ObjectEditUtil.tryQuarterTurn(selection());

        // As wide as it was tall, its bottom edge where it was.
        expect(objectTransform()).toEqual({pos: [10.5, 1, WALL_Z], dir: [0, 0, 1], scale: [0.5, 1, 1]});
        expect(quarterTurns()).toBe(1);
        expect(sentSignals()).toEqual([["metadata", OBJECT_ID, ObjectMetadataKeyEnumMap.QuarterTurns,
            [10.5, 1, WALL_Z], [0.5, 1, 1]]]);
    });

    it("shifts it a grid step first where it only fits so: lying along one half of a square top", () => {
        standBlocks(10);
        attach(canvasTypeIndex, {x: 10.5, y: BLOCK_TOP_Y, z: BLOCKS_Z + 0.75}, UP, {x: 1, y: 0.5, z: 1});
        expect(ObjectEditUtil.canQuarterTurn(selection())).toBe(true);
        ObjectEditUtil.tryQuarterTurn(selection());
        // Along the whole of the top, across its middle.
        expect(objectTransform()).toEqual({pos: [10.5, BLOCK_TOP_Y, BLOCKS_Z + 0.5], dir: [0, 1, 0], scale: [0.5, 1, 1]});
        expect(quarterTurns()).toBe(1);

        // And on round, where it now stands.
        ObjectEditUtil.tryQuarterTurn(selection());
        expect(objectTransform()).toEqual({pos: [10.5, BLOCK_TOP_Y, BLOCKS_Z + 0.5], dir: [0, 1, 0], scale: [1, 0.5, 1]});
        expect(quarterTurns()).toBe(2);
    });

    it("keeps its top edge instead at the top of a wall", () => {
        hangCanvas(10.5, WALL_TOP_Y - 0.25, 1, 0.5);
        ObjectEditUtil.tryQuarterTurn(selection());
        expect(objectTransform()).toEqual({pos: [10.5, WALL_TOP_Y - 0.5, WALL_Z], dir: [0, 0, 1], scale: [0.5, 1, 1]});
    });

    it("shifts it along a wall from the end it stands at, on the bottom edge it had", () => {
        hangCanvas(WALL_X_MIN + 0.25, 0.5, 0.5, 1);
        ObjectEditUtil.tryQuarterTurn(selection());
        expect(objectTransform()).toEqual({pos: [WALL_X_MIN + 0.5, 0.25, WALL_Z], dir: [0, 0, 1], scale: [1, 0.5, 1]});
    });

    it("turns a prop the same way, the size its image pins it to turning with it", () => {
        standBlocks(10);
        attachProp(FIXTURE_PICTURES.wide, {x: 10.5, y: BLOCK_TOP_Y, z: BLOCKS_Z + 0.25}, UP);
        expect(ObjectEditUtil.canQuarterTurn(selection())).toBe(true);
        ObjectEditUtil.tryQuarterTurn(selection());
        expect(objectTransform()).toEqual({pos: [10.5, BLOCK_TOP_Y, BLOCKS_Z + 0.5], dir: [0, 1, 0], scale: [0.5, 1, 1]});
        expect(quarterTurns()).toBe(1);
    });

    it("is not offered where the object fits turned nowhere within a grid step", () => {
        // On the south side of blocks standing by themselves, a unit wide and one layer tall.
        standBlocks(10);
        const middle = {x: 10.5, y: 0.5 * COLLISION_LAYER_HEIGHT, z: BLOCKS_Z + 1};
        attach(canvasTypeIndex, middle, SOUTH, {x: 1, y: 0.5, z: 1});
        expect(ObjectEditUtil.canQuarterTurn(selection())).toBe(false);

        ObjectEditUtil.tryQuarterTurn(selection());
        expect(objectTransform()).toEqual({pos: [middle.x, middle.y, middle.z], dir: [0, 0, 1], scale: [1, 0.5, 1]});
        expect(quarterTurns()).toBe(0);
        expect(sentSignals()).toEqual([]);
    });
});
