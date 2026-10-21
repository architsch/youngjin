import App from "../../app";
import SocketsClient from "../../networking/client/socketsClient";
import RoomEditorUtil from "../../singlePlayer/util/roomEditorUtil";
import PopupUtil from "./popupUtil";
import RequestRoomChangeSignal from "../../../shared/room/types/requestRoomChangeSignal";
import RoomIdUtil from "../../../shared/room/util/roomIdUtil";
import { SITE_URL } from "../../../shared/system/sharedConstants";

// What a link someone said opens (see MessageLinkUtil): a room of this game is gone to, a page of ThingsPool's website
// is shown over the game (see WebPageForm), and any other page opens in a new tab. All but the website's pages ask
// first, showing where they lead, since a link's label is whatever its sender wrote.
const MessageLinkOpenUtil =
{
    open: (href: string): void =>
    {
        let url: URL;
        try
        {
            url = new URL(href);
        }
        catch
        {
            return;
        }
        const roomID = url.pathname.slice(1);
        if (url.origin == window.location.origin && RoomIdUtil.isRoomID(roomID))
        {
            // No fallback, as through a door: a room that can't be had is reported.
            askFirst("Go to this room?", url.href, () => RoomEditorUtil.askBeforeLeaving(() =>
                SocketsClient.requestRoomChange(new RequestRoomChangeSignal(roomID, false))));
        }
        else if (getSiteOrigins().includes(url.origin))
            PopupUtil.openPopup({popupType: "webPage", params: {url: url.href}});
        else
            askFirst("This link leads out of ThingsPool. Open it in a new tab?", url.href, () => openInNewTab(url.href));
    },
    openInNewTab: (href: string): void =>
    {
        openInNewTab(href);
    },
}

function openInNewTab(href: string): void
{
    window.open(href, "_blank", "noopener,noreferrer");
}

// The website, and the copy of it a local server serves.
function getSiteOrigins(): string[]
{
    return [SITE_URL, App.getEnv()?.static_server_url].flatMap(address => {
        try
        {
            return [new URL(address).origin];
        }
        catch
        {
            return [];
        }
    });
}

function askFirst(message: string, detail: string, onConfirm: () => void): void
{
    PopupUtil.openPopup({popupType: "confirm", params: {
        message,
        detail,
        onConfirm: () => {
            PopupUtil.closePopup();
            onConfirm();
        },
        onCancel: PopupUtil.closePopup,
    }});
}

export default MessageLinkOpenUtil;
