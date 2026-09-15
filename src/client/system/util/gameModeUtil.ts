import GameMode from "../types/gameMode";
import GameObject from "../../object/types/gameObject";
import ObjectHit from "../../graphics/types/objectHit";
import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import RoomRuntimeMemory from "../../../shared/room/types/roomRuntimeMemory";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import { clientFeatureFlagsObservable, editModeOpeningOverrideObservable, gameModeObservable,
    roomChangedObservable } from "../clientObservables";
import { FeatureFlag } from "../../../shared/system/types/featureFlag";
import { EDIT_MODE_OPENING_REACH, EDIT_MODE_OPENING_TILT } from "../clientConstants";

// Owns the current game mode (see @docs/gameplay/game_mode.md). Followers watch gameModeObservable.
// Edit mode is entered only via the top-bar switch (opening on what the camera faces) and left via the
// switch or the back gesture. It's open to everyone; permissions are checked per edit. Every crossing
// checks canChangeGameMode, since the back gesture bypasses the switch.

const GameModeUtil =
{
    getGameMode: (): GameMode =>
    {
        return gameModeObservable.peek();
    },

    isInEditMode: (): boolean =>
    {
        return gameModeObservable.peek() == "edit";
    },

    // False while a scripted step locks the mode (enforced here so Escape can't bypass it).
    canChangeGameMode: (): boolean =>
    {
        return !clientFeatureFlagsObservable.has(FeatureFlag.DisableGameModeTransition);
    },

    // Enters edit mode on what a scripted step picks, else on the voxel quad or object the camera faces
    // within reach, else on what it faces looking toward the ground, else on the user's own character.
    // The cast is passed in: casting here would import a cycle through GameObject (see
    // CameraUtil.getObjectsAlongLineOfSight).
    enterEditMode: (myPlayer: GameObject,
        castLineOfSight: (maxDistance: number, pitchDownAngle: number) => ObjectHit[] = () => []): void =>
    {
        if (!GameModeUtil.canChangeGameMode())
            return;

        gameModeObservable.set("edit");

        const scriptedOpening = editModeOpeningOverrideObservable.peek();
        if (scriptedOpening != null && scriptedOpening())
            return;
        if (WorldSpaceSelectionUtil.trySelectInLineOfSight(castLineOfSight(EDIT_MODE_OPENING_REACH, 0)) ||
            WorldSpaceSelectionUtil.trySelectInLineOfSight(
                castLineOfSight(EDIT_MODE_OPENING_REACH, EDIT_MODE_OPENING_TILT)))
        {
            return;
        }
        // Forced past scripted locks, since the mode always opens with something selected.
        ObjectSelection.trySelect(myPlayer, true);
    },

    // Leaving drops the selection, even one pinned by a step (the pin only matters inside the mode).
    exitEditMode: (): void =>
    {
        if (!GameModeUtil.canChangeGameMode())
            return;

        WorldSpaceSelectionUtil.unselectAll(true);
        gameModeObservable.set("play");
    },
}

// Every room arrival starts in play mode.
roomChangedObservable.addListener("gameMode", (_roomRuntimeMemory: RoomRuntimeMemory) => {
    gameModeObservable.set("play");
});

export default GameModeUtil;
