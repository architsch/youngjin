import ConfirmProps from "./confirmProps";
import DoorDestinationProps from "./doorDestinationProps";
import DoorSettingsProps from "./doorSettingsProps";
import ImageChooserProps from "./imageChooserProps";

type PopupState =
    | { popupType: "none" }
    | { popupType: "authPrompt" }
    | { popupType: "confirm", params: ConfirmProps }
    | { popupType: "exitPrompt" }
    | { popupType: "myRoomWelcome" }
    | { popupType: "hubRoomWelcome" }
    | { popupType: "imageChooser"; params: ImageChooserProps }
    | { popupType: "doorDestination"; params: DoorDestinationProps }
    | { popupType: "doorSettings"; params: DoorSettingsProps }
    | { popupType: "consoleLog" }

export default PopupState;
