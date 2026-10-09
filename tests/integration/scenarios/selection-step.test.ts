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
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN,
    STOREY_FLOOR_COLLISION_LAYER } from "../../../src/shared/system/sharedConstants";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import { PLAYER_HEIGHT } from "../../../src/shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import Vec3 from "../../../src/shared/math/types/vec3";
import Room from "../../../src/shared/room/types/room";
import { createEditingUser } from "../helpers/mockUser";
import { buildPillar, ceilingQuadIndexOf, createRoom, currentSelection, floorQuadIndexOf, forceSelect,
    isQuadVisible, quadIndexOf, voxelAt } from "../helpers/selectionHarness";

// The acting user (editing utilities require one).
const actingUser = createEditingUser();

const ROOM_ID = "selection-step-room";
const WALL_TEXTURES = [1, 1, 1, 1, 1, 1];
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
        x: VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex) + 0.5 + dims.offsetX,
        y: dims.offsetY,
        z: VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex) + 0.5 + dims.offsetZ,
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

// The room's own wall along its low-x side, whose inner faces look toward +x.
const WALL_COL = 0;
const wallFace = (row: number, layer: number) => quadIndexOf(row, WALL_COL, "x", "+", layer);

// Half a block, filling the lower-z half of its cell.
const LOW_Z_HALF = 0b0011;

function addShrunkBlock(row: number, col: number, layer: number, shape: number)
{
    expect(VoxelUpdateUtil.addVoxelBlock(actingUser, room.voxelGrid.voxels, quadIndexOf(row, col, "y", "+", layer),
        WALL_TEXTURES, room, shape)).toBe(true);
}

/** The middle of the block a face belongs to, which is what the orbit turns about with the face selected. */
function blockMiddleOf(quadIndex: number): Vec3
{
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const layer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    return VoxelQueryUtil.getVoxelBlockBox(row, col, layer,
        VoxelQueryUtil.getVoxelBlockShapeAt(room.voxelGrid.voxels, row, col, layer)).center;
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
        viewFrom({x: 7, y: 1.25, z: 10.5}, middleOf(start));

        // Looking toward -x, the view's right runs toward -z, which is the row before.
        expect(stepFrom(start, "right")).toBe(wallFace(9, 2));
        expect(stepFrom(start, "left")).toBe(wallFace(11, 2));
        expect(stepFrom(start, "up")).toBe(wallFace(10, 3));
        expect(stepFrom(start, "down")).toBe(wallFace(10, 1));
    });

    it("says whether the selection moved, and carries on from where the last step left it", () => {
        const start = wallFace(10, 2);
        viewFrom({x: 7, y: 1.25, z: 10.5}, middleOf(start));
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
        viewFrom({x: 3, y: 7, z: 14}, middleOf(start));

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
        viewFrom({x: 15.5, y: 4, z: 21.5}, middleOf(start));
        expect(stepFrom(start, "up")).toBe(floorQuadIndexOf(14, 15));
        expect(stepFrom(start, "down")).toBe(floorQuadIndexOf(16, 15));
        expect(stepFrom(start, "right")).toBe(floorQuadIndexOf(15, 16));
        expect(stepFrom(start, "left")).toBe(floorQuadIndexOf(15, 14));

        // From the low-x side, looking toward +x: the same keys now lead a quarter-turn round.
        viewFrom({x: 9.5, y: 4, z: 15.5}, middleOf(start));
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
        viewFrom({x: 15.5, y: 5, z: 19.5}, middleOf(start));
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
        viewFrom({x: 6, y: 4, z: 16.5}, middleOf(top(5)));

        expect(stepFrom(top(5), "right")).toBe(top(6));
        expect(stepFrom(top(6), "left")).toBe(top(5));
    });

    it("goes along a wall half a cell thick, whose faces lie in mid-cell", () => {
        for (const col of [5, 6])
            addShrunkBlock(10, col, COLLISION_LAYER_MIN, LOW_Z_HALF);
        const face = (col: number) => quadIndexOf(10, col, "z", "+", COLLISION_LAYER_MIN);
        expect(middleOf(face(5)).z).toBe(10.5);

        viewFrom({x: 6, y: 1, z: 16}, middleOf(face(5)));
        expect(stepFrom(face(5), "right")).toBe(face(6));
        expect(stepFrom(face(6), "left")).toBe(face(5));
    });
});

describe("a selected face stepped round a corner onto a face turned toward the camera", () => {
    it("climbs from the floor onto the wall standing in its way, and comes back down onto the floor", () => {
        const tile = floorQuadIndexOf(10, 1);
        const wallFoot = wallFace(10, COLLISION_LAYER_MIN);
        // From inside the room, looking down toward the wall: away from the camera is toward it.
        viewFrom({x: 6, y: 4, z: 10.5}, middleOf(tile));

        expect(stepFrom(tile, "up")).toBe(wallFoot);
        expect(stepFrom(wallFoot, "up")).toBe(wallFace(10, COLLISION_LAYER_MIN + 1));
        expect(stepFrom(wallFoot, "down")).toBe(tile);
        expect(stepFrom(tile, "down")).toBe(floorQuadIndexOf(10, 2));
    });

    it("goes up a wall onto the ceiling over it, seen from beneath, and off the ceiling back down the wall", () => {
        const wallTop = wallFace(10, COLLISION_LAYER_MAX);
        const tile = ceilingQuadIndexOf(10, 1);
        // From inside the room and beneath, looking up at where the two meet.
        viewFrom({x: 6, y: 6, z: 10.5}, middleOf(wallTop));

        expect(stepFrom(wallTop, "up")).toBe(tile);
        // Overhead, what shows higher lies nearer the camera: further out from the wall.
        expect(stepFrom(tile, "up")).toBe(ceilingQuadIndexOf(10, 2));
        expect(stepFrom(tile, "down")).toBe(wallTop);
    });

    it("goes round the room's inner corner from one wall onto the next, and back, seen from where both show", () => {
        const alongX = wallFace(1, 2);
        const alongZ = quadIndexOf(0, 1, "z", "+", 2);
        expect(isQuadVisible(room, alongZ)).toBe(true);

        // Out in the room, off both walls: the view's right runs into the corner along the first.
        viewFrom({x: 6, y: 1.25, z: 5}, middleOf(alongX));
        expect(stepFrom(alongX, "right")).toBe(alongZ);

        // And its left back into it along the second.
        viewFrom({x: 5, y: 1.25, z: 6}, middleOf(alongZ));
        expect(stepFrom(alongZ, "left")).toBe(alongX);
        expect(stepFrom(alongZ, "right")).toBe(quadIndexOf(0, 2, "z", "+", 2));
    });

    it("goes round the end of a wall standing free onto its end, seen from where the end shows", () => {
        for (const row of [9, 10, 11])
            buildPillar(room, row, 5, COLLISION_LAYER_MIN, 3);
        const front = quadIndexOf(9, 5, "x", "+", 2);
        const end = quadIndexOf(9, 5, "z", "-", 2);

        // Before the wall and off past its end.
        viewFrom({x: 12, y: 1.25, z: 5}, middleOf(front));
        expect(stepFrom(front, "right")).toBe(end);
        expect(stepFrom(end, "left")).toBe(front);
    });

    it("goes over a block's edge onto its top and back, and off the top onto the flank that shows", () => {
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, 1);
        const near = quadIndexOf(10, 5, "x", "+", 1);
        const top = quadIndexOf(10, 5, "y", "+", 1);

        // From the high-x side and above: away from the camera is toward -x.
        viewFrom({x: 11, y: 4, z: 10.5}, middleOf(top));
        expect(stepFrom(near, "up")).toBe(top);
        expect(stepFrom(top, "down")).toBe(near);

        // From off toward +z as well, the flank on that side shows too.
        viewFrom({x: 11, y: 4, z: 14}, middleOf(top));
        expect(stepFrom(top, "left")).toBe(quadIndexOf(10, 5, "z", "+", 1));
    });

    it("goes up the side of a higher block standing in the way of a block's top", () => {
        buildPillar(room, 10, 6, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        buildPillar(room, 10, 7, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN + 1);
        const top = quadIndexOf(10, 6, "y", "+", COLLISION_LAYER_MIN);
        // From the low-x side, which the higher block's side is turned toward: away from the camera is toward it.
        viewFrom({x: 2, y: 4, z: 14}, middleOf(top));

        expect(stepFrom(top, "up")).toBe(quadIndexOf(10, 7, "x", "-", COLLISION_LAYER_MIN + 1));
    });

    it("climbs a flight of steps tread by riser, and comes down it the same way", () => {
        // Three steps rising toward +x, a layer each.
        for (const step of [0, 1, 2])
            buildPillar(room, 10, 5 + step, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN + step);
        const tread = (step: number) => quadIndexOf(10, 5 + step, "y", "+", COLLISION_LAYER_MIN + step);
        const riser = (step: number) => quadIndexOf(10, 5 + step, "x", "-", COLLISION_LAYER_MIN + step);
        const flight = [tread(0), riser(1), tread(1), riser(2), tread(2)];

        // From the foot of the flight and above it, looking up it.
        viewFrom({x: 0, y: 5, z: 10.5}, {x: 6.5, y: 1, z: 10.5});
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
        viewFrom({x: 11, y: 1.25, z: 14}, middleOf(face(10)));
        expect(stepFrom(face(10), "right")).toBe(quadIndexOf(9, 6, "z", "+", 2));
    });

    it("reaches a wall half a cell thick from the floor before it, across the tile it stands on", () => {
        addShrunkBlock(15, 14, COLLISION_LAYER_MIN, LOW_Z_HALF);
        const under = floorQuadIndexOf(15, 14);
        const thick = quadIndexOf(15, 14, "z", "+", COLLISION_LAYER_MIN);
        expect(isQuadVisible(room, under)).toBe(true);
        expect(middleOf(thick).z).toBe(15.5);

        // From the high-z side, looking down toward -z. The tile under the wall shows on this side of it,
        // so that is next; from there the wall is in the way, though the tile runs on under it.
        viewFrom({x: 14.5, y: 4, z: 21.5}, middleOf(floorQuadIndexOf(16, 14)));
        expect(stepFrom(floorQuadIndexOf(16, 14), "up")).toBe(under);
        expect(stepFrom(under, "up")).toBe(thick);
        expect(stepFrom(thick, "down")).toBe(under);
        expect(stepFrom(under, "down")).toBe(floorQuadIndexOf(16, 14));

        // Sideways the tile's bare half carries straight on, beside the wall.
        expect(stepFrom(under, "right")).toBe(floorQuadIndexOf(15, 15));
    });

    it("turns onto the side of a block standing proud of a thinner wall, and round it onto the block's front", () => {
        // A wall half a cell thick along x, then a whole block: the faces looking toward +z lie across the
        // middle of the first cell, and on the side of the second.
        addShrunkBlock(10, 6, COLLISION_LAYER_MIN, LOW_Z_HALF);
        buildPillar(room, 10, 7, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const thin = quadIndexOf(10, 6, "z", "+", COLLISION_LAYER_MIN);
        const proudSide = quadIndexOf(10, 7, "x", "-", COLLISION_LAYER_MIN);
        const proudFront = quadIndexOf(10, 7, "z", "+", COLLISION_LAYER_MIN);
        expect(middleOf(thin).z).toBe(10.5);
        expect(middleOf(proudFront).z).toBe(11);

        // Before the wall and off toward -x, which the proud block's side is turned toward. Half of that side
        // lies behind the thinner wall: its bare half leads on round to the front, and back against the wall.
        viewFrom({x: 2, y: 1, z: 15}, middleOf(thin));
        expect(stepFrom(thin, "right")).toBe(proudSide);
        expect(stepFrom(proudSide, "right")).toBe(proudFront);
        expect(stepFrom(proudFront, "left")).toBe(proudSide);
        expect(stepFrom(proudSide, "left")).toBe(thin);
    });

    it("goes onto what stands in the way of only part of a face before what the rest carries on to", () => {
        // Half a block beside a floor tile, across half that tile's width.
        addShrunkBlock(15, 14, COLLISION_LAYER_MIN, LOW_Z_HALF);
        const start = floorQuadIndexOf(15, 15);
        const blockSide = quadIndexOf(15, 14, "x", "+", COLLISION_LAYER_MIN);

        // From the high-x side, which the block's side is turned toward: away from the camera is toward it.
        viewFrom({x: 20, y: 4, z: 19}, middleOf(start));
        expect(stepFrom(start, "up")).toBe(blockSide);

        // The tile beside it is the next of the two, taken where the first may not be.
        voxelQuadSelectionRestrictionObservable.set(floorQuadIndexOf(15, 14));
        expect(stepFrom(start, "up")).toBe(floorQuadIndexOf(15, 14));
    });
});

describe("a selected face never stepped onto a face turned away from the camera", () => {
    it("stays where it is at the end and at the top of a wall seen squarely, which show edge-on", () => {
        for (const row of [9, 10, 11])
            buildPillar(room, row, 5, COLLISION_LAYER_MIN, 3);
        const face = (row: number, layer: number) => quadIndexOf(row, 5, "x", "+", layer);
        viewFrom({x: 12, y: 1.25, z: 10.5}, middleOf(face(10, 2)));

        expectNoStep(face(9, 2), "right");
        expectNoStep(face(11, 2), "left");
        expectNoStep(face(10, 3), "up");
    });

    it("stays at the end of a wall whose far side is next, though its end showed", () => {
        for (const row of [9, 10, 11])
            buildPillar(room, row, 5, COLLISION_LAYER_MIN, 3);
        const end = quadIndexOf(9, 5, "z", "-", 2);
        viewFrom({x: 12, y: 1.25, z: 5}, middleOf(quadIndexOf(9, 5, "x", "+", 2)));

        expectNoStep(end, "right");
    });

    it("stays on a block's top at its far edge, and at each flank seen edge-on", () => {
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, 1);
        const top = quadIndexOf(10, 5, "y", "+", 1);
        // From the high-x side and above.
        viewFrom({x: 11, y: 4, z: 10.5}, middleOf(top));

        expectNoStep(top, "up");
        expectNoStep(top, "left");
        expectNoStep(top, "right");

        // From off toward +z the flank on that side shows, and the other is turned away for good.
        viewFrom({x: 11, y: 4, z: 14}, middleOf(top));
        expectNoStep(top, "right");
    });

    it("stays on a wall under a ceiling seen from above it", () => {
        const wallTop = wallFace(10, COLLISION_LAYER_MAX);
        viewFrom({x: 6, y: 9.5, z: 10.5}, middleOf(wallTop));

        expectNoStep(wallTop, "up");
        expect(stepFrom(wallTop, "down")).toBe(wallFace(10, COLLISION_LAYER_MAX - 1));
    });

    it("stays at the room's inner corner seen squarely, where the next wall would show edge-on", () => {
        const alongX = wallFace(1, 2);
        viewFrom({x: 7, y: 1.25, z: 1.5}, middleOf(alongX));

        expectNoStep(alongX, "right");
        expect(stepFrom(alongX, "left")).toBe(wallFace(2, 2));
    });

    it("stays on the floor behind a wall two layers tall, whose face on that side is turned away all the way up", () => {
        addShrunkBlock(15, 14, COLLISION_LAYER_MIN, LOW_Z_HALF);
        addShrunkBlock(15, 14, COLLISION_LAYER_MIN + 1, LOW_Z_HALF);
        // From the high-z side: the wall's flush face looks toward -z.
        viewFrom({x: 14.5, y: 4, z: 21.5}, middleOf(floorQuadIndexOf(16, 14)));

        expectNoStep(floorQuadIndexOf(14, 14), "down");
    });

    it("stays on a face that is itself seen from behind, whichever way is pressed, and along one seen edge-on", () => {
        // A wall standing free, three cells long.
        for (const row of [9, 10, 11])
            buildPillar(room, row, 5, COLLISION_LAYER_MIN, 3);
        const face = quadIndexOf(10, 5, "x", "+", 2);

        // From the side its faces are turned away from.
        viewFrom({x: -1, y: 1.25, z: 10.5}, middleOf(face));
        expectNoStepAnyWay(face);

        // In the wall's own plane, off its high-z end: up, down and away along it there is nothing turned
        // toward the camera within a face's reach.
        viewFrom({x: 6, y: 1.25, z: 20}, middleOf(face));
        expectNoStep(face, "up");
        expectNoStep(face, "down");
        expectNoStep(face, "left");

        // From before it, as ever.
        viewFrom({x: 12, y: 1.25, z: 10.5}, middleOf(face));
        expect(stepFrom(face, "right")).toBe(quadIndexOf(9, 5, "x", "+", 2));
    });

    it("goes only so far along a wall as the one face a step leaves selectable, never past a face it may not take", () => {
        const start = wallFace(10, 2);
        viewFrom({x: 7, y: 1.25, z: 10.5}, middleOf(start));
        // Two cells along: the face between is turned toward the camera, so it is not one to pass over.
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

        // From over the head of the flight, looking down it: the risers are turned away, toward its foot.
        viewFrom({x: 12.5, y: 6, z: 10.5}, {x: 6.5, y: 1, z: 10.5});
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
        viewFrom({x: 11, y: 4, z: 10.5}, middleOf(top));

        expect(stepFrom(top, "up")).toBe(behind);
        expect(stepFrom(behind, "down")).toBe(top);
    });

    it("steps up onto a block seen squarely, past its side that shows edge-on", () => {
        buildPillar(room, 15, 14, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const start = floorQuadIndexOf(15, 15);
        const top = quadIndexOf(15, 14, "y", "+", COLLISION_LAYER_MIN);
        viewFrom({x: 15.5, y: 4, z: 21.5}, middleOf(start));

        expect(stepFrom(start, "left")).toBe(top);
        expect(stepFrom(top, "right")).toBe(start);
    });

    it("passes the jog between a thinner wall and a block standing proud of it, seen squarely", () => {
        addShrunkBlock(10, 6, COLLISION_LAYER_MIN, LOW_Z_HALF);
        buildPillar(room, 10, 7, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const thin = quadIndexOf(10, 6, "z", "+", COLLISION_LAYER_MIN);
        const proudFront = quadIndexOf(10, 7, "z", "+", COLLISION_LAYER_MIN);

        // Squarely before the two: the strip of side between them shows edge-on.
        viewFrom({x: 7, y: 1, z: 16}, {x: 7, y: 0.25, z: 10.5});
        expect(stepFrom(thin, "right")).toBe(proudFront);
        expect(stepFrom(proudFront, "left")).toBe(thin);
    });

    it("goes from the floor behind a low wall onto its top, past its face on that side", () => {
        addShrunkBlock(15, 14, COLLISION_LAYER_MIN, LOW_Z_HALF);
        // From the high-z side: the wall's flush face looks toward -z.
        viewFrom({x: 14.5, y: 4, z: 21.5}, middleOf(floorQuadIndexOf(16, 14)));

        expect(stepFrom(floorQuadIndexOf(14, 14), "down")).toBe(quadIndexOf(15, 14, "y", "+", COLLISION_LAYER_MIN));
    });

    it("goes round to the end of a wall seen along its length, past the face beside it that shows edge-on", () => {
        for (const row of [9, 10, 11])
            buildPillar(room, row, 5, COLLISION_LAYER_MIN, 3);
        const face = quadIndexOf(10, 5, "x", "+", 2);
        // In the wall's own plane, off its high-z end, which is turned squarely toward the camera.
        viewFrom({x: 6, y: 1.25, z: 20}, middleOf(face));

        expect(stepFrom(face, "right")).toBe(quadIndexOf(11, 5, "z", "+", 2));
    });

    it("passes over one such face and no more", () => {
        // A block two layers tall: beyond the top of its far side lies the rest of that side, turned away too.
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN + 1);
        const top = quadIndexOf(10, 5, "y", "+", COLLISION_LAYER_MIN + 1);
        viewFrom({x: 11, y: 4, z: 10.5}, middleOf(top));

        expectNoStep(top, "up");
    });

    it("goes to a face the surface runs on into directly before one that lies past a face turned away", () => {
        // Half a block beside a floor tile, across half that tile's width, with its side seen edge-on: past
        // that side lies the block's top, but the tile beside the block is right there.
        addShrunkBlock(15, 14, COLLISION_LAYER_MIN, LOW_Z_HALF);
        const start = floorQuadIndexOf(15, 15);
        viewFrom({x: 15.5, y: 4, z: 21.5}, middleOf(start));

        expect(stepFrom(start, "left")).toBe(floorQuadIndexOf(15, 14));

        // The top is taken where the tile may not be.
        voxelQuadSelectionRestrictionObservable.set(quadIndexOf(15, 14, "y", "+", COLLISION_LAYER_MIN));
        expect(stepFrom(start, "left")).toBe(quadIndexOf(15, 14, "y", "+", COLLISION_LAYER_MIN));
    });

    it("asks the orbit to keep its angles, as any step of a face does", () => {
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, COLLISION_LAYER_MIN);
        const top = quadIndexOf(10, 5, "y", "+", COLLISION_LAYER_MIN);
        viewFrom({x: 11, y: 4, z: 10.5}, middleOf(top));

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

    it("is the orbit where it would stand once it had slid alongside, not where it stands yet", () => {
        const alongX = wallFace(1, 2);
        const alongZ = quadIndexOf(0, 1, "z", "+", 2);

        // Squarely before the first wall, the camera stands before the plane of the second: but slid on to the
        // second's block, it would stand in that plane, with the face edge-on.
        orbitWallBlock(alongX, 0, 6);
        expect(GraphicsManager.getCamera().position.z).toBeGreaterThan(middleOf(alongZ).z);
        expectNoStep(alongX, "right");

        // A few degrees round is still short of the face's own depth from its block's middle.
        orbitWallBlock(alongX, 3, 6);
        expectNoStep(alongX, "right");
        orbitWallBlock(alongX, 7, 6);
        expect(stepFrom(alongX, "right")).toBe(alongZ);
    });

    it("has to stand further round from close by, where that depth counts for more", () => {
        const alongX = wallFace(1, 2);
        const alongZ = quadIndexOf(0, 1, "z", "+", 2);

        orbitWallBlock(alongX, 10, 2);
        expectNoStep(alongX, "right");
        orbitWallBlock(alongX, 20, 2);
        expect(stepFrom(alongX, "right")).toBe(alongZ);
    });

    it("needs no more than to stand on the right side of a face with no depth behind it, which a block's has", () => {
        // Barely above level with the foot of a wall: the floor at its foot is a tile lying in its own plane.
        const wallFoot = wallFace(10, COLLISION_LAYER_MIN);
        orbitWallBlock(wallFoot, 0, 6, 2);
        expect(stepFrom(wallFoot, "down")).toBe(floorQuadIndexOf(10, 1));
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

    it("counts a shrunk block's face by how deep it lies in its own block, less than a whole one's", () => {
        // A wall half a cell thick on the tile it stands on, whose face lies a quarter of a cell from its middle.
        // (Two layers tall, so that past its face at the foot there is only more of the same.)
        addShrunkBlock(15, 14, COLLISION_LAYER_MIN, LOW_Z_HALF);
        addShrunkBlock(15, 14, COLLISION_LAYER_MIN + 1, LOW_Z_HALF);
        const under = floorQuadIndexOf(15, 14);
        const thick = quadIndexOf(15, 14, "z", "+", COLLISION_LAYER_MIN);
        const tile = middleOf(under);

        // From the high-x side and above, so far round toward the side the face is turned to: the view's
        // right runs toward the wall.
        const viewRound = (roundDeg: number) => viewFrom({
            x: tile.x + 6 * Math.cos(30 * DEG) * Math.cos(roundDeg * DEG),
            y: tile.y + 6 * Math.sin(30 * DEG),
            z: tile.z + 6 * Math.cos(30 * DEG) * Math.sin(roundDeg * DEG),
        }, tile);

        viewRound(2);
        expectNoStep(under, "right");
        // Far enough round for a face that deep, though not for one half a cell deep.
        viewRound(4);
        expect(6 * Math.cos(30 * DEG) * Math.sin(4 * DEG)).toBeLessThan(0.5);
        expect(stepFrom(under, "right")).toBe(thick);
    });

    it("is the camera where it stands, under a camera that no selection moves", () => {
        const alongX = wallFace(1, 2);
        const alongZ = quadIndexOf(0, 1, "z", "+", 2);
        // A free camera is left as it is by a selection (see WorldSpaceSelectionUtil).
        cameraModeObservable.set({type: "free"});

        // Squarely before the first wall it stands before the plane of the second, and stays there.
        orbitWallBlock(alongX, 0, 6);
        expect(stepFrom(alongX, "right")).toBe(alongZ);
        expect(cameraModeObservable.peek().type).toBe("free");

        // And behind that plane, off past the corner.
        viewFrom({x: 6, y: 1.25, z: 0.5}, middleOf(alongX));
        expectNoStep(alongX, "right");
    });

    it("is the camera where it stands, under an orbit a step holds on a point of its own", () => {
        const alongX = wallFace(1, 2);
        const alongZ = quadIndexOf(0, 1, "z", "+", 2);
        orbitCameraTargetOverrideObservable.set(blockMiddleOf(alongX));

        orbitWallBlock(alongX, 0, 6);
        expect(stepFrom(alongX, "right")).toBe(alongZ);
        expect(cameraModeObservable.peek().type).toBe("orbit");
    });
});

describe("a selected face with nowhere to step to", () => {
    it("stays where it is where the room's surface runs out of the grid", () => {
        // A gap in the room's own wall, floor to ceiling.
        for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
        {
            expect(VoxelUpdateUtil.removeVoxelBlock(undefined, room.voxelGrid.voxels,
                quadIndexOf(10, WALL_COL, "y", "+", layer))).toBe(true);
        }
        const inGap = floorQuadIndexOf(10, WALL_COL);
        viewFrom({x: 6, y: 4, z: 10.5}, middleOf(floorQuadIndexOf(10, 1)));

        expect(stepFrom(floorQuadIndexOf(10, 1), "up")).toBe(inGap);
        expectNoStep(inGap, "up");
        expect(stepFrom(inGap, "down")).toBe(floorQuadIndexOf(10, 1));
    });

    it("stays where it is when it isn't drawn itself", () => {
        // A face inside the room's own wall, selected outright.
        const buried = quadIndexOf(0, 10, "x", "+", 2);
        expect(isQuadVisible(room, buried)).toBe(false);
        viewFrom({x: 16, y: 1.25, z: 0.5}, middleOf(buried));

        expectNoStepAnyWay(buried);
    });

    it("stays where it is while a step holds the selection of faces still", () => {
        const start = wallFace(10, 2);
        viewFrom({x: 7, y: 1.25, z: 10.5}, middleOf(start));

        for (const flag of [FeatureFlag.DisableVoxelQuadSelectionChange, FeatureFlag.DisableAllSelectionChange])
        {
            clientFeatureFlagsObservable.tryAdd(flag);
            expectNoStepAnyWay(start);
            clientFeatureFlagsObservable.tryRemove(flag);
        }
    });

    it("goes only to the one face a step leaves selectable", () => {
        const start = wallFace(10, 2);
        viewFrom({x: 7, y: 1.25, z: 10.5}, middleOf(start));
        voxelQuadSelectionRestrictionObservable.set(wallFace(10, 3));

        expectNoStep(start, "right");
        expectNoStep(start, "down");
        expect(stepFrom(start, "up")).toBe(wallFace(10, 3));
    });
});

describe("what a step of a face asks of the orbit", () => {
    it("is to keep its angles, along a surface and round a corner alike", () => {
        const tile = floorQuadIndexOf(10, 1);
        viewFrom({x: 6, y: 4, z: 10.5}, middleOf(tile));

        expect(stepFrom(tile, "down")).toBe(floorQuadIndexOf(10, 2));
        expect(orbitCameraAngleHoldRequestObservable.peek()).toBe(true);

        orbitCameraAngleHoldRequestObservable.set(false);
        expect(stepFrom(tile, "up")).toBe(wallFace(10, COLLISION_LAYER_MIN));
        expect(orbitCameraAngleHoldRequestObservable.peek()).toBe(true);
    });

    it("is nothing for a step that went nowhere", () => {
        // A block's top at its far edge, whose far side is turned away.
        buildPillar(room, 10, 5, COLLISION_LAYER_MIN, 1);
        const top = quadIndexOf(10, 5, "y", "+", 1);
        viewFrom({x: 11, y: 4, z: 10.5}, middleOf(top));

        expectNoStep(top, "up");
        expect(orbitCameraAngleHoldRequestObservable.peek()).toBe(false);
    });
});

// ─── Objects ────────────────────────────────────────────────────────────────

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");

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

    /** A canvas (a cell across and two layers tall unless given a size), added the way a user's own is. */
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
        // Two cells off along the wall and a layer above its top: up and to the right, but more to the right.
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
        // A wall standing free, with a canvas on each face of it, back to back.
        for (const row of [8, 9, 10, 11])
            buildPillar(room, row, 5, COLLISION_LAYER_MIN, 5);
        const front = addCanvas("front", {x: 6, y: 1.5, z: 10.5}, {x: 1, y: 0, z: 0});
        const back = addCanvas("back", {x: 5, y: 1.5, z: 10.25}, {x: -1, y: 0, z: 0});
        const frontPos = front.params.transform.pos, backPos = back.params.transform.pos;

        // From the front and off to one side, the one behind the wall lies to the right, a block away.
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
        // A canvas alone on the wall, and a face right beside it.
        const alone = hangOnWall("alone", 10.5);
        faceWallAt(10.5);
        await select(alone);
        for (const direction of DIRECTIONS)
            expectNoStep(direction);
        expect(VoxelQuadSelection.isSelected()).toBe(false);

        const face = quadIndexOf(12, 0, "x", "+", 2);
        expect(VoxelQuadSelection.trySelect(voxelAt(room, 12, 0), face)).toBe(true);
        await settle();
        expect(SelectionStepUtil.tryStep("right")).toBe(true);
        expect(selectedQuadIndex()).toBe(quadIndexOf(11, 0, "x", "+", 2));
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
            viewFrom({x: 7, y: 1.25, z: 10.5}, middleOf(start));
            forceSelect(room, start);
            expect(announced).toEqual([]);

            // Looking toward -x, the view's right runs toward -z, which is the row before.
            expect(SelectionStepUtil.tryStep("right")).toBe(true);
            expect(SelectionStepUtil.tryStep("up")).toBe(true);
            expect(announced).toEqual([[start, wallFace(9, 2)], [wallFace(9, 2), wallFace(9, 3)]]);

            // Up from the wall's top layer there is only the ceiling, seen from above it: turned away.
            const wallTop = wallFace(10, COLLISION_LAYER_MAX);
            viewFrom({x: 6, y: 9.5, z: 10.5}, middleOf(wallTop));
            expectNoStep(wallTop, "up");
            expect(announced.length).toBe(2);
        }
        finally
        {
            manualSelectionObservable.removeListener("selection-step.test");
        }
    });
});
