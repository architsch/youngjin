import Button from "../basic/button";
import User from "../../../../shared/user/types/user";
import { UserRole, UserRoleEnumMap } from "../../../../shared/user/types/userRole";
import { UserTypeEnumMap } from "../../../../shared/user/types/userType";

export default function UserRoomIdentity({
    user,
    userRole,
    currentRoomID,
    onAuthPromptButtonClick,
    onSignOutButtonClick,
    onVisitMyRoomButtonClick,
    onConfigureButtonClick,
}: Props)
{
    const isGuest = user.userType === UserTypeEnumMap.Guest;
    const isInOwnRoom = user.ownedRoomID.length > 0 && user.ownedRoomID === currentRoomID;
    const showMyRoomButton = !isGuest && !isInOwnRoom;
    const showConfigureButton = !isGuest && isInOwnRoom;

    const roleName = userRole === UserRoleEnumMap.Owner ? "Owner"
        : userRole === UserRoleEnumMap.Editor ? "Editor"
        : "Visitor";

    return <div className={className}>
        <div className="flex flex-row items-center gap-2">
            <div className="flex flex-row">
                <div className="yj-text-sm text-gray-400">Your Name:&nbsp;</div>
                <div className="yj-text-sm text-amber-300">{user.userName}</div>
            </div>
            {isGuest && <Button name="Sign In" size="sm" onClick={onAuthPromptButtonClick}/>}
            {!isGuest && <Button name="Sign Out" size="sm" onClick={onSignOutButtonClick}/>}
        </div>
        <div className="flex flex-row items-center gap-2">
            <div className="flex flex-row">
                <div className="yj-text-sm text-gray-400">Room:&nbsp;</div>
                <div className="yj-text-sm text-amber-300">{currentRoomID || "—"}</div>
                <div className="yj-text-sm text-gray-400">&nbsp;(Your Role:&nbsp;</div>
                <div className="yj-text-sm text-amber-300">{roleName}</div>
                <div className="yj-text-sm text-gray-400">)</div>
            </div>
            {showMyRoomButton && <Button name="My Room" size="sm" onClick={onVisitMyRoomButtonClick}/>}
            {showConfigureButton && <Button name="Configure" size="sm" onClick={onConfigureButtonClick}/>}
        </div>
    </div>;
}

const className = "flex flex-col justify-end gap-1 absolute right-0 top-0 py-1 px-2 text-right bg-black";

interface Props
{
    user: User;
    userRole: UserRole;
    currentRoomID: string;
    onAuthPromptButtonClick: () => void;
    onSignOutButtonClick: () => void;
    onVisitMyRoomButtonClick: () => void;
    onConfigureButtonClick: () => void;
}
