import { NOTIFICATION_DURATION_MS } from "../../system/clientConstants";
import { notificationMessageObservable } from "../../system/clientObservables";

// Android-style double back to exit: the first press warns, a second press within the (readable)
// warning window exits.
export default class ExitConfirmationUtil
{
    // Time window in which a second press counts, or null.
    private static answerableWindow: {from: number, until: number} | null = null;

    // Called when a back gesture finds nothing to close.
    static requestExit(exitApp: () => void)
    {
        const now = Date.now();
        if (this.answerableWindow != null && now >= this.answerableWindow.until)
            this.answerableWindow = null; // Gone unanswered for long enough to have been forgotten

        if (this.answerableWindow != null)
        {
            // Too soon to be a deliberate answer (a repeat); keep the window open.
            if (now < this.answerableWindow.from)
                return;
            this.answerableWindow = null;
            exitApp();
            return;
        }

        // The window closes when the message disappears.
        this.answerableWindow = {
            from: now + MIN_CONFIRMATION_DELAY_MS,
            until: now + NOTIFICATION_DURATION_MS,
        };
        notificationMessageObservable.set(EXIT_PROMPT_MESSAGE);
    }

    // Cancels a pending prompt when a gesture was consumed elsewhere.
    static cancel()
    {
        if (this.answerableWindow == null)
            return;
        this.answerableWindow = null;
        // Only remove our own message.
        if (notificationMessageObservable.peek() == EXIT_PROMPT_MESSAGE)
            notificationMessageObservable.set(null);
    }
}

const EXIT_PROMPT_MESSAGE = "Press Back once more to leave this page.";
// Minimum age (ms) of the prompt before a second press counts.
const MIN_CONFIRMATION_DELAY_MS = 800;
