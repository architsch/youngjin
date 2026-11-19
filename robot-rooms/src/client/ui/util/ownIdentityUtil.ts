import ClientObjectManager from "../../object/clientObjectManager";
import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import GameModeUtil from "../../system/util/gameModeUtil";
import { objectSelectionObservable } from "../../system/clientObservables";

// The user's identity shows with their own character's tools (see PlayerEditOptions): in edit mode, their character
// selected, however it came to be. The top bar's person button is lit exactly then, and opens and closes it.
const OwnIdentityUtil =
{
    isShown: (): boolean =>
    {
        const myPlayer = ClientObjectManager.getMyPlayer();
        return myPlayer != undefined && GameModeUtil.isInEditMode()
            && objectSelectionObservable.peek()?.gameObject === myPlayer;
    },
    // Closing it leaves edit mode. Opening it enters edit mode on the user's own character (no line of sight is cast,
    // so the mode opens on it; see GameModeUtil.enterEditMode), or selects it in edit mode already open.
    toggle: (): void =>
    {
        if (OwnIdentityUtil.isShown())
        {
            GameModeUtil.exitEditMode();
            return;
        }
        const myPlayer = ClientObjectManager.getMyPlayer();
        if (myPlayer == undefined)
            return;
        if (GameModeUtil.isInEditMode())
            ObjectSelection.trySelect(myPlayer, true);
        else
            GameModeUtil.enterEditMode(myPlayer);
    },
}

export default OwnIdentityUtil;
