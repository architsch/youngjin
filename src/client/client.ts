import RoomServerRecord from "../shared/room/roomServerRecord";
import GameSocketsClient from "./networking/gameSocketsClient";
import App from "./app";

const env = (window as any).thingspool_env;

if (!(window as any).thingspool_loading)
{
    (window as any).thingspool_loading_on();

    GameSocketsClient.changeRoomObservable.addListener("init", async (roomServerRecord: RoomServerRecord) => {
        App.setEnv(env);
        await App.changeRoom(roomServerRecord);
        (window as any).thingspool_loading_off();
    });
    GameSocketsClient.init(env);
}
else
{
    console.error("Already loading.");
}