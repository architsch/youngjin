import * as THREE from "three";
import App from "../../../../app";
import GameObject from "../../../types/gameObject";
import ClientObjectManager from "../../../clientObjectManager";
import MeshFactory from "../../../../graphics/factories/meshFactory";
import InstancedMeshBinding from "../../../../graphics/types/mesh/instancedMeshBinding";
import HiddenOccluder from "../../../../graphics/types/mesh/hiddenOccluder";
import OccluderCandidate from "../../../../graphics/types/mesh/occluderCandidate";
import InstancedMeshComposer from "../../instancedMeshComposer";
import InstancedMeshGraphics from "../../instancedMeshGraphics";
import AABB3 from "../../../../../shared/math/types/aabb3";
import Vec3 from "../../../../../shared/math/types/vec3";
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
// target volume (a wall the target sits behind, the ceiling the orbit rises above, a canvas hanging
// on that wall) is hidden for as long as it stands there, and shown again once it no longer does.
//
// Only what belongs to the room's fabric is hidden at all, and each type of object says whether it
// does by carrying an OrbitOccluder component. That is what keeps characters standing where they
// are while the room around them gives way: a wall taken out reads as the room being opened up,
// where a body taken out reads as the person having left (see OrbitOccluder). Geometry belonging to
// no object at all — a gizmo drawn over the room to point something out — declares nothing and is
// left alone for the same reason: it is not part of the room to begin with, so removing it takes
// away a piece of guidance instead of opening anything up.
//
// Standing in the way is a matter of degree, and taking something out of the room is a heavy-handed
// thing to do to it: something clipping a corner of the target costs the user next to nothing, while
// something covering the target costs him the whole point of the mode. So the target is reduced to a
// grid of samples spread over its silhouette as the camera sees it, and every candidate is judged by
// how many of those samples it stands in front of — the share of the target it actually takes away —
// rather than by whether it touches the view at all. Only a candidate that blocks a fair share of
// them is hidden; the rest are left where they are.
//
// Those samples stand on the target's surface, at the points the camera's own rays into it first
// meet it, and only where that surface could ever be shown at all — which is everywhere except
// where it is walled off by something that is staying put (see faceIsExposed). Sampling the inside
// of the target instead would misjudge everything the target is embedded in: a block belongs to a
// wall, and a picture hangs flat on one, so a point taken from within either lies behind that wall's
// face, and its line back to the camera runs away down the length of the wall — condemning block
// after block of it, none of which stands in front of anything the user could see in the first place.
//
// The room's own geometry and everything else in it reach that judgement by different routes,
// because their costs are nothing alike:
//
//   - The room's voxel quads are first thinned out by sweeping the target's box toward the camera
//     through the voxel grid, which settles almost all of a room's tens of thousands of quads — far
//     too many to raycast repeatedly — and only what survives is measured against the samples. Each
//     quad belongs to the voxel column it was baked for, so the declaration above is read off that
//     column's own object, once per column rather than once per quad.
//   - Everything else (canvases, doors) is found by raycasting the remaining meshes, which are few,
//     along the samples themselves. What a ray strikes counts against the whole object it belongs
//     to rather than the piece hit, since an object drawn out of many parts covers the target with
//     all of them together, and hiding one part would leave the rest of it standing there in pieces.
//
// Whatever the orbit is looking *at* is exempt from all of this, since hiding it is precisely what
// would defeat the mode (see the protected region below).
//
// A sweep is paced rather than run every frame: promptly after the camera has moved, and slowly
// while it rests, which is when only a moving occluder could change the answer.
//------------------------------------------------------------------------

const minSweepInterval = 0.15; // seconds between sweeps while the camera keeps moving
const maxSweepInterval = 0.5; // seconds between sweeps while the camera rests
const cameraRestDistSqr = 0.0001; // camera movement below this counts as resting

// How densely the target's silhouette is aimed at, and how much of it something has to stand in
// front of before it is worth hiding.
//
// The threshold is small, because it is a share of the *whole* target: a fifth of a standing
// character is a shoulder or a head, so a threshold generous enough to sound like "a fair share"
// leaves whole limbs of him behind the wall. It also flatters what sparing a block achieves.
// Nothing reaches this judgement without standing in front of the target to begin with, so the
// block spared here is never one holding an intact wall together — it is one at the rim of the
// opening the sweep is making anyway, and leaving it there does not keep the wall. It only makes
// the opening the wrong shape around the thing the user asked to see, which is the whole of what
// the mode owes him.
//
// What keeps geometry that merely passes near the line of sight in its place is not this threshold
// but the samples themselves: they stand on the target's own surface, so something that crosses
// none of them was never in the way of any part of it. The threshold is there for the narrower
// case of geometry that genuinely clips the target, but by so little that emptying its place in the
// room would be the greater loss — which takes more than a single sample to tell apart from a
// sample landing near an edge.
//
// The grid is dense enough for the share it measures to be a measure rather than a step: too coarse
// a grid, and a block covers either exactly one row of samples or none, so what is hidden follows
// the grid's own spacing instead of the shape of the target.
const numSilhouetteColumns = 7;
const numSilhouetteRows = 7;
const minBlockedSampleRatio = 0.04;

const maxNumSamples = numSilhouetteColumns * numSilhouetteRows;

// How far outside a sample's own face the room is looked up when asking whether that part of the
// target is exposed at all. Enough to clear the face itself, and far short of a block.
const exposureProbeDist = 0.02;

const voxelInstancedMeshId = MeshDataUtil.getInstancedMeshId(
    VOXEL_QUAD_GEOMETRY_ID, VOXEL_TEXTURE_PACK_MATERIAL_ID);

const blockHeight = 2 * VOXEL_BLOCK_HITBOX_HALFSIZE.y;

const cameraPos = new THREE.Vector3();
const targetCenterPos = new THREE.Vector3();
const forwardTemp = new THREE.Vector3();
const rightTemp = new THREE.Vector3();
const upTemp = new THREE.Vector3();
const rayDirTemp = new THREE.Vector3();
const sampleRayTemp = new THREE.Vector3();
const sampleDestTemp = new THREE.Vector3();

// The points the target is reduced to for the duration of a sweep (see buildSilhouetteSamples), of
// which only the leading "numSamples" are in use — an aim that finds no exposed part of the target
// leaves no sample behind, so how many the target is worth varies with where the camera stands, and
// so does the share of them something has to block.
const silhouetteSamples = Array.from({length: maxNumSamples}, () => new THREE.Vector3());
let numSamples = 0;
let minBlockedSamples = 1;

// A single point, in the form the shared cast utility takes, so that a line can be traced by the
// same code that sweeps a volume along one.
const pointTemp: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: {x: 0, y: 0, z: 0}};

// The volume that has to end up in view — held a hair smaller than the target itself, which is what
// keeps the surface the samples are placed on a hair inside it. The sweep below reports what the
// target would run *into* on its way to the camera, so a surface the target already rests flush
// against (the floor under a player's feet, the wall a block belongs to) has to start a hair away
// from it to count as something run into rather than something already touched. The same step-back
// keeps the physics engine's own casts out of the walls they start on.
const targetSweepInset = 0.001;
const targetBox: AABB3 = {center: {x: 0, y: 0, z: 0}, halfSize: {x: 0, y: 0, z: 0}};

// How far a sample's ray is carried past the aim it was given (see placeSampleOnTarget): the width
// of the sphere that holds the target, which no two points of the target are further apart than.
let targetSpan = 0;

// The block a target that is part of the room's own geometry sits in, together with every block
// touching that one — diagonals, and the layers above and below, included (see setProtectedRegion).
const protectedNeighborhood: AABB3 = {
    center: {x: 0, y: 0, z: 0},
    halfSize: {x: 1.5, y: 1.5 * blockHeight, z: 1.5},
};

// Whatever the orbit is looking at, out of which nothing is hidden however much of the view it
// takes up: one of the two volumes above, settled at every sweep (see setProtectedRegion).
let protectedRegion: AABB3 = targetBox;

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

    // What the samples of the sweep under way have struck so far, keyed by the object each belongs
    // to (or by the geometry itself, where it belongs to no object). Emptied at every sweep.
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
            InstancedMeshGraphics.setInstanceHidden(voxelInstancedMeshId, Number(quadIndex), false);
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

        // The camera has no exposed part of the target to look at — it sits on the target, or every
        // part of it facing this way is buried — so there is nothing anything could be in the way of.
        if (!buildSilhouetteSamples(voxels))
        {
            this.revealAll();
            return;
        }

        if (voxels)
            this.hideVoxelQuadsInTheWay(voxels);
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

        collectMeshesToRaycast();
        this.candidateByKey = {};
        for (let i = 0; i < numSamples; ++i)
            this.collectCandidatesInFrontOf(silhouetteSamples[i], i);

        for (const candidateKey in this.candidateByKey)
        {
            const candidate = this.candidateByKey[candidateKey];
            if (candidate.numSamplesBlocked < minBlockedSamples)
                continue; // Barely in the way of anything: not worth emptying its place in the room.

            this.hideOccluder(candidate.mesh, candidate.instanceId);
            this.hideRemainingPartsOf(candidate.gameObject);
        }
    }

    private collectCandidatesInFrontOf(sample: THREE.Vector3, sampleIndex: number): void
    {
        rayDirTemp.subVectors(sample, cameraPos);
        const distToSample = rayDirTemp.length();
        if (distToSample < NEAR_EPSILON) // The camera sits on the sample: nothing fits in between.
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

            // Nothing is hidden that has not declared itself part of the room (see above), and
            // nothing is hidden that the camera is looking at, however much of the view it takes.
            if (!objectIsOccluder(gameObject) || objectIsProtected(gameObject))
                continue;

            this.creditBlockedSample(mesh, instanceId, gameObject, sampleIndex);
        }
    }

    // Puts one blocked sample on the account of the object the struck geometry belongs to. Keeping
    // the account per object is what lets an object drawn out of several pieces be measured by the
    // whole of itself instead of by whichever piece a sample landed on, and what keeps a single
    // sample passing through two of its pieces worth the one sample it is.
    private creditBlockedSample(mesh: THREE.Mesh, instanceId: number,
        gameObject: GameObject, sampleIndex: number): void
    {
        const candidateKey = gameObject.params.objectId;
        const candidate = this.candidateByKey[candidateKey];
        if (candidate == undefined)
        {
            this.candidateByKey[candidateKey] = {mesh, instanceId, gameObject,
                numSamplesBlocked: 1, lastSampleIndexBlocked: sampleIndex};
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

    // A ray reports the one piece of geometry it struck, but an object need not be one piece: a
    // composed object draws each of its parts as an instance of its own, and hiding only the part a
    // sample happened to land on would leave the rest of it standing in front of what the camera is
    // meant to see. So an object found in the way goes out of sight whole. Objects drawn as a single
    // piece have nothing further to hide, and say so by carrying no composer — which is the case for
    // everything the room currently declares an occluder, a canvas and a door alike.
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

    targetSpan = 2 * Math.hypot(targetBox.halfSize.x, targetBox.halfSize.y, targetBox.halfSize.z);
}

// Settles what is exempt from being hidden, which is whatever the orbit is looking at.
//
// A target that is itself a piece of the room's geometry — a selected face, which is a block — is
// rarely alone where it stands: the wall it belongs to is made of the blocks around it, and a
// picture hanging there rests against the same wall. Emptying that neighbourhood would take away
// the very thing the user asked to look at, so such a target is spared it entirely. (A center
// falling exactly on the boundary between two blocks needs no special care: whichever side it is
// counted on, the block on the other side is a neighbour anyway.)
//
// A target that merely stands in the room — a character, a prop, a place a scripted step is
// pointing at — is spared nothing beyond the space it occupies itself. Sparing its surroundings as
// well would empty the mode of its point: nothing can stand between the camera and the target
// without being nearer to the target than the camera is, so a neighbourhood spared for its nearness
// takes in every occluder there is as soon as the user draws the camera in, and holds the wall in
// front of his own character in place at exactly the range he most wants to see past it. Whatever
// such a target is set *into*, if anything, is kept by its samples instead (see
// buildSilhouetteSamples), which is a matter of the target's own surface rather than of distance.
function setProtectedRegion(target: AABB3, voxels: Voxel[] | undefined): void
{
    const col = Math.floor(target.center.x);
    const row = Math.floor(target.center.z);
    const collisionLayer = Math.floor(target.center.y / blockHeight);
    if (!blockIsSolid(voxels, row, col, collisionLayer))
    {
        protectedRegion = targetBox;
        return;
    }

    protectedNeighborhood.center.x = col + 0.5;
    protectedNeighborhood.center.y = (collisionLayer + 0.5) * blockHeight;
    protectedNeighborhood.center.z = row + 0.5;
    protectedRegion = protectedNeighborhood;
}

// Whether the room's own geometry fills the given block. Nothing lies beyond the room's walls,
// under its floor, or above its ceiling, so a target reaching out there is standing in the open
// rather than being set into anything.
function blockIsSolid(voxels: Voxel[] | undefined,
    row: number, col: number, collisionLayer: number): boolean
{
    if (voxels == undefined ||
        row < 0 || row >= NUM_VOXEL_ROWS || col < 0 || col >= NUM_VOXEL_COLS ||
        collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
        return false;

    const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
    return voxel != undefined && VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer);
}

// The game object a ray hit belongs to, if it belongs to one at all (a gizmo does not).
function findGameObject(mesh: THREE.Mesh, instanceId: number): GameObject | undefined
{
    return (instanceId >= 0)
        ? InstancedMeshBinding.findGameObject(mesh, instanceId)
        // For regular (non-instanced) meshes, (mesh.name == meshId == objectId).
        : ClientObjectManager.getObjectById(mesh.name);
}

// Whether the game object a piece of geometry belongs to is one the orbit may take out of the room,
// which each type of object declares for itself (see OrbitOccluder). Geometry belonging to no object
// declares nothing, and so is never hidden.
function objectIsOccluder(gameObject: GameObject | undefined): gameObject is GameObject
{
    return gameObject != undefined && gameObject.components.orbitOccluder != undefined;
}

// The same question for one column of the room's own geometry, which the grid sweep reaches by the
// column rather than by the quad: every quad of a column is drawn by the one object that owns it,
// so the answer is the same for all of them.
function voxelIsOccluder(voxel: Voxel): boolean
{
    return objectIsOccluder(ClientObjectManager.getObjectById(voxel.gameObjectId));
}

// Whether the game object a ray hit is one of those the orbit is looking at, i.e. one whose own
// volume reaches into the protected region.
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

// Fills "quadIndicesTemp" with every voxel quad standing in enough of the target's way to be worth
// hiding (a quad's index is also its instance id in the voxel mesh).
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
            if (voxel != undefined && voxelIsOccluder(voxel))
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

        blockBoxTemp.center.x = col + 0.5;
        blockBoxTemp.center.y = VOXEL_BLOCK_HITBOX_HALFSIZE.y * (2 * collisionLayer + 1);
        blockBoxTemp.center.z = row + 0.5;
        // Part of what the orbit is looking at, rather than something in its way.
        if (Geometry3DUtil.AABBsOverlap(protectedRegion, blockBoxTemp))
            continue;
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

// Whether the box covers enough of the target to be worth hiding.
//
// The target's box is first swept toward the camera, since whatever that sweep would not run into
// cannot cover any of the target, and one such test settles nearly every block of a room. What
// survives it is then measured against the silhouette's samples, because the sweep on its own is
// far too eager to condemn: it keeps the target's full width all the way to the camera, where the
// view the target takes up has in truth narrowed to almost nothing, so it would also carry off
// geometry standing well beside the line of sight, and geometry that merely clips an edge.
function boxIsInTheWay(box: AABB3): boolean
{
    if (Geometry3DUtil.castAABBAgainstAABB(targetBox, cameraPos, box).hitNormal == undefined)
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

// Whether the box stands between the camera and one sample of the target. The trace runs from the
// sample outward rather than from the camera in, so that the surface the sample sits on — and
// whatever the target rests flush against — is something touched rather than something run into.
function traceToCameraHits(sample: THREE.Vector3, box: AABB3): boolean
{
    pointTemp.center.x = sample.x;
    pointTemp.center.y = sample.y;
    pointTemp.center.z = sample.z;
    return Geometry3DUtil.castAABBAgainstAABB(pointTemp, cameraPos, box).hitNormal != undefined;
}

// Places the points the target is reduced to for this sweep, and settles how many of them something
// has to block to count. The grid is aimed over the target's silhouette as the camera sees it, but
// no sample stays where it is aimed: each is moved to where the camera's ray toward it first meets
// the target, so that every one of them stands on the target's surface with a clear line back.
//
// An aim that finds nothing there leaves no sample behind at all. It may have gone wide — a
// silhouette is measured as a rectangle, and a target rarely fills the corners of one — or it may
// have landed on a face walled off by geometry that is staying put, which stands for a part of the
// target that is out of sight whatever the camera does about it. Counting such a part would be
// worse than useless: the line from it back to the camera runs through the wall the target is set
// into, and would carry off the length of that wall on behalf of something nobody can see.
//
// Returns false if nothing of the target is left to look at, which is also the case when the camera
// sits inside it.
function buildSilhouetteSamples(voxels: Voxel[] | undefined): boolean
{
    numSamples = 0;

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

// Moves an aimed-at point of the silhouette onto the target itself — to where the camera's ray
// toward it enters the target's volume — and says whether the sample it now is stands for anything
// worth counting.
//
// An aim marks a direction into the target rather than a distance to it, so the ray is carried past
// the aim by the whole span of the target before being asked what it first met. The aims are spread
// over a plane standing square to the camera through the target's center, and half of that plane
// lies in front of the surface it speaks for: a camera looking down at a standing character sees
// its silhouette tilted, the top leaning away and the bottom leaning toward the camera, so an aim
// low on that silhouette is a point hanging in the air short of the character's chest. Stopping the
// ray there would find nothing and throw the sample away — leaving a target sampled only where the
// aims happen to fall deep enough to reach it, which for anything taller than it is wide means the
// upper part of it alone, and an opening cleared for it no bigger than its head.
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
    return faceIsExposed(sample, hit.hitNormal, voxels);
}

// Whether the face of the target a sample landed on stands for anything the camera could ever be
// shown, or is walled off for good. Looked up just outside that face rather than along the line of
// sight, since the sample sits exactly on the boundary the target and whatever it meets there
// share, and how steeply the camera happens to look at that boundary has nothing to do with what
// lies on the other side of it.
//
// What decides it is not whether the room's geometry is pressed against the face, but whether that
// geometry is *staying*. A block buried in a wall has the rest of that wall pressed against its
// sides, and a picture fixed flat to a wall has the wall behind its back — both of them protected,
// both of them there whatever the camera does, so those faces stand for parts of the target nobody
// can ever be shown, and a line drawn from them back to the camera would carry off the wall they
// are buried in on behalf of something invisible. A character standing with his back to that same
// wall meets it exactly as flatly, but nothing about the wall is staying: it is the very thing in
// his way, and taking it away is the whole of what this mode is for. So his back counts, and says
// so — where treating it as buried would leave him behind the wall with nothing left asking for the
// wall to be cleared, which is to say with the mode doing nothing at all for him.
function faceIsExposed(sample: THREE.Vector3, faceNormal: Vec3, voxels: Voxel[] | undefined): boolean
{
    const col = Math.floor(sample.x + faceNormal.x * exposureProbeDist);
    const row = Math.floor(sample.z + faceNormal.z * exposureProbeDist);
    const collisionLayer = Math.floor((sample.y + faceNormal.y * exposureProbeDist) / blockHeight);
    if (!blockIsSolid(voxels, row, col, collisionLayer))
        return true;

    blockBoxTemp.center.x = col + 0.5;
    blockBoxTemp.center.y = VOXEL_BLOCK_HITBOX_HALFSIZE.y * (2 * collisionLayer + 1);
    blockBoxTemp.center.z = row + 0.5;
    return !Geometry3DUtil.AABBsOverlap(protectedRegion, blockBoxTemp);
}

// How far the target reaches to either side of its center along one of the camera's own axes, i.e.
// how wide a shadow it casts on that axis. Taking its half-size along a world axis instead would
// spread the aims over a width the target does not have from where the camera happens to stand: a
// canvas seen edge-on would be aimed at a whole block wide, and nearly every aim would sail past it
// into the room and be thrown away.
function silhouetteRadius(axis: THREE.Vector3): number
{
    return Math.abs(axis.x) * targetBox.halfSize.x +
        Math.abs(axis.y) * targetBox.halfSize.y +
        Math.abs(axis.z) * targetBox.halfSize.z;
}

// Spreads the aims evenly across the silhouette, one in the middle of each cell of the grid. Aiming
// at the middle rather than out at the edges is what makes each sample stand for an equal share of
// the target, and keeps the outermost of them off the very rim, where a sample says more about what
// the target sits next to than about the target itself.
function silhouetteOffset(sampleIndex: number, numSamples: number, radius: number): number
{
    return radius * (2 * (sampleIndex + 0.5) / numSamples - 1);
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
