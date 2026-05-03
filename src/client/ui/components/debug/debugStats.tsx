import { useEffect, useState } from "react";
import App from "../../../app";
import ClientObjectManager from "../../../object/clientObjectManager";
import { notificationMessageObservable, voxelQuadSelectionObservable } from "../../../system/clientObservables";
import { colliderDebugEnabledObservable, editorListDebugEnabledObservable } from "../../../../shared/system/sharedObservables";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import Button from "../basic/button";
import ThingsPoolEnv from "../../../system/types/thingsPoolEnv";
import TextInput from "../basic/textInput";

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
            name={state.display ? "Hide" : "Stats"}
            size="xs"
            onClick={() => setState({...state, display: !state.display})}
        />
        {state.display && <div className="m-0 p-1 text-xs text-gray-400 text-nowrap bg-black overflow-auto pointer-events-auto">
            Server: {env.serverType}{env.gitCommit ? ` (${env.gitCommit})` : ""}, FPS: {state.fpsDesc}, Position: {state.playerPosDesc}
            <br/>User: {JSON.stringify(App.getUser())}
            {voxelDescLine}
            {voxelQuadSelectionDescLine}
            <br/>
            <div className="flex flex-row items-center gap-1">
                <TextInput size="xs" placeholder="Debug Command"
                    textInput={state.debugCommand}
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
                        default: notificationMessageObservable.set("Unknown debug command."); break;
                    }
                    setState({...state, debugCommand: ""});
                }}/>
            </div>
        </div>}
    </div>;
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