import { useEffect, useState } from "react";
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
import { clientFeatureFlagsObservable, gameModeObservable, numActiveInputElementsObservable, popupStateObservable, roomChangedObservable } from "../system/clientObservables";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import ImageGridChooserForm from "./components/form/imageGridChooserForm";
import ImageListChooserForm from "./components/form/imageListChooserForm";
import ConsoleLogForm from "./components/form/consoleLogForm";
import ConfirmForm from "./components/form/confirmForm";
import ExitPromptForm from "./components/form/exitPromptForm";
import { FeatureFlag } from "../../shared/system/types/featureFlag";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";
import useCloseGesture from "./util/closeGesture";
import PopupUtil from "./util/popupUtil";
import ClosablePanelUtil from "./util/closablePanelUtil";
import ExitConfirmationUtil from "./util/exitConfirmationUtil";
import GameMode from "../system/types/gameMode";
import GameModeUtil from "../system/util/gameModeUtil";
import FTUEUtil from "./util/ftueUtil";
import { FTUEElementCodeEnumMap } from "./types/ftueElementCode";
import HubRoomWelcomeForm from "./components/form/hubRoomWelcomeForm";
import CustomizeObjectLabelForm from "./components/form/customizeObjectLabelForm";
import DoorSettingsForm from "./components/form/doorSettingsForm";
import CustomizeRoomPanel from "./components/panel/customizeRoomPanel";

export default function UIRoot({ env, user }: UIRootProps)
{
    const [popupStack, setPopupStack] = useState<PopupState[]>([]);
    const [roomRuntimeMemory, setRoomRuntimeMemory] = useState<RoomRuntimeMemory>();
    const [inEditMode, setInEditMode] = useState<boolean>(false);
    const [forceHideChat, setForceHideChat] = useState<boolean>(false);
    // Whether the room's own settings are open (see CustomizeRoomPanel). Held here rather than by
    // the panel or the button that opens it, because both of those need it: the button in the top
    // bar is lit while the panel is up, and the panel takes the bottom edge from what else lives there.
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

    // The game page carries a loading indicator of its own, which is what holds the screen while
    // the bundle this code arrived in is still being fetched and parsed. It is given up here, once
    // this tree has an indicator of its own on screen to replace it. An effect is what makes that
    // ordering true: it runs only after the first render has been committed to the DOM, so the two
    // indicators — drawn to look alike precisely for this moment — swap places invisibly. Doing it
    // any earlier would take the page's indicator away and leave nothing behind in its place.
    useEffect(() => {
        document.getElementById("bootLoadingIndicator")?.remove();
    }, []);

    // Leaving the app, whether the user asked for it outright or by going back with nothing left on
    // screen to close. The site's own home page is where they are taken: a tab has no reliable way
    // back to wherever its user came from, and cannot close itself unless a script opened it, so a
    // destination is the one ending that always works — and this one is the page that explains what
    // they have just been in.
    const exitApp = () => {
        window.location.href = env.mode == "dev"
            ? `${env.static_server_url}/index.html#other-works`
            : `${env.static_server_url}#other-works`;
    };

    // Going back, in whatever way the user's device offers, closes the topmost thing that is open —
    // a popup first, then a panel (see ClosablePanelUtil), then edit mode itself — instead of leaving
    // the page. With nothing left to close, only a second back gesture gives the page up.
    useCloseGesture((kind) => {
        // The Escape key is already answered by whichever input element currently holds the user's
        // attention: a focused text field gives up focus, an open color palette dismisses itself.
        // So whatever lies underneath keeps its place until that has been dealt with. Nothing
        // answers a back gesture that way, which is why only the key is held back here.
        if (kind == "escape" && numActiveInputElementsObservable.peek() > 0)
            return;

        if (popupStack.length == 0 && !ClosablePanelUtil.hasOpenPanel() && !inEditMode)
        {
            // Nothing on screen to close, so the gesture keeps the meaning it came with — except
            // that a back gesture only gives the page up once the user has asked for it twice.
            if (kind == "back")
                ExitConfirmationUtil.requestExit(exitApp);
            return;
        }

        // Something on screen is taking the gesture, so an exit prompt left standing from an
        // earlier one no longer holds: leaving takes two gestures of its own, back to back.
        ExitConfirmationUtil.cancel();

        if (popupStack.length > 0)
            PopupUtil.closePopup();
        else if (ClosablePanelUtil.hasOpenPanel())
            ClosablePanelUtil.closeTopmost();
        else // Going back out of edit mode leaves the mode itself, not merely the selection standing
             // in it, which would leave the user in a mode with nothing selected and no sign of how
             // he got there. Nothing comes of it while a single-player step is holding the user in
             // that mode, and the gesture is spent on it all the same rather than reaching the page
             // underneath: the mode is still what is on screen.
            GameModeUtil.exitEditMode();
    });

    const isRoomLoaded = roomRuntimeMemory != undefined;
    const isMultiplayerRoomLoaded = isRoomLoaded &&
        roomRuntimeMemory.room.roomType != RoomTypeEnumMap.SinglePlayer;

    // The room's settings take the bottom edge while they are open, so what normally lives there —
    // the chat, and the tools for whatever is selected — stands down meanwhile rather than being
    // drawn over.
    const chatHidden = forceHideChat || !isRoomLoaded || inEditMode || roomSettingsOpen;
    const hideSkipTutorialButton = !chatHidden || !isRoomLoaded || inEditMode;

    return <>
        {/* The debugger is drawn after the top bar, which keeps it on top of it: it is a
            development tool, and it is wanted most in the states that cover everything else. */}
        {isRoomLoaded && <TopBarMenu
            user={user}
            room={roomRuntimeMemory.room}
            roomSettingsOpen={roomSettingsOpen}
            onToggleRoomSettings={() => setRoomSettingsOpen(prev => !prev)}
            onExitApp={exitApp}
        />}
        {isMultiplayerRoomLoaded && <DebugStats env={env}/>}
        <CameraZoomSlider/>
        {/* The tools for changing what is selected belong to edit mode alone, as the selection
            itself does. */}
        <div className="flex flex-col absolute bottom-0 w-full pointer-events-none">
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
                case "objectLabel": return <Popup key={i} title="Label" showCloseButton={true}>
                    <CustomizeObjectLabelForm
                        initialText={state.params.initialText}
                        initialColorIndex={state.params.initialColorIndex}
                        onSetText={state.params.onSetText}
                        onSetColorIndex={state.params.onSetColorIndex}
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
                case "consoleLog": return <Popup key={i} title="Console Log" showCloseButton={true}>
                    <ConsoleLogForm/>
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
