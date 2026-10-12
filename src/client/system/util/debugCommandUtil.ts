import App from "../../app";
import ClientObjectManager from "../../object/clientObjectManager";
import { notificationMessageObservable, volumesShownObservable } from "../clientObservables";
import { colliderDebugEnabledObservable, dummyImagesDebugEnabledObservable,
    roomListDebugEnabledObservable } from "../../../shared/system/sharedObservables";
import UserAPIClient from "../../networking/client/userAPIClient";
import PopupUtil from "../../ui/util/popupUtil";
import GraphicsManager from "../../graphics/graphicsManager";
import SocketsClient from "../../networking/client/socketsClient";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import ParticleDebugUtil from "../../graphics/particle/util/particleDebugUtil";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import RoomEditorUtil from "../../singlePlayer/util/roomEditorUtil";

// The debug panel's commands (see DebugStats), each run by the text typed for it.
const DebugCommandUtil =
{
    // Runs what was typed, whatever its case, or says that it is no command.
    run: (input: string): void =>
    {
        const command = input.toLowerCase().trim();
        switch (command)
        {
            case "show collider": colliderDebugEnabledObservable.set(true); break;
            case "hide collider": colliderDebugEnabledObservable.set(false); break;
            case "show dummy-rooms": roomListDebugEnabledObservable.set(true); break;
            case "hide dummy-rooms": roomListDebugEnabledObservable.set(false); break;
            case "show dummy-images": dummyImagesDebugEnabledObservable.set(true); break;
            case "hide dummy-images": dummyImagesDebugEnabledObservable.set(false); break;
            case "restart tutorial": void restartTutorial(); break;
            // Temporary sign-in entry point until the app has a proper place for it.
            case "login**": PopupUtil.openPopup({popupType: "authPrompt"}); break;
            case "log": PopupUtil.openPopup({popupType: "consoleLog"}); break;
            case "lose context": setWebGLContextLost(true); break;
            case "restore context": setWebGLContextLost(false); break;
            case "ghost on": setGhostMode(true); break;
            case "ghost off": setGhostMode(false); break;
            case "volumes on": setVolumesShown(true); break;
            case "volumes off": setVolumesShown(false); break;
            case "aas": openAdminAssetSettingsEditor(); break;
            // Enters the room editor on a new empty room: a template, kept nowhere until it is
            // saved as a file (see RoomEditorUtil, LocalRoomFileUtil).
            case "new room template": RoomEditorUtil.openNewRoom(); break;
            default:
                notificationMessageObservable.set(
                    ParticleDebugUtil.tryRunCommand(command) ?? "Unknown debug command.");
                break;
        }
    },
}

// "restart tutorial" debug command. Only allowed when not in a single-player mode (also enforced
// server-side).
async function restartTutorial(): Promise<void>
{
    if (App.getUser().singlePlayerMode != "")
    {
        notificationMessageObservable.set("Cannot restart the tutorial while a single-player mode is in progress.");
        return;
    }
    // The server resets the tutorial state; reload to re-enter it.
    const response = await UserAPIClient.restartTutorial();
    if (response.status >= 200 && response.status < 300)
        window.location.reload();
    else
        notificationMessageObservable.set("Failed to restart the tutorial.");
}

// "lose context" / "restore context" debug commands for testing WebGL context recovery on a real
// device (see GraphicsManager). Staying lost exercises the reload fallback, which won't repeat within
// its cooldown.
function setWebGLContextLost(lost: boolean): void
{
    const loseContextExtension = GraphicsManager.getGameRenderer()
        .getContext().getExtension("WEBGL_lose_context");
    if (loseContextExtension == null)
    {
        notificationMessageObservable.set("This browser cannot simulate WebGL context loss.");
        return;
    }
    if (lost)
        loseContextExtension.loseContext();
    else
        loseContextExtension.restoreContext();
}

// "ghost on" / "ghost off" debug commands. Admin-only (also enforced server-side), and kept in the
// player's AdminPrefs, which the server saves with the rest of its metadata. A single-player room has
// no server to keep it.
function setGhostMode(ghostMode: boolean): void
{
    const room = App.getCurrentRoom();
    const myPlayer = ClientObjectManager.getMyPlayer();
    if (!room || !myPlayer || room.roomType == RoomTypeEnumMap.SinglePlayer)
    {
        notificationMessageObservable.set("Ghost mode can only be changed in a multiplayer room.");
        return;
    }

    const prefs = AdminPrefsUtil.getObjectPrefs(myPlayer.params);
    prefs.ghostMode = ghostMode;
    const key = ObjectMetadataKeyEnumMap.AdminPrefs;
    const value = AdminPrefsUtil.encode(prefs);
    if (!ClientObjectManager.setObjectMetadata(myPlayer.params.objectId, key, value))
    {
        notificationMessageObservable.set("Only an admin can use ghost mode.");
        return;
    }
    SocketsClient.emitSetObjectMetadataSignal(
        new SetObjectMetadataSignal(room.id, myPlayer.params.objectId, key, value));
    notificationMessageObservable.set(ghostMode ? "Ghost mode is on." : "Ghost mode is off.");
}

// "volumes on" / "volumes off" debug commands: whether the room's volumes show in edit mode, along with the tools
// that add and edit one, to whoever may edit them (see VolumeGameObject). Off until asked for, in every room.
function setVolumesShown(shown: boolean): void
{
    volumesShownObservable.set(shown);
    notificationMessageObservable.set(shown ? "Volumes are on." : "Volumes are off.");
}

// "aas" debug command (admin asset settings). Admin-only: opens the window those settings are set, saved and
// loaded in (see AdminAssetSettingsEditor).
function openAdminAssetSettingsEditor(): void
{
    if (!RoomValidationUtil.userIsAdmin(App.getUser()))
    {
        notificationMessageObservable.set("Only an admin can edit the admin asset settings.");
        return;
    }
    PopupUtil.openPopup({popupType: "adminAssetSettings"});
}

export default DebugCommandUtil;
