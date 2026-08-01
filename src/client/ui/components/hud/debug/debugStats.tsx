import { useEffect, useState } from "react";
import App from "../../../../app";
import ClientObjectManager from "../../../../object/clientObjectManager";
import { notificationMessageObservable, voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import { colliderDebugEnabledObservable, editorListDebugEnabledObservable, imageListChooserDebugEnabledObservable, roomListDebugEnabledObservable } from "../../../../../shared/system/sharedObservables";
import VoxelQueryUtil from "../../../../../shared/voxel/util/voxelQueryUtil";
import Button from "../../input/button";
import ThingsPoolEnv from "../../../../system/types/thingsPoolEnv";
import TextInput from "../../input/textInput";
import UserAPIClient from "../../../../networking/client/userAPIClient";
import PopupUtil from "../../../util/popupUtil";
import GraphicsManager from "../../../../graphics/graphicsManager";

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
                        case "show dummy-editors": editorListDebugEnabledObservable.set(true); break;
                        case "hide dummy-editors": editorListDebugEnabledObservable.set(false); break;
                        case "show dummy-rooms": roomListDebugEnabledObservable.set(true); break;
                        case "hide dummy-rooms": roomListDebugEnabledObservable.set(false); break;
                        case "show dummy-images": imageListChooserDebugEnabledObservable.set(true); break;
                        case "hide dummy-images": imageListChooserDebugEnabledObservable.set(false); break;
                        case "restart tutorial": void restartTutorial(); break;
                        case "log": PopupUtil.openPopup({popupType: "consoleLog"}); break;
                        case "lose context": setWebGLContextLost(true); break;
                        case "restore context": setWebGLContextLost(false); break;
                        default: notificationMessageObservable.set("Unknown debug command."); break;
                    }
                    setState({...state, debugCommand: ""});
                }}/>
            </div>
        </div>}
    </div>;
}

// "restart tutorial" debug command: send a user who has already finished the single-player
// experience back through the tutorial (handy for testing tutorial gameplay in live/staging).
// Rejected here (and on the server) unless the user is not currently in any single-player mode.
async function restartTutorial(): Promise<void>
{
    if (App.getUser().singlePlayerMode != "")
    {
        notificationMessageObservable.set("Cannot restart the tutorial while a single-player mode is in progress.");
        return;
    }
    // The server clears the "tutorial finished" cookie and flips the persisted singlePlayerMode back
    // to the tutorial; reloading re-enters the tutorial from a clean page load.
    const response = await UserAPIClient.restartTutorial();
    if (response.status >= 200 && response.status < 300)
        window.location.reload();
    else
        notificationMessageObservable.set("Failed to restart the tutorial.");
}

// "lose context" / "restore context" debug commands: throw the WebGL drawing context away on
// purpose, and hand it back again. Losing it is what a mobile browser does to a tab whose GPU memory
// it has decided to reclaim, and it cannot be asked to do so on demand — so these are the only
// practical way to watch the recovery path (see GraphicsManager) do its work on the device the
// problem actually happens on. Losing the context and leaving it lost exercises the last resort (a
// page reload, once the grace period is up); restoring it exercises recovery in place.
//
// Worth knowing when testing: that reload will not happen twice in quick succession, because
// GraphicsManager declines to repeat one it has only just performed. The console says as much when
// it declines, and a tab opened afresh starts over with no such history.
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