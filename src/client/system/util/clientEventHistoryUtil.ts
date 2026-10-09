import ClientEvent from "../types/clientEvent";
import { ClientEventType } from "../types/clientEventType";
import GameMode from "../types/gameMode";
import { clientFeatureFlagsObservable, gameModeObservable } from "../clientObservables";
import { FeatureFlag } from "../../../shared/system/types/featureFlag";
import ErrorUtil from "../../../shared/system/util/errorUtil";

const history: Map<ClientEventType, ClientEvent[]> = new Map();

// The events that can be undone, and those undone that can be redone (see ClientEvent.undo), each latest last. An
// event goes from one list to the other as it is undone or redone, and a new one empties the second.
const undoable: ClientEvent[] = [];
const redoable: ClientEvent[] = [];

// How soon after an event another under its merge key still counts as one with it (in milliseconds).
const MERGE_WINDOW_MS = 1000;

// The undo or redo under way, which the next one waits for: one can last several frames (an object coming back).
let pendingStep: Promise<unknown> = Promise.resolve();

// Counts the times the two lists were emptied, so a step still under way then puts nothing back in them.
let numListResets = 0;

const ClientEventHistoryUtil =
{
    add: (event: ClientEvent) =>
    {
        let events = history.get(event.type);
        if (events == undefined)
        {
            events = new Array<ClientEvent>();
            history.set(event.type, events);
        }
        events.push(event);

        if (event.undo == undefined || event.redo == undefined)
            return;
        release(redoable);
        const latest = undoable[undoable.length - 1];
        if (latest != undefined && event.mergeKey != undefined && event.mergeKey == latest.mergeKey &&
            event.time - latest.time <= MERGE_WINDOW_MS)
        {
            // One event with the latest, whose place it takes: undone to where that one began.
            event.undo = latest.undo;
            undoable[undoable.length - 1] = event;
            release([latest]);
        }
        else
            undoable.push(event);
    },
    // Returns -1 if no event is found.
    getLatestEventTime: (type: ClientEventType): number =>
    {
        let events = history.get(type);
        if (events == undefined || events.length == 0)
            return -1;
        return events[events.length-1].time;
    },
    getNumEventsAfterTime: (type: ClientEventType, time: number): number =>
    {
        let events = history.get(type);
        if (events == undefined)
            return 0;
        let count = 0;
        for (let i = events.length-1; i >= 0; --i)
        {
            const event = events[i];
            if (event.time <= time)
                return count;
            ++count;
        }
        return count;
    },
    // Undoes the latest event not yet undone, or redoes the latest one undone. "none": there is no such event, or a
    // scripted step blocks both (see FeatureFlag.DisableUndoRedo). "refused": it can no longer be done as the room
    // stands, which drops it, leaving the one before it next; a skippable one is dropped without a word, for the
    // same step to go on to the next. One at a time, in the order asked for.
    undo: (): Promise<"done" | "refused" | "none"> => enqueueStep(() => step(undoable, redoable, "undo")),
    redo: (): Promise<"done" | "refused" | "none"> => enqueueStep(() => step(redoable, undoable, "redo")),
    clear: () =>
    {
        history.clear();
        resetLists();
    },
}

function enqueueStep<Result>(run: () => Promise<Result>): Promise<Result>
{
    const result = pendingStep.then(run);
    pendingStep = result;
    return result;
}

async function step(from: ClientEvent[], to: ClientEvent[], way: "undo" | "redo"): Promise<"done" | "refused" | "none">
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableUndoRedo))
        return "none";

    const numResetsAtStart = numListResets;
    for (let event = from.pop(); event != undefined; event = from.pop())
    {
        let took = false;
        try
        {
            took = await event[way]!();
        }
        catch (err)
        {
            console.error(`Exception while trying to ${way} an event :: Error: ${ErrorUtil.getErrorMessage(err)}`);
        }

        // Emptied meanwhile, the lists get nothing back and the step goes no further.
        if (numResetsAtStart != numListResets)
        {
            release([event]);
            return took ? "done" : "none";
        }
        if (took)
        {
            to.push(event);
            return "done";
        }
        release([event]);
        if (!event.skippable)
            return "refused";
    }
    return "none";
}

// Empties a list of events that have left the two lists for good, and lets go of how to undo and redo them, which
// holds on to the room's objects: the history of their types keeps the events themselves.
function release(events: ClientEvent[]): void
{
    for (const event of events)
    {
        event.undo = undefined;
        event.redo = undefined;
    }
    events.length = 0;
}

function resetLists(): void
{
    release(undoable);
    release(redoable);
    ++numListResets;
}

// What can be undone is of one stay in edit mode and ends with it: with the room too, then, since every room is
// arrived in play mode (see GameModeUtil).
gameModeObservable.addListener("clientEventHistoryUtil", (mode: GameMode) => {
    if (mode != "edit")
        resetLists();
});

export default ClientEventHistoryUtil;
