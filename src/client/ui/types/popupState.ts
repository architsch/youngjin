import ConfirmProps from "./confirmProps";
import DoorDestinationProps from "./doorDestinationProps";
import DoorSettingsProps from "./doorSettingsProps";
import ImageChooserProps from "./imageChooserProps";
import RoomFilePreviewProps from "./roomFilePreviewProps";

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
    | { popupType: "adminAssetSettings" }
    | { popupType: "roomFilePreview"; params: RoomFilePreviewProps }

export default PopupState;
