import * as THREE from "three";
import App from "../../../../app";
import GameObject from "../../../types/gameObject";
import MeshFactory from "../../../../graphics/factories/meshFactory";
import InstancedMeshBinding from "../../../../graphics/types/mesh/instancedMeshBinding";
import HiddenOccluder from "../../../../graphics/types/mesh/hiddenOccluder";
import InstancedMeshGraphics from "../../instancedMeshGraphics";
import SelfViewCameraPose from "./selfViewCameraPose";
import AABB3 from "../../../../../shared/math/types/aabb3";
import Geometry3DUtil from "../../../../../shared/math/util/geometry3DUtil";
import Voxel from "../../../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../../../shared/voxel/util/voxelQueryUtil";
import MeshDataUtil from "../../../../../shared/graphics/mesh/util/meshDataUtil";
import { DIRECTION_VECTORS } from "../../../../system/clientConstants";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, MAX_ROOM_Y, NEAR_EPSILON,
    NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS, PLAYER_HEIGHT,
    PLAYER_RADIUS_XZ, VOXEL_BLOCK_HITBOX_HALFSIZE, VOXEL_QUAD_GEOMETRY_ID,
    VOXEL_TEXTURE_PACK_MATERIAL_ID } from "../../../../../shared/system/sharedConstants";

//------------------------------------------------------------------------
// Keeps the self-view camera's view of the player's own body clear: whatever stands between the
// camera and the body (a wall the player leans against, the ceiling the orbit rises above, a
// canvas, another player) is hidden for as long as it stands there, and shown again once it
// no longer does.
//
// What has to be cleared is the whole body, not a line to its middle, so every sweep works against
// the body's box rather than a single point. The room's own geometry and everything else in it are
// looked up in different ways, because their costs are nothing alike:
//
//   - The room's voxel quads are found by sweeping the body's box toward the camera through the
//     voxel grid. A room holds tens of thousands of quads — far too many to raycast repeatedly —
//     and the grid answers the question directly, covering the body completely by construction.
//   - Everything else (canvases, doors, other players) is found by raycasting the remaining meshes,
//     which are few, along a grid of samples spread over the body's silhouette.
//
// A sweep is paced rather than run every frame: promptly after the camera has moved, and slowly
// while it rests, which is when only a moving occluder could change the answer.
//------------------------------------------------------------------------

const minSweepInterval = 0.15; // seconds between sweeps while the camera keeps moving
const maxSweepInterval = 0.5; // seconds between sweeps while the camera rests
const cameraRestDistSqr = 0.0001; // camera movement below this counts as resting

// How densely the body's silhouette is sampled by rays. Spacing must stay well under the size of
// the objects being looked for, or one could sit in a gap between samples and stay in the way.
const numSilhouetteColumns = 3;
const numSilhouetteRows = 5;

const voxelInstancedMeshId = MeshDataUtil.getInstancedMeshId(
    VOXEL_QUAD_GEOMETRY_ID, VOXEL_TEXTURE_PACK_MATERIAL_ID);

const cameraPos = new THREE.Vector3();
const bodyCenterPos = new THREE.Vector3();
const forwardTemp = new THREE.Vector3();
const rightTemp = new THREE.Vector3();
const upTemp = new THREE.Vector3();
const sampleTargetTemp = new THREE.Vector3();
const rayDirTemp = new THREE.Vector3();

// The body, as the volume that has to end up in full view — held a hair smaller than the body
// itself. The sweep below reports what the body would run *into* on its way to the camera, so a
// surface the body already rests flush against (the floor under its feet, the wall it leans on)
// has to start a hair away from it to count as something run into rather than something already
// touched. The same step-back keeps the physics engine's own casts out of the walls they start on.
const bodySweepInset = 0.001;
const bodyBox: AABB3 = {
    center: {x: 0, y: 0, z: 0},
    halfSize: {
        x: PLAYER_RADIUS_XZ - bodySweepInset,
        y: 0.5 * PLAYER_HEIGHT - bodySweepInset,
        z: PLAYER_RADIUS_XZ - bodySweepInset,
    },
};
const blockBoxTemp: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: VOXEL_BLOCK_HITBOX_HALFSIZE};
// The room's floor and ceiling are flat tiles, carrying no thickness of their own.
const tileBoxTemp: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: {x: 0.5, y: 0, z: 0.5}};

const quadIndicesTemp: number[] = [];
const meshesTemp: THREE.Mesh[] = [];
const intersectionsTemp: THREE.Intersection[] = [];

export default class SelfViewOcclusionHider
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

    update(deltaTime: number, camera: THREE.Camera, player: GameObject): void
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
        this.sweep(player);
    }

    // Shows everything again (e.g. when the self-view mode ends), leaving nothing hidden behind.
    revealAll(): void
    {
        for (const quadIndex in this.sweepTagByHiddenQuadIndex)
            InstancedMeshGraphics.setInstanceHidden(voxelInstancedMeshId, Number(quadIndex), false);
        this.sweepTagByHiddenQuadIndex = {};
        this.revealHiddenMeshOccluders();
    }

    private sweep(player: GameObject): void
    {
        player.obj.updateMatrixWorld();
        bodyCenterPos.copy(SelfViewCameraPose.orbitPivot);
        player.obj.localToWorld(bodyCenterPos); // The camera looks at the body's middle.
        bodyBox.center.x = bodyCenterPos.x;
        bodyBox.center.y = bodyCenterPos.y;
        bodyBox.center.z = bodyCenterPos.z;

        const room = App.getCurrentRoom();
        if (room)
            this.hideVoxelQuadsInTheWay(room.voxelGrid.voxels);
        this.hideMeshesInTheWay(player);
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

    private hideMeshesInTheWay(player: GameObject): void
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
            const u = silhouetteOffset(column, numSilhouetteColumns, bodyBox.halfSize.x);
            for (let row = 0; row < numSilhouetteRows; ++row)
            {
                const v = silhouetteOffset(row, numSilhouetteRows, bodyBox.halfSize.y);
                sampleTargetTemp.copy(bodyCenterPos)
                    .addScaledVector(rightTemp, u)
                    .addScaledVector(upTemp, v);
                this.hideMeshesHitOnTheWayTo(sampleTargetTemp, player);
            }
        }
    }

    private hideMeshesHitOnTheWayTo(sampleTarget: THREE.Vector3, player: GameObject): void
    {
        rayDirTemp.subVectors(sampleTarget, cameraPos);
        const distToSample = rayDirTemp.length();
        if (distToSample < NEAR_EPSILON) // The camera sits on the body: nothing fits in between.
            return;
        rayDirTemp.divideScalar(distToSample);

        this.raycaster.set(cameraPos, rayDirTemp);
        this.raycaster.far = distToSample; // Only what stands in front of the body can block it.
        intersectionsTemp.length = 0;
        this.raycaster.intersectObjects(meshesTemp, true, intersectionsTemp);

        for (const intersection of intersectionsTemp)
        {
            const mesh = intersection.object as THREE.Mesh;
            const instanceId = (intersection.instanceId != undefined) ? intersection.instanceId : -1;

            // The player's own body is what the camera is looking at, never something in its way.
            // (Only instances can belong to it — a player is drawn entirely from instanced meshes.)
            if (instanceId >= 0 && InstancedMeshBinding.findGameObject(mesh, instanceId) === player)
                continue;

            const occluderKey = `${mesh.name}/${instanceId}`;
            if (this.hiddenOccluderByKey[occluderKey] != undefined)
                continue; // Already hidden, by an earlier sample of this same sweep.

            const occluder: HiddenOccluder = {mesh, instanceId};
            setOccluderHidden(occluder, true);
            this.hiddenOccluderByKey[occluderKey] = occluder;
        }
    }

    private revealHiddenMeshOccluders(): void
    {
        for (const occluderKey in this.hiddenOccluderByKey)
            setOccluderHidden(this.hiddenOccluderByKey[occluderKey], false);
        this.hiddenOccluderByKey = {};
    }
}

// Fills "quadIndicesTemp" with every voxel quad that the body would run into on its way to the
// camera (a quad's index is also its instance id in the voxel mesh).
function collectQuadIndicesInTheWay(voxels: Voxel[]): void
{
    quadIndicesTemp.length = 0;

    // Only the columns the swept body passes over can hold anything in the way.
    const minCol = Math.floor(Math.min(bodyBox.center.x, cameraPos.x) - bodyBox.halfSize.x);
    const maxCol = Math.floor(Math.max(bodyBox.center.x, cameraPos.x) + bodyBox.halfSize.x);
    const minRow = Math.floor(Math.min(bodyBox.center.z, cameraPos.z) - bodyBox.halfSize.z);
    const maxRow = Math.floor(Math.max(bodyBox.center.z, cameraPos.z) + bodyBox.halfSize.z);

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
    // Solid blocks. A block in the way takes all of its faces with it, so the body ends up seen
    // through a clean opening rather than through a single missing face.
    for (let collisionLayer = COLLISION_LAYER_MIN; collisionLayer <= COLLISION_LAYER_MAX; ++collisionLayer)
    {
        if (!VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer))
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

// Sweeps the body's box toward the camera: whatever that sweep runs into is between the two, and
// so covers part of the body. Sweeping the whole box (rather than tracing a line to its middle) is
// what makes the body come out fully exposed instead of merely peeking through a gap.
function boxIsInTheWay(box: AABB3): boolean
{
    return Geometry3DUtil.castAABBAgainstAABB(bodyBox, cameraPos, box).hitNormal != undefined;
}

// Builds the axes of the body's silhouette as the camera sees it. Returns false if the camera has
// nothing to look at because it sits on the body itself.
function buildSilhouetteAxes(): boolean
{
    forwardTemp.subVectors(bodyCenterPos, cameraPos);
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
