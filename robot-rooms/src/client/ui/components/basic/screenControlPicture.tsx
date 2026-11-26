import { ReactNode } from "react";
import { ScreenControl } from "../../../../shared/object/types/screenControl";
import ScreenControlMap from "../../../../shared/object/maps/screenControlMap";
import { ButtonMark } from "../../types/buttonMark";
import TrashIcon from "../../svg/icons/trashIcon";
import AddBlockIcon from "../../svg/icons/addBlockIcon";
import RotateClockwiseIcon from "../../svg/icons/rotateClockwiseIcon";
import CloseIcon from "../../svg/icons/closeIcon";
import PersonIcon from "../../svg/icons/personIcon";
import ButtonMarkIcon from "../../svg/icons/buttonMarkIcon";

// A still copy of a control on the screen, standing in a line of text for its name (see MessageLinkUtil): drawn as the
// control is, with its icon or words and its face, but sized by the text around it, and taking no presses.
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
            return textButton("yj-panel-green", "Send");
        case "clear":
            return button("yj-panel-gray", <CloseIcon/>);
        case "addBlock":
            return button("yj-panel-gray", <AddBlockIcon/>);
        case "trash":
            return button("yj-panel-red", <TrashIcon/>);
        case "addPainting":
            return textButton("yj-panel-gray", "Canvas", "add");
        case "addObject":
            return textButton("yj-panel-gray", "Prop", "add");
        case "addLamp":
            return textButton("yj-panel-gray", "Lamp", "add");
        case "addFan":
            return textButton("yj-panel-gray", "Fan", "add");
        // Without the price beside it, which a line of text has no room for.
        case "addCannon":
            return textButton("yj-panel-gray", "Cannon", "add");
        case "rotate":
            return button("yj-panel-gray", <RotateClockwiseIcon/>);
        case "person":
            return button("yj-panel-gray", <PersonIcon/>);
        // Without the prices under them (see PetEditOptions).
        case "battery":
            return textButton("yj-panel-gray", "Charge");
        case "wrench":
            return textButton("yj-panel-gray", "Repair");
        // The buttons that raise the add buttons of a kind (see VoxelQuadPlacementOptions).
        case "decorationMenu":
            return textButton("yj-panel-gray", "Decor", "more");
        case "machineMenu":
            return textButton("yj-panel-gray", "Toy", "more");
        case "companionMenu":
            return textButton("yj-panel-gray", "Robot", "more");
        case "addPet":
            return textButton("yj-panel-gray", "Pet", "add");
    }
}

// As IconButton draws one.
function button(face: string, icon: ReactNode): ReactNode
{
    return <span className={`flex items-center justify-center size-[1.5em] p-[0.2em] rounded-[0.25em] ${face} pointer-events-none`}>
        {icon}
    </span>;
}

// As Button draws one, its mark in the corner beside its words.
function textButton(face: string, words: string, mark?: ButtonMark): ReactNode
{
    return <span className={`relative flex items-center h-[1.5em] ${mark == undefined ? "px-[0.45em]" : "px-[0.6em]"} rounded-[0.25em] font-semibold ${face} pointer-events-none`}>
        <span className="text-[0.85em]">{words}</span>
        {mark != undefined && <span className="absolute top-[0.05em] right-[0.05em] size-[0.35em]">
            <ButtonMarkIcon mark={mark}/>
        </span>}
    </span>;
}

interface Props
{
    control: ScreenControl;
}
