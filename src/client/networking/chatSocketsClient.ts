import { io, Socket } from "socket.io-client";

let socket: Socket;

const ChatSocketsClient =
{
    init: () =>
    {
        //socket = io(`http://localhost:3000/chat_sockets`);
        socket = io(`https://app.thingspool.net/chat_sockets`); // TODO: Get the URL from an env variable.

        socket.on("connect_error", (err) => {
            $("#message_list").append($("<p>")
                .css("margin", "0 0")
                .css("padding", "2px 2px")
                .html(`<font color="red"><b>${err.message}</b></font>`));
        });

        socket.on("message", (message) => {
            $("#message_list").prepend($("<p>")
                .css("margin", "0 0")
                .css("padding", "2px 2px")
                .html(message));
        });

        function send()
        {
            const message = ($("#message_input").val() as string)
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .trim();
            socket.emit("message", message);
            $("#message_input").val("");
        }
        $("#send_button").on("click", send);

        addEventListener("keydown", (event) => {
            if (event.key == "Enter")
            {
                event.preventDefault();
                if (($("#message_input").val() as string).trim().length > 0)
                    send();
            }
        });
    },
    sendTransformSync: (id: number, x: number, z: number, angleY: number) =>
    {
        ;
    },
}

export default ChatSocketsClient;