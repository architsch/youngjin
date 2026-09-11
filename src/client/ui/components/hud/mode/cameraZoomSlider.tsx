import { useEffect, useState } from "react";
import Icon from "../../basic/icon";
import RangeInput from "../../input/rangeInput";
import MagnifierMinusIcon from "../../../svg/icons/magnifierMinusIcon";
import MagnifierPlusIcon from "../../../svg/icons/magnifierPlusIcon";
import { cameraModeObservable, orbitCameraZoomObservable } from "../../../../system/clientObservables";

// Fine enough that the view answers the handle continuously rather than in visible jumps, and
// coarse enough that a step of it is still a step: the track is a couple of finger-widths long.
const zoomStep = 0.01;

//------------------------------------------------------------------------
// The camera's zoom, as something the user can see and take hold of.
//
// Zooming has always been possible — a pinch, or the wheel — but neither gesture says it exists,
// and neither says where the view currently stands within what the mode allows. A slider says both
// at once: a magnifier at each end of its travel says which way is which, and the handle's place
// along it is the answer to "how far in am I, and how much further can I go".
//
// It shows the zoom and sets it through the same value (orbitCameraZoomObservable), which is what
// keeps the two in step: a pinch or a wheel notch moves the handle exactly as if the user had
// dragged it there, and dragging it does exactly what a gesture would have done.
//
// It appears only while the camera is actually orbiting, which is to say in edit mode: the
// first-person view of play mode has no zoom to speak of, and a control offering one would be a lie.
//
// It stands upright against the right-hand edge of the screen, with nothing behind it. Edit mode is
// spent looking at the room, and this is on screen for the whole of it, so it keeps to the narrowest
// strip it can — no wider than its handle, at the edge where it takes the least of a portrait phone's
// view. With no tray to stand out against, the magnifiers carry a dark outline of their own to stay
// legible over whatever the room behind them is.
//
// The track carries no number beside it. Zoom is the one setting here that is read off the view
// rather than off a figure — the user zooms until the room looks right, and a number saying how far
// along the travel that landed is not something anyone would type, note down or tell somebody.
//------------------------------------------------------------------------

export default function CameraZoomSlider()
{
    const [zoomAmount, setZoomAmount] = useState<number>(orbitCameraZoomObservable.peek());
    const [isOrbiting, setIsOrbiting] = useState<boolean>(cameraModeObservable.peek().type === "orbit");

    useEffect(() => {
        orbitCameraZoomObservable.addListener("ui.cameraZoomSlider", setZoomAmount);
        cameraModeObservable.addListener("ui.cameraZoomSlider",
            (mode) => setIsOrbiting(mode.type === "orbit"));
        return () => {
            orbitCameraZoomObservable.removeListener("ui.cameraZoomSlider");
            cameraModeObservable.removeListener("ui.cameraZoomSlider");
        };
    }, []);

    if (!isOrbiting)
        return null;

    // Zooming in is at the top, since a track standing upright reads as "more" the higher it goes.
    return <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pointer-events-auto">
        <Icon icon={<MagnifierPlusIcon/>} size="sm" additionalClassNames={ICON_CLASS_NAMES}/>
        <RangeInput
            currValue={zoomAmount.toString()}
            setValue={(value: string) => orbitCameraZoomObservable.set(Number(value))}
            min="0"
            max="1"
            step={zoomStep.toString()}
            showValueInput={false}
            orientation="vertical"
            additionalClassNames="h-[min(40vh,12rem)]"
        />
        <Icon icon={<MagnifierMinusIcon/>} size="sm" additionalClassNames={ICON_CLASS_NAMES}/>
    </div>;
}

// Light, with a dark outline drawn all the way round it, the way the lettering over the scene is.
const ICON_CLASS_NAMES = "text-gray-100 [filter:drop-shadow(0_0_1px_black)_drop-shadow(0_0_1px_black)]";
