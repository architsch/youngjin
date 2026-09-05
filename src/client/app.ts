import ClientObjectManager from "./object/clientObjectManager";
import ClientObjectUtil from "./object/util/clientObjectUtil";
import ClientVoxelManager from "./voxel/clientVoxelManager";
import RoomRuntimeMemory from "../shared/room/types/roomRuntimeMemory";
import RoomChangedSignal from "../shared/room/types/roomChangedSignal";
import RoomChangeRejectedSignal from "../shared/room/types/roomChangeRejectedSignal";
import { RoomChangeRejectionReason, RoomChangeRejectionReasonEnumMap } from "../shared/room/types/roomChangeRejectionReason";
import ThingsPoolEnv from "./system/types/thingsPoolEnv";
import GraphicsManager from "./graphics/graphicsManager";
import PhysicsManager from "../shared/physics/physicsManager";
import Room from "../shared/room/types/room";
import { RoomTypeEnumMap } from "../shared/room/types/roomType";
import { endClientProcess, ongoingClientProcessExists } from "./system/types/clientProcess";
import User from "../shared/user/types/user";
import { roomChangedObservable, updateObservable, singlePlayerObservable, notificationMessageObservable } from "./system/clientObservables";
import "./graphics/types/gizmo/colliderDebugGizmo";
import "./graphics/types/gizmo/canvasWorldSpaceGizmos"; // Side-effect: registers world-space gizmos for canvas selection
import "./graphics/types/gizmo/doorWorldSpaceGizmos"; // Side-effect: registers world-space gizmos for door selection
import "./voxel/util/restrictedZoneOutlineUtil"; // Side-effect: keeps the outlines on the room's restricted zones up to date
import { preloadGenericWorldSpaceGizmos } from "./graphics/types/gizmo/genericWorldSpaceGizmos"; // Side-effect: registers world-space gizmos that are used for general purposes; also exposes a pre-load hook
import RoomTexturePackChangedSignal from "../shared/room/types/roomTexturePackChangedSignal";
import AsyncUtil from "../shared/system/util/asyncUtil";
import SignalTypeConfigMap from "../shared/networking/maps/signalTypeConfigMap";
import SinglePlayerManager from "./singlePlayer/singlePlayerManager";
import RoomLoadProgressUtil from "./system/util/roomLoadProgressUtil";

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
    onRoomTexturePackChangedSignalReceived: async (params: RoomTexturePackChangedSignal) => {
        const success = await waitUntilSignalProcessingReady("roomTexturePackChangedSignal",
            () => params.roomID === App.getCurrentRoom()?.id);
        if (!success)
            return;
        currentRoom!.texturePackPath = params.texturePackPath;
        await ClientVoxelManager.applyVoxelTexturePack(params.texturePackPath);
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
        {
            RoomLoadProgressUtil.enterPhase("unloadingRoom");
            await unloadCurrentRoom();
        }
        await loadRoom(roomChangedSignal.roomRuntimeMemory);

        // Notify listeners that the room has changed. This disposes the previous room's world-space
        // gizmos and resets their lazy-init state, so the pre-load below re-creates them fresh in
        // the new scene.
        roomChangedObservable.set(roomChangedSignal.roomRuntimeMemory);

        // While the "Loading" indicator is still showing, eagerly create the world-space gizmos and
        // pre-compile every material's shader program. This pays the one-time shader-compilation
        // cost up front, instead of stalling the frame the first time a gizmo appears mid-gameplay.
        // A failure here only forfeits the optimization, so don't let it strand the loading screen.
        RoomLoadProgressUtil.enterPhase("compilingShaders");
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
    // The room change the user was waiting for is not going to happen (e.g. the destination
    // turned out to be full), so no RoomChangedSignal is coming. Release the "Loading"
    // indicator that the request put up, and tell the user why they are staying put.
    onRoomChangeRejectedSignalReceived: (roomChangeRejectedSignal: RoomChangeRejectedSignal) =>
    {
        if (ongoingClientProcessExists("roomChange"))
            endClientProcess("roomChange");
        notificationMessageObservable.set(getRoomChangeRejectionMessage(roomChangeRejectedSignal.reason));
    },
}

function getRoomChangeRejectionMessage(reason: RoomChangeRejectionReason): string
{
    switch (reason)
    {
        case RoomChangeRejectionReasonEnumMap.RoomIsAlmostFull:
            return "This room is full. Please try another one.";
        default:
            return "Failed to enter the room. Please try again.";
    }
}

async function loadRoom(roomRuntimeMemory: RoomRuntimeMemory)
{
    currentRoom = roomRuntimeMemory.room;

    // Single-player rooms come over the wire as a content-less descriptor; the client generates the
    // actual voxels/objects locally and injects them before anything reads room.voxelGrid/objectById.
    if (currentRoom.roomType == RoomTypeEnumMap.SinglePlayer)
        ClientObjectUtil.buildSinglePlayerRoomContent(currentRoom);

    RoomLoadProgressUtil.enterPhase("loadingGraphics");
    await GraphicsManager.load(update);
    PhysicsManager.load(roomRuntimeMemory);
    RoomLoadProgressUtil.enterPhase("loadingVoxels");
    await ClientVoxelManager.load();
    RoomLoadProgressUtil.enterPhase("loadingObjects");
    await ClientObjectManager.load(roomRuntimeMemory);

    prevTime = performance.now() * 0.001;
    deltaTimePending = 0;
}

async function unloadCurrentRoom()
{
    if (currentRoom == undefined)
        throw new Error(`No room to unload.`);

    ClientVoxelManager.unload();
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
