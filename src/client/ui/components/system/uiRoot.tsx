import { useCallback, useEffect, useState } from "react";
import ThingsPoolEnv from "../../../system/types/thingsPoolEnv";
import Chat from "../chat/chat";
import DebugStats from "../debug/debugStats";
import VoxelQuadSelectionMenu from "../selection/voxelQuadSelectionMenu";
import PersistentObjectSelectionMenu from "../selection/persistentObjectSelectionMenu";
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
import VisitMyRoomForm from "../form/visitMyRoomForm";
import ConfigureMyRoomForm from "../form/configureMyRoomForm";
import { UserRole, UserRoleEnumMap } from "../../../../shared/user/types/userRole";
import { roomChangedObservable, userRoleObservable } from "../../../system/clientObservables";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";

export default function UIRoot({ env, user }: UIRootProps)
{
    const [popupType, setPopupType] = useState<PopupType>("none");
    const [currentRoomID, setCurrentRoomID] = useState<string>("");
    const [userRole, setUserRole] = useState<UserRole>(UserRoleEnumMap.Visitor);

    useEffect(() => {
        roomChangedObservable.addListener("ui_root", (roomRuntimeMemory: RoomRuntimeMemory) => {
            setCurrentRoomID(roomRuntimeMemory.room.id);
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
    const openVisitMyRoomPopup = useCallback(() => setPopupType("visitMyRoom"), []);
    const openConfigureMyRoomPopup = useCallback(() => setPopupType("configureMyRoom"), []);
    const closePopup = useCallback(() => setPopupType("none"), []);

    const isVisitor = userRole === UserRoleEnumMap.Visitor;

    return <>
        <UserRoomIdentity
            user={user}
            userRole={userRole}
            currentRoomID={currentRoomID}
            onAuthPromptButtonClick={openAuthPromptFormPopup}
            onSignOutButtonClick={openSignOutFormPopup}
            onVisitMyRoomButtonClick={openVisitMyRoomPopup}
            onConfigureButtonClick={openConfigureMyRoomPopup}
        />
        <DebugStats env={env}/>
        <div className="flex flex-col absolute bottom-0 w-full pointer-events-none">
            {!isVisitor && <PersistentObjectSelectionMenu/>}
            {!isVisitor && <VoxelQuadSelectionMenu/>}
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
        {popupType == "visitMyRoom" && <Popup>
            <VisitMyRoomForm user={user} onCancel={closePopup}/>
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
