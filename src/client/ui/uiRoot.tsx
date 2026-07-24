import { useEffect, useState } from "react";
import ThingsPoolEnv from "../system/types/thingsPoolEnv";
import Chat from "./components/hud/chat/chat";
import DebugStats from "./components/hud/debug/debugStats";
import VoxelQuadSelectionMenu from "./components/hud/selection/voxelQuadSelectionMenu";
import ObjectSelectionMenu from "./components/hud/selection/objectSelectionMenu";
import UserRoomIdentity from "./components/hud/user/userRoomIdentity";
import Loading from "./components/overlay/loading";
import Notification from "./components/overlay/notification";
import Reconnecting from "./components/overlay/reconnecting";
import Headline from "./components/overlay/headline";
import SkipTutorialButton from "./components/hud/singlePlayer/skipTutorialButton";
import ScreenArrow from "./components/overlay/screenArrow";
import ScreenOutlineRect from "./components/overlay/screenOutlineRect";
import ScreenDiagram from "./components/overlay/screenDiagram";
import Popup from "./components/form/popup";
import PopupState from "./types/popupState";
import User from "../../shared/user/types/user";
import AuthPromptForm from "./components/form/authPromptForm";
import RoomListForm from "./components/form/roomListForm";
import ConfigureMyRoomForm from "./components/form/configureMyRoomForm";
import CustomizePlayerForm from "./components/form/customizePlayerForm";
import { UserRole, UserRoleEnumMap } from "../../shared/user/types/userRole";
import { clientFeatureFlagsObservable, numActiveInputElementsObservable, objectSelectionObservable, popupStateObservable, roomChangedObservable, userRoleObservable, voxelQuadSelectionObservable } from "../system/clientObservables";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import ImageGridChooserForm from "./components/form/imageGridChooserForm";
import ImageListChooserForm from "./components/form/imageListChooserForm";
import ObjectSelection from "../graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";
import ConfirmForm from "./components/form/confirmForm";
import RoomValidationUtil from "../../shared/room/util/roomValidationUtil";
import { FeatureFlag } from "../../shared/system/types/featureFlag";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";
import useCloseGesture from "./util/closeGesture";
import PopupUtil from "./util/popupUtil";
import ExitConfirmationUtil from "./util/exitConfirmationUtil";
import WorldSpaceSelectionUtil from "../graphics/util/worldSpaceSelectionUtil";

export default function UIRoot({ env, user }: UIRootProps)
{
    const [popupStack, setPopupStack] = useState<PopupState[]>([]);
    const [roomRuntimeMemory, setRoomRuntimeMemory] = useState<RoomRuntimeMemory>();
    const [userRole, setUserRole] = useState<UserRole>(UserRoleEnumMap.Visitor);
    const [objectSelection, setObjectSelection] = useState<ObjectSelection | null>(null);
    const [voxelQuadSelection, setVoxelQuadSelection] = useState<VoxelQuadSelection | null>(null);
    const [forceHideChat, setForceHideChat] = useState<boolean>(false);

    useEffect(() => {
        clientFeatureFlagsObservable.addElementListener("ui_root", FeatureFlag.HideChatInput, (action: "add" | "remove") => {
            setForceHideChat(action == "add");
        });
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
            clientFeatureFlagsObservable.removeElementListener("ui_root", FeatureFlag.HideChatInput);
            roomChangedObservable.removeListener("ui_root");
            userRoleObservable.removeListener("ui_root");
            objectSelectionObservable.removeListener("ui_root");
            voxelQuadSelectionObservable.removeListener("ui_root");
            popupStateObservable.removeListener("ui_root");
        };
    }, []);

    // Going back, in whatever way the user's device offers, closes the topmost thing that is open —
    // a popup first, then a world-space selection — instead of leaving the page. With nothing left
    // to close, only a second back gesture gives the page up.
    useCloseGesture((kind, leavePage) => {
        // The Escape key is already answered by whichever input element currently holds the user's
        // attention: a focused text field gives up focus, an open color palette dismisses itself.
        // So whatever lies underneath keeps its place until that has been dealt with. Nothing
        // answers a back gesture that way, which is why only the key is held back here.
        if (kind == "escape" && numActiveInputElementsObservable.peek() > 0)
            return;

        if (popupStack.length == 0 && !WorldSpaceSelectionUtil.isAnythingSelected())
        {
            // Nothing on screen to close, so the gesture keeps the meaning it came with — except
            // that a back gesture only gives the page up once the user has asked for it twice.
            if (kind == "back")
                ExitConfirmationUtil.requestExit(leavePage);
            return;
        }

        // Something on screen is taking the gesture, so an exit prompt left standing from an
        // earlier one no longer holds: leaving takes two gestures of its own, back to back.
        ExitConfirmationUtil.cancel();

        if (popupStack.length > 0)
            PopupUtil.closePopup();
        else // Nothing comes of this while a single-player step is holding the selection in place,
             // and that is the point: the gesture is spent on the selection either way, and never
             // reaches the page underneath.
            WorldSpaceSelectionUtil.unselectAll();
    });

    const roomID = roomRuntimeMemory?.room.id;
    const isRoomLoaded = roomRuntimeMemory != undefined;
    const isMultiplayerRoomLoaded = isRoomLoaded &&
        roomRuntimeMemory.room.roomType != RoomTypeEnumMap.SinglePlayer;
    const canModifyRoom = roomRuntimeMemory
        ? RoomValidationUtil.canUserEditRoom(userRole, roomRuntimeMemory?.room)
        : false;

    const isCustomizingPlayer = popupStack.some(state => state.popupType == "customizePlayer");

    const selectionUIShown = canModifyRoom && (objectSelection != null || voxelQuadSelection != null);
    const chatHidden = forceHideChat || !isRoomLoaded || selectionUIShown;
    const hideSkipTutorialButton = !chatHidden || !isRoomLoaded || selectionUIShown;

    return <>
        {isMultiplayerRoomLoaded && <UserRoomIdentity
            user={user}
            userRole={userRole}
            currentRoomID={roomID ?? ""}
            isCustomizingPlayer={isCustomizingPlayer}
        />}
        {isMultiplayerRoomLoaded && <DebugStats env={env}/>}
        <div className="flex flex-col absolute bottom-0 w-full pointer-events-none">
            <ObjectSelectionMenu canModifyRoom={canModifyRoom}/>
            {canModifyRoom && <VoxelQuadSelectionMenu/>}
            <Chat hide={chatHidden}/>
            <SkipTutorialButton hide={hideSkipTutorialButton}/>
        </div>
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
                case "customizePlayer": return <CustomizePlayerForm key={i}/>;
                case "imageChooser": return <Popup key={i} showCloseButton={true}>
                    {state.params.viewType === "list"
                        ? <ImageListChooserForm
                            mapName={state.params.mapName}
                            initialChoicePath={state.params.initialChoicePath}
                            onChoose={(path) => state.params.onChoose(path)}
                        />
                        : <ImageGridChooserForm
                            mapName={state.params.mapName}
                            initialChoicePath={state.params.initialChoicePath}
                            onChoose={(path) => state.params.onChoose(path)}
                        />}
                </Popup>;
            }
        })}
        <Notification/>
        <Headline/>
        <ScreenArrow/>
        <ScreenOutlineRect/>
        {popupStack.length === 0 && <ScreenDiagram/>}
        <Loading/>
        <Reconnecting/>
    </>
}

interface UIRootProps
{
    env: ThingsPoolEnv;
    user: User;
}
