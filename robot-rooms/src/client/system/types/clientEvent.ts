import { ClientEventType } from "./clientEventType";

export default class ClientEvent
{
    type: ClientEventType;
    time: number;
    // Given to an event that can be undone (see ClientEventHistoryUtil): how to undo it and how to make it again,
    // each resolving to whether it took.
    undo?: () => Promise<boolean>;
    redo?: () => Promise<boolean>;
    // An event entered soon after another under the same key counts as one event with it (a text, as it is typed).
    mergeKey?: string;
    // An undo or redo stops at an event that doesn't take, unless it is skippable: that one is passed over for the
    // next (a selection, of what is no longer there to select).
    skippable?: boolean;

    constructor(type: ClientEventType, undoable?: {undo: () => Promise<boolean>, redo: () => Promise<boolean>,
        mergeKey?: string, skippable?: boolean})
    {
        this.type = type;
        this.time = performance.now();
        this.undo = undoable?.undo;
        this.redo = undoable?.redo;
        this.mergeKey = undoable?.mergeKey;
        this.skippable = undoable?.skippable;
    }
}
