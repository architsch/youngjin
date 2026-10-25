import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { AWAY_DISCONNECT_DELAY_MS } from "../../../shared/system/sharedConstants";

// Disconnects a page left hidden in a multiplayer room, so that nobody stands in it for a tab no one looks at, and
// connects it again once it is shown. Only hidden counts: a page in sight is never away, focused or not. A
// single-player room keeps its connection, as it holds no place among others and would start over on reconnecting.
const AwayDisconnectUtil =
{
    install: (): void =>
    {
        document.addEventListener("visibilitychange", onVisibilityChange);
        // A page opened in the background is hidden from the start.
        onVisibilityChange();
    },
}

let awayTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
let disconnectedWhileAway = false;

function onVisibilityChange(): void
{
    if (document.visibilityState == "hidden")
    {
        awayTimeout ??= setTimeout(disconnectIfAway, AWAY_DISCONNECT_DELAY_MS);
        return;
    }

    clearTimeout(awayTimeout);
    awayTimeout = undefined;
    if (disconnectedWhileAway)
    {
        disconnectedWhileAway = false;
        SocketsClient.connect();
    }
}

function disconnectIfAway(): void
{
    awayTimeout = undefined;
    if (document.visibilityState != "hidden" || App.getCurrentRoom()?.roomType == RoomTypeEnumMap.SinglePlayer)
        return;
    disconnectedWhileAway = true;
    SocketsClient.disconnect();
}

export default AwayDisconnectUtil;
