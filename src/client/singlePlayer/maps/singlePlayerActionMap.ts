import * as THREE from "three";
import App from "../../app";
import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";
import ClientObjectManager from "../../object/clientObjectManager";
import EasingMotion from "../../object/components/easingMotion";
import { cameraModeObservable, clientFeatureFlagsObservable, downwardArrowTargetObservable, headlineMessageObservable, navigationArrowTargetObservable, orbitCameraTargetOverrideObservable, orbitCameraViewRequestObservable, screenArrowTargetObservable, screenDiagramObservable, screenOutlineRectTargetObservable, voxelQuadHighlightObservable, voxelQuadSelectionObservable } from "../../system/clientObservables";
import ClientVoxelManager from "../../voxel/clientVoxelManager";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import SinglePlayerManager from "../singlePlayerManager";
import SinglePlayerAction from "../types/singlePlayerAction";

// Each action reaches straight for whatever it acts upon — the room, the character, the camera, the
// UI — since a step is played on the client and nowhere else. What it acts *with* comes from its own
// parameters, which are read here rather than written into the step (see SinglePlayerParam).
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
        headlineMessageObservable.set(action.text());
    },
    "ui_diagram": (action) => // A React-based diagram (drawn by vector-graphics) which is contained inside a partially transparent background, with a short text describing what it means right below it. It is centered on the screen by default; a "side" placement moves it aside, drawn small, so that it does not cover whatever the demonstrated gesture is meant to act upon.
    {
        screenDiagramObservable.set({diagram: action.diagram, text: action.text(),
            placement: action.placement ?? "center"});
    },
    "ui_arrow": (action) => // A React-based 2D arrow which points at the target, while pulsating to grab the user's attention. It hangs above the target by default, and below it (pointing up) for a target too near the top of the screen to have room above it.
    {
        screenArrowTargetObservable.set({targetElementId: action.targetElementId,
            arrowBias: action.arrowBias, arrowSide: action.arrowSide ?? "above"});
    },
    "ui_outline_rect": (action) => // A React-based 2D rectangular outline which surrounds the target UI element for the purpose of highlighting.
    {
        screenOutlineRectTargetObservable.set(action.targetElementId);
    },
    "gizmo_navigation_arrow": (action) => // A 3D world-space arrow which helps the user navigate to the target location. This arrow is always positioned right in front of the player (about 3 units away in the XZ plane), at the height of 1 (i.e. y = 1), and it always keeps pointing at the target.
    {
        navigationArrowTargetObservable.set({x: action.targetX(), z: action.targetZ()});
    },
    "gizmo_downward_arrow": (action) => // A 3D world-space arrow (i.e. gizmo) which points at the target in the downward direction, while pulsating up and down to grab the user's attention.
    {
        downwardArrowTargetObservable.set(new THREE.Vector3(
            action.targetX(), action.targetY(), action.targetZ()));
    },
    "gizmo_voxel_quad_outline_rect": (action) => // A 3D world-space rectangular outline (i.e. gizmo) which highlights the boundary of a voxel-quad. Its brightness keeps oscillating in order to grab the user's attention.
    {
        const room = App.getCurrentRoom();
        if (!room)
        {
            console.error("SinglePlayerActionMap :: Current room doesn't exits.");
            return;
        }
        const row = action.row();
        const col = action.col();
        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
        {
            console.error(`SinglePlayerActionMap :: Voxel doesn't exist (row = ${row}, col = ${col})`);
            return;
        }
        const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(row, col,
            action.facingAxis, action.orientation, action.collisionLayer());
        voxelQuadHighlightObservable.set(new VoxelQuadSelection(voxel, quadIndex));
    },
    "feature_flag": (action) => // Enables or disables a feature flag.
    {
        if (action.enable)
            clientFeatureFlagsObservable.tryAdd(action.flag);
        else
            clientFeatureFlagsObservable.tryRemove(action.flag);
    },
    "select_voxel_quad": (action) => // Puts the selection on a quad of the step's own choosing. This is the script's doing rather than the user's, so it goes through whatever the step is holding still meanwhile: a step that pins the selection to keep the user from wandering off it still has to be able to move it itself, once the block it was pinned to has been built or taken away.
    {
        const room = App.getCurrentRoom();
        if (!room)
        {
            console.error("SinglePlayerActionMap :: Current room doesn't exits.");
            return;
        }
        const row = action.row();
        const col = action.col();
        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
        if (!voxel)
        {
            console.error(`SinglePlayerActionMap :: Voxel doesn't exist (row = ${row}, col = ${col})`);
            return;
        }
        const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(row, col,
            action.facingAxis, action.orientation, action.collisionLayer());
        if ((voxel.quadsMem.quads[quadIndex] & 0b10000000) == 0)
        {
            // A quad nobody can see is a quad nobody can act on, so the step is asking for
            // something that is not there. Whatever is selected is left alone.
            console.error(`SinglePlayerActionMap :: Voxel-quad is not visible (row = ${row}, col = ${col})`);
            return;
        }
        voxelQuadSelectionObservable.set(new VoxelQuadSelection(voxel, quadIndex));
    },
    "set_variable": (action) => // Works something out and sets it aside under a name, for the steps that follow to build their own parameters from (see SinglePlayerManager).
    {
        SinglePlayerManager.setVariable(action.name, action.computeValue());
    },
    "set_camera_mode": (action) =>
    {
        cameraModeObservable.set(action.mode);
    },
    "orbit_camera_pose": (action) => // Asks the orbit camera to view its target from a chosen direction and distance, which the camera then glides to as it would to any other view (see orbitCameraViewRequestObservable). Lets a step set up the view it wants the user to begin from.
    {
        orbitCameraViewRequestObservable.set({
            azimuth: THREE.MathUtils.degToRad(action.azimuthDeg()),
            polar: THREE.MathUtils.degToRad(action.polarDeg()),
            zoomAmount: action.zoomAmount(),
        });
    },
    "orbit_camera_target_override": (action) => // Holds the orbit camera on a point of the step's choosing, whatever the user has selected meanwhile, until the override is cleared. Showing the user the thing he is being asked to pick out beats telling him where to look for it.
    {
        orbitCameraTargetOverrideObservable.set({
            x: action.targetX(),
            y: action.targetY(),
            z: action.targetZ(),
        });
    },
    "clear_orbit_camera_target_override": (action) => // Gives the orbit camera back to whatever is selected.
    {
        orbitCameraTargetOverrideObservable.set(null);
    },
    "remove_voxel_blocks": (action) =>
    {
        const room = App.getCurrentRoom();
        if (!room)
        {
            console.error("SinglePlayerActionMap :: Current room doesn't exits.");
            return;
        }
        ClientVoxelManager.removeVoxelBlocksByChunk(room,
            action.rowStart(), action.colStart(), action.numRows(), action.numCols(),
            action.collisionLayerMin(), action.collisionLayerMax(), false);
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
            action.metadataValue(), false);
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
            durationSeconds: action.durationSeconds(),
            positionOffset: action.positionOffset?.(),
            rotationOffset: action.rotationOffset?.(),
            scaleMultiplier: action.scaleMultiplier?.(),
            oscillations: action.oscillations?.(),
        });
    },
}

export default SinglePlayerActionMap;
