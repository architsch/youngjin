import { InventoryItemTypeEnumMap } from "../../../shared/inventory/types/inventoryItemType";
import { UserTypeEnumMap } from "../../../shared/user/types/userType";
import App from "../../app";
import { inventoryGainObservable, loginRewardStageObservable, screenCoachMarksObservable } from "../../system/clientObservables";
import CoachMark from "../types/coachMark";
import PopupUtil from "./popupUtil";

const LISTENER_KEY = "signInPromptUtil";
// Long enough for the count's bounce to end (see dollar-gain), and to set this apart from a reward's mark just gone.
export const SHOW_DELAY_MS = 1400;

let gainedDollar = false;
let prompted = false;

// Asks a guest to sign in, now that they have something to lose: once in a page's life, as its first dollar reaches them,
// by a bill or a login's reward, whose mark goes first. It stays until they close it, signing in or not.
function tryPrompt(): void
{
    if (prompted || !gainedDollar || loginRewardStageObservable.peek() != "none"
        || App.getUser().userType != UserTypeEnumMap.Guest)
        return;

    prompted = true;
    setTimeout(show, SHOW_DELAY_MS);
}

function show(): void
{
    const coachMark: CoachMark = {
        targetElementId: "dollarCounter",
        text: "to save your progress",
        button: {label: "Sign In", onClick: () => PopupUtil.openPopup({popupType: "authPrompt"})},
        onDismiss: () => screenCoachMarksObservable.change(coachMarks => coachMarks.filter(mark => mark != coachMark)),
    };
    screenCoachMarksObservable.change(coachMarks => [...coachMarks, coachMark]);
}

// Registered on import (see app.ts).
inventoryGainObservable.addListener(LISTENER_KEY, itemType => {
    if (itemType == InventoryItemTypeEnumMap.Dollar)
    {
        gainedDollar = true;
        tryPrompt();
    }
});
loginRewardStageObservable.addListener(LISTENER_KEY, stage => {
    if (stage == "shown")
        gainedDollar = true;
    tryPrompt();
});
