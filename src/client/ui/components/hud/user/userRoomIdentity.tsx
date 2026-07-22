import Button from "../../input/button";
import IconButton from "../../input/iconButton";
import GearIcon from "../../../svg/icons/gearIcon";
import PersonIcon from "../../../svg/icons/personIcon";
import User from "../../../../../shared/user/types/user";
import { UserRole, UserRoleEnumMap } from "../../../../../shared/user/types/userRole";
import { UserTypeEnumMap } from "../../../../../shared/user/types/userType";
import UserAPIClient from "../../../../networking/client/userAPIClient";
import PopupUtil from "../../../util/popupUtil";

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

    return <div className="flex flex-col justify-end gap-1 absolute right-0 top-0 py-1 px-2 text-right rounded-bl-lg">
        <div className="flex flex-row items-center justify-end gap-2">
            {/* Tight leading keeps the stacked name + role shorter than the buttons
                beside it, so the buttons alone drive the row's height. */}
            <div className="flex flex-col items-end leading-tight px-1">
                <div className="text-sm yj-text-outline text-amber-300">{user.userName}</div>
                <div className="text-xs yj-text-outline text-gray-400">({roleName})</div>
            </div>
            {isGuest && <Button name="Login" size="sm" onClick={() => PopupUtil.openPopup({popupType: "authPrompt"})}/>}
            {!isGuest && <Button name="Logout" size="sm" onClick={() => PopupUtil.openPopup({
                    popupType: "confirm",
                    params: {
                        message: "Want to log out?",
                        onConfirm: logout,
                        onCancel: PopupUtil.closePopup
                    }
            })}/>}
            {showConfigureButton && <IconButton icon={<GearIcon/>} size="sm" onClick={() => PopupUtil.openPopup({popupType: "configureMyRoom"})}/>}
            {/* Toggles the player-customization form. Highlighting it while the form is
                open is what tells the user that clicking it again closes the form. */}
            <IconButton icon={<PersonIcon/>} size="sm" highlight={isCustomizingPlayer} onClick={() => {
                if (isCustomizingPlayer)
                    PopupUtil.closePopup();
                else
                    PopupUtil.openPopup({popupType: "customizePlayer"});
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
