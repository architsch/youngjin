import IconButton from "../../input/iconButton";
import CloseIcon from "../../../svg/icons/closeIcon";

export default function ChatSentMessage({sentMessage, clearSentMessage}
    : {sentMessage: string, clearSentMessage: () => void})
{
    return <div className="flex flex-row gap-2 justify-start items-center absolute left-3 bottom-14 w-fit h-fit p-1 bg-gray-800/50 rounded-md">
        <div className="text-green-600 font-bold">My Message:</div>
        <div className="text-white">{sentMessage}</div>
        <IconButton icon={<CloseIcon/>} size="sm" onClick={clearSentMessage}/>
    </div>;
}