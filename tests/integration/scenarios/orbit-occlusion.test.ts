/**
 * Scenario tests: what the orbit camera hides to see its target (see OrbitOcclusionHider), mostly with one of
 * the room's own floor tiles as the target and a prop on a wall by it.
 * Covers: a prop never taken off blocks that are left standing (the floor at the wall's foot seen from all
 * round the room); a prop going along with its wall once the wall is in the way, and never without a block it
 * rests on; the cone of sight (a wall opened the wider the nearer the camera it stands and the faster the cone
 * widens, and only as far as the samples open it once the cone has no width; a prop in the cone going with its
 * wall though no sample's ray meets it; a selected face's own wall left standing however aslant it is seen,
 * and what stands out from it taken; the room's floor left under a camera above it and opened under one
 * beneath, never the floor a selected tile lies in); and the test of a box against a cone (its side, tip and
 * base, a cone of no width, never missing a box that holds a point of the cone or taking one clear of it).
 * Browser-bound client modules are stubbed, and a prop is a plain mesh where its picture is drawn; the room,
 * the placement rules, the hider and its ray casts run for real. How fast the cone widens is set here rather
 * than read from the game's constant, which is for tuning.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";

// How fast the cone of sight widens (see ORBIT_SIGHT_CONE_RADIUS_PER_DISTANCE), for a test to set.
const sightCone = vi.hoisted(() => ({radiusPerDistance: 0}));
vi.mock("../../../src/client/system/clientConstants", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    get ORBIT_SIGHT_CONE_RADIUS_PER_DISTANCE() { return sightCone.radiusPerDistance; },
}));

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
    default: { getCurrentRoom: vi.fn(), getVoxelQuads: vi.fn(), getUser: vi.fn(), getEnv: vi.fn() },
}));

// Who owns what: a prop by its id, and every voxel by a stand-in the orbit may hide.
vi.mock("../../../src/client/object/clientObjectManager", () => ({
    default: { getMyPlayer: vi.fn(), getObjectById: vi.fn() },
}));

// The meshes a ray is cast through: the props' pictures (the voxel mesh is never among them; see CameraUtil).
vi.mock("../../../src/client/graphics/factories/meshFactory", () => {
    const meshes: unknown[] = [];
    return { default: {
        getMeshes: () => meshes,
        getMeshesExcept: (_excludedMeshId: string, out: unknown[]) => { out.length = 0; out.push(...meshes); return out; },
        getMesh: (meshId: string) => (meshes as {name: string}[]).find(mesh => mesh.name == meshId),
    } };
});

import * as THREE from "three";
import fc from "fast-check";
import App from "../../../src/client/app";
import MeshFactory from "../../../src/client/graphics/factories/meshFactory";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import InstancedMeshGraphics from "../../../src/client/object/components/instancedMeshGraphics";
import OrbitCameraPose from "../../../src/client/object/components/helpers/player/orbitCameraPose";
import OrbitOcclusionHider from "../../../src/client/object/components/helpers/player/orbitOcclusionHider";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import ClientVoxelQueryUtil from "../../../src/client/voxel/util/clientVoxelQueryUtil";
import VoxelQuadInstanceUtil from "../../../src/client/voxel/util/voxelQuadInstanceUtil";
import { FRAMED_PANEL_BOARD_RELIEF, FRAMED_PANEL_CONTENT_LIFT }
    from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/framedPanelCompositionConstants";
import AABB3 from "../../../src/shared/math/types/aabb3";
import Vec3 from "../../../src/shared/math/types/vec3";
import Geometry3DUtil from "../../../src/shared/math/util/geometry3DUtil";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import PropObjectTypeConfig from "../../../src/shared/object/types/objectTypeConfig/propObjectTypeConfig";
import ObjectScaleUtil from "../../../src/shared/object/util/objectScaleUtil";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import Room from "../../../src/shared/room/types/room";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_Y,
    NUM_COLLISION_LAYERS_PER_STOREY, NUM_VOXEL_QUADS_PER_ROOM, STOREY_FLOOR_COLLISION_LAYER,
    VOXEL_CELL_SIZE } from "../../../src/shared/system/sharedConstants";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import { createEditingUser } from "../helpers/mockUser";
import { FIXTURE_PICTURES, useFixturePictures } from "../helpers/pictureFixture";
import { createRoom, quadIndexOf } from "../helpers/selectionHarness";

// The acting user (editing utilities require one).
const actingUser = createEditingUser();

const ROOM_ID = "orbit-occlusion-room";
const PROP_ID = "a-prop";
const propTypeIndex = ObjectTypeConfigMap.getIndexByType("Prop");

// The voxel whose floor tile is selected, out on the open floor of the lower storey.
const ROW = 24, COL = 24;
// The orbit's target for that tile, as WorldSpaceSelectionUtil frames the room's own floor, and the
// distance it keeps from a selection.
const TILE: AABB3 = {
    center: {x: VoxelQueryUtil.getWorldXAtVoxelColCenter(COL), y: 0, z: VoxelQueryUtil.getWorldZAtVoxelRowCenter(ROW)},
    halfSize: {x: 0.5 * VOXEL_CELL_SIZE, y: 0, z: 0.5 * VOXEL_CELL_SIZE},
};
const ORBIT_DISTANCE = 5;

// Where a voxel row or col begins in the world (along z or x), which is where its lower side's face lies.
const lowerSideOf = (rowOrCol: number) => rowOrCol * VOXEL_CELL_SIZE;

// How fast the cone of sight widens in these scenarios: its radius per unit of distance from the orbit's pivot.
const SIGHT_CONE_RADIUS_PER_DISTANCE = 0.3;
// How far up its target's height the orbit's pivot lies from the middle (see OrbitCameraPose).
const PIVOT_HEIGHT_PER_HALF_HEIGHT = 0.2;

const WEST = {x: -1, y: 0, z: 0}, EAST = {x: 1, y: 0, z: 0};

// What every voxel belongs to, as far as the orbit asks: room fabric it may hide.
const voxelOwner = {components: {orbitOccluder: {}}} as unknown as GameObject;

let room: Room;
let hider: OrbitOcclusionHider;
let prop: GameObject | undefined;
let propMesh: THREE.Mesh;
const camera = new THREE.PerspectiveCamera();
// The quad each voxel mesh instance draws, and the instances the hider has hidden.
let quadIndexByInstanceId: number[] = [];
const hiddenInstanceIds = new Set<number>();

function standBlocks(row: number, col: number, numLayers: number): void
{
    for (let layer = COLLISION_LAYER_MIN; layer < COLLISION_LAYER_MIN + numLayers; ++layer)
    {
        expect(VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels,
            quadIndexOf(row, col, "y", "+", layer), [1, 1, 1, 1, 1, 1])).toBe(true);
    }
}

// Gives every drawn quad an instance of the voxel mesh, as the voxels' own objects do once the room is built.
function drawRoom(): void
{
    for (let instanceId = 0; instanceId < quadIndexByInstanceId.length; ++instanceId)
        VoxelQuadInstanceUtil.unbind(quadIndexByInstanceId[instanceId], instanceId);
    quadIndexByInstanceId = [];
    for (let quadIndex = 0; quadIndex < NUM_VOXEL_QUADS_PER_ROOM; ++quadIndex)
    {
        if (!VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, quadIndex))
            continue;
        VoxelQuadInstanceUtil.bind(quadIndex, quadIndexByInstanceId.length);
        quadIndexByInstanceId.push(quadIndex);
    }
}

// Attaches a prop showing an image, at that image's own size, with a mesh where its picture is drawn (see
// PictureGameObject).
function attachProp(imagePath: string, pos: Vec3, dir: Vec3): void
{
    const signal = new AddObjectSignal(room.id, actingUser.id, actingUser.userName, propTypeIndex, PROP_ID,
        new ObjectTransform({...pos}, {...dir}, PropObjectTypeConfig.util.getImageScale(imagePath, 0)!),
        {[ObjectMetadataKeyEnumMap.ImagePath]: new EncodableByteString(imagePath)});
    expect(ObjectUpdateUtil.addObject(actingUser, room, signal)).toBe(true);

    const params = room.objectById[PROP_ID];
    const size = ObjectScaleUtil.getObjectSize(propTypeIndex, params.transform.scale);
    const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(params.transform.dir);
    const lift = FRAMED_PANEL_BOARD_RELIEF + FRAMED_PANEL_CONTENT_LIFT;

    propMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
    propMesh.name = PROP_ID;
    propMesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(right.x, right.y, right.z),
        new THREE.Vector3(up.x, up.y, up.z), new THREE.Vector3(normal.x, normal.y, normal.z)));
    propMesh.position.set(params.transform.pos.x + lift * normal.x, params.transform.pos.y + lift * normal.y,
        params.transform.pos.z + lift * normal.z);
    propMesh.scale.set(size.x, size.y, 1);
    propMesh.updateMatrixWorld(true);
    MeshFactory.getMeshes().push(propMesh);

    // The game object the client would have made of it, as far as the hider looks at one.
    prop = {params, config: ObjectTypeConfigMap.getConfigByIndex(propTypeIndex),
        components: {orbitOccluder: {}}, forEachOwnedInstance: () => {}} as unknown as GameObject;
}

// Clears the view of a target from a place on its orbit: azimuth from the room's +x round towards +z, and
// elevation above the pivot, both in degrees.
function lookAt(target: AABB3, azimuth: number, elevation: number, distance: number = ORBIT_DISTANCE): void
{
    const a = THREE.MathUtils.degToRad(azimuth), e = THREE.MathUtils.degToRad(elevation);
    const pivotY = target.center.y + PIVOT_HEIGHT_PER_HALF_HEIGHT * target.halfSize.y;
    camera.position.set(target.center.x + distance * Math.cos(e) * Math.cos(a),
        pivotY + distance * Math.sin(e), target.center.z + distance * Math.cos(e) * Math.sin(a));
    camera.lookAt(target.center.x, pivotY, target.center.z);
    camera.updateMatrixWorld(true);
    hider.update(1, camera, target); // Long enough since the last sweep for another.
}

function lookAtTileFrom(azimuth: number, elevation: number, distance: number = ORBIT_DISTANCE): void
{
    lookAt(TILE, azimuth, elevation, distance);
}

// The hidden quads whose place in the room a filter picks out.
function hiddenQuadsWhere(picks: (row: number, col: number, layer: number, quadIndex: number) => boolean): number[]
{
    const quadIndices: number[] = [];
    for (const instanceId of hiddenInstanceIds)
    {
        const quadIndex = quadIndexByInstanceId[instanceId];
        if (picks(VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex), VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex),
            VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex), quadIndex))
        {
            quadIndices.push(quadIndex);
        }
    }
    return quadIndices;
}

const sorted = (values: Iterable<number>) => [...new Set(values)].sort((a, b) => a - b);

// The layers of a cell whose blocks are hidden.
function hiddenLayersOf(row: number, col: number): number[]
{
    return sorted(hiddenQuadsWhere((r, c, layer) => r == row && c == col && layer <= COLLISION_LAYER_MAX)
        .map(quadIndex => VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex)));
}

// The rows of a column of cells whose blocks in a layer are hidden.
function hiddenRowsOf(col: number, layer: number): number[]
{
    return sorted(hiddenQuadsWhere((_row, c, l) => c == col && l == layer)
        .map(quadIndex => VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex)));
}

// The cells whose tile of the room's own floor is hidden, as "row/col".
function hiddenFloorTiles(): string[]
{
    return hiddenQuadsWhere((row, col, _layer, quadIndex) => quadIndex == VoxelQueryUtil.getFloorVoxelQuadIndex(row, col))
        .map(quadIndex => `${VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex)}/${VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex)}`);
}

// The same of the room's own ceiling.
function hiddenCeilingTiles(): string[]
{
    return hiddenQuadsWhere((row, col, _layer, quadIndex) => quadIndex == VoxelQueryUtil.getCeilingVoxelQuadIndex(row, col))
        .map(quadIndex => `${VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex)}/${VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex)}`);
}

// A wall across the room along its z, one block thick and as tall as a storey is high.
function standWall(col: number, firstRow: number = ROW - 16, lastRow: number = ROW + 16): void
{
    for (let row = firstRow; row <= lastRow; ++row)
        standBlocks(row, col, NUM_COLLISION_LAYERS_PER_STOREY);
}

const propIsHidden = () => !propMesh.visible;

useFixturePictures();

beforeEach(() => {
    room = createRoom(ROOM_ID);
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    prop = undefined;
    MeshFactory.getMeshes().length = 0;
    // The room's other objects (its entrance door) are never spawned here.
    (ClientObjectManager.getObjectById as Mock).mockImplementation((objectId: string) =>
        (objectId == PROP_ID) ? prop : (objectId in room.objectById) ? undefined : voxelOwner);

    sightCone.radiusPerDistance = SIGHT_CONE_RADIUS_PER_DISTANCE;
    hiddenInstanceIds.clear();
    vi.spyOn(InstancedMeshGraphics, "setInstanceHidden").mockImplementation((instancedMeshId, instanceId, hidden) => {
        expect(instancedMeshId).toBe(ClientVoxelQueryUtil.getVoxelInstancedMeshId());
        if (hidden)
            hiddenInstanceIds.add(instanceId);
        else
            hiddenInstanceIds.delete(instanceId);
    });
    hider = new OrbitOcclusionHider();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("a prop on a wall that is left standing", () => {
    it("stays, however the floor at the wall's foot is looked at", () => {
        // A wall along the tile's east side, and a prop standing on the floor against it in line with the tile,
        // on the wall's lowest two layers: the tile's edge lies a hair from the picture, behind where it is drawn.
        const WALL_COL = COL + 1, WALL_ROWS = [ROW - 1, ROW, ROW + 1];
        for (const row of WALL_ROWS)
            standBlocks(row, WALL_COL, 4);
        drawRoom();
        attachProp(FIXTURE_PICTURES.square, {x: lowerSideOf(WALL_COL), y: 0.5, z: TILE.center.z}, WEST);

        const viewsThatHideIt: string[] = [];
        for (let elevation = 10; elevation <= 80; elevation += 5)
        {
            for (let azimuth = 95; azimuth <= 265; ++azimuth) // from the room's side of the wall
            {
                lookAtTileFrom(azimuth, elevation);
                // The cone of sight takes the wall's top from steeply above, never the blocks behind the prop.
                for (const row of WALL_ROWS)
                {
                    const hiddenLayers = hiddenLayersOf(row, WALL_COL);
                    expect(hiddenLayers, `row ${row} from ${azimuth}/${elevation}`).not.toContain(0);
                    expect(hiddenLayers, `row ${row} from ${azimuth}/${elevation}`).not.toContain(1);
                }
                if (propIsHidden())
                    viewsThatHideIt.push(`${azimuth}/${elevation}`);
            }
        }
        expect(viewsThatHideIt).toEqual([]);
    });
});

describe("a prop on a wall that is in the way", () => {
    // A wall a world unit thick between the tile and a camera east of it, with the prop on the wall's far face,
    // towards the camera and in line with the tile, on the wall's second and third layers. It rests on the
    // wall's far blocks, over the three rows its width takes it across.
    const NEAR_COL = COL + 1, FAR_COL = COL + 2;
    const PROP_ROWS = [ROW - 1, ROW, ROW + 1], PROP_LAYERS = [1, 2];

    beforeEach(() => {
        for (let row = ROW - 4; row <= ROW + 4; ++row)
        {
            standBlocks(row, NEAR_COL, 6);
            standBlocks(row, FAR_COL, 6);
        }
        drawRoom();
        attachProp(FIXTURE_PICTURES.square, {x: lowerSideOf(FAR_COL + 1), y: 1, z: TILE.center.z}, EAST);
    });

    it("goes along with the blocks it rests on", () => {
        lookAtTileFrom(0, 30);
        expect(hiddenLayersOf(ROW, FAR_COL)).toEqual(expect.arrayContaining([0, 1, 2]));
        expect(propIsHidden()).toBe(true);
    });

    it("goes along with them by the samples alone", () => {
        sightCone.radiusPerDistance = 0;
        lookAtTileFrom(0, 30);
        expect(hiddenLayersOf(ROW, FAR_COL)).toEqual([0, 1]);
        expect(propIsHidden()).toBe(true);
    });

    it("comes back with them once the camera is round on the tile's own side", () => {
        lookAtTileFrom(0, 30);
        lookAtTileFrom(180, 30);
        for (const row of PROP_ROWS)
        {
            expect(hiddenLayersOf(row, NEAR_COL), `row ${row}`).toEqual([]);
            expect(hiddenLayersOf(row, FAR_COL), `row ${row}`).toEqual([]);
        }
        expect(propIsHidden()).toBe(false);
    });

    it("never goes while every block it rests on is left standing", () => {
        let numViewsThatHideIt = 0;
        for (let elevation = 5; elevation <= 80; elevation += 5)
        {
            for (let azimuth = -80; azimuth <= 80; azimuth += 2)
            {
                lookAtTileFrom(azimuth, elevation);
                if (!propIsHidden())
                    continue;
                ++numViewsThatHideIt;
                const restsOnHiddenBlock = PROP_ROWS.some(row => {
                    const hiddenLayers = hiddenLayersOf(row, FAR_COL);
                    return PROP_LAYERS.some(layer => hiddenLayers.includes(layer));
                });
                expect(restsOnHiddenBlock, `from ${azimuth}/${elevation}`).toBe(true);
            }
        }
        expect(numViewsThatHideIt).toBeGreaterThan(0);
    });
});

describe("the cone of sight", () => {
    // Two walls across the view of the tile from low in the east: one a few blocks from the tile, one just
    // before the camera. The line of sight passes the first in its lowest layer and the second in the next.
    const NEAR_TARGET_COL = COL + 4, NEAR_TARGET_LAYER = 0;
    const NEAR_CAMERA_COL = COL + 10, NEAR_CAMERA_LAYER = 1;
    const lookFromTheEast = () => lookAtTileFrom(0, 10, 6);

    function standBothWalls(): void
    {
        standWall(NEAR_TARGET_COL);
        standWall(NEAR_CAMERA_COL);
        drawRoom();
    }

    it("opens a wall up the wider, the nearer the camera it stands", () => {
        standBothWalls();
        lookFromTheEast();
        // The cone is some one and a third blocks in radius by the first wall's far side, and over three by
        // the second's; the rows to either side of the tile's own begin half a block from its axis.
        expect(hiddenRowsOf(NEAR_TARGET_COL, NEAR_TARGET_LAYER)).toEqual([ROW - 1, ROW, ROW + 1]);
        expect(hiddenRowsOf(NEAR_CAMERA_COL, NEAR_CAMERA_LAYER)).toEqual(
            [ROW - 3, ROW - 2, ROW - 1, ROW, ROW + 1, ROW + 2, ROW + 3]);
    });

    it("opens them only as far as the samples do once it has no width", () => {
        sightCone.radiusPerDistance = 0;
        standBothWalls();
        lookFromTheEast();
        expect(hiddenRowsOf(NEAR_TARGET_COL, NEAR_TARGET_LAYER)).toEqual([ROW]);
        expect(hiddenRowsOf(NEAR_CAMERA_COL, NEAR_CAMERA_LAYER)).toEqual([ROW]);
    });

    it("opens them wider, the faster it widens", () => {
        standBothWalls();
        const openings: number[] = [];
        for (const radiusPerDistance of [0, 0.15, 0.3, 0.6])
        {
            sightCone.radiusPerDistance = radiusPerDistance;
            lookFromTheEast();
            openings.push(hiddenRowsOf(NEAR_CAMERA_COL, NEAR_CAMERA_LAYER).length);
        }
        expect(openings).toEqual([1, 5, 7, 13]);
    });

    it("has its tip where the orbit turns about", () => {
        standBothWalls();
        // With that point two blocks along the first wall, the opening by the tip lies that way too.
        vi.spyOn(OrbitCameraPose, "getPivot").mockImplementation((target, out) =>
            out.set(target.center.x, target.center.y, target.center.z + 2 * VOXEL_CELL_SIZE));
        lookFromTheEast();
        expect(hiddenRowsOf(NEAR_TARGET_COL, NEAR_TARGET_LAYER)).toEqual([ROW, ROW + 1, ROW + 2, ROW + 3]);
    });

    it("takes a prop along with its wall, though no sample's ray meets it", () => {
        // On the wall before the camera, facing it, over the two rows next to the one the line of sight passes.
        const PROP_ROWS = [ROW + 1, ROW + 2];
        standWall(NEAR_CAMERA_COL);
        drawRoom();
        attachProp(FIXTURE_PICTURES.square,
            {x: lowerSideOf(NEAR_CAMERA_COL + 1), y: 1, z: lowerSideOf(ROW + 2)}, EAST);

        lookFromTheEast();
        for (const row of PROP_ROWS)
            expect(hiddenLayersOf(row, NEAR_CAMERA_COL), `row ${row}`).toEqual(expect.arrayContaining([1, 2]));
        expect(propIsHidden()).toBe(true);

        sightCone.radiusPerDistance = 0;
        lookFromTheEast();
        for (const row of PROP_ROWS)
            expect(hiddenLayersOf(row, NEAR_CAMERA_COL), `row ${row}`).toEqual([]);
        expect(propIsHidden()).toBe(false);
    });

    it("leaves a selected face's own wall standing however aslant it is seen, and takes what stands out from it", () => {
        // A wall along the room's z holding the selected block, seen from the west. The orbit's pivot lies inside
        // the wall, so seen aslant the cone's own axis runs through the wall's blocks.
        const WALL_COL = COL + 1, BLOCK_LAYER = 2, PARTITION_ROW = ROW + 6;
        const block = VoxelQueryUtil.getVoxelBlockBox(ROW, WALL_COL, BLOCK_LAYER);
        const hiddenBlocksOfTheWall = () => hiddenQuadsWhere((_row, col, layer) =>
            col == WALL_COL && layer < NUM_COLLISION_LAYERS_PER_STOREY);
        standWall(WALL_COL, ROW - 20, ROW + 32);
        drawRoom();

        for (const elevation of [5, 10, 20])
        {
            for (const azimuth of [95, 100, 110, 135, 180, 225, 250, 260, 265])
            {
                lookAt(block, azimuth, elevation, 6);
                expect(hiddenBlocksOfTheWall(), `from ${azimuth}/${elevation}`).toEqual([]);
            }
        }

        // A partition out from the wall into the room, between the block and a camera that sees it aslant.
        for (let col = WALL_COL - 8; col < WALL_COL; ++col)
            standBlocks(PARTITION_ROW, col, NUM_COLLISION_LAYERS_PER_STOREY);
        drawRoom();
        lookAt(block, 100, 10, 6);
        expect(sorted(hiddenQuadsWhere((row, _col, layer) => row == PARTITION_ROW && layer == BLOCK_LAYER)
            .map(quadIndex => VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex))))
            .toEqual([WALL_COL - 3, WALL_COL - 2, WALL_COL - 1]);
        expect(hiddenBlocksOfTheWall()).toEqual([]);
    });

    it("leaves standing what stands within a world unit of a selected block, and takes what stands further off in its way", () => {
        // The selected block in a wall along the room's z, seen from the west, and a row of posts out from the wall
        // toward the camera, in line with the block and a block clear of its face.
        const WALL_COL = COL + 1, BLOCK_LAYER = 2;
        const block = VoxelQueryUtil.getVoxelBlockBox(ROW, WALL_COL, BLOCK_LAYER);
        const POST_COLS = [WALL_COL - 2, WALL_COL - 3, WALL_COL - 4, WALL_COL - 5];
        standWall(WALL_COL);
        for (const col of POST_COLS)
            standBlocks(ROW, col, NUM_COLLISION_LAYERS_PER_STOREY);
        drawRoom();

        lookAt(block, 180, 10, 6);
        const hiddenPostCols = sorted(hiddenQuadsWhere((row, col, layer) =>
            row == ROW && col < WALL_COL && layer == BLOCK_LAYER).map(quadIndex => VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex)));
        // Two blocks out from the selected one is within a world unit of it; three is not.
        expect(hiddenPostCols).toEqual([WALL_COL - 5, WALL_COL - 4, WALL_COL - 3]);
        // Nor does a layer above or below the block's own go from so near it.
        expect(hiddenLayersOf(ROW, WALL_COL - 2).filter(layer => Math.abs(layer - BLOCK_LAYER) <= 1)).toEqual([]);
        expect(hiddenLayersOf(ROW, WALL_COL)).toEqual([]);
    });

    describe("and the room's own floor", () => {
        // Something standing on the floor over the tile, the size of a character.
        const figure: AABB3 = {center: {x: TILE.center.x, y: 0.9, z: TILE.center.z},
            halfSize: {x: 0.3, y: 0.9, z: 0.3}};

        beforeEach(() => drawRoom());

        it("is left under a camera above it", () => {
            // Level with the pivot and far off, where the cone has grown wide enough to reach down to the floor.
            for (const elevation of [0, 5])
            {
                lookAt(figure, 0, elevation, 8);
                expect(hiddenFloorTiles(), `from ${elevation}`).toEqual([]);
            }
        });

        it("is opened under a camera beneath it, to either side of what the samples open", () => {
            lookAt(figure, 0, -10, 8);
            expect(hiddenFloorTiles()).toContain(`${ROW + 4}/${COL + 14}`);
            expect(hiddenFloorTiles()).toContain(`${ROW - 4}/${COL + 14}`);
            expect(hiddenFloorTiles()).not.toContain(`${ROW}/${COL + 2}`); // by the cone's tip

            sightCone.radiusPerDistance = 0;
            lookAt(figure, 0, -10, 8);
            const tiles = hiddenFloorTiles();
            expect(tiles.length).toBeGreaterThan(0);
            expect(tiles.filter(tile => !tile.startsWith(`${ROW}/`))).toEqual([]);
        });

        it("is never opened where a selected tile lies in it", () => {
            for (const elevation of [-5, -20, -45])
            {
                lookAtTileFrom(0, elevation, 6);
                expect(hiddenFloorTiles(), `from ${elevation}`).toEqual([]);
            }
        });
    });

    describe("and the room's own ceiling", () => {
        // Something standing on the upper storey's floor over the tile, the size of a character.
        const UPPER_FLOOR_Y = (STOREY_FLOOR_COLLISION_LAYER + 1) * COLLISION_LAYER_HEIGHT;
        const figure: AABB3 = {center: {x: TILE.center.x, y: UPPER_FLOOR_Y + 0.9, z: TILE.center.z},
            halfSize: {x: 0.3, y: 0.9, z: 0.3}};
        // From high enough for the camera to stand over the room, and the voxel col under where the middle of its
        // view passes through the ceiling on the way down to the figure.
        const ELEVATION = 30, DISTANCE = 8;
        const pivotY = figure.center.y + PIVOT_HEIGHT_PER_HALF_HEIGHT * figure.halfSize.y;
        const colAtCeiling = VoxelQueryUtil.getVoxelColFromWorldX(figure.center.x +
            (MAX_ROOM_Y - pivotY) / Math.tan(THREE.MathUtils.degToRad(ELEVATION)));

        beforeEach(() => drawRoom());

        it("is left over a camera beneath it", () => {
            for (const elevation of [0, 10])
            {
                lookAt(figure, 0, elevation, DISTANCE);
                expect(camera.position.y).toBeLessThan(MAX_ROOM_Y);
                expect(hiddenCeilingTiles(), `from ${elevation}`).toEqual([]);
            }
        });

        it("is opened over a camera above it, to either side of what the samples open", () => {
            lookAt(figure, 0, ELEVATION, DISTANCE);
            expect(camera.position.y).toBeGreaterThan(MAX_ROOM_Y);
            expect(hiddenCeilingTiles()).toContain(`${ROW + 2}/${colAtCeiling}`);
            expect(hiddenCeilingTiles()).toContain(`${ROW - 2}/${colAtCeiling}`);

            sightCone.radiusPerDistance = 0;
            lookAt(figure, 0, ELEVATION, DISTANCE);
            const tiles = hiddenCeilingTiles();
            expect(tiles.length).toBeGreaterThan(0);
            expect(tiles).not.toContain(`${ROW + 2}/${colAtCeiling}`);
            expect(tiles).not.toContain(`${ROW - 2}/${colAtCeiling}`);
        });
    });
});

describe("a box against a cone", () => {
    // A cone along x, a quarter as wide in radius as it is long.
    const APEX: Vec3 = {x: 0, y: 0, z: 0}, BASE: Vec3 = {x: 10, y: 0, z: 0};
    const boxFrom = (minX: number, minY: number, minZ: number, size: number = 1): AABB3 => ({
        center: {x: minX + 0.5 * size, y: minY + 0.5 * size, z: minZ + 0.5 * size},
        halfSize: {x: 0.5 * size, y: 0.5 * size, z: 0.5 * size},
    });
    const reaches = (box: AABB3, radiusPerDistance: number = 0.25) =>
        Geometry3DUtil.coneReachesAABB(APEX, BASE, radiusPerDistance, box);

    it("is in it up to its side", () => {
        // By x = 5, where the box's nearest edge lies, the cone's side has risen to 1.25.
        expect(reaches(boxFrom(4, 1.24, -0.5))).toBe(true);
        expect(reaches(boxFrom(4, 1.26, -0.5))).toBe(false);
    });

    it("is in it up to its side whichever way the cone points", () => {
        const apex: Vec3 = {x: 1, y: 2, z: 3};
        const axis = new THREE.Vector3(1, -2, 0.5).normalize();
        const across = new THREE.Vector3(2, 1, 0).normalize(); // at right angles to the axis
        const base: Vec3 = {x: apex.x + 10 * axis.x, y: apex.y + 10 * axis.y, z: apex.z + 10 * axis.z};
        // A speck of a box six along the axis, where the cone's radius is 1.5, and so far out from it.
        const speck = (distanceFromAxis: number): AABB3 => ({
            center: {x: apex.x + 6 * axis.x + distanceFromAxis * across.x,
                y: apex.y + 6 * axis.y + distanceFromAxis * across.y, z: apex.z + 6 * axis.z + distanceFromAxis * across.z},
            halfSize: {x: 0.01, y: 0.01, z: 0.01},
        });
        expect(Geometry3DUtil.coneReachesAABB(apex, base, 0.25, speck(1.45))).toBe(true);
        expect(Geometry3DUtil.coneReachesAABB(apex, base, 0.25, speck(1.55))).toBe(false);
    });

    it("begins at its tip", () => {
        expect(reaches(boxFrom(-1, -0.5, -0.5))).toBe(true); // touching it
        expect(reaches(boxFrom(-1.1, -0.5, -0.5))).toBe(false);
    });

    it("ends at its base", () => {
        expect(reaches(boxFrom(9.5, -0.5, -0.5))).toBe(true);
        expect(reaches(boxFrom(10.1, -0.5, -0.5))).toBe(false);
    });

    it("is its axis alone once it has no width", () => {
        expect(reaches(boxFrom(4, -0.5, -0.5), 0)).toBe(true);
        expect(reaches(boxFrom(4, 0.01, -0.5), 0)).toBe(false);
    });

    it("never misses a box holding a point of the cone, nor takes one clear of it", () => {
        const coordinate = fc.double({min: -8, max: 8, noNaN: true});
        const point = fc.record({x: coordinate, y: coordinate, z: coordinate});
        const halfExtent = fc.double({min: 0, max: 2, noNaN: true});
        const share = fc.double({min: -1, max: 1, noNaN: true});

        fc.assert(fc.property(point, point, fc.double({min: 0, max: 1.5, noNaN: true}), point,
            fc.record({x: halfExtent, y: halfExtent, z: halfExtent}),
            fc.array(fc.record({x: share, y: share, z: share}), {minLength: 16, maxLength: 16}),
            (apex, base, radiusPerDistance, center, halfSize, shares) => {
                const axis = new THREE.Vector3(base.x - apex.x, base.y - apex.y, base.z - apex.z);
                const length = axis.length();
                fc.pre(length > 0.5);
                axis.divideScalar(length);
                const fromApex = (p: Vec3) => new THREE.Vector3(p.x - apex.x, p.y - apex.y, p.z - apex.z);
                const result = Geometry3DUtil.coneReachesAABB(apex, base, radiusPerDistance, {center, halfSize});

                // Points of the box, well inside the cone.
                for (const s of shares)
                {
                    const offset = fromApex({x: center.x + s.x * halfSize.x, y: center.y + s.y * halfSize.y,
                        z: center.z + s.z * halfSize.z});
                    const along = offset.dot(axis);
                    const fromAxis = Math.sqrt(Math.max(0, offset.lengthSq() - along * along));
                    if (along > 1e-6 && along < length - 1e-6 && fromAxis < radiusPerDistance * along - 1e-6)
                        expect(result).toBe(true);
                }

                // The ball around the box, clear of the cone: behind its tip, past its base, or further from its
                // axis than it ever widens (its end is rounded off a little past the base).
                const radius = Math.hypot(halfSize.x, halfSize.y, halfSize.z) + 1e-6;
                const middle = fromApex(center);
                const along = middle.dot(axis);
                const fromAxis = Math.sqrt(Math.max(0, middle.lengthSq() - along * along));
                const widest = radiusPerDistance * length * Math.sqrt(1 + radiusPerDistance * radiusPerDistance);
                if (along + radius < 0 || along - radius > length || fromAxis - radius > widest)
                    expect(result).toBe(false);
            }));
    });
});
