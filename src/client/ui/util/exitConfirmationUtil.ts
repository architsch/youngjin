import { NOTIFICATION_DURATION_MS } from "../../system/clientConstants";
import { notificationMessageObservable } from "../../system/clientObservables";

// Imitates the way many Android apps treat their Back button: with nothing left on screen to
// close, the first press only warns that another one will leave, and the page is given up only if
// a second press follows while that warning is still up.
export default class ExitConfirmationUtil
{
    private static promptedUntil = 0;

    // Called with a back gesture that found nothing left to close. Hands the page over to the
    // given callback only once the user has asked for it twice.
    static requestExit(leavePage: () => void)
    {
        if (Date.now() < this.promptedUntil)
        {
            this.promptedUntil = 0;
            leavePage();
            return;
        }
        // The prompt is only good for as long as it can be read, so the window it opens is
        // exactly the one its own message is on screen for.
        this.promptedUntil = Date.now() + NOTIFICATION_DURATION_MS;
        notificationMessageObservable.set(EXIT_PROMPT_MESSAGE);
    }

    // Withdraws a standing prompt, for when the gesture that would have answered it was spent on
    // something else. Without this, a gesture that went to a popup would leave the prompt behind
    // to be answered by a later one that the user never meant as a confirmation.
    static cancel()
    {
        if (this.promptedUntil == 0)
            return;
        this.promptedUntil = 0;
        // Only ever the prompt's own message is taken down, so that a notification raised by
        // anything else in the meantime keeps the screen time it was given.
        if (notificationMessageObservable.peek() == EXIT_PROMPT_MESSAGE)
            notificationMessageObservable.set(null);
    }
}

const EXIT_PROMPT_MESSAGE = "Press Back once more to leave this page.";
