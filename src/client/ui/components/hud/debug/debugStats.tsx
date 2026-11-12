import { useEffect, useRef, useState } from "react";
import App from "../../../../app";
import ClientObjectManager from "../../../../object/clientObjectManager";
import { debugPanelOpenObservable, popupStateObservable,
    voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import VoxelQueryUtil from "../../../../../shared/voxel/util/voxelQueryUtil";
import Button from "../../input/button";
import ThingsPoolEnv from "../../../../system/types/thingsPoolEnv";
import TextInput from "../../input/textInput";
import GraphicsManager from "../../../../graphics/graphicsManager";
import ParticleSystem from "../../../../graphics/particle/particleSystem";
import DebugCommandUtil from "../../../../system/util/debugCommandUtil";

// The debug panel, which shows nothing until it is opened (see DebugPanelUtil).
export default function DebugStats({env}: Props)
{
    const [display, setDisplay] = useState<boolean>(debugPanelOpenObservable.peek());
    const [state, setState] = useState<DebugStatsState>({
        fpsDesc: "?", playerPosDesc: "?", particleDesc: "?", voxelDesc: "", voxelQuadSelectionDesc: "", debugCommand: "",
    });
    const commandFieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

    useEffect(() => {
        debugPanelOpenObservable.addListener("ui.debugStats", setDisplay);
        return () => debugPanelOpenObservable.removeListener("ui.debugStats");
    }, []);

    // The command field has the keyboard from the moment the panel opens.
    useEffect(() => {
        if (display)
            commandFieldRef.current?.focus();
    }, [display]);

    useEffect(() => {
        if (!display)
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

            // Draw calls are the last frame's (the renderer resets its count per render).
            const particleStats = ParticleSystem.getStats();
            const particleDesc = `${particleStats.particles} particles, ${particleStats.sprites} sprites, ` +
                `${particleStats.overwrites} overwritten, draw calls: ` +
                `${GraphicsManager.getGameRenderer().info.render.calls}`;

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

                voxelDesc = `(row: ${v.row}, col: ${v.col}, layers with a block: ${v.blockLayerMask.toString(2)})`;
                voxelQuadSelectionDesc = `(row: ${row}, col: ${col}, quad: (${orientation}${facingAxis} at layer ${collisionLayer}), texture: ${textureIndex})`;
            }
            setState(prev => ({...prev, fpsDesc, playerPosDesc, particleDesc, voxelDesc, voxelQuadSelectionDesc}));
        }, 250);

        return () => clearInterval(interval); // stop the clock
    }, [display]);

    if (!display)
        return null;

    const voxelDescLine = (state.voxelDesc.length > 0)
        ? <><br/>Voxel: {state.voxelDesc}</>
        : null;

    const voxelQuadSelectionDescLine = (state.voxelQuadSelectionDesc.length > 0)
        ? <><br/>VoxelQuad: {state.voxelQuadSelectionDesc}</>
        : null;

    // The field takes the keyboard back for the next command, unless this one opened a popup, which has the user now.
    const runCommand = () => {
        DebugCommandUtil.run(state.debugCommand);
        setState(prev => ({...prev, debugCommand: ""}));
        if (popupStateObservable.peek().popupType == "none")
            commandFieldRef.current?.focus();
        else
            commandFieldRef.current?.blur();
    };

    return <div className={className}>
        <Button name="Close Debugger" size="xs" color="red" onClick={() => debugPanelOpenObservable.set(false)}/>
        <div className="m-0 p-1 text-xs text-gray-400 text-nowrap bg-black overflow-auto pointer-events-auto rounded-md">
            Server: {env.serverType}{env.gitCommit ? ` (${env.gitCommit})` : ""}, FPS: {state.fpsDesc}, Position: {state.playerPosDesc}
            <br/>User: {JSON.stringify(App.getUser())}
            <br/>Particles: {state.particleDesc}
            {voxelDescLine}
            {voxelQuadSelectionDescLine}
            <br/>
            <div className="flex flex-row items-center gap-1">
                <TextInput size="xs" placeholder="Debug Command" fieldRef={commandFieldRef}
                    currValue={state.debugCommand}
                    setTextInput={(input: string) => setState(prev => ({...prev, debugCommand: input}))}
                    onEnter={() => { if (state.debugCommand.trim().length > 0) runCommand(); }}
                />
                <Button name="Run" size="xs" onClick={runCommand}/>
            </div>
        </div>
    </div>;
}

const className = "flex flex-col justify-start absolute left-0 top-0 max-w-full max-h-1/5";

interface DebugStatsState
{
    fpsDesc: string;
    playerPosDesc: string;
    particleDesc: string;
    voxelDesc: string;
    voxelQuadSelectionDesc: string;
    debugCommand: string;
}

interface Props
{
    env: ThingsPoolEnv;
}