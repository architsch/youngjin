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

let configureButtonFTUETimeout: ReturnType<typeof setTimeout> | undefined;
let loginButtonFTUETimeout: ReturnType<typeof setTimeout> | undefined;
let customizeButtonFTUETimeout: ReturnType<typeof setTimeout> | undefined;

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

    useEffect(() => {
        clearFTUETimeouts();
        if (showConfigureButton && !FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.MyRoomSettings))
        {
            // For any member-type user who stays in his/her own room for 2 minutes straight,
            // we will show a coach mark for the "Configure" button if the user hasn't clicked it before.
            configureButtonFTUETimeout = setTimeout(() => {
                FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.MyRoomSettings,
                    "configureMyRoomButton", "View your room's settings here.");
            }, 2 * MINUTE_IN_MS);
        }
        if (isGuest && !FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.Login))
        {
            // For any guest-type user who stays in a room for 3 minutes straight,
            // we will show a coach mark for the "Login" button if the user hasn't clicked it before.
            loginButtonFTUETimeout = setTimeout(() => {
                FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.Login,
                    "loginButton", "Login to create your own room.");
            }, 3 * MINUTE_IN_MS);
        }
        if (!FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.CustomizePlayer))
        {
            // For any user who stays in a room for 15 seconds straight,
            // we will show a coach mark for the "Customize" button if the user hasn't clicked it before.
            customizeButtonFTUETimeout = setTimeout(() => {
                FTUEUtil.tryShowCoachMark(FTUEElementCodeEnumMap.CustomizePlayer,
                    "customizePlayerButton", "Customize your avatar.");
            }, 15000);
        }
        return () => {
            clearFTUETimeouts();
        };
    }, [isGuest, showConfigureButton]);

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

function clearFTUETimeouts()
{
    if (configureButtonFTUETimeout)
    {
        clearTimeout(configureButtonFTUETimeout);
        configureButtonFTUETimeout = undefined;
    }
    if (loginButtonFTUETimeout)
    {
        clearTimeout(loginButtonFTUETimeout);
        loginButtonFTUETimeout = undefined;
    }
    if (customizeButtonFTUETimeout)
    {
        clearTimeout(customizeButtonFTUETimeout);
        customizeButtonFTUETimeout = undefined;
    }
}

interface Props
{
    user: User;
    userRole: UserRole;
    currentRoomID: string;
    isCustomizingPlayer: boolean;
}
