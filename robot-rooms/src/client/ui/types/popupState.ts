import ConfirmProps from "./confirmProps";
import DoorDestinationProps from "./doorDestinationProps";
import DoorSettingsProps from "./doorSettingsProps";
import GeneratePetProps from "./generatePetProps";
import ImageChooserProps from "./imageChooserProps";
import RoomFilePreviewProps from "./roomFilePreviewProps";
import WebPageProps from "./webPageProps";

type PopupState =
    | { popupType: "none" }
    | { popupType: "authPrompt" }
    | { popupType: "confirm", params: ConfirmProps }
    | { popupType: "myRoomWelcome" }
    | { popupType: "hubRoomWelcome" }
    | { popupType: "imageChooser"; params: ImageChooserProps }
    | { popupType: "doorDestination"; params: DoorDestinationProps }
    | { popupType: "doorSettings"; params: DoorSettingsProps }
    | { popupType: "consoleLog" }
    | { popupType: "adminAssetSettings" }
    | { popupType: "roomFilePreview"; params: RoomFilePreviewProps }
    | { popupType: "webPage"; params: WebPageProps }
    | { popupType: "generatePet"; params: GeneratePetProps }

export default PopupState;
