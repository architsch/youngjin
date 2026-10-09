import { useEffect, useRef, useState } from "react";
import ThingsPoolEnv from "../system/types/thingsPoolEnv";
import Chat from "./components/hud/chat/chat";
import DebugStats from "./components/hud/debug/debugStats";
import VoxelQuadSelectionMenu from "./components/hud/selection/voxelQuadSelectionMenu";
import ObjectSelectionMenu from "./components/hud/selection/objectSelectionMenu";
import TopBarMenu from "./components/hud/topBar/topBarMenu";
import CameraZoomSlider from "./components/hud/mode/cameraZoomSlider";
import Loading from "./components/overlay/loading";
import Notification from "./components/overlay/notification";
import Reconnecting from "./components/overlay/reconnecting";
import Headline from "./components/overlay/headline";
import SkipTutorialButton from "./components/hud/singlePlayer/skipTutorialButton";
import ScreenArrow from "./components/overlay/screenArrow";
import ScreenOutlineRect from "./components/overlay/screenOutlineRect";
import ScreenOutlineCapsule from "./components/overlay/screenOutlineCapsule";
import ScreenCoachMarks from "./components/overlay/screenCoachMarks";
import ScreenDiagram from "./components/overlay/screenDiagram";
import Popup from "./components/form/popup";
import PopupState from "./types/popupState";
import User from "../../shared/user/types/user";
import AuthPromptForm from "./components/form/authPromptForm";
import DestinationChooserForm from "./components/form/destinationChooserForm";
import MyRoomWelcomeForm from "./components/form/myRoomWelcomeForm";
import { bottomUIHeightObservable, clientFeatureFlagsObservable, gameModeObservable, numActiveInputElementsObservable, popupStateObservable, roomChangedObservable } from "../system/clientObservables";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import ImageGridChooserForm from "./components/form/imageGridChooserForm";
import ConsoleLogForm from "./components/form/consoleLogForm";
import AdminAssetSettingsEditor from "./components/form/adminAssetSettingsEditor";
import ConfirmForm from "./components/form/confirmForm";
import ExitPromptForm from "./components/form/exitPromptForm";
import { FeatureFlag } from "../../shared/system/types/featureFlag";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";
import useCloseGesture from "./util/closeGesture";
import useShortcutKeyListener from "./util/shortcutKeyListener";
import useSelectionStepKeyListener from "./util/selectionStepKeyListener";
import useUndoRedoKeyListener from "./util/undoRedoKeyListener";
import useWheelScrollListener from "./util/wheelScrollListener";
import PopupUtil from "./util/popupUtil";
import ClosablePanelUtil from "./util/closablePanelUtil";
import ExitConfirmationUtil from "./util/exitConfirmationUtil";
import GameMode from "../system/types/gameMode";
import FTUEUtil from "./util/ftueUtil";
import { FTUEElementCodeEnumMap } from "./types/ftueElementCode";
import HubRoomWelcomeForm from "./components/form/hubRoomWelcomeForm";
import DoorSettingsForm from "./components/form/doorSettingsForm";
import CustomizeRoomPanel from "./components/panel/customizeRoomPanel";

export default function UIRoot({ env, user }: UIRootProps)
{
    const [popupStack, setPopupStack] = useState<PopupState[]>([]);
    const [roomRuntimeMemory, setRoomRuntimeMemory] = useState<RoomRuntimeMemory>();
    const [inEditMode, setInEditMode] = useState<boolean>(false);
    const [forceHideChat, setForceHideChat] = useState<boolean>(false);
    // Lifted here because both the top-bar button (lit state) and the bottom UI (stands down) need it.
    const [roomSettingsOpen, setRoomSettingsOpen] = useState<boolean>(false);

    useEffect(() => {
        clientFeatureFlagsObservable.addElementListener("ui_root", FeatureFlag.HideChatInput, (action: "add" | "remove") => {
            setForceHideChat(action == "add");
        });
        roomChangedObservable.addListener("ui_root", (roomRuntimeMemory: RoomRuntimeMemory) => {
            setRoomRuntimeMemory(roomRuntimeMemory);
            // The settings on screen were the settings of the room the user has just left.
            setRoomSettingsOpen(false);

            if (roomRuntimeMemory.room.ownerUserID == user.id && !FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.EnterMyRoom))
            {
                PopupUtil.openPopup({popupType: "myRoomWelcome"});
                FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.EnterMyRoom);
            }
            if (roomRuntimeMemory.room.roomType == RoomTypeEnumMap.Hub && !FTUEUtil.hasFTUEElement(FTUEElementCodeEnumMap.EnterHub))
            {
                PopupUtil.openPopup({popupType: "hubRoomWelcome"});
                FTUEUtil.tryAddFTUEElement(FTUEElementCodeEnumMap.EnterHub);
            }
        });
        gameModeObservable.addListener("ui_root", (mode: GameMode) => {
            setInEditMode(mode == "edit");
            // Entering edit mode closes room settings, since the character panel needs the same edge.
            if (mode == "edit")
                setRoomSettingsOpen(false);
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
            gameModeObservable.removeListener("ui_root");
            popupStateObservable.removeListener("ui_root");
        };
    }, []);

    // Removes the page's own boot loading indicator after the first commit, when this tree's
    // look-alike indicator is on screen, so the swap is invisible.
    useEffect(() => {
        document.getElementById("bootLoadingIndicator")?.remove();
    }, []);

    // Exits to the site's home page (a tab can't reliably go back or close itself).
    const exitApp = () => {
        window.location.href = env.mode == "dev"
            ? `${env.static_server_url}/index.html#other-works`
            : `${env.static_server_url}#other-works`;
    };

    // Back gestures close the topmost thing: a popup, then a panel (see ClosablePanelUtil). With nothing to
    // close, a second back gesture leaves the page. Edit mode is not theirs to close (see GameModeUtil).
    useCloseGesture((kind) => {
        // Escape is first handled by a focused input (blur, palette close); back gestures aren't.
        if (kind == "escape" && numActiveInputElementsObservable.peek() > 0)
            return;

        if (popupStack.length == 0 && !ClosablePanelUtil.hasOpenPanel())
        {
            // Nothing to close: back leaves only on the second press.
            if (kind == "back")
                ExitConfirmationUtil.requestExit(exitApp);
            return;
        }

        // A consumed gesture cancels any pending exit prompt.
        ExitConfirmationUtil.cancel();

        if (popupStack.length > 0)
            PopupUtil.closePopup();
        else
            ClosablePanelUtil.closeTopmost();
    });

    // Shortcut keys click their controls only where a click could reach them, which the popup on top decides.
    useShortcutKeyListener(popupStack[popupStack.length - 1]?.popupType);

    // In edit mode the movement keys move the selection, though never under a popup.
    useSelectionStepKeyListener(popupStack.length > 0);

    // In edit mode Ctrl+Z and Ctrl+Y undo and redo the user's edits of the room and selections, under the same
    // condition.
    useUndoRedoKeyListener(popupStack.length > 0);

    useWheelScrollListener();

    // In edit mode a pinch on the UI zooms the camera (see PlayerPointerInput), and the browser isn't to zoom the page
    // by one: not even on a popup, as no pinch could then undo it.
    useEffect(() => {
        document.getElementById("uiRoot")?.classList.toggle("yj-no-page-zoom", inEditMode);
    }, [inEditMode]);

    // How much of the room the bottom UI stands over is kept measured (see bottomUIHeightObservable).
    const bottomUIRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const bottomUI = bottomUIRef.current;
        if (!bottomUI)
            return;
        const observer = new ResizeObserver(() => bottomUIHeightObservable.set(bottomUI.offsetHeight));
        observer.observe(bottomUI);
        return () => observer.disconnect();
    }, []);

    const isRoomLoaded = roomRuntimeMemory != undefined;
    const isMultiplayerRoomLoaded = isRoomLoaded &&
        roomRuntimeMemory.room.roomType != RoomTypeEnumMap.SinglePlayer;

    // Room settings take the bottom edge, so chat and selection tools stand down meanwhile (the tools
    // re-read the selection when they return; see ObjectSelectionMenu, VoxelQuadSelectionMenu).
    const chatHidden = forceHideChat || !isRoomLoaded || inEditMode || roomSettingsOpen;
    const hideSkipTutorialButton = !chatHidden || !isRoomLoaded || inEditMode;

    return <>
        {/* DebugStats after TopBarMenu, so the debugger draws on top. */}
        {isRoomLoaded && <TopBarMenu
            user={user}
            room={roomRuntimeMemory.room}
            roomSettingsOpen={roomSettingsOpen}
            onToggleRoomSettings={() => setRoomSettingsOpen(prev => !prev)}
            onExitApp={exitApp}
        />}
        {isMultiplayerRoomLoaded && <DebugStats env={env}/>}
        <CameraZoomSlider/>
        {/* Selection tools are edit-mode only. */}
        <div ref={bottomUIRef} className="flex flex-col absolute bottom-0 w-full pointer-events-none">
            {!roomSettingsOpen && <ObjectSelectionMenu inEditMode={inEditMode}/>}
            {inEditMode && !roomSettingsOpen && <VoxelQuadSelectionMenu/>}
            <Chat hide={chatHidden}/>
            <SkipTutorialButton hide={hideSkipTutorialButton}/>
        </div>
        {roomSettingsOpen && <CustomizeRoomPanel onClose={() => setRoomSettingsOpen(false)}/>}
        {popupStack.map((state, i) => {
            switch (state.popupType)
            {
                case "authPrompt": return <Popup key={i} title="Login" showCloseButton={true}>
                    <AuthPromptForm/>
                </Popup>;
                case "confirm": return <Popup key={i}>
                    <ConfirmForm
                        message={state.params.message}
                        onConfirm={state.params.onConfirm}
                        onCancel={state.params.onCancel}
                    />
                </Popup>;
                case "exitPrompt": return <Popup key={i} title="" showCloseButton={true}>
                    <ExitPromptForm onExit={exitApp}/>
                </Popup>;
                case "doorDestination": return <Popup key={i} title="Destination" showCloseButton={true}>
                    <DestinationChooserForm
                        initialDestinationRoomID={state.params.initialDestinationRoomID}
                        initialDestinationDoorLabel={state.params.initialDestinationDoorLabel}
                        onChooseRoom={state.params.onChooseRoom}
                        onSetDoorLabel={state.params.onSetDoorLabel}
                    />
                </Popup>;
                case "doorSettings": return <Popup key={i} title="Settings" showCloseButton={true}>
                    <DoorSettingsForm
                        isDefaultEntrance={state.params.isDefaultEntrance}
                        onSetDefaultEntrance={state.params.onSetDefaultEntrance}
                    />
                </Popup>;
                case "myRoomWelcome": return <Popup key={i} title="" showCloseButton={true}>
                    <MyRoomWelcomeForm/>
                </Popup>;
                case "hubRoomWelcome": return <Popup key={i} title="" showCloseButton={true}>
                    <HubRoomWelcomeForm/>
                </Popup>;
                case "imageChooser": return <Popup key={i} showCloseButton={true}>
                    <ImageGridChooserForm
                        mapName={state.params.mapName}
                        initialChoicePath={state.params.initialChoicePath}
                        onChoose={(path) => state.params.onChoose(path)}
                    />
                </Popup>;
                case "consoleLog": return <Popup key={i} title="Console Log" showCloseButton={true}>
                    <ConsoleLogForm/>
                </Popup>;
                case "adminAssetSettings": return <Popup key={i}>
                    <AdminAssetSettingsEditor/>
                </Popup>;
            }
        })}
        <Notification/>
        <Headline/>
        <ScreenArrow/>
        <ScreenOutlineRect/>
        <ScreenOutlineCapsule/>
        <ScreenCoachMarks/>
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
