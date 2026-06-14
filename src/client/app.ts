import ClientObjectManager from "./object/clientObjectManager";
import RoomRuntimeMemory from "../shared/room/types/roomRuntimeMemory";
import RoomChangedSignal from "../shared/room/types/roomChangedSignal";
import ThingsPoolEnv from "./system/types/thingsPoolEnv";
import GraphicsManager from "./graphics/graphicsManager";
import PhysicsManager from "../shared/physics/physicsManager";
import Room from "../shared/room/types/room";
import { RoomTypeEnumMap } from "../shared/room/types/roomType";
import { endClientProcess } from "./system/types/clientProcess";
import User from "../shared/user/types/user";
import { UserRole } from "../shared/user/types/userRole";
import { roomChangedObservable, texturePackURLObservable, updateObservable, userRoleObservable, singlePlayerObservable } from "./system/clientObservables";
import "./graphics/types/gizmo/colliderDebugGizmo";
import "./graphics/types/gizmo/voxelBlockWorldSpaceGizmos"; // Side-effect: registers world-space gizmos for voxel block selection
import "./graphics/types/gizmo/canvasWorldSpaceGizmos"; // Side-effect: registers world-space gizmos for canvas selection
import { preloadGenericWorldSpaceGizmos } from "./graphics/types/gizmo/genericWorldSpaceGizmos"; // Side-effect: registers world-space gizmos that are used for general purposes; also exposes a pre-load hook
import SetUserRoleSignal from "../shared/user/types/setUserRoleSignal";
import RoomTexturePackChangedSignal from "../shared/room/types/roomTexturePackChangedSignal";
import AsyncUtil from "../shared/system/util/asyncUtil";
import SignalTypeConfigMap from "../shared/networking/maps/signalTypeConfigMap";
import ImageMapUtil from "../shared/image/util/imageMapUtil";
import SinglePlayerManager from "./singlePlayer/singlePlayerManager";

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
        // Single-player mode is activated from the room the server actually places us in
        // (see onRoomChangedSignalReceived) — NOT from this page-embedded user flag. The two
        // are independent reads of user state that can disagree (e.g. the socket authenticates
        // a different user than the one rendered into the page), which would otherwise let the
        // single-player UI run on top of a multiplayer room. Start cleared and let the joined
        // room decide.
        singlePlayerObservable.set({mode: "", step: ""});
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
    // The room the user is sent to when their single-player experience (e.g. the tutorial)
    // ends. If they originally arrived via a room-specific URL, that destination was deferred
    // until the tutorial was cleared (see SocketsServer's connect-time routing) — honor it now.
    // Otherwise fall back to a hub. ("hub" is a reserved keyword the server resolves to an
    // available Hub room, not a real room ID.)
    getPostSinglePlayerRoomID: (): string =>
    {
        return env.targetRoomID && env.targetRoomID.length > 0 ? env.targetRoomID : "hub";
    },
    onSetUserRoleSignalReceived: async (params: SetUserRoleSignal) => {
        // If this is a UserRole update on the current user's player, update the app-level role.
        if (params.userID !== App.getUser()?.id)
            return;
        const success = await waitUntilSignalProcessingReady("setUserRoleSignal",
            () => params.roomID === App.getCurrentRoom()?.id);
        if (!success)
            return;
        userRoleObservable.set(params.userRole);
    },
    onRoomTexturePackChangedSignalReceived: async (params: RoomTexturePackChangedSignal) => {
        const success = await waitUntilSignalProcessingReady("roomTexturePackChangedSignal",
            () => params.roomID === App.getCurrentRoom()?.id);
        if (!success)
            return;
        currentRoom!.texturePackPath = params.texturePackPath;
        await ClientObjectManager.updateVoxelTexturePack(params.texturePackPath);
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

        // Notify listeners that the room has changed. This disposes the previous room's world-space
        // gizmos and resets their lazy-init state, so the pre-load below re-creates them fresh in
        // the new scene.
        roomChangedObservable.set(roomChangedSignal.roomRuntimeMemory);

        // While the "Loading" indicator is still showing, eagerly create the world-space gizmos and
        // pre-compile every material's shader program. This pays the one-time shader-compilation
        // cost up front, instead of stalling the frame the first time a gizmo appears mid-gameplay.
        // A failure here only forfeits the optimization, so don't let it strand the loading screen.
        try
        {
            await preloadGenericWorldSpaceGizmos();
            await GraphicsManager.precompileSceneShaders();
        }
        catch (err)
        {
            console.error("Failed to pre-load world-space gizmo shaders.", err);
        }

        endClientProcess("roomChange");

        // Remove superfluous trailing parts of the URL
        window.history.replaceState(null, "", "/");

        // The room the server actually placed us in is the single source of truth for whether
        // a single-player experience runs — this is what makes it impossible for the tutorial
        // UI/steps to run on top of a multiplayer room (or vice versa). A single-player room's
        // name is its mode identifier (Room.roomName == singlePlayerMode).
        const joinedRoom = roomChangedSignal.roomRuntimeMemory.room;
        if (joinedRoom.roomType == RoomTypeEnumMap.SinglePlayer)
        {
            // In a single-player room → run its scripted experience, starting at the initial step
            // now that the room is fully loaded.
            singlePlayerObservable.set({mode: joinedRoom.roomName, step: "initial"});
        }
        else
        {
            // In any other (multiplayer) room → no single-player experience should be running.
            // If one was (i.e. we just left a single-player room, whether by reaching the exit or
            // bailing out early), this ends it: tears down the local UI/flags and tells the server
            // to clear the persisted mode flag. It is a no-op when nothing was running, so ordinary
            // multiplayer-to-multiplayer navigation costs nothing.
            SinglePlayerManager.finishSinglePlayerMode();
        }
    },
}

async function loadRoom(roomRuntimeMemory: RoomRuntimeMemory, currentUserRole: UserRole)
{
    currentRoom = roomRuntimeMemory.room;

    userRoleObservable.set(currentUserRole);

    const texturePackURL = ImageMapUtil.getImageMap("TexturePackImageMap").getImageURLByPath(App.getEnv().assets_url, currentRoom.texturePackPath);
    texturePackURLObservable.set(texturePackURL);

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
        SinglePlayerManager.update(deltaTime);
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
