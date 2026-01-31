import Button from "../basic/button";

export default function ChatSentMessage({sentMessage, clearSentMessage}
    : {sentMessage: string, clearSentMessage: () => void})
{
    return <div className="flex flex-row gap-2 justify-start align-middle absolute left-3 bottom-14 w-fit h-fit p-1 bg-black/50">
        <div className="text-green-600 font-bold">My Message:</div>
        <div className="text-yellow-300">{sentMessage}</div>
        <Button name="X" size="sm" onClick={clearSentMessage}/>
    </div>;
}