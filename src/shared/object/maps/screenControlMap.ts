import { ScreenControl } from "../types/screenControl";

// The controls on a player's screen a message can show a picture of, written <control name="..."/> (see
// MessageLinkUtil), and the words each is told in to whoever has no screen (agents), which it counts as toward a
// message's length.
const words: {[control in ScreenControl]: string} = {
    modeSwitch: "Play/Edit switch",
    messageBox: "Your Message box",
    send: "Send button",
    clear: "X button",
    addBlock: "cube button",
    trash: "trash can button",
    addPainting: "picture button",
    addObject: "cart button",
    addLamp: "sun button",
    addFan: "pinwheel button",
    rotate: "turn button",
    person: "person button",
};

const ScreenControlMap =
{
    getControls: (): ScreenControl[] =>
    {
        return Object.keys(words) as ScreenControl[];
    },
    // The control a name stands for, letter case aside, or undefined for any other.
    read: (name: string): ScreenControl | undefined =>
    {
        const lowerCase = name.trim().toLowerCase();
        return ScreenControlMap.getControls().find(control => control.toLowerCase() == lowerCase);
    },
    getWords: (control: ScreenControl): string =>
    {
        return words[control];
    },
}

export default ScreenControlMap;
