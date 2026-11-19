import AudioStreamElement from "../types/audioStreamElement";
import { AUDIO_UNLOCKING_EVENT_TYPES } from "./audioContextUtil";

// Let go of, for the next stream to play through.
const pool: AudioStreamElement[] = [];
const playing: Set<AudioStreamElement> = new Set();
// Refused by the browser until the user's next input.
const blocked: Set<AudioStreamElement> = new Set();
let installed = false;

// The media elements streams play through (see StreamedClipPlayer). Each feeds the context, so that a stream is heard
// through a voice as a clip from the bundle is. A browser may refuse one until the next input, and one plays on unheard
// while the page is hidden, so it waits instead.
const AudioStreamUtil =
{
    take: (context: AudioContext): AudioStreamElement =>
    {
        if (!installed)
        {
            installed = true;
            for (const type of AUDIO_UNLOCKING_EVENT_TYPES)
                window.addEventListener(type, retryBlocked, {capture: true, passive: true});
            document.addEventListener("visibilitychange", onVisibilityChange);
        }
        return pool.pop() ?? createStreamElement(context);
    },
    play: (stream: AudioStreamElement, url: string): void =>
    {
        stream.element.src = url;
        playing.add(stream);
        if (document.visibilityState == "visible")
            tryPlay(stream);
    },
    release: (stream: AudioStreamElement): void =>
    {
        playing.delete(stream);
        blocked.delete(stream);
        stream.element.onended = null;
        stream.element.onerror = null;
        stream.element.pause();
        stream.element.removeAttribute("src");
        // Stops what it was downloading.
        stream.element.load();
        stream.node.disconnect();
        pool.push(stream);
    },
}

function createStreamElement(context: AudioContext): AudioStreamElement
{
    const element = new Audio();
    // The static site is another origin, from which an element without it feeds the context silence.
    element.crossOrigin = "anonymous";
    element.preload = "auto";
    return {element, node: context.createMediaElementSource(element)};
}

function tryPlay(stream: AudioStreamElement): void
{
    blocked.delete(stream);
    stream.element.play().catch((err: unknown) => {
        // Anything else is a pause or a new file coming first, which play() has nothing to say about.
        if (err instanceof DOMException && err.name == "NotAllowedError" && playing.has(stream))
            blocked.add(stream);
    });
}

function retryBlocked(): void
{
    if (document.visibilityState != "visible")
        return;
    for (const stream of [...blocked])
        tryPlay(stream);
}

function onVisibilityChange(): void
{
    for (const stream of playing)
    {
        if (document.visibilityState == "hidden")
            stream.element.pause();
        else
            tryPlay(stream);
    }
}

export default AudioStreamUtil;
