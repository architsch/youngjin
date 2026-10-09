import { ShortcutKey } from "../types/shortcutKey";
import KeyPressUtil from "./keyPressUtil";

// The controls on screen that a shortcut key stands for a click on (newest last). Controls register themselves from
// anywhere in the tree (see useShortcutKey); whether a press reaches one is decided where the keys are listened
// for (see useShortcutKeyListener).

const controls: {token: number, key: ShortcutKey, click: () => void}[] = [];
let nextToken = 0;

const ShortcutKeyUtil =
{
    // Enters a control on the list, returning the token it is to be taken off again by.
    register: (key: ShortcutKey, click: () => void): number =>
    {
        const token = nextToken++;
        controls.push({token, key, click});
        return token;
    },
    unregister: (token: number): void =>
    {
        const index = controls.findIndex(control => control.token == token);
        if (index >= 0)
            controls.splice(index, 1);
    },
    // Clicks the newest control the key stands for.
    press: (key: ShortcutKey): void =>
    {
        for (let i = controls.length - 1; i >= 0; --i)
        {
            if (controls[i].key == key)
            {
                controls[i].click();
                return;
            }
        }
    },
    // The shortcut key a keydown presses, if any.
    fromKeyDown: (ev: KeyboardEvent): ShortcutKey | undefined =>
    {
        // A keydown the browser fires as it autofills a field names no key.
        if (ev.key == undefined || !KeyPressUtil.isPlain(ev))
            return undefined;
        if (ev.key == "Enter" || ev.key == "Delete")
            return ev.key;
        return KeyPressUtil.typesLetter(ev, "m") ? "M" : undefined;
    },
}

export default ShortcutKeyUtil;
