import { useCallback, useEffect, useState } from "react";
import ThingsPoolEnv from "../../../system/types/thingsPoolEnv";
import Chat from "../chat/chat";
import DebugStats from "../debug/debugStats";
import VoxelQuadSelectionMenu from "../selection/voxelQuadSelectionMenu";
import ObjectSelectionMenu from "../selection/objectSelectionMenu";
import Tutorial from "../tutorial/tutorial";
import UserRoomIdentity from "../user/userRoomIdentity";
import Loading from "./loading";
import Notification from "./notification";
import Reconnecting from "./reconnecting";
import Popup from "../basic/popup";
import { PopupType } from "../../types/PopupType";
import User from "../../../../shared/user/types/user";
import AuthPromptForm from "../form/authPromptForm";
import UserAPIClient from "../../../networking/client/userAPIClient";
import SignOutForm from "../form/signOutForm";
import RoomListForm from "../form/roomListForm";
import ConfigureMyRoomForm from "../form/configureMyRoomForm";
import { UserRole, UserRoleEnumMap } from "../../../../shared/user/types/userRole";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import { roomChangedObservable, userRoleObservable } from "../../../system/clientObservables";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";

export default function UIRoot({ env, user }: UIRootProps)
{
    const [popupType, setPopupType] = useState<PopupType>("none");
    const [roomRuntimeMemory, setRoomRuntimeMemory] = useState<RoomRuntimeMemory>();
    const [userRole, setUserRole] = useState<UserRole>(UserRoleEnumMap.Visitor);

    useEffect(() => {
        roomChangedObservable.addListener("ui_root", (roomRuntimeMemory: RoomRuntimeMemory) => {
            setRoomRuntimeMemory(roomRuntimeMemory);
        });
        userRoleObservable.addListener("ui_root", (role: UserRole) => {
            setUserRole(role);
        });
        return () => {
            roomChangedObservable.removeListener("ui_root");
            userRoleObservable.removeListener("ui_root");
        };
    }, []);

    const openAuthPromptFormPopup = useCallback(() => setPopupType("authPrompt"), []);
    const openSignOutFormPopup = useCallback(() => setPopupType("signOut"), []);
    const openRoomsPopup = useCallback(() => setPopupType("rooms"), []);
    const openConfigureMyRoomPopup = useCallback(() => setPopupType("configureMyRoom"), []);
    const closePopup = useCallback(() => setPopupType("none"), []);

    const roomID = roomRuntimeMemory?.room.id;
    const roomType = roomRuntimeMemory?.room.roomType;
    const canModifyRoom =
        userRole === UserRoleEnumMap.Owner ||
        userRole === UserRoleEnumMap.Editor ||
        roomType === RoomTypeEnumMap.Hub;

    return <>
        <UserRoomIdentity
            user={user}
            userRole={userRole}
            currentRoomID={roomID ?? ""}
            onAuthPromptButtonClick={openAuthPromptFormPopup}
            onSignOutButtonClick={openSignOutFormPopup}
            onOpenRoomsButtonClick={openRoomsPopup}
            onConfigureButtonClick={openConfigureMyRoomPopup}
        />
        <DebugStats env={env}/>
        <div className="flex flex-col absolute bottom-0 w-full pointer-events-none">
            {canModifyRoom && <ObjectSelectionMenu/>}
            {canModifyRoom && <VoxelQuadSelectionMenu/>}
            <Chat/>
        </div>
        <Tutorial user={user}/>
        {popupType == "authPrompt" && <Popup>
            <AuthPromptForm
                onPlayAsGuestButtonClick={closePopup}
                onLoginWithGoogleButtonClick={() => UserAPIClient.loginWithGoogle()}
            />
        </Popup>}
        {popupType == "signOut" && <Popup>
            <SignOutForm onCancel={closePopup}/>
        </Popup>}
        {popupType == "rooms" && <Popup>
            <RoomListForm user={user} currentRoomID={roomID ?? ""} onClose={closePopup}/>
        </Popup>}
        {popupType == "configureMyRoom" && <Popup>
            <ConfigureMyRoomForm onClose={closePopup}/>
        </Popup>}
        <Notification/>
        <Loading/>
        <Reconnecting/>
    </>
}

interface UIRootProps
{
    env: ThingsPoolEnv;
    user: User;
}
