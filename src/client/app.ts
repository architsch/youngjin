import ObjectManager from "./object/objectManager";
import VoxelManager from "./voxel/voxelManager";
import RoomLoadParams from "./../shared/types/room/roomLoadParams";
import ThingsPoolEnv from "./networking/thingsPoolEnv";
import GraphicsManager from "./graphics/graphicsManager";

let env: ThingsPoolEnv;
let prevTime: number;

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
    loadRoom: async (params: RoomLoadParams) =>
    {
        await GraphicsManager.load(update);
        await VoxelManager.load(params.roomMap);
        await ObjectManager.load(params.objectRecords);
        prevTime = performance.now();
    },
    unloadRoom: async () =>
    {
        await ObjectManager.unload();
        await VoxelManager.unload();
        await GraphicsManager.unload();
    },
}

function update()
{
    const currTime = performance.now();
    const deltaTime = Math.min(0.1, currTime - prevTime);
    prevTime = currTime;

    ObjectManager.update(deltaTime);
    GraphicsManager.update();
}

export default App;