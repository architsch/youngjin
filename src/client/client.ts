import RoomRuntimeMemory from "../shared/room/roomRuntimeMemory";
import GameSocketsClient from "./networking/gameSocketsClient";
import App from "./app";

const env = (window as any).thingspool_env;

if (!(window as any).thingspool_loading)
{
    (window as any).thingspool_loading_on();

    GameSocketsClient.changeRoomObservable.addListener("init", async (roomRuntimeMemory: RoomRuntimeMemory) => {
        App.setEnv(env);
        await App.changeRoom(roomRuntimeMemory);
        (window as any).thingspool_loading_off();
    });
    GameSocketsClient.init(env);
}
else
{
    console.error("Already loading.");
}