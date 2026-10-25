import { ReactNode } from "react";
import { ScreenControl } from "../../../../shared/object/types/screenControl";
import ScreenControlMap from "../../../../shared/object/maps/screenControlMap";
import TrashIcon from "../../svg/icons/trashIcon";
import AddBlockIcon from "../../svg/icons/addBlockIcon";
import AddCanvasIcon from "../../svg/icons/addCanvasIcon";
import AddPropIcon from "../../svg/icons/addPropIcon";
import AddLampIcon from "../../svg/icons/addLampIcon";
import AddFanIcon from "../../svg/icons/addFanIcon";
import RotateClockwiseIcon from "../../svg/icons/rotateClockwiseIcon";
import CloseIcon from "../../svg/icons/closeIcon";
import PersonIcon from "../../svg/icons/personIcon";

// A still copy of a control on the screen, standing in a line of text for its name (see MessageLinkUtil): drawn as the
// control is, with its icon and face, but sized by the text around it, and taking no presses.
export default function ScreenControlPicture({control}: Props)
{
    return <span role="img" aria-label={ScreenControlMap.getWords(control)}
        className="inline-flex items-center align-middle mx-[0.1em] -my-[0.25em] pointer-events-none select-none">
        {draw(control)}
    </span>;
}

function draw(control: ScreenControl): ReactNode
{
    switch (control)
    {
        case "modeSwitch":
            // As in Play mode, from which it is first switched (see GameModeToggleSwitch).
            return <span className="inline-flex items-center gap-[0.4em] font-semibold yj-text-outline">
                <span className="text-[0.7em] text-pink-300">Play</span>
                <span className="relative w-[2.2em] h-[1.2em] rounded-full border-[0.1em] border-black bg-pink-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
                    <span className="absolute top-[0.1em] left-[0.1em] size-[0.8em] rounded-full border border-black bg-linear-to-b from-white to-gray-400 shadow-[0_1px_2px_rgba(0,0,0,0.6)]"/>
                </span>
                <span className="text-[0.7em] text-gray-400">Edit</span>
            </span>;
        case "messageBox":
            // Empty, showing its placeholder (see ChatTextInput).
            return <span className="flex items-center h-[1.5em] px-[0.4em] rounded-[0.25em] bg-gray-200 text-gray-500 yj-surface-concave">
                <span className="text-[0.85em]">Your Message</span>
            </span>;
        case "send":
            return <span className="flex items-center h-[1.5em] px-[0.45em] rounded-[0.25em] font-semibold yj-panel-green pointer-events-none">
                <span className="text-[0.85em]">Send</span>
            </span>;
        case "clear":
            return button("yj-panel-gray", <CloseIcon/>);
        case "addBlock":
            return button("yj-panel-gray", <AddBlockIcon/>);
        case "trash":
            return button("yj-panel-red", <TrashIcon/>);
        case "addPainting":
            return button("yj-panel-gray", <AddCanvasIcon/>);
        case "addObject":
            return button("yj-panel-gray", <AddPropIcon/>);
        case "addLamp":
            return button("yj-panel-gray", <AddLampIcon/>);
        case "addFan":
            return button("yj-panel-gray", <AddFanIcon/>);
        case "rotate":
            return button("yj-panel-gray", <RotateClockwiseIcon/>);
        case "person":
            return button("yj-panel-gray", <PersonIcon/>);
    }
}

// As IconButton draws one.
function button(face: string, icon: ReactNode): ReactNode
{
    return <span className={`flex items-center justify-center size-[1.5em] p-[0.2em] rounded-[0.25em] ${face} pointer-events-none`}>
        {icon}
    </span>;
}

interface Props
{
    control: ScreenControl;
}
