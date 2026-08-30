import ConfirmProps from "./confirmProps";
import DoorDestinationProps from "./doorDestinationProps";
import DoorSettingsProps from "./doorSettingsProps";
import ImageChooserProps from "./imageChooserProps";
import ObjectLabelProps from "./objectLabelProps";

type PopupState =
    | { popupType: "none" }
    | { popupType: "authPrompt" }
    | { popupType: "confirm", params: ConfirmProps }
    | { popupType: "exitPrompt" }
    | { popupType: "configureMyRoom" }
    | { popupType: "configureHubRoom" }
    | { popupType: "myRoomWelcome" }
    | { popupType: "hubRoomWelcome" }
    | { popupType: "imageChooser"; params: ImageChooserProps }
    | { popupType: "objectLabel"; params: ObjectLabelProps }
    | { popupType: "doorDestination"; params: DoorDestinationProps }
    | { popupType: "doorSettings"; params: DoorSettingsProps }
    | { popupType: "consoleLog" }

export default PopupState;
