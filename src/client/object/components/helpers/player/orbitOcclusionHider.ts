import * as THREE from "three";
import App from "../../../../app";
import GameObject from "../../../types/gameObject/gameObject";
import ClientObjectManager from "../../../clientObjectManager";
import MeshFactory from "../../../../graphics/factories/meshFactory";
import CameraUtil from "../../../../graphics/util/cameraUtil";
import HiddenOccluder from "../../../../graphics/types/mesh/hiddenOccluder";
import OccluderCandidate from "../../../../graphics/types/mesh/occluderCandidate";
import InstancedMeshComposer from "../../instancedMeshComposer";
import InstancedMeshGraphics from "../../instancedMeshGraphics";
import LabelText from "../../labelText";
import OrbitCameraPose from "./orbitCameraPose";
import AABB3 from "../../../../../shared/math/types/aabb3";
import Vec3 from "../../../../../shared/math/types/vec3";
import DirUtil from "../../../../../shared/math/util/dirUtil";
import Geometry3DUtil from "../../../../../shared/math/util/geometry3DUtil";
import Voxel from "../../../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../../../shared/voxel/util/voxelQueryUtil";
import VoxelBlockShapeUtil from "../../../../../shared/voxel/util/voxelBlockShapeUtil";
import ClientVoxelQueryUtil from "../../../../voxel/util/clientVoxelQueryUtil";
import VoxelQuadInstanceUtil from "../../../../voxel/util/voxelQuadInstanceUtil";
import PhysicsColliderStateUtil from "../../../../../shared/physics/util/physicsColliderStateUtil";
import ObjectAttachmentUtil from "../../../../../shared/object/util/objectAttachmentUtil";
import { DIRECTION_VECTORS, ORBIT_SIGHT_CONE_RADIUS_PER_DISTANCE } from "../../../../system/clientConstants";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, DIR_VEC_BY_CODE, MAX_ROOM_Y,
    NEAR_EPSILON, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS,
    VOXEL_BLOCK_SHAPE_EMPTY } from "../../../../../shared/system/sharedConstants";

// Hides whatever stands in the orbit camera's view of its target (see @docs/graphics/camera_control.md).
// - Only objects with an OrbitOccluder (room fabric) and voxel blocks are hidden; characters and
//   gizmos never are.
// - A candidate is in the way if it reaches into the cone of sight, which widens from the orbit's pivot
//   to the camera (see setSightCone), or if it blocks enough of the target.
// - For the latter, the target is sampled over its silhouette. Samples sit on the target's exposed
//   surface (see faceIsExposed): interior samples would condemn whole walls the target is embedded in.
// - Voxels are culled by sweeping the target box toward the camera through the grid, then tested
//   against samples. Other meshes are raycast along the samples, and a hit hides the whole object,
//   an attached one only along with a block it rests on (see restsOnHiddenBlock).
// - The target itself is protected (see setProtectedRegion).
// - Sweeps are throttled: frequent while the camera moves, rare at rest.

const minSweepInterval = 0.15; // seconds between sweeps while the camera keeps moving
const maxSweepInterval = 0.5; // seconds between sweeps while the camera rests
const cameraRestDistSqr = 0.0001; // camera movement below this counts as resting

// Silhouette grid density, and the share of samples a candidate must block to be hidden. The share is
// small because it's of the whole target (a fifth of a character is a whole limb), and sparing a
// block at the opening's rim doesn't save the wall anyway. Geometry merely near the line of sight
// blocks no sample, since samples lie on the target's surface: that is the cone's to take. The grid
// must be fine enough that coverage isn't quantized to whole rows.
const numSilhouetteColumns = 7;
const numSilhouetteRows = 7;
const minBlockedSampleRatio = 0.04;

const maxNumSamples = numSilhouetteColumns * numSilhouetteRows;

// Offset outside a sample's face for the exposure lookup.
const exposureProbeDist = 0.02;

const cameraPos = new THREE.Vector3();
const targetCenterPos = new THREE.Vector3();
const forwardTemp = new THREE.Vector3();
const rightTemp = new THREE.Vector3();
const upTemp = new THREE.Vector3();
const sampleRayTemp = new THREE.Vector3();
const sampleDestTemp = new THREE.Vector3();

// Sample buffer; only the first numSamples are used, since aims that find no exposed surface are dropped.
const silhouetteSamples = Array.from({length: maxNumSamples}, () => new THREE.Vector3());
let numSamples = 0;
let minBlockedSamples = 1;

// A point as an AABB3, so lines reuse the volume-sweep code.
const pointTemp: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: {x: 0, y: 0, z: 0}};

// Inset so surfaces the target rests flush against (floor, host wall) count as hits rather than
// contact. Same trick the physics casts use.
const targetSweepInset = 0.001;
const targetBox: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: {x: 0, y: 0, z: 0}};

// Distance a sample ray is carried past its aim: the target's bounding-sphere diameter.
let targetSpan = 0;

// A voxel target's block plus all 26 neighbours (see setProtectedRegion).
const protectedNeighborhood: AABB3 = {
    center: {x: 0, y: 0, z: 0},
    halfSize: {x: 1.5, y: 1.5 * COLLISION_LAYER_HEIGHT, z: 1.5},
};

// The region nothing may be hidden from (see setProtectedRegion).
let protectedRegion: AABB3 = targetBox;

// The room's floor and ceiling are flat tiles, carrying no thickness of their own.
const tileBoxTemp: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: {x: 0.5, y: 0, z: 0.5}};

// The cone of sight (see setSightCone): its tip, and how far its base reaches from the camera along x and z.
const sightConeTip = new THREE.Vector3();
const sightConeAxisTemp = new THREE.Vector3();
let sightConeReachX = 0;
let sightConeReachZ = 0;

// The plane that bounds the cone, if any: the axis it faces along, where it lies on that axis, and
// which way along the axis is in front of it.
let sightConeBoundAxis: "x" | "y" | "z" | undefined;
let sightConeBoundCoord = 0;
let sightConeBoundSign = 1;

// Whether the cone takes the room's own floor and ceiling, and the cell whose blocks it leaves alone (-1 if none).
let sightConeTakesFloor = false;
let sightConeTakesCeiling = false;
let sightConeSparedRow = -1;
let sightConeSparedCol = -1;

// The target's faces that hold a sample, by direction code (see DIR_VEC_BY_CODE).
const faceIsSampled: boolean[] = DIR_VEC_BY_CODE.map(() => false);

// The part of a box in front of the plane that bounds the cone.
const boxInFrontTemp: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: {x: 0, y: 0, z: 0}};

const quadIndicesTemp: number[] = [];
const intersectionsTemp: THREE.Intersection[] = [];

export default class OrbitOcclusionHider
{
    private lastSweepCameraPos = new THREE.Vector3();
    private timeSinceLastSweep = 0;

    // Hidden quads tagged with the sweep that last found them, to release stale ones.
    private sweepTagByHiddenQuadIndex: {[quadIndex: number]: number} = {};
    private sweepCount = 0;

    // Everything hidden that is not a voxel quad, keyed by `${meshId}/${instanceId}`.
    private hiddenOccluderByKey: {[occluderKey: string]: HiddenOccluder} = {};

    // This sweep's candidates, keyed by object (or geometry without one).
    private candidateByKey: {[candidateKey: string]: OccluderCandidate} = {};

    update(deltaTime: number, camera: THREE.Camera, target: AABB3): void
    {
        this.timeSinceLastSweep += deltaTime;
        if (this.timeSinceLastSweep < minSweepInterval)
            return;

        camera.getWorldPosition(cameraPos); // Sweeps follow the eased camera, i.e. the rendered one.
        if (this.timeSinceLastSweep < maxSweepInterval &&
            cameraPos.distanceToSquared(this.lastSweepCameraPos) < cameraRestDistSqr)
            return;

        this.timeSinceLastSweep = 0;
        this.lastSweepCameraPos.copy(cameraPos);
        this.sweep(target);
    }

    // Shows everything again (e.g. when the orbit mode ends), leaving nothing hidden behind.
    revealAll(): void
    {
        for (const quadIndex in this.sweepTagByHiddenQuadIndex)
            setVoxelQuadHidden(Number(quadIndex), false);
        this.sweepTagByHiddenQuadIndex = {};
        this.revealHiddenMeshOccluders();
    }

    private sweep(target: AABB3): void
    {
        const room = App.getCurrentRoom();
        const voxels = room ? room.voxelGrid.voxels : undefined;

        targetCenterPos.set(target.center.x, target.center.y, target.center.z);
        setTargetBox(target);
        setProtectedRegion(target, voxels);

        // No exposed part of the target (camera inside it, or all visible faces buried).
        if (!buildSilhouetteSamples(voxels))
        {
            this.revealAll();
            return;
        }
        setSightCone(target);

        if (voxels)
            this.hideVoxelQuadsInTheWay(voxels);
        this.hideMeshesInTheWay();
    }

    // Voxel geometry

    private hideVoxelQuadsInTheWay(voxels: Voxel[]): void
    {
        collectQuadIndicesInTheWay(voxels);

        // Release by comparison instead of unhiding everything first, which would rewrite the whole
        // voxel instance buffer every sweep.
        ++this.sweepCount;
        for (let i = 0; i < quadIndicesTemp.length; ++i)
        {
            const quadIndex = quadIndicesTemp[i];
            if (this.sweepTagByHiddenQuadIndex[quadIndex] == undefined)
                setVoxelQuadHidden(quadIndex, true);
            this.sweepTagByHiddenQuadIndex[quadIndex] = this.sweepCount;
        }
        for (const quadIndex in this.sweepTagByHiddenQuadIndex)
        {
            if (this.sweepTagByHiddenQuadIndex[quadIndex] !== this.sweepCount)
            {
                setVoxelQuadHidden(Number(quadIndex), false);
                delete this.sweepTagByHiddenQuadIndex[quadIndex];
            }
        }
    }

    // Other geometry

    private hideMeshesInTheWay(): void
    {
        // Hidden instances are parked out of the room where rays can't reach them, so reveal before
        // raycasting (cheap on these small meshes).
        this.revealHiddenMeshOccluders();

        this.candidateByKey = {};
        for (let i = 0; i < numSamples; ++i)
            this.collectCandidatesInFrontOf(silhouetteSamples[i], i);
        this.collectCandidatesInSightCone();

        for (const candidateKey in this.candidateByKey)
        {
            const candidate = this.candidateByKey[candidateKey];
            if (!candidate.inSightCone && candidate.numSamplesBlocked < minBlockedSamples)
                continue; // Barely in the way of anything: not worth emptying its place in the room.
            if (candidate.gameObject.config.attachment != undefined &&
                !this.restsOnHiddenBlock(candidate.gameObject))
            {
                continue; // Part of a face that is left standing.
            }

            if (candidate.mesh != undefined)
                this.hideOccluder(candidate.mesh, candidate.instanceId);
            this.hideRemainingPartsOf(candidate.gameObject);
        }
    }

    // No ray is cast through the cone, so what reaches into it is found by its collider.
    private collectCandidatesInSightCone(): void
    {
        const room = App.getCurrentRoom();
        if (room == undefined)
            return;

        for (const objectId in room.objectById)
        {
            const gameObject = ClientObjectManager.getObjectById(objectId);
            if (!objectIsOccluder(gameObject))
                continue;
            const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
                gameObject.params.objectTypeIndex, gameObject.params.transform);
            if (colliderState == undefined || !sightConeReaches(colliderState.hitbox) ||
                Geometry3DUtil.AABBsOverlap(protectedRegion, colliderState.hitbox))
            {
                continue;
            }

            const candidate = this.candidateByKey[objectId];
            if (candidate != undefined)
                candidate.inSightCone = true;
            else
            {
                this.candidateByKey[objectId] = {mesh: undefined, instanceId: -1, gameObject,
                    numSamplesBlocked: 0, lastSampleIndexBlocked: -1, inSightCone: true};
            }
        }
    }

    // Whether this sweep hid any block the object rests on. An attached object goes only along with one, or
    // samples a hair from its face (the floor at the foot of its wall) would take it off a wall left standing.
    private restsOnHiddenBlock(gameObject: GameObject): boolean
    {
        let found = false;
        ObjectAttachmentUtil.forEachSupportingBlock(gameObject.params.objectTypeIndex, gameObject.params.transform,
            (row, col, collisionLayer) => {
                found = this.blockIsHidden(row, col, collisionLayer);
                return !found;
            });
        return found;
    }

    // A layer past the layer range asks about the room's own floor or ceiling over the cell.
    private blockIsHidden(row: number, col: number, collisionLayer: number): boolean
    {
        if (collisionLayer < COLLISION_LAYER_MIN)
            return this.sweepTagByHiddenQuadIndex[VoxelQueryUtil.getFloorVoxelQuadIndex(row, col)] != undefined;
        if (collisionLayer > COLLISION_LAYER_MAX)
            return this.sweepTagByHiddenQuadIndex[VoxelQueryUtil.getCeilingVoxelQuadIndex(row, col)] != undefined;

        const firstQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
        if (firstQuadIndex < 0)
            return false;
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
        {
            if (this.sweepTagByHiddenQuadIndex[firstQuadIndex + i] != undefined)
                return true;
        }
        return false;
    }

    private collectCandidatesInFrontOf(sample: THREE.Vector3, sampleIndex: number): void
    {
        // Voxel quads are excluded; the grid sweep handled them (see CameraUtil).
        CameraUtil.castBetweenPoints(cameraPos, sample, intersectionsTemp);

        for (const intersection of intersectionsTemp)
        {
            const mesh = intersection.object as THREE.Mesh;
            const instanceId = (intersection.instanceId != undefined) ? intersection.instanceId : -1;
            const gameObject = CameraUtil.getObjectFromIntersection(intersection);

            if (!objectIsOccluder(gameObject) || objectIsProtected(gameObject))
                continue;

            this.creditBlockedSample(mesh, instanceId, gameObject, sampleIndex);
        }
    }

    // Per-object accounting, so multi-part objects are judged as a whole and a sample through two parts
    // counts once.
    private creditBlockedSample(mesh: THREE.Mesh, instanceId: number,
        gameObject: GameObject, sampleIndex: number): void
    {
        const candidateKey = gameObject.params.objectId;
        const candidate = this.candidateByKey[candidateKey];
        if (candidate == undefined)
        {
            this.candidateByKey[candidateKey] = {mesh, instanceId, gameObject,
                numSamplesBlocked: 1, lastSampleIndexBlocked: sampleIndex, inSightCone: false};
        }
        else if (candidate.lastSampleIndexBlocked !== sampleIndex)
        {
            candidate.lastSampleIndexBlocked = sampleIndex;
            ++candidate.numSamplesBlocked;
        }
    }

    private hideOccluder(mesh: THREE.Mesh, instanceId: number): void
    {
        const occluderKey = `${mesh.name}/${instanceId}`;
        if (this.hiddenOccluderByKey[occluderKey] != undefined)
            return; // Already hidden, by an earlier sample of this same sweep.

        const occluder: HiddenOccluder = {mesh, instanceId};
        setOccluderHidden(occluder, true);
        this.hiddenOccluderByKey[occluderKey] = occluder;
    }

    // Hides every part (and the label) of an object found in the way, not just the part a ray hit.
    private hideRemainingPartsOf(gameObject: GameObject): void
    {
        const hideInstance = (instancedMeshId: string, instanceId: number) => {
            const mesh = MeshFactory.getMesh(instancedMeshId);
            if (mesh)
                this.hideOccluder(mesh, instanceId);
        };

        // A mesh of the object's own, which is not instanced, goes by the object's id (see CameraUtil).
        const ownMesh = MeshFactory.getMesh(gameObject.params.objectId);
        if (ownMesh)
            this.hideOccluder(ownMesh, -1);

        const composer = gameObject.components.instancedMeshComposer as InstancedMeshComposer | undefined;
        composer?.forEachInstance(hideInstance);

        const labelText = gameObject.components.labelText as LabelText | undefined;
        labelText?.forEachInstance(hideInstance);

        gameObject.forEachOwnedInstance(hideInstance);
    }

    private revealHiddenMeshOccluders(): void
    {
        for (const occluderKey in this.hiddenOccluderByKey)
            setOccluderHidden(this.hiddenOccluderByKey[occluderKey], false);
        this.hiddenOccluderByKey = {};
    }
}

// The volume the sweep clears a path for, held a hair inside the target itself (see above).
function setTargetBox(target: AABB3): void
{
    targetBox.center.x = target.center.x;
    targetBox.center.y = target.center.y;
    targetBox.center.z = target.center.z;
    targetBox.halfSize.x = Math.max(0, target.halfSize.x - targetSweepInset);
    targetBox.halfSize.y = Math.max(0, target.halfSize.y - targetSweepInset);
    targetBox.halfSize.z = Math.max(0, target.halfSize.z - targetSweepInset);

    targetSpan = 2 * Math.hypot(targetBox.halfSize.x, targetBox.halfSize.y, targetBox.halfSize.z);
}

// The protected region. A voxel target (a face) protects its whole 3x3x3 neighbourhood, since its
// wall and anything hung on it are what the user is inspecting. Any other target (character, prop,
// step point) protects only its own volume: protecting its surroundings would protect every
// occluder once the camera gets close. Embedding is handled by sample exposure instead.
function setProtectedRegion(target: AABB3, voxels: Voxel[] | undefined): void
{
    const col = VoxelQueryUtil.getVoxelColFromWorldX(target.center.x);
    const row = VoxelQueryUtil.getVoxelRowFromWorldZ(target.center.z);
    const collisionLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(target.center.y);
    if (!pointIsInBlock(voxels, target.center.x, target.center.y, target.center.z))
    {
        protectedRegion = targetBox;
        return;
    }

    protectedNeighborhood.center.x = col + 0.5;
    protectedNeighborhood.center.y = VoxelQueryUtil.getWorldYAtVoxelCollisionLayerCenter(collisionLayer);
    protectedNeighborhood.center.z = row + 0.5;
    protectedRegion = protectedNeighborhood;
}

// Whether a point lies inside a block of the room. Outside the room counts as open.
function pointIsInBlock(voxels: Voxel[] | undefined, x: number, y: number, z: number): boolean
{
    const collisionLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(y);
    if (voxels == undefined ||
        collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        return false;

    const row = VoxelQueryUtil.getVoxelRowFromWorldZ(z);
    const col = VoxelQueryUtil.getVoxelColFromWorldX(x);
    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    return voxel != undefined && VoxelBlockShapeUtil.containsPoint(
        VoxelQueryUtil.getVoxelBlockShape(voxel, collisionLayer), x - col, z - row);
}

// Per-type OrbitOccluder declaration; object-less geometry is never hidden.
function objectIsOccluder(gameObject: GameObject | undefined): gameObject is GameObject
{
    return gameObject != undefined && gameObject.components.orbitOccluder != undefined;
}

// Voxel columns are asked per column (one owning object per column).
function voxelIsOccluder(voxel: Voxel): boolean
{
    return objectIsOccluder(ClientObjectManager.getObjectById(voxel.gameObjectId));
}

// Whether the object's volume reaches into the protected region.
function objectIsProtected(gameObject: GameObject | undefined): boolean
{
    if (gameObject == undefined)
        return false;

    const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
        gameObject.params.objectTypeIndex, gameObject.params.transform);
    if (colliderState == undefined) // Nothing solid to speak of, so nothing to protect.
        return false;
    return Geometry3DUtil.AABBsOverlap(protectedRegion, colliderState.hitbox);
}

// Fills quadIndicesTemp with quads worth hiding (quad index = voxel mesh instance id).
function collectQuadIndicesInTheWay(voxels: Voxel[]): void
{
    quadIndicesTemp.length = 0;

    // Only the columns the swept target passes over, or the cone of sight reaches, can hold anything in the way.
    const reachX = Math.max(targetBox.halfSize.x, sightConeReachX);
    const reachZ = Math.max(targetBox.halfSize.z, sightConeReachZ);
    const minCol = Math.floor(Math.min(targetBox.center.x - targetBox.halfSize.x, cameraPos.x - reachX));
    const maxCol = Math.floor(Math.max(targetBox.center.x + targetBox.halfSize.x, cameraPos.x + reachX));
    const minRow = Math.floor(Math.min(targetBox.center.z - targetBox.halfSize.z, cameraPos.z - reachZ));
    const maxRow = Math.floor(Math.max(targetBox.center.z + targetBox.halfSize.z, cameraPos.z + reachZ));

    for (let row = Math.max(0, minRow); row <= Math.min(NUM_VOXEL_ROWS - 1, maxRow); ++row)
    {
        for (let col = Math.max(0, minCol); col <= Math.min(NUM_VOXEL_COLS - 1, maxCol); ++col)
        {
            const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
            if (voxel != undefined && voxelIsOccluder(voxel))
                collectQuadIndicesInTheWayOfVoxel(voxel, row, col);
        }
    }
}

function collectQuadIndicesInTheWayOfVoxel(voxel: Voxel, row: number, col: number): void
{
    const coneSparesBlocks = (row == sightConeSparedRow && col == sightConeSparedCol);

    // A blocking block hides all its faces, for a clean opening.
    for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
    {
        const shape = VoxelQueryUtil.getVoxelBlockShape(voxel, collisionLayer);
        if (shape == VOXEL_BLOCK_SHAPE_EMPTY)
            continue;

        const blockBox = VoxelQueryUtil.getVoxelBlockBox(row, col, collisionLayer, shape);
        // Part of what the orbit is looking at, rather than something in its way.
        if (Geometry3DUtil.AABBsOverlap(protectedRegion, blockBox))
            continue;
        const inSightCone = !coneSparesBlocks && sightConeReaches(blockBox);
        if (!inSightCone && !boxIsInTheWay(blockBox))
            continue;

        const firstQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            collectQuadIndexIfDrawn(firstQuadIndex + i);
    }

    // The room's floor and ceiling, which the orbit reaches under and over respectively.
    tileBoxTemp.center.x = col + 0.5;
    tileBoxTemp.center.z = row + 0.5;

    tileBoxTemp.center.y = 0;
    if ((sightConeTakesFloor && wholeSightConeReaches(tileBoxTemp)) || boxIsInTheWay(tileBoxTemp))
        collectQuadIndexIfDrawn(VoxelQueryUtil.getFloorVoxelQuadIndex(row, col));

    tileBoxTemp.center.y = MAX_ROOM_Y;
    if ((sightConeTakesCeiling && wholeSightConeReaches(tileBoxTemp)) || boxIsInTheWay(tileBoxTemp))
        collectQuadIndexIfDrawn(VoxelQueryUtil.getCeilingVoxelQuadIndex(row, col));
}

// Only drawn faces have anything to hide.
function collectQuadIndexIfDrawn(quadIndex: number): void
{
    if (VoxelQuadInstanceUtil.getInstanceId(quadIndex) >= 0)
        quadIndicesTemp.push(quadIndex);
}

// A box sweep toward the camera cheaply rejects most blocks; survivors are tested against samples,
// since the sweep keeps the target's full width all the way to the camera and over-condemns.
function boxIsInTheWay(box: AABB3): boolean
{
    if (!targetSweepReaches(box))
        return false;

    let numSamplesBlocked = 0;
    for (let i = 0; i < numSamples; ++i)
    {
        if (traceToCameraHits(silhouetteSamples[i], box))
        {
            if (++numSamplesBlocked >= minBlockedSamples)
                return true;
        }
        else if (numSamplesBlocked + numSamples - i - 1 < minBlockedSamples)
            return false; // Too few samples left over for this one to make up the difference.
    }
    return false;
}

// Whether the target, swept toward the camera, runs into a box. Never one it lies against from the start,
// as a flat target (the room's floor or ceiling) does a block standing on it.
function targetSweepReaches(box: AABB3): boolean
{
    return Geometry3DUtil.castAABBAgainstAABB(targetBox, cameraPos, box).hitNormal != undefined;
}

// Traced from the sample outward, so the target's own surface and flush neighbours count as touched,
// not hit.
function traceToCameraHits(sample: THREE.Vector3, box: AABB3): boolean
{
    pointTemp.center.x = sample.x;
    pointTemp.center.y = sample.y;
    pointTemp.center.z = sample.z;
    return Geometry3DUtil.castAABBAgainstAABB(pointTemp, cameraPos, box).hitNormal != undefined;
}

// The cone of sight: its tip at the orbit's pivot and its base at the camera, widening on the way by
// ORBIT_SIGHT_CONE_RADIUS_PER_DISTANCE. What reaches into it is in the way, however little of the target it covers.
// - The plane of the target's face it leaves through (the first one holding a sample) bounds it. Nothing behind
//   the face being looked at stands in front of it: what lies there is that face's own wall or floor, running on
//   toward the camera with the pivot inside it.
// - It takes the room's own floor or ceiling only from beyond it, where that lies between the camera and the room
//   (from inside, a tile has nothing behind it to uncover), and never one the target itself lies in.
// - Where the target is such a tile, the blocks of its own cell are left to the samples: the tip lies at their
//   foot, so the cone would take them from any view along them.
function setSightCone(target: AABB3): void
{
    OrbitCameraPose.getPivot(target, sightConeTip);

    // The base is a disc facing down the cone's axis, so it reaches least along an axis the cone runs along.
    const axisVec = sightConeAxisTemp.subVectors(cameraPos, sightConeTip);
    sightConeReachX = ORBIT_SIGHT_CONE_RADIUS_PER_DISTANCE * Math.hypot(axisVec.y, axisVec.z);
    sightConeReachZ = ORBIT_SIGHT_CONE_RADIUS_PER_DISTANCE * Math.hypot(axisVec.x, axisVec.y);

    sightConeBoundAxis = undefined;
    let nearestCrossing = Infinity;
    for (let code = 0; code < faceIsSampled.length; ++code)
    {
        if (!faceIsSampled[code])
            continue;
        const normal = DIR_VEC_BY_CODE[code];
        const axis = (normal.x != 0) ? "x" : (normal.y != 0) ? "y" : "z";
        // A face of no size (a point's) has nothing behind it.
        if ((axis != "x" && target.halfSize.x == 0) || (axis != "y" && target.halfSize.y == 0) ||
            (axis != "z" && target.halfSize.z == 0))
        {
            continue;
        }

        // The target's own face rather than the inset one the samples lie on, which the blocks level with
        // the face would stand out in front of.
        const coord = target.center[axis] + normal[axis] * target.halfSize[axis];
        // How far along the way from the tip to the camera the face's plane is crossed.
        const crossing = (coord - sightConeTip[axis]) / axisVec[axis];
        if (crossing < nearestCrossing)
        {
            nearestCrossing = crossing;
            sightConeBoundAxis = axis;
            sightConeBoundCoord = coord;
            sightConeBoundSign = normal[axis];
        }
    }

    const targetIsTile = (sightConeBoundAxis == "y" && target.halfSize.y == 0);
    sightConeTakesFloor = cameraPos.y < 0 && !(targetIsTile && target.center.y == 0);
    sightConeTakesCeiling = cameraPos.y > MAX_ROOM_Y && !(targetIsTile && target.center.y == MAX_ROOM_Y);
    sightConeSparedRow = targetIsTile ? VoxelQueryUtil.getVoxelRowFromWorldZ(target.center.z) : -1;
    sightConeSparedCol = targetIsTile ? VoxelQueryUtil.getVoxelColFromWorldX(target.center.x) : -1;
}

// Whether a box reaches into the cone of sight: the part of it in front of the plane that bounds the cone.
function sightConeReaches(box: AABB3): boolean
{
    const axis = sightConeBoundAxis;
    if (axis == undefined)
        return wholeSightConeReaches(box);

    // How far the box comes out in front of the plane, and how thick the part of it there is.
    const front = sightConeBoundSign * (box.center[axis] - sightConeBoundCoord) + box.halfSize[axis];
    if (front <= 0)
        return false;
    const depth = Math.min(front, 2 * box.halfSize[axis]);

    boxInFrontTemp.center.x = box.center.x;
    boxInFrontTemp.center.y = box.center.y;
    boxInFrontTemp.center.z = box.center.z;
    boxInFrontTemp.halfSize.x = box.halfSize.x;
    boxInFrontTemp.halfSize.y = box.halfSize.y;
    boxInFrontTemp.halfSize.z = box.halfSize.z;
    boxInFrontTemp.center[axis] = sightConeBoundCoord + sightConeBoundSign * (front - 0.5 * depth);
    boxInFrontTemp.halfSize[axis] = 0.5 * depth;
    return wholeSightConeReaches(boxInFrontTemp);
}

// Whether a box reaches into the cone of sight, whatever bounds it.
function wholeSightConeReaches(box: AABB3): boolean
{
    return Geometry3DUtil.coneReachesAABB(sightConeTip, cameraPos, ORBIT_SIGHT_CONE_RADIUS_PER_DISTANCE, box);
}

// Aims a grid over the target's silhouette and moves each aim onto the target's surface along the
// camera ray. Aims that miss, or land on faces walled off by protected geometry, are dropped (a line
// from a buried face would carry off the wall). Returns false if nothing is left (including when the
// camera is inside the target).
function buildSilhouetteSamples(voxels: Voxel[] | undefined): boolean
{
    numSamples = 0;
    faceIsSampled.fill(false);

    forwardTemp.subVectors(targetCenterPos, cameraPos);
    if (forwardTemp.lengthSq() < NEAR_EPSILON)
        return false;
    forwardTemp.normalize();

    rightTemp.crossVectors(forwardTemp, DIRECTION_VECTORS["+y"]);
    if (rightTemp.lengthSq() < NEAR_EPSILON) // Looking straight down the vertical axis.
        rightTemp.copy(DIRECTION_VECTORS["+x"]);
    rightTemp.normalize();
    upTemp.crossVectors(rightTemp, forwardTemp);

    const rightRadius = silhouetteRadius(rightTemp);
    const upRadius = silhouetteRadius(upTemp);
    for (let column = 0; column < numSilhouetteColumns; ++column)
    {
        const u = silhouetteOffset(column, numSilhouetteColumns, rightRadius);
        for (let row = 0; row < numSilhouetteRows; ++row)
        {
            const v = silhouetteOffset(row, numSilhouetteRows, upRadius);
            const sample = silhouetteSamples[numSamples];
            sample.copy(targetCenterPos).addScaledVector(rightTemp, u).addScaledVector(upTemp, v);

            if (placeSampleOnTarget(sample, voxels))
                ++numSamples;
        }
    }

    minBlockedSamples = Math.max(1, Math.ceil(numSamples * minBlockedSampleRatio));
    return numSamples > 0;
}

// Moves an aim onto the target surface. Aims lie on a plane through the target centre, part of which
// is in front of the surface (e.g. a tilted silhouette), so the ray is extended by the target span
// before looking for the entry point. Returns whether the sample counts.
function placeSampleOnTarget(sample: THREE.Vector3, voxels: Voxel[] | undefined): boolean
{
    pointTemp.center.x = cameraPos.x;
    pointTemp.center.y = cameraPos.y;
    pointTemp.center.z = cameraPos.z;

    sampleRayTemp.subVectors(sample, cameraPos);
    const distToAim = sampleRayTemp.length();
    if (distToAim < NEAR_EPSILON) // The camera sits on the aim: no direction to look along.
        return false;
    sampleRayTemp.multiplyScalar(1 + targetSpan / distToAim);
    sampleDestTemp.addVectors(cameraPos, sampleRayTemp);

    const hit = Geometry3DUtil.castAABBAgainstAABB(pointTemp, sampleDestTemp, targetBox);
    if (hit.hitNormal == undefined)
        return false; // The aim went wide of the target, so it speaks for no part of it.

    sample.copy(cameraPos).addScaledVector(sampleRayTemp, hit.hitRayScale);
    if (!faceIsExposed(sample, hit.hitNormal, voxels))
        return false;
    faceIsSampled[DirUtil.dirVecToCode(hit.hitNormal)] = true;
    return true;
}

// Whether a sample's face could ever be visible. Checked just outside the face. Buried means covered
// by geometry that stays (protected blocks, a picture's host wall, a block the sweep never reaches); a
// character's back against an unprotected wall still counts, since clearing that wall is the point.
function faceIsExposed(sample: THREE.Vector3, faceNormal: Vec3, voxels: Voxel[] | undefined): boolean
{
    const x = sample.x + faceNormal.x * exposureProbeDist;
    const y = sample.y + faceNormal.y * exposureProbeDist;
    const z = sample.z + faceNormal.z * exposureProbeDist;
    if (voxels == undefined || !pointIsInBlock(voxels, x, y, z))
        return true;

    const row = VoxelQueryUtil.getVoxelRowFromWorldZ(z);
    const col = VoxelQueryUtil.getVoxelColFromWorldX(x);
    const collisionLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(y);
    const blockBox = VoxelQueryUtil.getVoxelBlockBox(row, col, collisionLayer,
        VoxelQueryUtil.getVoxelBlockShapeAt(voxels, row, col, collisionLayer));
    return !Geometry3DUtil.AABBsOverlap(protectedRegion, blockBox) && targetSweepReaches(blockBox);
}

// Half-width of the target along a camera axis (world-axis half-sizes would over-aim at edge-on
// targets).
function silhouetteRadius(axis: THREE.Vector3): number
{
    return Math.abs(axis.x) * targetBox.halfSize.x +
        Math.abs(axis.y) * targetBox.halfSize.y +
        Math.abs(axis.z) * targetBox.halfSize.z;
}

// Aims at cell centres so each sample represents an equal share and stays off the rim.
function silhouetteOffset(sampleIndex: number, numSamples: number, radius: number): number
{
    return radius * (2 * (sampleIndex + 0.5) / numSamples - 1);
}

// Quads not on show have no instance to hide (see VoxelQuadInstanceUtil).
function setVoxelQuadHidden(quadIndex: number, hidden: boolean): void
{
    const instanceId = VoxelQuadInstanceUtil.getInstanceId(quadIndex);
    if (instanceId < 0)
        return;
    InstancedMeshGraphics.setInstanceHidden(
        ClientVoxelQueryUtil.getVoxelInstancedMeshId(), instanceId, hidden);
}

function setOccluderHidden(occluder: HiddenOccluder, hidden: boolean): void
{
    if (occluder.instanceId < 0)
        occluder.mesh.visible = !hidden;
    else // Hiding the mesh itself would take every other instance drawn from it down as well.
        InstancedMeshGraphics.setInstanceHidden(occluder.mesh.name, occluder.instanceId, hidden);
}
