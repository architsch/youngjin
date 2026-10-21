import Text from "../basic/text";
import IconButton from "../input/iconButton";
import CloseIcon from "../../svg/icons/closeIcon";
import NewTabIcon from "../../svg/icons/newTabIcon";
import WebPageProps from "../../types/webPageProps";
import MessageLinkOpenUtil from "../../util/messageLinkOpenUtil";
import PopupUtil from "../../util/popupUtil";

// A page of ThingsPool's website over the game, as a link someone said opens it (see MessageLinkOpenUtil): as large as
// the screen lets it be, a phone's too (by the height its browser leaves showing, where it tells), under one bar for its
// address, a new tab and closing. The page may open tabs of its own, but never navigate this one away from the game.
export default function WebPageForm({ url }: WebPageProps)
{
    // pointer-events-auto re-enables interaction inside #uiRoot's pointer-events-none layer.
    return <div id="webPage" className="flex flex-col gap-1 w-[min(960px,calc(100vw-1.5rem))] h-[min(760px,calc(100vh-1.5rem))] supports-[height:100dvh]:h-[min(760px,calc(100dvh-1.5rem))] pointer-events-auto">
        <div className="flex flex-row items-center gap-1">
            <Text content={url.replace(/^https?:\/\//, "")} size="sm" additionalClassNames="flex-1 min-w-0 px-1 truncate"/>
            <IconButton id="webPageNewTabButton" icon={<NewTabIcon/>} size="sm"
                onClick={() => MessageLinkOpenUtil.openInNewTab(url)}/>
            <IconButton id="webPageCloseButton" icon={<CloseIcon/>} size="sm" onClick={PopupUtil.closePopup}/>
        </div>
        <iframe
            src={url}
            title="ThingsPool's website"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            className="flex-1 min-h-0 w-full rounded-md bg-white yj-surface-concave"
        />
    </div>
}
