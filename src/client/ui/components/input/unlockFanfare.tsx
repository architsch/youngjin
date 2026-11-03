import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import UnlockBurstUtil from "../../util/unlockBurstUtil";

// A firework of sparks out of the tile it is put in (see UnlockBurstUtil), on a canvas over the whole screen: put under the
// page itself, since what the tile lies in would clip it, or move it with the panel.
export default function UnlockFanfare({ onFinished }: Props)
{
    const anchorRef = useRef<HTMLSpanElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const tile = anchorRef.current?.parentElement?.getBoundingClientRect();
        const canvas = canvasRef.current;
        if (tile == undefined || canvas == null)
        {
            onFinished();
            return;
        }
        return UnlockBurstUtil.play(canvas, tile, onFinished);
    }, []);

    return <span ref={anchorRef} className="hidden">
        {createPortal(<canvas ref={canvasRef} className="fixed inset-0 z-55 w-screen h-screen pointer-events-none"/>,
            document.body)}
    </span>;
}

interface Props
{
    onFinished: () => void;
}
