import { CSSProperties } from "react";

export default function ChatSentMessage({sentMessage}
    : {sentMessage: string})
{
    return <div style={style}>
        <b style={{color: "green"}}>My Message:</b> {sentMessage}
    </div>;
}

const style: CSSProperties = {
    position: "absolute",
    left: "0.25rem",
    margin: "0 0",
    padding: "0.25rem 0.25rem",
    bottom: "2.8rem",
    height: "1.5rem",
    fontSize: "1rem",
    lineHeight: "1.5rem",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    color: "yellow",
};