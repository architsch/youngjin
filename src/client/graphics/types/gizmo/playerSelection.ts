import * as THREE from "three";
import GameObject from "../../../object/types/gameObject";
import { clientFeatureFlagsObservable, playerSelectionObservable, playerViewTargetPosObservable,
    roomChangedObservable, updateObservable } from "../../../system/clientObservables";
import GraphicsManager from "../../graphicsManager";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import WorldSpaceSelectionUtil from "../../util/worldSpaceSelectionUtil";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";
import { PLAYER_HEIGHT } from "../../../../shared/system/sharedConstants";
import WorldSpaceOutlineArrow from "./generic/worldSpaceOutlineArrow";

// How high above the character's head the indicator's tip floats, and how large the arrow is drawn.
const INDICATOR_GAP = 0.275;
const INDICATOR_SCALE = 0.6;

const cameraPosTemp = new THREE.Vector3();

// The user's own character, selected. It is a selection like any other — one of the three, only one
// of which is ever active — but the one that stands for "I am working on myself": it is what the
// player-customization form is shown for, and what the camera orbits while it is up.
export default class PlayerSelection
{
    gameObject: GameObject;

    constructor(gameObject: GameObject)
    {
        this.gameObject = gameObject;
    }

    static isSelected(): boolean
    {
        return playerSelectionObservable.peek() != null;
    }

    static trySelect(gameObject: GameObject): boolean
    {
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisablePlayerSelectionChange) ||
            clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange))
        {
            return false;
        }

        const existingSelection = playerSelectionObservable.peek();
        // Clicking the character again is not a way to drop it, as clicking a block or an object
        // again is (see VoxelQuadSelection.trySelect). The character is what edit mode opens on, so
        // this same call is what that opening goes through — and it must report the character
        // picked out whether or not it already was.
        if (existingSelection != null && existingSelection.gameObject === gameObject)
            return true;

        playerSelectionObservable.set(new PlayerSelection(gameObject));
        return true;
    }

    static unselect(force: boolean = false)
    {
        if (!force &&
            (clientFeatureFlagsObservable.has(FeatureFlag.DisablePlayerSelectionChange) ||
            clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange)))
        {
            return;
        }
        playerSelectionObservable.set(null);
    }
}

let selectionIndicator: WorldSpaceOutlineArrow | null = null;

playerSelectionObservable.addListener("playerSelection", (selection: PlayerSelection | null) => {
    if (selection)
    {
        // The character has no face of the room to lay an outline against, so it is marked from
        // above instead, by an arrow hanging over its head.
        if (selectionIndicator == null)
        {
            selectionIndicator = new WorldSpaceOutlineArrow("#00ff00", INDICATOR_SCALE);
            selectionIndicator.addToParent(GraphicsManager.getScene());
        }
        selectionIndicator.setVisible(true);

        WorldSpaceSelectionUtil.unselectOthers("player");

        // Nothing for the player to be made to look at: he is what is being looked at. Any target
        // left over from a selection just replaced would otherwise still be pulling his gaze once
        // the first-person view came back.
        playerViewTargetPosObservable.set(null);
    }
    else
    {
        selectionIndicator?.setVisible(false);
    }
});

updateObservable.addListener("playerSelection", (_deltaTime: number) => {
    const selection = playerSelectionObservable.peek();
    if (!selection || !selectionIndicator)
        return;

    const pos = selection.gameObject.position;
    selectionIndicator.setPosition(pos.x, pos.y + 0.5 * PLAYER_HEIGHT + INDICATOR_GAP, pos.z);
    GraphicsManager.getCamera().getWorldPosition(cameraPosTemp);
    selectionIndicator.faceViewer(cameraPosTemp);
});

// Whenever the current room changes,
// the existing selection (if there is one) should be discarded.
roomChangedObservable.addListener("playerSelection", (_roomRuntimeMemory: RoomRuntimeMemory) => {
    PlayerSelection.unselect(true);

    if (selectionIndicator)
    {
        selectionIndicator.dispose();
        selectionIndicator = null;
    }
});
