import * as THREE from "three";
import Voxel from "../../../../shared/voxel/types/voxel";
import { clientFeatureFlagsObservable, gameModeObservable, nearbyObjectSelectorObservable, roomChangedObservable, voxelQuadSelectionObservable, voxelQuadSelectionRestrictionObservable } from "../../../system/clientObservables";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_QUADS_PER_ROOM, VOXEL_CELL_SIZE } from "../../../../shared/system/sharedConstants";
import WorldSpaceSelectionUtil from "../../util/worldSpaceSelectionUtil";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";
import WorldSpaceOutlineRect from "./generic/worldSpaceOutlineRect";
import VoxelQuadTransformDimensions from "../../../../shared/voxel/types/voxelQuadTransformDimensions";
import App from "../../../app";
import Vec3 from "../../../../shared/math/types/vec3";
import NumUtil from "../../../../shared/math/util/numUtil";
import ObjectAttachmentUtil from "../../../../shared/object/util/objectAttachmentUtil";
import { AUTO_SELECTION_MAX_DISTANCE, AUTO_SELECTION_MIN_COVERAGE_FREE_RATIO,
    SELECTION_COLOR } from "../../../system/clientConstants";

// How far to either side of the ideal quad's voxel an automatic selection looks for one (see
// VoxelQuadSelection.trySelectBestQuad): a world unit, and a layer above and below.
const SEARCH_REACH_IN_VOXELS = Math.round(1 / VOXEL_CELL_SIZE);

const tempPos = new THREE.Vector3();
const tempPos2 = new THREE.Vector3();
const tempPos3 = new THREE.Vector3();
const tempPos4 = new THREE.Vector3();
const tempDir = new THREE.Vector3();
const tempScale = new THREE.Vector3();

export default class VoxelQuadSelection
{
    voxel: Voxel;
    quadIndex: number;

    constructor(voxel: Voxel, quadIndex: number)
    {
        this.voxel = voxel;
        this.quadIndex = quadIndex;
    }

    static isSelected(): boolean
    {
        return voxelQuadSelectionObservable.peek() != null;
    }

    // Where the quad is drawn in the current room, which is out of sight while it isn't drawn there
    // (see VoxelQueryUtil.getVoxelQuadTransformDimensions).
    getTransformDimensions(): VoxelQuadTransformDimensions
    {
        return VoxelQueryUtil.getVoxelQuadTransformDimensions(
            App.getCurrentRoom()?.voxelGrid.voxels ?? [], this.quadIndex);
    }

    static trySelectBestQuadNearby(position: Vec3): boolean
    {
        const room = App.getCurrentRoom();
        if (!room)
            return false;
        const voxels = room.voxelGrid.voxels;
        const idealVoxel = VoxelQueryUtil.getVoxel(voxels, VoxelQueryUtil.getVoxelRowFromWorldZ(position.z),
            VoxelQueryUtil.getVoxelColFromWorldX(position.x));
        if (!idealVoxel)
            return false;
        const idealCollisionLayer = NumUtil.clampInRange(
            VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(position.y),
            COLLISION_LAYER_MIN, COLLISION_LAYER_MAX);
        const idealQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(
            idealVoxel.row, idealVoxel.col, "y", "+", idealCollisionLayer);
        return VoxelQuadSelection.trySelectBestQuad(idealVoxel, idealQuadIndex);
    }

    // Selects the nearest of the visible quads around the ideal one, itself included, that is near and clear enough
    // (see AUTO_SELECTION_MAX_DISTANCE). With none such, an object near there instead; failing that, the nearest
    // quad left, the clear enough first.
    static trySelectBestQuad(idealVoxel: Voxel, idealQuadIndex: number): boolean
    {
        const room = App.getCurrentRoom();
        if (!room)
            return false;
        const voxels = room.voxelGrid.voxels;
        const idealDims = VoxelQueryUtil.getVoxelQuadTransformDimensions(voxels, idealQuadIndex, true);
        const idealCollisionLayer = getCollisionLayerToSearchAround(idealQuadIndex);
        const minCollisionLayer = Math.max(idealCollisionLayer-1, COLLISION_LAYER_MIN);
        const maxCollisionLayer = Math.min(idealCollisionLayer+1, COLLISION_LAYER_MAX);
        const candidates: VoxelQuadSelectionCandidate[] = [];
        for (let row = idealVoxel.row - SEARCH_REACH_IN_VOXELS; row <= idealVoxel.row + SEARCH_REACH_IN_VOXELS; ++row)
        {
            for (let col = idealVoxel.col - SEARCH_REACH_IN_VOXELS; col <= idealVoxel.col + SEARCH_REACH_IN_VOXELS; ++col)
            {
                const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
                if (!voxel)
                    continue;
                for (let collisionLayer = minCollisionLayer; collisionLayer <= maxCollisionLayer; ++collisionLayer)
                    addVoxelQuadSelectionCandidatesFromLayer(voxels, voxel, collisionLayer, candidates);
                addVoxelQuadSelectionCandidatesFromLayer(voxels, voxel, COLLISION_LAYER_NULL, candidates);
            }
        }
        const camera = GraphicsManager.getCamera();
        const cameraPos = tempPos;
        camera.getWorldPosition(cameraPos);
        const idealQuadPos = setToQuadPos(tempPos2, idealVoxel, idealDims);

        candidates.sort((a, b) => {
            const aPos = setToQuadPos(tempPos3, a.voxel, a.dims);
            const bPos = setToQuadPos(tempPos4, b.voxel, b.dims);

            const aDistFromIdealQuad = idealQuadPos.distanceTo(aPos);
            const bDistFromIdealQuad = idealQuadPos.distanceTo(bPos);
            const aDistFromCamera = cameraPos.distanceTo(aPos);
            const bDistFromCamera = cameraPos.distanceTo(bPos);
            const aDistScore = aDistFromIdealQuad + 0.1 * aDistFromCamera;
            const bDistScore = bDistFromIdealQuad + 0.1 * bDistFromCamera;

            // Prioritize voxelQuads that are closer to the ideal voxelQuad.
            // In case of a tie (or near-tie), prefer the one which is closer to the camera.
            return aDistScore - bDistScore;
        });

        const isNearEnough = (candidate: VoxelQuadSelectionCandidate) => idealQuadPos.distanceTo(
            setToQuadPos(tempPos3, candidate.voxel, candidate.dims)) <= AUTO_SELECTION_MAX_DISTANCE;
        // Read off every object in the room, so worked out only for the candidates it is asked of.
        const isClearEnough = (candidate: VoxelQuadSelectionCandidate) => candidate.clearEnough ??=
            1 - ObjectAttachmentUtil.getVoxelQuadCoverage(room, candidate.quadIndex)
                >= AUTO_SELECTION_MIN_COVERAGE_FREE_RATIO;

        for (const candidate of candidates)
        {
            if (isNearEnough(candidate) && isClearEnough(candidate)
                && VoxelQuadSelection.trySelect(candidate.voxel, candidate.quadIndex))
            {
                return true;
            }
        }
        if (nearbyObjectSelectorObservable.peek()?.(idealQuadPos))
            return true;
        for (const clearEnough of [true, false])
        {
            for (const candidate of candidates)
            {
                if (isClearEnough(candidate) == clearEnough
                    && VoxelQuadSelection.trySelect(candidate.voxel, candidate.quadIndex))
                {
                    return true;
                }
            }
        }
        return false;
    }

    static trySelect(voxel: Voxel, quadIndex: number): boolean
    {
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisableVoxelQuadSelectionChange) ||
            clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange))
        {
            return false;
        }

        // A scripted step may leave just one quad selectable (see voxelQuadSelectionRestrictionObservable).
        const allowedQuadIndex = voxelQuadSelectionRestrictionObservable.peek();
        if (allowedQuadIndex != null && quadIndex != allowedQuadIndex)
            return false;

        // Edit mode only (see ObjectSelection.trySelect).
        if (gameModeObservable.peek() != "edit")
            return false;

        // Invalid or invisible quads are refused without dropping the current selection.
        if (quadIndex < 0 || quadIndex >= NUM_VOXEL_QUADS_PER_ROOM)
            return false;
        const room = App.getCurrentRoom();
        if (!room || !VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, quadIndex))
            return false;

        // Re-clicking the selection keeps it (see ObjectSelection.trySelect).
        const existingSelection = voxelQuadSelectionObservable.peek();
        if (existingSelection != null &&
            existingSelection.voxel == voxel && existingSelection.quadIndex == quadIndex)
        {
            return true;
        }

        voxelQuadSelectionObservable.set(new VoxelQuadSelection(voxel, quadIndex));
        return true;
    }

    static unselect(force: boolean = false)
    {
        if (!force &&
            (clientFeatureFlagsObservable.has(FeatureFlag.DisableVoxelQuadSelectionChange) ||
            clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange)))
        {
            return;
        }
        voxelQuadSelectionObservable.set(null);
    }
}

let selectionOutline: WorldSpaceOutlineRect | null = null;

function refreshSelectionOutline(selection: VoxelQuadSelection)
{
    if (!selectionOutline)
        return;

    const dims = selection.getTransformDimensions();
    setToQuadPos(tempPos, selection.voxel, dims);
    tempDir.set(dims.dirX, dims.dirY, dims.dirZ);
    tempScale.set(dims.scaleX, dims.scaleY, dims.scaleZ);
    selectionOutline.setTransform(tempPos, tempDir, tempScale);
}

// Where a quad of a voxel lies in the world: by the voxel's middle, as its dimensions give it.
function setToQuadPos(out: THREE.Vector3, voxel: Voxel, dims: VoxelQuadTransformDimensions): THREE.Vector3
{
    return out.set(VoxelQueryUtil.getWorldXAtVoxelColCenter(voxel.col) + dims.offsetX, dims.offsetY,
        VoxelQueryUtil.getWorldZAtVoxelRowCenter(voxel.row) + dims.offsetZ);
}

voxelQuadSelectionObservable.addListener("voxelQuadSelection", async (selection: VoxelQuadSelection | null) => {
    if (selection)
    {
        // Initialize the outline if it hasn't been initialized yet.
        if (selectionOutline == null)
        {
            selectionOutline = await WorldSpaceOutlineRect.create(SELECTION_COLOR);
            selectionOutline.addToParent(GraphicsManager.getScene());
        }

        refreshSelectionOutline(selection);
        selectionOutline.setVisible(true);

        WorldSpaceSelectionUtil.unselectOthers("voxelQuad");
    }
    else
    {
        selectionOutline?.setVisible(false);
    }
});

// Forced: a room change overrides any selection lock from a scripted step.
roomChangedObservable.addListener("voxelQuadSelection", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    VoxelQuadSelection.unselect(true);

    if (selectionOutline)
    {
        selectionOutline.dispose();
        selectionOutline = null;
    }
});

// Layer to search around; room floor/ceiling quads have no layer, so use the adjacent end layer.
function getCollisionLayerToSearchAround(quadIndex: number): number
{
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    if (collisionLayer >= COLLISION_LAYER_MIN && collisionLayer <= COLLISION_LAYER_MAX)
        return collisionLayer;
    return (VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex) == "+")
        ? COLLISION_LAYER_MIN // the floor, which faces upward
        : COLLISION_LAYER_MAX; // the ceiling, which faces downward
}

function addVoxelQuadSelectionCandidatesFromLayer(voxels: Voxel[], voxel: Voxel, collisionLayer: number,
    candidates: VoxelQuadSelectionCandidate[])
{
    const numQuadsInLayer = (collisionLayer == COLLISION_LAYER_NULL)
        ? 2 // floor + ceiling
        : NUM_VOXEL_QUADS_PER_COLLISION_LAYER;

    for (let quadIndexOffset = 0; quadIndexOffset < numQuadsInLayer; ++quadIndexOffset)
    {
        const firstIndex = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(
            voxel.row, voxel.col, collisionLayer);
        const quadIndex = firstIndex + quadIndexOffset;
        // Register the quad as a candidate only if it is visible.
        if (VoxelQueryUtil.isVoxelQuadVisible(voxels, quadIndex))
        {
            const dims = VoxelQueryUtil.getVoxelQuadTransformDimensions(
                voxels, quadIndex, true);
            candidates.push({voxel, quadIndex, dims});
        }
    }
}

interface VoxelQuadSelectionCandidate
{
    voxel: Voxel,
    quadIndex: number,
    dims: VoxelQuadTransformDimensions,
    // Whether enough of it is clear of attached objects, once asked (see VoxelQuadSelection.trySelectBestQuad).
    clearEnough?: boolean,
}