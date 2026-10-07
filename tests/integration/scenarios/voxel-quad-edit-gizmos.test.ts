/**
 * Scenario tests: reshaping a block by the selection outline of one of its faces (see
 * VoxelQuadEditGizmos), driven as the player drives it: presses, drags and releases on the canvas, seen
 * through a real camera and passed through the canvas's own arbitration (see GizmoDragUtil).
 * Covers: which bounds of a block get a handle on which face; a handle carrying its bound between the
 * cell's side and mid-cell, with the dead band between; the walkthrough of the note the feature came
 * from; each gesture previewed locally and sent as one edit, or put back when cancelled or when another
 * edit comes in; the face itself taking no drag, so that one turns the view; the gizmo standing down
 * under scripted locks and in a restricted zone; the wireframe the selection draws around the whole cell
 * of the selected block (see VoxelQuadSelection).
 * Browser-bound client modules are stubbed; the grid, the rules and the gizmo run for real.
 */
import * as THREE from "three";
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
        emitSetVoxelBlockShapeSignal: vi.fn(),
    },
}));

import App from "../../../src/client/app";
import GraphicsManager from "../../../src/client/graphics/graphicsManager";
import "../../../src/client/graphics/types/gizmo/voxelQuadEditGizmos";
import GizmoDragUtil from "../../../src/client/graphics/util/gizmoDragUtil";
import SelectionEditGizmoUtil from "../../../src/client/graphics/util/selectionEditGizmoUtil";
import SocketsClient from "../../../src/client/networking/client/socketsClient";
import ClientVoxelManager from "../../../src/client/voxel/clientVoxelManager";
import { clientFeatureFlagsObservable, gameModeObservable, objectSelectionObservable, updateObservable,
    voxelBlockPreviewObservable, voxelQuadSelectionObservable,
    voxelQuadSelectionRestrictionObservable } from "../../../src/client/system/clientObservables";
import { FeatureFlag } from "../../../src/shared/system/types/featureFlag";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MIN, VOXEL_BLOCK_SHAPE_EMPTY,
    VOXEL_BLOCK_SHAPE_WHOLE } from "../../../src/shared/system/sharedConstants";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import RestrictedZone from "../../../src/shared/voxel/types/restrictedZone";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import Room from "../../../src/shared/room/types/room";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import { createEditingUser } from "../helpers/mockUser";
import { createRoom, currentSelection, forceSelect, quadIndexOf } from "../helpers/selectionHarness";
import { cursorAt, drag, dragThrough, placeCamera, press, release, screenPointOf,
    ScreenPoint } from "../helpers/gizmoHarness";

// The acting user (editing utilities require one).
const actingUser = createEditingUser();

const ROOM_ID = "quad-gizmo-room";
const TEXTURES = [1, 2, 3, 4, 5, 6];

// The shapes of the note's walkthrough, with north towards -z and east towards +x: the west half, its
// north quarter, the north half.
const WEST_HALF = 0b0101, EAST_HALF = 0b1010, NORTH_HALF = 0b0011, NORTH_WEST_QUARTER = 0b0001;

// A block standing by itself on the room's floor, well away from the walls.
const ROW = 10, COL = 10, LAYER = COLLISION_LAYER_MIN;
const TOP_Y = (LAYER + 1) * COLLISION_LAYER_HEIGHT;
const MID_Y = (LAYER + 0.5) * COLLISION_LAYER_HEIGHT;

let room: Room;

function shapeAt(row: number, col: number, layer: number = LAYER): number
{
    return VoxelQueryUtil.getVoxelBlockShapeAt(room.voxelGrid.voxels, row, col, layer);
}

// Puts a block up as generation would: nothing is checked, and nothing is sent.
function putBlock(row: number, col: number, layer: number = LAYER, shape: number = VOXEL_BLOCK_SHAPE_WHOLE): void
{
    VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels, quadIndexOf(row, col, "y", "+", layer), TEXTURES,
        undefined, shape);
}

function selectFace(axis: "x" | "y" | "z", orientation: "-" | "+", row: number = ROW, col: number = COL,
    layer: number = LAYER): void
{
    forceSelect(room, quadIndexOf(row, col, axis, orientation, layer));
}

// The camera to the south of the block and above it, so that its top and south faces show. (All of them
// stand under the slab between the room's two storeys.)
function lookFromTheSouth(): void
{
    placeCamera({x: COL + 0.5, y: 3.2, z: ROW + 5}, {x: COL + 0.5, y: MID_Y, z: ROW + 0.5});
}

function lookFromTheEast(): void
{
    placeCamera({x: COL + 5, y: 3.2, z: ROW + 0.5}, {x: COL + 0.5, y: MID_Y, z: ROW + 0.5});
}

function handleIds(): string[]
{
    return (SelectionEditGizmoUtil.getGrabPoints()?.handles ?? []).map(handle => handle.id).sort();
}

function handle(id: string): ScreenPoint
{
    const found = SelectionEditGizmoUtil.getGrabPoints()?.handles.find(candidate => candidate.id == id);
    if (found == undefined)
        throw new Error(`No handle "${id}" is shown (shown: ${handleIds().join(", ") || "none"})`);
    return {x: found.x, y: found.y};
}

// The signals sent since the last time this was asked, as [kind, ...what they say].
function sentSignals(): unknown[][]
{
    const sent: unknown[][] = [];
    for (const [signal] of (SocketsClient.emitSetVoxelBlockShapeSignal as Mock).mock.calls)
        sent.push(["reshape", signal.quadIndex, signal.shape]);
    (SocketsClient.emitSetVoxelBlockShapeSignal as Mock).mockClear();
    return sent;
}

// Where the pointer has to be for a bound held by its handle to be asked to a place across its cell (from
// 0 at the cell's low side to 1 at its high side), on the face it is dragged across.
function onSouthFace(acrossCell: number, faceZ: number = ROW + 1): ScreenPoint
{
    return screenPointOf({x: COL + acrossCell, y: MID_Y, z: faceZ});
}

function onEastFace(acrossCell: number, faceX: number = COL + 1): ScreenPoint
{
    return screenPointOf({x: faceX, y: MID_Y, z: ROW + acrossCell});
}

const BLOCK_QUAD = quadIndexOf(ROW, COL, "y", "-", LAYER); // the first of the block's quads, which signals name it by

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    for (const flag of [FeatureFlag.DisableManualVoxelBlockResize, FeatureFlag.DisableVoxelQuadSelectionChange,
        FeatureFlag.DisableAllSelectionChange])
    {
        clientFeatureFlagsObservable.tryRemove(flag);
    }
    voxelQuadSelectionRestrictionObservable.set(null);
    gameModeObservable.set("edit");
    voxelQuadSelectionObservable.set(null);
    objectSelectionObservable.set(null);

    (App.getUser as Mock).mockReturnValue(actingUser);
    room = createRoom(ROOM_ID);
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
    putBlock(ROW, COL);
    lookFromTheSouth();
    sentSignals();
});

afterEach(() => {
    GizmoDragUtil.cancel();
    ClientVoxelManager.cancelVoxelBlockPreview();
    vi.restoreAllMocks();
});

// ─── Handles ────────────────────────────────────────────────────────────────

describe("a selected face's resize handles", () => {
    it("sit on the edges that are bounds of the block across the way the face looks", () => {
        selectFace("z", "+");
        expect(handleIds()).toEqual(["maxX", "minX"]);
        selectFace("x", "+");
        expect(handleIds()).toEqual(["maxZ", "minZ"]);
        // A top or bottom face has all four of the block's bounds for edges.
        selectFace("y", "+");
        expect(handleIds()).toEqual(["maxX", "maxZ", "minX", "minZ"]);
    });

    it("are on the outline, at the middle of each edge", () => {
        selectFace("z", "+");
        const grabPoints = SelectionEditGizmoUtil.getGrabPoints()!;
        expect(grabPoints.kind).toBe("voxelQuad");
        expect(grabPoints.canResize).toBe(true);
        expect(grabPoints.middle).toEqual(screenPointOf({x: COL + 0.5, y: MID_Y, z: ROW + 1}));
        expect(grabPoints.corners.length).toBe(4);

        const east = screenPointOf({x: COL + 1.08, y: MID_Y, z: ROW + 1});
        expect(handle("maxX").x).toBeCloseTo(east.x, 6);
        expect(handle("maxX").y).toBeCloseTo(east.y, 6);
        // Hovering there shows what a press would take hold of.
        expect(cursorAt(handle("maxX"))).toBe("ew-resize");
    });

    it("are only on bounds that have another place to go", () => {
        // Half as wide as its cell along x: its bound at the cell's side can neither come in nor go out.
        room.voxelGrid.quadsMem.blockShapes[VoxelQueryUtil.getVoxelBlockIndex(ROW, COL, LAYER)] = WEST_HALF;
        selectFace("z", "+");
        expect(handleIds()).toEqual(["maxX"]);
        selectFace("x", "+");
        expect(handleIds()).toEqual(["maxZ", "minZ"]);
        selectFace("y", "+");
        expect(handleIds()).toEqual(["maxX", "maxZ", "minZ"]);

        room.voxelGrid.quadsMem.blockShapes[VoxelQueryUtil.getVoxelBlockIndex(ROW, COL, LAYER)] = NORTH_WEST_QUARTER;
        selectFace("z", "+");
        expect(handleIds()).toEqual(["maxX"]);
        selectFace("x", "+");
        expect(handleIds()).toEqual(["maxZ"]);
        selectFace("y", "+");
        expect(handleIds()).toEqual(["maxX", "maxZ"]);
    });

    it("are none on the room's own floor, which is no block's face", () => {
        forceSelect(room, VoxelQueryUtil.getFloorVoxelQuadIndex(ROW, COL + 3));
        expect(SelectionEditGizmoUtil.getGrabPoints()).toBeNull();
    });
});

// ─── Resizing ───────────────────────────────────────────────────────────────

describe("dragging a resize handle", () => {
    it("carries the note's walkthrough: four drags, each one edit, back to a whole block", () => {
        // 1. The south face's east handle, dragged west: the east half goes.
        selectFace("z", "+");
        expect(drag(handle("maxX"), onSouthFace(0.8), onSouthFace(0.58))).toBe(true);
        expect(shapeAt(ROW, COL)).toBe(WEST_HALF);
        expect(sentSignals()).toEqual([["reshape", BLOCK_QUAD, WEST_HALF]]);

        // 2. The east face (now in mid-cell), its south handle dragged north: a quarter is left.
        lookFromTheEast();
        selectFace("x", "+");
        expect(drag(handle("maxZ"), onEastFace(0.8, COL + 0.5), onEastFace(0.58, COL + 0.5))).toBe(true);
        expect(shapeAt(ROW, COL)).toBe(NORTH_WEST_QUARTER);
        expect(sentSignals()).toEqual([["reshape", BLOCK_QUAD, NORTH_WEST_QUARTER]]);

        // 3. The south face (now in mid-cell too), its east handle dragged east: the north half.
        lookFromTheSouth();
        selectFace("z", "+");
        expect(drag(handle("maxX"), onSouthFace(0.8, ROW + 0.5), onSouthFace(1.08, ROW + 0.5))).toBe(true);
        expect(shapeAt(ROW, COL)).toBe(NORTH_HALF);
        expect(sentSignals()).toEqual([["reshape", BLOCK_QUAD, NORTH_HALF]]);

        // 4. The east face (back at the cell's side), its south handle dragged south: whole again.
        lookFromTheEast();
        selectFace("x", "+");
        expect(drag(handle("maxZ"), onEastFace(0.8), onEastFace(1.08))).toBe(true);
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(sentSignals()).toEqual([["reshape", BLOCK_QUAD, VOXEL_BLOCK_SHAPE_WHOLE]]);
    });

    it("moves the bound by the handle's own side: the west handle leaves the east half", () => {
        selectFace("z", "+");
        expect(drag(handle("minX"), onSouthFace(0.2), onSouthFace(0.42))).toBe(true);
        expect(shapeAt(ROW, COL)).toBe(EAST_HALF);
        expect(sentSignals()).toEqual([["reshape", BLOCK_QUAD, EAST_HALF]]);
    });

    it("takes the bound over only once it is carried past halfway, and a little more", () => {
        selectFace("z", "+");
        const grip = handle("maxX"); // at 1.08 across the cell, so the pointer leads the bound by 0.08
        expect(press(grip)).toBe(true);

        dragThrough(onSouthFace(0.9), onSouthFace(0.74 + 0.08));
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        dragThrough(onSouthFace(0.68 + 0.08));
        expect(shapeAt(ROW, COL)).toBe(WEST_HALF);
        // Coming back, it has as far to go the other way before it returns.
        dragThrough(onSouthFace(0.76 + 0.08));
        expect(shapeAt(ROW, COL)).toBe(WEST_HALF);
        dragThrough(onSouthFace(0.82 + 0.08));
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        release();
    });

    it("shows each change at once and sends the outcome once, on release", () => {
        selectFace("z", "+");
        expect(press(handle("maxX"))).toBe(true);
        dragThrough(onSouthFace(0.9), onSouthFace(0.5), onSouthFace(1.1), onSouthFace(0.5));
        expect(shapeAt(ROW, COL)).toBe(WEST_HALF);
        expect(voxelBlockPreviewObservable.peek()).toBe(true);
        expect(sentSignals()).toEqual([]);

        release();
        expect(sentSignals()).toEqual([["reshape", BLOCK_QUAD, WEST_HALF]]);
        expect(voxelBlockPreviewObservable.peek()).toBe(false);
        expect(room.dirty).toBe(true);
    });

    it("sends nothing for a drag that ends where it began, or for a press that never becomes a drag", () => {
        selectFace("z", "+");
        expect(drag(handle("maxX"), onSouthFace(0.9), onSouthFace(0.5), onSouthFace(1.1))).toBe(true);
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);

        expect(press(handle("maxX"))).toBe(true);
        release();
        expect(sentSignals()).toEqual([]);
    });

    it("puts the block back when the drag is abandoned", () => {
        selectFace("z", "+");
        expect(press(handle("maxX"))).toBe(true);
        dragThrough(onSouthFace(0.9), onSouthFace(0.5));
        expect(shapeAt(ROW, COL)).toBe(WEST_HALF);

        GizmoDragUtil.cancel(); // a second finger, or the canvas losing focus
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(sentSignals()).toEqual([]);
        expect(voxelBlockPreviewObservable.peek()).toBe(false);
        expect(currentSelection(room)!.quadIndex).toBe(quadIndexOf(ROW, COL, "z", "+", LAYER));
    });

    it("keeps the selection on the face through the drag, and the handles on its new edges", () => {
        selectFace("z", "+");
        expect(drag(handle("maxX"), onSouthFace(0.9), onSouthFace(0.5))).toBe(true);
        expect(currentSelection(room)!.quadIndex).toBe(quadIndexOf(ROW, COL, "z", "+", LAYER));
        // The bound it moved is the only one left with somewhere to go, and its handle went with it.
        expect(handleIds()).toEqual(["maxX"]);
        const east = screenPointOf({x: COL + 0.58, y: MID_Y, z: ROW + 1});
        expect(handle("maxX").x).toBeCloseTo(east.x, 6);
    });

    it("moves the selection to a face that shows when the drag covers the one it was on", () => {
        // The block's east face looks across at a block that covers only its north half.
        putBlock(ROW, COL + 1, LAYER, NORTH_HALF);
        lookFromTheEast();
        placeCamera({x: COL + 5, y: 3.2, z: ROW + 2.5}, {x: COL + 1, y: MID_Y, z: ROW + 0.75});
        selectFace("x", "+");
        expect(currentSelection(room)!.visible).toBe(true);

        // Shrunk to its own north half, that face lies wholly against the other block.
        expect(drag(handle("maxZ"), onEastFace(0.9), onEastFace(0.5))).toBe(true);
        expect(shapeAt(ROW, COL)).toBe(NORTH_HALF);
        const after = currentSelection(room)!;
        expect(after.visible).toBe(true);
        expect([after.row, after.col, after.layer]).toEqual([ROW, COL, LAYER]);
        expect(after.quadIndex).not.toBe(quadIndexOf(ROW, COL, "x", "+", LAYER));
    });

    it("leaves a block as it is where the change would strand what hangs on it", () => {
        // A canvas over the whole of the south face.
        const canvas = new AddObjectSignal(room.id, actingUser.id, actingUser.userName,
            ObjectTypeConfigMap.getIndexByType("Canvas"), "canvas-on-block",
            new ObjectTransform({x: COL + 0.5, y: MID_Y, z: ROW + 1}, {x: 0, y: 0, z: 1}, {x: 1, y: 0.5, z: 1}));
        expect(ObjectUpdateUtil.addObject(actingUser, room, canvas)).toBe(true);

        selectFace("z", "+");
        expect(drag(handle("maxX"), onSouthFace(0.9), onSouthFace(0.5))).toBe(true);
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(sentSignals()).toEqual([]);
    });
});

// ─── The cell's wireframe ───────────────────────────────────────────────────

describe("the wireframe around the selected block's cell", () => {
    // What the scene draws of it: nothing while it is hidden, or not yet made.
    const shownWireBoxes = () => GraphicsManager.getScene().children.filter(
        child => (child as THREE.LineSegments).isLineSegments && child.visible) as THREE.LineSegments[];
    // It is made the first time one is wanted, which takes a moment.
    const settle = () => new Promise(resolve => setTimeout(resolve, 0));
    const frame = () => updateObservable.set(1 / 60);
    const setShape = (shape: number, row: number = ROW, col: number = COL) => {
        room.voxelGrid.quadsMem.blockShapes[VoxelQueryUtil.getVoxelBlockIndex(row, col, LAYER)] = shape;
    };
    // The corners of the box it is drawn around, lowest and highest (to the precision its vertices are
    // stored in).
    const boxOf = (wireBox: THREE.LineSegments) => {
        wireBox.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(wireBox);
        return [box.min, box.max].map(corner => corner.toArray().map(value => Math.round(value * 1e5) / 1e5 + 0));
    };
    const cellBox = (row: number, col: number, layer: number = LAYER) =>
        [[col, layer * COLLISION_LAYER_HEIGHT, row], [col + 1, (layer + 1) * COLLISION_LAYER_HEIGHT, row + 1]];

    it("runs along the twelve edges of the whole cell layer, whether the block fills it or a part of it", async () => {
        for (const shape of [VOXEL_BLOCK_SHAPE_WHOLE, WEST_HALF, EAST_HALF, NORTH_HALF, NORTH_WEST_QUARTER])
        {
            setShape(shape);
            selectFace("y", "+");
            await settle();

            const shown = shownWireBoxes();
            expect(shown.length, `shape ${shape}`).toBe(1);
            expect(shown[0].geometry.getAttribute("position").count, `shape ${shape}`).toBe(2 * 12);
            expect(boxOf(shown[0]), `shape ${shape}`).toEqual(cellBox(ROW, COL));
        }
    });

    it("is a thin green line seen through whatever stands before it, and through the room's fog", async () => {
        setShape(WEST_HALF);
        selectFace("z", "+");
        await settle();

        const material = shownWireBoxes()[0].material as THREE.LineBasicMaterial;
        // (Lines of this kind are a pixel thick, whatever width they are given.)
        expect(material.isLineBasicMaterial).toBe(true);
        expect(material.color.getHexString()).toBe("00ff00");
        expect(material.depthTest).toBe(false);
        expect(material.fog).toBe(false);
    });

    it("is around the selected block's own layer of its cell, not the stack it stands in", async () => {
        putBlock(ROW, COL, LAYER + 1);
        selectFace("z", "+", ROW, COL, LAYER + 1);
        await settle();
        expect(shownWireBoxes().map(boxOf)).toEqual([cellBox(ROW, COL, LAYER + 1)]);
    });

    it("goes with the selection from block to block, and goes away from what is no block's", async () => {
        setShape(WEST_HALF);
        putBlock(ROW, COL + 3, LAYER, NORTH_HALF);
        putBlock(ROW, COL - 3);

        selectFace("x", "+");
        await settle();
        expect(shownWireBoxes().map(boxOf)).toEqual([cellBox(ROW, COL)]);

        selectFace("y", "+", ROW, COL + 3);
        expect(shownWireBoxes().map(boxOf)).toEqual([cellBox(ROW, COL + 3)]);

        selectFace("y", "+", ROW, COL - 3);
        expect(shownWireBoxes().map(boxOf)).toEqual([cellBox(ROW, COL - 3)]);

        forceSelect(room, VoxelQueryUtil.getFloorVoxelQuadIndex(ROW, COL + 5)); // the room's own floor
        expect(shownWireBoxes()).toEqual([]);

        selectFace("y", "+", ROW, COL + 3);
        expect(shownWireBoxes().length).toBe(1);
        voxelQuadSelectionObservable.set(null);
        expect(shownWireBoxes()).toEqual([]);
    });

    it("stays around the whole cell while a handle reshapes the block within it", async () => {
        selectFace("z", "+");
        await settle();
        expect(shownWireBoxes().map(boxOf)).toEqual([cellBox(ROW, COL)]);

        expect(press(handle("maxX"))).toBe(true);
        dragThrough(onSouthFace(0.9), onSouthFace(0.5));
        frame();
        expect(shapeAt(ROW, COL)).toBe(WEST_HALF);
        expect(shownWireBoxes().map(boxOf)).toEqual([cellBox(ROW, COL)]);

        release();
        expect(shownWireBoxes().map(boxOf)).toEqual([cellBox(ROW, COL)]);
    });
});

// ─── The face itself ────────────────────────────────────────────────────────

describe("the selected face itself", () => {
    const TOP = {x: COL + 0.5, y: TOP_Y, z: ROW + 0.5};

    it("takes no press, so a drag that starts on it turns the view", () => {
        selectFace("y", "+");
        expect(cursorAt(screenPointOf(TOP))).toBe("");
        expect(press(screenPointOf(TOP))).toBe(false);

        // Dragged off the block onto the floor beside it: the block stays where it stands.
        expect(drag(screenPointOf(TOP), screenPointOf({x: COL + 0.9, y: TOP_Y, z: ROW + 0.5}),
            screenPointOf({x: COL + 1.5, y: 0, z: ROW + 0.5}))).toBe(false);
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(shapeAt(ROW, COL + 1)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);
        expect(currentSelection(room)!.quadIndex).toBe(quadIndexOf(ROW, COL, "y", "+", LAYER));
        expect(voxelBlockPreviewObservable.peek()).toBe(false);
        expect(sentSignals()).toEqual([]);
    });
});

// ─── Interruptions ──────────────────────────────────────────────────────────

describe("a resize under way", () => {
    it("is ended by another edit of the room's blocks coming in, with the block put back first", async () => {
        selectFace("z", "+");
        expect(press(handle("maxX"))).toBe(true);
        dragThrough(onSouthFace(0.9), onSouthFace(0.5));
        expect(shapeAt(ROW, COL)).toBe(WEST_HALF);

        // Somebody else builds in the cell beside the block.
        await ClientVoxelManager.onAddVoxelBlockSignalReceived(new AddVoxelBlockSignal(ROOM_ID,
            quadIndexOf(ROW, COL + 1, "y", "-", LAYER), [9, 9, 9, 9, 9, 9]));

        expect(GizmoDragUtil.isActive()).toBe(false);
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(shapeAt(ROW, COL + 1)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        const first = quadIndexOf(ROW, COL + 1, "y", "-", LAYER);
        expect(Array.from(room.voxelQuads.subarray(first, first + 6))).toEqual([9, 9, 9, 9, 9, 9]);
        expect(voxelBlockPreviewObservable.peek()).toBe(false);
        release(); // the pointer comes up on a drag that is over already
        expect(sentSignals()).toEqual([]);
    });

    it("is ended when the selection leaves the block", () => {
        putBlock(ROW, COL + 3);
        selectFace("z", "+");
        expect(press(handle("maxX"))).toBe(true);
        dragThrough(onSouthFace(0.9), onSouthFace(0.5));
        expect(shapeAt(ROW, COL)).toBe(WEST_HALF);

        selectFace("z", "+", ROW, COL + 3);
        expect(GizmoDragUtil.isActive()).toBe(false);
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(currentSelection(room)!.col).toBe(COL + 3);
        release();
        expect(sentSignals()).toEqual([]);
    });
});

// ─── Standing down ──────────────────────────────────────────────────────────

describe("the gizmo stands down", () => {
    // Where the south face's east handle shows while there is one.
    const eastHandle = () => screenPointOf({x: COL + 1.08, y: MID_Y, z: ROW + 1});

    it("under the flag a scripted step keeps blocks as they are with, and under the selection locks", () => {
        for (const flag of [FeatureFlag.DisableManualVoxelBlockResize, FeatureFlag.DisableVoxelQuadSelectionChange,
            FeatureFlag.DisableAllSelectionChange])
        {
            selectFace("z", "+");
            expect(SelectionEditGizmoUtil.getGrabPoints(), `before ${FeatureFlag[flag]}`).not.toBeNull();
            expect(cursorAt(eastHandle()), `before ${FeatureFlag[flag]}`).toBe("ew-resize");

            clientFeatureFlagsObservable.tryAdd(flag);
            expect(SelectionEditGizmoUtil.getGrabPoints(), FeatureFlag[flag]).toBeNull();
            expect(press(eastHandle()), FeatureFlag[flag]).toBe(false);
            clientFeatureFlagsObservable.tryRemove(flag);
            expect(SelectionEditGizmoUtil.getGrabPoints(), `after ${FeatureFlag[flag]}`).not.toBeNull();
        }
    });

    it("while a step leaves one quad alone to be selected", () => {
        selectFace("z", "+");
        voxelQuadSelectionRestrictionObservable.set(quadIndexOf(ROW, COL, "z", "+", LAYER));
        expect(SelectionEditGizmoUtil.getGrabPoints()).toBeNull();
        expect(press(eastHandle())).toBe(false);
        voxelQuadSelectionRestrictionObservable.set(null);
        expect(SelectionEditGizmoUtil.getGrabPoints()).not.toBeNull();
    });

    it("outside edit mode", () => {
        selectFace("z", "+");
        gameModeObservable.set("play");
        expect(SelectionEditGizmoUtil.getGrabPoints()).toBeNull();
        expect(press(eastHandle())).toBe(false);
    });

    it("for a block in a restricted zone, but not for one beside it", () => {
        // An ordinary user, whom a hub's zones bind (see RestrictedZoneUtil).
        (App.getUser as Mock).mockReturnValue(createEditingUser(UserTypeEnumMap.Member));
        room.voxelGrid.restrictedZones = [new RestrictedZone(ROW, ROW, COL, COL)];
        selectFace("z", "+");
        expect(SelectionEditGizmoUtil.getGrabPoints()).toBeNull();
        expect(press(eastHandle())).toBe(false);

        room.voxelGrid.restrictedZones = [new RestrictedZone(ROW, ROW, COL + 1, COL + 1)];
        selectFace("z", "+");
        expect(drag(handle("maxX"), onSouthFace(0.9), onSouthFace(0.5))).toBe(true);
        expect(shapeAt(ROW, COL)).toBe(WEST_HALF);
        expect(sentSignals()).toEqual([["reshape", BLOCK_QUAD, WEST_HALF]]);
    });

    it("mid-drag, when a lock comes down: the block goes back", () => {
        selectFace("z", "+");
        expect(press(handle("maxX"))).toBe(true);
        dragThrough(onSouthFace(0.9), onSouthFace(0.5));
        expect(shapeAt(ROW, COL)).toBe(WEST_HALF);

        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableManualVoxelBlockResize);
        expect(GizmoDragUtil.isActive()).toBe(false);
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        release();
        expect(sentSignals()).toEqual([]);
    });
});
