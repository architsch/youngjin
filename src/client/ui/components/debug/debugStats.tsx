import { CSSProperties, useEffect, useState } from "react";
import App from "../../../app";
import ObjectManager from "../../../object/objectManager";
import { voxelQuadSelectionObservable } from "../../../system/observables";

export default function DebugStats()
{
    const [state, setState] = useState<DebugStatsState>({
        fpsDesc: "?", playerPosDesc: "?", voxelQuadSelectionDesc: "",
    });

    useEffect(() => {
        const interval = setInterval(() => { // start the clock
            const fpsDesc = App.getFPS().toString();

            const myPlayer = ObjectManager.getMyPlayer();
            let x = "?", y = "?", z = "?";
            if (myPlayer)
            {
                x = myPlayer.position.x.toFixed(3);
                y = myPlayer.position.y.toFixed(3);
                z = myPlayer.position.z.toFixed(3);
            }
            const playerPosDesc = `(${x}, ${y}, ${z})`;

            let voxelQuadSelectionDesc = "";
            const voxelQuadSelection = voxelQuadSelectionObservable.peek();
            if (voxelQuadSelection)
            {
                const v = voxelQuadSelection.voxel;
                const q = voxelQuadSelection.voxelQuad;
                voxelQuadSelectionDesc = `(row: ${v.row}, col: ${v.col}, quad: (${q.facingAxis}${q.orientation} at y=${q.yOffset}), texture: ${q.textureIndex})`;
            }

            setState({fpsDesc, playerPosDesc, voxelQuadSelectionDesc});
        }, 250);

        return () => clearInterval(interval); // stop the clock
    }, []);

    const voxelQuadSelectionDescLine = (state.voxelQuadSelectionDesc.length > 0)
        ? <><br/>Selected Voxel Quad: {state.voxelQuadSelectionDesc}</>
        : null;
    
    return <div style={style}>
        FPS: {state.fpsDesc}
        <br/>Position: {state.playerPosDesc}
        {voxelQuadSelectionDescLine}
    </div>;
}

interface DebugStatsState
{
    fpsDesc: string;
    playerPosDesc: string;
    voxelQuadSelectionDesc: string;
}

const style: CSSProperties = {
    position: "absolute",
    top: "0",
    left: "0",
    margin: "0 0",
    padding: "4px 4px",
    height: "auto",
    fontSize: "10px",
    lineHeight: "12px",
    backgroundColor: "black",
    color: "white",
};