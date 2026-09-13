import UserCommandSignal from "../../../shared/user/types/userCommandSignal";
import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import { screenCoachMarksObservable } from "../../system/clientObservables";
import { FTUEElementCode } from "../types/ftueElementCode";

// Experienced elements are stored as one string, one letter per element (positions are permanent).
// Letters only, since the user record is embedded verbatim in the page (the server enforces this).
const FTUE_ELEMENT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const FTUEUtil =
{
    tryAddFTUEElement: (ftueElementCode: FTUEElementCode) =>
    {
        const ftue = App.getUser().ftue;
        const element = convertFTUEElementCodeToChar(ftueElementCode);
        if (ftue.includes(element)) // FTUE element already exists
            return;
        SocketsClient.emitUserCommandSignal(new UserCommandSignal(`addFTUEElement ${element}`));
        App.getUser().ftue = `${ftue}${element}`;
        // Using the feature removes its coach mark immediately.
        FTUEUtil.hideCoachMark(ftueElementCode);
    },
    hasFTUEElement: (ftueElementCode: FTUEElementCode) =>
    {
        const ftue = App.getUser().ftue;
        const element = convertFTUEElementCodeToChar(ftueElementCode);
        return ftue.includes(element);
    },
    // Shows a coach mark unless the element was experienced meanwhile (marks are scheduled in advance).
    tryShowCoachMark: (ftueElementCode: FTUEElementCode, targetElementId: string, text: string) =>
    {
        if (FTUEUtil.hasFTUEElement(ftueElementCode))
            return;
        // Marks accumulate rather than replace; one mark per element.
        screenCoachMarksObservable.change(coachMarks =>
            coachMarks.some(mark => mark.ftueElementCode == ftueElementCode)
                ? coachMarks
                : [...coachMarks, {ftueElementCode, targetElementId, text}]);
    },
    // Removes a mark. The owning UI calls this when its control is gone or disabled (marks don't
    // expire on their own).
    hideCoachMark: (ftueElementCode: FTUEElementCode) =>
    {
        screenCoachMarksObservable.change(coachMarks =>
            coachMarks.filter(mark => mark.ftueElementCode != ftueElementCode));
    },
}

function convertFTUEElementCodeToChar(ftueElementCode: FTUEElementCode): string
{
    const element = FTUE_ELEMENT_CHARS[ftueElementCode];
    if (element == undefined)
        throw new Error(`FTUE element code is out of range (code = ${ftueElementCode})`);
    return element;
}

export default FTUEUtil;
