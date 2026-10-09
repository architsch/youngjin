import { useEffect, useRef } from "react";
import { notificationMessageObservable } from "../../system/clientObservables";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import ClientEventHistoryUtil from "../../system/util/clientEventHistoryUtil";
import GameModeUtil from "../../system/util/gameModeUtil";
import GizmoDragUtil from "../../graphics/util/gizmoDragUtil";
import KeyPressUtil from "./keyPressUtil";

// In edit mode, has Ctrl+Z undo the latest thing the user did there (an edit of the room, a selection), and Ctrl+Y
// or Ctrl+Shift+Z redo the one last undone (see KeyPressUtil.getHistoryStep, ClientEventHistoryUtil). The caller
// says whether a popup is open.
export default function useUndoRedoKeyListener(popupOpen: boolean): void
{
    // Ref, so a new value each render doesn't rebuild the effect.
    const popupOpenRef = useRef(popupOpen);
    popupOpenRef.current = popupOpen;

    useEffect(() => {
        const onKeyDown = async (ev: KeyboardEvent) => {
            const step = KeyPressUtil.getHistoryStep(ev);
            if (step == undefined || !reachesRoom(popupOpenRef.current))
                return;
            ev.preventDefault();
            const result = await ((step == "undo") ? ClientEventHistoryUtil.undo() : ClientEventHistoryUtil.redo());
            if (result == "refused")
            {
                notificationMessageObservable.set(
                    `That edit can no longer be ${(step == "undo") ? "undone" : "redone"}.`);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, []);
}

function reachesRoom(popupOpen: boolean): boolean
{
    // Not behind a popup or the loading indicator, nor from under a drag of the selection, which has edits of its
    // own under way. In a text field the keys are the field's own, for its text.
    return GameModeUtil.isInEditMode() && !popupOpen && !ongoingClientProcessExists()
        && !GizmoDragUtil.isActive() && !KeyPressUtil.isTyping();
}
