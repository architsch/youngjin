import * as THREE from "three";
import Voxel from "../../../../shared/voxel/types/voxel";
import { clientFeatureFlagsObservable, playerViewTargetPosObservable, roomChangedObservable, voxelQuadSelectionObservable } from "../../../system/clientObservables";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, COLLISION_LAYER_NULL, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_QUADS_PER_ROOM } from "../../../../shared/system/sharedConstants";
import WorldSpaceSelectionUtil from "../../util/worldSpaceSelectionUtil";
import GameModeUtil from "../../../system/util/gameModeUtil";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";
import WorldSpaceOutlineRect from "./generic/worldSpaceOutlineRect";
import VoxelQuadTransformDimensions from "../../../../shared/voxel/types/voxelQuadTransformDimensions";
import App from "../../../app";
import Vec3 from "../../../../shared/math/types/vec3";
import NumUtil from "../../../../shared/math/util/numUtil";

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

    static trySelectBestQuadNearby(position: Vec3): boolean
    {
        const room = App.getCurrentRoom();
        if (!room)
            return false;
        const voxels = room.voxelGrid.voxels;
        const idealVoxel = VoxelQueryUtil.getVoxel(voxels, Math.floor(position.z), Math.floor(position.x));
        if (!idealVoxel)
            return false;
        const idealCollisionLayer = NumUtil.clampInRange(
            COLLISION_LAYER_MIN + Math.floor(2 * position.y),
            COLLISION_LAYER_MIN, COLLISION_LAYER_MAX);
        const idealQuadIndex = VoxelQueryUtil.getVoxelQuadIndex(
            idealVoxel.row, idealVoxel.col, "y", "+", idealCollisionLayer);
        return VoxelQuadSelection.trySelectBestQuad(idealVoxel, idealQuadIndex);
    }

    static trySelectBestQuad(idealVoxel: Voxel, idealQuadIndex: number): boolean
    {
        if (VoxelQuadSelection.trySelect(idealVoxel, idealQuadIndex))
            return true;

        // If selecting the ideal voxelQuad failed, try selecting the best alternative (e.g. nearest voxelQuad).
        const idealDims = VoxelQueryUtil.getVoxelQuadTransformDimensions(idealVoxel, idealQuadIndex, true);
        const idealCollisionLayer = getCollisionLayerToSearchAround(idealQuadIndex);
        const minCollisionLayer = Math.max(idealCollisionLayer-1, COLLISION_LAYER_MIN);
        const maxCollisionLayer = Math.min(idealCollisionLayer+1, COLLISION_LAYER_MAX);
        const candidates: VoxelQuadSelectionCandidate[] = [];
        const room = App.getCurrentRoom();
        if (!room)
            return false;
        const voxels = room.voxelGrid.voxels;
        for (let row = idealVoxel.row-1; row <= idealVoxel.row+1; ++row)
        {
            for (let col = idealVoxel.col-1; col <= idealVoxel.col+1; ++col)
            {
                const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
                if (!voxel)
                    continue;
                for (let collisionLayer = minCollisionLayer; collisionLayer <= maxCollisionLayer; ++collisionLayer)
                    addVoxelQuadSelectionCandidatesFromLayer(voxel, collisionLayer, candidates);
                addVoxelQuadSelectionCandidatesFromLayer(voxel, COLLISION_LAYER_NULL, candidates);
            }
        }
        const camera = GraphicsManager.getCamera();
        const cameraPos = tempPos;
        camera.getWorldPosition(cameraPos);
        const idealQuadPos = tempPos2;
        idealQuadPos.set(
            idealVoxel.col + 0.5 + idealDims.offsetX,
            idealDims.offsetY,
            idealVoxel.row + 0.5 + idealDims.offsetZ
        );

        candidates.sort((a, b) => {
            const aPos = tempPos3;
            aPos.set(
                a.voxel.col + 0.5 + a.dims.offsetX,
                a.dims.offsetY,
                a.voxel.row + 0.5 + a.dims.offsetZ
            );
            const bPos = tempPos4;
            bPos.set(
                b.voxel.col + 0.5 + b.dims.offsetX,
                b.dims.offsetY,
                b.voxel.row + 0.5 + b.dims.offsetZ
            );
            
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

        for (const candidate of candidates)
        {
            if (VoxelQuadSelection.trySelect(candidate.voxel, candidate.quadIndex))
                return true;
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

        // If the quadIndex doesn't even make sense, just unselect.
        if (quadIndex < 0 || quadIndex >= NUM_VOXEL_QUADS_PER_ROOM)
        {
            voxelQuadSelectionObservable.set(null);
            return false;
        }

        // If the quad is hidden, just unselect.
        const quad = voxel.quadsMem.quads[quadIndex];
        if ((quad & 0b10000000) == 0)
        {
            voxelQuadSelectionObservable.set(null);
            return false;
        }

        const existingSelection = voxelQuadSelectionObservable.peek();

        if (existingSelection == null) // There was no selection before.
        {
            voxelQuadSelectionObservable.set(new VoxelQuadSelection(voxel, quadIndex));
            return true;
        }
        else
        {
            if (existingSelection.voxel == voxel && existingSelection.quadIndex == quadIndex) // Selected the same quad twice.
            {
                // Clicking what is already picked out is how the selection is let go of. In edit
                // mode the mode goes with it: that mode is the selection — the camera orbiting it,
                // the player standing still for it — so a mode left with nothing under it would be
                // an arrangement kept up for the sake of something that is no longer there.
                if (GameModeUtil.isInEditMode())
                {
                    // Which makes this click a way out of the mode, and a scripted step holding the
                    // user in that mode holds it too. The two cannot be told apart here — dropping
                    // the selection alone would leave the very empty mode described above — so the
                    // click is turned away whole, leaving the quad picked out as it was.
                    if (!GameModeUtil.canChangeGameMode())
                        return true;
                    GameModeUtil.exitEditMode(); // Which drops this selection along with the mode.
                    return false;
                }
                voxelQuadSelectionObservable.set(null);
                return false;
            }
            else // Selected a different quad while another one was selected.
            {
                voxelQuadSelectionObservable.set(new VoxelQuadSelection(voxel, quadIndex));
                return true;
            }
        }
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

voxelQuadSelectionObservable.addListener("voxelQuadSelection", async (selection: VoxelQuadSelection | null) => {
    if (selection)
    {
        // Initialize the outline if it hasn't been initialized yet.
        if (selectionOutline == null)
        {
            selectionOutline = await WorldSpaceOutlineRect.create("#00ff00");
            selectionOutline.addToParent(GraphicsManager.getScene());
        }

        const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ, scaleX, scaleY, scaleZ } =
            VoxelQueryUtil.getVoxelQuadTransformDimensions(selection.voxel, selection.quadIndex);

        tempPos.set(selection.voxel.col + 0.5 + offsetX, offsetY, selection.voxel.row + 0.5 + offsetZ);
        tempDir.set(dirX, dirY, dirZ);
        tempScale.set(scaleX, scaleY, scaleZ);
        selectionOutline.setTransform(tempPos, tempDir, tempScale);
        selectionOutline.setVisible(true);

        // If a voxelQuad is selected, the player's viewTarget should be the selected voxelQuad.
        playerViewTargetPosObservable.set(new THREE.Vector3(selection.voxel.col + 0.5 + offsetX, offsetY, selection.voxel.row + 0.5 + offsetZ));

        WorldSpaceSelectionUtil.unselectOthers("voxelQuad");
    }
    else
    {
        selectionOutline?.setVisible(false);
    }

    // Is nothing selected at all? Then just set the viewTarget to NULL.
    if (!WorldSpaceSelectionUtil.isAnythingSelected())
        playerViewTargetPosObservable.set(null);
});

// Whenever the current room changes,
// the existing selection (if there is one) should be discarded.
roomChangedObservable.addListener("voxelQuadSelection", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    VoxelQuadSelection.unselect();

    if (selectionOutline)
    {
        selectionOutline.dispose();
        selectionOutline = null;
    }
});

// The collisionLayer whose neighborhood should be searched for an alternative to the given quad.
// A quad belonging to the room's own floor or ceiling sits in no collisionLayer at all,
// so it is answered for by the layer lying against whichever end of the room it belongs to.
function getCollisionLayerToSearchAround(quadIndex: number): number
{
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    if (collisionLayer >= COLLISION_LAYER_MIN && collisionLayer <= COLLISION_LAYER_MAX)
        return collisionLayer;
    return (VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex) == "+")
        ? COLLISION_LAYER_MIN // the floor, which faces upward
        : COLLISION_LAYER_MAX; // the ceiling, which faces downward
}

function addVoxelQuadSelectionCandidatesFromLayer(voxel: Voxel, collisionLayer: number,
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
        if ((voxel.quadsMem.quads[quadIndex] & 0b10000000) != 0)
        {
            const dims = VoxelQueryUtil.getVoxelQuadTransformDimensions(
                voxel, quadIndex);
            candidates.push({voxel, quadIndex, dims});
        }
    }
}

interface VoxelQuadSelectionCandidate
{
    voxel: Voxel,
    quadIndex: number,
    dims: VoxelQuadTransformDimensions,
}