import { useEffect, useRef } from "react";
import { CloseGestureKind } from "../types/closeGestureKind";

// Runs the given callback whenever the user signals that they want to go back, or to close
// whatever is currently open: pressing Escape on a keyboard, pressing Android's Back button or
// making its back gesture, swiping back from the edge of an iOS screen, or using the browser's own
// back control (its toolbar button, a mouse's back button, the keyboard shortcut).
//
// Every one of those signals is claimed, so that none of them can take the user off the page on
// its own. The callback is told which kind of gesture arrived, and is handed the means to give the
// page up after all — to be called once it has found nothing left on screen to close.
export default function useCloseGesture(
    onCloseGesture: (kind: CloseGestureKind, leavePage: () => void) => void): void
{
    // Held in a ref so that a caller passing a freshly built closure on every render does not cost
    // a teardown and rebuild of everything the effect below sets up.
    const onCloseGestureRef = useRef(onCloseGesture);
    onCloseGestureRef.current = onCloseGesture;

    useEffect(() => {
        const closeWatcherSupported = (typeof CloseWatcher != "undefined");

        // A back navigation reaches the page as a history traversal rather than as an event of its
        // own, so a throwaway entry is kept on top of the history stack for it to land on. The
        // entry carries the page's own URL, so spending it moves nothing on screen — it only turns
        // the navigation into a popstate that can be read as a close gesture instead. Even where a
        // CloseWatcher already hears Android's back gesture, this is what catches the back controls
        // that no CloseWatcher hears: the browser's own button, a mouse's back button, the keyboard
        // shortcut, and the edge swipe on iOS.
        let guardPushed = false;
        let leaving = false;
        const pushHistoryGuard = () => {
            if (!guardPushed)
            {
                guardPushed = true;
                history.pushState(HISTORY_GUARD_STATE, "");
            }
        };
        // Gives the page up after all. The guard entry is spent first, and the entry the user
        // asked for is travelled to only once that first step has been seen to land — so a history
        // stack with nowhere further back to go leaves the page where it stands, rather than
        // half-unwound with its guard already gone.
        const leavePage = () => {
            leaving = true;
            history.back();
        };
        const onPopState = () => {
            guardPushed = false; // Spent by the traversal being handled here
            if (leaving)
            {
                leaving = false;
                history.back(); // On to wherever the user was before this page
                // Nowhere further to go means the page is still here a moment later, so the guard
                // goes back up and everything carries on as it was.
                setTimeout(pushHistoryGuard, GUARD_REARM_DELAY_MS);
                return;
            }
            pushHistoryGuard(); // Re-armed, so that the next back gesture is caught as well
            onCloseGestureRef.current("back", leavePage);
        };
        pushHistoryGuard();
        window.addEventListener("popstate", onPopState);

        // Where CloseWatcher exists, it is the one reading that covers both the Escape key and
        // Android's back button/gesture, and it takes them before the browser can treat them as
        // anything else. It reports the two as the same event, so the key press is timed to tell
        // which of them arrived: Escape reaches the page as a keydown immediately before the close
        // request it produces, and a back gesture never does. A watcher is spent by the request it
        // reports, so a fresh one is armed for the next. Elsewhere, that keydown is itself the only
        // reading of the Escape key, and the back button is left to the history guard above.
        let watcher: CloseWatcher | undefined;
        let lastEscapeKeyDownTime = 0;
        const onKeyDown = (ev: KeyboardEvent) => {
            if (ev.key != "Escape")
                return;
            lastEscapeKeyDownTime = Date.now();
            if (!closeWatcherSupported)
                onCloseGestureRef.current("escape", leavePage);
        };
        // Capturing, so that this reading does not depend on what the focused element does with the key.
        window.addEventListener("keydown", onKeyDown, true);
        if (closeWatcherSupported)
        {
            const armWatcher = () => {
                watcher = new CloseWatcher();
                watcher.onclose = () => {
                    armWatcher();
                    const cameFromEscapeKey =
                        (Date.now() - lastEscapeKeyDownTime) < ESCAPE_ATTRIBUTION_WINDOW_MS;
                    lastEscapeKeyDownTime = 0;
                    onCloseGestureRef.current(cameFromEscapeKey ? "escape" : "back", leavePage);
                };
            };
            armWatcher();
        }

        return () => {
            watcher?.destroy();
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("popstate", onPopState);
            // The guard entry is left where it stands. This only runs as the page itself is going
            // away, and a traversal asked for at that point would be a navigation of its own.
        };
    }, []);
}

const HISTORY_GUARD_STATE = { closeGestureGuard: true };
// How soon after an Escape key press a close request may still be put down to that key press
// rather than to a back gesture (in milliseconds).
const ESCAPE_ATTRIBUTION_WINDOW_MS = 200;
// How long to wait before concluding that a back traversal had nowhere to go (in milliseconds).
const GUARD_REARM_DELAY_MS = 500;
