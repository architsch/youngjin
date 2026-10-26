import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import { chatTypingObservable, roomChangedObservable } from "../../system/clientObservables";
import TypingSignal from "../../../shared/user/types/typingSignal";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";

// The user typing a line in the chat stands the helper it would be for still, facing them (see HelperAgentUtil): the
// server is told as they start and as they stop, and again as each room arrives, which may be after it took the user
// in anew. A single-player room's helpers are the browser's own (see SinglePlayerHelperUtil).
let told = false;

function isTyping(): boolean
{
    const room = App.getCurrentRoom();
    return room != undefined && room.roomType != RoomTypeEnumMap.SinglePlayer && chatTypingObservable.peek();
}

function tell(typing: boolean): void
{
    SocketsClient.emitTypingSignal(new TypingSignal(typing));
    told = typing;
}

chatTypingObservable.addListener("helperWaitUtil", () => {
    if (isTyping() != told)
        tell(isTyping());
});
roomChangedObservable.addListener("helperWaitUtil", () => tell(isTyping()));
