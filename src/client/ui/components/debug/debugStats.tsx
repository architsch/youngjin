import { CSSProperties, useEffect, useState } from "react";
import App from "../../../app";
import ObjectManager from "../../../object/objectManager";

export default function DebugStats()
{
    const [state, setState] = useState<DebugStatsState>({fps: "?", playerPos: "?"});

    useEffect(() => {
        const interval = setInterval(() => { // start the clock
            const fps = App.getFPS().toString();
            const myPlayer = ObjectManager.getMyPlayer();
            let x = "?", y = "?", z = "?";
            if (myPlayer)
            {
                x = myPlayer.position.x.toFixed(3);
                y = myPlayer.position.y.toFixed(3);
                z = myPlayer.position.z.toFixed(3);
            }
            const playerPos = `(${x}, ${y}, ${z})`;
            setState({fps, playerPos});
        }, 250);

        return () => clearInterval(interval); // stop the clock
    }, []);

    return <div style={style}>
        FPS: {state.fps}<br/>Position: {state.playerPos}
    </div>;
}

interface DebugStatsState
{
    fps: string;
    playerPos: string;
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