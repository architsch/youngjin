import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import { AWAY_DISCONNECT_DELAY_MS } from "../../../shared/system/sharedConstants";

// Keeps pages no one looks at out of multiplayer rooms, so that nobody stands in one for them. A hidden page makes no
// connection, nor takes a dropped one up again, until it is shown: it runs no frames, so a player arriving on it would
// stay behind the door (see PlayerController). One left hidden in a multiplayer room disconnects after a while, and
// connects again once it is shown. Only hidden counts: a page in sight is never away, focused or not. A single-player
// room keeps its connection, as it holds no place among others and would start over on reconnecting.
const AwayDisconnectUtil =
{
    // Makes the page's first connection (see SocketsClient.init): at once, or once a page opened in the background is
    // shown.
    install: (): void =>
    {
        document.addEventListener("visibilitychange", onVisibilityChange);
        SocketsClient.onReconnectAttempt(waitToBeShownIfHidden);
        if (isHidden())
            waitingToBeShown = true;
        else
            SocketsClient.connect();
    },
}

let awayTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
// Whether the page is without a connection until it is shown.
let waitingToBeShown = false;

function onVisibilityChange(): void
{
    if (isHidden())
    {
        if (!waitingToBeShown)
            awayTimeout ??= setTimeout(disconnectIfAway, AWAY_DISCONNECT_DELAY_MS);
        return;
    }

    clearTimeout(awayTimeout);
    awayTimeout = undefined;
    if (waitingToBeShown)
    {
        waitingToBeShown = false;
        SocketsClient.connect();
    }
}

function disconnectIfAway(): void
{
    awayTimeout = undefined;
    if (isHidden() && App.getCurrentRoom()?.roomType != RoomTypeEnumMap.SinglePlayer)
        waitToBeShown();
}

// A single-player room's dropped connection waits too, since taking it up again starts the room over either way.
function waitToBeShownIfHidden(): void
{
    if (isHidden())
        waitToBeShown();
}

function waitToBeShown(): void
{
    clearTimeout(awayTimeout);
    awayTimeout = undefined;
    waitingToBeShown = true;
    SocketsClient.disconnect();
}

function isHidden(): boolean
{
    return document.visibilityState == "hidden";
}

export default AwayDisconnectUtil;
