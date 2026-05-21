import Button from "../basic/button";
import IconButton from "../basic/iconButton";
import DoorIcon from "../basic/icons/doorIcon";
import GearIcon from "../basic/icons/gearIcon";
import User from "../../../../shared/user/types/user";
import { UserRole, UserRoleEnumMap } from "../../../../shared/user/types/userRole";
import { UserTypeEnumMap } from "../../../../shared/user/types/userType";

export default function UserRoomIdentity({
    user,
    userRole,
    currentRoomID,
    onAuthPromptButtonClick,
    onSignOutButtonClick,
    onConfigureButtonClick,
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
            {isGuest && <Button name="Sign In" size="sm" onClick={onAuthPromptButtonClick}/>}
            {!isGuest && <Button name="Sign Out" size="sm" onClick={onSignOutButtonClick}/>}
        </div>
        <div className="flex flex-row items-end justify-end gap-2">
            {showConfigureButton && <IconButton icon={<GearIcon/>} size="md" onClick={onConfigureButtonClick}/>}
        </div>
    </div>;
}

interface Props
{
    user: User;
    userRole: UserRole;
    currentRoomID: string;
    onAuthPromptButtonClick: () => void;
    onSignOutButtonClick: () => void;
    onConfigureButtonClick: () => void;
}
