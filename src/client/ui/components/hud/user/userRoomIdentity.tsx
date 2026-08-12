import IconButton from "../../input/iconButton";
import GearIcon from "../../../svg/icons/gearIcon";
import PaletteIcon from "../../../svg/icons/paletteIcon";
import PowerIcon from "../../../svg/icons/powerIcon";
import User from "../../../../../shared/user/types/user";
import { UserRole, UserRoleEnumMap } from "../../../../../shared/user/types/userRole";
import { UserTypeEnumMap } from "../../../../../shared/user/types/userType";
import PopupUtil from "../../../util/popupUtil";
import { useEffect, useState } from "react";
import { MINUTE_IN_MS } from "../../../../../shared/system/sharedConstants";
import { clientFeatureFlagsObservable } from "../../../../system/clientObservables";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";
import GameModeUtil from "../../../../system/util/gameModeUtil";
import ClientObjectManager from "../../../../object/clientObjectManager";
import FTUEUtil from "../../../util/ftueUtil";
import { FTUEElementCodeEnumMap } from "../../../types/ftueElementCode";

export default function UserRoomIdentity({
    user,
    userRole,
    currentRoomID,
    canModifyRoom,
    onExitApp,
}: Props)
{
    const [hideEditModeButton, setHideEditModeButton] = useState<boolean>(
        clientFeatureFlagsObservable.has(FeatureFlag.HideEditModeButton));
    const [hideIdentityLabels, setHideIdentityLabels] = useState<boolean>(
        clientFeatureFlagsObservable.has(FeatureFlag.HideUserIdentityLabels));

    const isGuest = user.userType === UserTypeEnumMap.Guest;
    const isInOwnRoom = user.ownedRoomID.length > 0 && user.ownedRoomID === currentRoomID;
    const showConfigureButton = !isGuest && isInOwnRoom;
    // Editing is the one thing here that is not the user's to do everywhere: in a room he is only
    // visiting there is nothing for the mode to offer, so the way into it is not held out to him.
    const showEditModeButton = canModifyRoom && !hideEditModeButton;

    const roleName = userRole === UserRoleEnumMap.Owner ? "Owner"
        : userRole === UserRoleEnumMap.Editor ? "Editor"
        : "Visitor";

    // Each part of this bar can be taken away on its own, since the scripted single-player steps
    // hand the user one thing at a time: who he is and what he may do here is noise during a
    // tutorial, while the button that leaves the app must never be out of reach.
    useEffect(() => {
        clientFeatureFlagsObservable.addElementListener("ui.userRoomIdentity",
            FeatureFlag.HideEditModeButton, (action) => setHideEditModeButton(action == "add"));
        clientFeatureFlagsObservable.addElementListener("ui.userRoomIdentity",
            FeatureFlag.HideUserIdentityLabels, (action) => setHideIdentityLabels(action == "add"));
        return () => {
            clientFeatureFlagsObservable.removeElementListener("ui.userRoomIdentity",
                FeatureFlag.HideEditModeButton);
            clientFeatureFlagsObservable.removeElementListener("ui.userRoomIdentity",
                FeatureFlag.HideUserIdentityLabels);
        };
    }, []);

    // The mark below keeps to the button it points at: it is scheduled while that button is on
    // offer, and taken back down once it is not. A mark is not taken off the list merely by its
    // target leaving the screen, so one left behind by a button that has gone would return the
    // moment the button did — skipping the wait that is supposed to earn it — which is why the
    // condition that puts it up is also the one that clears it away.
    useEffect(() => {
        if (!showConfigureButton || FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.MyRoomSettings))
            return;

        // For any member-type user who stays in his/her own room for 2 minutes straight,
        // we will show a coach mark for the "Configure" button if the user hasn't clicked it before.
        const timeout = setTimeout(() => {
            FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.MyRoomSettings,
                "configureMyRoomButton", "View your room's settings here.");
        }, 2 * MINUTE_IN_MS);

        return () => {
            clearTimeout(timeout);
            FTUEUtil.hideCoachMark(FTUEElementCodeEnumMap.MyRoomSettings);
        };
    }, [showConfigureButton]);

    return <div className="flex flex-row absolute right-0 top-0 p-2 text-right rounded-bl-lg items-center justify-end gap-2 pointer-events-auto">
        {!hideIdentityLabels && <div className="flex flex-col items-end leading-tight px-1">
            <div className="text-sm yj-text-outline text-amber-300">{user.userName}</div>
            <div className="text-xs yj-text-outline text-gray-400">({roleName})</div>
        </div>}
        {showConfigureButton && <IconButton id="configureMyRoomButton" icon={<GearIcon/>} size="sm" onClick={() => {
            PopupUtil.openPopup({popupType: "configureMyRoom"});
            FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.MyRoomSettings);
        }}/>}
        {showEditModeButton && <IconButton id="editModeButton" icon={<PaletteIcon/>} size="sm" onClick={() => {
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
    userRole: UserRole;
    currentRoomID: string;
    // Whether the user may edit the room he is currently in, which is what edit mode is for.
    canModifyRoom: boolean;
    onExitApp: () => void;
}
