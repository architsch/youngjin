import { useCallback, useEffect, useMemo, useState } from "react";
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
import PopupState from "../../types/popupState";
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
import ImageChooserForm from "../form/imageChooserForm";
import { PopupContext } from "../../contexts/popupContext";

export default function UIRoot({ env, user }: UIRootProps)
{
    const [popupStack, setPopupStack] = useState<PopupState[]>([]);
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

    const openPopup = useCallback((state: PopupState) => setPopupStack(prev => [...prev, state]), []);
    const closePopup = useCallback(() => setPopupStack(prev => prev.slice(0, -1)), []);
    const popupContextValue = useMemo(() => ({open: openPopup, close: closePopup}), [openPopup, closePopup]);

    const openAuthPromptFormPopup = useCallback(() => openPopup({popupType: "authPrompt"}), [openPopup]);
    const openSignOutFormPopup = useCallback(() => openPopup({popupType: "signOut"}), [openPopup]);
    const openRoomsPopup = useCallback(() => openPopup({popupType: "rooms"}), [openPopup]);
    const openConfigureMyRoomPopup = useCallback(() => openPopup({popupType: "configureMyRoom"}), [openPopup]);

    const roomID = roomRuntimeMemory?.room.id;
    const roomType = roomRuntimeMemory?.room.roomType;
    const canModifyRoom =
        userRole === UserRoleEnumMap.Owner ||
        userRole === UserRoleEnumMap.Editor ||
        roomType === RoomTypeEnumMap.Hub;

    return <PopupContext.Provider value={popupContextValue}>
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
        {popupStack.map((state, i) => {
            switch (state.popupType)
            {
                case "authPrompt": return <Popup key={i}>
                    <AuthPromptForm
                        onPlayAsGuestButtonClick={closePopup}
                        onLoginWithGoogleButtonClick={() => UserAPIClient.loginWithGoogle()}
                    />
                </Popup>;
                case "signOut": return <Popup key={i}>
                    <SignOutForm onCancel={closePopup}/>
                </Popup>;
                case "rooms": return <Popup key={i}>
                    <RoomListForm user={user} currentRoomID={roomID ?? ""} onClose={closePopup}/>
                </Popup>;
                case "configureMyRoom": return <Popup key={i}>
                    <ConfigureMyRoomForm onClose={closePopup}/>
                </Popup>;
                case "imageChooser": return <Popup key={i}>
                    <ImageChooserForm
                        mapName={state.params.mapName}
                        initialChoicePath={state.params.initialChoicePath}
                        onChoose={(path) => { state.params.onChoose(path); closePopup(); }}
                        onClose={closePopup}
                    />
                </Popup>;
            }
        })}
        <Notification/>
        <Loading/>
        <Reconnecting/>
    </PopupContext.Provider>
}

interface UIRootProps
{
    env: ThingsPoolEnv;
    user: User;
}
