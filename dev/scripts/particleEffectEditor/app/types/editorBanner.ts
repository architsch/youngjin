// A notice above the workspace. "external": the file changed on disk while there were unsaved edits;
// "conflict": a save was refused for the same reason. Both carry the file's current version.
type EditorBanner =
    | {kind: "external", text: string, hash: string}
    | {kind: "conflict", text: string, hash: string}
    | {kind: "error", message: string};

export default EditorBanner;
