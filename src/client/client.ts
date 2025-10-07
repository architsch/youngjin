import RoomLoadParams from "../shared/types/room/roomLoadParams";
import GameSocketsClient from "./networking/gameSocketsClient";
import App from "./app";

const env = (window as any).thingspool_env;

if (!(window as any).thingspool_loading)
{
    (window as any).thingspool_loading_on();

    GameSocketsClient.roomLoadObservable.addListener("init", (params: RoomLoadParams) => {
        App.setEnv(env);
        App.loadRoom(params).then(_ => {
            (window as any).thingspool_loading_off();
        });
    });
    GameSocketsClient.init(env);
}
else
{
    console.error("Already loading.");
}