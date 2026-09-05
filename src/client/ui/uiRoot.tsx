import { useEffect, useState } from "react";
import ThingsPoolEnv from "../system/types/thingsPoolEnv";
import Chat from "./components/hud/chat/chat";
import DebugStats from "./components/hud/debug/debugStats";
import VoxelQuadSelectionMenu from "./components/hud/selection/voxelQuadSelectionMenu";
import ObjectSelectionMenu from "./components/hud/selection/objectSelectionMenu";
import GameModeMenu from "./components/hud/mode/gameModeMenu";
import UserRoomIdentity from "./components/hud/user/userRoomIdentity";
import Loading from "./components/overlay/loading";
import Notification from "./components/overlay/notification";
import Reconnecting from "./components/overlay/reconnecting";
import Headline from "./components/overlay/headline";
import SkipTutorialButton from "./components/hud/singlePlayer/skipTutorialButton";
import ScreenArrow from "./components/overlay/screenArrow";
import ScreenOutlineRect from "./components/overlay/screenOutlineRect";
import ScreenCoachMarks from "./components/overlay/screenCoachMarks";
import ScreenDiagram from "./components/overlay/screenDiagram";
import Popup from "./components/form/popup";
import PopupState from "./types/popupState";
import User from "../../shared/user/types/user";
import AuthPromptForm from "./components/form/authPromptForm";
import DestinationChooserForm from "./components/form/destinationChooserForm";
import ConfigureMyRoomForm from "./components/form/configureMyRoomForm";
import MyRoomWelcomeForm from "./components/form/myRoomWelcomeForm";
import CustomizePlayerForm from "./components/form/customizePlayerForm";
import { clientFeatureFlagsObservable, gameModeObservable, numActiveInputElementsObservable, objectSelectionObservable, playerSelectionObservable, popupStateObservable, roomChangedObservable, voxelQuadSelectionObservable } from "../system/clientObservables";
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import ImageGridChooserForm from "./components/form/imageGridChooserForm";
import ImageListChooserForm from "./components/form/imageListChooserForm";
import ConsoleLogForm from "./components/form/consoleLogForm";
import ObjectSelection from "../graphics/types/gizmo/objectSelection";
import PlayerSelection from "../graphics/types/gizmo/playerSelection";
import VoxelQuadSelection from "../graphics/types/gizmo/voxelQuadSelection";
import ConfirmForm from "./components/form/confirmForm";
import ExitPromptForm from "./components/form/exitPromptForm";
import { FeatureFlag } from "../../shared/system/types/featureFlag";
import { RoomTypeEnumMap } from "../../shared/room/types/roomType";
import useCloseGesture from "./util/closeGesture";
import PopupUtil from "./util/popupUtil";
import ExitConfirmationUtil from "./util/exitConfirmationUtil";
import WorldSpaceSelectionUtil from "../graphics/util/worldSpaceSelectionUtil";
import GameMode from "../system/types/gameMode";
import GameModeUtil from "../system/util/gameModeUtil";
import FTUEUtil from "./util/ftueUtil";
import { FTUEElementCodeEnumMap } from "./types/ftueElementCode";
import HubRoomWelcomeForm from "./components/form/hubRoomWelcomeForm";
import ConfigureHubRoomForm from "./components/form/configureHubRoomForm";
import CustomizeObjectLabelForm from "./components/form/customizeObjectLabelForm";
import DoorSettingsForm from "./components/form/doorSettingsForm";

export default function UIRoot({ env, user }: UIRootProps)
{
    const [popupStack, setPopupStack] = useState<PopupState[]>([]);
    const [roomRuntimeMemory, setRoomRuntimeMemory] = useState<RoomRuntimeMemory>();
    const [objectSelection, setObjectSelection] = useState<ObjectSelection | null>(null);
    const [voxelQuadSelection, setVoxelQuadSelection] = useState<VoxelQuadSelection | null>(null);
    const [playerSelection, setPlayerSelection] = useState<PlayerSelection | null>(null);
    const [inEditMode, setInEditMode] = useState<boolean>(false);
    const [forceHideChat, setForceHideChat] = useState<boolean>(false);

    useEffect(() => {
        clientFeatureFlagsObservable.addElementListener("ui_root", FeatureFlag.HideChatInput, (action: "add" | "remove") => {
            setForceHideChat(action == "add");
        });
        roomChangedObservable.addListener("ui_root", (roomRuntimeMemory: RoomRuntimeMemory) => {
            setRoomRuntimeMemory(roomRuntimeMemory);

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
        objectSelectionObservable.addListener("ui_root", (selection: ObjectSelection | null) => {
            setObjectSelection(selection);
        });
        voxelQuadSelectionObservable.addListener("ui_root", (selection: VoxelQuadSelection | null) => {
            setVoxelQuadSelection(selection);
        });
        playerSelectionObservable.addListener("ui_root", (selection: PlayerSelection | null) => {
            setPlayerSelection(selection);
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
            objectSelectionObservable.removeListener("ui_root");
            voxelQuadSelectionObservable.removeListener("ui_root");
            playerSelectionObservable.removeListener("ui_root");
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
    // a popup first, then edit mode or whatever is selected — instead of leaving the page. With
    // nothing left to close, only a second back gesture gives the page up.
    useCloseGesture((kind) => {
        // The Escape key is already answered by whichever input element currently holds the user's
        // attention: a focused text field gives up focus, an open color palette dismisses itself.
        // So whatever lies underneath keeps its place until that has been dealt with. Nothing
        // answers a back gesture that way, which is why only the key is held back here.
        if (kind == "escape" && numActiveInputElementsObservable.peek() > 0)
            return;

        if (popupStack.length == 0 && !inEditMode && !WorldSpaceSelectionUtil.isAnythingSelected())
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
        else if (inEditMode) // Going back out of edit mode leaves the mode itself, not merely the
                             // selection standing in it, which would leave the user in a mode with
                             // nothing selected and no sign of how he got there. Nothing comes of
                             // it while a single-player step is holding the user in that mode, and
                             // the gesture is spent on it all the same rather than reaching the
                             // page underneath: the mode is still what is on screen.
            GameModeUtil.exitEditMode();
        else // Nothing comes of this while a single-player step is holding the selection in place,
             // and that is the point: the gesture is spent on the selection either way, and never
             // reaches the page underneath.
            WorldSpaceSelectionUtil.unselectAll();
    });

    const roomID = roomRuntimeMemory?.room.id;
    const isRoomLoaded = roomRuntimeMemory != undefined;
    const isMultiplayerRoomLoaded = isRoomLoaded &&
        roomRuntimeMemory.room.roomType != RoomTypeEnumMap.SinglePlayer;

    const anythingSelected = objectSelection != null || voxelQuadSelection != null ||
        playerSelection != null;
    // Edit mode, or a selection made outside it, has taken the top bar for its own way out, so the
    // controls that normally live there stand down for as long as it is up. The mode counts in its
    // own right, since it outlasts any one selection made inside it.
    const inExclusiveMode = inEditMode || anythingSelected;
    const chatHidden = forceHideChat || !isRoomLoaded || inEditMode;
    const hideSkipTutorialButton = !chatHidden || !isRoomLoaded || inEditMode;

    return <>
        {/* A selection takes the top bar for itself, so the identity and room controls that
            normally hold it step aside for as long as one is up. The debugger is the exception: it
            is a development tool, and it is wanted most in the states that hide everything else —
            hence its place after the bar here, which keeps it drawn on top of it. */}
        {isRoomLoaded && !inExclusiveMode && <UserRoomIdentity
            user={user}
            onExitApp={exitApp}
        />}
        <GameModeMenu user={user} currentRoomID={roomID ?? ""}
            currentRoomType={roomRuntimeMemory?.room.roomType ?? RoomTypeEnumMap.Regular}/>
        {isMultiplayerRoomLoaded && <DebugStats env={env}/>}
        {/* The tools for changing what is selected belong to edit mode alone. In play mode a
            selection is a way of looking at something and reading about it, which is why the
            canvas's description below stands outside that condition. */}
        <div className="flex flex-col absolute bottom-0 w-full pointer-events-none">
            <ObjectSelectionMenu inEditMode={inEditMode}/>
            {inEditMode && <VoxelQuadSelectionMenu/>}
            {playerSelection != null && <CustomizePlayerForm/>}
            <Chat hide={chatHidden}/>
            <SkipTutorialButton hide={hideSkipTutorialButton}/>
        </div>
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
                case "configureMyRoom": return <Popup key={i} showCloseButton={true}>
                    <ConfigureMyRoomForm/>
                </Popup>;
                case "configureHubRoom": return <Popup key={i} showCloseButton={true}>
                    <ConfigureHubRoomForm/>
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
