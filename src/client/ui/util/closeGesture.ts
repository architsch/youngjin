import { useEffect, useRef } from "react";
import { CloseGestureKind } from "../types/closeGestureKind";

// Runs the given callback whenever the user signals that they want to go back, or to close
// whatever is currently open: pressing Escape on a keyboard, pressing Android's Back button or
// making its back gesture, swiping back from the edge of an iOS screen, or using the browser's own
// back control (its toolbar button, a mouse's back button, the keyboard shortcut).
//
// Every one of those signals is claimed, so that none of them can take the user off the page on
// its own, and the callback is told which kind of gesture arrived. What to do about a gesture that
// found nothing left on screen to close is the callback's own business: leaving the app is a
// navigation to a destination of its own rather than a retreat back through the history, so nothing
// here has any part in it.
export default function useCloseGesture(
    onCloseGesture: (kind: CloseGestureKind) => void): void
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
        //
        // The entry only ever goes up while an interaction of the user's own is in hand, never on
        // the page's own initiative. A page that adds history entries at moments when the user was
        // touching nothing is exactly what back-button hijacking looks like from the outside, and
        // the browsers that guard against it answer by stepping straight over such an entry when
        // the user goes back — the page is left behind, and no popstate ever arrives to say so.
        // Waiting for an interaction is what tells the two apart, and it costs nothing that is
        // wanted: before the user has touched the page there is nothing open for a back gesture to
        // close, so letting it mean what it says is the right answer anyway.
        let guardPushed = false;
        let guardWanted = false;
        const pushHistoryGuard = (userIsInteracting = false) => {
            if (guardPushed)
                return;
            // A browser that keeps no reading of user activation has no intervention riding on one
            // either, so there the entry goes up whenever it is asked for.
            const activationHeld = (navigator.userActivation == undefined) ||
                navigator.userActivation.isActive;
            if (!userIsInteracting && !activationHeld)
            {
                guardWanted = true; // Goes up the moment the user next touches the page
                return;
            }
            guardWanted = false;
            guardPushed = true;
            history.pushState(HISTORY_GUARD_STATE, "");
        };
        const onUserInteraction = (ev: Event) => {
            if (guardWanted && ev.isTrusted)
                pushHistoryGuard(true);
        };
        const onPopState = () => {
            guardPushed = false; // Spent by the traversal being handled here
            pushHistoryGuard(); // Re-armed, so that the next back gesture is caught as well
            onCloseGestureRef.current("back");
        };
        pushHistoryGuard();
        window.addEventListener("popstate", onPopState);
        // Capturing, so that the guard's arming does not depend on what the element under the
        // user's finger does with the event.
        for (const eventType of USER_INTERACTION_EVENT_TYPES)
            window.addEventListener(eventType, onUserInteraction, true);

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
                onCloseGestureRef.current("escape");
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
                    onCloseGestureRef.current(cameFromEscapeKey ? "escape" : "back");
                };
            };
            armWatcher();
        }

        return () => {
            watcher?.destroy();
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("popstate", onPopState);
            for (const eventType of USER_INTERACTION_EVENT_TYPES)
                window.removeEventListener(eventType, onUserInteraction, true);
            // The guard entry is left where it stands. This only runs as the page itself is going
            // away, and a traversal asked for at that point would be a navigation of its own.
        };
    }, []);
}

const HISTORY_GUARD_STATE = { closeGestureGuard: true };
// The interactions a browser counts as the user having acted on the page. Each is the completion
// of a gesture rather than its beginning, which is the point at which every browser agrees that
// the user has acted; the pair covering touch and pointer both fire for a tap, and whichever
// arrives first is the one that raises the guard.
const USER_INTERACTION_EVENT_TYPES = ["pointerup", "touchend", "keydown"] as const;
// How soon after an Escape key press a close request may still be put down to that key press
// rather than to a back gesture (in milliseconds).
const ESCAPE_ATTRIBUTION_WINDOW_MS = 200;
