import { useEffect, useRef, useState } from "react";
import Button from "../input/button";
import Form from "./form";
import ConsoleLogCaptureUtil from "../../../system/util/consoleLogCaptureUtil";
import { notificationMessageObservable } from "../../../system/clientObservables";

// A live view onto the rolling console record (see ConsoleLogCaptureUtil), opened by the "log"
// debug command. It exists for troubleshooting on a device whose console is out of reach, which is
// also why it offers the text up for copying: selecting a long log by hand on a phone is not a
// realistic way of getting it off the device.
export default function ConsoleLogForm()
{
    const [text, setText] = useState<string>(ConsoleLogCaptureUtil.getText());
    const scrollRef = useRef<HTMLDivElement | null>(null);
    // Whether the view is still following the newest output. Scrolling up parks it, so older lines
    // can be read while output keeps arriving; scrolling back down to the end resumes following.
    const followingRef = useRef<boolean>(true);

    // The record is polled rather than subscribed to. A burst of console output then costs one
    // re-render instead of one per line, and — the reason it matters more than the saving — a
    // warning logged from within this component's own render cannot turn into an endless loop of
    // renders feeding the very record they are drawing.
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

// How often the record is checked for new output. Fast enough to read as live, slow enough that a
// chatty moment in the app cannot flood the UI with re-renders.
const refreshInterval = 250;

// How close to the end the view has to be for it to count as still following the newest output.
// A margin rather than an exact match, since the browser's own scroll rounding rarely lands the
// view exactly at the end.
const followingThresholdInPixels = 24;

// select-text overrides the page-wide select-none, so the log can also be picked up by hand where
// the clipboard is unavailable; break-all keeps a long unbroken token (a URL, a stack frame) from
// widening the panel instead of wrapping inside it.
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
