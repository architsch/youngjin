import * as THREE from "three";
import App from "../../../../app";
import GameObject from "../../../types/gameObject";
import ClientObjectManager from "../../../clientObjectManager";
import MeshFactory from "../../../../graphics/factories/meshFactory";
import InstancedMeshBinding from "../../../../graphics/types/mesh/instancedMeshBinding";
import HiddenOccluder from "../../../../graphics/types/mesh/hiddenOccluder";
import InstancedMeshComposer from "../../instancedMeshComposer";
import InstancedMeshGraphics from "../../instancedMeshGraphics";
import AABB3 from "../../../../../shared/math/types/aabb3";
import Geometry3DUtil from "../../../../../shared/math/util/geometry3DUtil";
import Voxel from "../../../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../../../shared/voxel/util/voxelQueryUtil";
import MeshDataUtil from "../../../../../shared/graphics/mesh/util/meshDataUtil";
import PhysicsColliderStateUtil from "../../../../../shared/physics/util/physicsColliderStateUtil";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, MAX_ROOM_Y, NEAR_EPSILON,
    NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS,
    VOXEL_BLOCK_HITBOX_HALFSIZE, VOXEL_QUAD_GEOMETRY_ID,
    VOXEL_TEXTURE_PACK_MATERIAL_ID } from "../../../../../shared/system/sharedConstants";

//------------------------------------------------------------------------
// Keeps the orbit camera's view of what it frames clear: whatever stands between the camera and the
// target volume (a wall the target sits behind, the ceiling the orbit rises above, a canvas,
// another player) is hidden for as long as it stands there, and shown again once it no longer does.
//
// What has to be cleared is the whole target, not a line to its middle, so every sweep works against
// the target's box. The room's own geometry and everything else in it are looked up in different
// ways, because their costs are nothing alike:
//
//   - The room's voxel quads are found by sweeping the target's box toward the camera through the
//     voxel grid. A room holds tens of thousands of quads — far too many to raycast repeatedly —
//     and the grid answers the question directly, covering the target completely by construction.
//   - Everything else (canvases, doors, players) is found by raycasting the remaining meshes,
//     which are few, along a grid of samples spread over the target's silhouette. Whatever a ray
//     strikes is hidden as a whole object rather than at the point of the hit, since an object drawn
//     out of many parts (a player) would otherwise be left standing there in pieces.
//
// Whatever the orbit is looking *at* is exempt from all of this, since hiding it is precisely what
// would defeat the mode (see the protected neighbourhood below).
//
// A sweep is paced rather than run every frame: promptly after the camera has moved, and slowly
// while it rests, which is when only a moving occluder could change the answer.
//------------------------------------------------------------------------

const minSweepInterval = 0.15; // seconds between sweeps while the camera keeps moving
const maxSweepInterval = 0.5; // seconds between sweeps while the camera rests
const cameraRestDistSqr = 0.0001; // camera movement below this counts as resting

// How densely the target's silhouette is sampled by rays. Spacing must stay well under the size of
// the objects being looked for, or one could sit in a gap between samples and stay in the way.
const numSilhouetteColumns = 3;
const numSilhouetteRows = 5;

const voxelInstancedMeshId = MeshDataUtil.getInstancedMeshId(
    VOXEL_QUAD_GEOMETRY_ID, VOXEL_TEXTURE_PACK_MATERIAL_ID);

const blockHeight = 2 * VOXEL_BLOCK_HITBOX_HALFSIZE.y;

const cameraPos = new THREE.Vector3();
const targetCenterPos = new THREE.Vector3();
const forwardTemp = new THREE.Vector3();
const rightTemp = new THREE.Vector3();
const upTemp = new THREE.Vector3();
const sampleTargetTemp = new THREE.Vector3();
const rayDirTemp = new THREE.Vector3();

// The volume that has to end up in full view — held a hair smaller than the target itself. The
// sweep below reports what the target would run *into* on its way to the camera, so a surface the
// target already rests flush against (the floor under a player's feet, the wall a block belongs to)
// has to start a hair away from it to count as something run into rather than something already
// touched. The same step-back keeps the physics engine's own casts out of the walls they start on.
const targetSweepInset = 0.001;
const targetBox: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: {x: 0, y: 0, z: 0}};

// The block the target's center falls in, and the box holding that block along with all of its
// neighbours (see setProtectedNeighborhood).
let protectedCenterRow = 0;
let protectedCenterCol = 0;
let protectedCenterLayer = 0;
const protectedRegion: AABB3 = {
    center: {x: 0, y: 0, z: 0},
    halfSize: {x: 1.5, y: 1.5 * blockHeight, z: 1.5},
};

const blockBoxTemp: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: VOXEL_BLOCK_HITBOX_HALFSIZE};
// The room's floor and ceiling are flat tiles, carrying no thickness of their own.
const tileBoxTemp: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: {x: 0.5, y: 0, z: 0.5}};

const quadIndicesTemp: number[] = [];
const meshesTemp: THREE.Mesh[] = [];
const intersectionsTemp: THREE.Intersection[] = [];

export default class OrbitOcclusionHider
{
    private raycaster = new THREE.Raycaster();
    private lastSweepCameraPos = new THREE.Vector3();
    private timeSinceLastSweep = 0;

    // The voxel quads hidden right now, each tagged with the sweep that last found it in the way,
    // so that a sweep can tell which of them have since been stepped out of.
    private sweepTagByHiddenQuadIndex: {[quadIndex: number]: number} = {};
    private sweepCount = 0;

    // Everything hidden that is not a voxel quad, keyed by `${meshId}/${instanceId}`.
    private hiddenOccluderByKey: {[occluderKey: string]: HiddenOccluder} = {};

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
            InstancedMeshGraphics.setInstanceHidden(voxelInstancedMeshId, Number(quadIndex), false);
        this.sweepTagByHiddenQuadIndex = {};
        this.revealHiddenMeshOccluders();
    }

    private sweep(target: AABB3): void
    {
        targetCenterPos.set(target.center.x, target.center.y, target.center.z);
        setTargetBox(target);
        setProtectedNeighborhood(target);

        const room = App.getCurrentRoom();
        if (room)
            this.hideVoxelQuadsInTheWay(room.voxelGrid.voxels);
        this.hideMeshesInTheWay();
    }

    //--------------------------------------------------------------------
    // The room's own geometry
    //--------------------------------------------------------------------

    private hideVoxelQuadsInTheWay(voxels: Voxel[]): void
    {
        collectQuadIndicesInTheWay(voxels);

        // The grid answers on its own, without regard for what is hidden at the moment, so the
        // previous sweep's quads are released by comparison instead of by showing them all first.
        // That matters here: the voxel mesh carries a whole room's instances, and putting every
        // hidden quad back only to hide it again would rewrite that entire buffer every sweep.
        ++this.sweepCount;
        for (let i = 0; i < quadIndicesTemp.length; ++i)
        {
            const quadIndex = quadIndicesTemp[i];
            if (this.sweepTagByHiddenQuadIndex[quadIndex] == undefined)
                InstancedMeshGraphics.setInstanceHidden(voxelInstancedMeshId, quadIndex, true);
            this.sweepTagByHiddenQuadIndex[quadIndex] = this.sweepCount;
        }
        for (const quadIndex in this.sweepTagByHiddenQuadIndex)
        {
            if (this.sweepTagByHiddenQuadIndex[quadIndex] !== this.sweepCount)
            {
                InstancedMeshGraphics.setInstanceHidden(voxelInstancedMeshId, Number(quadIndex), false);
                delete this.sweepTagByHiddenQuadIndex[quadIndex];
            }
        }
    }

    //--------------------------------------------------------------------
    // Everything else in the room
    //--------------------------------------------------------------------

    private hideMeshesInTheWay(): void
    {
        // Rays cannot find what is already hidden, since a hidden instance is parked outside the
        // room, so this shows what it hid last time before looking again. Nothing is rendered in
        // between, and these occluders sit on small meshes — unlike the room's voxel quads, whose
        // buffer is left alone above.
        this.revealHiddenMeshOccluders();

        if (!buildSilhouetteAxes())
            return;
        collectMeshesToRaycast();

        for (let column = 0; column < numSilhouetteColumns; ++column)
        {
            const u = silhouetteOffset(column, numSilhouetteColumns, targetBox.halfSize.x);
            for (let row = 0; row < numSilhouetteRows; ++row)
            {
                const v = silhouetteOffset(row, numSilhouetteRows, targetBox.halfSize.y);
                sampleTargetTemp.copy(targetCenterPos)
                    .addScaledVector(rightTemp, u)
                    .addScaledVector(upTemp, v);
                this.hideMeshesHitOnTheWayTo(sampleTargetTemp);
            }
        }
    }

    private hideMeshesHitOnTheWayTo(sampleTarget: THREE.Vector3): void
    {
        rayDirTemp.subVectors(sampleTarget, cameraPos);
        const distToSample = rayDirTemp.length();
        if (distToSample < NEAR_EPSILON) // The camera sits on the target: nothing fits in between.
            return;
        rayDirTemp.divideScalar(distToSample);

        this.raycaster.set(cameraPos, rayDirTemp);
        this.raycaster.far = distToSample; // Only what stands in front of the target can block it.
        intersectionsTemp.length = 0;
        this.raycaster.intersectObjects(meshesTemp, true, intersectionsTemp);

        for (const intersection of intersectionsTemp)
        {
            const mesh = intersection.object as THREE.Mesh;
            const instanceId = (intersection.instanceId != undefined) ? intersection.instanceId : -1;
            const gameObject = findGameObject(mesh, instanceId);

            // What the camera is looking at is never something in its way. This is what keeps the
            // user's own body in view while the orbit frames the character himself; every other
            // orbit has it out of sight before any ray goes looking for it (see PlayerGameObject).
            if (objectIsProtected(gameObject))
                continue;

            this.hideOccluder(mesh, instanceId);
            if (gameObject)
                this.hideRemainingPartsOf(gameObject);
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

    // A ray reports the one piece of geometry it struck, but a player is not one piece: each of the
    // parts he is composed of is an instance of its own, and hiding only the part a sample happened
    // to land on would leave the rest of the body — a head with no torso under it — standing in
    // front of what the camera is meant to see. So an object found in the way goes out of sight
    // whole. (Objects drawn as a single piece have nothing further to hide, and say so by carrying
    // no composer.)
    private hideRemainingPartsOf(gameObject: GameObject): void
    {
        const composer = gameObject.components.instancedMeshComposer as InstancedMeshComposer | undefined;
        if (composer == undefined)
            return;

        composer.forEachInstance((instancedMeshId: string, instanceId: number) => {
            const mesh = MeshFactory.getMesh(instancedMeshId);
            if (mesh)
                this.hideOccluder(mesh, instanceId);
        });
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
}

// The neighbourhood that is exempt from being hidden: the block the target's center falls in, plus
// every block touching it (diagonals, and the layers above and below, included). What the orbit
// frames sits in that block, and it is rarely alone there — a selected face belongs to a wall, and
// a picture hangs on one — so hiding the block, its immediate surroundings, or anything resting
// against them would take away the very thing the user asked to look at. A center falling exactly
// on the boundary between two blocks needs no special care: whichever side it is counted on, the
// block on the other side is a neighbour anyway.
function setProtectedNeighborhood(target: AABB3): void
{
    protectedCenterCol = Math.floor(target.center.x);
    protectedCenterRow = Math.floor(target.center.z);
    protectedCenterLayer = Math.floor(target.center.y / blockHeight);

    protectedRegion.center.x = protectedCenterCol + 0.5;
    protectedRegion.center.y = (protectedCenterLayer + 0.5) * blockHeight;
    protectedRegion.center.z = protectedCenterRow + 0.5;
}

function blockIsProtected(row: number, col: number, collisionLayer: number): boolean
{
    return Math.abs(row - protectedCenterRow) <= 1 &&
        Math.abs(col - protectedCenterCol) <= 1 &&
        Math.abs(collisionLayer - protectedCenterLayer) <= 1;
}

// The game object a ray hit belongs to, if it belongs to one at all (a gizmo does not).
function findGameObject(mesh: THREE.Mesh, instanceId: number): GameObject | undefined
{
    return (instanceId >= 0)
        ? InstancedMeshBinding.findGameObject(mesh, instanceId)
        // For regular (non-instanced) meshes, (mesh.name == meshId == objectId).
        : ClientObjectManager.getObjectById(mesh.name);
}

// Whether the game object a ray hit is one of those the orbit is looking at, i.e. one whose own
// volume reaches into the protected neighbourhood of blocks.
function objectIsProtected(gameObject: GameObject | undefined): boolean
{
    if (gameObject == undefined)
        return false;

    const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
        gameObject.params.objectTypeIndex, gameObject.position, gameObject.direction);
    if (colliderState == undefined) // Nothing solid to speak of, so nothing to protect.
        return false;
    return Geometry3DUtil.AABBsOverlap(protectedRegion, colliderState.hitbox);
}

// Fills "quadIndicesTemp" with every voxel quad that the target would run into on its way to the
// camera (a quad's index is also its instance id in the voxel mesh).
function collectQuadIndicesInTheWay(voxels: Voxel[]): void
{
    quadIndicesTemp.length = 0;

    // Only the columns the swept target passes over can hold anything in the way.
    const minCol = Math.floor(Math.min(targetBox.center.x, cameraPos.x) - targetBox.halfSize.x);
    const maxCol = Math.floor(Math.max(targetBox.center.x, cameraPos.x) + targetBox.halfSize.x);
    const minRow = Math.floor(Math.min(targetBox.center.z, cameraPos.z) - targetBox.halfSize.z);
    const maxRow = Math.floor(Math.max(targetBox.center.z, cameraPos.z) + targetBox.halfSize.z);

    for (let row = Math.max(0, minRow); row <= Math.min(NUM_VOXEL_ROWS - 1, maxRow); ++row)
    {
        for (let col = Math.max(0, minCol); col <= Math.min(NUM_VOXEL_COLS - 1, maxCol); ++col)
        {
            const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
            if (voxel != undefined)
                collectQuadIndicesInTheWayOfVoxel(voxel, row, col);
        }
    }
}

function collectQuadIndicesInTheWayOfVoxel(voxel: Voxel, row: number, col: number): void
{
    // Solid blocks. A block in the way takes all of its faces with it, so the target ends up seen
    // through a clean opening rather than through a single missing face.
    for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
    {
        if (!VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
            continue;
        if (blockIsProtected(row, col, collisionLayer))
            continue;

        blockBoxTemp.center.x = col + 0.5;
        blockBoxTemp.center.y = VOXEL_BLOCK_HITBOX_HALFSIZE.y * (2 * collisionLayer + 1);
        blockBoxTemp.center.z = row + 0.5;
        if (!boxIsInTheWay(blockBoxTemp))
            continue;

        const firstQuadIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, collisionLayer);
        for (let i = 0; i < NUM_VOXEL_QUADS_PER_COLLISION_LAYER; ++i)
            quadIndicesTemp.push(firstQuadIndex + i);
    }

    // The room's floor and ceiling, which the orbit reaches under and over respectively.
    tileBoxTemp.center.x = col + 0.5;
    tileBoxTemp.center.z = row + 0.5;

    tileBoxTemp.center.y = 0;
    if (boxIsInTheWay(tileBoxTemp))
        quadIndicesTemp.push(VoxelQueryUtil.getVoxelQuadIndex(row, col, "y", "+", COLLISION_LAYER_NULL));

    tileBoxTemp.center.y = MAX_ROOM_Y;
    if (boxIsInTheWay(tileBoxTemp))
        quadIndicesTemp.push(VoxelQueryUtil.getVoxelQuadIndex(row, col, "y", "-", COLLISION_LAYER_NULL));
}

// Sweeps the target's box toward the camera: whatever that sweep runs into is between the two, and
// so covers part of the target. Sweeping the whole box (rather than tracing a line to its middle)
// is what makes the target come out fully exposed instead of merely peeking through a gap.
function boxIsInTheWay(box: AABB3): boolean
{
    return Geometry3DUtil.castAABBAgainstAABB(targetBox, cameraPos, box).hitNormal != undefined;
}

// Builds the axes of the target's silhouette as the camera sees it. Returns false if the camera has
// nothing to look at because it sits on the target itself.
function buildSilhouetteAxes(): boolean
{
    forwardTemp.subVectors(targetCenterPos, cameraPos);
    if (forwardTemp.lengthSq() < NEAR_EPSILON)
        return false;
    forwardTemp.normalize();

    rightTemp.crossVectors(forwardTemp, DIRECTION_VECTORS["+y"]);
    if (rightTemp.lengthSq() < NEAR_EPSILON) // Looking straight down the vertical axis.
        rightTemp.copy(DIRECTION_VECTORS["+x"]);
    rightTemp.normalize();
    upTemp.crossVectors(rightTemp, forwardTemp);
    return true;
}

// Spreads samples evenly across the silhouette, from one edge to the other.
function silhouetteOffset(sampleIndex: number, numSamples: number, halfSize: number): number
{
    if (numSamples < 2)
        return 0;
    return halfSize * (2 * sampleIndex / (numSamples - 1) - 1);
}

// Every mesh except the room's voxel quads, which are handled by the grid sweep instead.
function collectMeshesToRaycast(): void
{
    meshesTemp.length = 0;
    const meshes = MeshFactory.getMeshes();
    for (let i = 0; i < meshes.length; ++i)
    {
        if (meshes[i].name !== voxelInstancedMeshId)
            meshesTemp.push(meshes[i]);
    }
}

function setOccluderHidden(occluder: HiddenOccluder, hidden: boolean): void
{
    if (occluder.instanceId < 0)
        occluder.mesh.visible = !hidden;
    else // Hiding the mesh itself would take every other instance drawn from it down as well.
        InstancedMeshGraphics.setInstanceHidden(occluder.mesh.name, occluder.instanceId, hidden);
}
