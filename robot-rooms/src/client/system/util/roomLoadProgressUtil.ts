import { ongoingClientProcessesObservable } from "../clientObservables";
import RoomLoadPhase from "../types/roomLoadPhase";

// Estimates room load progress client-side only (current stage, spawn counts, previous stage
// durations). Never reaches 100%, since a full, stalled bar looks frozen.
const RoomLoadProgressUtil =
{
    // Ignored outside a room load, so shared code paths can report unconditionally.
    enterPhase: (phase: RoomLoadPhase): void =>
    {
        if (!syncToOngoingRoomLoad())
            return;

        const phaseIndex = getPhaseIndex(phase);
        if (phaseIndex <= currentPhaseIndex) // Already past this stage — nothing to move on to.
            return;

        const currTime = performance.now() * 0.001;
        // Blend the measured duration into the expectation, so one slow load (e.g. the first) doesn't
        // skew later ones. Skipped stages keep their expectation.
        const finishedPhase = phaseModel[currentPhaseIndex];
        finishedPhase.expectedDuration = Math.max(minPhaseDuration,
            durationMemory * finishedPhase.expectedDuration +
            (1 - durationMemory) * (currTime - currentPhaseStartTime));

        currentPhaseIndex = phaseIndex;
        currentPhaseStartTime = currTime;
        unitsExpected = 0;
        unitsSpawned = 0;
    },
    // Switches the current stage from time-paced to count-based progress.
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
    // Progress in [0, 1), or null when no room load is in flight.
    getProgress: (): number | null =>
    {
        if (!syncToOngoingRoomLoad())
            return null;

        const currentPhase = phaseModel[currentPhaseIndex];
        // Exponential approach: keeps moving without ever finishing.
        const elapsed = performance.now() * 0.001 - currentPhaseStartTime;
        let phaseFraction = 1 - Math.exp(-elapsed / currentPhase.expectedDuration);
        // Use the count only when it's ahead of the clock, so a counting stall doesn't freeze the bar.
        if (unitsExpected > 0)
            phaseFraction = Math.max(phaseFraction, Math.min(1, unitsSpawned / unitsExpected));

        progress = Math.max(progress,
            phaseStartFractions[currentPhaseIndex] + currentPhase.share * phaseFraction);
        return progress;
    },
}

// The roomChange ClientProcess marks a load in flight and records its start time.
const roomLoadProcessName = "roomChange";

// Stage shares (summing to 1) and initial expected durations (replaced by measurements).
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

// Avoids division by zero.
const minPhaseDuration = 0.05;

// Derived from shares, so a skipped stage's share passes to the next one.
const phaseStartFractions = getPhaseStartFractions();

// Start time of the tracked load, to detect a new load.
let trackedLoadStartTime = -1;

let currentPhaseIndex = 0;
let currentPhaseStartTime = 0;
let unitsExpected = 0;
let unitsSpawned = 0;
let progress = 0;

// Whether a load is in flight; resets the model for a new load. All entry points use this.
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
