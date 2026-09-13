import { useEffect, useState } from "react";
import Icon from "../../basic/icon";
import RangeInput from "../../input/rangeInput";
import MagnifierMinusIcon from "../../../svg/icons/magnifierMinusIcon";
import MagnifierPlusIcon from "../../../svg/icons/magnifierPlusIcon";
import { cameraModeObservable, orbitCameraZoomObservable } from "../../../../system/clientObservables";

const zoomStep = 0.01;

// Vertical orbit zoom slider at the right screen edge, shown only in edit mode. Shares
// orbitCameraZoomObservable with pinch and wheel, so they stay in sync. No numeric readout (zoom is
// judged by eye). Icons have outlines to stay legible over the scene.

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
