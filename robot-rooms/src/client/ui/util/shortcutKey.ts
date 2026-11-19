import { useEffect, useRef } from "react";
import { ShortcutKey } from "../types/shortcutKey";
import ShortcutKeyUtil from "./shortcutKeyUtil";

// Has a key stand for a click on the calling control for as long as the control is on screen (see ShortcutKeyUtil).
// While the control is disabled the key still goes to it, and does nothing, as a click on it would.
export default function useShortcutKey(key: ShortcutKey | undefined, click: () => void, enabled: boolean = true): void
{
    // A ref keeps one registration, in the order the controls came on screen, while still following the latest props.
    const clickRef = useRef<(() => void) | undefined>(undefined);
    clickRef.current = enabled ? click : undefined;

    useEffect(() => {
        if (key == undefined)
            return;
        const token = ShortcutKeyUtil.register(key, () => clickRef.current?.());
        return () => ShortcutKeyUtil.unregister(token);
    }, [key]);
}
