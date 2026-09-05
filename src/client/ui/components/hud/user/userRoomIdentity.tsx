import IconButton from "../../input/iconButton";
import PaletteIcon from "../../../svg/icons/paletteIcon";
import PowerIcon from "../../../svg/icons/powerIcon";
import User from "../../../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../../../shared/user/types/userType";
import PopupUtil from "../../../util/popupUtil";
import { useEffect, useState } from "react";
import { clientFeatureFlagsObservable } from "../../../../system/clientObservables";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import GameModeUtil from "../../../../system/util/gameModeUtil";
import ClientObjectManager from "../../../../object/clientObjectManager";

export default function UserRoomIdentity({
    user,
    onExitApp,
}: Props)
{
    const [canChangeGameMode, setCanChangeGameMode] = useState<boolean>(
        GameModeUtil.canChangeGameMode());
    const [hideIdentityLabels, setHideIdentityLabels] = useState<boolean>(
        clientFeatureFlagsObservable.has(FeatureFlag.HideUserIdentityLabels));

    const isGuest = user.userType === UserTypeEnumMap.Guest;

    // Each part of this bar can be taken away on its own, since the scripted single-player steps
    // hand the user one thing at a time: who he is is noise during a tutorial, while the button
    // that leaves the app must never be out of reach. The way into edit
    // mode is not taken away on its own terms, though — it stands or falls with whether that mode
    // may be entered at all (see GameModeUtil), so that a button on offer is always one that works.
    useEffect(() => {
        clientFeatureFlagsObservable.addElementListener("ui.userRoomIdentity",
            FeatureFlag.DisableGameModeTransition, (action) => setCanChangeGameMode(action != "add"));
        clientFeatureFlagsObservable.addElementListener("ui.userRoomIdentity",
            FeatureFlag.HideUserIdentityLabels, (action) => setHideIdentityLabels(action == "add"));
        return () => {
            clientFeatureFlagsObservable.removeElementListener("ui.userRoomIdentity",
                FeatureFlag.DisableGameModeTransition);
            clientFeatureFlagsObservable.removeElementListener("ui.userRoomIdentity",
                FeatureFlag.HideUserIdentityLabels);
        };
    }, []);

    // Hung below the headline rather than at the very top, on the same terms as the game-mode menu
    // that replaces this bar while a mode is up: the headline carries the single-player tutorial's
    // instructions and takes the full width whenever it has something to say, so a bar in the top
    // row would be covered by the instruction that is telling the user to use it.
    return <div className="flex flex-row absolute right-0 top-(--yj-headline-height,0px) p-2 text-right rounded-bl-lg items-center justify-end gap-2 pointer-events-auto">
        {!hideIdentityLabels && <div className="flex flex-col items-end leading-tight px-1">
            <div className="text-sm yj-text-outline text-amber-300">{user.userName}</div>
        </div>}
        {canChangeGameMode && <IconButton id="editModeButton" icon={<PaletteIcon/>} size="sm" onClick={() => {
            // The mode opens on the user's own character, so there is no mode to open without one.
            const myPlayer = ClientObjectManager.getMyPlayer();
            if (!myPlayer)
                return;
            GameModeUtil.enterEditMode(myPlayer);
        }}/>}
        <IconButton icon={<PowerIcon/>} size="sm" onClick={() => {
            // A guest has no account to go anywhere else with, so the only thing worth asking is
            // whether they meant to leave at all. Everyone else is offered the fuller prompt, where
            // leaving is one answer and coming back as somebody else is the other.
            if (isGuest)
            {
                PopupUtil.openPopup({popupType: "confirm", params: {
                    message: "Exit this app?",
                    onConfirm: () => {
                        PopupUtil.closePopup();
                        onExitApp();
                    },
                    onCancel: PopupUtil.closePopup,
                }});
            }
            else
            {
                PopupUtil.openPopup({popupType: "exitPrompt"});
            }
        }}/>
    </div>;
}

interface Props
{
    user: User;
    onExitApp: () => void;
}
