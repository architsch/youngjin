import { useEffect, useState } from "react";
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
import RoomListForm from "../form/roomListForm";
import ConfigureMyRoomForm from "../form/configureMyRoomForm";
import { UserRole, UserRoleEnumMap } from "../../../../shared/user/types/userRole";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import { objectSelectionObservable, popupStateObservable, roomChangedObservable, userRoleObservable, voxelQuadSelectionObservable } from "../../../system/clientObservables";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import ImageChooserForm from "../form/imageChooserForm";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import ConfirmForm from "../form/confirmForm";

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
        popupStateObservable.addListener("ui_root", (state: PopupState) => {
            if (state.popupType != "none")
                setPopupStack(prev => [...prev, state]); // Open up a new popup
            else
                setPopupStack(prev => prev.slice(0, -1)); // Close the topmost popup
        })
        return () => {
            roomChangedObservable.removeListener("ui_root");
            userRoleObservable.removeListener("ui_root");
            objectSelectionObservable.removeListener("ui_root");
            voxelQuadSelectionObservable.removeListener("ui_root");
            popupStateObservable.removeListener("ui_root");
        };
    }, []);

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
        />
        <DebugStats env={env}/>
        <div className="flex flex-col absolute bottom-0 w-full pointer-events-none">
            {canModifyRoom && <ObjectSelectionMenu/>}
            {canModifyRoom && <VoxelQuadSelectionMenu/>}
            {<Chat hide={canModifyRoom && (objectSelection != null || voxelQuadSelection != null)}/>}
        </div>
        <Tutorial user={user}/>
        {popupStack.map((state, i) => {
            switch (state.popupType)
            {
                case "authPrompt": return <Popup key={i}>
                    <AuthPromptForm/>
                </Popup>;
                case "confirm": return <Popup key={i}>
                    <ConfirmForm
                        message={state.params.message}
                        onConfirm={state.params.onConfirm}
                        onCancel={state.params.onCancel}
                    />
                </Popup>;
                case "roomList": return <Popup key={i} title="Rooms" showCloseButton={true}>
                    <RoomListForm user={user} currentRoomID={roomID ?? ""}/>
                </Popup>;
                case "configureMyRoom": return <Popup key={i} showCloseButton={true}>
                    <ConfigureMyRoomForm/>
                </Popup>;
                case "imageChooser": return <Popup key={i} showCloseButton={true}>
                    <ImageChooserForm
                        mapName={state.params.mapName}
                        initialChoicePath={state.params.initialChoicePath}
                        onChoose={(path) => state.params.onChoose(path)}
                    />
                </Popup>;
            }
        })}
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
