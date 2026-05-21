import ImageChooserProps from "./imageChooserProps";

type PopupState =
    | { popupType: "none" }
    | { popupType: "authPrompt" }
    | { popupType: "signOut" }
    | { popupType: "roomList" }
    | { popupType: "configureMyRoom" }
    | { popupType: "imageChooser"; params: ImageChooserProps };

export default PopupState;
