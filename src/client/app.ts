import ObjectManager from "./object/objectManager";
import VoxelManager from "./voxel/voxelManager";
import RoomRuntimeMemory from "../shared/room/types/roomRuntimeMemory";
import ThingsPoolEnv from "./system/types/thingsPoolEnv";
import GraphicsManager from "./graphics/graphicsManager";
import PhysicsManager from "../shared/physics/physicsManager";
import Room from "../shared/room/types/room";
import { endClientProcess } from "./system/types/clientProcess";

const minFramesPerSecond = 20;
const maxFramesPerSecond = 60;

const minSecondsPerFrame = 1 / maxFramesPerSecond;
const maxSecondsPerFrame = 1 / minFramesPerSecond;

let env: ThingsPoolEnv;
let prevTime: number;
let deltaTimePending: number;
let currentRoom: Room | undefined;

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
    getFPS(): number
    {
        return tickTimeQueue.length;
    },
    getCurrentRoom: (): Room | undefined =>
    {
        return currentRoom;
    },
    changeRoom: async (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        if (currentRoom != undefined)
            await unloadCurrentRoom();
        await loadRoom(roomRuntimeMemory);

        endClientProcess("roomChange");
    },
}

async function loadRoom(roomRuntimeMemory: RoomRuntimeMemory)
{
    currentRoom = roomRuntimeMemory.room;

    await GraphicsManager.load(update);
    PhysicsManager.load(roomRuntimeMemory);
    await ObjectManager.load(roomRuntimeMemory);
    await VoxelManager.load(roomRuntimeMemory);

    prevTime = performance.now() * 0.001;
    deltaTimePending = 0;
}

async function unloadCurrentRoom()
{
    if (currentRoom == undefined)
        throw new Error(`No room to unload.`);

    await VoxelManager.unload();
    await ObjectManager.unload();
    PhysicsManager.unload(currentRoom.roomID);
    await GraphicsManager.unload();

    currentRoom = undefined;
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
        GraphicsManager.update(App.getFPS());

        tickTimeQueue.push(currTime);
        while (tickTimeQueue[0] < currTime - 1)
            tickTimeQueue.shift();
    }

    prevTime = currTime;
}

export default App;