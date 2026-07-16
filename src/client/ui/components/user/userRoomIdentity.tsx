import Button from "../basic/button";
import IconButton from "../basic/iconButton";
import GearIcon from "../basic/icons/gearIcon";
import PersonIcon from "../basic/icons/personIcon";
import User from "../../../../shared/user/types/user";
import { UserRole, UserRoleEnumMap } from "../../../../shared/user/types/userRole";
import { UserTypeEnumMap } from "../../../../shared/user/types/userType";
import UserAPIClient from "../../../networking/client/userAPIClient";
import PopupUtil from "../../util/popupUtil";
import { cameraModeObservable } from "../../../system/clientObservables";

export default function UserRoomIdentity({
    user,
    userRole,
    currentRoomID,
}: Props)
{
    const isGuest = user.userType === UserTypeEnumMap.Guest;
    const isInOwnRoom = user.ownedRoomID.length > 0 && user.ownedRoomID === currentRoomID;
    const showConfigureButton = !isGuest && isInOwnRoom;

    const roleName = userRole === UserRoleEnumMap.Owner ? "Owner"
        : userRole === UserRoleEnumMap.Editor ? "Editor"
        : "Visitor";

    return <div className="flex flex-col justify-end gap-1 absolute right-0 top-0 py-1 px-2 text-right bg-gray-800/50 rounded-bl-lg">
        <div className="flex flex-row items-end justify-end gap-2">
            <div className="flex flex-row">
                <div className="yj-text-sm text-amber-300">{user.userName}</div>
                <div className="yj-text-xs text-gray-400">({roleName})</div>
            </div>
            {isGuest && <Button name="Sign In" size="sm" onClick={() => PopupUtil.openPopup({popupType: "authPrompt"})}/>}
            {!isGuest && <Button name="Sign Out" size="sm" onClick={() => PopupUtil.openPopup({
                    popupType: "confirm",
                    params: {
                        message: "Want to sign out?",
                        onConfirm: logout,
                        onCancel: PopupUtil.closePopup
                    }
            })}/>}
        </div>
        <div className="flex flex-row items-end justify-end gap-2">
            {showConfigureButton && <IconButton icon={<GearIcon/>} size="md" onClick={() => PopupUtil.openPopup({popupType: "configureMyRoom"})}/>}
            <IconButton icon={<PersonIcon/>} size="md" onClick={() => {
                if (cameraModeObservable.peek() == "firstPerson")
                    PopupUtil.openPopup({popupType: "customizePlayer"});
                else
                    PopupUtil.closePopup();
            }}/>
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
        alert("Failed to sign out. Please try again.");
    }
}

interface Props
{
    user: User;
    userRole: UserRole;
    currentRoomID: string;
}
