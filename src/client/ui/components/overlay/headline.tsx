import { useEffect, useRef, useState } from "react";
import { headlineMessageObservable } from "../../../system/clientObservables";

// A full-width banner pinned to the topmost row of the screen, used to show a single
// global instruction (e.g. tutorial guidance). Sitting at the very top keeps it clear of
// the camera view and the other UI, and it stays visible until the message is cleared.
// The message may contain simple inline markup (e.g. <br>), so it is rendered as HTML.
// As each new message appears, the whole bar (background + text) briefly balloons and dips
// toward the screen center (the "headline-pop" animation) so the user notices it; the text
// then keeps gently scaling up and down (the "headline-breathe" animation) so it holds the
// user's attention instead of being tuned out.
//
// Owning the top row means other UI has to keep out of it, and how much room to leave is not a
// constant: the bar grows with a longer message and with a narrower screen. So its height is
// published as a CSS variable on the document root, which lets anything that must stay clear of
// the headline park itself directly beneath whatever height the headline currently takes.
export default function Headline()
{
    const [message, setMessage] = useState<string | null>(null);
    // Bumped on every new message so the bar remounts and replays its pop.
    const [popKey, setPopKey] = useState(0);
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onMessage = (msg: string | null) => {
            setMessage(msg);
            if (msg)
                setPopKey(k => k + 1);
        };
        headlineMessageObservable.addListener("ui.headline", onMessage);
        // The single-player tutorial's first step sets the headline during app bootstrap,
        // before this component mounts (i.e. before the listener above is registered). Since
        // addListener doesn't replay the current value, sync to it explicitly on mount.
        onMessage(headlineMessageObservable.peek());
        return () => headlineMessageObservable.removeListener("ui.headline");
    }, []);

    // The height is measured rather than assumed, since the message is what decides how many lines
    // the bar runs to. What is measured is the laid-out box, which the pop and breathe animations
    // leave untouched — publishing the drawn box instead would set everything positioned beneath
    // the headline bouncing along with it every time a new message arrived.
    useEffect(() => {
        const bar = barRef.current;
        if (!bar)
            return;
        const publishHeight = () =>
            document.documentElement.style.setProperty(HEADLINE_HEIGHT_VAR, `${bar.offsetHeight}px`);
        publishHeight();
        const observer = new ResizeObserver(publishHeight);
        observer.observe(bar);
        // With no headline up there is no height to keep clear of, so the variable is taken away
        // rather than set to zero, leaving whoever reads it on the fallback it declares for itself.
        return () => {
            observer.disconnect();
            document.documentElement.style.removeProperty(HEADLINE_HEIGHT_VAR);
        };
    }, [message]);

    if (!message) return null;

    return <div ref={barRef} className="absolute top-0 left-0 w-full z-50 flex justify-center pointer-events-none">
        <div key={popKey} className="w-full px-6 py-3 text-center text-lg font-semibold text-gray-100 bg-gray-900 origin-top animate-headline-pop">
            <span className="inline-block animate-headline-breathe"
                dangerouslySetInnerHTML={{ __html: message }}/>
        </div>
    </div>;
}

// How far down the screen the headline currently reaches, in pixels. Kept as a CSS variable rather
// than as state of its own, so that a component needing to sit below the headline expresses that in
// the same place it expresses the rest of its position, and nothing has to re-render to follow it.
const HEADLINE_HEIGHT_VAR = "--yj-headline-height";
