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
import { roomPrefsChangedObservable } from "../shared/system/sharedObservables";
import "./graphics/types/gizmo/colliderDebugGizmo";
import "./graphics/types/gizmo/wallAttachmentMoveGizmos"; // Side-effect: registers the arrows that move whichever wall attachment is picked out
import "./voxel/util/restrictedZoneOutlineUtil"; // Side-effect: keeps the outlines on the room's restricted zones up to date
import { preloadGenericWorldSpaceGizmos } from "./graphics/types/gizmo/genericWorldSpaceGizmos"; // Side-effect: registers world-space gizmos that are used for general purposes; also exposes a pre-load hook
import RoomTexturePackChangedSignal from "../shared/room/types/roomTexturePackChangedSignal";
import RoomPrefsChangedSignal from "../shared/room/types/roomPrefsChangedSignal";
import RoomLightingUtil from "./graphics/light/util/roomLightingUtil";
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
        // Single-player mode is driven by the joined room (see onRoomChangedSignalReceived), not by
        // this page-embedded flag, which can disagree with the socket's user.
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
    onRoomPrefsChangedSignalReceived: async (params: RoomPrefsChangedSignal) => {
        const success = await waitUntilSignalProcessingReady("roomPrefsChangedSignal",
            () => params.roomID === App.getCurrentRoom()?.id);
        if (!success)
            return;
        // Ignored while a local edit is pending (see RoomLightingUtil).
        if (!RoomLightingUtil.applyIncoming(params.prefs))
            return;
        // Announces the room, whose prefs string is what the UI reads back.
        roomPrefsChangedObservable.set(params.roomID);
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
    // Unloads the previous room (if any) and loads the new one.
    onRoomChangedSignalReceived: async (roomChangedSignal: RoomChangedSignal) =>
    {
        if (currentRoom != undefined)
        {
            RoomLoadProgressUtil.enterPhase("unloadingRoom");
            await unloadCurrentRoom();
        }
        await loadRoom(roomChangedSignal.roomRuntimeMemory);

        // Disposes the previous room's gizmos so the pre-load below recreates them.
        roomChangedObservable.set(roomChangedSignal.roomRuntimeMemory);

        // Precompile shaders and create gizmos behind the loading screen. Failure only loses the
        // optimization, so it mustn't block loading.
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

        // The joined room decides whether single-player runs (its roomName is the mode id).
        const joinedRoom = roomChangedSignal.roomRuntimeMemory.room;
        if (joinedRoom.roomType == RoomTypeEnumMap.SinglePlayer)
        {
            singlePlayerObservable.set({mode: joinedRoom.roomName, step: "initial"});
        }
        else
        {
            // Ends any single-player experience we just left (tears down UI/flags, tells the server).
            // No-op otherwise.
            SinglePlayerManager.finishSinglePlayerMode();
        }
    },
    // Releases the loading indicator and explains why the user stays put.
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

    // Generate single-player content before anything reads it.
    if (currentRoom.roomType == RoomTypeEnumMap.SinglePlayer)
        ClientObjectUtil.buildSinglePlayerRoomContent(currentRoom);

    RoomLoadProgressUtil.enterPhase("loadingGraphics");
    await GraphicsManager.load(update);
    // Before the first frame, so the room isn't lit like the previous one.
    RoomLightingUtil.applyRoomLighting(currentRoom.prefs);
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
        GraphicsManager.update();
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
