import RoomRuntimeMemory from "../shared/room/types/roomRuntimeMemory";
import GameSocketsClient from "./networking/gameSocketsClient";
import App from "./app";

const env = (window as any).thingspool_env;
App.setEnv(env);

if (!(window as any).thingspool_loading)
{
    (window as any).thingspool_loading_on();

    GameSocketsClient.roomRuntimeMemoryObservable.addListener("init", async (roomRuntimeMemory: RoomRuntimeMemory) => {
        await App.changeRoom(roomRuntimeMemory);
        (window as any).thingspool_loading_off();
    });
    GameSocketsClient.init(env);
}
else
{
    console.error("Already loading.");
}