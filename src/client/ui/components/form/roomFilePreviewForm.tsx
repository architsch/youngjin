import { useEffect, useRef } from "react";
import Text from "../basic/text";
import ConfirmButtons from "../input/confirmButtons";
import RoomFilePreviewProps from "../../types/roomFilePreviewProps";

// Asks whether a room file is to be loaded over the room, over a picture of the room it holds (see
// LocalRoomFileUtil). The picture takes the popup's whole width, so nothing here is padded, and the rest is as wide.
export default function RoomFilePreviewForm({ image, width, onConfirm, onCancel }: RoomFilePreviewProps)
{
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        canvasRef.current?.getContext("2d")?.putImageData(image, 0, 0);
    }, [image]);

    // pointer-events-auto re-enables interaction inside #uiRoot's pointer-events-none layer.
    return <div id="roomFilePreview" style={{width}} className="flex flex-col gap-2 max-w-[80vw] pointer-events-auto">
        <Text content="Overwrite this room with the one shown?" size="sm"/>
        <canvas ref={canvasRef} width={image.width} height={image.height}
            className="block w-full h-auto rounded-md yj-surface-concave"/>
        <ConfirmButtons onConfirm={onConfirm} onCancel={onCancel}/>
    </div>
}
