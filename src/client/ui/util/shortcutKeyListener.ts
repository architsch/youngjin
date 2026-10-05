import { useEffect, useRef } from "react";
import PopupState from "../types/popupState";
import { ShortcutKey } from "../types/shortcutKey";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import ClosablePanelUtil from "./closablePanelUtil";
import KeyPressUtil from "./keyPressUtil";
import ShortcutKeyUtil from "./shortcutKeyUtil";

// Hands each press of a shortcut key to the control it stands for (see ShortcutKeyUtil), wherever a click could reach
// that control. The caller says which popup is on top, if any.
export default function useShortcutKeyListener(topPopupType: PopupState["popupType"] | undefined): void
{
    // Ref, so a new value each render doesn't rebuild the effect.
    const topPopupTypeRef = useRef(topPopupType);
    topPopupTypeRef.current = topPopupType;

    useEffect(() => {
        const onKeyDown = (ev: KeyboardEvent) => {
            const key = ShortcutKeyUtil.fromKeyDown(ev);
            if (key == undefined || !reachesControl(key, topPopupTypeRef.current))
                return;
            // The press is the control's alone (Enter would also send the chat's text, or click a focused button).
            ev.preventDefault();
            ev.stopPropagation();
            ShortcutKeyUtil.press(key);
        };
        // Capturing, so that the press can be kept from every other listener.
        window.addEventListener("keydown", onKeyDown, true);
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
        };
    }, []);
}

function reachesControl(key: ShortcutKey, topPopupType: PopupState["popupType"] | undefined): boolean
{
    // Nothing can be clicked behind the loading indicator.
    if (ongoingClientProcessExists())
        return false;
    // Enter is the popup on top's, if its form has a button for it.
    if (key == "Enter")
        return topPopupType != undefined && ENTER_POPUP_TYPES.includes(topPopupType);
    // The others are the HUD's: not under a popup, and not while a text field takes the key. Delete is the selection
    // tools', so not with a panel open over them either.
    return topPopupType == undefined && !KeyPressUtil.isTyping()
        && (key != "Delete" || !ClosablePanelUtil.hasOpenPanel());
}

// The popups whose forms have a button that Enter clicks.
const ENTER_POPUP_TYPES: PopupState["popupType"][] = ["confirm", "myRoomWelcome", "hubRoomWelcome"];
