import SocketUserContext from "../sockets/types/socketUserContext";

const socketUserContexts: {[userID: string]: SocketUserContext} = {};

const UserManager =
{
    socketUserContexts,
    addUser: (socketUserContext: SocketUserContext) =>
    {
        socketUserContexts[socketUserContext.user.id] = socketUserContext;
    },
    removeUser: (userID: string) =>
    {
        delete socketUserContexts[userID];
    },
    getSocketUserContext: (userID: string): SocketUserContext | undefined =>
    {
        return socketUserContexts[userID];
    },
    hasUser: (userID: string): boolean =>
    {
        return socketUserContexts[userID] != undefined;
    },
}

export default UserManager;
