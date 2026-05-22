import ConfirmProps from "./confirmProps";
import ImageChooserProps from "./imageChooserProps";

type PopupState =
    | { popupType: "none" }
    | { popupType: "authPrompt" }
    | { popupType: "confirm", params: ConfirmProps }
    | { popupType: "roomList" }
    | { popupType: "configureMyRoom" }
    | { popupType: "imageChooser"; params: ImageChooserProps }

export default PopupState;
