import { useEffect, useRef, useState } from "react";
import { headlineMessageObservable } from "../../../system/clientObservables";

// Full-width top banner for a global instruction (e.g. tutorial), rendered as HTML (may contain <br>).
// Pops on each new message, then gently breathes. Its height is published as a CSS variable so other
// UI can sit below it.
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
        // The tutorial may set the headline before mount, and addListener doesn't replay, so sync now.
        onMessage(headlineMessageObservable.peek());
        return () => headlineMessageObservable.removeListener("ui.headline");
    }, []);

    // Measures the layout box (unaffected by the animations), so UI below doesn't bounce.
    useEffect(() => {
        const bar = barRef.current;
        if (!bar)
            return;
        const publishHeight = () =>
            document.documentElement.style.setProperty(HEADLINE_HEIGHT_VAR, `${bar.offsetHeight}px`);
        publishHeight();
        const observer = new ResizeObserver(publishHeight);
        observer.observe(bar);
        // Remove the variable (not 0) so readers use their own fallback.
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

// Headline height in px, as a CSS variable so dependents position via CSS without re-rendering.
const HEADLINE_HEIGHT_VAR = "--yj-headline-height";
