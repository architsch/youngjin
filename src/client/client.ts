import RoomRuntimeMemory from "../shared/room/types/roomRuntimeMemory";
import GameSocketsClient from "./networking/gameSocketsClient";
import App from "./app";
import UIManager from "./ui/uiManager";
import { roomRuntimeMemoryObservable } from "./system/observables";

const env = (window as any).thingspool_env;
App.setEnv(env);

roomRuntimeMemoryObservable.addListener("init", async (roomRuntimeMemory: RoomRuntimeMemory) => {
    await App.changeRoom(roomRuntimeMemory);
});

GameSocketsClient.init(env);
UIManager.load();