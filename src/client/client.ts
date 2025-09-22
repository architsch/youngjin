import GraphicsContext from "./graphics/graphicsContext";
import World from "./gameplay/world";
import ChatSocketsClient from "./networking/chatSocketsClient";

new World(new GraphicsContext());
ChatSocketsClient.init();