import ClientObjectManager from "./object/clientObjectManager";
import RoomRuntimeMemory from "../shared/room/types/roomRuntimeMemory";
import RoomChangedSignal from "../shared/room/types/roomChangedSignal";
import ThingsPoolEnv from "./system/types/thingsPoolEnv";
import GraphicsManager from "./graphics/graphicsManager";
import PhysicsManager from "../shared/physics/physicsManager";
import Room from "../shared/room/types/room";
import { endClientProcess } from "./system/types/clientProcess";
import User from "../shared/user/types/user";
import { UserRole } from "../shared/user/types/userRole";
import { roomChangedObservable, updateObservable, userRoleObservable } from "./system/clientObservables";
import "./graphics/types/gizmo/colliderDebugGizmo";
import "./graphics/types/gizmo/voxelBlockWorldSpaceGizmos"; // Side-effect: registers world-space gizmos for voxel block selection
import "./graphics/types/gizmo/canvasWorldSpaceGizmos"; // Side-effect: registers world-space gizmos for canvas selection
import SetUserRoleSignal from "../shared/user/types/setUserRoleSignal";
import AsyncUtil from "../shared/system/util/asyncUtil";
import SignalTypeConfigMap from "../shared/networking/maps/signalTypeConfigMap";

const minFramesPerSecond = 20;
const maxFramesPerSecond = 60;

const minSecondsPerFrame = 1 / maxFramesPerSecond;
const maxSecondsPerFrame = 1 / minFramesPerSecond;

let env: ThingsPoolEnv;
let user: User;
let prevTime: number;
let deltaTimePending: number;
let currentRoom: Room | undefined;

const tickTimeQueue: number[] = [];

const App =
{
    setEnv: (newEnv: ThingsPoolEnv) =>
    {
        env = newEnv;
        user = User.fromString(env.userString);
    },
    getEnv: (): ThingsPoolEnv =>
    {
        return env;
    },
    getUser: (): User =>
    {
        return user;
    },
    getFPS(): number
    {
        return tickTimeQueue.length;
    },
    getCurrentRoom: (): Room | undefined =>
    {
        return currentRoom;
    },
    getCurrentUserRole: (): UserRole =>
    {
        return userRoleObservable.peek();
    },
    setCurrentUserRole: (role: UserRole) =>
    {
        userRoleObservable.set(role);
    },
    onSetUserRoleSignalReceived: async (params: SetUserRoleSignal) => {
        // If this is a UserRole update on the current user's player, update the app-level role.
        if (params.userID !== App.getUser()?.id)
            return;
        const success = await waitUntilSignalProcessingReady("setUserRoleSignal",
            () => params.roomID === App.getCurrentRoom()?.id);
        if (!success)
            return;
        App.setCurrentUserRole(params.userRole);
    },
    getVoxelQuads: (): Uint8Array =>
    {
        return currentRoom!.voxelGrid.quadsMem.quads;
    },
    // When this method receives a RoomChangedSignal from the server,
    // the given room will be loaded on the client side immediately
    // (The previous room will be unloaded - if it exists).
    onRoomChangedSignalReceived: async (roomChangedSignal: RoomChangedSignal) =>
    {
        if (currentRoom != undefined)
            await unloadCurrentRoom();
        await loadRoom(roomChangedSignal.roomRuntimeMemory, roomChangedSignal.currentUserRole);

        endClientProcess("roomChange");
        roomChangedObservable.set(roomChangedSignal.roomRuntimeMemory);
    },
}

async function loadRoom(roomRuntimeMemory: RoomRuntimeMemory, currentUserRole: UserRole)
{
    currentRoom = roomRuntimeMemory.room;

    // Read the current user's role from the RoomChangedSignal
    userRoleObservable.set(currentUserRole);

    await GraphicsManager.load(update);
    PhysicsManager.load(roomRuntimeMemory);
    await ClientObjectManager.load(roomRuntimeMemory);

    prevTime = performance.now() * 0.001;
    deltaTimePending = 0;
}

async function unloadCurrentRoom()
{
    if (currentRoom == undefined)
        throw new Error(`No room to unload.`);

    await ClientObjectManager.unload();
    PhysicsManager.unload(currentRoom.id);
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

        ClientObjectManager.update(deltaTime);
        GraphicsManager.update(App.getFPS());
        updateObservable.set(deltaTime);

        tickTimeQueue.push(currTime);
        while (tickTimeQueue[0] < currTime - 1)
            tickTimeQueue.shift();
    }

    prevTime = currTime;
}

const waitUntilSignalProcessingReady = (signalType: string, successCond: () => boolean): Promise<boolean> =>
    AsyncUtil.waitUntilSuccess(successCond, SignalTypeConfigMap.getConfigByType(signalType).maxClientSideReceptionPeriod)


export default App;
