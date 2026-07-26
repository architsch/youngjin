import { NOTIFICATION_DURATION_MS } from "../../system/clientConstants";
import { notificationMessageObservable } from "../../system/clientObservables";

// Imitates the way many Android apps treat their Back button: with nothing left on screen to
// close, the first press only warns that another one will leave, and the page is given up only if
// a second press follows while that warning is both up and old enough to have been read.
export default class ExitConfirmationUtil
{
    // The stretch of time a standing prompt may be answered in, or nothing while none stands. Both
    // ends are kept together, since neither means anything without the other.
    private static answerableWindow: {from: number, until: number} | null = null;

    // Called with a back gesture that found nothing left to close. Hands the page over to the
    // given callback only once the user has asked for it twice.
    static requestExit(leavePage: () => void)
    {
        const now = Date.now();
        if (this.answerableWindow != null && now >= this.answerableWindow.until)
            this.answerableWindow = null; // Gone unanswered for long enough to have been forgotten

        if (this.answerableWindow != null)
        {
            // A press arriving on the heels of the one that raised the prompt is a stray repeat of
            // it rather than an answer to it, the message having had no time to be read. Left to
            // stand, so that the user still has the rest of the window to answer deliberately.
            if (now < this.answerableWindow.from)
                return;
            this.answerableWindow = null;
            leavePage();
            return;
        }

        // The prompt is only good for as long as it can be read, so the window it opens closes
        // exactly when its own message leaves the screen.
        this.answerableWindow = {
            from: now + MIN_CONFIRMATION_DELAY_MS,
            until: now + NOTIFICATION_DURATION_MS,
        };
        notificationMessageObservable.set(EXIT_PROMPT_MESSAGE);
    }

    // Withdraws a standing prompt, for when the gesture that would have answered it was spent on
    // something else. Without this, a gesture that went to a popup would leave the prompt behind
    // to be answered by a later one that the user never meant as a confirmation.
    static cancel()
    {
        if (this.answerableWindow == null)
            return;
        this.answerableWindow = null;
        // Only ever the prompt's own message is taken down, so that a notification raised by
        // anything else in the meantime keeps the screen time it was given.
        if (notificationMessageObservable.peek() == EXIT_PROMPT_MESSAGE)
            notificationMessageObservable.set(null);
    }
}

const EXIT_PROMPT_MESSAGE = "Press Back once more to leave this page.";
// How long a raised prompt must have been standing before a further back gesture is taken as an
// answer to it rather than as a stray repeat of the gesture that raised it (in milliseconds).
const MIN_CONFIRMATION_DELAY_MS = 800;
