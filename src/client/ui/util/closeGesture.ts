import { useEffect, useRef } from "react";
import { CloseGestureKind } from "../types/closeGestureKind";

// Calls back on any "go back / close" signal (Escape, Android Back, iOS edge swipe, browser back
// controls), consuming it so the page isn't left, and reports which kind arrived. Exiting the app is
// the caller's decision.
export default function useCloseGesture(
    onCloseGesture: (kind: CloseGestureKind) => void): void
{
    // Ref, so a new closure each render doesn't rebuild the effect.
    const onCloseGestureRef = useRef(onCloseGesture);
    onCloseGestureRef.current = onCloseGesture;

    useEffect(() => {
        const closeWatcherSupported = (typeof CloseWatcher != "undefined");

        // Back navigations arrive as history traversals, so a same-URL guard entry is kept on top to
        // turn them into popstate events (this catches controls CloseWatcher doesn't). The entry is
        // only pushed during user activation: entries pushed otherwise look like back-button
        // hijacking, and browsers skip them.
        let guardPushed = false;
        let guardWanted = false;
        const pushHistoryGuard = (userIsInteracting = false) => {
            if (guardPushed)
                return;
            // Without userActivation support there is no such intervention, so push freely.
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
        // Capture phase, so arming doesn't depend on the target's handling.
        for (const eventType of USER_INTERACTION_EVENT_TYPES)
            window.addEventListener(eventType, onUserInteraction, true);

        // CloseWatcher covers Escape and Android Back but reports both identically; Escape is detected
        // by a keydown just before the close request. Watchers are single-use, so re-arm. Without
        // CloseWatcher, keydown handles Escape and the history guard handles back.
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
            // Leave the guard entry; traversing during unload would be a navigation.
        };
    }, []);
}

const HISTORY_GUARD_STATE = { closeGestureGuard: true };
// Gesture-completion events that count as user activation in every browser.
const USER_INTERACTION_EVENT_TYPES = ["pointerup", "touchend", "keydown"] as const;
// Max delay (ms) between an Escape keydown and a close request to attribute it to Escape.
const ESCAPE_ATTRIBUTION_WINDOW_MS = 200;
