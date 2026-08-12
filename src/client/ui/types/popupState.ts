import ConfirmProps from "./confirmProps";
import ImageChooserProps from "./imageChooserProps";

type PopupState =
    | { popupType: "none" }
    | { popupType: "authPrompt" }
    | { popupType: "confirm", params: ConfirmProps }
    | { popupType: "exitPrompt" }
    | { popupType: "roomList" }
    | { popupType: "configureMyRoom" }
    | { popupType: "myRoomWelcome" }
    | { popupType: "hubRoomWelcome" }
    | { popupType: "imageChooser"; params: ImageChooserProps }
    | { popupType: "consoleLog" }

export default PopupState;
