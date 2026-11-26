import App from "../../app";
import ClientObjectManager from "../../object/clientObjectManager";
import { notificationMessageObservable, petDrawnWidthsObservable, volumesShownObservable } from "../clientObservables";
import { colliderDebugEnabledObservable, dummyImagesDebugEnabledObservable,
    roomListDebugEnabledObservable } from "../../../shared/system/sharedObservables";
import UserAPIClient from "../../networking/client/userAPIClient";
import PopupUtil from "../../ui/util/popupUtil";
import GraphicsManager from "../../graphics/graphicsManager";
import SocketsClient from "../../networking/client/socketsClient";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import UserCommandSignal from "../../../shared/user/types/userCommandSignal";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import AdminPrefsUtil from "../../../shared/object/util/adminPrefsUtil";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import ParticleDebugUtil from "../../graphics/particle/util/particleDebugUtil";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import { CHEAT_DOLLARS } from "../../../shared/system/sharedConstants";
import RoomEditorUtil from "../../singlePlayer/util/roomEditorUtil";
import ClientInventoryManager from "../../inventory/clientInventoryManager";
import PetDriverUtil from "../../object/util/petDriverUtil";
import PetNeeds from "../../../shared/object/types/petNeeds";
import PetIdentityUtil from "../../../shared/object/util/petIdentityUtil";
import PetOwnerUtil from "../../../shared/object/util/petOwnerUtil";
import EncodableRaw4ByteNumber from "../../../shared/networking/types/encodableRaw4ByteNumber";

// The cheat code: "rosebud", or "rosebud N" for N times its dollars.
const CHEAT_COMMAND_PATTERN = /^rosebud(?:\s+(\d+))?$/;
// "pets H B [A [R [F]]]": the user's pets in the room are at once at H percent of their health and B percent of their
// battery, and, where given, at A percent of their anger, R of their horror and F of their fatigue.
const PET_NEEDS_COMMAND_PATTERN = /^pets\s+(\d+)\s+(\d+)(?:\s+(\d+))?(?:\s+(\d+))?(?:\s+(\d+))?$/;
const PET_NEED_NAMES: (keyof PetNeeds)[] = ["health", "energy", "anger", "horror", "fatigue"];
// "petscale NAME P": the pets of that name, whatever its case, are drawn P percent as wide from side to side, held to
// this range (see petDrawnWidthsObservable).
const PET_WIDTH_COMMAND_PATTERN = /^petscale\s+(.+?)\s+(\d+(?:\.\d+)?)$/;
const PET_WIDTH_PERCENT_RANGE = [1, 1000];

// The debug panel's commands (see DebugStats), each run by the text typed for it.
const DebugCommandUtil =
{
    // Runs what was typed, whatever its case, or says that it is no command.
    run: (input: string): void =>
    {
        const command = input.toLowerCase().trim();
        // The cheat code is a dev server's alone: anywhere else, no command at all.
        const cheatMultiplier = getCheatMultiplier(command);
        if (cheatMultiplier != undefined && App.getEnv().mode == "dev")
        {
            grantCheatDollars(cheatMultiplier);
            return;
        }
        // Likewise a dev server's alone: what a pet's health and battery are is its user's browser's to tell.
        const petNeeds = PET_NEEDS_COMMAND_PATTERN.exec(command);
        if (petNeeds != null && App.getEnv().mode == "dev")
        {
            const needs: Partial<PetNeeds> = {};
            petNeeds.slice(1).forEach((percent, i) => {
                if (percent != undefined)
                    needs[PET_NEED_NAMES[i]] = Math.min(100, Number(percent)) / 100;
            });
            const numPets = PetDriverUtil.setNeeds(needs);
            notificationMessageObservable.set(`Pets: ${numPets} set to ` + Object.entries(needs)
                .map(([name, share]) => `${name} ${Math.round(100 * share)}%`).join(", ") + ".");
            return;
        }
        // Anywhere: it changes only what this browser draws.
        const petWidth = PET_WIDTH_COMMAND_PATTERN.exec(command);
        if (petWidth != null)
        {
            setPetWidth(PetIdentityUtil.sanitizeName(petWidth[1]), Number(petWidth[2]));
            return;
        }
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
            case "fast_forward_daily_reward_clock": fastForwardDailyRewardClock(); break;
            default: tellUnknown(command); break;
        }
    },
}

function tellUnknown(command: string): void
{
    notificationMessageObservable.set(ParticleDebugUtil.tryRunCommand(command) ?? "Unknown debug command.");
}

// N in "rosebud N", 1 for a bare "rosebud", undefined for anything else, N being a whole number from 1 up.
function getCheatMultiplier(command: string): number | undefined
{
    const match = CHEAT_COMMAND_PATTERN.exec(command);
    if (!match)
        return undefined;
    const multiplier = (match[1] == undefined) ? 1 : Number(match[1]);
    return (multiplier >= 1) ? multiplier : undefined;
}

// "rosebud" debug command: dollars for testing what they buy (also enforced server-side), never more than the count can
// be sent with (see InventorySignal).
function grantCheatDollars(multiplier: number): void
{
    const dollars = multiplier * CHEAT_DOLLARS;
    if (ClientInventoryManager.getDollarsShown() + dollars > EncodableRaw4ByteNumber.MAX_VALUE)
    {
        notificationMessageObservable.set("Rosebud: more dollars than the count can hold.");
        return;
    }
    SocketsClient.emitUserCommandSignal(new UserCommandSignal(`grantCheatDollars ${multiplier}`));
    notificationMessageObservable.set(`Rosebud: +$${dollars}.`);
}

// "petscale" debug command: kept by the name, for pets of it that come in later too.
function setPetWidth(name: string, percent: number): void
{
    const shown = Math.min(PET_WIDTH_PERCENT_RANGE[1], Math.max(PET_WIDTH_PERCENT_RANGE[0], percent));
    petDrawnWidthsObservable.set({...petDrawnWidthsObservable.peek(), [name]: shown / 100});
    const room = App.getCurrentRoom();
    const numPets = (room == undefined) ? 0 : Object.values(room.objectById).filter(obj =>
        PetOwnerUtil.isPet(obj) && PetIdentityUtil.getObjectIdentity(obj).name.toLowerCase() == name).length;
    notificationMessageObservable.set(`Petscale: ${name} drawn ${shown}% as wide (${numPets} in the room).`);
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

// "fast_forward_daily_reward_clock" debug command. Admin-only (also enforced server-side): makes the daily reward due, for
// the next page load to bring.
function fastForwardDailyRewardClock(): void
{
    if (!RoomValidationUtil.userIsAdmin(App.getUser()))
    {
        notificationMessageObservable.set("Only an admin can fast-forward the daily reward clock.");
        return;
    }
    SocketsClient.emitUserCommandSignal(new UserCommandSignal("fastForwardDailyRewardClock"));
    notificationMessageObservable.set("The daily reward is due: reload the page.");
}

export default DebugCommandUtil;
