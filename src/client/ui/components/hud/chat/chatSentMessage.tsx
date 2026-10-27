import IconButton from "../../input/iconButton";
import CloseIcon from "../../../svg/icons/closeIcon";
import MessageLinkUtil from "../../../../../shared/object/util/messageLinkUtil";
import ChatInputEditUtil from "../../../util/chatInputEditUtil";
import MessageLinkOpenUtil from "../../../util/messageLinkOpenUtil";
import ScreenControlPicture from "../../basic/screenControlPicture";
import CountdownPie from "../../basic/countdownPie";
import { PLAYER_MESSAGE_EXPIRATION_MS } from "../../../../../shared/system/sharedConstants";

export default function ChatSentMessage({sentMessage, sentMessageSince, clearSentMessage}
    : {sentMessage: string, sentMessageSince: number, clearSentMessage: () => void})
{
    // Shares space with selection menus, so it sits at the bottom of the stack. Its links open as a speech bubble's do.
    return <div className="flex flex-row gap-2 justify-start items-center absolute left-3 bottom-14 z-0 w-fit h-fit p-1 bg-gray-800/50 rounded-md yj-surface-convex">
        {/* How long until it clears itself (see Chat). */}
        <CountdownPie startedAt={sentMessageSince} durationMs={PLAYER_MESSAGE_EXPIRATION_MS}/>
        <div className="text-green-600 font-bold">My Message:</div>
        <div className="text-white">{MessageLinkUtil.parse(sentMessage).map((segment, i) => (segment.kind == "text")
            ? <span key={i}>{segment.text}</span>
            : (segment.kind == "link") ? <span key={i} title={segment.href}
                onClick={() => MessageLinkOpenUtil.open(segment.href)}
                className={`${ChatInputEditUtil.chipClassNames} cursor-pointer pointer-events-auto`}>{segment.label}</span>
            : <ScreenControlPicture key={i} control={segment.control}/>)}
        </div>
        {/* Pictured in messages by a hand-made copy (see ScreenControlPicture): a new icon or color goes there too. */}
        <IconButton icon={<CloseIcon/>} size="sm" onClick={clearSentMessage}/>
    </div>;
}
