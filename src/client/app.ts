import ObjectManager from "./object/objectManager";
import VoxelManager from "../shared/voxel/voxelManager";
import RoomRuntimeMemory from "../shared/room/roomRuntimeMemory";
import ThingsPoolEnv from "./networking/thingsPoolEnv";
import GraphicsManager from "./graphics/graphicsManager";
import PhysicsManager from "../shared/physics/physicsManager";
import Room from "../shared/room/room";
import VoxelGridEncoding from "../shared/voxel/voxelGridEncoding";
import VoxelGridGenerator from "../shared/voxel/voxelGridGenerator";

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
    getCurrentRoom: (): Room | undefined =>
    {
        return currentRoom;
    },
    changeRoom: async (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        if (currentRoom != undefined)
            await unloadCurrentRoom();
        loadRoom(roomRuntimeMemory);
    },
}

async function loadRoom(roomRuntimeMemory: RoomRuntimeMemory)
{
    currentRoom = roomRuntimeMemory.room;

    await GraphicsManager.load(update);

    const decodedVoxelGrid = VoxelGridEncoding.decode(roomRuntimeMemory.room.encodedVoxelGrid);
    /*
    const encoded1 = roomRuntimeMemory.room.encodedVoxelGrid;
    const encoded2 = VoxelGridEncoding.encode(VoxelGridGenerator.generateEmptyRoom(32, 32, 0, 1));
    const len = Math.min(encoded1.length, encoded2.length);
    const diff: any[] = [];
    for (let i = 0; i < len; ++i)
    {
        const c1 = encoded1[i];
        const c2 = encoded2[i];
        if (c1 != c2)
        {
            diff.push({i, c1, c2});
        }
    }
    console.log(`Encoding comparison :: length1 = ${encoded1.length}, length2 = ${encoded2.length}, diff = ${JSON.stringify(diff)}`);
    */
    PhysicsManager.loadRoom(roomRuntimeMemory, decodedVoxelGrid);
    VoxelManager.loadRoom(roomRuntimeMemory, decodedVoxelGrid);
    await ObjectManager.load(roomRuntimeMemory, decodedVoxelGrid);

    prevTime = performance.now() * 0.001;
    deltaTimePending = 0;
}

async function unloadCurrentRoom()
{
    if (currentRoom == undefined)
        throw new Error(`No room to unload.`);

    await ObjectManager.unload();
    VoxelManager.unloadRoom(currentRoom.roomID);
    PhysicsManager.unloadRoom(currentRoom.roomID);
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
fpsDisplay.innerHTML = `FPS: ?, Position: (?, ?, ?)`;
uiRoot.appendChild(fpsDisplay);

setInterval(() => {
    const myPlayer = ObjectManager.getMyPlayer();
    let x = "?", y = "?", z = "?";
    if (myPlayer)
    {
        x = myPlayer.position.x.toFixed(2);
        y = myPlayer.position.y.toFixed(2);
        z = myPlayer.position.z.toFixed(2);
    }
    fpsDisplay.innerHTML = `FPS: ${getFPS()}, Position: (${x}, ${y}, ${z})`;
}, 250);

export default App;