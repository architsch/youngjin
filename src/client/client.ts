import WorldSyncParams from "../shared/types/networking/worldSyncParams";
import World from "./gameplay/world";
import GameSocketsClient from "./networking/gameSocketsClient";

if (!(window as any).thingspool_loading)
{
    (window as any).thingspool_loading_on();
    GameSocketsClient.init((params: WorldSyncParams) => {
        console.log(`(GameSocketsClient) worldSync :: ${JSON.stringify(params)}`);
        new World(params);
        (window as any).thingspool_loading_off();
    });
}
else
{
    console.error("Already loading.");
}