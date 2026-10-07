/**
 * Scenario tests: what the orbit camera hides to see its target (see OrbitOcclusionHider), with one of the
 * room's own floor tiles as the target and a prop on a wall by it.
 * Covers: a prop never taken off a wall that is left standing (the floor at the wall's foot seen from all
 * round the room, and a shrunk block in the selected tile's own cell, which stays whole with what hangs on
 * it); a prop going along with its wall once the wall is in the way, and never without a block it rests on.
 * Browser-bound client modules are stubbed, and a prop is a plain mesh where its picture is drawn; the room,
 * the placement rules, the hider and its ray casts run for real.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";

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
        getMesh: () => undefined,
    } };
});

import * as THREE from "three";
import App from "../../../src/client/app";
import MeshFactory from "../../../src/client/graphics/factories/meshFactory";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import InstancedMeshGraphics from "../../../src/client/object/components/instancedMeshGraphics";
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
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, NUM_VOXEL_QUADS_PER_ROOM,
    VOXEL_BLOCK_SHAPE_WHOLE } from "../../../src/shared/system/sharedConstants";
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

// The cell whose floor tile is selected, out on the open floor of the lower storey.
const ROW = 12, COL = 12;
// The orbit's target for that tile, as WorldSpaceSelectionUtil frames the room's own floor, and the
// distance it keeps from a selection.
const TILE: AABB3 = {center: {x: COL + 0.5, y: 0, z: ROW + 0.5}, halfSize: {x: 0.5, y: 0, z: 0.5}};
const ORBIT_DISTANCE = 5;

// The halves of its cell a shrunk block can fill along x.
const LOW_X_HALF = 0b0101, HIGH_X_HALF = 0b1010;

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

function standBlocks(row: number, col: number, numLayers: number, shape: number = VOXEL_BLOCK_SHAPE_WHOLE): void
{
    for (let layer = COLLISION_LAYER_MIN; layer < COLLISION_LAYER_MIN + numLayers; ++layer)
    {
        expect(VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels,
            quadIndexOf(row, col, "y", "+", layer), [1, 1, 1, 1, 1, 1], undefined, shape)).toBe(true);
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

// Clears the view of the tile from a place on its orbit: azimuth from the room's +x round towards +z, and
// elevation above the floor, both in degrees.
function lookAtTileFrom(azimuth: number, elevation: number): void
{
    const a = THREE.MathUtils.degToRad(azimuth), e = THREE.MathUtils.degToRad(elevation);
    camera.position.set(TILE.center.x + ORBIT_DISTANCE * Math.cos(e) * Math.cos(a),
        ORBIT_DISTANCE * Math.sin(e), TILE.center.z + ORBIT_DISTANCE * Math.cos(e) * Math.sin(a));
    camera.lookAt(TILE.center.x, TILE.center.y, TILE.center.z);
    camera.updateMatrixWorld(true);
    hider.update(1, camera, TILE); // Long enough since the last sweep for another.
}

// The layers of a cell whose blocks are hidden.
function hiddenLayersOf(row: number, col: number): number[]
{
    const layers = new Set<number>();
    for (const instanceId of hiddenInstanceIds)
    {
        const quadIndex = quadIndexByInstanceId[instanceId];
        const layer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
        if (VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex) == row &&
            VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex) == col && layer <= COLLISION_LAYER_MAX)
        {
            layers.add(layer);
        }
    }
    return [...layers].sort((a, b) => a - b);
}

const propIsHidden = () => !propMesh.visible;

useFixturePictures();

beforeEach(() => {
    room = createRoom(ROOM_ID);
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    prop = undefined;
    MeshFactory.getMeshes().length = 0;
    (ClientObjectManager.getObjectById as Mock).mockImplementation(
        (objectId: string) => (objectId == PROP_ID) ? prop : voxelOwner);

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
        // A wall along the tile's east side, and a prop standing on the floor against it: the tile's edge
        // lies a hair from the picture, behind where it is drawn.
        standBlocks(ROW, COL + 1, 4);
        drawRoom();
        attachProp(FIXTURE_PICTURES.square, {x: COL + 1, y: 0.5, z: ROW + 0.5}, WEST);

        const viewsThatHideIt: string[] = [];
        for (let elevation = 10; elevation <= 80; elevation += 5)
        {
            for (let azimuth = 95; azimuth <= 265; ++azimuth) // from the room's side of the wall
            {
                lookAtTileFrom(azimuth, elevation);
                expect(hiddenLayersOf(ROW, COL + 1)).toEqual([]);
                if (propIsHidden())
                    viewsThatHideIt.push(`${azimuth}/${elevation}`);
            }
        }
        expect(viewsThatHideIt).toEqual([]);
    });

    // A thin wall over one half of the selected tile's own cell, with the prop on its inner face in mid-cell,
    // seen from the side the other half is open to. The tile lies under the wall too, where it shows nothing.
    const thinWalls = [
        {half: "lower-x", shape: LOW_X_HALF, facing: EAST, firstAzimuth: -80},
        {half: "upper-x", shape: HIGH_X_HALF, facing: WEST, firstAzimuth: 100},
    ];
    for (const wall of thinWalls)
    {
        it(`stays on a shrunk block over the ${wall.half} half of the selected tile's own cell, which stays whole too`, () => {
            standBlocks(ROW, COL, 4, wall.shape);
            drawRoom();
            attachProp(FIXTURE_PICTURES.tall, {x: COL + 0.5, y: 0.5, z: ROW + 0.5}, wall.facing);

            for (const elevation of [15, 30, 45, 60, 75])
            {
                for (let azimuth = wall.firstAzimuth; azimuth <= wall.firstAzimuth + 160; azimuth += 10)
                {
                    lookAtTileFrom(azimuth, elevation);
                    expect(hiddenLayersOf(ROW, COL), `from ${azimuth}/${elevation}`).toEqual([]);
                    expect(propIsHidden(), `from ${azimuth}/${elevation}`).toBe(false);
                }
            }
        });
    }
});

describe("a prop on a wall that is in the way", () => {
    // A wall between the tile and a camera east of it, with the prop on the wall's far face, towards the
    // camera, on the wall's second and third layers.
    const PROP_LAYERS = [1, 2];

    beforeEach(() => {
        for (let row = ROW - 2; row <= ROW + 2; ++row)
            standBlocks(row, COL + 1, 6);
        drawRoom();
        attachProp(FIXTURE_PICTURES.square, {x: COL + 2, y: 1, z: ROW + 0.5}, EAST);
    });

    it("goes along with the blocks it rests on", () => {
        lookAtTileFrom(0, 30);
        expect(hiddenLayersOf(ROW, COL + 1)).toEqual([0, 1, 2]);
        expect(propIsHidden()).toBe(true);
    });

    it("comes back with them once the camera is round on the tile's own side", () => {
        lookAtTileFrom(0, 30);
        lookAtTileFrom(180, 30);
        expect(hiddenLayersOf(ROW, COL + 1)).toEqual([]);
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
                const hiddenLayers = hiddenLayersOf(ROW, COL + 1);
                expect(PROP_LAYERS.some(layer => hiddenLayers.includes(layer)), `from ${azimuth}/${elevation}`).toBe(true);
            }
        }
        expect(numViewsThatHideIt).toBeGreaterThan(0);
    });
});
