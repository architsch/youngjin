import { useEffect, useRef } from "react";
import { numActiveInputElementsObservable } from "../../system/clientObservables";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import GameModeUtil from "../../system/util/gameModeUtil";
import SelectionStepUtil from "../../graphics/util/selectionStepUtil";
import KeyPressUtil from "./keyPressUtil";

// In edit mode, has each press of a movement key move the selection the way the key points (see SelectionStepUtil).
// The caller says whether a popup is open.
export default function useSelectionStepKeyListener(popupOpen: boolean): void
{
    // Ref, so a new value each render doesn't rebuild the effect.
    const popupOpenRef = useRef(popupOpen);
    popupOpenRef.current = popupOpen;

    useEffect(() => {
        const onKeyDown = (ev: KeyboardEvent) => {
            const direction = KeyPressUtil.getDirection(ev);
            if (direction == undefined || !KeyPressUtil.isPlain(ev) || !reachesSelection(popupOpenRef.current))
                return;
            ev.preventDefault();
            SelectionStepUtil.tryStep(direction);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, []);
}

function reachesSelection(popupOpen: boolean): boolean
{
    // Not behind a popup or the loading indicator, and a focused input takes the keys for itself (a slider is
    // moved by the arrows).
    return GameModeUtil.isInEditMode() && !popupOpen && !ongoingClientProcessExists()
        && numActiveInputElementsObservable.peek() == 0;
}
