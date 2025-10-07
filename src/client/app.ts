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
        await ObjectManager.load(VoxelManager.getVoxelGrid(), params.objectRecords);
        prevTime = performance.now();
    },
    unloadRoom: () =>
    {
        ObjectManager.unload();
        VoxelManager.unload();
        GraphicsManager.unload();
    },
    changeRoom: async (params: RoomLoadParams) =>
    {
        App.unloadRoom();
        await App.loadRoom(params);
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