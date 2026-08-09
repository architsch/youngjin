import UserCommandSignal from "../../../shared/user/types/userCommandSignal";
import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import { screenCoachMarksObservable } from "../../system/clientObservables";
import { FTUEElementCode } from "../types/ftueElementCode";

// The FTUE elements a user has already been through are persisted as a single string, one
// character per element, so that adding an element never needs a schema change. Only letters are
// used: the user's record is embedded verbatim in the page that boots the client app, so a quote
// or a backslash finding its way in there would break that page (the server rejects anything else
// for the same reason). This is also why the mapping is by position — an element's character must
// never change once users have it stored.
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
        // The user is doing the very thing the coach mark was there to suggest, so the mark has
        // nothing left to say: it goes as soon as the feature is used, rather than lingering for
        // the rest of its stay while the user is already busy with what it asked for.
        FTUEUtil.hideCoachMark(ftueElementCode);
    },
    hasFTUEElement: (ftueElementCode: FTUEElementCode) =>
    {
        const ftue = App.getUser().ftue;
        const element = convertFTUEElementCodeToChar(ftueElementCode);
        return ftue.includes(element);
    },
    // Points a coach mark at the UI element that leads to the given feature, unless the user has
    // already been through it. Coach marks are scheduled ahead of time (a while after the control
    // comes within reach), so the user may well have discovered the feature on their own in the
    // meantime — which is exactly when there is nothing left to say.
    tryShowCoachMark: (ftueElementCode: FTUEElementCode, targetElementId: string, text: string) =>
    {
        if (FTUEUtil.hasFTUEElement(ftueElementCode))
            return;
        // The new mark joins the ones already on screen instead of replacing them, since the marks
        // of unrelated features fall due independently of one another and a mark cut short by a
        // newcomer would be guidance the user never got to read. A feature that already carries a
        // mark is left alone, so a repeated trigger neither doubles the bubble nor extends its stay.
        screenCoachMarksObservable.change(coachMarks =>
            coachMarks.some(mark => mark.ftueElementCode == ftueElementCode)
                ? coachMarks
                : [...coachMarks, {ftueElementCode, targetElementId, text}]);
    },
    // Takes the given feature's coach mark off screen, if it has one up. A mark has no clock of its
    // own, so this is how every mark ends other than by its feature being used: the UI that
    // scheduled the mark takes it down once the control it points at is gone or beyond use — a mark
    // merely losing sight of its target leaves it on the list, ready to reappear with the target.
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
