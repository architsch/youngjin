import EditorState from "../core/editorState";

// A save or delete based on a state that is no longer the current one; carries the current one.
export default class ConflictError extends Error
{
    readonly state: EditorState;

    constructor(state: EditorState)
    {
        super("The map changed since the page last read it");
        this.state = state;
    }
}
