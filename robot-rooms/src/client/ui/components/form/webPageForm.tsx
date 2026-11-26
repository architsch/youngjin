import { useEffect, useRef, useState } from "react";
import Text from "../basic/text";
import IconButton from "../input/iconButton";
import CloseIcon from "../../svg/icons/closeIcon";
import NewTabIcon from "../../svg/icons/newTabIcon";
import ConfirmForm from "./confirmForm";
import { webPageOpenObservable } from "../../../system/clientObservables";
import WebPageProps from "../../types/webPageProps";
import MessageLinkOpenUtil from "../../util/messageLinkOpenUtil";
import PopupUtil from "../../util/popupUtil";
import WebPageFrameUtil, { WEB_PAGE_FRAME_NAME } from "../../util/webPageFrameUtil";

// A page of ThingsPool's website over the game, as a link someone said opens it (see MessageLinkOpenUtil): as large as
// the screen lets it be, a phone's too (by the height its browser leaves showing, where it tells), under one bar for its
// address, a new tab and closing. The page may open tabs of its own, but never navigate this one away from the game: a
// link in it back into the game closes it, and one off the site asks, over it, to open in a new tab (see
// WebPageFrameUtil). Meanwhile the user's player shows them reading (see PlayerActivityUtil).
export default function WebPageForm({ url }: WebPageProps)
{
    const frameRef = useRef<HTMLIFrameElement>(null);
    const [outsideHref, setOutsideHref] = useState<string | undefined>(undefined);

    useEffect(() => {
        webPageOpenObservable.set(true);
        return () => { webPageOpenObservable.set(false); };
    }, []);
    useEffect(() => WebPageFrameUtil.listen(() => frameRef.current, PopupUtil.closePopup, setOutsideHref), []);

    // pointer-events-auto re-enables interaction inside #uiRoot's pointer-events-none layer.
    return <div id="webPage" className="flex flex-col gap-1 w-[min(960px,calc(100vw-1.5rem))] h-[min(760px,calc(100vh-1.5rem))] supports-[height:100dvh]:h-[min(760px,calc(100dvh-1.5rem))] pointer-events-auto">
        <div className="flex flex-row items-center gap-1">
            <Text content={url.replace(/^https?:\/\//, "")} size="sm" additionalClassNames="flex-1 min-w-0 px-1 truncate"/>
            <IconButton id="webPageNewTabButton" icon={<NewTabIcon/>} size="sm"
                onClick={() => MessageLinkOpenUtil.openInNewTab(url)}/>
            <IconButton id="webPageCloseButton" icon={<CloseIcon/>} size="sm" onClick={PopupUtil.closePopup}/>
        </div>
        <div className="relative flex-1 min-h-0 w-full">
            <iframe
                ref={frameRef}
                src={url}
                name={WEB_PAGE_FRAME_NAME}
                title="ThingsPool's website"
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                className="absolute inset-0 w-full h-full rounded-md bg-white yj-surface-concave"
            />
            {outsideHref != undefined && <div id="webPageOutsideLink"
                className="absolute inset-0 flex justify-center items-center rounded-md bg-black/50">
                <div className="w-fit h-fit p-1 text-lg text-gray-200 bg-gray-600 rounded-lg yj-surface-convex">
                    <ConfirmForm message="This link leads out of Robot Rooms. Open it in a new tab?" detail={outsideHref}
                        onConfirm={() => {
                            MessageLinkOpenUtil.openInNewTab(outsideHref);
                            setOutsideHref(undefined);
                        }}
                        onCancel={() => setOutsideHref(undefined)}/>
                </div>
            </div>}
        </div>
    </div>
}
