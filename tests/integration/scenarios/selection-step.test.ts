/**
 * Scenario tests: the selection stepped by a movement key (see SelectionStepUtil). A face goes to the face
 * the room's surface runs on into that way, round a corner where it turns one, and an object to the nearest
 * object lying that way, each as the camera shows it and never onto one turned away from the camera: a
 * face turned away is passed over for the next. Browser-bound client modules are stubbed; the room, the
 * selections and the camera's own projection run for real.
 */
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera();
    const scene = new THREE.Scene();
    // Voxel edits invalidate the light map (see LightBlockMap); a stub suffices.
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {},
        getNearbyLightAt(_worldPos: unknown, out: any) { return out.setRGB(0, 0, 0); } };
    return { default: { getCamera: () => camera, getScene: () => scene,
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
        addToParent() {}
        setTransform() {}
        setTransformRaw() {}
        setVisible() {}
        dispose() {}
    },
}));

// Asked only for the objects the client holds, which each test says for itself.
vi.mock("../../../src/client/object/clientObjectManager", () => ({
    default: { getObjectById: vi.fn() },
}));

import * as THREE from "three";
import App from "../../../src/client/app";
import GraphicsManager from "../../../src/client/graphics/graphicsManager";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import ObjectSelection from "../../../src/client/graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../../src/client/graphics/types/gizmo/voxelQuadSelection";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import SelectionStepUtil from "../../../src/client/graphics/util/selectionStepUtil";
import ScreenDirection from "../../../src/client/graphics/types/screenDirection";
import { cameraModeObservable, clientFeatureFlagsObservable, gameModeObservable, manualSelectionObservable,
    objectSelectionObservable, orbitCameraAngleHoldRequestObservable, orbitCameraTargetOverrideObservable,
    voxelQuadSelectionObservable,
    voxelQuadSelectionRestrictionObservable } from "../../../src/client/system/clientObservables";
import { SELECTION_STEP_OBJECT_REACH } from "../../../src/client/system/clientConstants";
import { FeatureFlag } from "../../../src/shared/system/types/featureFlag";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, GENERATED_WALL_THICKNESS, STOREY_FLOOR_COLLISION_LAYER,
    VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import VolumeObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
// The client's configs of the types these tests select, which register themselves on load (see
// ObjectTypeClientConfigMap): a selection reads off them whether its type is selected by its own control.
import "../../../src/client/object/types/objectTypeClientConfig/canvasObjectTypeClientConfig";
import "../../../src/client/object/types/objectTypeClientConfig/playerObjectTypeClientConfig";
import "../../../src/client/object/types/objectTypeClientConfig/volumeObjectTypeClientConfig";
import Vec3 from "../../../src/shared/math/types/vec3";
import Room from "../../../src/shared/room/types/room";
import { createEditingUser } from "../helpers/mockUser";
import { buildPillar, ceilingQuadIndexOf, createRoom, currentSelection, floorQuadIndexOf, forceSelect,
    isQuadVisible, quadIndexOf, voxelAt } from "../helpers/selectionHarness";

// The acting user (editing utilities require one).
const actingUser = createEditingUser();

const ROOM_ID = "selection-step-room";
const DIRECTIONS: ScreenDirection[] = ["up", "down", "left", "right"];
const OPPOSITE: {[direction in ScreenDirection]: ScreenDirection} =
    {up: "down", down: "up", left: "right", right: "left"};

// Each direction as it runs across the screen: x to the right, y up.
const ON_SCREEN: {[direction in ScreenDirection]: {x: number, y: number}} =
    {up: {x: 0, y: 1}, down: {x: 0, y: -1}, left: {x: -1, y: 0}, right: {x: 1, y: 0}};

let room: Room;

/** Stands the camera at one point looking at another, upright as the game's own always is. */
function viewFrom(eye: Vec3, target: Vec3)
{
    const camera = GraphicsManager.getCamera();
    camera.position.set(eye.x, eye.y, eye.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(target.x, target.y, target.z);
    camera.updateMatrixWorld(true);
}

/** Stands the camera so far off a point along each axis, looking at it. */
function viewFromOffset(target: Vec3, offset: Vec3)
{
    viewFrom({x: target.x + offset.x, y: target.y + offset.y, z: target.z + offset.z}, target);
}

/** Orbits the camera about a point: the azimuth turns it round, and the polar angle is measured from straight up. */
function orbitAbout(target: Vec3, azimuthDeg: number, polarDeg: number, distance: number)
{
    const azimuth = THREE.MathUtils.degToRad(azimuthDeg);
    const polar = THREE.MathUtils.degToRad(polarDeg);
    viewFrom({
        x: target.x + distance * Math.sin(polar) * Math.sin(azimuth),
        y: target.y + distance * Math.cos(polar),
        z: target.z + distance * Math.sin(polar) * Math.cos(azimuth),
    }, target);
}

/** How far a point shows from another in a direction of the screen, by the camera's own projection. */
function shownToward(direction: ScreenDirection, from: Vec3, to: Vec3): number
{
    const camera = GraphicsManager.getCamera();
    const fromPoint = new THREE.Vector3(from.x, from.y, from.z).project(camera);
    const toPoint = new THREE.Vector3(to.x, to.y, to.z).project(camera);
    return (toPoint.x - fromPoint.x) * ON_SCREEN[direction].x + (toPoint.y - fromPoint.y) * ON_SCREEN[direction].y;
}

/** The middle of a face, drawn or not. */
function middleOf(quadIndex: number): Vec3
{
    const dims = VoxelQueryUtil.getVoxelQuadTransformDimensions(room.voxelGrid.voxels, quadIndex, true);
    return {
        x: VoxelQueryUtil.getWorldXAtVoxelColCenter(VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex)) + dims.offsetX,
        y: dims.offsetY,
        z: VoxelQueryUtil.getWorldZAtVoxelRowCenter(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex)) + dims.offsetZ,
    };
}

function selectedQuadIndex(): number | undefined
{
    return voxelQuadSelectionObservable.peek()?.quadIndex;
}

/** Selects a face and steps from it, returning the face the selection is left on. */
function stepFrom(quadIndex: number, direction: ScreenDirection): number | undefined
{
    forceSelect(room, quadIndex);
    SelectionStepUtil.tryStep(direction);
    return selectedQuadIndex();
}

/** Asserts that a step from a face has nowhere to go, and so leaves the selection on it. */
function expectNoStep(quadIndex: number, direction: ScreenDirection)
{
    forceSelect(room, quadIndex);
    expect(SelectionStepUtil.tryStep(direction)).toBe(false);
    expect(selectedQuadIndex()).toBe(quadIndex);
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    for (const flag of [FeatureFlag.DisableAllSelectionChange, FeatureFlag.DisableVoxelQuadSelectionChange,
        FeatureFlag.DisableObjectSelectionChange])
    {
        clientFeatureFlagsObservable.tryRemove(flag);
    }
    voxelQuadSelectionRestrictionObservable.set(null);
    // Selections exist only in edit mode (see GameModeUtil).
    gameModeObservable.set("edit");
    voxelQuadSelectionObservable.set(null);
    objectSelectionObservable.set(null);
    // A selection made in edit mode turns the camera into an orbit that follows it (see WorldSpaceSelectionUtil).
    orbitCameraTargetOverrideObservable.set(null);
    cameraModeObservable.set({type: "firstPerson"});
    orbitCameraAngleHoldRequestObservable.set(false);

    // A hub, so anyone may build; an acting user is still required.
    (App.getUser as Mock).mockReturnValue(actingUser);
    room = createRoom(ROOM_ID);
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
});

// ─── Faces ──────────────────────────────────────────────────────────────────

// The room's own walls along its low-x and low-z sides are several voxels thick: their inner faces, which
// look toward +x and +z, are those of their innermost voxels, and the open floor begins a voxel further in.
const WALL_COL = GENERATED_WALL_THICKNESS - 1;
const WALL_ROW = GENERATED_WALL_THICKNESS - 1;
const FIRST_OPEN_COL = WALL_COL + 1;
const FIRST_OPEN_ROW = WALL_ROW + 1;
const wallFace = (row: number, layer: number) => quadIndexOf(row, WALL_COL, "x", "+", layer);

/** The middle of the block a face belongs to, which is what the orbit turns about with the face selected. */
function blockMiddleOf(quadIndex: number): Vec3
{
    return VoxelQueryUtil.getVoxelBlockBox(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex)).center;
}

/** Asserts that no direction steps the selection off a face. */
function expectNoStepAnyWay(quadIndex: number)
{
    for (const direction of DIRECTIONS)
        expectNoStep(quadIndex, direction);
}

describe("a selected face stepped straight on along its surface", () => {
    it("goes along a wall sideways and up and down it, as a camera facing the wall sees them", () => {
        const start = wallFace(10, 2);
        viewFromOffset(middleOf(start), {x: 6, y: 0, z: 0});

        // Looking toward -x, the view's right runs toward -z, which is the row before.
        expect(stepFrom(start, "right")).toBe(wallFace(9, 2));
        expect(stepFrom(start, "left")).toBe(wallFace(11, 2));
        expect(stepFrom(start, "up")).toBe(wallFace(10, 3));
        expect(stepFrom(start, "down")).toBe(wallFace(10, 1));
    });

    it("says whether the selection moved, and carries on from where the last step left it", () => {
        const start = wallFace(10, 2);
        viewFromOffset(middleOf(start), {x: 6, y: 0, z: 0});
        forceSelect(room, start);

        expect(SelectionStepUtil.tryStep("right")).toBe(true);
        expect(SelectionStepUtil.tryStep("right")).toBe(true);
        expect(SelectionStepUtil.tryStep("up")).toBe(true);

        expect(selectedQuadIndex()).toBe(wallFace(8, 3));
        expect(currentSelection(room)!.visible).toBe(true);
    });

    it("still goes sideways along a wall and up it when the wall is seen steeply from above and at a slant", () => {
        const start = wallFace(10, 2);
        // High over the room and well along the wall: on screen the wall runs upward nearly as much as its
        // own height does, yet up and down are the wall's own.
        viewFromOffset(middleOf(start), {x: 2, y: 5.75, z: 3.5});

        expect(stepFrom(start, "up")).toBe(wallFace(10, 3));
        expect(stepFrom(start, "down")).toBe(wallFace(10, 1));

        const right = stepFrom(start, "right")!;
        const left = stepFrom(start, "left")!;
        expect([right, left].sort()).toEqual([wallFace(9, 2), wallFace(11, 2)].sort());
        expect(shownToward("right", middleOf(start), middleOf(right))).toBeGreaterThan(0);
        expect(shownToward("left", middleOf(start), middleOf(left))).toBeGreaterThan(0);
    });

    it("goes over the room's floor away from the camera, toward it and to either side", () => {
        const start = floorQuadIndexOf(15, 15);

        // From the high-z side, looking toward -z.
        viewFromOffset(middleOf(start), {x: 0, y: 4, z: 6});
        expect(stepFrom(start, "up")).toBe(floorQuadIndexOf(14, 15));
        expect(stepFrom(start, "down")).toBe(floorQuadIndexOf(16, 15));
        expect(stepFrom(start, "right")).toBe(floorQuadIndexOf(15, 16));
        expect(stepFrom(start, "left")).toBe(floorQuadIndexOf(15, 14));

        // From the low-x side, looking toward +x: the same keys now lead a quarter-turn round.
        viewFromOffset(middleOf(start), {x: -6, y: 4, z: 0});
        expect(stepFrom(start, "up")).toBe(floorQuadIndexOf(15, 16));
        expect(stepFrom(start, "down")).toBe(floorQuadIndexOf(15, 14));
        expect(stepFrom(start, "right")).toBe(floorQuadIndexOf(16, 15));
        expect(stepFrom(start, "left")).toBe(floorQuadIndexOf(14, 15));
    });

    it("leads the four directions four different ways over a floor, each to the tile showing furthest that way", () => {
        const start = floorQuadIndexOf(15, 15);
        const neighbours = [floorQuadIndexOf(14, 15), floorQuadIndexOf(16, 15), floorQuadIndexOf(15, 14),
            floorQuadIndexOf(15, 16)];

        // From far off, where the view is as good as flat: up close, which of two tiles shows further one way
        // comes down to which is nearer the camera. Azimuths clear of the diagonals, where two tiles tie.
        for (const polarDeg of [25, 55, 80])
        {
            for (let azimuthDeg = 7; azimuthDeg < 360; azimuthDeg += 15)
            {
                orbitAbout(middleOf(start), azimuthDeg, polarDeg, 60);
                const reached = new Map<ScreenDirection, number>();
                for (const direction of DIRECTIONS)
                {
                    const next = stepFrom(start, direction)!;
                    const shown = (quadIndex: number) => shownToward(direction, middleOf(start), middleOf(quadIndex));

                    expect(neighbours, `${direction} at ${azimuthDeg}/${polarDeg}`).toContain(next);
                    expect(shown(next), `${direction} at ${azimuthDeg}/${polarDeg}`)
                        .toBe(Math.max(...neighbours.map(shown)));
                    reached.set(direction, next);
                }
                expect(new Set(reached.values()).size).toBe(4);

                // Opposite directions lead to opposite tiles, so a step can always be taken back.
                for (const direction of DIRECTIONS)
                    expect(stepFrom(reached.get(direction)!, OPPOSITE[direction])).toBe(start);
            }
        }
    });

    it("leads four different ways even from a diagonal, where two tiles show as far one way as each other", () => {
        const start = floorQuadIndexOf(15, 15);
        for (const azimuthDeg of [45, 135, 225, 315])
        {
            orbitAbout(middleOf(start), azimuthDeg, 45, 8);
            const reached = DIRECTIONS.map(direction => stepFrom(start, direction));

            expect(new Set(reached).size).toBe(4);
            for (const direction of DIRECTIONS)
            {
                const next = stepFrom(start, direction)!;
                expect(shownToward(direction, middleOf(start), middleOf(next))).toBeGreaterThan(0);
            }
        }
    });

    it("goes over the room's ceiling as it shows from beneath", () => {
        const start = ceilingQuadIndexOf(15, 15);
        expect(isQuadVisible(room, start)).toBe(true);
        const neighbours = [ceilingQuadIndexOf(14, 15), ceilingQuadIndexOf(16, 15), ceilingQuadIndexOf(15, 14),
            ceilingQuadIndexOf(15, 16)];

        // From under the ceiling on its high-z side: overhead, what lies further off shows lower.
        viewFromOffset(middleOf(start), {x: 0, y: -3, z: 4});
        expect(stepFrom(start, "up")).toBe(ceilingQuadIndexOf(16, 15));
        expect(stepFrom(start, "down")).toBe(ceilingQuadIndexOf(14, 15));

        for (const direction of DIRECTIONS)
        {
            const next = stepFrom(start, direction)!;
            const shown = (quadIndex: number) => shownToward(direction, middleOf(start), middleOf(quadIndex));
            expect(shown(next)).toBe(Math.max(...neighbours.map(shown)));
        }
    });

    it("goes from a block's top to the top of the block beside it at the same height", () => {
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        buildPillar(room, 10, 6, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const top = (col: number) => quadIndexOf(10, col, "y", "+", COLLISION_LAYER_MIN);
        // From the high-z side and above, over the edge the two blocks share.
        viewFromOffset(middleOf(top(5)), {x: 0.5 * VOXEL_CELL_SIZE, y: 3.5, z: 6});

        expect(stepFrom(top(5), "right")).toBe(top(6));
        expect(stepFrom(top(6), "left")).toBe(top(5));
    });

    it("goes along a low wall standing free, from the side of one block to the next", () => {
        for (const col of [5, 6])
            buildPillar(room, 10, col, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const face = (col: number) => quadIndexOf(10, col, "z", "+", COLLISION_LAYER_MIN);

        // From the high-z side and a little above, over the edge the two blocks share.
        viewFromOffset(middleOf(face(5)), {x: 0.5 * VOXEL_CELL_SIZE, y: 0.75, z: 5.5});
        expect(stepFrom(face(5), "right")).toBe(face(6));
        expect(stepFrom(face(6), "left")).toBe(face(5));
    });
});

describe("a selected face stepped round a corner onto a face turned toward the camera", () => {
    it("climbs from the floor onto the wall standing in its way, and comes back down onto the floor", () => {
        const tile = floorQuadIndexOf(10, FIRST_OPEN_COL);
        const wallFoot = wallFace(10, COLLISION_LAYER_MIN);
        // From inside the room, looking down toward the wall: away from the camera is toward it.
        viewFromOffset(middleOf(tile), {x: 4.5, y: 4, z: 0});

        expect(stepFrom(tile, "up")).toBe(wallFoot);
        expect(stepFrom(wallFoot, "up")).toBe(wallFace(10, COLLISION_LAYER_MIN + 1));
        expect(stepFrom(wallFoot, "down")).toBe(tile);
        expect(stepFrom(tile, "down")).toBe(floorQuadIndexOf(10, FIRST_OPEN_COL + 1));
    });

    it("goes up a wall onto the ceiling over it, seen from beneath, and off the ceiling back down the wall", () => {
        const wallTop = wallFace(10, COLLISION_LAYER_MAX);
        const tile = ceilingQuadIndexOf(10, FIRST_OPEN_COL);
        // From inside the room and beneath, looking up at where the two meet.
        viewFromOffset(middleOf(wallTop), {x: 5, y: -1.75, z: 0});

        expect(stepFrom(wallTop, "up")).toBe(tile);
        // Overhead, what shows higher lies nearer the camera: further out from the wall.
        expect(stepFrom(tile, "up")).toBe(ceilingQuadIndexOf(10, FIRST_OPEN_COL + 1));
        expect(stepFrom(tile, "down")).toBe(wallTop);
    });

    it("goes round the room's inner corner from one wall onto the next, and back, seen from where both show", () => {
        const alongX = wallFace(FIRST_OPEN_ROW, 2);
        const alongZ = quadIndexOf(WALL_ROW, FIRST_OPEN_COL, "z", "+", 2);
        expect(isQuadVisible(room, alongZ)).toBe(true);

        // Out in the room, off both walls: the view's right runs into the corner along the first.
        viewFromOffset(middleOf(alongX), {x: 5, y: 0, z: 3.5});
        expect(stepFrom(alongX, "right")).toBe(alongZ);

        // And its left back into it along the second.
        viewFromOffset(middleOf(alongZ), {x: 3.5, y: 0, z: 5});
        expect(stepFrom(alongZ, "left")).toBe(alongX);
        expect(stepFrom(alongZ, "right")).toBe(quadIndexOf(WALL_ROW, FIRST_OPEN_COL + 1, "z", "+", 2));
    });

    it("goes round the end of a wall standing free onto its end, seen from where the end shows", () => {
        for (const row of [9, 10, 11])
            buildPillar(room, row, 5, COLLISION_LAYER_MIN, 3);
        const front = quadIndexOf(9, 5, "x", "+", 2);
        const end = quadIndexOf(9, 5, "z", "-", 2);

        // Before the wall and off past its end.
        viewFromOffset(middleOf(front), {x: 6, y: 0, z: -4.5});
        expect(stepFrom(front, "right")).toBe(end);
        expect(stepFrom(end, "left")).toBe(front);
    });

    it("goes over a block's edge onto its top and back, and off the top onto the flank that shows", () => {
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, 1);
        const near = quadIndexOf(10, 5, "x", "+", 1);
        const top = quadIndexOf(10, 5, "y", "+", 1);

        // From the high-x side and above: away from the camera is toward -x.
        viewFromOffset(middleOf(top), {x: 5.5, y: 3, z: 0});
        expect(stepFrom(near, "up")).toBe(top);
        expect(stepFrom(top, "down")).toBe(near);

        // From off toward +z as well, the flank on that side shows too.
        viewFromOffset(middleOf(top), {x: 5.5, y: 3, z: 3.5});
        expect(stepFrom(top, "left")).toBe(quadIndexOf(10, 5, "z", "+", 1));
    });

    it("goes up the side of a higher block standing in the way of a block's top", () => {
        buildPillar(room, 10, 6, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        buildPillar(room, 10, 7, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN + 1);
        const top = quadIndexOf(10, 6, "y", "+", COLLISION_LAYER_MIN);
        // From the low-x side, which the higher block's side is turned toward: away from the camera is toward it.
        viewFromOffset(middleOf(top), {x: -4.5, y: 3.5, z: 3.5});

        expect(stepFrom(top, "up")).toBe(quadIndexOf(10, 7, "x", "-", COLLISION_LAYER_MIN + 1));
    });

    it("climbs a flight of steps tread by riser, and comes down it the same way", () => {
        // Three steps rising toward +x, a layer each.
        for (const step of [0, 1, 2])
            buildPillar(room, 10, 5 + step, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN + step);
        const tread = (step: number) => quadIndexOf(10, 5 + step, "y", "+", COLLISION_LAYER_MIN + step);
        const riser = (step: number) => quadIndexOf(10, 5 + step, "x", "-", COLLISION_LAYER_MIN + step);
        const flight = [tread(0), riser(1), tread(1), riser(2), tread(2)];

        // From the foot of the flight and above it, looking up it at its middle tread.
        viewFromOffset(middleOf(tread(1)), {x: -6.5, y: 4, z: 0});
        forceSelect(room, flight[0]);
        for (let i = 1; i < flight.length; ++i)
        {
            expect(SelectionStepUtil.tryStep("up"), `up to ${i}`).toBe(true);
            expect(selectedQuadIndex(), `up to ${i}`).toBe(flight[i]);
        }
        for (let i = flight.length - 2; i >= 0; --i)
        {
            expect(SelectionStepUtil.tryStep("down"), `down to ${i}`).toBe(true);
            expect(selectedQuadIndex(), `down to ${i}`).toBe(flight[i]);
        }
    });

    it("goes onto the block standing before the next face", () => {
        for (const row of [9, 10, 11])
            buildPillar(room, row, 5, COLLISION_LAYER_MIN, 3);
        // Against the wall's face at row 9, which it covers.
        buildPillar(room, 9, 6, COLLISION_LAYER_MIN, 3);
        const face = (row: number) => quadIndexOf(row, 5, "x", "+", 2);
        expect(isQuadVisible(room, face(9))).toBe(false);

        // Before the wall and off toward +z, which that block's side is turned toward.
        viewFromOffset(middleOf(face(10)), {x: 5, y: 0, z: 3.5});
        expect(stepFrom(face(10), "right")).toBe(quadIndexOf(9, 6, "z", "+", 2));
    });

    it("turns onto the side of a block standing proud of a wall, and round it onto the block's front", () => {
        // A wall along x, and a block against the far end of its face that looks toward +z: the faces looking
        // that way lie on the wall and, a block further out, on that block.
        for (const col of [6, 7])
            buildPillar(room, 10, col, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        buildPillar(room, 11, 7, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const wall = quadIndexOf(10, 6, "z", "+", COLLISION_LAYER_MIN);
        const proudSide = quadIndexOf(11, 7, "x", "-", COLLISION_LAYER_MIN);
        const proudFront = quadIndexOf(11, 7, "z", "+", COLLISION_LAYER_MIN);
        expect(middleOf(proudFront).z - middleOf(wall).z).toBe(VOXEL_CELL_SIZE);

        // Before the wall and off toward -x, which the proud block's side is turned toward: that side leads on
        // round to the block's front, and back against the wall.
        viewFromOffset(middleOf(wall), {x: -4.5, y: 0.75, z: 4.5});
        expect(stepFrom(wall, "right")).toBe(proudSide);
        expect(stepFrom(proudSide, "right")).toBe(proudFront);
        expect(stepFrom(proudFront, "left")).toBe(proudSide);
        expect(stepFrom(proudSide, "left")).toBe(wall);
    });
});

describe("a selected face never stepped onto a face turned away from the camera", () => {
    it("stays where it is at the end and at the top of a wall seen squarely, which show edge-on", () => {
        for (const row of [9, 10, 11])
            buildPillar(room, row, 5, COLLISION_LAYER_MIN, 3);
        const face = (row: number, layer: number) => quadIndexOf(row, 5, "x", "+", layer);
        viewFromOffset(middleOf(face(10, 2)), {x: 6, y: 0, z: 0});

        expectNoStep(face(9, 2), "right");
        expectNoStep(face(11, 2), "left");
        expectNoStep(face(10, 3), "up");
    });

    it("stays at the end of a wall whose far side is next, though its end showed", () => {
        for (const row of [9, 10, 11])
            buildPillar(room, row, 5, COLLISION_LAYER_MIN, 3);
        const end = quadIndexOf(9, 5, "z", "-", 2);
        // Before the wall and off past its end.
        viewFromOffset(middleOf(quadIndexOf(9, 5, "x", "+", 2)), {x: 6, y: 0, z: -4.5});

        expectNoStep(end, "right");
    });

    it("stays on a block's top at its far edge, and at each flank seen edge-on", () => {
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, 1);
        const top = quadIndexOf(10, 5, "y", "+", 1);
        // From the high-x side and above.
        viewFromOffset(middleOf(top), {x: 5.5, y: 3, z: 0});

        expectNoStep(top, "up");
        expectNoStep(top, "left");
        expectNoStep(top, "right");

        // From off toward +z the flank on that side shows, and the other is turned away for good.
        viewFromOffset(middleOf(top), {x: 5.5, y: 3, z: 3.5});
        expectNoStep(top, "right");
    });

    it("stays on a wall under a ceiling seen from above it", () => {
        const wallTop = wallFace(10, COLLISION_LAYER_MAX);
        // From out in the room, and from over its ceiling.
        viewFromOffset(middleOf(wallTop), {x: 5, y: 1.75, z: 0});

        expectNoStep(wallTop, "up");
        expect(stepFrom(wallTop, "down")).toBe(wallFace(10, COLLISION_LAYER_MAX - 1));
    });

    it("stays at the room's inner corner seen squarely, where the next wall would show edge-on", () => {
        const alongX = wallFace(FIRST_OPEN_ROW, 2);
        viewFromOffset(middleOf(alongX), {x: 6, y: 0, z: 0});

        expectNoStep(alongX, "right");
        expect(stepFrom(alongX, "left")).toBe(wallFace(FIRST_OPEN_ROW + 1, 2));
    });

    it("stays on the floor behind a wall two layers tall, whose face on that side is turned away all the way up", () => {
        buildPillar(room, 15, 14, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN + 1);
        // From the high-z side: the wall's far face looks toward -z.
        viewFromOffset(middleOf(floorQuadIndexOf(16, 14)), {x: 0, y: 4, z: 5});

        expectNoStep(floorQuadIndexOf(14, 14), "down");
    });

    it("stays on a face that is itself seen from behind, whichever way is pressed, and along one seen edge-on", () => {
        // A wall standing free, three blocks long.
        for (const row of [9, 10, 11])
            buildPillar(room, row, 5, COLLISION_LAYER_MIN, 3);
        const face = quadIndexOf(10, 5, "x", "+", 2);

        // From the side its faces are turned away from.
        viewFromOffset(middleOf(face), {x: -7, y: 0, z: 0});
        expectNoStepAnyWay(face);

        // In the wall's own plane, off its high-z end: up, down and away along it there is nothing turned
        // toward the camera within a face's reach.
        viewFromOffset(middleOf(face), {x: 0, y: 0, z: 9.5});
        expectNoStep(face, "up");
        expectNoStep(face, "down");
        expectNoStep(face, "left");

        // From before it, as ever.
        viewFromOffset(middleOf(face), {x: 6, y: 0, z: 0});
        expect(stepFrom(face, "right")).toBe(quadIndexOf(9, 5, "x", "+", 2));
    });

    it("goes only so far along a wall as the one face a step leaves selectable, never past a face it may not take", () => {
        const start = wallFace(10, 2);
        viewFromOffset(middleOf(start), {x: 6, y: 0, z: 0});
        // Two faces along: the face between is turned toward the camera, so it is not one to pass over.
        voxelQuadSelectionRestrictionObservable.set(wallFace(8, 2));

        expectNoStep(start, "right");
    });
});

describe("a selected face stepped past a face turned away from the camera", () => {
    it("goes down a flight of steps seen from above a tread a press, past each riser, and back up it", () => {
        // Three steps rising toward +x, a layer each.
        for (const step of [0, 1, 2])
            buildPillar(room, 10, 5 + step, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN + step);
        const tread = (step: number) => quadIndexOf(10, 5 + step, "y", "+", COLLISION_LAYER_MIN + step);
        const foot = floorQuadIndexOf(10, 4);
        const way = [tread(2), tread(1), tread(0), foot];

        // From over the head of the flight, looking down it at its middle tread: the risers are turned away,
        // toward its foot.
        viewFromOffset(middleOf(tread(1)), {x: 6, y: 5, z: 0});
        forceSelect(room, way[0]);
        for (let i = 1; i < way.length; ++i)
        {
            expect(SelectionStepUtil.tryStep("up"), `down to ${i}`).toBe(true);
            expect(selectedQuadIndex(), `down to ${i}`).toBe(way[i]);
        }
        for (let i = way.length - 2; i >= 0; --i)
        {
            expect(SelectionStepUtil.tryStep("down"), `up to ${i}`).toBe(true);
            expect(selectedQuadIndex(), `up to ${i}`).toBe(way[i]);
        }
    });

    it("goes from a low block's top to the floor behind it and back, past the side turned away", () => {
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const top = quadIndexOf(10, 5, "y", "+", COLLISION_LAYER_MIN);
        const behind = floorQuadIndexOf(10, 4);
        // From the high-x side and above: away from the camera is toward -x.
        viewFromOffset(middleOf(top), {x: 5.5, y: 3.5, z: 0});

        expect(stepFrom(top, "up")).toBe(behind);
        expect(stepFrom(behind, "down")).toBe(top);
    });

    it("steps up onto a block seen squarely, past its side that shows edge-on", () => {
        buildPillar(room, 15, 14, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const start = floorQuadIndexOf(15, 15);
        const top = quadIndexOf(15, 14, "y", "+", COLLISION_LAYER_MIN);
        viewFromOffset(middleOf(start), {x: 0, y: 4, z: 6});

        expect(stepFrom(start, "left")).toBe(top);
        expect(stepFrom(top, "right")).toBe(start);
    });

    it("passes the jog between a wall and a block standing proud of it, seen squarely", () => {
        // A wall along x, and a block against the far end of its face that looks toward +z.
        for (const col of [6, 7])
            buildPillar(room, 10, col, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        buildPillar(room, 11, 7, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const wall = quadIndexOf(10, 6, "z", "+", COLLISION_LAYER_MIN);
        const proudSide = quadIndexOf(11, 7, "x", "-", COLLISION_LAYER_MIN);
        const proudFront = quadIndexOf(11, 7, "z", "+", COLLISION_LAYER_MIN);

        // Squarely before the two, in the plane of the side between them, which shows edge-on.
        viewFromOffset(middleOf(proudSide), {x: 0, y: 0.75, z: 5.5});
        expect(stepFrom(wall, "right")).toBe(proudFront);
        expect(stepFrom(proudFront, "left")).toBe(wall);
    });

    it("goes from the floor behind a low wall onto its top, past its face on that side", () => {
        buildPillar(room, 15, 14, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        // From the high-z side: the wall's far face looks toward -z.
        viewFromOffset(middleOf(floorQuadIndexOf(16, 14)), {x: 0, y: 4, z: 5});

        expect(stepFrom(floorQuadIndexOf(14, 14), "down")).toBe(quadIndexOf(15, 14, "y", "+", COLLISION_LAYER_MIN));
    });

    it("goes round to the end of a wall seen along its length, past the face beside it that shows edge-on", () => {
        for (const row of [9, 10, 11])
            buildPillar(room, row, 5, COLLISION_LAYER_MIN, 3);
        const face = quadIndexOf(10, 5, "x", "+", 2);
        // In the wall's own plane, off its high-z end, which is turned squarely toward the camera.
        viewFromOffset(middleOf(face), {x: 0, y: 0, z: 9.5});

        expect(stepFrom(face, "right")).toBe(quadIndexOf(11, 5, "z", "+", 2));
    });

    it("passes over one such face and no more", () => {
        // A block two layers tall: beyond the top of its far side lies the rest of that side, turned away too.
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN + 1);
        const top = quadIndexOf(10, 5, "y", "+", COLLISION_LAYER_MIN + 1);
        viewFromOffset(middleOf(top), {x: 5.5, y: 3, z: 0});

        expectNoStep(top, "up");
    });

    it("asks the orbit to keep its angles, as any step of a face does", () => {
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const top = quadIndexOf(10, 5, "y", "+", COLLISION_LAYER_MIN);
        viewFromOffset(middleOf(top), {x: 5.5, y: 3.5, z: 0});

        expect(stepFrom(top, "up")).toBe(floorQuadIndexOf(10, 4));
        expect(orbitCameraAngleHoldRequestObservable.peek()).toBe(true);
    });
});

describe("the camera a face is judged from", () => {
    const DEG = Math.PI / 180;

    /** Orbits the camera about a face's block, level with it: so far round from squarely before a wall facing +x. */
    function orbitWallBlock(quadIndex: number, roundDeg: number, distance: number, aboveDeg: number = 0)
    {
        const middle = blockMiddleOf(quadIndex);
        viewFrom({
            x: middle.x + distance * Math.cos(aboveDeg * DEG) * Math.cos(roundDeg * DEG),
            y: middle.y + distance * Math.sin(aboveDeg * DEG),
            z: middle.z + distance * Math.cos(aboveDeg * DEG) * Math.sin(roundDeg * DEG),
        }, middle);
    }

    /**
     * How far round the orbit has to stand, from so far off, to see a block's side from its front: the side
     * lies half a block out from the block's middle, which the orbit turns about.
     */
    function roundToSeeSideDeg(distance: number): number
    {
        return Math.asin(0.5 * VOXEL_CELL_SIZE / distance) / DEG;
    }

    it("is the orbit where it would stand once it had slid alongside, not where it stands yet", () => {
        const alongX = wallFace(FIRST_OPEN_ROW, 2);
        const alongZ = quadIndexOf(WALL_ROW, FIRST_OPEN_COL, "z", "+", 2);

        // Squarely before the first wall, the camera stands before the plane of the second: but slid on to the
        // second's block, it would stand in that plane, with the face edge-on.
        orbitWallBlock(alongX, 0, 6);
        expect(GraphicsManager.getCamera().position.z).toBeGreaterThan(middleOf(alongZ).z);
        expectNoStep(alongX, "right");

        // A little less far round than it takes is still short of the face's own depth from its block's middle.
        orbitWallBlock(alongX, 0.75 * roundToSeeSideDeg(6), 6);
        expectNoStep(alongX, "right");
        orbitWallBlock(alongX, 1.25 * roundToSeeSideDeg(6), 6);
        expect(stepFrom(alongX, "right")).toBe(alongZ);
    });

    it("has to stand further round from close by, where that depth counts for more", () => {
        const alongX = wallFace(FIRST_OPEN_ROW, 2);
        const alongZ = quadIndexOf(WALL_ROW, FIRST_OPEN_COL, "z", "+", 2);

        // What was far enough round from three times as far off falls short from here.
        orbitWallBlock(alongX, 1.25 * roundToSeeSideDeg(6), 2);
        expectNoStep(alongX, "right");
        orbitWallBlock(alongX, 0.75 * roundToSeeSideDeg(2), 2);
        expectNoStep(alongX, "right");
        orbitWallBlock(alongX, 1.25 * roundToSeeSideDeg(2), 2);
        expect(stepFrom(alongX, "right")).toBe(alongZ);
    });

    it("needs no more than to stand on the right side of a face with no depth behind it, which a block's has", () => {
        // Barely above level with the foot of a wall: the floor at its foot is a tile lying in its own plane.
        const wallFoot = wallFace(10, COLLISION_LAYER_MIN);
        orbitWallBlock(wallFoot, 0, 6, 2);
        expect(stepFrom(wallFoot, "down")).toBe(floorQuadIndexOf(10, FIRST_OPEN_COL));
        // Dead level it would show edge-on, which is not from its front.
        orbitWallBlock(wallFoot, 0, 6, 0);
        expectNoStep(wallFoot, "down");

        // A block's top lies above its block's middle, so from as little above level it would be seen from beneath.
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, 1);
        const near = quadIndexOf(10, 5, "x", "+", 1);
        orbitWallBlock(near, 0, 6, 2);
        expectNoStep(near, "up");
        orbitWallBlock(near, 0, 6, 5);
        expect(stepFrom(near, "up")).toBe(quadIndexOf(10, 5, "y", "+", 1));
    });

    it("is the camera where it stands, under a camera that no selection moves", () => {
        const alongX = wallFace(FIRST_OPEN_ROW, 2);
        const alongZ = quadIndexOf(WALL_ROW, FIRST_OPEN_COL, "z", "+", 2);
        // A free camera is left as it is by a selection (see WorldSpaceSelectionUtil).
        cameraModeObservable.set({type: "free"});

        // Squarely before the first wall it stands before the plane of the second, and stays there.
        orbitWallBlock(alongX, 0, 6);
        expect(stepFrom(alongX, "right")).toBe(alongZ);
        expect(cameraModeObservable.peek().type).toBe("free");

        // And behind that plane, off past the corner.
        viewFromOffset(middleOf(alongX), {x: 5, y: 0, z: -1});
        expect(GraphicsManager.getCamera().position.z).toBeLessThan(middleOf(alongZ).z);
        expectNoStep(alongX, "right");
    });

    it("is the camera where it stands, under an orbit a step holds on a point of its own", () => {
        const alongX = wallFace(FIRST_OPEN_ROW, 2);
        const alongZ = quadIndexOf(WALL_ROW, FIRST_OPEN_COL, "z", "+", 2);
        orbitCameraTargetOverrideObservable.set(blockMiddleOf(alongX));

        orbitWallBlock(alongX, 0, 6);
        expect(stepFrom(alongX, "right")).toBe(alongZ);
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });
});

describe("a selected face with nowhere to step to", () => {
    it("stays where it is where the room's surface runs out of the grid", () => {
        // A gap through the room's own wall, floor to ceiling.
        for (let col = 0; col <= WALL_COL; ++col)
        {
            for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
            {
                expect(VoxelUpdateUtil.removeVoxelBlock(undefined, room.voxelGrid.voxels,
                    quadIndexOf(10, col, "y", "+", layer))).toBe(true);
            }
        }
        const atEdge = floorQuadIndexOf(10, 0);
        viewFromOffset(middleOf(floorQuadIndexOf(10, FIRST_OPEN_COL)), {x: 4.5, y: 4, z: 0});

        // Off the room's floor and through the gap, a tile a press, as far as the grid goes.
        forceSelect(room, floorQuadIndexOf(10, FIRST_OPEN_COL));
        for (let col = WALL_COL; col >= 0; --col)
        {
            expect(SelectionStepUtil.tryStep("up"), `into the gap at ${col}`).toBe(true);
            expect(selectedQuadIndex(), `into the gap at ${col}`).toBe(floorQuadIndexOf(10, col));
        }
        expectNoStep(atEdge, "up");
        expect(stepFrom(atEdge, "down")).toBe(floorQuadIndexOf(10, 1));
    });

    it("stays where it is when it isn't drawn itself", () => {
        // A face inside the room's own wall, selected outright: seen from out in the room, where the wall's
        // inner face round the edge of its block shows.
        const buried = quadIndexOf(WALL_ROW, 10, "x", "+", 2);
        expect(isQuadVisible(room, buried)).toBe(false);
        expect(isQuadVisible(room, quadIndexOf(WALL_ROW, 10, "z", "+", 2))).toBe(true);
        viewFromOffset(middleOf(buried), {x: 5, y: 0, z: 3.5});

        expectNoStepAnyWay(buried);
    });

    it("stays where it is while a step holds the selection of faces still", () => {
        const start = wallFace(10, 2);
        viewFromOffset(middleOf(start), {x: 6, y: 0, z: 0});

        for (const flag of [FeatureFlag.DisableVoxelQuadSelectionChange, FeatureFlag.DisableAllSelectionChange])
        {
            clientFeatureFlagsObservable.tryAdd(flag);
            expectNoStepAnyWay(start);
            clientFeatureFlagsObservable.tryRemove(flag);
        }
    });

    it("goes only to the one face a step leaves selectable", () => {
        const start = wallFace(10, 2);
        viewFromOffset(middleOf(start), {x: 6, y: 0, z: 0});
        voxelQuadSelectionRestrictionObservable.set(wallFace(10, 3));

        expectNoStep(start, "right");
        expectNoStep(start, "down");
        expect(stepFrom(start, "up")).toBe(wallFace(10, 3));
    });
});

describe("what a step of a face asks of the orbit", () => {
    it("is to keep its angles, along a surface and round a corner alike", () => {
        const tile = floorQuadIndexOf(10, FIRST_OPEN_COL);
        viewFromOffset(middleOf(tile), {x: 4.5, y: 4, z: 0});

        expect(stepFrom(tile, "down")).toBe(floorQuadIndexOf(10, FIRST_OPEN_COL + 1));
        expect(orbitCameraAngleHoldRequestObservable.peek()).toBe(true);

        orbitCameraAngleHoldRequestObservable.set(false);
        expect(stepFrom(tile, "up")).toBe(wallFace(10, COLLISION_LAYER_MIN));
        expect(orbitCameraAngleHoldRequestObservable.peek()).toBe(true);
    });

    it("is nothing for a step that went nowhere", () => {
        // A block's top at its far edge, whose far side is turned away.
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, 1);
        const top = quadIndexOf(10, 5, "y", "+", 1);
        viewFromOffset(middleOf(top), {x: 5.5, y: 3, z: 0});

        expectNoStep(top, "up");
        expect(orbitCameraAngleHoldRequestObservable.peek()).toBe(false);
    });
});

// ─── Objects ────────────────────────────────────────────────────────────────

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
const volumeTypeIndex = ObjectTypeConfigMap.getIndexByType("Volume");

// A selection's outline is made on first use, and it takes over from the other kind only once made.
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe("a selected object stepped to the nearest object lying that way", () => {
    let held: GameObject[];

    beforeEach(() => {
        held = [];
        (ClientObjectManager.getObjectById as Mock).mockImplementation(
            (objectId: string) => held.find(gameObject => gameObject.params.objectId == objectId));
    });

    /** The object as the client holds it: only what selecting one reads of it. */
    function hold(object: AddObjectSignal, selectable: boolean = true): GameObject
    {
        const pos = object.transform.pos;
        const gameObject = {
            params: object,
            position: new THREE.Vector3(pos.x, pos.y, pos.z),
            quaternion: new THREE.Quaternion(),
            canBeSelected: () => selectable,
        } as unknown as GameObject;
        held.push(gameObject);
        return gameObject;
    }

    /** A canvas (a world unit across and as tall unless given a size), added the way a user's own is. */
    function addCanvas(objectId: string, pos: Vec3, dir: Vec3, scale: Vec3 = {x: 1, y: 1, z: 1},
        selectable: boolean = true): GameObject
    {
        const canvas = new AddObjectSignal(room.id, actingUser.id, actingUser.userName, canvasTypeIndex, objectId,
            new ObjectTransform(pos, dir, scale), {});
        expect(ObjectUpdateUtil.addObject(actingUser, room, canvas), `canvas ${objectId} has a place`).toBe(true);
        return hold(canvas, selectable);
    }

    /** On the inner face of the room's own wall along its low-x side, which looks toward +x. */
    function hangOnWall(objectId: string, z: number, y: number = 1.5, scale?: Vec3, selectable?: boolean): GameObject
    {
        return addCanvas(objectId, {x: 1, y, z}, {x: 1, y: 0, z: 0}, scale, selectable);
    }

    /** Lying on the room's own floor. */
    function layOnFloor(objectId: string, x: number, z: number): GameObject
    {
        return addCanvas(objectId, {x, y: 0, z}, {x: 0, y: 1, z: 0});
    }

    /** Stands the camera inside the room, facing its low-x wall squarely at a point along it. */
    function faceWallAt(z: number, y: number = 1.5)
    {
        viewFrom({x: 8, y, z}, {x: 1, y, z});
    }

    async function select(gameObject: GameObject)
    {
        expect(ObjectSelection.trySelect(gameObject)).toBe(true);
        await settle();
    }

    function selectedObjectId(): string | undefined
    {
        return objectSelectionObservable.peek()?.gameObject.params.objectId;
    }

    /** Asserts that a step has nowhere to go, and so leaves the selection on the object it was on. */
    function expectNoStep(direction: ScreenDirection)
    {
        const before = selectedObjectId();
        expect(SelectionStepUtil.tryStep(direction)).toBe(false);
        expect(selectedObjectId()).toBe(before);
    }

    it("goes along a wall to the object beside it, and up and down the wall", async () => {
        // Looking toward -x, the view's right runs toward -z.
        const middle = hangOnWall("middle", 10.5);
        hangOnWall("right", 8.5);
        hangOnWall("left", 12.5);
        hangOnWall("above", 10.5, 3);
        faceWallAt(10.5);
        await select(middle);

        for (const direction of ["right", "left", "up"] as ScreenDirection[])
        {
            expect(SelectionStepUtil.tryStep(direction)).toBe(true);
            expect(selectedObjectId()).toBe((direction == "up") ? "above" : direction);

            // And back the way it came.
            expect(SelectionStepUtil.tryStep(OPPOSITE[direction])).toBe(true);
            expect(selectedObjectId()).toBe("middle");
        }
        expectNoStep("down");
    });

    it("takes the nearest of the objects lying that way", async () => {
        const start = hangOnWall("start", 10.5);
        hangOnWall("further", 6.5);
        hangOnWall("nearer", 8.5);
        faceWallAt(10.5);
        await select(start);

        expect(SelectionStepUtil.tryStep("right")).toBe(true);
        expect(selectedObjectId()).toBe("nearer");
        expect(SelectionStepUtil.tryStep("right")).toBe(true);
        expect(selectedObjectId()).toBe("further");
    });

    it("reaches no further than the reach, measured between the two objects and not their middles", async () => {
        // Each as wide as a canvas gets, so their middles lie further apart than the reach though they hang
        // side by side.
        const WIDE = {x: 3.5, y: 1, z: 1};
        const start = hangOnWall("start", 10.25, 1.5, WIDE);
        hangOnWall("beside", 6.25, 1.5, WIDE);
        expect(10.25 - 6.25).toBeGreaterThan(SELECTION_STEP_OBJECT_REACH);
        // Out of reach on the other side: the reach and a little more past the first one's edge.
        hangOnWall("beyond", 10.25 + 1.75 + SELECTION_STEP_OBJECT_REACH + 0.5 + 0.5);
        faceWallAt(10.25);
        await select(start);

        expectNoStep("left");
        expect(SelectionStepUtil.tryStep("right")).toBe(true);
        expect(selectedObjectId()).toBe("beside");
    });

    it("reads which way an object lies off the gap between the two, so a wide one counts as above what hangs under any part of it", async () => {
        // Under the end of the wide one: its middle is more to the side than above.
        const small = hangOnWall("small", 10.25, 1.25, {x: 0.5, y: 0.5, z: 1});
        hangOnWall("wide", 8.75, 2.5, {x: 3.5, y: 1, z: 1});
        faceWallAt(10.25);
        await select(small);

        expectNoStep("right");
        expect(SelectionStepUtil.tryStep("up")).toBe(true);
        expect(selectedObjectId()).toBe("wide");
        expect(SelectionStepUtil.tryStep("down")).toBe(true);
        expect(selectedObjectId()).toBe("small");
    });

    it("counts an object as lying the way it lies most", async () => {
        const start = hangOnWall("start", 10.5, 1.5);
        // Two units off along the wall and a layer above its top: up and to the right, but more to the right.
        hangOnWall("diagonal", 7.5, 3);
        faceWallAt(10.5);
        await select(start);

        expectNoStep("up");
        expect(SelectionStepUtil.tryStep("right")).toBe(true);
        expect(selectedObjectId()).toBe("diagonal");
        expectNoStep("down");
        expect(SelectionStepUtil.tryStep("left")).toBe(true);
        expect(selectedObjectId()).toBe("start");
    });

    it("passes over an object the user may not select for the next one that way", async () => {
        const start = hangOnWall("start", 10.5);
        hangOnWall("refusing", 8.5, 1.5, undefined, false);
        hangOnWall("next", 7);
        faceWallAt(10.5);
        await select(start);

        expect(SelectionStepUtil.tryStep("right")).toBe(true);
        expect(selectedObjectId()).toBe("next");
    });

    it("never takes an object on the far face of a wall, which is turned away from the camera", async () => {
        // A wall standing free, a unit thick from x = 5 to 6 and four long from z = 8 to 12, with a canvas on
        // each face of it, back to back.
        const rowAt = VoxelQueryUtil.getVoxelRowFromWorldZ, colAt = VoxelQueryUtil.getVoxelColFromWorldX;
        for (let row = rowAt(8); row < rowAt(12); ++row)
        {
            for (let col = colAt(5); col < colAt(6); ++col)
                buildPillar(room, row, col, COLLISION_LAYER_MIN, 5);
        }
        const front = addCanvas("front", {x: 6, y: 1.5, z: 10.5}, {x: 1, y: 0, z: 0});
        const back = addCanvas("back", {x: 5, y: 1.5, z: 10.25}, {x: -1, y: 0, z: 0});
        const frontPos = front.params.transform.pos, backPos = back.params.transform.pos;

        // From the front and off to one side, the one behind the wall lies to the right, a unit away.
        viewFrom({x: 13, y: 1.5, z: 8.5}, frontPos);
        expect(shownToward("right", frontPos, backPos)).toBeGreaterThan(0);
        await select(front);
        for (const direction of DIRECTIONS)
            expectNoStep(direction);

        // Nor is it in the way of one further off that the camera does see.
        addCanvas("frontBeside", {x: 6, y: 1.5, z: 8.5}, {x: 1, y: 0, z: 0});
        expect(SelectionStepUtil.tryStep("right")).toBe(true);
        expect(selectedObjectId()).toBe("frontBeside");

        // From behind the wall, it is the ones on the front that are out of sight.
        viewFrom({x: -2, y: 1.5, z: 12.25}, backPos);
        expect(shownToward("right", backPos, frontPos)).toBeGreaterThan(0);
        await select(back);
        for (const direction of DIRECTIONS)
            expectNoStep(direction);
    });

    it("never takes an object hanging under the floor the selected one lies on", async () => {
        // On the upper storey's floor, with another right beneath it on the ceiling of the storey below.
        const slabTop = (STOREY_FLOOR_COLLISION_LAYER + 1) * 0.5;
        const above = addCanvas("above", {x: 15.5, y: slabTop, z: 15.5}, {x: 0, y: 1, z: 0});
        const beneath = addCanvas("beneath", {x: 15.5, y: slabTop - 0.5, z: 15.25}, {x: 0, y: -1, z: 0});
        viewFrom({x: 15.5, y: slabTop + 3, z: 19.5}, above.params.transform.pos);
        expect(shownToward("down", above.params.transform.pos, beneath.params.transform.pos)).toBeGreaterThan(0);
        await select(above);

        for (const direction of DIRECTIONS)
            expectNoStep(direction);
    });

    it("goes between objects on a floor as the camera stands, and between a floor and a wall", async () => {
        const near = layOnFloor("near", 15.5, 15.5);
        layOnFloor("far", 15.5, 13.5);

        // From the high-z side the one at lower z lies further off, and so shows above.
        viewFrom({x: 15.5, y: 4, z: 21.5}, near.params.transform.pos);
        await select(near);
        expectNoStep("down");
        expect(SelectionStepUtil.tryStep("up")).toBe(true);
        expect(selectedObjectId()).toBe("far");

        // From the other side it is the other way up.
        viewFrom({x: 15.5, y: 4, z: 9.5}, near.params.transform.pos);
        await select(near);
        expectNoStep("up");
        expect(SelectionStepUtil.tryStep("down")).toBe(true);
        expect(selectedObjectId()).toBe("far");

        // Onto the wall from the floor at its foot, and back down.
        const atWallFoot = layOnFloor("atWallFoot", 1.5, 6.5);
        hangOnWall("onWall", 6.5);
        viewFrom({x: 8, y: 2, z: 6.5}, {x: 1, y: 1, z: 6.5});
        await select(atWallFoot);
        expect(SelectionStepUtil.tryStep("up")).toBe(true);
        expect(selectedObjectId()).toBe("onWall");
        expect(SelectionStepUtil.tryStep("down")).toBe(true);
        expect(selectedObjectId()).toBe("atWallFoot");
    });

    it("takes an object standing free, such as the user's own character, and goes on from it", async () => {
        const onWall = hangOnWall("onWall", 10.5);
        const character = new AddObjectSignal(room.id, actingUser.id, actingUser.userName, playerTypeIndex,
            "character", new ObjectTransform({x: 2.5, y: 0.5 * PLAYER_HEIGHT, z: 8.5}, {x: 0, y: 0, z: 1},
                {x: 1, y: 1, z: 1}), {});
        room.objectGroup.addObject(character);
        hold(character);
        faceWallAt(10.5);
        await select(onWall);

        expect(SelectionStepUtil.tryStep("right")).toBe(true);
        expect(selectedObjectId()).toBe("character");
        expect(SelectionStepUtil.tryStep("left")).toBe(true);
        expect(selectedObjectId()).toBe("onWall");
    });

    it("never takes a volume, which only its own button selects, though it lies nearest", async () => {
        const onWall = hangOnWall("onWall", 10.5);
        hangOnWall("beyond", 7.5);
        // Round the selected canvas and on toward the next, so that nothing lies nearer that way.
        const volume = new AddObjectSignal(room.id, actingUser.id, actingUser.userName, volumeTypeIndex, "volume",
            VolumeObjectTypeConfig.util.makeTransform({x: 1, y: 1, z: 8}, {x: 2, y: 2, z: 11}), {});
        room.objectGroup.addObject(volume);
        hold(volume);
        faceWallAt(10.5);
        await select(onWall);

        expect(SelectionStepUtil.tryStep("right")).toBe(true);
        expect(selectedObjectId()).toBe("beyond");
        expect(SelectionStepUtil.tryStep("left")).toBe(true);
        expect(selectedObjectId()).toBe("onWall");
    });

    it("is announced as a selection the user made by hand, with the object it left and the one it took", async () => {
        const middle = hangOnWall("middle", 10.5);
        hangOnWall("right", 8.5);
        faceWallAt(10.5);
        await select(middle);
        const announced: (string | undefined)[][] = [];
        manualSelectionObservable.addListener("selection-step.test", ({before, after}) => {
            announced.push([(before as ObjectSelection | null)?.gameObject.params.objectId,
                (after as ObjectSelection).gameObject.params.objectId]);
        });
        try
        {
            expect(SelectionStepUtil.tryStep("right")).toBe(true);
            expectNoStep("up");
            expect(announced).toEqual([["middle", "right"]]);
        }
        finally
        {
            manualSelectionObservable.removeListener("selection-step.test");
        }
    });

    it("asks the orbit to keep its angles only for a step to an object facing the same way", async () => {
        const onWall = hangOnWall("onWall", 6.5);
        hangOnWall("beside", 8.5);
        layOnFloor("atWallFoot", 1.5, 6.5);
        const character = new AddObjectSignal(room.id, actingUser.id, actingUser.userName, playerTypeIndex,
            "character", new ObjectTransform({x: 2.5, y: 0.5 * PLAYER_HEIGHT, z: 4.5}, {x: 0, y: 0, z: 1},
                {x: 1, y: 1, z: 1}), {});
        room.objectGroup.addObject(character);
        hold(character);
        viewFrom({x: 8, y: 2, z: 6.5}, {x: 1, y: 1, z: 6.5});

        const requestedBy = async (direction: ScreenDirection): Promise<[string | undefined, boolean]> => {
            await select(onWall);
            orbitCameraAngleHoldRequestObservable.set(false);
            SelectionStepUtil.tryStep(direction);
            return [selectedObjectId(), orbitCameraAngleHoldRequestObservable.peek()];
        };

        // Along the wall; down onto the floor, whose face is turned another way; to one standing free.
        expect(await requestedBy("left")).toEqual(["beside", true]);
        expect(await requestedBy("down")).toEqual(["atWallFoot", false]);
        expect(await requestedBy("right")).toEqual(["character", false]);
        // Nowhere to go.
        expect(await requestedBy("up")).toEqual(["onWall", false]);

    });

    it("stays where it is while a step holds the selection of objects still", async () => {
        const start = hangOnWall("start", 10.5);
        hangOnWall("beside", 8.5);
        faceWallAt(10.5);
        await select(start);

        for (const flag of [FeatureFlag.DisableObjectSelectionChange, FeatureFlag.DisableAllSelectionChange])
        {
            clientFeatureFlagsObservable.tryAdd(flag);
            expectNoStep("right");
            clientFeatureFlagsObservable.tryRemove(flag);
        }
        expect(SelectionStepUtil.tryStep("right")).toBe(true);
    });

    it("never leaves an object for a face, or a face for an object", async () => {
        // A canvas alone on the wall, and the faces right beside it.
        const alone = hangOnWall("alone", 10.5);
        faceWallAt(10.5);
        await select(alone);
        for (const direction of DIRECTIONS)
            expectNoStep(direction);
        expect(VoxelQuadSelection.isSelected()).toBe(false);

        // The first row clear of the canvas, whose edge lies at z = 11, and the one after it.
        const besideRow = VoxelQueryUtil.getVoxelRowFromWorldZ(11);
        const face = wallFace(besideRow + 1, 2);
        expect(VoxelQuadSelection.trySelect(voxelAt(room, besideRow + 1, WALL_COL), face)).toBe(true);
        await settle();
        expect(SelectionStepUtil.tryStep("right")).toBe(true);
        expect(selectedQuadIndex()).toBe(wallFace(besideRow, 2));
        expect(ObjectSelection.isSelected()).toBe(false);
    });
});

describe("a step with nothing selected", () => {
    it("selects nothing", () => {
        viewFrom({x: 7, y: 1.25, z: 10.5}, {x: 1, y: 1.25, z: 10.5});
        for (const direction of DIRECTIONS)
            expect(SelectionStepUtil.tryStep(direction)).toBe(false);

        expect(VoxelQuadSelection.isSelected()).toBe(false);
        expect(ObjectSelection.isSelected()).toBe(false);
    });
});

describe("a step of a face, as a selection the user made by hand", () => {
    it("is announced with the face it left and the face it took, and not at all where it went nowhere", () => {
        const announced: (number | undefined)[][] = [];
        manualSelectionObservable.addListener("selection-step.test", ({before, after}) => {
            announced.push([(before as VoxelQuadSelection | null)?.quadIndex, (after as VoxelQuadSelection).quadIndex]);
        });
        try
        {
            const start = wallFace(10, 2);
            viewFromOffset(middleOf(start), {x: 6, y: 0, z: 0});
            forceSelect(room, start);
            expect(announced).toEqual([]);

            // Looking toward -x, the view's right runs toward -z, which is the row before.
            expect(SelectionStepUtil.tryStep("right")).toBe(true);
            expect(SelectionStepUtil.tryStep("up")).toBe(true);
            expect(announced).toEqual([[start, wallFace(9, 2)], [wallFace(9, 2), wallFace(9, 3)]]);

            // Up from the wall's top layer there is only the ceiling, seen from above it: turned away.
            const wallTop = wallFace(10, COLLISION_LAYER_MAX);
            viewFromOffset(middleOf(wallTop), {x: 5, y: 1.75, z: 0});
            expectNoStep(wallTop, "up");
            expect(announced.length).toBe(2);
        }
        finally
        {
            manualSelectionObservable.removeListener("selection-step.test");
        }
    });
});
