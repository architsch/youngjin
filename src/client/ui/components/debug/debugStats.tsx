import { useEffect, useState } from "react";
import App from "../../../app";
import ObjectManager from "../../../object/objectManager";
import { voxelQuadSelectionObservable } from "../../../system/clientObservables";
import { getVoxelColFromQuadIndex, getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex, getVoxelRowFromQuadIndex } from "../../../../shared/voxel/util/voxelQueryUtil";
import Button from "../basic/button";
import { Z_INDEX_HUD_OVERLAY } from "../../../../shared/system/constants";

export default function DebugStats()
{
    const [state, setState] = useState<DebugStatsState>({
        display: false, fpsDesc: "?", playerPosDesc: "?", voxelDesc: "", voxelQuadSelectionDesc: "",
    });

    useEffect(() => {
        if (!state.display)
            return;
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

            let voxelDesc = "";
            let voxelQuadSelectionDesc = "";
            const voxelQuadSelection = voxelQuadSelectionObservable.peek();
            if (voxelQuadSelection)
            {
                const v = voxelQuadSelection.voxel;
                const quadIndex = voxelQuadSelection.quadIndex;
                const row = getVoxelRowFromQuadIndex(quadIndex);
                const col = getVoxelColFromQuadIndex(quadIndex);
                const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
                const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
                const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

                const quad = App.getVoxelQuads()[quadIndex];
                const textureIndex = quad & 0b01111111;

                voxelDesc = `(row: ${v.row}, col: ${v.col}, collisionLayerMask: ${v.collisionLayerMask.toString(2)})`;
                voxelQuadSelectionDesc = `(row: ${row}, col: ${col}, quad: (${orientation}${facingAxis} at layer ${collisionLayer}), texture: ${textureIndex})`;
            }
            setState({...state, fpsDesc, playerPosDesc, voxelDesc, voxelQuadSelectionDesc});
        }, 250);

        return () => clearInterval(interval); // stop the clock
    }, [state.display]);

    const voxelDescLine = (state.voxelDesc.length > 0)
        ? <><br/>Selected Voxel: {state.voxelDesc}</>
        : null;

    const voxelQuadSelectionDescLine = (state.voxelQuadSelectionDesc.length > 0)
        ? <><br/>Selected Voxel Quad: {state.voxelQuadSelectionDesc}</>
        : null;
    
    return <div className={className}>
        <Button
            name={state.display ? "Hide Stats" : "Show Stats"}
            size="xs"
            onClick={() => setState({...state, display: !state.display})}
        />
        {state.display && <div className="w-fit h-fit m-0 p-1 text-xs text-gray-400 bg-black">
            FPS: {state.fpsDesc}
            <br/>Position: {state.playerPosDesc}
            {voxelDescLine}
            {voxelQuadSelectionDescLine}
        </div>}
    </div>;
}

const className = `flex flex-col absolute left-0 top-0 ${Z_INDEX_HUD_OVERLAY}`;

interface DebugStatsState
{
    display: boolean;
    fpsDesc: string;
    playerPosDesc: string;
    voxelDesc: string;
    voxelQuadSelectionDesc: string;
}