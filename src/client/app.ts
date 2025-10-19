import ObjectManager from "./object/objectManager";
import VoxelManager from "./voxel/voxelManager";
import RoomServerRecord from "./../shared/room/roomServerRecord";
import ThingsPoolEnv from "./networking/thingsPoolEnv";
import GraphicsManager from "./graphics/graphicsManager";
import PhysicsManager from "../shared/physics/physicsManager";

const minFramesPerSecond = 20;
const maxFramesPerSecond = 60;

const minSecondsPerFrame = 1 / maxFramesPerSecond;
const maxSecondsPerFrame = 1 / minFramesPerSecond;

let env: ThingsPoolEnv;
let prevTime: number;
let deltaTimePending: number;
let currentRoomName: string = "";

const tickTimeQueue: number[] = [];

const App =
{
    setEnv: (newEnv: ThingsPoolEnv) =>
    {
        env = newEnv;
    },
    getEnv: () =>
    {
        return env;
    },
    getCurrentRoomName: (): string =>
    {
        return currentRoomName;
    },
    loadRoom: async (roomServerRecord: RoomServerRecord) =>
    {
        currentRoomName = roomServerRecord.roomName;

        await GraphicsManager.load(update);
        await PhysicsManager.loadRoom(roomServerRecord);
        await VoxelManager.load(roomServerRecord);
        await ObjectManager.load(roomServerRecord);

        prevTime = performance.now() * 0.001;
        deltaTimePending = 0;
    },
    unloadRoom: async () =>
    {
        await ObjectManager.unload();
        await VoxelManager.unload();
        await PhysicsManager.unloadAllRooms(); // Only one room will be active at a time on the client side, so unloading all rooms is equivalent to unloading just the currently active room.
        await GraphicsManager.unload();

        currentRoomName = "";
    },
}

function update()
{
    const currTime = performance.now() * 0.001;
    const deltaTime = Math.min(maxSecondsPerFrame, currTime - prevTime);
    deltaTimePending += deltaTime;

    if (deltaTimePending >= minSecondsPerFrame) // Tick
    {
        deltaTimePending -= deltaTime;
        
        ObjectManager.update(deltaTime);
        GraphicsManager.update(getFPS());

        tickTimeQueue.push(currTime);
        while (tickTimeQueue[0] < currTime - 1)
            tickTimeQueue.shift();
    }

    prevTime = currTime;
}

function getFPS(): number
{
    return tickTimeQueue.length;
}

// temp UI

const uiRoot = document.getElementById("uiRoot") as HTMLElement;

const fpsDisplay = document.createElement("div");
fpsDisplay.style = "position:absolute; top:2rem; left:0.25rem; margin:0 0; padding:0.25rem 0.25rem; height:1.5rem; text-size:1rem; line-height:1.5rem; background-color:rgba(0, 0, 0, 0.5); color:red;";
fpsDisplay.innerHTML = `FPS: ?`;
uiRoot.appendChild(fpsDisplay);

setInterval(() => {
    fpsDisplay.innerHTML = `FPS: ${getFPS()}`;
}, 250);

export default App;