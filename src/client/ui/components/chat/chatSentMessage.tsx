export default function ChatSentMessage({sentMessage}
    : {sentMessage: string})
{
    return <div className="absolute left-3 bottom-14 w-fit h-fit p-1 text-base text-yellow-300 bg-black/50">
        <span className="text-green-600 font-bold">My Message:</span> {sentMessage}
    </div>;
}