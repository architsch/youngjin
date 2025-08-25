import socketIO from "socket.io";

export type SocketMiddleware =
    (socket: socketIO.Socket, next: (err?: socketIO.ExtendedError) => void) => void