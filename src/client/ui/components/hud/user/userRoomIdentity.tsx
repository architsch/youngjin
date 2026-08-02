import Button from "../../input/button";
import IconButton from "../../input/iconButton";
import GearIcon from "../../../svg/icons/gearIcon";
import PersonIcon from "../../../svg/icons/personIcon";
import User from "../../../../../shared/user/types/user";
import { UserRole, UserRoleEnumMap } from "../../../../../shared/user/types/userRole";
import { UserTypeEnumMap } from "../../../../../shared/user/types/userType";
import UserAPIClient from "../../../../networking/client/userAPIClient";
import PopupUtil from "../../../util/popupUtil";
import { useEffect } from "react";
import { MINUTE_IN_MS } from "../../../../../shared/system/sharedConstants";
import FTUEUtil from "../../../util/ftueUtil";
import { FTUEElementCodeEnumMap } from "../../../types/ftueElementCode";

export default function UserRoomIdentity({
    user,
    userRole,
    currentRoomID,
    isCustomizingPlayer,
}: Props)
{
    const isGuest = user.userType === UserTypeEnumMap.Guest;
    const isInOwnRoom = user.ownedRoomID.length > 0 && user.ownedRoomID === currentRoomID;
    const showConfigureButton = !isGuest && isInOwnRoom;

    const roleName = userRole === UserRoleEnumMap.Owner ? "Owner"
        : userRole === UserRoleEnumMap.Editor ? "Editor"
        : "Visitor";

    // Each mark below keeps to the button it points at: it is scheduled while that button is on
    // offer, and taken back down once it is not. A mark is not taken off the list merely by its
    // target leaving the screen, so one left behind by a button that has gone would return the
    // moment the button did — skipping the wait that is supposed to earn it — which is why every
    // condition that puts a mark up is also the one that clears it away.

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

    useEffect(() => {
        if (!isGuest || FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.Login))
            return;

        // For any guest-type user who stays in a room for 5 minutes straight,
        // we will show a coach mark for the "Login" button if the user hasn't clicked it before.
        const timeout = setTimeout(() => {
            FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.Login,
                "loginButton", "Login to create your own room.");
        }, 5 * MINUTE_IN_MS);

        return () => {
            clearTimeout(timeout);
            FTUEUtil.hideCoachMark(FTUEElementCodeEnumMap.Login);
        };
    }, [isGuest]);

    useEffect(() => {
        if (FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.CustomizePlayer))
            return;

        // The "Customize" button is there for every user, whichever room they are in, so this one
        // is only bound to the lifetime of the HUD it sits in.
        // For any user who stays in a room for 1 minute straight,
        // we will show a coach mark for the "Customize" button if the user hasn't clicked it before.
        const timeout = setTimeout(() => {
            FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.CustomizePlayer,
                "customizePlayerButton", "Customize your avatar.");
        }, MINUTE_IN_MS);

        return () => {
            clearTimeout(timeout);
            FTUEUtil.hideCoachMark(FTUEElementCodeEnumMap.CustomizePlayer);
        };
    }, []);

    return <div className="flex flex-col justify-end gap-1 absolute right-0 top-0 py-1 px-2 text-right rounded-bl-lg">
        <div className="flex flex-row items-center justify-end gap-2">
            {/* Tight leading keeps the stacked name + role shorter than the buttons
                beside it, so the buttons alone drive the row's height. */}
            <div className="flex flex-col items-end leading-tight px-1">
                <div className="text-sm yj-text-outline text-amber-300">{user.userName}</div>
                <div className="text-xs yj-text-outline text-gray-400">({roleName})</div>
            </div>
            {isGuest && <Button id="loginButton" name="Login" size="sm" onClick={() => {
                PopupUtil.openPopup({popupType: "authPrompt"});
                FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.Login);
            }}/>}
            {!isGuest && <Button name="Logout" size="sm" onClick={() => PopupUtil.openPopup({
                    popupType: "confirm",
                    params: {
                        message: "Want to log out?",
                        onConfirm: logout,
                        onCancel: PopupUtil.closePopup
                    }
            })}/>}
            {showConfigureButton && <IconButton id="configureMyRoomButton" icon={<GearIcon/>} size="sm" onClick={() => {
                PopupUtil.openPopup({popupType: "configureMyRoom"});
                FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.MyRoomSettings);
            }}/>}
            {/* Toggles the player-customization form. Highlighting it while the form is
                open is what tells the user that clicking it again closes the form. */}
            <IconButton id="customizePlayerButton" icon={<PersonIcon/>} size="sm" highlight={isCustomizingPlayer} onClick={() => {
                if (isCustomizingPlayer)
                {
                    PopupUtil.closePopup();
                }
                else
                {
                    PopupUtil.openPopup({popupType: "customizePlayer"});
                    FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.CustomizePlayer);
                }
            }}/>
        </div>
        <div className="flex flex-row items-end justify-end gap-2">

        </div>
    </div>;
}

async function logout(): Promise<void>
{
    const response = await UserAPIClient.logout();
    if (response.status >= 200 && response.status < 300)
    {
        window.location.reload();
    }
    else
    {
        PopupUtil.closePopup();
        alert("Failed to log out. Please try again.");
    }
}

interface Props
{
    user: User;
    userRole: UserRole;
    currentRoomID: string;
    isCustomizingPlayer: boolean;
}
