import MessageLinkOpenUtil from "./messageLinkOpenUtil";

// The name of the frame a page of the website shows in over the game (see WebPageForm), by which the site's pages know
// they are in it (see the footer in the repository's ssg/ views), however far its reader has gone from the first.
export const WEB_PAGE_FRAME_NAME = "robotRoomsWebPage";

// What the page in that frame tells the game, which can't see into a frame of another origin: a link back into the game,
// and one off the site.
const WebPageFrameUtil =
{
    // Hears the frame's page until the returned function is called.
    listen: (getFrame: () => HTMLIFrameElement | null, onBackToGame: () => void,
        onOutsideLink: (href: string) => void): (() => void) =>
    {
        const onMessage = (event: MessageEvent): void => {
            const frame = getFrame();
            if (frame == null || event.source !== frame.contentWindow || !MessageLinkOpenUtil.isSiteOrigin(event.origin))
                return;
            const data = event.data as {kind?: unknown, href?: unknown} | null;
            if (data?.kind == "robotRooms:backToGame")
                onBackToGame();
            else if (data?.kind == "robotRooms:outsideLink" && typeof data.href == "string" && /^https?:\/\//i.test(data.href))
                onOutsideLink(data.href);
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    },
}

export default WebPageFrameUtil;
