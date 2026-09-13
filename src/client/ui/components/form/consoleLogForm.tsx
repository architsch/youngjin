import { useEffect, useRef, useState } from "react";
import Button from "../input/button";
import Form from "./form";
import ConsoleLogCaptureUtil from "../../../system/util/consoleLogCaptureUtil";
import { notificationMessageObservable } from "../../../system/clientObservables";

// Live view of the console record (see ConsoleLogCaptureUtil) for the "log" debug command, with copy
// support since selecting long text on a phone is impractical.
export default function ConsoleLogForm()
{
    const [text, setText] = useState<string>(ConsoleLogCaptureUtil.getText());
    const scrollRef = useRef<HTMLDivElement | null>(null);
    // Scrolling up pauses following; scrolling to the end resumes it.
    const followingRef = useRef<boolean>(true);

    // Polled rather than subscribed: bursts cost one render, and a warning logged during this
    // component's render can't loop.
    useEffect(() => {
        let lastRevision = ConsoleLogCaptureUtil.getRevision();
        const interval = setInterval(() => {
            const revision = ConsoleLogCaptureUtil.getRevision();
            if (revision === lastRevision)
                return;
            lastRevision = revision;
            setText(ConsoleLogCaptureUtil.getText());
        }, refreshInterval);
        return () => clearInterval(interval);
    }, []);

    // Held against the newest line after every update, unless the user has scrolled away from it.
    useEffect(() => {
        const scrollElement = scrollRef.current;
        if (scrollElement != null && followingRef.current)
            scrollElement.scrollTop = scrollElement.scrollHeight;
    }, [text]);

    return <Form>
        <div
            ref={scrollRef}
            className={logPanelClassName}
            onScroll={() => {
                const scrollElement = scrollRef.current;
                if (scrollElement == null)
                    return;
                const distanceFromEnd = scrollElement.scrollHeight -
                    scrollElement.scrollTop - scrollElement.clientHeight;
                followingRef.current = distanceFromEnd <= followingThresholdInPixels;
            }}
        >
            {text.length > 0 ? text : "(nothing has been logged yet)"}
        </div>
        <div className="flex flex-row justify-center gap-2">
            <Button name="Copy" size="sm" onClick={() => void copyToClipboard(text)}/>
            <Button name="Clear" size="sm" color="red" onClick={() => {
                ConsoleLogCaptureUtil.clear();
                setText(ConsoleLogCaptureUtil.getText());
            }}/>
        </div>
    </Form>;
}

const refreshInterval = 250;

// Tolerance for "at the end" (scroll rounding rarely lands exactly).
const followingThresholdInPixels = 24;

// select-text overrides the page-wide select-none; break-all wraps long tokens (URLs, stack frames).
const logPanelClassName = "w-[70vw] h-[55vh] min-h-0 p-2 overflow-auto rounded-md yj-surface-concave " +
    "bg-black text-gray-300 text-left text-[10px] leading-snug font-mono " +
    "whitespace-pre-wrap break-all select-text pointer-events-auto";

async function copyToClipboard(text: string): Promise<void>
{
    try
    {
        await navigator.clipboard.writeText(text);
        notificationMessageObservable.set("Console log copied to the clipboard.");
    }
    catch (err)
    {
        notificationMessageObservable.set("Failed to copy the console log.");
    }
}
