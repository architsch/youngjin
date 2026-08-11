import { useEffect, useState } from "react";
import Icon from "../../basic/icon";
import RangeInput from "../../input/rangeInput";
import MagnifierMinusIcon from "../../../svg/icons/magnifierMinusIcon";
import MagnifierPlusIcon from "../../../svg/icons/magnifierPlusIcon";
import { cameraModeObservable, orbitCameraZoomObservable } from "../../../../system/clientObservables";

// Fine enough that the view answers the handle continuously rather than in visible jumps, and
// coarse enough that a step of it is still a step: the track is a couple of finger-widths wide.
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
// It appears only while the camera is actually orbiting. Selecting something puts a user who may
// edit the room into an orbit around it, but leaves everyone else in the first-person view, where
// there is no zoom to speak of and a control offering one would be a lie.
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

    // The tray stands as tall as a medium button, since the button ending the mode is what it shares
    // its row with and two controls of unequal height read as two unrelated things. It is also the
    // one thing in that row allowed to shrink (min-w-0 lets it fall below the width of what it
    // holds, which flexbox otherwise refuses), and it spends that shrinking on the track alone: the
    // two magnifiers keep their size, so the control says what it is at every width it reaches.
    return <div className="flex flex-row items-center gap-1.5 h-10 min-w-0 px-2 bg-gray-800 rounded-md pointer-events-auto yj-surface-convex">
        <Icon icon={<MagnifierMinusIcon/>} size="sm" additionalClassNames="text-gray-300"/>
        <RangeInput
            currValue={zoomAmount.toString()}
            setValue={(value: string) => orbitCameraZoomObservable.set(Number(value))}
            min="0"
            max="1"
            step={zoomStep.toString()}
            additionalClassNames="w-32 min-w-0"
        />
        <Icon icon={<MagnifierPlusIcon/>} size="sm" additionalClassNames="text-gray-300"/>
    </div>;
}
