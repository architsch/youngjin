import { useEffect, useState } from "react";
import App from "../../../../app";
import ClientObjectManager from "../../../../object/clientObjectManager";
import { notificationMessageObservable, voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import { colliderDebugEnabledObservable, imageListChooserDebugEnabledObservable, roomListDebugEnabledObservable } from "../../../../../shared/system/sharedObservables";
import VoxelQueryUtil from "../../../../../shared/voxel/util/voxelQueryUtil";
import Button from "../../input/button";
import ThingsPoolEnv from "../../../../system/types/thingsPoolEnv";
import TextInput from "../../input/textInput";
import UserAPIClient from "../../../../networking/client/userAPIClient";
import PopupUtil from "../../../util/popupUtil";
import GraphicsManager from "../../../../graphics/graphicsManager";
import SocketsClient from "../../../../networking/client/socketsClient";
import SetObjectMetadataSignal from "../../../../../shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import AdminPrefsUtil from "../../../../../shared/object/util/adminPrefsUtil";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";

export default function DebugStats({env}: Props)
{
    const [state, setState] = useState<DebugStatsState>({
        display: false, fpsDesc: "?", playerPosDesc: "?", voxelDesc: "",
        voxelQuadSelectionDesc: "", debugCommand: "",
    });

    useEffect(() => {
        if (!state.display)
            return;
        const interval = setInterval(() => { // start the clock
            const fpsDesc = App.getFPS().toString();

            const myPlayer = ClientObjectManager.getMyPlayer();
            let x = "?", y = "?", z = "?";
            if (myPlayer)
            {
                x = myPlayer.position.x.toFixed(3);
                y = myPlayer.position.y.toFixed(3);
                z = myPlayer.position.z.toFixed(3);
            }
            const playerPosDesc = `(${x}, ${y}, ${z})`;

            let voxelDesc = "";
            let voxelQuadSelectionDesc = "";
            const voxelQuadSelection = voxelQuadSelectionObservable.peek();
            if (voxelQuadSelection)
            {
                const v = voxelQuadSelection.voxel;
                const quadIndex = voxelQuadSelection.quadIndex;
                const row = VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex);
                const col = VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex);
                const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
                const orientation = VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex);
                const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

                const quad = App.getVoxelQuads()[quadIndex];
                const textureIndex = quad & 0b01111111;

                voxelDesc = `(row: ${v.row}, col: ${v.col}, collisionLayerMask: ${v.collisionLayerMask.toString(2)})`;
                voxelQuadSelectionDesc = `(row: ${row}, col: ${col}, quad: (${orientation}${facingAxis} at layer ${collisionLayer}), texture: ${textureIndex})`;
            }
            setState(prev => ({...prev, fpsDesc, playerPosDesc, voxelDesc, voxelQuadSelectionDesc}));
        }, 250);

        return () => clearInterval(interval); // stop the clock
    }, [state.display]);

    const voxelDescLine = (state.voxelDesc.length > 0)
        ? <><br/>Voxel: {state.voxelDesc}</>
        : null;

    const voxelQuadSelectionDescLine = (state.voxelQuadSelectionDesc.length > 0)
        ? <><br/>VoxelQuad: {state.voxelQuadSelectionDesc}</>
        : null;
    
    return <div className={className}>
        <Button
            name={state.display ? "Close Debugger" : "🔍"}
            size="xs"
            color={state.display ? "red" : "transparent"}
            onClick={() => setState({...state, display: !state.display})}
        />
        {state.display && <div className="m-0 p-1 text-xs text-gray-400 text-nowrap bg-black overflow-auto pointer-events-auto rounded-md">
            Server: {env.serverType}{env.gitCommit ? ` (${env.gitCommit})` : ""}, FPS: {state.fpsDesc}, Position: {state.playerPosDesc}
            <br/>User: {JSON.stringify(App.getUser())}
            {voxelDescLine}
            {voxelQuadSelectionDescLine}
            <br/>
            <div className="flex flex-row items-center gap-1">
                <TextInput size="xs" placeholder="Debug Command"
                    currValue={state.debugCommand}
                    setTextInput={(input: string) => setState({...state, debugCommand: input})}
                />
                <Button name="Run" size="xs" onClick={() => {
                    const command = state.debugCommand.toLowerCase().trim();
                    switch (command)
                    {
                        case "show collider": colliderDebugEnabledObservable.set(true); break;
                        case "hide collider": colliderDebugEnabledObservable.set(false); break;
                        case "show dummy-rooms": roomListDebugEnabledObservable.set(true); break;
                        case "hide dummy-rooms": roomListDebugEnabledObservable.set(false); break;
                        case "show dummy-images": imageListChooserDebugEnabledObservable.set(true); break;
                        case "hide dummy-images": imageListChooserDebugEnabledObservable.set(false); break;
                        case "restart tutorial": void restartTutorial(); break;
                        // Temporary sign-in entry point until the app has a proper place for it.
                        case "login**": PopupUtil.openPopup({popupType: "authPrompt"}); break;
                        case "log": PopupUtil.openPopup({popupType: "consoleLog"}); break;
                        case "lose context": setWebGLContextLost(true); break;
                        case "restore context": setWebGLContextLost(false); break;
                        case "ghost on": setGhostMode(true); break;
                        case "ghost off": setGhostMode(false); break;
                        default: notificationMessageObservable.set("Unknown debug command."); break;
                    }
                    setState({...state, debugCommand: ""});
                }}/>
            </div>
        </div>}
    </div>;
}

// "restart tutorial" debug command. Only allowed when not in a single-player mode (also enforced
// server-side).
async function restartTutorial(): Promise<void>
{
    if (App.getUser().singlePlayerMode != "")
    {
        notificationMessageObservable.set("Cannot restart the tutorial while a single-player mode is in progress.");
        return;
    }
    // The server resets the tutorial state; reload to re-enter it.
    const response = await UserAPIClient.restartTutorial();
    if (response.status >= 200 && response.status < 300)
        window.location.reload();
    else
        notificationMessageObservable.set("Failed to restart the tutorial.");
}

// "lose context" / "restore context" debug commands for testing WebGL context recovery on a real
// device (see GraphicsManager). Staying lost exercises the reload fallback, which won't repeat within
// its cooldown.
function setWebGLContextLost(lost: boolean): void
{
    const loseContextExtension = GraphicsManager.getGameRenderer()
        .getContext().getExtension("WEBGL_lose_context");
    if (loseContextExtension == null)
    {
        notificationMessageObservable.set("This browser cannot simulate WebGL context loss.");
        return;
    }
    if (lost)
        loseContextExtension.loseContext();
    else
        loseContextExtension.restoreContext();
}

// "ghost on" / "ghost off" debug commands. Admin-only (also enforced server-side), and kept in the
// player's AdminPrefs, which the server saves with the rest of its metadata. A single-player room has
// no server to keep it.
function setGhostMode(ghostMode: boolean): void
{
    const room = App.getCurrentRoom();
    const myPlayer = ClientObjectManager.getMyPlayer();
    if (!room || !myPlayer || room.roomType == RoomTypeEnumMap.SinglePlayer)
    {
        notificationMessageObservable.set("Ghost mode can only be changed in a multiplayer room.");
        return;
    }

    const prefs = AdminPrefsUtil.getObjectPrefs(myPlayer.params);
    prefs.ghostMode = ghostMode;
    const key = ObjectMetadataKeyEnumMap.AdminPrefs;
    const value = AdminPrefsUtil.encode(prefs);
    if (!ClientObjectManager.setObjectMetadata(myPlayer.params.objectId, key, value))
    {
        notificationMessageObservable.set("Only an admin can use ghost mode.");
        return;
    }
    SocketsClient.emitSetObjectMetadataSignal(
        new SetObjectMetadataSignal(room.id, myPlayer.params.objectId, key, value));
    notificationMessageObservable.set(ghostMode ? "Ghost mode is on." : "Ghost mode is off.");
}

const className = "flex flex-col justify-start absolute left-0 top-0 max-w-full max-h-1/5";

interface DebugStatsState
{
    display: boolean;
    fpsDesc: string;
    playerPosDesc: string;
    voxelDesc: string;
    voxelQuadSelectionDesc: string;
    debugCommand: string;
}

interface Props
{
    env: ThingsPoolEnv;
}