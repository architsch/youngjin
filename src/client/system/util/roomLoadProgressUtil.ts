import { ongoingClientProcessesObservable } from "../clientObservables";
import RoomLoadPhase from "../types/roomLoadPhase";

// How far along a room load is, estimated entirely from what the client can see for itself: which
// stage of the load is running, how many of the things it has to spawn it has spawned, and how long
// each stage took the last time around. The server is never asked, and never reports, how much of a
// room it has handed over — a progress bar is not worth a single extra byte on the wire.
//
// The estimate is deliberately never allowed to reach the end: a bar that fills up and then sits
// there says the app has stopped, which is the one thing it must not say.
const RoomLoadProgressUtil =
{
    // Announces that the load has moved on to the given stage. Ignored unless a room load is
    // actually in flight, so the steps that also run outside one (e.g. swapping a room's texture
    // pack while playing in it) can report themselves unconditionally.
    enterPhase: (phase: RoomLoadPhase): void =>
    {
        if (!syncToOngoingRoomLoad())
            return;

        const phaseIndex = getPhaseIndex(phase);
        if (phaseIndex <= currentPhaseIndex) // Already past this stage — nothing to move on to.
            return;

        const currTime = performance.now() * 0.001;
        // What the stage just finished actually took is the best guess at what it will take next
        // time, blended with what was expected of it so that one unusually slow load (e.g. the
        // very first one, which pays for the socket connection and every asset's first fetch)
        // doesn't distort every load after it. Stages that were skipped keep their expectation.
        const finishedPhase = phaseModel[currentPhaseIndex];
        finishedPhase.expectedDuration = Math.max(minPhaseDuration,
            durationMemory * finishedPhase.expectedDuration +
            (1 - durationMemory) * (currTime - currentPhaseStartTime));

        currentPhaseIndex = phaseIndex;
        currentPhaseStartTime = currTime;
        unitsExpected = 0;
        unitsSpawned = 0;
    },
    // Tells the model how many things the current stage is about to spawn, turning it from a
    // stage paced by elapsed time into one that reports genuine progress.
    expectUnits: (numUnits: number): void =>
    {
        if (!syncToOngoingRoomLoad())
            return;
        unitsExpected = numUnits;
        unitsSpawned = 0;
    },
    // Counts one of those things as spawned.
    reportUnitSpawned: (): void =>
    {
        if (!syncToOngoingRoomLoad())
            return;
        unitsSpawned++;
    },
    // The share of the room load that is done, in [0, 1), or null while no room load is in flight
    // (the loading indicator also covers waits that have no rooms in them, and those get no bar).
    getProgress: (): number | null =>
    {
        if (!syncToOngoingRoomLoad())
            return null;

        const currentPhase = phaseModel[currentPhaseIndex];
        // An exponential approach: the closer the stage gets to its end, the slower it creeps, so
        // it keeps visibly moving however long the stage runs without ever claiming to be finished.
        const elapsed = performance.now() * 0.001 - currentPhaseStartTime;
        let phaseFraction = 1 - Math.exp(-elapsed / currentPhase.expectedDuration);
        // Where the stage can count what it is doing, the count is what the user should see —
        // but only when it is ahead of the clock, so a stall in the counting never freezes the bar.
        if (unitsExpected > 0)
            phaseFraction = Math.max(phaseFraction, Math.min(1, unitsSpawned / unitsExpected));

        progress = Math.max(progress,
            phaseStartFractions[currentPhaseIndex] + currentPhase.share * phaseFraction);
        return progress;
    },
}

// The name of the ClientProcess a room load runs under. The process is what marks a load as being
// in flight, and it already records when it began — which is why nothing has to tell this model
// that a load has started, no matter which of the several ways into a room the user took.
const roomLoadProcessName = "roomChange";

// How much of a whole room load each stage accounts for (the shares add up to 1), and how long it
// is expected to take until a load has been watched. The durations only pace the bar within a
// stage; they are replaced by measurements as soon as there are any.
const phaseModel: {phase: RoomLoadPhase, share: number, expectedDuration: number}[] =
[
    { phase: "awaitingServer",   share: 0.25, expectedDuration: 2.0 },
    { phase: "unloadingRoom",    share: 0.05, expectedDuration: 0.3 },
    { phase: "loadingGraphics",  share: 0.05, expectedDuration: 0.3 },
    { phase: "loadingVoxels",    share: 0.15, expectedDuration: 1.0 },
    { phase: "loadingObjects",   share: 0.35, expectedDuration: 3.0 },
    { phase: "compilingShaders", share: 0.15, expectedDuration: 1.5 },
];

// How much of a stage's existing expectation survives a new measurement of it.
const durationMemory = 0.5;

// No stage may be expected to take less than this, since an expectation of no time at all would
// pace the bar with a division by zero.
const minPhaseDuration = 0.05;

// The share of the whole load lying before each stage. Deriving these from the shares (rather than
// pinning each stage to a fixed point on the bar) is what lets a stage that turns out to be
// unnecessary — unloading a room when the user is not in one yet — hand its share to the next one.
const phaseStartFractions = getPhaseStartFractions();

// When the load being tracked began, as recorded by its ClientProcess. This is how a load that has
// just started is told apart from the one tracked so far.
let trackedLoadStartTime = -1;

let currentPhaseIndex = 0;
let currentPhaseStartTime = 0;
let unitsExpected = 0;
let unitsSpawned = 0;
let progress = 0;

// Returns whether a room load is in flight, starting the model over on one that has not been seen
// before. Every entry point goes through here, so a report that belongs to no load is discarded
// and a report that belongs to a new one cannot be credited to the previous one.
function syncToOngoingRoomLoad(): boolean
{
    const roomLoadProcess = ongoingClientProcessesObservable.peekValue(roomLoadProcessName);
    if (roomLoadProcess == undefined || roomLoadProcess.numOngoingProcesses <= 0)
    {
        trackedLoadStartTime = -1;
        return false;
    }

    if (roomLoadProcess.lastProcessStartTime !== trackedLoadStartTime)
    {
        trackedLoadStartTime = roomLoadProcess.lastProcessStartTime;
        currentPhaseIndex = 0; // Every load begins by waiting on the server.
        currentPhaseStartTime = roomLoadProcess.lastProcessStartTime;
        unitsExpected = 0;
        unitsSpawned = 0;
        progress = 0;
    }
    return true;
}

function getPhaseIndex(phase: RoomLoadPhase): number
{
    for (let i = 0; i < phaseModel.length; ++i)
    {
        if (phaseModel[i].phase === phase)
            return i;
    }
    throw new Error(`Unknown room load phase (phase = ${phase})`);
}

function getPhaseStartFractions(): number[]
{
    const startFractions: number[] = [];
    let cumulativeShare = 0;
    for (const phaseModelEntry of phaseModel)
    {
        startFractions.push(cumulativeShare);
        cumulativeShare += phaseModelEntry.share;
    }
    return startFractions;
}

export default RoomLoadProgressUtil;
