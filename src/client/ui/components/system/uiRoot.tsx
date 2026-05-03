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
import { objectSelectionObservable, roomChangedObservable, userRoleObservable, voxelQuadSelectionObservable } from "../../../system/clientObservables";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import ImageChooserForm from "../form/imageChooserForm";
import { PopupContext } from "../../contexts/popupContext";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";

export default function UIRoot({ env, user }: UIRootProps)
{
    const [popupStack, setPopupStack] = useState<PopupState[]>([]);
    const [roomRuntimeMemory, setRoomRuntimeMemory] = useState<RoomRuntimeMemory>();
    const [userRole, setUserRole] = useState<UserRole>(UserRoleEnumMap.Visitor);
    const [objectSelection, setObjectSelection] = useState<ObjectSelection | null>(null);
    const [voxelQuadSelection, setVoxelQuadSelection] = useState<VoxelQuadSelection | null>(null);

    useEffect(() => {
        roomChangedObservable.addListener("ui_root", (roomRuntimeMemory: RoomRuntimeMemory) => {
            setRoomRuntimeMemory(roomRuntimeMemory);
        });
        userRoleObservable.addListener("ui_root", (role: UserRole) => {
            setUserRole(role);
        });
        objectSelectionObservable.addListener("ui_root", (selection: ObjectSelection | null) => {
            setObjectSelection(selection);
        });
        voxelQuadSelectionObservable.addListener("ui_root", (selection: VoxelQuadSelection | null) => {
            setVoxelQuadSelection(selection);
        });
        return () => {
            roomChangedObservable.removeListener("ui_root");
            userRoleObservable.removeListener("ui_root");
            objectSelectionObservable.removeListener("ui_root");
            voxelQuadSelectionObservable.removeListener("ui_root");
        };
    }, []);

    const openPopup = useCallback((state: PopupState) => setPopupStack(prev => [...prev, state]), []);
    const closePopup = useCallback(() => setPopupStack(prev => prev.slice(0, -1)), []);
    const popupContextValue = useMemo(() => ({open: openPopup, close: closePopup}), [openPopup, closePopup]);

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
            onAuthPromptButtonClick={() => openPopup({popupType: "authPrompt"})}
            onSignOutButtonClick={() => openPopup({popupType: "signOut"})}
            onOpenRoomsButtonClick={() => openPopup({popupType: "roomList"})}
            onConfigureButtonClick={() => openPopup({popupType: "configureMyRoom"})}
        />
        <DebugStats env={env}/>
        <div className="flex flex-col absolute bottom-0 w-full pointer-events-none">
            {canModifyRoom && <ObjectSelectionMenu/>}
            {canModifyRoom && <VoxelQuadSelectionMenu/>}
            {<Chat selectionIsActive={!objectSelection && !voxelQuadSelection}/>}
        </div>
        <Tutorial user={user}/>
        {popupStack.map((state, i) => {
            switch (state.popupType)
            {
                case "authPrompt": return <Popup key={i} onClose={closePopup}>
                    <AuthPromptForm
                        onPlayAsGuestButtonClick={closePopup}
                        onLoginWithGoogleButtonClick={() => UserAPIClient.loginWithGoogle()}
                    />
                </Popup>;
                case "signOut": return <Popup key={i} onClose={closePopup}>
                    <SignOutForm onCancel={closePopup}/>
                </Popup>;
                case "roomList": return <Popup key={i} onClose={closePopup} title="Rooms" showCloseButton={true}>
                    <RoomListForm user={user} currentRoomID={roomID ?? ""} onClose={closePopup}/>
                </Popup>;
                case "configureMyRoom": return <Popup key={i} onClose={closePopup} showCloseButton={true}>
                    <ConfigureMyRoomForm onClose={closePopup}/>
                </Popup>;
                case "imageChooser": return <Popup key={i} onClose={closePopup} showCloseButton={true}>
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
