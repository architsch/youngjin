import * as THREE from "three";
import App from "../../app";
import VoxelQuadSelection from "../../graphics/types/gizmo/voxelQuadSelection";
import ClientObjectManager from "../../object/clientObjectManager";
import EasingMotion from "../../object/components/easingMotion";
import { cameraModeObservable, clientFeatureFlagsObservable, downwardArrowTargetObservable, editModeOpeningOverrideObservable, headlineMessageObservable, myPlayerHiddenObservable, navigationArrowTargetObservable, orbitCameraDistanceRangeRequestObservable, orbitCameraTargetOverrideObservable, orbitCameraViewRequestObservable, screenArrowTargetObservable, screenDiagramObservable, screenOutlineCapsuleTargetObservable, screenOutlineRectTargetObservable, voxelQuadHighlightObservable, voxelQuadSelectionObservable, voxelQuadSelectionRestrictionObservable } from "../../system/clientObservables";
import ClientVoxelManager from "../../voxel/clientVoxelManager";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import SinglePlayerManager from "../singlePlayerManager";
import SinglePlayerAction from "../types/singlePlayerAction";

// Handlers act directly on client state; parameters are evaluated here (see SinglePlayerParam).
const SinglePlayerActionMap: {
    [K in SinglePlayerAction["type"]]: (action: Extract<SinglePlayerAction, {type: K}>) => void;
} =
{
    "clear_all_ui_and_gizmo": (action) => // This action clears out all the UI and Gizmo elements which were created via SinglePlayerActions.
    {
        headlineMessageObservable.set(null);
        screenArrowTargetObservable.set(null);
        screenOutlineRectTargetObservable.set(null);
        screenOutlineCapsuleTargetObservable.set(null);
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
    "ui_arrow": (action) => // A React-based 2D arrow which points at the target, while pulsating to grab the user's attention. It hangs above the target by default, and below it (pointing up) for a target too near the top of the screen to have room above it. A target inside a scrollable list is scrolled into view (see useTrackedElementRect).
    {
        screenArrowTargetObservable.set({targetElementId: action.targetElementId(),
            arrowBias: action.arrowBias, arrowSide: action.arrowSide ?? "above"});
    },
    "ui_outline_rect": (action) => // A React-based 2D rectangular outline which surrounds the target UI element for the purpose of highlighting.
    {
        screenOutlineRectTargetObservable.set(action.targetElementId());
    },
    "ui_outline_capsule": (action) => // A React-based 2D capsule-shaped outline which surrounds a pill-shaped target UI element (such as a switch's track) for the purpose of highlighting. Its line is as thick as the step asks for, since a control of that shape tends to be too small for the rectangular outline's heavy line.
    {
        screenOutlineCapsuleTargetObservable.set({targetElementId: action.targetElementId(),
            thicknessPx: action.thicknessPx()});
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
    "gizmo_voxel_quad_outline_rect": (action) => // A 3D world-space rectangular outline (i.e. gizmo) which highlights the boundary of a voxel-quad. Its brightness keeps oscillating in order to grab the user's attention. It hides itself, and the downward arrow with it, whenever the quad is out of the camera's sight (see GenericWorldSpaceGizmos).
    {
        const selection = resolveVoxelQuad(action.quadIndex());
        if (selection)
            voxelQuadHighlightObservable.set(selection);
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
        selectVoxelQuad(action.quadIndex());
    },
    "restrict_voxel_quad_selection": (action) => // Leaves the user just one quad of the room to select, so a step can ask for that one and refuse the rest. Narrower than the selection lock, which refuses every quad; the step lifts that lock alongside this (see voxelQuadSelectionRestrictionObservable).
    {
        voxelQuadSelectionRestrictionObservable.set(action.quadIndex());
    },
    "clear_voxel_quad_selection_restriction": (action) => // Gives the rest of the room back.
    {
        voxelQuadSelectionRestrictionObservable.set(null);
    },
    "edit_mode_opening_voxel_quad": (action) => // Makes edit mode open on a quad of the step's choosing instead of what the camera faces, until cleared. The quad is picked as the mode opens rather than now, since the user may still walk until then, and it is selected the way "select_voxel_quad" selects one.
    {
        editModeOpeningOverrideObservable.set(() => selectVoxelQuad(action.quadIndex()));
    },
    "clear_edit_mode_opening_voxel_quad": (action) => // Gives edit mode back its usual opening (see GameModeUtil.enterEditMode).
    {
        editModeOpeningOverrideObservable.set(null);
    },
    "set_variable": (action) => // Works something out and sets it aside under a name, for the steps that follow to build their own parameters from (see SinglePlayerManager).
    {
        SinglePlayerManager.setVariable(action.name, action.computeValue());
    },
    "set_my_player_hidden": (action) => // Hides the user's own character and its speech bubble whatever the camera does, letting raycasts through it, or shows it again (see myPlayerHiddenObservable).
    {
        myPlayerHiddenObservable.set(action.hidden);
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
    "orbit_camera_distance_range": (action) => // Zooms the orbit camera just enough to hold it within a range of distances from its target, keeping its angles (see orbitCameraDistanceRangeRequestObservable).
    {
        orbitCameraDistanceRangeRequestObservable.set({min: action.minDistance(), max: action.maxDistance()});
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

// The voxel a drawn quad belongs to, paired with the quad, or null if the room holds no such quad.
function resolveVoxelQuad(quadIndex: number): VoxelQuadSelection | null
{
    const room = App.getCurrentRoom();
    if (!room)
    {
        console.error("SinglePlayerActionMap :: Current room doesn't exits.");
        return null;
    }
    if (!VoxelQueryUtil.isValidVoxelQuadIndex(quadIndex))
    {
        console.error(`SinglePlayerActionMap :: Invalid voxel-quad index (quadIndex = ${quadIndex})`);
        return null;
    }
    const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
    const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
    const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
    if (!voxel)
    {
        console.error(`SinglePlayerActionMap :: Voxel doesn't exist (row = ${row}, col = ${col})`);
        return null;
    }
    if ((voxel.quadsMem.quads[quadIndex] & 0b10000000) == 0)
    {
        // An invisible quad can't be acted on or pointed at.
        console.error(`SinglePlayerActionMap :: Voxel-quad is not visible (row = ${row}, col = ${col})`);
        return null;
    }
    return new VoxelQuadSelection(voxel, quadIndex);
}

// Selects a visible quad, past any selection lock (see "select_voxel_quad"). Returns whether it did.
function selectVoxelQuad(quadIndex: number): boolean
{
    const selection = resolveVoxelQuad(quadIndex);
    if (!selection)
        return false; // The current selection is left alone.
    voxelQuadSelectionObservable.set(selection);
    return true;
}

export default SinglePlayerActionMap;
