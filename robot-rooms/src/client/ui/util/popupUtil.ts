import { popupStateObservable } from "../../system/clientObservables";
import PopupState from "../types/popupState";

const PopupUtil =
{
    openPopup: (state: PopupState) =>
    {
        popupStateObservable.set(state);
    },
    closePopup: () =>
    {
        popupStateObservable.set({popupType: "none"});
    },
}

export default PopupUtil;