import LoginRewardSignal from "../../../shared/inventory/types/loginRewardSignal";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import App from "../../app";
import { loginRewardStageObservable, ongoingClientProcessesObservable, roomChangedObservable,
    screenCoachMarksObservable } from "../../system/clientObservables";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import ClientInventoryManager from "../clientInventoryManager";

const LISTENER_KEY = "loginRewardUtil";
// Once it can be seen, a moment for the eye to settle on the room.
const SHOW_DELAY_MS = 500;
const COACH_MARK_DURATION_MS = 6000;

let dollarsToShow = 0;

// Shows what coming back has earned the user, which the server has given them already (see
// ServerInventoryManager.welcomeUser): the count rises with a coach mark beneath it, both bouncing. It waits until that can
// be seen, the count being only on a multiplayer room's screen, and nothing being seen behind the loading screen or on a
// hidden page. Until then the count doesn't show the dollars.
const LoginRewardUtil =
{
    onLoginRewardSignalReceived: (signal: LoginRewardSignal): void =>
    {
        ClientInventoryManager.holdBackDollars(signal.dollars);
        if (dollarsToShow == 0)
        {
            ongoingClientProcessesObservable.addListener(LISTENER_KEY, tryShow);
            roomChangedObservable.addListener(LISTENER_KEY, tryShow);
            document.addEventListener("visibilitychange", tryShow);
        }
        dollarsToShow += signal.dollars;
        loginRewardStageObservable.set("waiting");
        tryShow();
    },
}

function tryShow(): void
{
    const room = App.getCurrentRoom();
    if (dollarsToShow == 0 || room == undefined || room.roomType == RoomTypeEnumMap.SinglePlayer
        || ongoingClientProcessExists() || document.hidden)
        return;

    ongoingClientProcessesObservable.removeListener(LISTENER_KEY);
    roomChangedObservable.removeListener(LISTENER_KEY);
    document.removeEventListener("visibilitychange", tryShow);
    const dollars = dollarsToShow;
    dollarsToShow = 0;
    setTimeout(() => show(dollars), SHOW_DELAY_MS);
}

function show(dollars: number): void
{
    ClientInventoryManager.releaseDollars(dollars);
    screenCoachMarksObservable.change(coachMarks => [...coachMarks, {targetElementId: "dollarCounter", reward: true,
        text: `Welcome back!\nHere's your $${dollars}\ndaily reward.`}]);
    loginRewardStageObservable.set("shown");
    setTimeout(() => {
        screenCoachMarksObservable.change(coachMarks => coachMarks.filter(mark => !mark.reward));
        loginRewardStageObservable.set("none");
    }, COACH_MARK_DURATION_MS);
}

export default LoginRewardUtil;
