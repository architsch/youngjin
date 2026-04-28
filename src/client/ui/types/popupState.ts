import ImageChooserProps from "./imageChooserProps";

type PopupState =
    | { popupType: "authPrompt" }
    | { popupType: "signOut" }
    | { popupType: "rooms" }
    | { popupType: "configureMyRoom" }
    | { popupType: "imageChooser"; params: ImageChooserProps };

export default PopupState;
