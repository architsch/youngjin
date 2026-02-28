import RoomRuntimeMemory from "../shared/room/types/roomRuntimeMemory";
import GameSocketsClient from "./networking/client/gameSocketsClient";
import App from "./app";
import UIManager from "./ui/uiManager";
import { roomRuntimeMemoryObservable } from "./system/clientObservables";

// Store the client-side env variables that were injected by the server via "/mypage".
const env = (window as any).thingspool_env;
App.setEnv(env);

// When the client receives a RoomRuntimeMemory signal from the server,
// the given room will be loaded on the client side immediately
// (The previous room will be unloaded - if it exists).
roomRuntimeMemoryObservable.addListener("init", async (roomRuntimeMemory: RoomRuntimeMemory) => {
    await App.changeRoom(roomRuntimeMemory);
});

GameSocketsClient.init(env); // Starting establishing a socket connection.
UIManager.load(env, App.getUser()); // Initialize the UI system.