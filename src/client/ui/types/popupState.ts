import ConfirmProps from "./confirmProps";
import ImageChooserProps from "./imageChooserProps";

type PopupState =
    | { popupType: "none" }
    | { popupType: "authPrompt" }
    | { popupType: "confirm", params: ConfirmProps }
    | { popupType: "roomList" }
    | { popupType: "configureMyRoom" }
    | { popupType: "myRoomWelcome" }
    | { popupType: "hubRoomWelcome" }
    | { popupType: "customizePlayer" }
    | { popupType: "imageChooser"; params: ImageChooserProps }
    | { popupType: "consoleLog" }

export default PopupState;
