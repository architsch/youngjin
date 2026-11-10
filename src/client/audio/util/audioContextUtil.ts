// The inputs that let a page make sound: the HTML standard's activation-triggering events, and touchend for older Safari.
export const AUDIO_UNLOCKING_EVENT_TYPES = ["pointerdown", "pointerup", "keydown", "touchend", "click"];

let context: AudioContext | undefined;
let onCreated: ((context: AudioContext) => void) | undefined;
// Whether the user has let the page make sound, by an input or by having used the page before it was made.
let unlocked = false;

// The page's one AudioContext, made at once on a page the user has already used and else at their first input: a browser
// keeps a page silent until then, and warns of a context made sooner. It is suspended while the page is hidden, where no
// frame runs to keep what is heard in step with the room.
const AudioContextUtil =
{
    install: (onContextCreated: (context: AudioContext) => void): void =>
    {
        if (onCreated != undefined)
            return;
        onCreated = onContextCreated;
        for (const type of AUDIO_UNLOCKING_EVENT_TYPES)
            window.addEventListener(type, onInput, {capture: true, passive: true});
        document.addEventListener("visibilitychange", onVisibilityChange);
        if (navigator.userActivation?.hasBeenActive)
            createContext();
    },
    get: (): AudioContext | undefined =>
    {
        return context;
    },
    // Whether a sound started now is heard now, rather than saved up for later: not before the user's first input, nor
    // while the page is hidden.
    isAudible: (): boolean =>
    {
        return context != undefined && unlocked && document.visibilityState == "visible";
    },
}

function createContext(): void
{
    try
    {
        context = new AudioContext();
    }
    catch (err)
    {
        console.warn("AudioContextUtil :: This browser can't make sound", err);
        for (const type of AUDIO_UNLOCKING_EVENT_TYPES)
            window.removeEventListener(type, onInput, true);
        return;
    }
    context.addEventListener("statechange", () => {
        if (context!.state == "running")
            unlocked = true;
    });
    onCreated!(context);
}

function onInput(): void
{
    if (context == undefined)
        createContext();
    if (context == undefined)
        return;
    unlocked = true;
    tryResume();
}

function onVisibilityChange(): void
{
    if (context == undefined)
        return;
    if (document.visibilityState == "hidden")
        context.suspend().catch(() => {});
    else if (unlocked)
        tryResume();
}

// Also after an interruption, such as a call taking the sound on a phone.
function tryResume(): void
{
    if (context!.state != "running" && document.visibilityState == "visible")
        context!.resume().catch(() => {});
}

export default AudioContextUtil;
