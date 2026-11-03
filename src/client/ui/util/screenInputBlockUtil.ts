import KeyPressUtil from "./keyPressUtil";

// What a hold keeps from the page: whatever starts a press, a click, a scroll or a key. Whatever ends one still passes, so
// that nothing held down when a hold starts is left stuck.
const HELD_EVENT_TYPES = ["pointerdown", "mousedown", "touchstart", "click", "dblclick", "auxclick", "contextmenu", "wheel"];
const HELD_KEY_EVENT_TYPE = "keydown";

let numHolds = 0;

// Holds the whole screen from the user, and shows nothing of it, while something under way is not to be interfered with:
// a purchase awaiting its answer (see PlayerShapeUnlockUtil), and then the burst of what it unlocked (see UnlockBurstUtil). Installed before anything else listens, so that a held event is stopped at the window as it
// sets out, before it reaches anything. A key still does what the browser does with it (a reload, say), but nothing here,
// and Escape not even that.
const ScreenInputBlockUtil =
{
    install: (): void =>
    {
        for (const type of HELD_EVENT_TYPES)
            window.addEventListener(type, holdEvent, {capture: true, passive: false});
        window.addEventListener(HELD_KEY_EVENT_TYPE, holdKey, true);
    },
    // Starts a hold, and returns what ends it, once however often it is called.
    hold: (): (() => void) =>
    {
        ++numHolds;
        let ended = false;
        return () => {
            if (ended)
                return;
            ended = true;
            --numHolds;
        };
    },
}

function holdEvent(ev: Event): void
{
    if (numHolds == 0)
        return;
    ev.stopImmediatePropagation();
    ev.preventDefault();
}

function holdKey(ev: Event): void
{
    if (numHolds == 0)
        return;
    ev.stopImmediatePropagation();
    // Escape's close request, which the browser makes of it unless kept from it, would close a panel all the same (see
    // useCloseGesture).
    if (KeyPressUtil.isEscape(ev as KeyboardEvent))
        ev.preventDefault();
}

export default ScreenInputBlockUtil;
