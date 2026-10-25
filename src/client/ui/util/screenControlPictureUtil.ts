import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ScreenControl } from "../../../shared/object/types/screenControl";
import ScreenControlPicture from "../components/basic/screenControlPicture";

// How wide each picture is drawn (see ScreenControlPicture), in characters of the monospace text around it.
const widthsInChars: {[control in ScreenControl]: number} = {
    modeSwitch: 10, messageBox: 11, send: 6, clear: 3, addBlock: 3, trash: 3, addPainting: 3, addObject: 3, addLamp: 3,
    addFan: 3, rotate: 3, person: 3,
};
// Each picture drawn by React once, to be copied after.
const drawn = new Map<ScreenControl, Element>();

// Pictures of controls on the screen for what React doesn't draw (see SpeechBubble).
const ScreenControlPictureUtil =
{
    create: (control: ScreenControl): Element =>
    {
        let picture = drawn.get(control);
        if (picture == undefined)
        {
            const container = document.createElement("span");
            const root = createRoot(container);
            flushSync(() => root.render(createElement(ScreenControlPicture, {control})));
            picture = container.firstElementChild!.cloneNode(true) as Element;
            root.unmount();
            drawn.set(control, picture);
        }
        return picture.cloneNode(true) as Element;
    },
    getWidthInChars: (control: ScreenControl): number =>
    {
        return widthsInChars[control];
    },
}

export default ScreenControlPictureUtil;
