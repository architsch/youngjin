import IconButton from "../../input/iconButton";
import CloseIcon from "../../../svg/icons/closeIcon";

export default function ChatSentMessage({sentMessage, clearSentMessage}
    : {sentMessage: string, clearSentMessage: () => void})
{
    // This floats above the chat input row, which is the same space the selection menus occupy, so
    // it is kept at the bottom of the stack and those menus are drawn over it rather than under it.
    return <div className="flex flex-row gap-2 justify-start items-center absolute left-3 bottom-14 z-0 w-fit h-fit p-1 bg-gray-800/50 rounded-md yj-surface-convex">
        <div className="text-green-600 font-bold">My Message:</div>
        <div className="text-white">{sentMessage}</div>
        <IconButton icon={<CloseIcon/>} size="sm" onClick={clearSentMessage}/>
    </div>;
}