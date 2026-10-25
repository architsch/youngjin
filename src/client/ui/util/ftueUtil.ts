import UserCommandSignal from "../../../shared/user/types/userCommandSignal";
import { FTUEElementCode, FTUEElementCodeEnumMap } from "../../../shared/user/types/ftueElementCode";
import FTUEElementUtil from "../../../shared/user/util/ftueElementUtil";
import Room from "../../../shared/room/types/room";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { MINUTE_IN_MS } from "../../../shared/system/sharedConstants";
import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import { screenCoachMarksObservable } from "../../system/clientObservables";

const FTUEUtil =
{
    tryAddFTUEElement: (ftueElementCode: FTUEElementCode) =>
    {
        const ftue = App.getUser().ftue;
        if (FTUEElementUtil.has(ftue, ftueElementCode))
            return;
        const element = FTUEElementUtil.toChar(ftueElementCode);
        SocketsClient.emitUserCommandSignal(new UserCommandSignal(`addFTUEElement ${element}`));
        App.getUser().ftue = `${ftue}${element}`;
        // Using the feature removes its coach mark immediately.
        FTUEUtil.hideCoachMark(ftueElementCode);
    },
    hasFTUEElement: (ftueElementCode: FTUEElementCode) =>
    {
        return FTUEElementUtil.has(App.getUser().ftue, ftueElementCode);
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
    // Removes a mark, once its time is up or when the owning UI's control is gone or disabled.
    hideCoachMark: (ftueElementCode: FTUEElementCode) =>
    {
        screenCoachMarksObservable.change(coachMarks =>
            coachMarks.filter(mark => mark.ftueElementCode != ftueElementCode));
    },
    // The top bar's switch and person button get their marks at set times after the user lands in the page's first
    // multiplayer room (the tutorial guides the user itself), each for a while. Later rooms don't restart the clock.
    onRoomEntered: (room: Room) =>
    {
        if (landed || room.roomType == RoomTypeEnumMap.SinglePlayer)
            return;
        landed = true;
        showCoachMarkLater(FTUEElementCodeEnumMap.EnterEditMode, "gameModeToggleSwitch", "Try Editing",
            MINUTE_IN_MS, 2 * MINUTE_IN_MS);
        showCoachMarkLater(FTUEElementCodeEnumMap.OwnIdentity, "userIdentityButton", "Customize Yourself",
            3 * MINUTE_IN_MS, 2 * MINUTE_IN_MS);
    },
}

let landed = false;

function showCoachMarkLater(ftueElementCode: FTUEElementCode, targetElementId: string, text: string,
    delayMs: number, durationMs: number): void
{
    setTimeout(() => {
        FTUEUtil.tryShowCoachMark(ftueElementCode, targetElementId, text);
        setTimeout(() => FTUEUtil.hideCoachMark(ftueElementCode), durationMs);
    }, delayMs);
}

export default FTUEUtil;
