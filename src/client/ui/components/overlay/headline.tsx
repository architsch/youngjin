import { useEffect, useState } from "react";
import { headlineMessageObservable } from "../../../system/clientObservables";

// A full-width banner pinned to the topmost row of the screen, used to show a single
// global instruction (e.g. tutorial guidance). Sitting at the very top keeps it clear of
// the camera view and the other UI, and it stays visible until the message is cleared.
// The message may contain simple inline markup (e.g. <br>), so it is rendered as HTML.
// As each new message appears, the whole bar (background + text) briefly balloons and dips
// toward the screen center (the "headline-pop" animation) so the user notices it; the text
// then keeps gently scaling up and down (the "headline-breathe" animation) so it holds the
// user's attention instead of being tuned out.
export default function Headline()
{
    const [message, setMessage] = useState<string | null>(null);
    // Bumped on every new message so the bar remounts and replays its pop.
    const [popKey, setPopKey] = useState(0);

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

    if (!message) return null;

    return <div className="absolute top-0 left-0 w-full z-50 flex justify-center pointer-events-none">
        <div key={popKey} className="w-full px-6 py-3 text-center text-lg font-semibold text-gray-100 bg-gray-900 origin-top animate-headline-pop">
            <span className="inline-block animate-headline-breathe"
                dangerouslySetInnerHTML={{ __html: message }}/>
        </div>
    </div>;
}
