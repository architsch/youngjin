import * as THREE from "three";
import SinglePlayerAction from "../../../shared/singlePlayer/types/singlePlayerAction";
import App from "../../app";
import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";
import ClientObjectManager from "../../object/clientObjectManager";
import EasingMotion from "../../object/components/easingMotion";
import { clientFeatureFlagsObservable, downwardArrowTargetObservable, headlineMessageObservable, navigationArrowTargetObservable, screenArrowTargetObservable, screenDiagramObservable, screenOutlineRectTargetObservable, voxelQuadHighlightObservable, voxelQuadSelectionObservable } from "../../system/clientObservables";
import ClientVoxelManager from "../../voxel/clientVoxelManager";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";

const SinglePlayerActionMap: {
    [K in SinglePlayerAction["type"]]: (action: Extract<SinglePlayerAction, {type: K}>) => void;
} =
{
    "clear_all_ui_and_gizmo": (action) => // This action clears out all the UI and Gizmo elements which were created via SinglePlayerActions.
    {
        headlineMessageObservable.set(null);
        screenArrowTargetObservable.set(null);
        screenOutlineRectTargetObservable.set(null);
        screenDiagramObservable.set(null);
        navigationArrowTargetObservable.set(null);
        downwardArrowTargetObservable.set(null);
        voxelQuadHighlightObservable.set(null);
    },
    "ui_headline": (action) => // A React-based 2D box with text in it. It covers the topmost row of the screen, in order to avoid interfering with the camera view as well as the other UI elements.
    {
        headlineMessageObservable.set(action.text);
    },
    "ui_diagram": (action) => // A React-based diagram (drawn by vector-graphics) which is contained inside a partially transparent background. The background itself is a large rectangle (with rounded corners) which is centered on the screen, both horizontally and vertically. Right below the diagram, there may also be a short text describing what it means.
    {
        screenDiagramObservable.set({diagram: action.diagram, text: action.text});
    },
    "ui_arrow": (action) => // A React-based 2D downward arrow which points at the target, while pulsating up and down to grab the user's attention.
    {
        screenArrowTargetObservable.set(action.targetElementId);
    },
    "ui_outline_rect": (action) => // A React-based 2D rectangular outline which surrounds the target UI element for the purpose of highlighting.
    {
        screenOutlineRectTargetObservable.set(action.targetElementId);
    },
    "gizmo_navigation_arrow": (action) => // A 3D world-space arrow which helps the user navigate to the target location. This arrow is always positioned right in front of the player (about 3 units away in the XZ plane), at the height of 1 (i.e. y = 1), and it always keeps pointing at the target.
    {
        navigationArrowTargetObservable.set({x: action.targetX, z: action.targetZ});
    },
    "gizmo_downward_arrow": (action) => // A 3D world-space arrow (i.e. gizmo) which points at the target in the downward direction, while pulsating up and down to grab the user's attention.
    {
        downwardArrowTargetObservable.set(new THREE.Vector3(action.targetX, action.targetY, action.targetZ));
    },
    "gizmo_voxel_quad_outline_rect": (action) => // A 3D world-space rectangular outline (i.e. gizmo) which highlights the boundary of a voxel-quad. Its brightness keeps oscillating in order to grab the user's attention.
    {
        const room = App.getCurrentRoom();
        if (!room)
        {
            console.error("SinglePlayerActionMap :: Current room doesn't exits.");
            return;
        }
        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, action.row, action.col);
        if (!voxel)
        {
            console.error(`SinglePlayerActionMap :: Voxel doesn't exist (row = ${action.row}, col = ${action.col})`);
            return;
        }
        const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(action.row, action.col,
            action.facingAxis, action.orientation, action.collisionLayer);
        voxelQuadHighlightObservable.set(new VoxelQuadSelection(voxel, quadIndex));
    },
    "feature_flag": (action) => // Enables or disables a feature flag.
    {
        if (action.enable)
            clientFeatureFlagsObservable.tryAdd(action.flag);
        else
            clientFeatureFlagsObservable.tryRemove(action.flag);
    },
    "force_unselect_voxel": (action) =>
    {
        if (voxelQuadSelectionObservable.peek())
            VoxelQuadSelection.unselect(true);
    },
    "remove_voxel_blocks": (action) =>
    {
        const room = App.getCurrentRoom();
        if (!room)
        {
            console.error("SinglePlayerActionMap :: Current room doesn't exits.");
            return;
        }
        ClientVoxelManager.removeVoxelBlocksByChunk(room, action.rowStart, action.colStart,
            action.numRows, action.numCols, action.collisionLayerMin, action.collisionLayerMax, false);
    },
    "set_object_metadata": (action) =>
    {
        const obj = ClientObjectManager.getObjectById(action.objectId);
        if (!obj)
        {
            console.error(`SinglePlayerActionMap :: Object doesn't exits (objectId = ${action.objectId})`);
            return;
        }
        ClientObjectManager.setObjectMetadata(action.objectId, action.metadataKey,
            action.metadataValue, false);
    },
    "object_bounce": (action) => // Triggers a brief easing motion (offset/rotation/scale) on the target object, e.g. to make an NPC nod when it replies.
    {
        const obj = ClientObjectManager.getObjectById(action.objectId);
        if (!obj)
        {
            console.error(`SinglePlayerActionMap :: Object doesn't exits (objectId = ${action.objectId})`);
            return;
        }
        const easingMotion = obj.components.easingMotion as EasingMotion | undefined;
        if (!easingMotion)
        {
            console.error(`SinglePlayerActionMap :: Object has no easingMotion component (objectId = ${action.objectId})`);
            return;
        }
        easingMotion.bounce({
            durationSeconds: action.durationSeconds,
            positionOffset: action.positionOffset,
            rotationOffset: action.rotationOffset,
            scaleMultiplier: action.scaleMultiplier,
            oscillations: action.oscillations,
        });
    },
}

export default SinglePlayerActionMap;